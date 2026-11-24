import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LuSearch, LuSearchX } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/primitives";
import { recipeApi } from "@/lib/api/endpoints";
import { toApiError, type ApiError } from "@/lib/api/client";
import type { RecipeSummary } from "@/lib/api/types";
import { useAsync, useDebouncedValue } from "@/lib/useAsync";
import { titleCase } from "@/lib/format";
import { RecipeGrid } from "./RecipeCard";
import ui from "@/components/ui/ui.module.css";
import s from "./recipes.module.css";

const PAGE_SIZE = 12;
const TIME_OPTIONS = [
  { value: "", label: "Any time" },
  { value: "30", label: "≤ 30 min" },
  { value: "60", label: "≤ 1 hour" },
  { value: "120", label: "≤ 2 hours" }
];

/**
 * Catalogue discovery. Filters live in the URL (shareable, back-button friendly); search input is
 * debounced; results page in with "Load more".
 */
export default function DiscoverPage() {
  const [params, setParams] = useSearchParams();
  const region = params.get("region") ?? "";
  const country = params.get("country") ?? "";
  const difficulty = params.get("difficulty") ?? "";
  const maxMinutes = params.get("maxMinutes") ?? "";
  const [query, setQuery] = useState(params.get("query") ?? "");
  const debouncedQuery = useDebouncedValue(query.trim(), 350);

  const facets = useAsync((signal) => recipeApi.facets({ signal }), []);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if ((params.get("query") ?? "") !== debouncedQuery) setParam("query", debouncedQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the debounced value
  }, [debouncedQuery]);

  const filterKey = useMemo(() => JSON.stringify([debouncedQuery, region, country, difficulty, maxMinutes]), [debouncedQuery, region, country, difficulty, maxMinutes]);
  const [items, setItems] = useState<RecipeSummary[]>([]);
  // Page belongs to a specific filter combination, so changing filters restarts at page 0 without an extra fetch.
  const [pager, setPager] = useState({ key: filterKey, page: 0 });
  const page = pager.key === filterKey ? pager.page : 0;
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    if (page === 0) setItems([]);
    recipeApi
      .search(
        { query: debouncedQuery || undefined, region: region || undefined, country: country || undefined, difficulty: difficulty || undefined, maxMinutes: maxMinutes ? Number(maxMinutes) : undefined, page, size: PAGE_SIZE },
        { signal: controller.signal }
      )
      .then((result) => {
        setItems((prev) => (page === 0 ? result.content : [...prev, ...result.content.filter((r) => !prev.some((p) => p.id === r.id))]));
        setTotal(result.totalElements);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(toApiError(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filterKey, page, retry, debouncedQuery, region, country, difficulty, maxMinutes]);

  const hasFilters = Boolean(debouncedQuery || region || country || difficulty || maxMinutes);
  const clearAll = () => {
    setQuery("");
    setParams(new URLSearchParams(), { replace: true });
  };

  return (
    <div className="container page page-enter">
      <PageHeader eyebrow="Discover" title="Recipes from around the world" subtitle="Filter by region, country, difficulty or time — every recipe can be cooked step by step with live timers." />

      <div className={s.filters} role="search" aria-label="Recipe filters">
        <div className={s.filterRow}>
          <div className={s.searchBox}>
            <LuSearch aria-hidden="true" />
            <label htmlFor="discover-search" className="visually-hidden">
              Search recipes
            </label>
            <input id="discover-search" className={ui.control} type="search" placeholder="Search dishes, cuisines, countries…" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={100} />
          </div>
          <label className="visually-hidden" htmlFor="discover-country">
            Country
          </label>
          <select id="discover-country" className={`${ui.control} ${s.filterSelect}`} value={country} onChange={(e) => setParam("country", e.target.value)}>
            <option value="">All countries</option>
            {facets.data?.countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flagEmoji} {c.name} ({c.recipeCount})
              </option>
            ))}
          </select>
          <label className="visually-hidden" htmlFor="discover-difficulty">
            Difficulty
          </label>
          <select id="discover-difficulty" className={`${ui.control} ${s.filterSelect}`} value={difficulty} onChange={(e) => setParam("difficulty", e.target.value)}>
            <option value="">Any difficulty</option>
            {(facets.data?.difficulties ?? ["EASY", "MEDIUM", "HARD"]).map((d) => (
              <option key={d} value={d}>
                {titleCase(d)}
              </option>
            ))}
          </select>
          <label className="visually-hidden" htmlFor="discover-time">
            Total time
          </label>
          <select id="discover-time" className={`${ui.control} ${s.filterSelect}`} value={maxMinutes} onChange={(e) => setParam("maxMinutes", e.target.value)}>
            {TIME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className={s.chipScroller} role="group" aria-label="Region">
          <button type="button" className={s.chip} aria-pressed={!region} onClick={() => setParam("region", "")}>
            All regions
          </button>
          {facets.data?.regions.map((r) => (
            <button key={r} type="button" className={s.chip} aria-pressed={region === r} onClick={() => setParam("region", region === r ? "" : r)}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className={s.resultsBar} aria-live="polite">
        <span>{total == null ? "Loading recipes…" : `${total} ${total === 1 ? "recipe" : "recipes"}${hasFilters ? " match your filters" : ""}`}</span>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Clear filters
          </Button>
        )}
      </div>

      {error && items.length === 0 ? (
        <ErrorState message={error.message} onRetry={() => setRetry((n) => n + 1)} />
      ) : !loading && items.length === 0 ? (
        <EmptyState
          icon={<LuSearchX />}
          title="No recipes match yet"
          action={
            <Button variant="primary" onClick={clearAll}>
              Clear filters
            </Button>
          }
        >
          Try a broader search, another region, or clear the filters to see everything.
        </EmptyState>
      ) : (
        <RecipeGrid recipes={items} loading={loading} />
      )}

      {total != null && items.length < total && !loading && (
        <div className={s.loadMore}>
          <Button variant="secondary" size="lg" onClick={() => setPager({ key: filterKey, page: page + 1 })}>
            Load more recipes
          </Button>
        </div>
      )}
    </div>
  );
}
