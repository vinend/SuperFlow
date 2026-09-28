import { Suspense } from "react";
import { InvestmentConsole } from "@/components/investment-console";
export default function InvestmentPage() {
  return (
    <Suspense fallback={<p role="status">Loading investment analyses…</p>}>
      <InvestmentConsole />
    </Suspense>
  );
}
