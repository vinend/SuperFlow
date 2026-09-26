import { Suspense } from "react";
import { ActionConsole } from "@/components/action-console";
export default function WorkflowsPage() {
  return (
    <Suspense fallback={<p role="status">Loading workflows…</p>}>
      <ActionConsole view="workflows" />
    </Suspense>
  );
}
