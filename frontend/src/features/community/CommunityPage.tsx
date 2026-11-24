import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LuLock, LuMessageCircle, LuPlus, LuSearch, LuSoup, LuUsers } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Badge, EmptyState, ErrorState, PageHeader, Skeleton, Tabs } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/useToast";
import { dishApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/client";
import { useAsync } from "@/lib/useAsync";
import { formatRelative } from "@/lib/format";
import type { Dish } from "@/lib/api/types";
import { DishDetail } from "./DishDetail";
import { DishEditor } from "./DishEditor";
import { ReportDialog } from "./ReportDialog";
import ui from "@/components/ui/ui.module.css";
import s from "./community.module.css";

type View = "feed" | "mine";

/**
 * Community kitchen (SynCook): share your own dishes, browse others', comment live, report.
 * Deep links: ?dish=ID opens a dish, ?edit=ID opens the editor, ?new=1 starts a new dish.
 */
export default function CommunityPage() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const [view, setView] = useState<View>("feed");
  const [filter, setFilter] = useState("");
  const feed = useAsync((signal) => dishApi.feed(undefined, { signal }), []);
  const mine = useAsync((signal) => dishApi.mine({ signal }), []);
  const [editing, setEditing] = useState<Dish | null>(null);
  const [editorOpen, setEditorOpen] = useState(params.get("new") === "1");
  const [reporting, setReporting] = useState<Dish | null>(null);
  const [deleting, setDeleting] = useState<Dish | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const openDishId = params.get("dish") ? Number(params.get("dish")) : null;
  const editParam = params.get("edit") ? Number(params.get("edit")) : null;

  // ?edit=ID (e.g. from a moderation notice): open the editor once the dish is loaded.
  const editTarget = useMemo(() => (editParam ? mine.data?.find((d) => d.id === editParam) ?? null : null), [editParam, mine.data]);
  if (editTarget && !editorOpen) {
    setEditing(editTarget);
    setEditorOpen(true);
  }

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const source = view === "feed" ? feed : mine;
  const dishes = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (source.data ?? []).filter((d) => !q || d.title.toLowerCase().includes(q) || d.country.toLowerCase().includes(q) || d.ownerName.toLowerCase().includes(q));
  }, [source.data, filter]);

  const upsert = (list: Dish[] | undefined, dish: Dish) => (list?.some((d) => d.id === dish.id) ? list.map((d) => (d.id === dish.id ? dish : d)) : [dish, ...(list ?? [])]);

  const onSaved = (dish: Dish) => {
    mine.setData((list) => upsert(list, dish));
    if (dish.privacy === "PUBLIC") feed.setData((list) => upsert(list, dish));
    else feed.setData((list) => list?.filter((d) => d.id !== dish.id));
    toast.success(editing ? "Dish updated" : "Dish shared", dish.privacy === "PUBLIC" ? "It's now visible to the community." : "Only you can see it.");
    closeEditor();
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditing(null);
    const next = new URLSearchParams(params);
    next.delete("edit");
    next.delete("new");
    setParams(next, { replace: true });
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await dishApi.remove(deleting.id);
      mine.setData((list) => list?.filter((d) => d.id !== deleting.id));
      feed.setData((list) => list?.filter((d) => d.id !== deleting.id));
      setParam("dish", null);
      toast.success("Dish deleted");
      setDeleting(null);
    } catch (e) {
      toast.error("Couldn't delete the dish", toApiError(e).message);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="container page page-enter">
      <PageHeader
        eyebrow="Community kitchen"
        title="Cooked with love, shared with the world"
        subtitle="Share your own creations, discover home recipes from other chefs and swap tips in the comments."
        actions={
          <Button
            variant="primary"
            icon={<LuPlus />}
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
          >
            Share a dish
          </Button>
        }
      />

      <div className={s.toolbar}>
        <Tabs
          label="Dishes"
          value={view}
          onChange={setView}
          options={[
            { value: "feed", label: `Community${feed.data ? ` · ${feed.data.length}` : ""}` },
            { value: "mine", label: `My dishes${mine.data ? ` · ${mine.data.length}` : ""}` }
          ]}
        />
        <div className={s.search} style={{ position: "relative" }}>
          <LuSearch aria-hidden="true" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <label htmlFor="community-search" className="visually-hidden">
            Filter dishes
          </label>
          <input id="community-search" className={ui.control} style={{ paddingLeft: 42 }} type="search" placeholder="Filter by dish, country or chef" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
      </div>

      {source.error ? (
        <ErrorState message={source.error.message} onRetry={source.reload} />
      ) : source.loading && !source.data ? (
        <div className={s.grid}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height={260} radius="var(--radius-lg)" />
          ))}
        </div>
      ) : dishes.length === 0 ? (
        <EmptyState
          icon={view === "feed" ? <LuUsers /> : <LuSoup />}
          title={filter ? "No dishes match your filter" : view === "feed" ? "The community table is empty" : "You haven't shared a dish yet"}
          action={
            !filter && (
              <Button variant="primary" icon={<LuPlus />} onClick={() => setEditorOpen(true)}>
                Share your first dish
              </Button>
            )
          }
        >
          {filter ? "Try a different search." : "Recipes you share appear here for everyone to enjoy."}
        </EmptyState>
      ) : (
        <div className={s.grid}>
          {dishes.map((dish) => (
            <button key={dish.id} type="button" className={s.card} onClick={() => setParam("dish", String(dish.id))} aria-label={`Open ${dish.title} by ${dish.ownerName}`}>
              {dish.imageUrl ? (
                <img className={s.cover} src={dish.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
              ) : (
                <span className={s.coverFallback} aria-hidden="true">
                  <LuSoup />
                </span>
              )}
              <span className={s.cardBody}>
                <span className={s.cardTitle}>{dish.title}</span>
                <span className={s.cardMeta}>
                  {dish.country} · {dish.ownerName}
                  {dish.privacy === "PRIVATE" && (
                    <Badge tone="warning" icon={<LuLock aria-hidden="true" />}>
                      Private
                    </Badge>
                  )}
                </span>
                <span className={s.cardFoot}>
                  <span>{formatRelative(dish.createdAt)}</span>
                  <span>
                    <LuMessageCircle aria-hidden="true" style={{ display: "inline", verticalAlign: "-2px" }} /> {dish.commentCount}
                  </span>
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      <DishDetail
        dishId={openDishId}
        onClose={() => setParam("dish", null)}
        onEdit={(dish) => {
          setParam("dish", null);
          setEditing(dish);
          setEditorOpen(true);
        }}
        onDelete={(dish) => setDeleting(dish)}
        onReport={(dish) => setReporting(dish)}
      />
      <DishEditor open={editorOpen} dish={editing} onClose={closeEditor} onSaved={onSaved} />
      <ReportDialog dishId={reporting?.id ?? null} dishTitle={reporting?.title ?? ""} onClose={() => setReporting(null)} />
      <ConfirmDialog
        open={deleting !== null}
        title="Delete this dish?"
        message={`“${deleting?.title}” and all its comments will be permanently removed.`}
        confirmLabel="Delete dish"
        danger
        busy={deleteBusy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
