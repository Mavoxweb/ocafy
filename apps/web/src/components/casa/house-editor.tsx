"use client";

import { RoomIcon } from "@/components/ui/icons";
import { Chip, Field, Segmented } from "@/components/ui/primitives";
import { uid } from "@/lib/dates";
import {
  type HouseDraft,
  type KidDraft,
  type PetDraft,
  draftPlan,
  newPet,
} from "@/lib/house-draft";
import { useAppState } from "@/lib/store";
import {
  AGE_BANDS,
  AGE_BAND_ORDER,
  DOG_SIZES,
  DOG_SIZE_ORDER,
  DWELLING_LABELS,
  GUARDIAN_DECLARATION,
  INTENSITY_LABELS,
  type Intensity,
  MODE_LABELS,
  MODE_LIMITS,
  PET_SPECIES,
  type PetSpecies,
  type PlannedTask,
  ROOM_KINDS,
  ROOM_KIND_ORDER,
  type RoomKind,
  SIZE_LABELS,
  defaultRoomLabel,
  diffPlans,
  groupPlan,
  slugFor,
  summarizePlan,
} from "@ocafy/core";
import Link from "next/link";
import { useMemo, useState } from "react";

type Patch = (fn: (d: HouseDraft) => HouseDraft) => void;

/* ================= crianças (modo Família) ================= */

export function KidsEditor({
  draft,
  patch,
}: { draft: HouseDraft; patch: Patch }) {
  const max = MODE_LIMITS.family.kids;
  const add = () =>
    patch((d) => ({
      ...d,
      kids: [
        ...d.kids,
        {
          key: uid(),
          name: `Criança ${d.kids.length + 1}`,
          ageBand: "child_7_9",
        },
      ],
    }));
  const update = (key: string, next: Partial<KidDraft>) =>
    patch((d) => ({
      ...d,
      kids: d.kids.map((k) => (k.key === key ? { ...k, ...next } : k)),
    }));
  const remove = (key: string) =>
    patch((d) => ({ ...d, kids: d.kids.filter((k) => k.key !== key) }));

  return (
    <div className="grid gap-3">
      <p className="meta">
        Crianças não precisam de conta: um adulto registra as tarefas por elas e
        o XP vai para o perfil delas. Você escolhe a idade e o Ocafy sugere
        tarefas do tamanho certo.
      </p>
      {draft.kids.map((k) => (
        <div key={k.key} className="petcard">
          <div className="petcard-head">
            <span className="petcard-ico" aria-hidden="true">
              🧒
            </span>
            <input
              type="text"
              maxLength={20}
              value={k.name}
              aria-label="Nome da criança"
              onChange={(e) => update(k.key, { name: e.target.value })}
            />
            <button
              type="button"
              className="link"
              onClick={() => remove(k.key)}
            >
              Remover
            </button>
          </div>
          <div>
            <div className="qlabel">Faixa etária</div>
            <div className="chips wrap">
              {AGE_BAND_ORDER.map((b) => (
                <Chip
                  key={b}
                  pressed={k.ageBand === b}
                  onClick={() => update(k.key, { ageBand: b })}
                >
                  {AGE_BANDS[b].label}
                </Chip>
              ))}
            </div>
            <p className="meta mt-1">{AGE_BANDS[k.ageBand].hint}</p>
          </div>
          {k.id && (
            <p className="meta">
              Ao remover, o histórico e o XP deste perfil também saem da casa.
            </p>
          )}
        </div>
      ))}
      {draft.kids.some((k) => !k.id) && (
        <label className="legal-check">
          <input
            type="checkbox"
            checked={draft.guardianDeclared}
            onChange={(e) =>
              patch((d) => ({ ...d, guardianDeclared: e.target.checked }))
            }
          />
          <span>{GUARDIAN_DECLARATION}</span>
        </label>
      )}
      {draft.kids.length < max && (
        <button type="button" className="btn btn-small" onClick={add}>
          + Adicionar criança
        </button>
      )}
    </div>
  );
}

/* ================= sobre a casa ================= */

const MODE_TEXT = {
  solo: ["🧍", "Só você — sem divisão, com metas suas"],
  couple: ["👫", "Duas pessoas dividindo, com placar e trocas"],
  family: ["👨‍👩‍👧", "Adultos e crianças, com tarefas por idade"],
} as const;

export function ModePicker({
  draft,
  patch,
}: { draft: HouseDraft; patch: Patch }) {
  const s = useAppState();
  // Só vale para casas que já existem: no onboarding o teste de 14 dias libera tudo.
  const familyLocked =
    !!s.household && !s.plan.entitlements.family && s.profile.mode !== "family";
  return (
    <div className="grid gap-2.5">
      <div className="mode-grid">
        {(["solo", "couple", "family"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className="mode-card"
            aria-pressed={draft.profile.mode === m}
            disabled={m === "family" && familyLocked}
            onClick={() =>
              patch((d) => ({ ...d, profile: { ...d.profile, mode: m } }))
            }
          >
            <span className="mode-emoji" aria-hidden="true">
              {MODE_TEXT[m][0]}
            </span>
            <b>{MODE_LABELS[m]}</b>
            <span className="meta">
              {m === "family" && familyLocked
                ? "Faz parte do plano Plus"
                : MODE_TEXT[m][1]}
            </span>
          </button>
        ))}
      </div>
      {familyLocked && (
        <p className="meta m-0">
          <Link href="/plano" className="link">
            Conheça o plano Plus
          </Link>{" "}
          para usar o modo Família.
        </p>
      )}
    </div>
  );
}

export function HouseFields({
  draft,
  patch,
  onResetRooms,
}: {
  draft: HouseDraft;
  patch: Patch;
  /** Chamado quando tipo/tamanho mudam (o onboarding recalcula os cômodos sugeridos). */
  onResetRooms?: (
    dwelling: HouseDraft["profile"]["dwelling"],
    size: HouseDraft["profile"]["size"],
  ) => void;
}) {
  const p = draft.profile;
  const set = (
    next: Partial<HouseDraft["profile"]>,
    resetRooms = false,
  ): void => {
    patch((d) => ({ ...d, profile: { ...d.profile, ...next } }));
    if (resetRooms)
      onResetRooms?.(next.dwelling ?? p.dwelling, next.size ?? p.size);
  };

  return (
    <div className="grid gap-4">
      <div>
        <div className="qlabel">Tipo de moradia</div>
        <div className="chips wrap">
          {(
            Object.keys(DWELLING_LABELS) as (keyof typeof DWELLING_LABELS)[]
          ).map((k) => (
            <Chip
              key={k}
              pressed={p.dwelling === k}
              onClick={() => set({ dwelling: k }, true)}
            >
              {DWELLING_LABELS[k]}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <div className="qlabel">Tamanho</div>
        <Segmented
          label="Tamanho da casa"
          value={p.size}
          onChange={(v) => set({ size: v }, true)}
          options={(["s", "m", "l"] as const).map((k) => ({
            value: k,
            label: SIZE_LABELS[k],
          }))}
        />
      </div>
    </div>
  );
}

export function RhythmFields({
  draft,
  patch,
}: { draft: HouseDraft; patch: Patch }) {
  const p = draft.profile;
  const flag = (
    key:
      | "cooksAtHome"
      | "usesFrozen"
      | "hasWasher"
      | "hasPlants"
      | "hasCar"
      | "officeProject",
  ) =>
    patch((d) => ({ ...d, profile: { ...d.profile, [key]: !d.profile[key] } }));

  return (
    <div className="grid gap-4">
      <div>
        <div className="qlabel">Quanto da casa você quer cuidar?</div>
        <div className="int-grid">
          {(["light", "standard", "full"] as Intensity[]).map((k) => (
            <button
              key={k}
              type="button"
              className="mode-card"
              aria-pressed={p.intensity === k}
              onClick={() =>
                patch((d) => ({
                  ...d,
                  profile: { ...d.profile, intensity: k },
                }))
              }
            >
              <b>{INTENSITY_LABELS[k].name}</b>
              <span className="meta">{INTENSITY_LABELS[k].hint}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="qlabel">O que vale para a sua casa?</div>
        <div className="chips wrap">
          <Chip pressed={p.cooksAtHome} onClick={() => flag("cooksAtHome")}>
            Cozinhamos em casa
          </Chip>
          <Chip pressed={p.usesFrozen} onClick={() => flag("usesFrozen")}>
            Usamos congelados
          </Chip>
          <Chip pressed={p.hasWasher} onClick={() => flag("hasWasher")}>
            Máquina de lavar
          </Chip>
          <Chip pressed={p.hasPlants} onClick={() => flag("hasPlants")}>
            Plantas
          </Chip>
          <Chip pressed={p.hasCar} onClick={() => flag("hasCar")}>
            Carro
          </Chip>
          <Chip pressed={p.officeProject} onClick={() => flag("officeProject")}>
            Projeto Escritório
          </Chip>
        </div>
        <p className="meta mt-2">
          O Projeto Escritório é uma trilha de 9 semanas para organizar um
          cômodo de trabalho. Só aparece para quem escolhe.
        </p>
      </div>
    </div>
  );
}

/* ================= cômodos com quantidade ================= */

export function RoomGrid({
  draft,
  patch,
}: { draft: HouseDraft; patch: Patch }) {
  const [naming, setNaming] = useState<RoomKind | null>(null);
  const setCount = (kind: RoomKind, n: number) =>
    patch((d) => ({
      ...d,
      counts: {
        ...d.counts,
        [kind]: Math.max(0, Math.min(n, ROOM_KINDS[kind].max)),
      },
    }));

  return (
    <div className="rgrid">
      {ROOM_KIND_ORDER.map((kind) => {
        const n = draft.counts[kind] ?? 0;
        const info = ROOM_KINDS[kind];
        return (
          <div key={kind} className={`rcell ${n > 0 ? "on" : ""}`}>
            <span className="rcell-ico" aria-hidden="true">
              <RoomIcon room={kind} size={26} />
            </span>
            <span className="rcell-name">{info.plural}</span>
            {/* biome-ignore lint/a11y/useSemanticElements: fieldset não combina com o layout do contador */}
            <div className="qty" role="group" aria-label={info.plural}>
              <button
                type="button"
                aria-label={`Menos ${info.label.toLowerCase()}`}
                disabled={n <= 0}
                onClick={() => setCount(kind, n - 1)}
              >
                −
              </button>
              <output aria-live="polite">{n}</output>
              <button
                type="button"
                aria-label={`Mais ${info.label.toLowerCase()}`}
                disabled={n >= info.max}
                onClick={() => setCount(kind, n + 1)}
              >
                +
              </button>
            </div>
            {n > 0 && kind !== "servico" && (
              <button
                type="button"
                className="link rcell-nick"
                onClick={() => setNaming(naming === kind ? null : kind)}
              >
                {naming === kind ? "Fechar" : "Apelidos"}
              </button>
            )}
            {naming === kind && (
              <div className="rcell-names">
                {Array.from({ length: n }, (_, i) => {
                  const slug = slugFor(kind, i);
                  return (
                    <Field key={slug} label={`${info.label} ${i + 1}`}>
                      <input
                        type="text"
                        maxLength={30}
                        placeholder={defaultRoomLabel(kind, i, n)}
                        value={draft.labels[slug] ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          patch((d) => {
                            const labels = { ...d.labels };
                            if (v) labels[slug] = v;
                            else delete labels[slug];
                            return { ...d, labels };
                          });
                        }}
                      />
                    </Field>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ================= pets ================= */

const SPECIES_ORDER: PetSpecies[] = [
  "dog",
  "cat",
  "bird",
  "fish",
  "rodent",
  "reptile",
  "other",
];

export function PetsEditor({
  draft,
  patch,
}: { draft: HouseDraft; patch: Patch }) {
  const s = useAppState();
  // Só bloqueia AUMENTAR além do limite do plano (quem já tem mais mantém).
  const petsLocked =
    !!s.household &&
    draft.pets.length >= s.plan.entitlements.maxPets &&
    draft.pets.length >= s.pets.length;
  const add = (species: PetSpecies) =>
    patch((d) => ({
      ...d,
      pets: [
        ...d.pets,
        newPet(species, d.pets.filter((p) => p.species === species).length + 1),
      ],
    }));
  const update = (key: string, next: Partial<PetDraft>) =>
    patch((d) => ({
      ...d,
      pets: d.pets.map((p) => (p.key === key ? { ...p, ...next } : p)),
    }));
  const remove = (key: string) =>
    patch((d) => ({ ...d, pets: d.pets.filter((p) => p.key !== key) }));

  return (
    <div className="grid gap-3">
      <div className="chips wrap">
        {SPECIES_ORDER.map((sp) => (
          <button
            key={sp}
            type="button"
            className="chip"
            aria-label={`Adicionar ${PET_SPECIES[sp].label.toLowerCase()}`}
            disabled={petsLocked}
            onClick={() => add(sp)}
          >
            <span aria-hidden="true">{PET_SPECIES[sp].icon}</span>+{" "}
            {PET_SPECIES[sp].label}
          </button>
        ))}
      </div>
      {petsLocked && (
        <p className="meta m-0">
          O plano Grátis comporta {s.plan.entitlements.maxPets}{" "}
          {s.plan.entitlements.maxPets === 1 ? "pet" : "pets"}.{" "}
          <Link href="/plano" className="link">
            Veja o Plus
          </Link>{" "}
          para adicionar mais.
        </p>
      )}
      {!draft.pets.length && (
        <p className="meta">
          Sem pets? Tudo bem — é só continuar. Dá para adicionar depois em
          “Minha casa”.
        </p>
      )}
      {draft.pets.map((p) => (
        <div key={p.key} className="petcard">
          <div className="petcard-head">
            <span className="petcard-ico" aria-hidden="true">
              {PET_SPECIES[p.species].icon}
            </span>
            <input
              type="text"
              maxLength={20}
              value={p.name}
              aria-label={`Nome do ${PET_SPECIES[p.species].label.toLowerCase()}`}
              onChange={(e) => update(p.key, { name: e.target.value })}
            />
            <button
              type="button"
              className="link"
              onClick={() => remove(p.key)}
            >
              Remover
            </button>
          </div>
          {p.species === "dog" && (
            <div className="grid gap-2.5">
              <div>
                <div className="qlabel">Porte</div>
                <div className="chips wrap">
                  {DOG_SIZE_ORDER.map((sz) => (
                    <Chip
                      key={sz}
                      pressed={p.size === sz}
                      onClick={() => update(p.key, { size: sz })}
                    >
                      {DOG_SIZES[sz].label}
                      <small className="text-muted">
                        {DOG_SIZES[sz].weight}
                      </small>
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Segmented
                  label="Pelagem"
                  value={p.coat}
                  onChange={(v) => update(p.key, { coat: v })}
                  options={[
                    { value: "short", label: "Pelo curto" },
                    { value: "long", label: "Pelo longo" },
                  ]}
                />
                <Chip
                  pressed={p.outdoorAccess}
                  onClick={() =>
                    update(p.key, { outdoorAccess: !p.outdoorAccess })
                  }
                >
                  Faz as necessidades no quintal
                </Chip>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ================= prévia do plano ================= */

export function PlanPreview({
  draft,
  before,
}: {
  draft: HouseDraft;
  /** Plano atual da casa: mostra o que entra e o que sai. */
  before?: PlannedTask[];
}) {
  const plan = useMemo(() => draftPlan(draft), [draft]);
  const sum = summarizePlan(plan);
  const groups = groupPlan(plan);
  const diff = before ? diffPlans(before, plan) : null;

  return (
    <div className="grid gap-3.5">
      <div className="stats">
        <div className="stat">
          <div className="v">{sum.routineMorning + sum.routineNight}</div>
          <div className="k">
            rotinas diárias ({sum.routineMorning} de manhã · {sum.routineNight}{" "}
            à noite)
          </div>
        </div>
        <div className="stat">
          <div className="v">{sum.recurring}</div>
          <div className="k">tarefas recorrentes com janela de dias</div>
        </div>
        <div className="stat">
          <div className="v">~{sum.minutesPerDay - sum.petMinutesPerDay}</div>
          <div className="k">
            minutos por dia na casa, em média
            {sum.petMinutesPerDay > 0
              ? ` (+ ~${sum.petMinutesPerDay} com pets)`
              : ""}
          </div>
        </div>
        <div className="stat">
          <div className="v">{groups.length}</div>
          <div className="k">áreas acompanhadas</div>
        </div>
      </div>

      <div className="chips wrap" aria-label="Tarefas por área">
        {groups.map((g) => (
          <span key={g.key} className="chip static">
            {g.label} <b>{g.count}</b>
          </span>
        ))}
      </div>

      {diff && (diff.added.length > 0 || diff.removed.length > 0) && (
        <div className="diffbox">
          {diff.added.length > 0 && (
            <div>
              <b className="text-ok-t">+ {diff.added.length} entram</b>
              <ul>
                {diff.added.slice(0, 8).map((t) => (
                  <li key={t.id}>{t.t}</li>
                ))}
              </ul>
              {diff.added.length > 8 && (
                <span className="meta">e mais {diff.added.length - 8}…</span>
              )}
            </div>
          )}
          {diff.removed.length > 0 && (
            <div>
              <b className="text-late-t">− {diff.removed.length} saem</b>
              <ul>
                {diff.removed.slice(0, 8).map((t) => (
                  <li key={t.id}>{t.t}</li>
                ))}
              </ul>
              {diff.removed.length > 8 && (
                <span className="meta">e mais {diff.removed.length - 8}…</span>
              )}
              <p className="meta">
                O histórico dessas tarefas fica guardado; se voltarem ao plano,
                tudo volta junto.
              </p>
            </div>
          )}
        </div>
      )}
      {diff && !diff.added.length && !diff.removed.length && (
        <p className="meta">Nenhuma mudança nas tarefas.</p>
      )}
    </div>
  );
}
