import { lazy, Suspense, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LuArrowRight, LuSearch, LuUsers } from "react-icons/lu";
import { useAppSelector } from "@/app/store";
import { Card, EmptyState, ErrorState, PageHeader, Skeleton, Spinner, Tabs } from "@/components/ui/primitives";
import { countryApi, dishApi } from "@/lib/api/endpoints";
import { useAsync } from "@/lib/useAsync";
import { formatMinutes, titleCase } from "@/lib/format";
import type { Country } from "@/lib/api/types";
import ui from "@/components/ui/ui.module.css";
import s from "./explore.module.css";
import { thumbnail } from "@/lib/images";

const Globe = lazy(() => import("./Globe"));

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Global Flavor Map: every country with curated recipes, on a 3D globe and as an accessible list.
 * Country data and recipes come from the SynChef API only.
 */
export default function FlavorMapPage() {
  const signedIn = useAppSelector((st) => st.auth.status === "authenticated");
  const countries = useAsync((signal) => countryApi.all({ signal }), []);
  const [continent, setContinent] = useState("ALL");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Country | null>(null);
  const webgl = useMemo(supportsWebGL, []);

  const [onlyWithRecipes, setOnlyWithRecipes] = useState(false);
  const allCountries = useMemo(() => countries.data ?? [], [countries.data]);
  const withRecipeCount = useMemo(() => allCountries.filter((c) => c.recipeCount > 0).length, [allCountries]);
  const continents = useMemo(() => Array.from(new Set(allCountries.map((c) => c.continent))).sort(), [allCountries]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allCountries.filter(
      (c) => (continent === "ALL" || c.continent === continent) && (!onlyWithRecipes || c.recipeCount > 0) && (!q || c.name.toLowerCase().includes(q))
    );
  }, [allCountries, continent, query, onlyWithRecipes]);

  const recipes = useAsync((signal) => countryApi.recipes(selected!.code, { signal }), [selected?.code], Boolean(selected && selected.recipeCount > 0));
  const dishes = useAsync((signal) => dishApi.feed(selected!.name, { signal }), [selected?.name], Boolean(selected) && signedIn);

  const select = (c: Country) => {
    setSelected(c);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      window.setTimeout(() => document.getElementById("country-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  };

  return (
    <div className="container page page-enter">
      <PageHeader
        eyebrow="Global gastronomy"
        title="The Flavor Map"
        subtitle="Spin the globe or browse the list to explore the culinary traditions behind every recipe."
      />
      {countries.error ? (
        <ErrorState message={countries.error.message} onRetry={countries.reload} />
      ) : (
        <div className={s.layout}>
          <div className={s.globeCard}>
            {webgl ? (
              <Suspense fallback={<div className={s.globeFallback}><Spinner label="Loading globe" /></div>}>
                <Globe countries={allCountries} selected={selected?.code ?? null} onSelect={select} />
              </Suspense>
            ) : (
              <div className={s.globeFallback}>3D globe isn't supported on this device — use the country list instead.</div>
            )}
            {webgl && <span className={s.globeHint}>Drag to rotate · scroll or pinch to zoom · tap a marker</span>}
          </div>

          <div className={s.panel}>
            {selected && (
              <Card id="country-detail" className={s.selected} key={selected.code}>
                <div className={s.selectedHead}>
                  <span className={`${s.bigFlag} flag-emoji`} aria-hidden="true">
                    {selected.flagEmoji}
                  </span>
                  <div>
                    <p className="eyebrow">{titleCase(selected.continent)}</p>
                    <h2 style={{ fontSize: "var(--fs-2xl)" }}>{selected.name}</h2>
                  </div>
                </div>
                {selected.description && <p className="muted">{selected.description}</p>}
                {selected.recipeCount === 0 ? (
                  <EmptyState title={`No recipes from ${selected.name} yet`} action={signedIn ? <Link to="/community?new=1">Share a dish from {selected.name}</Link> : undefined}>
                    Our catalogue doesn't include a verified recipe from this country yet.
                  </EmptyState>
                ) : recipes.loading && !recipes.data ? (
                  <div className="stack" style={{ marginTop: 16, gap: 10 }}>
                    <Skeleton height={56} />
                    <Skeleton height={56} />
                  </div>
                ) : recipes.error ? (
                  <ErrorState message={recipes.error.message} onRetry={recipes.reload} />
                ) : (
                  <ul className={s.recipeRows}>
                    {recipes.data?.slice(0, 8).map((r) => (
                      <li key={r.id}>
                        <Link to={`/recipes/${r.id}`} className={s.recipeRow}>
                          {r.imageUrl && <img src={thumbnail(r.imageUrl) ?? undefined} alt="" loading="lazy" referrerPolicy="no-referrer" />}
                          <span style={{ flex: 1 }}>
                            <span className={s.recipeRowTitle} style={{ display: "block" }}>
                              {r.name}
                            </span>
                            <span className={s.recipeRowMeta}>
                              {[r.totalTimeMinutes != null ? formatMinutes(r.totalTimeMinutes) : null, r.difficulty ? titleCase(r.difficulty) : null]
                                .filter(Boolean)
                                .join(" · ") || r.cuisine || r.countryName}
                            </span>
                          </span>
                          <LuArrowRight aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {selected.recipeCount > 3 && (
                  <p style={{ marginTop: 12, fontSize: "var(--fs-sm)" }}>
                    <Link to={`/recipes?country=${selected.code}`}>Browse all {selected.recipeCount} recipes from {selected.name} in Discover</Link>
                  </p>
                )}
                {signedIn && dishes.data && dishes.data.length > 0 && (
                  <p style={{ marginTop: 16, fontSize: "var(--fs-sm)" }}>
                    <LuUsers aria-hidden="true" style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} />
                    <Link to={`/community`}>
                      {dishes.data.length} community {dishes.data.length === 1 ? "dish" : "dishes"} from {selected.name}
                    </Link>
                  </p>
                )}
              </Card>
            )}

            <Card>
              <div className="stack" style={{ gap: "var(--sp-4)" }}>
                <Tabs
                  label="Continent"
                  value={continent}
                  onChange={setContinent}
                  options={[{ value: "ALL", label: "All" }, ...continents.map((c) => ({ value: c, label: titleCase(c) }))]}
                />
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="muted" style={{ fontSize: "var(--fs-sm)" }}>
                    {allCountries.length} countries · {withRecipeCount} with recipes
                  </span>
                  <button type="button" className={s.filterChip} aria-pressed={onlyWithRecipes} onClick={() => setOnlyWithRecipes((v) => !v)}>
                    With recipes only
                  </button>
                </div>
                <div style={{ position: "relative" }}>
                  <LuSearch aria-hidden="true" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                  <label htmlFor="country-search" className="visually-hidden">
                    Search countries
                  </label>
                  <input id="country-search" className={ui.control} style={{ paddingLeft: 42 }} type="search" placeholder="Search countries" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
                {countries.loading && !countries.data ? (
                  <Spinner label="Loading countries" />
                ) : visible.length === 0 ? (
                  <EmptyState title="No countries match">Try another continent or search term.</EmptyState>
                ) : (
                  <ul className={s.countryList}>
                    {visible.map((c) => (
                      <li key={c.code}>
                        <button type="button" className={s.countryButton} data-empty={c.recipeCount === 0} aria-pressed={selected?.code === c.code} onClick={() => select(c)}>
                          <span className={`${s.countryFlag} flag-emoji`} aria-hidden="true">
                            {c.flagEmoji}
                          </span>
                          <span className={s.countryName}>{c.name}</span>
                          <span className={s.count}>{c.recipeCount}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
