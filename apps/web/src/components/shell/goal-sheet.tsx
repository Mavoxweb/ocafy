"use client";

import { StepRows } from "@/components/office/step-rows";
import { StatusPill } from "@/components/ui/primitives";
import { Sheet, SheetHead } from "@/components/ui/sheet";
import { finishOfficeGoal } from "@/lib/actions";
import { OFFICE_GOALS, OFFICE_GOAL_XP } from "@/lib/catalog";
import { fmtShort } from "@/lib/dates";
import { memberName, officeCurrent, officeStepsPct } from "@/lib/selectors";
import { useAppState } from "@/lib/store";
import { closeSheet } from "@/lib/ui";

export function GoalSheet({ id }: { id: string }) {
  const s = useAppState();
  const i = OFFICE_GOALS.findIndex((g) => g.id === id);
  const g = OFFICE_GOALS[i];
  if (!g) return null;
  const done = s.office.done[id];
  const isCur = officeCurrent(s)?.id === id;
  const state = done ? "ok" : isCur ? "due" : "nunca";
  const pct = officeStepsPct(s, id);

  return (
    <Sheet onClose={closeSheet} label={g.t}>
      <SheetHead onClose={closeSheet}>
        <StatusPill state={state}>
          Semana {i + 1}
          {done ? " · concluído" : ""}
        </StatusPill>
      </SheetHead>
      <h3 className="mt-2.5">{g.t}</h3>
      {done && (
        <p className="meta">
          Concluído por {memberName(s, done.who)} em{" "}
          {fmtShort(new Date(done.at))}
        </p>
      )}
      <div className="how">
        <b>Por quê</b>
        <p>{g.why}</p>
      </div>
      <div className="group">
        <StepRows goal={g} />
      </div>
      {!done && (
        <>
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={pct < 100}
            onClick={(e) =>
              finishOfficeGoal(id, e.currentTarget.getBoundingClientRect())
            }
          >
            Concluir objetivo · +{OFFICE_GOAL_XP} XP
          </button>
          {pct < 100 && (
            <p className="meta text-center">
              Marque todas as etapas para concluir.
            </p>
          )}
        </>
      )}
    </Sheet>
  );
}
