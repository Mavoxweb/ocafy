"use client";

import {
  Achievements,
  EntryLog,
  Feed,
  Report,
  WeeklyDuel,
} from "@/components/social/social-parts";
import { Segmented } from "@/components/ui/primitives";
import { useState } from "react";

export default function ScoreboardPage() {
  const [days, setDays] = useState<7 | 30>(7);

  return (
    <>
      <WeeklyDuel />
      <Feed />
      <Achievements />
      <h2>Relatório</h2>
      <Segmented<7 | 30>
        label="Período"
        value={days}
        onChange={setDays}
        options={[
          { value: 7, label: "7 dias" },
          { value: 30, label: "30 dias" },
        ]}
      />
      <Report days={days} />
      <h2>Registros</h2>
      <EntryLog />
    </>
  );
}
