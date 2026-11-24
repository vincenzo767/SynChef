import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader, ErrorState, Skeleton } from "@/components/ui/primitives";
import { adminApi } from "@/lib/api/endpoints";
import { useAsync } from "@/lib/useAsync";
import { useSubscription } from "@/lib/realtime";
import type { TrendPoint } from "@/lib/api/types";
import s from "./admin.module.css";

const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function TrendChart({ data, kind, color, label }: { data: TrendPoint[]; kind: "area" | "bar"; color: string; label: string }) {
  const total = data.reduce((sum, p) => sum + p.count, 0);
  return (
    <Card>
      <CardHeader title={label} action={<span className="muted">{total} in 30 days</span>} />
      <div className={s.chart} role="img" aria-label={`${label}: ${total} in the last 30 days`}>
        <ResponsiveContainer width="100%" height="100%">
          {kind === "area" ? (
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id={`fill-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: "var(--text-muted)", fontSize: 12 }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
              <Tooltip labelFormatter={(v) => shortDate(String(v))} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }} />
              <Area type="monotone" dataKey="count" name={label} stroke={color} strokeWidth={2} fill={`url(#fill-${label})`} />
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: "var(--text-muted)", fontSize: 12 }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
              <Tooltip labelFormatter={(v) => shortDate(String(v))} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }} />
              <Bar dataKey="count" name={label} fill={color} radius={[6, 6, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export default function AdminAnalyticsPage() {
  const analytics = useAsync((signal) => adminApi.analytics({ signal }), []);
  useSubscription("/topic/admin/stats", () => analytics.reload());

  if (analytics.error) return <ErrorState message={analytics.error.message} onRetry={analytics.reload} />;
  const a = analytics.data;
  if (!a) {
    return (
      <div className={s.chartGrid}>
        <Skeleton height={300} radius="var(--radius-lg)" />
        <Skeleton height={300} radius="var(--radius-lg)" />
      </div>
    );
  }

  const breakdown = [
    { label: "Catalogue recipes", value: a.platformRecipes },
    { label: "Community dishes", value: a.overview.totalSynCookRecipes },
    { label: "Public dishes", value: a.overview.publicRecipes },
    { label: "Comments", value: a.overview.totalComments },
    { label: "Reports", value: a.overview.totalReports }
  ];
  const max = Math.max(1, ...breakdown.map((b) => b.value));

  return (
    <div className="stack" style={{ gap: "var(--sp-5)" }}>
      <div className={s.chartGrid}>
        <TrendChart data={a.userRegistrationsLast30Days} kind="area" color="#5e8c4a" label="New members" />
        <TrendChart data={a.cookingSessionsLast30Days} kind="area" color="#c9a24b" label="Cooking sessions" />
        <TrendChart data={a.reportsLast30Days} kind="bar" color="#a4502f" label="Reports filed" />
        <Card>
          <CardHeader title="Content breakdown" />
          <ul className={s.breakdown}>
            {breakdown.map((b) => (
              <li key={b.label} className={s.breakdownRow}>
                <span>{b.label}</span>
                <span className={s.breakdownBar} aria-hidden="true">
                  <span style={{ width: `${(b.value / max) * 100}%` }} />
                </span>
                <strong style={{ textAlign: "right" }}>{b.value}</strong>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
