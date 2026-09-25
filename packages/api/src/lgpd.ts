import {
  completionReactions,
  completions,
  dataRequests,
  db,
  householdMembers,
  households,
  meals,
  memberAbsences,
  memberSchedule,
  notificationPrefs,
  onboardingEvents,
  pets,
  pushSubscriptions,
  rewardPurchases,
  rooms,
  shoppingItems,
} from "@ocafy/db";
import { and, asc, eq, ne, sql } from "drizzle-orm";

/**
 * LGPD: direitos do titular. `exportAccountData` monta uma cópia legível dos dados da pessoa;
 * `deleteAccountData` apaga a conta e os dados (a casa só some se não sobrar ninguém).
 * As duas funções são usadas pelo app (autoatendimento) e pelo painel admin (fila de pedidos).
 */

export const REQUEST_SLA_DAYS = 15;

interface AuthUserRow extends Record<string, unknown> {
  id: string;
  name: string | null;
  email: string | null;
  createdAt: string | null;
}

async function authUser(userId: string): Promise<AuthUserRow | null> {
  const r = await db.execute<AuthUserRow>(sql`
    select id::text as id, name, email, "createdAt"::text as "createdAt"
    from neon_auth."user" where id::text = ${userId} limit 1
  `);
  return r.rows[0] ?? null;
}

export async function exportAccountData(userId: string) {
  const user = await authUser(userId);
  const [me] = await db
    .select({
      id: householdMembers.id,
      householdId: householdMembers.householdId,
      displayName: householdMembers.displayName,
      role: householdMembers.role,
      slot: householdMembers.slot,
      createdAt: householdMembers.createdAt,
      hasAvatar: sql<boolean>`${householdMembers.avatarData} is not null`,
    })
    .from(householdMembers)
    .where(eq(householdMembers.userId, userId));

  const base = {
    exportedAt: new Date().toISOString(),
    note: "Cópia dos seus dados no Ocafy (LGPD, art. 18). A foto de perfil não vai neste arquivo; peça se quiser.",
    account: user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        }
      : { id: userId },
  };
  const [events, requests] = await Promise.all([
    db
      .select()
      .from(onboardingEvents)
      .where(eq(onboardingEvents.userId, userId)),
    db.select().from(dataRequests).where(eq(dataRequests.userId, userId)),
  ]);
  if (!me) {
    return {
      ...base,
      household: null,
      onboardingEvents: events.map((e) => ({ step: e.step, at: e.createdAt })),
      dataRequests: requests,
    };
  }

  const [
    [house],
    roomRows,
    petRows,
    myCompletions,
    myMeals,
    myPurchases,
    myReactions,
    myShopping,
    schedule,
    absences,
    [prefs],
    devices,
  ] = await Promise.all([
    db.select().from(households).where(eq(households.id, me.householdId)),
    db.select().from(rooms).where(eq(rooms.householdId, me.householdId)),
    db.select().from(pets).where(eq(pets.householdId, me.householdId)),
    db.select().from(completions).where(eq(completions.completedBy, me.id)),
    db.select().from(meals).where(eq(meals.createdBy, me.id)),
    db
      .select()
      .from(rewardPurchases)
      .where(eq(rewardPurchases.memberId, me.id)),
    db
      .select()
      .from(completionReactions)
      .where(eq(completionReactions.memberId, me.id)),
    db.select().from(shoppingItems).where(eq(shoppingItems.addedBy, me.id)),
    db.select().from(memberSchedule).where(eq(memberSchedule.memberId, me.id)),
    db.select().from(memberAbsences).where(eq(memberAbsences.memberId, me.id)),
    db
      .select()
      .from(notificationPrefs)
      .where(eq(notificationPrefs.memberId, me.id)),
    db
      .select({
        id: pushSubscriptions.id,
        createdAt: pushSubscriptions.createdAt,
      })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.memberId, me.id)),
  ]);

  return {
    ...base,
    member: me,
    household: house
      ? {
          id: house.id,
          name: house.name,
          createdAt: house.createdAt,
          mode: house.mode,
          dwelling: house.dwelling,
          size: house.size,
          intensity: house.intensity,
          rooms: roomRows.map((r) => ({
            slug: r.slug,
            kind: r.kind,
            label: r.label,
          })),
          pets: petRows.map((p) => ({
            name: p.name,
            species: p.species,
            size: p.size,
          })),
        }
      : null,
    completions: myCompletions.map((c) => ({
      task: c.taskKey,
      at: c.completedAt,
      points: c.pointsAwarded,
      note: c.note,
    })),
    meals: myMeals.map((m) => ({
      date: m.dateKey,
      slot: m.slot,
      dish: m.dishName,
    })),
    rewardPurchases: myPurchases.map((p) => ({
      coins: p.costCoins,
      status: p.status,
      at: p.createdAt,
    })),
    reactions: myReactions.length,
    shoppingItemsAdded: myShopping.map((i) => ({
      name: i.name,
      at: i.createdAt,
    })),
    schedule,
    absences,
    notificationPreferences: prefs ?? null,
    pushDevices: devices.length,
    onboardingEvents: events.map((e) => ({ step: e.step, at: e.createdAt })),
    dataRequests: requests,
  };
}

export interface DeletionSummary {
  removedMember: boolean;
  removedHousehold: boolean;
  removedAuthUser: boolean;
}

/**
 * Apaga os dados da pessoa e a conta. Se sobram outros adultos na casa, só ela sai (e a posse
 * da casa passa para o adulto mais antigo); se era a última, a casa inteira é apagada.
 */
export async function deleteAccountData(
  userId: string,
): Promise<DeletionSummary> {
  const [me] = await db
    .select()
    .from(householdMembers)
    .where(eq(householdMembers.userId, userId));
  let removedHousehold = false;
  if (me) {
    const others = await db
      .select({ id: householdMembers.id })
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, me.householdId),
          eq(householdMembers.kind, "account"),
          ne(householdMembers.id, me.id),
        ),
      )
      .orderBy(asc(householdMembers.createdAt));
    if (!others.length) {
      await db.delete(households).where(eq(households.id, me.householdId));
      removedHousehold = true;
    } else {
      if (me.role === "owner") {
        await db
          .update(householdMembers)
          .set({ role: "owner" })
          .where(eq(householdMembers.id, others[0].id));
      }
      await db.delete(householdMembers).where(eq(householdMembers.id, me.id));
    }
  }
  await db.delete(onboardingEvents).where(eq(onboardingEvents.userId, userId));

  // Identidade no Neon Auth (sessões, contas e vínculos saem em cascata).
  const user = await authUser(userId);
  let removedAuthUser = false;
  if (user) {
    if (user.email) {
      await db.execute(
        sql`delete from neon_auth.verification where identifier = ${user.email}`,
      );
    }
    await db.execute(
      sql`delete from neon_auth."user" where id::text = ${userId}`,
    );
    removedAuthUser = true;
  }
  return { removedMember: !!me, removedHousehold, removedAuthUser };
}

/** Abre um pedido do titular (prazo de 15 dias). Repetir o mesmo tipo enquanto aberto reaproveita. */
export async function openDataRequest(
  userId: string,
  kind: "export" | "delete",
  note?: string,
) {
  const [open] = await db
    .select()
    .from(dataRequests)
    .where(
      and(
        eq(dataRequests.userId, userId),
        eq(dataRequests.kind, kind),
        sql`${dataRequests.status} in ('open','in_progress')`,
      ),
    );
  if (open) return open;
  const [me] = await db
    .select({ householdId: householdMembers.householdId })
    .from(householdMembers)
    .where(eq(householdMembers.userId, userId));
  const [row] = await db
    .insert(dataRequests)
    .values({
      userId,
      householdId: me?.householdId ?? null,
      kind,
      note: note?.trim().slice(0, 300) || null,
      dueAt: new Date(Date.now() + REQUEST_SLA_DAYS * 86_400_000),
    })
    .returning();
  return row;
}
