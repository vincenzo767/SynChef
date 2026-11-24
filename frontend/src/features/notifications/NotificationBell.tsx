import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuBell } from "react-icons/lu";
import { Popover } from "@/components/ui/Popover";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/useToast";
import { notificationApi } from "@/lib/api/endpoints";
import { useAsync } from "@/lib/useAsync";
import { useSubscription } from "@/lib/realtime";
import { formatRelative } from "@/lib/format";
import type { AppNotification } from "@/lib/api/types";
import { ReportNoticeDialog } from "./ReportNoticeDialog";
import s from "@/components/layout/layout.module.css";

/**
 * Notification centre. New notifications arrive in real time on the user's private queue,
 * so there is no polling.
 */
export function NotificationBell() {
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [noticeRecipeId, setNoticeRecipeId] = useState<number | null>(null);
  const { data, loading, setData } = useAsync((signal) => notificationApi.list({ signal }), []);
  const items = data ?? [];
  const unread = items.filter((n) => !n.isRead).length;

  useSubscription<AppNotification>("/user/queue/notifications", (n) => {
    setData((list) => [n, ...(list ?? []).filter((x) => x.id !== n.id)]);
    toast.info(n.title, n.message);
  });

  const markRead = useCallback(
    async (n: AppNotification) => {
      if (n.isRead) return;
      setData((list) => list?.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      try {
        await notificationApi.markRead(n.id);
      } catch {
        setData((list) => list?.map((x) => (x.id === n.id ? { ...x, isRead: false } : x)));
      }
    },
    [setData]
  );

  const markAll = async () => {
    const previous = items;
    setData((list) => list?.map((x) => ({ ...x, isRead: true })));
    try {
      await notificationApi.markAllRead();
    } catch {
      setData(previous);
      toast.error("Couldn't update notifications");
    }
  };

  const openNotification = (n: AppNotification, close: () => void) => {
    void markRead(n);
    close();
    if (n.type === "REPORT_FILED" && n.referenceRecipeId) {
      setNoticeRecipeId(n.referenceRecipeId);
    } else if (n.type === "ADMIN_REPORT" || n.type === "REPORT_APPEAL") {
      navigate("/admin/reports");
    } else if (n.referenceRecipeId && (n.type === "SYNCOOK_COMMENT" || n.type === "REPORT_CLOSED")) {
      navigate(`/community?dish=${n.referenceRecipeId}`);
    }
  };

  return (
    <>
      <Popover
        label="Notifications"
        width={380}
        open={open}
        onOpenChange={setOpen}
        trigger={({ toggle, ...aria }) => (
          <button type="button" className={s.iconButton} onClick={toggle} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} {...aria}>
            <LuBell aria-hidden="true" />
            {unread > 0 && <span className={s.countBadge}>{unread > 9 ? "9+" : unread}</span>}
          </button>
        )}
      >
        {(close) => (
          <div>
            <div className={s.notifHeader}>
              <strong>Notifications</strong>
              <Button variant="ghost" size="sm" onClick={() => void markAll()} disabled={unread === 0}>
                Mark all read
              </Button>
            </div>
            {loading && items.length === 0 ? (
              <Spinner label="Loading notifications" />
            ) : items.length === 0 ? (
              <p className={s.notifEmpty}>You're all caught up. New comments and updates will appear here.</p>
            ) : (
              <ul className={s.notifList}>
                {items.map((n) => (
                  <li key={n.id}>
                    <button type="button" className={`${s.notifItem} ${n.isRead ? "" : s.notifUnread}`} onClick={() => openNotification(n, close)}>
                      <span className={`${s.notifDot} ${n.isRead ? s.notifDotRead : ""}`} aria-hidden="true" />
                      <span>
                        <span className={s.notifTitle}>{n.title}</span>
                        <span className={s.notifMessage}>{n.message}</span>
                        <span className={s.notifTime}>{formatRelative(n.createdAt)}</span>
                        {!n.isRead && <span className="visually-hidden"> (unread)</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Popover>
      <ReportNoticeDialog recipeId={noticeRecipeId} onClose={() => setNoticeRecipeId(null)} />
    </>
  );
}
