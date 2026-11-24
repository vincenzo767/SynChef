import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { LuLaptop, LuLogOut, LuMonitor, LuMoon, LuSun, LuTrash2 } from "react-icons/lu";
import { useAppDispatch, useAppSelector } from "@/app/store";
import { applyTheme, writeLocalTheme } from "@/app/theme";
import { profileUpdated, signedOutLocally } from "@/features/auth/authSlice";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Alert, Badge, Card, PageHeader, Spinner, Switch, Tabs } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/useToast";
import { userApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/client";
import { useAsync } from "@/lib/useAsync";
import { WORLD_COUNTRIES } from "@/lib/countries";
import { formatRelative } from "@/lib/format";
import type { ThemePreference } from "@/lib/api/types";
import s from "./settings.module.css";

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <Card className={s.section} aria-labelledby={id}>
      <div className={s.sectionIntro}>
        <h2 id={id} className={s.sectionTitle}>
          {title}
        </h2>
        {description && <p className="muted">{description}</p>}
      </div>
      <div className={s.sectionBody}>{children}</div>
    </Card>
  );
}

function describeAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

export default function SettingsPage() {
  const user = useAppSelector((st) => st.auth.user)!;
  const dispatch = useAppDispatch();
  const toast = useToast();
  const navigate = useNavigate();

  // Profile
  const [fullName, setFullName] = useState(user.fullName);
  const [countryCode, setCountryCode] = useState(user.countryCode ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setProfileError("Enter your name");
      return;
    }
    setSavingProfile(true);
    setProfileError(null);
    try {
      const country = WORLD_COUNTRIES.find((c) => c.code === countryCode);
      dispatch(profileUpdated(await userApi.update(fullName.trim(), countryCode, country?.name ?? "")));
      toast.success("Profile saved");
    } catch (err) {
      setProfileError(toApiError(err).message);
    } finally {
      setSavingProfile(false);
    }
  };

  // Preferences
  const savePreference = async (prefs: { themePreference?: ThemePreference; notifyOnComments?: boolean }) => {
    const previous = user;
    if (prefs.themePreference) {
      applyTheme(prefs.themePreference);
      writeLocalTheme(prefs.themePreference);
    }
    dispatch(profileUpdated({ ...user, ...prefs }));
    try {
      dispatch(profileUpdated(await userApi.preferences(prefs)));
    } catch (err) {
      dispatch(profileUpdated(previous));
      applyTheme(previous.themePreference);
      toast.error("Couldn't save preference", toApiError(err).message);
    }
  };

  // Password
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwErrors, setPwErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [pwBusy, setPwBusy] = useState(false);
  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    const errs: typeof pwErrors = {};
    if (user.hasPassword && !pw.current) errs.current = "Enter your current password";
    if (pw.next.length < 8) errs.next = "Use at least 8 characters";
    if (pw.confirm !== pw.next) errs.confirm = "Passwords don't match";
    setPwErrors(errs);
    if (Object.keys(errs).length) return;
    setPwBusy(true);
    try {
      await userApi.changePassword(pw.current, pw.next, pw.confirm);
      setPw({ current: "", next: "", confirm: "" });
      dispatch(profileUpdated({ ...user, hasPassword: true }));
      toast.success("Password updated", "Other devices were signed out for your security.");
      sessions.reload();
    } catch (err) {
      const apiErr = toApiError(err);
      setPwErrors(apiErr.message.toLowerCase().includes("current") ? { current: apiErr.message } : { next: apiErr.message });
    } finally {
      setPwBusy(false);
    }
  };

  // Sessions
  const sessions = useAsync((signal) => userApi.sessions({ signal }), []);
  const [revoking, setRevoking] = useState(false);
  const revokeOthers = async () => {
    setRevoking(true);
    try {
      const { revoked } = await userApi.revokeOtherSessions();
      toast.success(revoked ? `Signed out ${revoked} other ${revoked === 1 ? "device" : "devices"}` : "No other devices were signed in");
      sessions.reload();
    } catch (err) {
      toast.error("Couldn't sign out other devices", toApiError(err).message);
    } finally {
      setRevoking(false);
    }
  };

  // Delete account
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await userApi.deleteAccount(deletePassword, deleteConfirm);
      dispatch(signedOutLocally());
      navigate("/", { replace: true });
      toast.info("Your account was deleted", "Thanks for cooking with us.");
    } catch (err) {
      setDeleteError(toApiError(err).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="container page page-enter" style={{ maxWidth: 960 }}>
      <PageHeader eyebrow="Settings" title="Account & preferences" subtitle="Everything here is saved to your account and applies on every device." />

      <div className="stack" style={{ gap: "var(--sp-5)" }}>
        <Section id="profile-settings" title="Profile" description="How other chefs see you. Your country personalises recommendations.">
          <form className="stack" onSubmit={saveProfile} noValidate>
            {profileError && <Alert tone="error">{profileError}</Alert>}
            <div className={s.twoCol}>
              <TextField label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={200} autoComplete="name" />
              <SelectField label="Country" value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
                <option value="">Not set</option>
                {WORLD_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </SelectField>
            </div>
            <TextField label="Email" value={user.email} readOnly disabled hint="Email changes aren't supported yet." />
            <div>
              <Button type="submit" variant="primary" loading={savingProfile} disabled={fullName.trim() === user.fullName && countryCode === (user.countryCode ?? "")}>
                Save profile
              </Button>
            </div>
          </form>
        </Section>

        <Section id="appearance-settings" title="Appearance" description="Choose a theme. “System” follows your device setting.">
          <Tabs
            label="Theme"
            value={user.themePreference}
            onChange={(v) => void savePreference({ themePreference: v })}
            options={[
              { value: "SYSTEM", label: (<><LuMonitor aria-hidden="true" style={{ display: "inline", verticalAlign: "-2px" }} /> System</>) },
              { value: "LIGHT", label: (<><LuSun aria-hidden="true" style={{ display: "inline", verticalAlign: "-2px" }} /> Light</>) },
              { value: "DARK", label: (<><LuMoon aria-hidden="true" style={{ display: "inline", verticalAlign: "-2px" }} /> Dark</>) }
            ]}
          />
        </Section>

        <Section id="notification-settings" title="Notifications" description="In-app notifications appear instantly in the bell menu.">
          <Switch
            label="Comments on my dishes"
            description="Get notified when someone comments on a dish you shared."
            checked={user.notifyOnComments}
            onChange={(v) => void savePreference({ notifyOnComments: v })}
          />
          <p className="muted" style={{ fontSize: "var(--fs-xs)" }}>
            Moderation notices and important account messages are always delivered.
          </p>
        </Section>

        <Section id="security-settings" title={user.hasPassword ? "Password" : "Set a password"} description={user.hasPassword ? "Changing your password signs out your other devices." : "You sign in with Google. Add a password to also sign in with your email."}>
          <form className="stack" onSubmit={changePassword} noValidate>
            {user.hasPassword && (
              <TextField label="Current password" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} error={pwErrors.current} maxLength={128} />
            )}
            <div className={s.twoCol}>
              <TextField label="New password" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} error={pwErrors.next} hint="At least 8 characters" maxLength={128} />
              <TextField label="Confirm new password" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} error={pwErrors.confirm} maxLength={128} />
            </div>
            <div>
              <Button type="submit" variant="primary" loading={pwBusy}>
                {user.hasPassword ? "Update password" : "Set password"}
              </Button>
            </div>
          </form>
        </Section>

        <Section id="session-settings" title="Where you're signed in" description="Sessions expire automatically after a period of inactivity.">
          {sessions.loading && !sessions.data ? (
            <Spinner label="Loading sessions" />
          ) : sessions.error ? (
            <Alert tone="error">{sessions.error.message}</Alert>
          ) : (
            <ul className={s.sessions}>
              {sessions.data?.map((sess) => (
                <li key={sess.id} className={s.session}>
                  <LuLaptop aria-hidden="true" />
                  <div style={{ flex: 1 }}>
                    <strong>{describeAgent(sess.userAgent)}</strong>
                    <div className="muted" style={{ fontSize: "var(--fs-xs)" }}>
                      Signed in {formatRelative(sess.createdAt)} · active {formatRelative(sess.lastSeenAt)}
                    </div>
                  </div>
                  {sess.current && <Badge tone="success">This device</Badge>}
                </li>
              ))}
            </ul>
          )}
          <div style={{ marginTop: "var(--sp-4)" }}>
            <Button variant="secondary" icon={<LuLogOut />} onClick={() => void revokeOthers()} loading={revoking} disabled={(sessions.data?.length ?? 0) <= 1}>
              Sign out other devices
            </Button>
          </div>
        </Section>

        <Section id="danger-settings" title="Delete account" description="Permanently removes your profile, saved recipes, cooking history and shared dishes.">
          <Button variant="dangerGhost" icon={<LuTrash2 />} onClick={() => setDeleteOpen(true)}>
            Delete my account
          </Button>
        </Section>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        busy={deleting}
        width={460}
        title="Delete your account?"
        description="This can't be undone. Your dishes and comments will be removed from the community."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} disabled={deleteConfirm !== "DELETE" || (user.hasPassword && !deletePassword)} onClick={() => void deleteAccount()}>
              Delete permanently
            </Button>
          </>
        }
      >
        <div className="stack">
          {deleteError && <Alert tone="error">{deleteError}</Alert>}
          {user.hasPassword && <TextField label="Your password" type="password" autoComplete="current-password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />}
          <TextField label={<>Type <strong>DELETE</strong> to confirm</>} value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} autoComplete="off" />
        </div>
      </Modal>
    </div>
  );
}
