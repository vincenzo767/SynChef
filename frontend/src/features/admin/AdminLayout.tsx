import { NavLink, Outlet } from "react-router-dom";
import { LuChartColumn, LuFlag, LuLayoutDashboard, LuMessagesSquare, LuUsers } from "react-icons/lu";
import { PageHeader } from "@/components/ui/primitives";
import s from "./admin.module.css";

const links = [
  { to: "/admin", label: "Overview", icon: <LuLayoutDashboard />, end: true },
  { to: "/admin/reports", label: "Reports", icon: <LuFlag /> },
  { to: "/admin/users", label: "Users", icon: <LuUsers /> },
  { to: "/admin/moderation", label: "Comments", icon: <LuMessagesSquare /> },
  { to: "/admin/analytics", label: "Analytics", icon: <LuChartColumn /> }
];

/** Admin console shell. Every API call behind it is enforced as ROLE_ADMIN on the server. */
export default function AdminLayout() {
  return (
    <div className="container page page-enter">
      <PageHeader eyebrow="Admin console" title="Keep the kitchen running" subtitle="Live platform health, moderation and user management." />
      <nav className={s.tabs} aria-label="Admin sections">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={s.tab}>
            {l.icon}
            {l.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
