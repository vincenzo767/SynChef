import { useMemo, useState } from "react";
import { LuCheck, LuFlag, LuGavel, LuX } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, ErrorState, Skeleton, Tabs } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/useToast";
import { adminApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/client";
import { useAsync } from "@/lib/useAsync";
import { useSubscription } from "@/lib/realtime";
import { formatRelative } from "@/lib/format";
import type { Report } from "@/lib/api/types";
import { CategoryBadge, ReportStatusBadge } from "./StatusBadge";
import s from "./admin.module.css";

type Filter = "open" | "closed" | "all";

/**
 * Moderation queue. Workflow: Pending → (file notice) → Notice filed → (owner appeals) → Appealed
 * → Resolved / Dismissed. The dish owner is notified at each step.
 */
export default function AdminReportsPage() {
  const toast = useToast();
  const reports = useAsync((signal) => adminApi.reports({ signal }), []);
  const [filter, setFilter] = useState<Filter>("open");
  const [busy, setBusy] = useState<string | null>(null);

  useSubscription<Report>("/topic/admin/reports", (r) => reports.setData((list) => [r, ...(list ?? []).filter((x) => x.id !== r.id)]));
  useSubscription<Report>("/topic/admin/reports/update", (r) => reports.setData((list) => list?.map((x) => (x.id === r.id ? r : x))));

  const visible = useMemo(() => {
    const list = reports.data ?? [];
    if (filter === "open") return list.filter((r) => r.status === "PENDING" || r.status === "FILED" || r.status === "APPEALED");
    if (filter === "closed") return list.filter((r) => r.status === "RESOLVED" || r.status === "DISMISSED");
    return list;
  }, [reports.data, filter]);

  const act = async (report: Report, action: "notice" | "resolve" | "dismiss") => {
    setBusy(`${report.id}:${action}`);
    try {
      const updated = action === "notice" ? await adminApi.fileNotice(report.id) : action === "resolve" ? await adminApi.resolve(report.id) : await adminApi.dismiss(report.id);
      reports.setData((list) => list?.map((x) => (x.id === updated.id ? updated : x)));
      toast.success(action === "notice" ? "Notice sent to the dish owner" : action === "resolve" ? "Report resolved" : "Report dismissed");
    } catch (e) {
      toast.error("Action failed", toApiError(e).message);
      reports.reload();
    } finally {
      setBusy(null);
    }
  };

  const count = (f: Filter) =>
    (reports.data ?? []).filter((r) => (f === "all" ? true : f === "open" ? !["RESOLVED", "DISMISSED"].includes(r.status) : ["RESOLVED", "DISMISSED"].includes(r.status))).length;

  return (
    <>
      <div className={s.toolbar}>
        <Tabs
          label="Report status"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "open", label: `Open · ${count("open")}` },
            { value: "closed", label: `Closed · ${count("closed")}` },
            { value: "all", label: `All · ${count("all")}` }
          ]}
        />
      </div>
      {reports.error ? (
        <ErrorState message={reports.error.message} onRetry={reports.reload} />
      ) : reports.loading && !reports.data ? (
        <Skeleton height={200} radius="var(--radius-lg)" />
      ) : visible.length === 0 ? (
        <EmptyState icon={<LuFlag />} title={filter === "open" ? "No open reports" : "Nothing here yet"}>
          New reports arrive here in real time.
        </EmptyState>
      ) : (
        <div className="stack">
          {visible.map((r) => {
            const closed = r.status === "RESOLVED" || r.status === "DISMISSED";
            return (
              <Card key={r.id} className={s.reportCard}>
                <div className={s.reportHead}>
                  <div>
                    <div className={s.reportTitle}>{r.recipeTitle}</div>
                    <div className={s.reportMeta}>
                      by {r.recipeOwnerName ?? "unknown"} · reported by {r.reporterName ?? "anonymous"} · {formatRelative(r.reportDate)}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <CategoryBadge category={r.category} />
                    <ReportStatusBadge status={r.status} />
                  </div>
                </div>
                <p>
                  <strong>Reason:</strong> {r.reason}
                </p>
                {r.appealMessage && (
                  <p className={s.appeal}>
                    <strong>Owner's appeal:</strong> {r.appealMessage}
                  </p>
                )}
                {!closed && (
                  <div className={s.actions} style={{ justifyContent: "flex-start" }}>
                    {r.status === "PENDING" && (
                      <Button variant="primary" size="sm" icon={<LuGavel />} loading={busy === `${r.id}:notice`} disabled={busy !== null} onClick={() => void act(r, "notice")}>
                        File notice to owner
                      </Button>
                    )}
                    <Button variant="secondary" size="sm" icon={<LuCheck />} loading={busy === `${r.id}:resolve`} disabled={busy !== null} onClick={() => void act(r, "resolve")}>
                      Resolve
                    </Button>
                    <Button variant="ghost" size="sm" icon={<LuX />} loading={busy === `${r.id}:dismiss`} disabled={busy !== null} onClick={() => void act(r, "dismiss")}>
                      Dismiss
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
