import { Suspense } from "react";
import { RoutinesView } from "./routines-view";

export default function RoutinesPage() {
  return (
    <Suspense fallback={null}>
      <RoutinesView />
    </Suspense>
  );
}
