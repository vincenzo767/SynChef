import { useEffect, useRef, useState, type FormEvent } from "react";
import { LuFlag, LuLock, LuMessageCircle, LuPencil, LuSend, LuTrash2 } from "react-icons/lu";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
import { Alert, Avatar, Badge, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/useToast";
import { dishApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/client";
import { useAsync } from "@/lib/useAsync";
import { useSubscription } from "@/lib/realtime";
import { formatRelative } from "@/lib/format";
import type { Comment, Dish } from "@/lib/api/types";
import s from "./community.module.css";

/**
 * Dish detail with a live comment thread: new comments from anyone appear instantly via
 * /topic/syncook/{id}/comments (the server only allows subscribing to dishes you can read).
 * All user content is rendered as text (React escapes it) — never as HTML.
 */
export function DishDetail({
  dishId,
  onClose,
  onEdit,
  onDelete,
  onReport
}: {
  dishId: number | null;
  onClose: () => void;
  onEdit: (dish: Dish) => void;
  onDelete: (dish: Dish) => void;
  onReport: (dish: Dish) => void;
}) {
  const open = dishId != null;
  const toast = useToast();
  const { data: dish, error, loading, setData } = useAsync((signal) => dishApi.get(dishId!, { signal }), [dishId], open);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listEnd = useRef<HTMLLIElement>(null);

  const addComment = (comment: Comment) =>
    setData((d) => (d && !d.comments.some((c) => c.id === comment.id) ? { ...d, comments: [...d.comments, comment], commentCount: d.commentCount + 1 } : d));

  useSubscription<Comment>(open ? `/topic/syncook/${dishId}/comments` : null, addComment);

  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [dish?.comments.length]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (text.length < 2 || !dish) return;
    setSending(true);
    try {
      addComment(await dishApi.comment(dish.id, text));
      setDraft("");
    } catch (err) {
      toast.error("Comment not posted", toApiError(err).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={760}
      title={dish?.title ?? "Dish"}
      description={dish ? `${dish.country} · shared by ${dish.ownerName} · ${formatRelative(dish.createdAt)}` : undefined}
      footer={
        dish && (
          <>
            {dish.canEdit ? (
              <>
                <Button variant="dangerGhost" icon={<LuTrash2 />} onClick={() => onDelete(dish)}>
                  Delete
                </Button>
                <Button variant="secondary" icon={<LuPencil />} onClick={() => onEdit(dish)}>
                  Edit
                </Button>
              </>
            ) : (
              <Button variant="ghost" icon={<LuFlag />} onClick={() => onReport(dish)}>
                Report
              </Button>
            )}
          </>
        )
      }
    >
      {loading && !dish && <Spinner label="Loading dish" />}
      {error && <Alert tone="error">{error.message}</Alert>}
      {dish && (
        <>
          {dish.imageUrl && <img className={s.detailCover} src={dish.imageUrl} alt={dish.title} referrerPolicy="no-referrer" />}
          {dish.privacy === "PRIVATE" && (
            <Badge tone="warning" icon={<LuLock aria-hidden="true" />}>
              Only you can see this dish
            </Badge>
          )}
          <div className={s.detailGrid}>
            <div>
              <h3 className={s.subTitle}>Ingredients</h3>
              <ul className={s.list}>
                {dish.ingredients.map((i, idx) => (
                  <li key={idx}>{i}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className={s.subTitle}>Steps</h3>
              <ol className={s.list}>
                {dish.procedures.map((p, idx) => (
                  <li key={idx}>{p}</li>
                ))}
              </ol>
            </div>
          </div>

          <h3 className={s.subTitle}>
            <LuMessageCircle aria-hidden="true" style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} />
            Comments ({dish.comments.length})
          </h3>
          <ul className={s.comments} aria-live="polite">
            {dish.comments.length === 0 && <li className="muted">No comments yet — say something nice!</li>}
            {dish.comments.map((c) => (
              <li key={c.id} className={s.comment}>
                <Avatar name={c.authorName} size={32} />
                <div className={s.commentBubble}>
                  <span className={s.commentAuthor}>{c.authorName}</span>
                  <span className={s.commentTime}>{formatRelative(c.createdAt)}</span>
                  <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{c.content}</p>
                </div>
              </li>
            ))}
            <li ref={listEnd} aria-hidden="true" />
          </ul>
          <form className={s.composer} onSubmit={send}>
            <TextArea label="Add a comment" value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} maxLength={500} hint={`${draft.length}/500`} style={{ minHeight: 64 }} />
            <Button type="submit" variant="primary" iconOnly aria-label="Post comment" icon={<LuSend />} loading={sending} disabled={draft.trim().length < 2} style={{ marginBottom: 22 }} />
          </form>
        </>
      )}
    </Modal>
  );
}
