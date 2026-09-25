"use client";

import {
  AssignedTasks,
  FreezerAlerts,
  InviteCard,
  OfficeShortcut,
  PeopleCards,
  RoomsCarousel,
  TodayHero,
  TradeInbox,
  usePriorityList,
} from "@/components/hoje/today-parts";
import { RoutineBlock, TaskTile } from "@/components/tasks/task-parts";
import { Panel } from "@/components/ui/primitives";
import { useNow } from "@/lib/hooks";
import Link from "next/link";

export default function TodayPage() {
  const { list, nunca } = usePriorityList();
  const now = useNow();
  const evening = now.getHours() >= 16;
  const mins = list.slice(0, 8).reduce((a, t) => a + t.mins, 0);

  const morning = (
    <RoutineBlock
      key="m"
      block="manha"
      label="Rotina da manhã"
      hint="~15 min"
    />
  );
  const night = (
    <RoutineBlock key="n" block="noite" label="Reset da noite" hint="~30 min" />
  );

  return (
    <>
      <TodayHero />
      <PeopleCards />
      <InviteCard />
      <AssignedTasks />
      <OfficeShortcut />
      <RoomsCarousel />
      <FreezerAlerts />
      <TradeInbox />
      {evening ? [night, morning] : [morning, night]}

      <h2>
        Prioridades
        <small>{list.length ? `~${mins} min nas 8 primeiras` : ""}</small>
      </h2>
      {list.length ? (
        <div className="tiles">
          {list.slice(0, 8).map((t) => (
            <TaskTile key={t.id} task={t} />
          ))}
        </div>
      ) : (
        <p className="empty">
          {nunca > 0
            ? "Nada vencendo por enquanto."
            : "Nada vencendo. Casa em dia."}
        </p>
      )}
      {list.length > 8 && (
        <Link href="/rotinas" className="link">
          Ver as outras {list.length - 8}
        </Link>
      )}
      {nunca > 3 && (
        <Panel>
          <b>{nunca} tarefas sem registro.</b>
          <p className="meta">
            Para o método calcular os prazos, abra Rotinas e registre quando
            cada coisa foi feita pela última vez (toque na tarefa →
            “Registrar”).
          </p>
        </Panel>
      )}
    </>
  );
}
