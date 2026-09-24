"use client";

import { RoutineBlock, TaskRow } from "@/components/tasks/task-parts";
import {
  Chip,
  Chips,
  Group,
  Legend,
  Segmented,
} from "@/components/ui/primitives";
import { WEEKDAYS, capitalize } from "@/lib/dates";
import {
  type Task,
  isOff,
  minMax,
  recurringInHouse,
  roomGroups,
} from "@/lib/selectors";
import { useAppState } from "@/lib/store";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const BANDS: [string, number, number][] = [
  ["A cada poucos dias", 0, 4],
  ["Semanais", 5, 10],
  ["Quinzenais e mensais", 11, 40],
  ["Trimestrais ou mais", 41, 9999],
];

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function RoutinesView() {
  const s = useAppState();
  const router = useRouter();
  const params = useSearchParams();
  const roomParam = params.get("room");
  const rooms = roomGroups(s);
  const room: string | null = rooms.some((r) => r.slug === roomParam)
    ? roomParam
    : null;
  const [view, setView] = useState<"lista" | "semana">("lista");

  const setRoom = (r: string | null) =>
    router.replace(r ? `/rotinas?room=${r}` : "/rotinas", { scroll: false });

  const pool = recurringInHouse(s).filter((t) => !room || t.room === room);
  const on = pool.filter((t) => !isOff(s, t));
  const off = pool.filter((t) => isOff(s, t));

  return (
    <>
      <div className="mt-3.5">
        <Chips>
          <Chip pressed={!room} onClick={() => setRoom(null)}>
            Tudo
          </Chip>
          {rooms.map((r) => (
            <Chip
              key={r.slug}
              pressed={room === r.slug}
              onClick={() => setRoom(r.slug)}
            >
              {r.label}
            </Chip>
          ))}
        </Chips>
      </div>
      <div className="mt-3">
        <Segmented
          label="Visualização"
          value={view}
          onChange={setView}
          options={[
            { value: "lista", label: "Por frequência" },
            { value: "semana", label: "Plano da semana" },
          ]}
        />
      </div>
      <div className="mt-3">
        <Legend />
      </div>

      {view === "semana" ? (
        <WeekPlan on={on} />
      ) : (
        <>
          <RoutineBlock block="manha" label="Diárias — manhã" room={room} />
          <RoutineBlock block="noite" label="Diárias — noite" room={room} />
          {BANDS.map(([label, lo, hi]) => {
            const ts = on.filter((t) => {
              const mx = minMax(s, t)[1];
              return mx >= lo && mx <= hi;
            });
            return ts.length ? (
              <section key={label}>
                <h2>
                  {label}
                  <small>{ts.length}</small>
                </h2>
                <Group>
                  {ts.map((t) => (
                    <TaskRow key={t.id} task={t} />
                  ))}
                </Group>
              </section>
            ) : null;
          })}
          {off.length > 0 && (
            <section>
              <h2>
                Pausadas<small>{off.length}</small>
              </h2>
              <Group>
                {off.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </Group>
            </section>
          )}
          {!on.length && !off.length && (
            <p className="empty">Nenhuma tarefa recorrente neste cômodo.</p>
          )}
        </>
      )}
    </>
  );
}

function WeekPlan({ on }: { on: Task[] }) {
  const fixed = (d: number) => on.filter((t) => t.day === d);
  const floating = on.filter((t) => t.day == null);
  return (
    <>
      <p className="meta mt-3.5">
        O dia sugerido ajuda a distribuir o esforço. Quem manda é a janela de
        dias: se passou do dia, faça quando der.
      </p>
      {WEEK_ORDER.map((d) => {
        const ts = fixed(d);
        return (
          <section key={d}>
            <h2>
              {capitalize(WEEKDAYS[d])}
              <small>{ts.reduce((a, t) => a + t.mins, 0)} min</small>
            </h2>
            {ts.length ? (
              <Group>
                {ts.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </Group>
            ) : (
              <p className="empty">Livre — só as rotinas diárias.</p>
            )}
          </section>
        );
      })}
      <h2>Sem dia fixo</h2>
      <p className="meta">Aparecem em Hoje quando entram na janela.</p>
      <Group>
        {floating.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
      </Group>
    </>
  );
}
