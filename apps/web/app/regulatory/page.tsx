import { Suspense } from "react";
import { RegulatoryConsole } from "@/components/regulatory-console";
export default function RegulatoryPage() {
  return (
    <Suspense fallback={<p role="status">Loading regulatory reviews…</p>}>
      <RegulatoryConsole />
    </Suspense>
  );
}
