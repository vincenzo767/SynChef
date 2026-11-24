import { useEffect, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LuCompass,
  LuCookingPot,
  LuEarth,
  LuHouse,
  LuLayoutDashboard,
  LuLogIn,
  LuLogOut,
  LuSettings,
  LuShield,
  LuUser,
  LuUsers,
  LuWifiOff
} from "react-icons/lu";
import { selectIsAdmin, useAppDispatch, useAppSelector } from "@/app/store";
import { acknowledgeExpiry, logout, profileUpdated } from "@/features/auth/authSlice";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { ButtonLink } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/primitives";
import { Popover } from "@/components/ui/Popover";
import { menuDividerClass, menuItemClass } from "@/components/ui/menu";
import { useToast } from "@/components/ui/useToast";
import { useConnectionStatus, useSubscription } from "@/lib/realtime";
import type { UserProfile } from "@/lib/api/types";
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import s from "./layout.module.css";

const primaryLinks = [
  { to: "/recipes", label: "Discover", icon: <LuCompass /> },
  { to: "/explore", label: "Flavor Map", icon: <LuEarth /> },
  { to: "/community", label: "Community", icon: <LuUsers /> },
  { to: "/dashboard", label: "My Kitchen", icon: <LuCookingPot /> }
];

export function Brand() {
  return (
    <Link to="/" className={s.brand} aria-label="SynChef home">
      <span className={s.brandMark} aria-hidden="true">
        <img src="/icons/logo-mark.png" alt="" width={30} height={30} />
      </span>
      <span>
        Syn<em>Chef</em>
      </span>
    </Link>
  );
}

function UserMenu({ user }: { user: UserProfile }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isAdmin = useAppSelector(selectIsAdmin);
  return (
    <Popover
      label="Account menu"
      trigger={({ toggle, ...aria }) => (
        <button type="button" className={s.avatarButton} onClick={toggle} aria-label="Account menu" {...aria}>
          <Avatar name={user.fullName} src={user.profileImageUrl} size={34} />
          <span className={s.hideMobile}>{user.fullName.split(" ")[0]}</span>
        </button>
      )}
    >
      {(close) => (
        <div onClick={close}>
          <div className={s.menuHeader}>
            <div className={s.menuName}>{user.fullName}</div>
            <div className={s.menuEmail}>{user.email}</div>
          </div>
          <Link className={menuItemClass} to="/profile">
            <LuUser aria-hidden="true" /> Profile
          </Link>
          <Link className={menuItemClass} to="/settings">
            <LuSettings aria-hidden="true" /> Settings
          </Link>
          {isAdmin && (
            <Link className={menuItemClass} to="/admin">
              <LuShield aria-hidden="true" /> Admin console
            </Link>
          )}
          <div className={menuDividerClass} />
          <button
            type="button"
            className={menuItemClass}
            onClick={() => {
              void dispatch(logout()).then(() => navigate("/", { replace: true }));
            }}
          >
            <LuLogOut aria-hidden="true" /> Sign out
          </button>
        </div>
      )}
    </Popover>
  );
}

function SignedInRealtime() {
  const dispatch = useAppDispatch();
  useSubscription<UserProfile>("/user/queue/profile", (profile) => dispatch(profileUpdated(profile)));
  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const user = useAppSelector((st) => st.auth.user);
  const expired = useAppSelector((st) => st.auth.sessionExpired);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const online = useOnlineStatus();
  const realtime = useConnectionStatus();

  useEffect(() => {
    if (expired) {
      dispatch(acknowledgeExpiry());
      toast.info("Your session ended", "Please sign in again to continue.");
      navigate("/login", { state: { from: location.pathname } });
    }
  }, [expired, dispatch, navigate, toast, location.pathname]);

  const bottomLinks = [
    { to: user ? "/dashboard" : "/", label: user ? "Kitchen" : "Home", icon: user ? <LuLayoutDashboard /> : <LuHouse /> },
    { to: "/recipes", label: "Discover", icon: <LuCompass /> },
    { to: "/explore", label: "Map", icon: <LuEarth /> },
    { to: "/community", label: "Community", icon: <LuUsers /> },
    user ? { to: "/profile", label: "Profile", icon: <LuUser /> } : { to: "/login", label: "Sign in", icon: <LuLogIn /> }
  ];

  return (
    <div className={s.shell}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className={s.topbar}>
        <div className={`container ${s.topbarInner}`}>
          <Brand />
          <nav className={s.nav} aria-label="Primary">
            {primaryLinks.map((l) => (
              <NavLink key={l.to} to={l.to} className={s.navLink}>
                {l.icon}
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className={s.actions} style={{ marginLeft: "auto" }}>
            {user ? (
              <>
                <NotificationBell />
                <UserMenu user={user} />
              </>
            ) : (
              <>
                <ButtonLink to="/login" variant="ghost" size="sm" className={s.hideMobile}>
                  Sign in
                </ButtonLink>
                <ButtonLink to="/register" variant="primary" size="sm">
                  Join free
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      </header>
      {!online && (
        <div className={s.banner} role="status">
          <LuWifiOff aria-hidden="true" /> You're offline. Saved pages still work; changes will need a connection.
        </div>
      )}
      {online && user && realtime === "reconnecting" && (
        <div className={s.banner} role="status">
          Reconnecting to live updates…
        </div>
      )}
      {user && <SignedInRealtime />}
      <main id="main" className={s.main} tabIndex={-1}>
        {children}
      </main>
      <footer className={s.footer}>
        <div className={`container ${s.footerInner}`}>
          <span>© {new Date().getFullYear()} SynChef · Cook together, anywhere.</span>
          <span>Global recipes · Real-time cooking · Community kitchen</span>
        </div>
      </footer>
      <nav className={s.bottomNav} aria-label="Primary mobile">
        {bottomLinks.map((l) => (
          <NavLink key={l.to + l.label} to={l.to} end={l.to === "/"} className={s.bottomLink}>
            {l.icon}
            {l.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
