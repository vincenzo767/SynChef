import { useMemo, useState } from "react";
import { LuMessagesSquare, LuSearch, LuTrash2 } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Avatar, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/useToast";
import { adminApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/client";
import { useAsync } from "@/lib/useAsync";
import { useSubscription } from "@/lib/realtime";
import { formatRelative } from "@/lib/format";
import type { ModerationComment } from "@/lib/api/types";
import ui from "@/components/ui/ui.module.css";
import s from "./admin.module.css";

export default function AdminModerationPage() {
  const toast = useToast();
  const comments = useAsync((signal) => adminApi.comments({ signal }), []);
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<ModerationComment | null>(null);
  const [busy, setBusy] = useState(false);

  // Comment counts are part of the live stats stream; refresh the list when they change.
  useSubscription("/topic/admin/stats", () => comments.reload());

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (comments.data ?? []).filter((c) => !q || c.content.toLowerCase().includes(q) || c.authorName.toLowerCase().includes(q) || c.recipeTitle.toLowerCase().includes(q));
  }, [comments.data, query]);

  const remove = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await adminApi.deleteComment(target.id);
      comments.setData((list) => list?.filter((c) => c.id !== target.id));
      toast.success("Comment removed");
      setTarget(null);
    } catch (e) {
      toast.error("Couldn't remove the comment", toApiError(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={s.toolbar}>
        <div style={{ position: "relative", flex: "1 1 260px", maxWidth: 380 }}>
          <LuSearch aria-hidden="true" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <label htmlFor="comment-search" className="visually-hidden">
            Search comments
          </label>
          <input id="comment-search" className={ui.control} style={{ paddingLeft: 42 }} type="search" placeholder="Search comments, authors or dishes" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <span className="muted">{comments.data ? `${visible.length} comments` : ""}</span>
      </div>
      {comments.error ? (
        <ErrorState message={comments.error.message} onRetry={comments.reload} />
      ) : comments.loading && !comments.data ? (
        <Skeleton height={240} radius="var(--radius-lg)" />
      ) : visible.length === 0 ? (
        <EmptyState icon={<LuMessagesSquare />} title="No comments to review" />
      ) : (
        <div className="stack" style={{ gap: "var(--sp-3)" }}>
          {visible.map((c) => (
            <Card key={c.id} style={{ display: "flex", gap: "var(--sp-4)", alignItems: "flex-start" }}>
              <Avatar name={c.authorName} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {c.authorName} <span className="muted" style={{ fontWeight: 400, fontSize: "var(--fs-sm)" }}>on “{c.recipeTitle}” · {formatRelative(c.createdAt)}</span>
                </div>
                <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", marginTop: 4 }}>{c.content}</p>
              </div>
              <Button variant="dangerGhost" size="sm" icon={<LuTrash2 />} onClick={() => setTarget(c)}>
                Remove
              </Button>
            </Card>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={target !== null}
        title="Remove this comment?"
        message="It will be deleted for everyone. This can't be undone."
        confirmLabel="Remove comment"
        danger
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={() => setTarget(null)}
      />
    </>
  );
}
