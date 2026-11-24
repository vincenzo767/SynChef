import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LuBookmark, LuCalendar, LuCamera, LuChefHat, LuClock, LuEarth, LuHistory, LuMapPin, LuUsers } from "react-icons/lu";
import { useAppDispatch, useAppSelector } from "@/app/store";
import { profileUpdated } from "@/features/auth/authSlice";
import { RecipeGrid } from "@/features/recipes/RecipeCard";
import { ButtonLink } from "@/components/ui/Button";
import { Avatar, Badge, Card, EmptyState, ErrorState, Skeleton, StatTile, Tabs } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/useToast";
import { cookingApi, userApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/client";
import { useAsync } from "@/lib/useAsync";
import { flagEmoji } from "@/lib/countries";
import { formatDate, formatMinutes, formatRelative, pluralize } from "@/lib/format";
import s from "./profile.module.css";
import { thumbnail } from "@/lib/images";

type Tab = "saved" | "history";

export default function ProfilePage() {
  const user = useAppSelector((st) => st.auth.user)!;
  const dispatch = useAppDispatch();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("saved");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const favoriteKey = user.favoriteRecipeIds.join(",");
  const stats = useAsync((signal) => userApi.stats({ signal }), [favoriteKey]);
  const saved = useAsync((signal) => userApi.favoriteRecipes({ signal }), [favoriteKey]);
  const history = useAsync((signal) => cookingApi.history({ signal }), [], tab === "history");

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo too large", "Please choose an image under 5 MB.");
      return;
    }
    setUploading(true);
    try {
      dispatch(profileUpdated(await userApi.uploadAvatar(file)));
      toast.success("Profile photo updated");
    } catch (e) {
      toast.error("Upload failed", toApiError(e).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="container page page-enter">
      <Card className={s.header}>
        <div className={s.avatarWrap}>
          <Avatar name={user.fullName} src={user.profileImageUrl} size={112} />
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => void upload(e.target.files?.[0])} />
          <button type="button" className={s.avatarButton} onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Change profile photo">
            <LuCamera aria-hidden="true" />
          </button>
        </div>
        <div className={s.identity}>
          <div className="row">
            <h1 className={s.name}>{user.fullName}</h1>
            {user.role === "ADMIN" && <Badge tone="accent">Administrator</Badge>}
          </div>
          <p className="muted">@{user.username}</p>
          <div className={s.facts}>
            {user.countryName && (
              <span>
                <LuMapPin aria-hidden="true" /> <span className="flag-emoji">{flagEmoji(user.countryCode)}</span> {user.countryName}
              </span>
            )}
            {user.createdAt && (
              <span>
                <LuCalendar aria-hidden="true" /> Cooking since {formatDate(user.createdAt)}
              </span>
            )}
          </div>
        </div>
        <ButtonLink to="/settings" variant="secondary" className={s.editButton}>
          Edit profile
        </ButtonLink>
      </Card>

      <section className={s.stats} aria-label="Your cooking stats">
        {stats.data ? (
          <>
            <StatTile icon={<LuBookmark />} label="Saved recipes" value={stats.data.savedRecipes} />
            <StatTile icon={<LuEarth />} label="Countries explored" value={stats.data.countriesExplored} />
            <StatTile icon={<LuChefHat />} label="Dishes cooked" value={stats.data.recipesCooked} />
            <StatTile icon={<LuClock />} label="Time at the stove" value={formatMinutes(stats.data.totalCookingMinutes)} />
            <StatTile icon={<LuUsers />} label="Dishes shared" value={stats.data.sharedDishes} />
          </>
        ) : stats.error ? (
          <ErrorState message={stats.error.message} onRetry={stats.reload} />
        ) : (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={88} radius="var(--radius-lg)" />)
        )}
      </section>

      <div style={{ marginBottom: "var(--sp-5)" }}>
        <Tabs
          label="Profile sections"
          value={tab}
          onChange={setTab}
          options={[
            { value: "saved", label: "Saved recipes" },
            { value: "history", label: "Cooking history" }
          ]}
        />
      </div>

      {tab === "saved" &&
        (saved.error ? (
          <ErrorState message={saved.error.message} onRetry={saved.reload} />
        ) : saved.data?.length === 0 ? (
          <EmptyState icon={<LuBookmark />} title="Nothing saved yet" action={<ButtonLink to="/recipes" variant="primary">Discover recipes</ButtonLink>}>
            Save recipes with the heart button and they'll be waiting here — on every device.
          </EmptyState>
        ) : (
          <RecipeGrid recipes={saved.data} loading={saved.loading && !saved.data} />
        ))}

      {tab === "history" &&
        (history.error ? (
          <ErrorState message={history.error.message} onRetry={history.reload} />
        ) : history.loading && !history.data ? (
          <Skeleton height={160} radius="var(--radius-lg)" />
        ) : history.data?.length === 0 ? (
          <EmptyState icon={<LuHistory />} title="No finished dishes yet" action={<ButtonLink to="/recipes" variant="primary">Start cooking</ButtonLink>}>
            Finish a recipe in cooking mode and it will show up here with how long it took.
          </EmptyState>
        ) : (
          <ul className={s.history}>
            {history.data?.map((h) => {
              const minutes = h.completedAt ? Math.round((new Date(h.completedAt).getTime() - new Date(h.startedAt).getTime()) / 60000) : null;
              return (
                <li key={h.id} className={s.historyItem}>
                  {h.recipeImageUrl ? <img src={thumbnail(h.recipeImageUrl) ?? undefined} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className={s.historyThumb} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link to={`/recipes/${h.recipeId}`} className={s.historyTitle}>
                      {h.recipeName}
                    </Link>
                    <div className="muted" style={{ fontSize: "var(--fs-sm)" }}>
                      {formatRelative(h.completedAt)} · serves {h.servings}
                      {minutes != null && ` · ${formatMinutes(Math.max(1, minutes))}`} · {pluralize(h.participants.length, "chef")}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ))}
    </div>
  );
}
