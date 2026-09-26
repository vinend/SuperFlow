import { Suspense } from "react";
import { ActionConsole } from "@/components/action-console";
export default function WorkflowsPage() {
  return (
    <Suspense fallback={<p role="status">Loading your work…</p>}>
      <ActionConsole view="workflows" />
    </Suspense>
  );
}
