import { Suspense } from "react";
import { InvestigationConsole } from "@/components/investigation-console";

export default function InvestigationsPage() {
  return (
    <Suspense
      fallback={
        <div className="boot-screen">Loading Investigation Review…</div>
      }
    >
      <InvestigationConsole />
    </Suspense>
  );
}
