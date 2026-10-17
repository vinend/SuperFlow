import { BookOpen, Globe, ScanEye } from "lucide-react";
import { evidenceIdentity, type EvidenceIdentity } from "@/lib/evidence-origin";

export function EvidenceOrigin({ source }: { source: EvidenceIdentity }) {
  const identity = evidenceIdentity(source);
  const Icon = identity.internet ? Globe : BookOpen;
  return (
    <span className="evidence-origin" aria-label="Evidence origin">
      <span
        className={`origin-badge ${identity.internet ? "internet" : "knowledge"}`}
      >
        <Icon size={12} aria-hidden="true" />
        {identity.label}
      </span>
      {identity.methods.map((method) => (
        <span
          className="method-badge"
          key={method}
          title={
            method === "Vision observation"
              ? `${source.vision_model}: unverified model observation; inspect the original screenshot.`
              : method === "Vision scan"
                ? `${source.vision_model}: visual observations accompany this capture; cited text comes from the webpage.`
                : undefined
          }
        >
          {method.startsWith("Vision") && (
            <ScanEye size={12} aria-hidden="true" />
          )}
          {method}
        </span>
      ))}
    </span>
  );
}
