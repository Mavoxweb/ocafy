"use client";

import { IconCheck } from "@/components/ui/icons";
import { toggleOfficeStep } from "@/lib/actions";
import type { OfficeGoal } from "@/lib/catalog";
import { officeStepDone } from "@/lib/selectors";
import { useAppState } from "@/lib/store";

export function StepRows({ goal }: { goal: OfficeGoal }) {
  const s = useAppState();
  return (
    <>
      {goal.steps.map((text, i) => {
        const ok = officeStepDone(s, goal.id, i);
        return (
          <div key={text} className={`chk ${ok ? "done" : ""}`}>
            <button
              type="button"
              className="box"
              aria-pressed={ok}
              aria-label={text}
              onClick={(e) =>
                toggleOfficeStep(
                  goal.id,
                  i,
                  e.currentTarget.getBoundingClientRect(),
                )
              }
            >
              {ok && <IconCheck />}
            </button>
            <div className="tt">{text}</div>
          </div>
        );
      })}
    </>
  );
}
