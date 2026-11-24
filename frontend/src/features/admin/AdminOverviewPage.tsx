import { Link } from "react-router-dom";
import { LuBan, LuFlag, LuMessagesSquare, LuSoup, LuUserCheck, LuUsers, LuEarth, LuGavel } from "react-icons/lu";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader, EmptyState, ErrorState, Skeleton, StatTile } from "@/components/ui/primitives";
import { adminApi } from "@/lib/api/endpoints";
import { useAsync } from "@/lib/useAsync";
import { useSubscription } from "@/lib/realtime";
import { formatRelative } from "@/lib/format";
import type { AdminStats, Report } from "@/lib/api/types";
import { CategoryBadge, ReportStatusBadge } from "./StatusBadge";
import s from "./admin.module.css";

export default function AdminOverviewPage() {
  const stats = useAsync((signal) => adminApi.stats({ signal }), []);
  const reports = useAsync((signal) => adminApi.reports({ signal }), []);

  useSubscription<AdminStats>("/topic/admin/stats", (next) => stats.setData(next));
  useSubscription<Report>("/topic/admin/reports", (r) => reports.setData((list) => [r, ...(list ?? [])]));
  useSubscription<Report>("/topic/admin/reports/update", (r) => reports.setData((list) => list?.map((x) => (x.id === r.id ? r : x))));

  const open = (reports.data ?? []).filter((r) => r.status === "PENDING" || r.status === "APPEALED").slice(0, 5);
  const d = stats.data;

  return (
    <>
      {stats.error ? (
        <ErrorState message={stats.error.message} onRetry={stats.reload} />
      ) : (
        <section className={s.statGrid} aria-label="Live platform statistics" aria-live="polite">
          {d ? (
            <>
              <StatTile icon={<LuUsers />} label="Total users" value={d.totalUsers} />
              <StatTile icon={<LuUserCheck />} label="Active users" value={d.activeUsers} tone={{ background: "var(--success-soft)", color: "var(--success)" }} />
              <StatTile icon={<LuBan />} label="Suspended" value={d.bannedUsers} tone={{ background: "var(--danger-soft)", color: "var(--danger)" }} />
              <StatTile icon={<LuSoup />} label="Community dishes" value={d.totalSynCookRecipes} />
              <StatTile icon={<LuEarth />} label="Public dishes" value={d.publicRecipes} />
              <StatTile icon={<LuFlag />} label="Needs review" value={d.pendingReports} tone={{ background: "var(--warning-soft)", color: "var(--warning)" }} />
              <StatTile icon={<LuGavel />} label="Total reports" value={d.totalReports} />
              <StatTile icon={<LuMessagesSquare />} label="Comments" value={d.totalComments} />
            </>
          ) : (
            Array.from({ length: 8 }, (_, i) => <Skeleton key={i} height={88} radius="var(--radius-lg)" />)
          )}
        </section>
      )}

      <Card>
        <CardHeader title="Needs your attention" action={<ButtonLink to="/admin/reports" variant="ghost" size="sm">All reports</ButtonLink>} />
        {reports.error ? (
          <ErrorState message={reports.error.message} onRetry={reports.reload} />
        ) : reports.loading && !reports.data ? (
          <Skeleton height={120} />
        ) : open.length === 0 ? (
          <EmptyState icon={<LuFlag />} title="All clear">
            No pending reports or appeals. New ones appear here instantly.
          </EmptyState>
        ) : (
          <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: "var(--sp-3)" }}>
            {open.map((r) => (
              <li key={r.id} className="row" style={{ justifyContent: "space-between" }}>
                <span>
                  <Link to="/admin/reports" style={{ fontWeight: 600 }}>
                    {r.recipeTitle}
                  </Link>
                  <span className="muted" style={{ fontSize: "var(--fs-sm)" }}>
                    {" "}
                    · {r.reason} · {formatRelative(r.reportDate)}
                  </span>
                </span>
                <span className="row" style={{ gap: 6 }}>
                  <CategoryBadge category={r.category} />
                  <ReportStatusBadge status={r.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
