import { Badge, type Tone } from "@/components/ui/primitives";
import type { ReportStatus } from "@/lib/api/types";

const MAP: Record<ReportStatus, { tone: Tone; label: string }> = {
  PENDING: { tone: "warning", label: "Pending" },
  FILED: { tone: "info", label: "Notice filed" },
  APPEALED: { tone: "accent", label: "Appealed" },
  RESOLVED: { tone: "success", label: "Resolved" },
  DISMISSED: { tone: "neutral", label: "Dismissed" }
};

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  const entry = MAP[status] ?? { tone: "neutral" as Tone, label: status };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}

export function CategoryBadge({ category }: { category: string }) {
  const tone: Tone = category === "Critical" ? "danger" : category === "Medium" ? "warning" : "neutral";
  return <Badge tone={tone}>{category}</Badge>;
}
