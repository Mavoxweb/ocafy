"use client";

import {
  HouseFields,
  ModePicker,
  PetsEditor,
  PlanPreview,
  RhythmFields,
  RoomGrid,
} from "@/components/casa/house-editor";
import { Panel } from "@/components/ui/primitives";
import { saveHouseProfile } from "@/lib/actions";
import {
  type HouseDraft,
  draftFromState,
  draftToInput,
} from "@/lib/house-draft";
import { planOf } from "@/lib/selectors";
import { useAppState } from "@/lib/store";
import { errorMessage } from "@/lib/trpc";
import { toast } from "@/lib/ui";
import { useEffect, useMemo, useRef, useState } from "react";

/** "Minha casa": área permanente para mudar cômodos, pets, modo e ritmo. */
export default function CasaPage() {
  const s = useAppState();
  const [draft, setDraft] = useState<HouseDraft>(() => draftFromState(s));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const saved = useMemo(
    () => JSON.stringify(draftToInput(draftFromState(s))),
    [s],
  );
  const dirty = JSON.stringify(draftToInput(draft)) !== saved;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // Se a casa mudar no servidor (ex.: a outra pessoa editou) e não há edições em andamento, atualiza.
  // biome-ignore lint/correctness/useExhaustiveDependencies: só reage à versão salva
  useEffect(() => {
    if (!dirtyRef.current) setDraft(draftFromState(s));
  }, [saved]);

  const patch = (fn: (d: HouseDraft) => HouseDraft) => setDraft(fn);
  const two = s.members.length > 1;
  const soloBlocked = two && draft.profile.mode === "solo";
  const namesOk = draft.pets.every((p) => p.name.trim().length > 0);
  const canSave = dirty && !busy && !soloBlocked && namesOk;
  const before = planOf(s).list;

  async function save() {
    setBusy(true);
    setError("");
    try {
      await saveHouseProfile(draft);
      toast("Casa atualizada. As rotinas já se ajustaram.");
    } catch (e) {
      setError(errorMessage(e, "Não foi possível salvar. Tente de novo."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="mt-4">Minha casa</h2>
      <p className="meta">
        Conte como é a sua casa e as rotinas se ajustam: cômodos, pets, modo e
        ritmo. Nada do seu histórico é apagado.
      </p>

      <h2>Quem mora</h2>
      <Panel>
        <ModePicker draft={draft} patch={patch} />
        {soloBlocked && (
          <p role="alert" className="mt-2 text-[0.88rem] font-bold text-late-t">
            Há duas pessoas nesta casa — o modo Solo vale para uma só.
          </p>
        )}
      </Panel>

      <h2>Sobre a casa</h2>
      <Panel>
        <HouseFields draft={draft} patch={patch} />
      </Panel>

      <h2>Cômodos</h2>
      <Panel>
        <RoomGrid draft={draft} patch={patch} />
      </Panel>

      <h2>Pets</h2>
      <Panel>
        <PetsEditor draft={draft} patch={patch} />
      </Panel>

      <h2>Ritmo</h2>
      <Panel>
        <RhythmFields draft={draft} patch={patch} />
      </Panel>

      <h2>O que muda nas rotinas</h2>
      <Panel>
        <PlanPreview draft={draft} before={before} />
      </Panel>

      {error && (
        <p role="alert" className="mt-3 text-[0.9rem] font-bold text-late-t">
          {error}
        </p>
      )}
      <div className="sticky-save">
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={!canSave}
          onClick={save}
        >
          {busy ? "Salvando…" : dirty ? "Salvar mudanças" : "Sem mudanças"}
        </button>
        {dirty && !busy && (
          <button
            type="button"
            className="link"
            onClick={() => setDraft(draftFromState(s))}
          >
            Descartar
          </button>
        )}
      </div>
    </>
  );
}
