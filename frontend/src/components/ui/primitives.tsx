import { useId, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { LuCircleAlert, LuCircleCheck, LuInfo, LuTriangleAlert, LuRefreshCw } from "react-icons/lu";
import { initials } from "@/lib/format";
import { Button } from "./Button";
import s from "./ui.module.css";

export function Card({ flush, className, ...rest }: HTMLAttributes<HTMLDivElement> & { flush?: boolean }) {
  return <div className={[s.card, flush && s.cardFlush, className].filter(Boolean).join(" ")} {...rest} />;
}

export function CardHeader({ title, action, id }: { title: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className={s.cardHeader}>
      <h2 className={s.cardTitle} id={id}>
        {title}
      </h2>
      {action}
    </div>
  );
}

export type Tone = "neutral" | "brand" | "accent" | "success" | "warning" | "danger" | "info" | "earth";

export function Badge({ tone = "neutral", children, icon }: { tone?: Tone; children: ReactNode; icon?: ReactNode }) {
  return (
    <span className={[s.badge, tone !== "neutral" && s[`badge-${tone}`]].filter(Boolean).join(" ")}>
      {icon}
      {children}
    </span>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className={s.centered} role="status" aria-live="polite">
      <div className={s.spinner} aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </div>
  );
}

export function Skeleton({ width = "100%", height = 16, radius, style }: { width?: number | string; height?: number | string; radius?: string; style?: CSSProperties }) {
  return <span className={s.skeleton} style={{ width, height, borderRadius: radius, ...style }} aria-hidden="true" />;
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={s.state}>
      {icon && <div className={s.stateIcon} aria-hidden="true">{icon}</div>}
      <h3 className={s.stateTitle}>{title}</h3>
      {children && <p className={s.stateText}>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div className={`${s.state} ${s.stateError}`} role="alert">
      <div className={s.stateIcon} aria-hidden="true">
        <LuTriangleAlert />
      </div>
      <h3 className={s.stateTitle}>{title}</h3>
      <p className={s.stateText}>{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={<LuRefreshCw />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "success" | "warning"; children: ReactNode }) {
  const Icon = tone === "error" ? LuCircleAlert : tone === "success" ? LuCircleCheck : tone === "warning" ? LuTriangleAlert : LuInfo;
  return (
    <div className={[s.alert, tone !== "info" && s[`alert-${tone}`]].filter(Boolean).join(" ")} role={tone === "error" ? "alert" : "status"}>
      <Icon aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function Avatar({ name, src, size = 40 }: { name: string | null | undefined; src?: string | null; size?: number }) {
  return (
    <span className={s.avatar} style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {src ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" /> : initials(name)}
    </span>
  );
}

export function StatTile({ icon, label, value, tone }: { icon: ReactNode; label: string; value: ReactNode; tone?: CSSProperties }) {
  return (
    <div className={s.stat}>
      <div className={s.statIcon} style={tone} aria-hidden="true">
        {icon}
      </div>
      <div>
        <div className={s.statValue}>{value}</div>
        <div className={s.statLabel}>{label}</div>
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className={s.pageHeader}>
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className={s.pageTitle}>{title}</h1>
        {subtitle && <p className={s.pageSubtitle}>{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </header>
  );
}

export function ProgressRing({ value, size = 120, stroke = 10, children, label }: { value: number; size?: number; stroke?: number; children?: ReactNode; label: string }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <div className={s.ring} style={{ width: size, height: size }} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clamped * 100)}>
      <svg width={size} height={size} aria-hidden="true">
        <circle className={s.ringTrack} cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" />
        <circle
          className={s.ringBar}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
        />
      </svg>
      <div className={s.ringLabel}>{children}</div>
    </div>
  );
}

export interface TabOption<T extends string> {
  value: T;
  label: ReactNode;
}

export function Tabs<T extends string>({ value, options, onChange, label }: { value: T; options: TabOption<T>[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className={s.tabs} role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value} className={s.tab} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (next: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className={s.switchRow}>
      <div className={s.switchText}>
        <span id={id} className={s.label}>
          {label}
        </span>
        {description && <span className={s.hint}>{description}</span>}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-labelledby={id} className={s.switch} disabled={disabled} onClick={() => onChange(!checked)} />
    </div>
  );
}
