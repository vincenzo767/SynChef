import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LuClock, LuEarth, LuFlame, LuLightbulb, LuListChecks, LuMinus, LuPlay, LuPlus, LuThermometer, LuTimer, LuUsers } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { Badge, Card, CardHeader, ErrorState, Skeleton, Spinner } from "@/components/ui/primitives";
import { recipeApi } from "@/lib/api/endpoints";
import { useAsync, useDebouncedValue } from "@/lib/useAsync";
import { formatDuration, formatMinutes, titleCase } from "@/lib/format";
import { FavoriteButton, RecipeGrid } from "./RecipeCard";
import { useStartCooking } from "./hooks";
import s from "./recipes.module.css";

const MIN_SERVINGS = 1;
const MAX_SERVINGS = 50;

export default function RecipeDetailPage() {
  const { id } = useParams();
  const recipeId = Number(id);
  const valid = Number.isInteger(recipeId) && recipeId > 0;
  const detail = useAsync((signal) => recipeApi.detail(recipeId, { signal }), [recipeId], valid);
  const recipe = detail.data;

  const [servings, setServings] = useState<number | null>(null);
  // Imported recipes without a published yield scale in batches of the recipe as written.
  const yieldKnown = recipe?.summary.defaultServings != null;
  const effectiveServings = servings ?? recipe?.summary.defaultServings ?? 1;
  const unitLabel = yieldKnown ? "Servings" : "Batches";
  const debouncedServings = useDebouncedValue(effectiveServings, 250);
  const scaled = useAsync((signal) => recipeApi.scaled(recipeId, debouncedServings, { signal }), [recipeId, debouncedServings], Boolean(recipe));
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const { start, starting } = useStartCooking();

  useEffect(() => {
    setServings(null);
    setChecked(new Set());
  }, [recipeId]);

  useEffect(() => {
    if (recipe) document.title = `${recipe.summary.name} · SynChef`;
    return () => {
      document.title = "SynChef — Cook the world, together";
    };
  }, [recipe]);

  const related = useAsync(
    (signal) => recipeApi.search({ region: recipe?.summary.region ?? undefined, size: 4 }, { signal }),
    [recipe?.summary.region],
    Boolean(recipe?.summary.region)
  );
  const relatedRecipes = useMemo(() => related.data?.content.filter((r) => r.id !== recipeId).slice(0, 3), [related.data, recipeId]);

  if (!valid || detail.error?.status === 404) {
    return (
      <div className="container page">
        <ErrorState title="Recipe not found" message="This recipe doesn't exist or is no longer available." />
      </div>
    );
  }
  if (detail.error) {
    return (
      <div className="container page">
        <ErrorState message={detail.error.message} onRetry={detail.reload} />
      </div>
    );
  }
  if (!recipe) return <Spinner label="Loading recipe" />;

  const sum = recipe.summary;
  const ingredients = scaled.data?.scaledIngredients;
  const timerSteps = recipe.steps.filter((st) => st.timerSeconds).length;
  const toggleChecked = (index: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  return (
    <div className="page-enter">
      <section className={s.detailHero} aria-labelledby="recipe-title">
        {sum.imageUrl && <img src={sum.imageUrl} alt="" referrerPolicy="no-referrer" />}
        <div className={`container ${s.detailHeroInner}`}>
          <nav className={s.breadcrumb} aria-label="Breadcrumb">
            <Link to="/recipes">Recipes</Link>
            <span aria-hidden="true">/</span>
            {sum.region && (
              <>
                <Link to={`/recipes?region=${encodeURIComponent(sum.region)}`}>{sum.region}</Link>
                <span aria-hidden="true">/</span>
              </>
            )}
            <span aria-current="page">{sum.countryName}</span>
          </nav>
          <h1 id="recipe-title" className={s.detailTitle}>
            {sum.name}
          </h1>
          {sum.description && <p className={s.detailDesc}>{sum.description}</p>}
          <div className={s.metaPills}>
            <span className={s.metaPill}>
              <span className="flag-emoji" aria-hidden="true">{sum.flagEmoji}</span> {sum.cuisine ?? sum.countryName}
            </span>
            {sum.totalTimeMinutes != null && (
              <span className={s.metaPill}>
                <LuClock aria-hidden="true" /> {formatMinutes(sum.totalTimeMinutes)}
              </span>
            )}
            {sum.difficulty && (
              <span className={s.metaPill}>
                <LuFlame aria-hidden="true" /> {titleCase(sum.difficulty)}
              </span>
            )}
            <span className={s.metaPill}>
              <LuListChecks aria-hidden="true" /> {recipe.steps.length} steps
            </span>
            {timerSteps > 0 && (
              <span className={s.metaPill}>
                <LuTimer aria-hidden="true" /> {timerSteps} timers
              </span>
            )}
          </div>
          <div className={s.detailActions}>
            <Button variant="accent" size="lg" icon={<LuPlay />} loading={starting} onClick={() => void start(recipeId, effectiveServings)}>
              Start cooking
            </Button>
            <Button variant="secondary" size="lg" icon={<LuUsers />} disabled={starting} onClick={() => void start(recipeId, effectiveServings, { invite: true })}>
              Cook with friends
            </Button>
            <FavoriteButton recipeId={recipeId} name={sum.name} />
          </div>
        </div>
      </section>

      <div className={`container page`}>
        <div className={s.detailGrid}>
          <aside className={s.sticky}>
            <Card>
              <CardHeader title="Ingredients" action={<Badge tone="brand">{checked.size}/{recipe.ingredients.length} ready</Badge>} />
              <div className={s.servings}>
                <span id="servings-label" style={{ fontWeight: 600 }} title={yieldKnown ? undefined : "The source doesn't state a yield; ×2 doubles every amount."}>
                  {unitLabel}
                </span>
                <div className={s.stepper} role="group" aria-labelledby="servings-label">
                  <Button size="sm" iconOnly variant="secondary" aria-label={`Fewer ${unitLabel.toLowerCase()}`} disabled={effectiveServings <= MIN_SERVINGS} onClick={() => setServings(Math.max(MIN_SERVINGS, effectiveServings - 1))} icon={<LuMinus />} />
                  <output className={s.stepperValue} aria-live="polite">
                    {yieldKnown ? effectiveServings : `×${effectiveServings}`}
                  </output>
                  <Button size="sm" iconOnly variant="secondary" aria-label={`More ${unitLabel.toLowerCase()}`} disabled={effectiveServings >= MAX_SERVINGS} onClick={() => setServings(Math.min(MAX_SERVINGS, effectiveServings + 1))} icon={<LuPlus />} />
                </div>
              </div>
              {!ingredients ? (
                <div className="stack" style={{ gap: 12 }}>
                  {recipe.ingredients.map((i) => (
                    <Skeleton key={i.id} height={18} />
                  ))}
                </div>
              ) : (
                <ul className={`${s.ingredients} ${scaled.loading ? s.updating : ""}`} aria-busy={scaled.loading}>
                  {ingredients.map((ing, index) => (
                    <li key={`${ing.ingredientId}-${index}`}>
                      <label className={`${s.ingredient} ${checked.has(index) ? s.ingredientChecked : ""}`}>
                        <input type="checkbox" checked={checked.has(index)} onChange={() => toggleChecked(index)} />
                        <span className={s.ingredientAmount}>{ing.displayAmount}</span>
                        <span className={s.ingredientName}>
                          {ing.ingredientName}
                          {ing.preparation && <span className={s.prep}>, {ing.preparation}</span>}
                          {ing.isOptional && (
                            <>
                              {" "}
                              <Badge>optional</Badge>
                            </>
                          )}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              {scaled.error && <p className="muted" style={{ marginTop: 12 }}>Couldn't rescale right now — showing the last amounts.</p>}
            </Card>
          </aside>

          <div className="stack" style={{ gap: "var(--sp-6)" }}>
            {recipe.culturalContext && (
              <Card>
                <div className={s.culture}>
                  <span className="eyebrow" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <LuEarth aria-hidden="true" /> Cultural context
                  </span>
                </div>
                <p style={{ marginTop: 8, color: "var(--text-muted)" }}>{recipe.culturalContext}</p>
              </Card>
            )}
            <Card>
              <CardHeader
                title="Method"
                action={sum.totalTimeMinutes != null ? <span className="muted">{formatMinutes(scaled.data?.adjustedTotalTime ?? sum.totalTimeMinutes)} total</span> : undefined}
              />
              <ol className={s.steps}>
                {recipe.steps.map((step, index) => (
                  <li key={step.id} className={s.step}>
                    <span className={s.stepNumber} aria-hidden="true">
                      {index + 1}
                    </span>
                    <div className={s.stepBody}>
                      <span className="visually-hidden">Step {index + 1}: </span>
                      <p>{step.instruction}</p>
                      <div className="row" style={{ gap: 8 }}>
                        {step.timerSeconds && (
                          <Badge tone="brand" icon={<LuTimer aria-hidden="true" />}>
                            {step.timerLabel ?? "Timer"} · {formatDuration(scaled.data?.scaledSteps[index]?.scaledTimerSeconds ?? step.timerSeconds)}
                          </Badge>
                        )}
                        {step.temperature && (
                          <Badge tone="earth" icon={<LuThermometer aria-hidden="true" />}>
                            {step.temperature}
                          </Badge>
                        )}
                      </div>
                      {step.tips && (
                        <p className={s.tip}>
                          <LuLightbulb aria-hidden="true" /> {step.tips}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              <div style={{ marginTop: "var(--sp-6)" }}>
                <Button variant="primary" size="lg" block icon={<LuPlay />} loading={starting} onClick={() => void start(recipeId, effectiveServings)}>
                  {yieldKnown ? `Start cooking for ${effectiveServings}` : `Start cooking (×${effectiveServings} batch)`}
                </Button>
              </div>
              {(recipe.sourceUrl || recipe.imageSourceUrl || recipe.videoUrl) && (
                <p className="muted" style={{ marginTop: "var(--sp-4)", fontSize: "var(--fs-xs)", display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
                  {recipe.sourceUrl && (
                    <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">
                      Recipe &amp; photo: TheMealDB
                    </a>
                  )}
                  {recipe.imageSourceUrl && (
                    <a href={recipe.imageSourceUrl} target="_blank" rel="noopener noreferrer">
                      Photo: Wikimedia Commons (licence &amp; author)
                    </a>
                  )}
                  {recipe.videoUrl && (
                    <a href={recipe.videoUrl} target="_blank" rel="noopener noreferrer">
                      Watch the video
                    </a>
                  )}
                </p>
              )}
            </Card>
          </div>
        </div>

        {relatedRecipes && relatedRecipes.length > 0 && (
          <section style={{ marginTop: "var(--sp-12)" }} aria-labelledby="related-title">
            <h2 id="related-title" className={s.sectionTitle} style={{ marginBottom: "var(--sp-5)" }}>
              More from {sum.region}
            </h2>
            <RecipeGrid recipes={relatedRecipes} loading={false} />
          </section>
        )}
      </div>
    </div>
  );
}
