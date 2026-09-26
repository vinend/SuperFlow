import { Suspense } from "react";
import { ActionConsole } from "@/components/action-console";
export default function CasesPage() {
  return (
    <Suspense fallback={<p role="status">Loading case workspace…</p>}>
      <ActionConsole view="cases" />
    </Suspense>
  );
}
