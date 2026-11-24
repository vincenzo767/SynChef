import { useMemo, useState } from "react";
import { LuBan, LuSearch, LuTrash2, LuUserCheck, LuUsers } from "react-icons/lu";
import { useAppSelector } from "@/app/store";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Avatar, Badge, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/useToast";
import { adminApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/client";
import { useAsync } from "@/lib/useAsync";
import { useSubscription } from "@/lib/realtime";
import { formatRelative } from "@/lib/format";
import type { AdminUser, Role } from "@/lib/api/types";
import ui from "@/components/ui/ui.module.css";
import s from "./admin.module.css";

export default function AdminUsersPage() {
  const me = useAppSelector((st) => st.auth.user);
  const toast = useToast();
  const users = useAsync((signal) => adminApi.users({ signal }), []);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);

  useSubscription("/topic/admin/stats", () => users.reload());

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users.data ?? []).filter((u) => !q || u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
  }, [users.data, query]);

  const replace = (u: AdminUser) => users.setData((list) => list?.map((x) => (x.id === u.id ? u : x)));

  const run = async (id: number, action: () => Promise<AdminUser | void>, success: string) => {
    setBusyId(id);
    try {
      const result = await action();
      if (result) replace(result);
      toast.success(success);
    } catch (e) {
      toast.error("Action failed", toApiError(e).message);
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    await run(deleting.id, () => adminApi.deleteUser(deleting.id).then(() => undefined), `${deleting.fullName} was deleted`);
    users.setData((list) => list?.filter((u) => u.id !== deleting.id));
    setDeleting(null);
  };

  const actions = (u: AdminUser) => {
    const self = u.id === me?.id;
    return (
      <div className={s.actions}>
        <label className="visually-hidden" htmlFor={`role-${u.id}`}>
          Role for {u.fullName}
        </label>
        <select
          id={`role-${u.id}`}
          className={`${ui.control} ${s.roleSelect}`}
          value={u.role}
          disabled={self || busyId === u.id}
          onChange={(e) => void run(u.id, () => adminApi.setRole(u.id, e.target.value as Role), `Role updated for ${u.fullName}`)}
        >
          <option value="USER">User</option>
          <option value="ADMIN">Admin</option>
        </select>
        <Button
          size="sm"
          variant={u.active ? "secondary" : "primary"}
          icon={u.active ? <LuBan /> : <LuUserCheck />}
          disabled={self || busyId === u.id}
          onClick={() => void run(u.id, () => adminApi.toggleStatus(u.id), u.active ? `${u.fullName} suspended` : `${u.fullName} reactivated`)}
        >
          {u.active ? "Suspend" : "Reactivate"}
        </Button>
        <Button size="sm" variant="dangerGhost" iconOnly aria-label={`Delete ${u.fullName}`} icon={<LuTrash2 />} disabled={self || busyId === u.id} onClick={() => setDeleting(u)} />
      </div>
    );
  };

  return (
    <>
      <div className={s.toolbar}>
        <div style={{ position: "relative", flex: "1 1 260px", maxWidth: 380 }}>
          <LuSearch aria-hidden="true" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <label htmlFor="user-search" className="visually-hidden">
            Search users
          </label>
          <input id="user-search" className={ui.control} style={{ paddingLeft: 42 }} type="search" placeholder="Search name, email or username" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <span className="muted">{users.data ? `${visible.length} of ${users.data.length} users` : ""}</span>
      </div>

      {users.error ? (
        <ErrorState message={users.error.message} onRetry={users.reload} />
      ) : users.loading && !users.data ? (
        <Skeleton height={240} radius="var(--radius-lg)" />
      ) : visible.length === 0 ? (
        <EmptyState icon={<LuUsers />} title="No users match">
          Try a different search.
        </EmptyState>
      ) : (
        <>
          <Card flush className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Country</th>
                  <th scope="col">Status</th>
                  <th scope="col">Joined</th>
                  <th scope="col" style={{ textAlign: "right" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className={s.userCell}>
                        <Avatar name={u.fullName} src={u.profileImageUrl} size={36} />
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            {u.fullName} {u.id === me?.id && <span className="muted">(you)</span>}
                          </div>
                          <div className={s.cellSub}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>{u.countryName ?? "—"}</td>
                    <td>{u.active ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Suspended</Badge>}</td>
                    <td>{formatRelative(u.createdAt)}</td>
                    <td>{actions(u)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className={s.cards}>
            {visible.map((u) => (
              <Card key={u.id} className="stack" style={{ gap: 12 }}>
                <div className={s.userCell}>
                  <Avatar name={u.fullName} src={u.profileImageUrl} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{u.fullName}</div>
                    <div className={s.cellSub} style={{ overflowWrap: "anywhere" }}>
                      {u.email}
                    </div>
                  </div>
                  {u.active ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Suspended</Badge>}
                </div>
                {actions(u)}
              </Card>
            ))}
          </div>
        </>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.fullName ?? "user"}?`}
        message="Their profile, dishes, comments and cooking history will be permanently removed. Moderation records are kept but anonymized."
        confirmLabel="Delete user"
        danger
        busy={busyId === deleting?.id}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
