import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LuBookmark, LuChefHat, LuClock, LuCompass, LuEarth, LuPlay, LuUsers } from "react-icons/lu";
import { useAppSelector } from "@/app/store";
import { Button, ButtonLink } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Card, EmptyState, ErrorState, Skeleton, StatTile } from "@/components/ui/primitives";
import { cookingApi, dishApi, recipeApi, userApi } from "@/lib/api/endpoints";
import { useAsync } from "@/lib/useAsync";
import { formatMinutes, formatRelative, pluralize } from "@/lib/format";
import { RecipeGrid } from "@/features/recipes/RecipeCard";
import s from "./dashboard.module.css";
import { thumbnail } from "@/lib/images";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const user = useAppSelector((st) => st.auth.user)!;
  const navigate = useNavigate();
  const favoriteKey = user.favoriteRecipeIds.join(",");
  const stats = useAsync((signal) => userApi.stats({ signal }), [favoriteKey]);
  const active = useAsync((signal) => cookingApi.active({ signal }), []);
  const saved = useAsync((signal) => userApi.favoriteRecipes({ signal }), [favoriteKey]);
  const picks = useAsync((signal) => recipeApi.recommendations(3, undefined, { signal }), [user.countryCode]);
  const community = useAsync((signal) => dishApi.feed(undefined, { signal }), []);
  const [code, setCode] = useState("");

  const join = (e: FormEvent) => {
    e.preventDefault();
    if (code.trim()) navigate(`/join/${code.trim().toUpperCase()}`);
  };

  return (
    <div className="container page page-enter">
      <header className={s.greeting}>
        <div>
          <p className="eyebrow">My kitchen</p>
          <h1>
            {greeting()}, {user.fullName.split(" ")[0]}
          </h1>
          <p className="muted" style={{ marginTop: 6 }}>
            {user.countryName ? `Cooking from ${user.countryName}. ` : ""}What's on the stove today?
          </p>
        </div>
        <ButtonLink to="/recipes" variant="primary" icon={<LuCompass />}>
          Find a recipe
        </ButtonLink>
      </header>

      <section className={s.stats} aria-label="Your cooking stats">
        {stats.loading && !stats.data
          ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={88} radius="var(--radius-lg)" />)
          : stats.data && (
              <>
                <StatTile icon={<LuBookmark />} label="Saved recipes" value={stats.data.savedRecipes} />
                <StatTile icon={<LuEarth />} label="Countries explored" value={stats.data.countriesExplored} tone={{ background: "var(--accent-soft)", color: "var(--accent-text)" }} />
                <StatTile icon={<LuChefHat />} label="Dishes cooked" value={stats.data.recipesCooked} tone={{ background: "var(--earth-soft)", color: "var(--earth)" }} />
                <StatTile icon={<LuClock />} label="Time at the stove" value={formatMinutes(stats.data.totalCookingMinutes)} tone={{ background: "var(--info-soft)", color: "var(--info)" }} />
              </>
            )}
        {stats.error && <ErrorState message={stats.error.message} onRetry={stats.reload} />}
      </section>

      <section className={s.section} aria-labelledby="continue-title">
        <div className={s.sectionHead}>
          <h2 id="continue-title">Continue cooking</h2>
        </div>
        {active.error ? (
          <ErrorState message={active.error.message} onRetry={active.reload} />
        ) : active.loading && !active.data ? (
          <Skeleton height={120} radius="var(--radius-lg)" />
        ) : active.data && active.data.length > 0 ? (
          <div className={s.sessions}>
            {active.data.map((session) => (
              <article key={session.id} className={s.session}>
                {session.recipeImageUrl ? <img src={thumbnail(session.recipeImageUrl) ?? undefined} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className={s.sessionThumb} />}
                <div>
                  <div className={s.sessionTitle}>{session.recipeName}</div>
                  <div className={s.sessionMeta}>
                    Step {session.currentStepIndex + 1} of {session.totalSteps} · {pluralize(session.participants.length, "chef")} · {formatRelative(session.updatedAt)}
                  </div>
                  <div className={s.bar} aria-hidden="true">
                    <span style={{ width: `${(session.completedSteps.length / Math.max(1, session.totalSteps)) * 100}%` }} />
                  </div>
                  <ButtonLink to={`/cook/${session.id}`} variant="primary" size="sm" icon={<LuPlay />}>
                    Resume
                  </ButtonLink>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Card>
            <div className={s.joinCard}>
              <div>
                <strong>Nothing on the stove.</strong>
                <p className="muted" style={{ fontSize: "var(--fs-sm)" }}>
                  Start a recipe, or join a friend's kitchen with their code.
                </p>
              </div>
              <form className="row" onSubmit={join} style={{ alignItems: "flex-end" }}>
                <TextField label="Session code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))} placeholder="ABC123" style={{ width: 150 }} />
                <Button type="submit" variant="secondary" icon={<LuUsers />} disabled={code.trim().length < 6}>
                  Join
                </Button>
              </form>
            </div>
          </Card>
        )}
      </section>

      <section className={s.section} aria-labelledby="saved-title">
        <div className={s.sectionHead}>
          <h2 id="saved-title">Saved recipes</h2>
          {saved.data && saved.data.length > 3 && (
            <Link to="/profile" className="muted">
              See all {saved.data.length}
            </Link>
          )}
        </div>
        {saved.error ? (
          <ErrorState message={saved.error.message} onRetry={saved.reload} />
        ) : saved.data && saved.data.length === 0 ? (
          <EmptyState icon={<LuBookmark />} title="No saved recipes yet" action={<ButtonLink to="/recipes" variant="primary">Browse recipes</ButtonLink>}>
            Tap the heart on any recipe to keep it here.
          </EmptyState>
        ) : (
          <RecipeGrid recipes={saved.data?.slice(0, 3)} loading={saved.loading && !saved.data} skeletons={3} />
        )}
      </section>

      <section className={s.section} aria-labelledby="picks-title">
        <div className={s.sectionHead}>
          <h2 id="picks-title">Recommended for you</h2>
        </div>
        {picks.error ? <ErrorState message={picks.error.message} onRetry={picks.reload} /> : <RecipeGrid recipes={picks.data} loading={picks.loading && !picks.data} skeletons={3} />}
      </section>

      <section className={s.section} aria-labelledby="community-title">
        <div className={s.sectionHead}>
          <h2 id="community-title">Fresh from the community</h2>
          <Link to="/community" className="muted">
            Open community
          </Link>
        </div>
        {community.error ? (
          <ErrorState message={community.error.message} onRetry={community.reload} />
        ) : community.data && community.data.length === 0 ? (
          <EmptyState icon={<LuUsers />} title="Be the first to share a dish" action={<ButtonLink to="/community?new=1" variant="primary">Share a dish</ButtonLink>} />
        ) : (
          <div className={s.dishes}>
            {(community.data ?? []).slice(0, 4).map((dish) => (
              <Link key={dish.id} to={`/community?dish=${dish.id}`} className={s.dish}>
                {dish.imageUrl ? <img src={dish.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <img src="/icons/icon-192.png" alt="" />}
                <span>
                  <span className={s.dishTitle}>{dish.title}</span>
                  <span className={s.dishMeta} style={{ display: "block" }}>
                    {dish.country} · by {dish.ownerName}
                  </span>
                </span>
              </Link>
            ))}
            {community.loading && !community.data && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={88} radius="var(--radius-lg)" />)}
          </div>
        )}
      </section>
    </div>
  );
}
