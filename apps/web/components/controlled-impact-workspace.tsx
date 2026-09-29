import type { ImpactWorkspace } from "@/lib/analytics-contracts";
import {
  CapacitySimulation,
  DistributionChart,
  ImpactBrief,
  MetricGroup,
  NextActions,
} from "./impact-components";

export function ControlledImpactWorkspace({
  workspace,
}: {
  workspace: ImpactWorkspace;
}) {
  return (
    <div className="controlled-impact-workspace" aria-live="polite">
      {workspace.components.map((component, index) => {
        const key = `${component.type}:${index}`;
        switch (component.type) {
          case "ImpactBrief":
            return <ImpactBrief key={key} data={component.data} />;
          case "MetricGroup":
            return <MetricGroup key={key} data={component.data} />;
          case "DistributionChart":
            return <DistributionChart key={key} data={component.data} />;
          case "CapacitySimulation":
            return <CapacitySimulation key={key} data={component.data} />;
          case "NextActions":
            return <NextActions key={key} data={component.data} />;
          default:
            return null;
        }
      })}
      <footer className="impact-provenance">
        <span>{workspace.scope}</span>
        <span>
          Data through{" "}
          {new Date(workspace.data_through).toLocaleString("en-GB")}
        </span>
        <span>{workspace.notice}</span>
      </footer>
    </div>
  );
}
