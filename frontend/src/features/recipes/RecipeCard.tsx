import { memo, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { LuClock, LuFlame, LuHeart, LuTimer, LuUtensils } from "react-icons/lu";
import { Skeleton } from "@/components/ui/primitives";
import { formatMinutes, titleCase } from "@/lib/format";
import type { RecipeSummary } from "@/lib/api/types";
import { useFavorite } from "./hooks";
import s from "./recipes.module.css";
import { thumbnail } from "@/lib/images";

export function FavoriteButton({ recipeId, name }: { recipeId: number; name: string }) {
  const { isFavorite, toggle, pending } = useFavorite(recipeId);
  return (
    <button
      type="button"
      className={s.heart}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? `Remove ${name} from saved recipes` : `Save ${name}`}
      onClick={() => void toggle()}
      disabled={pending}
    >
      <LuHeart aria-hidden="true" />
    </button>
  );
}

export const RecipeCard = memo(function RecipeCard({ recipe, index = 0 }: { recipe: RecipeSummary; index?: number }) {
  return (
    <article className={s.card} style={{ "--i": Math.min(index, 12) } as CSSProperties}>
      <div className={s.media}>
        {recipe.imageUrl ? (
          <img src={thumbnail(recipe.imageUrl) ?? undefined} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
        ) : (
          <div className={s.mediaFallback} aria-hidden="true">
            <LuUtensils />
          </div>
        )}
        <span className={s.flag}>
          <span className="flag-emoji" aria-hidden="true">{recipe.flagEmoji}</span> {recipe.countryName}
        </span>
        <div className={s.favButton}>
          <FavoriteButton recipeId={recipe.id} name={recipe.name} />
        </div>
      </div>
      <div className={s.body}>
        <h3 className={s.cardTitle}>
          <Link to={`/recipes/${recipe.id}`}>{recipe.name}</Link>
        </h3>
        {recipe.description && <p className={s.cardDesc}>{recipe.description}</p>}
        <div className={s.meta}>
          {recipe.totalTimeMinutes != null && (
            <span>
              <LuClock aria-hidden="true" /> {formatMinutes(recipe.totalTimeMinutes)}
            </span>
          )}
          {recipe.difficulty && (
            <span>
              <LuFlame aria-hidden="true" /> {titleCase(recipe.difficulty)}
            </span>
          )}
          {recipe.timerCount > 0 && (
            <span>
              <LuTimer aria-hidden="true" /> {recipe.timerCount} timers
            </span>
          )}
        </div>
      </div>
    </article>
  );
});

export function RecipeCardSkeleton() {
  return (
    <div className={s.card} aria-hidden="true">
      <Skeleton height="auto" radius="0" style={{ aspectRatio: "4 / 3" }} />
      <div className={s.body}>
        <Skeleton width="70%" height={20} />
        <Skeleton height={12} />
        <Skeleton width="85%" height={12} />
        <Skeleton width="50%" height={12} style={{ marginTop: 12 }} />
      </div>
    </div>
  );
}

export function RecipeGrid({ recipes, loading, skeletons = 6 }: { recipes: RecipeSummary[] | undefined; loading: boolean; skeletons?: number }) {
  return (
    <div className="grid-cards" aria-busy={loading}>
      {recipes?.map((r, i) => <RecipeCard key={r.id} recipe={r} index={i} />)}
      {loading && Array.from({ length: recipes?.length ? 3 : skeletons }, (_, i) => <RecipeCardSkeleton key={`sk-${i}`} />)}
    </div>
  );
}
