import { Suspense } from "react";
import { ActionConsole } from "@/components/action-console";
export default function DecisionsPage() {
  return (
    <Suspense fallback={<p role="status">Loading human decisions…</p>}>
      <ActionConsole view="decisions" />
    </Suspense>
  );
}
