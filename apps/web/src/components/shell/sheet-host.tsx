"use client";

import { useSheet } from "@/lib/ui";
import { GoalSheet } from "./goal-sheet";
import { MethodSheet } from "./method-sheet";
import { SettingsSheet } from "./settings-sheet";
import { TaskSheet } from "./task-sheet";

export function SheetHost() {
  const sheet = useSheet();
  if (!sheet) return null;
  switch (sheet.kind) {
    case "task":
      return <TaskSheet key={sheet.id} id={sheet.id} />;
    case "goal":
      return <GoalSheet key={sheet.id} id={sheet.id} />;
    case "settings":
      return <SettingsSheet />;
    case "method":
      return <MethodSheet />;
  }
}
