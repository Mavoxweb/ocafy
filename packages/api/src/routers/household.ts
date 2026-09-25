import { randomInt, randomUUID } from "node:crypto";
import {
  DEFAULT_REWARDS,
  type HouseMode,
  MODE_LIMITS,
  TRIAL_DAYS,
  buildRooms,
  nextFreeSlot,
} from "@ocafy/core";
import {
  db,
  entitlementGrants,
  householdMembers,
  households,
  invites,
  litterSettings,
  onboardingEvents,
  pets,
  rooms,
  storeRewards,
} from "@ocafy/db";
import { TRPCError } from "@trpc/server";
import { and, count, eq, gt, isNull, notInArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { z } from "zod";
import { parseAvatarDataUrl } from "../avatar";
import { sendEmail } from "../email/send";
import { inviteEmail } from "../email/templates";
import { assertWithinPlan, loadEntitlements } from "../entitlements";
import { flag } from "../flags";
import { assertCurrentVersion, recordAcceptance } from "../legal";
import { fullMessage, limitsOf, loadRoster } from "../roster";
import {
  createHouseholdSchema,
  joinSchema,
  onboardingStepSchema,
  updateProfileSchema,
} from "../schemas/index";
import { loadSnapshot } from "../snapshot";
import { authedProcedure, memberProcedure, router } from "../trpc";

// Sem 0/O/1/I para o código ser fácil de ditar.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () =>
  Array.from(
    { length: 8 },
    () => CODE_CHARS[randomInt(CODE_CHARS.length)],
  ).join("");

const isUniqueViolation = (e: unknown) =>
  typeof e === "object" &&
  e !== null &&
  ("code" in e ? (e as { code?: string }).code === "23505" : false);

const cause = (e: unknown) => (e as { cause?: unknown } | null)?.cause ?? e;

type Ops = [BatchItem<"pg">, ...BatchItem<"pg">[]];

const petValues = (p: {
  name: string;
  species: (typeof pets.$inferInsert)["species"];
  size?: (typeof pets.$inferInsert)["size"] | null;
  coat?: (typeof pets.$inferInsert)["coat"] | null;
  outdoorAccess?: boolean | null;
  litter?: (typeof pets.$inferInsert)["litter"] | null;
}) => {
  const dog = p.species === "dog";
  return {
    name: p.name,
    species: p.species,
    // Porte, pelagem e acesso à rua só fazem sentido para cães; a caixa só para gatos.
    size: dog ? (p.size ?? "medium") : null,
    coat: dog ? (p.coat ?? "short") : null,
    outdoorAccess: dog ? (p.outdoorAccess ?? false) : null,
    litter: p.species === "cat" ? (p.litter ?? "litter") : null,
  };
};

const profileColumns = (p: {
  mode: "solo" | "couple" | "family";
  dwelling: "apartment" | "house" | "townhouse" | "studio";
  size: "s" | "m" | "l";
  intensity: "light" | "standard" | "full";
  cooksAtHome: boolean;
  usesFrozen: boolean;
  hasWasher: boolean;
  hasPlants: boolean;
  hasCar: boolean;
  officeProject: boolean;
}) => ({
  mode: p.mode,
  dwelling: p.dwelling,
  size: p.size,
  intensity: p.intensity,
  cooksAtHome: p.cooksAtHome,
  usesFrozen: p.usesFrozen,
  hasWasher: p.hasWasher,
  hasPlants: p.hasPlants,
  hasCar: p.hasCar,
  officeProject: p.officeProject,
});

/** Mais de dois adultos com conta é recurso do plano Plus (Família). */
async function assertFamilyPlan(householdId: string) {
  const { entitlements } = await loadEntitlements(householdId);
  assertWithinPlan(
    entitlements,
    { mode: "couple", pets: 0, projects: 0 },
    { mode: "family", pets: 0, projects: 0 },
  );
}

/** Barra convites quando a casa já tem todos os adultos que o modo permite. */
async function assertRoomForMember(householdId: string) {
  const r = await loadRoster(householdId);
  if (r.adults >= limitsOf(r.mode).adults) {
    throw new TRPCError({ code: "CONFLICT", message: fullMessage(r.mode) });
  }
  if (r.adults >= 2) await assertFamilyPlan(householdId);
  return r;
}

export const householdRouter = router({
  /** Estado completo da casa (ou `none` se a conta ainda não tem casa). */
  snapshot: authedProcedure.query(async ({ ctx }) => {
    const data = await loadSnapshot(ctx.userId);
    return data
      ? { status: "ready" as const, data }
      : { status: "none" as const };
  }),

  /**
   * Consulta barata para o polling: só a revisão da casa. O app baixa o
   * snapshot completo apenas quando ela muda.
   */
  pulse: authedProcedure.query(async ({ ctx }) => {
    const [row] = await db
      .select({ rev: households.rev })
      .from(households)
      .where(
        eq(
          households.id,
          sql`(select ${householdMembers.householdId} from ${householdMembers} where ${householdMembers.userId} = ${ctx.userId})`,
        ),
      );
    return { rev: row?.rev ?? null };
  }),

  create: authedProcedure
    .input(createHouseholdSchema)
    .mutation(async ({ ctx, input }) => {
      if (!(await flag("signups_open", true))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Novos cadastros estão temporariamente fechados.",
        });
      }
      assertCurrentVersion(input.acceptedLegalVersion);
      await recordAcceptance(ctx.userId, "onboarding");
      const householdId = randomUUID();
      const built = buildRooms(input.rooms);
      const cats = input.pets.filter((p) => p.species === "cat").length;
      try {
        const ops: Ops = [
          db.insert(households).values({
            id: householdId,
            name: input.houseName,
            ...profileColumns(input.profile),
            onboardedAt: new Date(),
          }),
          db.insert(householdMembers).values({
            householdId,
            userId: ctx.userId,
            displayName: input.memberName,
            role: "owner",
            slot: "a",
          }),
          db.insert(entitlementGrants).values({
            householdId,
            plan: "plus",
            source: "trial",
            expiresAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000),
            reason: "Teste gratuito de boas-vindas",
          }),
          db.insert(litterSettings).values({
            householdId,
            catsCount: Math.max(1, cats),
            boxesCount: Math.max(1, Math.ceil(cats / 2)),
          }),
          db
            .insert(storeRewards)
            .values(DEFAULT_REWARDS.map((r) => ({ ...r, householdId }))),
        ];
        if (built.length) {
          ops.push(
            db.insert(rooms).values(
              built.map((r) => ({
                householdId,
                slug: r.slug,
                kind: r.kind,
                label: r.custom,
                position: r.position,
              })),
            ),
          );
        }
        if (input.pets.length) {
          ops.push(
            db
              .insert(pets)
              .values(
                input.pets.map((p) => ({ householdId, ...petValues(p) })),
              ),
          );
        }
        await db.batch(ops);
      } catch (e) {
        if (isUniqueViolation(cause(e))) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Esta conta já tem uma casa.",
          });
        }
        throw e;
      }
      return { householdId };
    }),

  join: authedProcedure.input(joinSchema).mutation(async ({ ctx, input }) => {
    assertCurrentVersion(input.acceptedLegalVersion);
    const code = input.code.toUpperCase().replace(/\s/g, "");
    const [invite] = await db
      .select()
      .from(invites)
      .where(
        and(
          eq(invites.code, code),
          isNull(invites.usedAt),
          gt(invites.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!invite) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Convite inválido ou expirado.",
      });
    }
    const roster = await loadRoster(invite.householdId);
    if (roster.adults >= limitsOf(roster.mode).adults) {
      throw new TRPCError({
        code: "CONFLICT",
        message:
          roster.mode === "solo"
            ? "Esta casa é individual (modo Solo)."
            : "Esta casa já está completa.",
      });
    }
    if (roster.adults >= 2) await assertFamilyPlan(invite.householdId);
    const slot = nextFreeSlot(roster.slots);
    if (!slot) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Esta casa já está completa.",
      });
    }
    try {
      await db.batch([
        db.insert(householdMembers).values({
          householdId: invite.householdId,
          userId: ctx.userId,
          displayName: input.memberName,
          role: "member",
          slot,
        }),
        db
          .update(invites)
          .set({ usedAt: new Date() })
          .where(eq(invites.id, invite.id)),
      ]);
    } catch (e) {
      if (isUniqueViolation(cause(e))) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Não foi possível entrar nesta casa (conta já vinculada ou casa cheia).",
        });
      }
      throw e;
    }
    await recordAcceptance(ctx.userId, "join");
    return { householdId: invite.householdId };
  }),

  /** Reaproveita o convite ativo ou gera um novo (7 dias). */
  createInvite: memberProcedure.mutation(async ({ ctx }) => {
    await assertRoomForMember(ctx.householdId);
    const [active] = await db
      .select()
      .from(invites)
      .where(
        and(
          eq(invites.householdId, ctx.householdId),
          isNull(invites.usedAt),
          gt(invites.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (active)
      return { code: active.code, expiresAt: active.expiresAt.toISOString() };
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    const [created] = await db
      .insert(invites)
      .values({ householdId: ctx.householdId, code: newCode(), expiresAt })
      .returning();
    return { code: created.code, expiresAt: created.expiresAt.toISOString() };
  }),

  /**
   * Envia o convite por e-mail (Resend). O link usa APP_URL do servidor, nunca um
   * endereço vindo do cliente (evita usar o Ocafy para mandar links de phishing).
   */
  sendInviteEmail: memberProcedure
    .input(
      z.object({ email: z.string().trim().toLowerCase().email().max(120) }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertRoomForMember(ctx.householdId);
      const [active] = await db
        .select()
        .from(invites)
        .where(
          and(
            eq(invites.householdId, ctx.householdId),
            isNull(invites.usedAt),
            gt(invites.expiresAt, new Date()),
          ),
        )
        .limit(1);
      const invite =
        active ??
        (
          await db
            .insert(invites)
            .values({
              householdId: ctx.householdId,
              code: newCode(),
              expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
            })
            .returning()
        )[0];
      const [house] = await db
        .select({ name: households.name })
        .from(households)
        .where(eq(households.id, ctx.householdId));
      const base = (process.env.APP_URL ?? "https://ocafy.vercel.app").replace(
        /\/$/,
        "",
      );
      const mail = inviteEmail({
        inviterName: ctx.member.displayName,
        houseName: house?.name ?? "Casa",
        url: `${base}/entrar?convite=${invite.code}`,
        code: invite.code,
      });
      const res = await sendEmail({ to: input.email, ...mail, tag: "invite" });
      return {
        code: invite.code,
        sent: res.sent,
        reason: res.sent ? null : res.reason,
      };
    }),

  rename: memberProcedure
    .input(z.object({ name: z.string().trim().min(2).max(24) }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(householdMembers)
        .set({ displayName: input.name })
        .where(eq(householdMembers.id, ctx.member.id));
      return { ok: true };
    }),

  /** Foto de perfil (data URL já recortada no cliente). */
  setAvatar: memberProcedure
    .input(z.object({ dataUrl: z.string().max(200_000) }))
    .mutation(async ({ ctx, input }) => {
      const a = parseAvatarDataUrl(input.dataUrl);
      const avatarVersion = Date.now();
      await db
        .update(householdMembers)
        .set({ avatarData: a.base64, avatarType: a.type, avatarVersion })
        .where(eq(householdMembers.id, ctx.member.id));
      return { avatarVersion };
    }),

  removeAvatar: memberProcedure.mutation(async ({ ctx }) => {
    await db
      .update(householdMembers)
      .set({ avatarData: null, avatarType: null, avatarVersion: null })
      .where(eq(householdMembers.id, ctx.member.id));
    return { ok: true };
  }),

  /**
   * Atualiza o perfil da casa (modo, tipo, tamanho, intensidade, cômodos e pets) de uma só vez.
   * Nada do histórico é apagado: tarefas que saem do plano só deixam de aparecer; se voltarem
   * (mesmos cômodos/pets), o histórico volta junto.
   */
  updateProfile: memberProcedure
    .input(updateProfileSchema)
    .mutation(async ({ ctx, input }) => {
      const [roster, existingPets, [houseNow], plan] = await Promise.all([
        loadRoster(ctx.householdId),
        db
          .select({ id: pets.id })
          .from(pets)
          .where(eq(pets.householdId, ctx.householdId)),
        db
          .select({ mode: households.mode, office: households.officeProject })
          .from(households)
          .where(eq(households.id, ctx.householdId)),
        loadEntitlements(ctx.householdId),
      ]);
      assertWithinPlan(
        plan.entitlements,
        {
          mode: houseNow?.mode ?? "couple",
          pets: existingPets.length,
          projects: houseNow?.office ? 1 : 0,
        },
        {
          mode: input.profile.mode,
          pets: input.pets.length,
          projects: input.profile.officeProject ? 1 : 0,
        },
      );
      const lim = MODE_LIMITS[input.profile.mode];
      if (roster.adults > lim.adults) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            input.profile.mode === "solo"
              ? "Há mais de uma pessoa nesta casa; o modo Solo só vale para uma."
              : "Há mais de duas pessoas com conta nesta casa; para reduzir o modo, remova adultos antes.",
        });
      }
      if (roster.kids > lim.kids) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Há perfis de criança nesta casa. Remova-os antes de sair do modo Família.",
        });
      }

      const built = buildRooms(input.rooms);
      const knownPets = new Set(existingPets.map((p) => p.id));
      const keep = input.pets.filter((p) => p.id && knownPets.has(p.id));
      const fresh = input.pets.filter((p) => !p.id || !knownPets.has(p.id));
      const keepIds = keep.map((p) => p.id as string);
      const cats = input.pets.filter((p) => p.species === "cat").length;
      const slugs = built.map((r) => r.slug);

      const ops: Ops = [
        db
          .update(households)
          .set({
            ...profileColumns(input.profile),
            rev: sql`${households.rev} + 1`,
          })
          .where(eq(households.id, ctx.householdId)),
        // Só remove cômodos "de verdade"; as linhas antigas gatos/casa ficam quietas.
        db
          .delete(rooms)
          .where(
            and(
              eq(rooms.householdId, ctx.householdId),
              slugs.length
                ? notInArray(rooms.slug, [...slugs, "gatos", "casa"])
                : sql`${rooms.slug} not in ('gatos', 'casa')`,
            ),
          ),
        db
          .delete(pets)
          .where(
            and(
              eq(pets.householdId, ctx.householdId),
              keepIds.length ? notInArray(pets.id, keepIds) : undefined,
            ),
          ),
      ];
      if (built.length) {
        ops.push(
          db
            .insert(rooms)
            .values(
              built.map((r) => ({
                householdId: ctx.householdId,
                slug: r.slug,
                kind: r.kind,
                label: r.custom,
                position: r.position,
              })),
            )
            .onConflictDoUpdate({
              target: [rooms.householdId, rooms.slug],
              set: {
                kind: sql`excluded.kind`,
                label: sql`excluded.label`,
                position: sql`excluded.position`,
              },
            }),
        );
      }
      for (const p of keep) {
        ops.push(
          db
            .update(pets)
            .set(petValues(p))
            .where(
              and(
                eq(pets.id, p.id as string),
                eq(pets.householdId, ctx.householdId),
              ),
            ),
        );
      }
      if (fresh.length) {
        ops.push(
          db.insert(pets).values(
            fresh.map((p) => ({
              householdId: ctx.householdId,
              ...petValues(p),
            })),
          ),
        );
      }
      // A areia usa a contagem real de gatos (os cálculos de estoque partem dela).
      if (cats > 0) {
        ops.push(
          db
            .update(litterSettings)
            .set({ catsCount: cats })
            .where(eq(litterSettings.householdId, ctx.householdId)),
        );
      }
      await db.batch(ops);
      return { ok: true };
    }),

  /** Passo do onboarding concluído/visto (mede onde as pessoas desistem). Sem dados pessoais. */
  onboardingStep: authedProcedure
    .input(onboardingStepSchema)
    .mutation(async ({ ctx, input }) => {
      await db
        .insert(onboardingEvents)
        .values({ userId: ctx.userId, step: input.step });
      return { ok: true };
    }),

  /** Apaga a casa inteira (todos os dados, dos dois). Só quem criou. */
  delete: memberProcedure.mutation(async ({ ctx }) => {
    if (ctx.member.role !== "owner") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Só quem criou a casa pode apagá-la.",
      });
    }
    await db.delete(households).where(eq(households.id, ctx.householdId));
    return { ok: true };
  }),
});
