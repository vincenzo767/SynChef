import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LuArrowRight, LuEarth, LuSearch, LuTimer, LuUsers } from "react-icons/lu";
import { useAppSelector } from "@/app/store";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/primitives";
import { recipeApi } from "@/lib/api/endpoints";
import { useAsync } from "@/lib/useAsync";
import { RecipeGrid } from "./RecipeCard";
import s from "./recipes.module.css";

export default function HomePage() {
  const navigate = useNavigate();
  const user = useAppSelector((st) => st.auth.user);
  const [query, setQuery] = useState("");
  const facets = useAsync((signal) => recipeApi.facets({ signal }), []);
  const picks = useAsync((signal) => recipeApi.recommendations(6, undefined, { signal }), [user?.countryCode]);

  const recipeCount = facets.data?.countries.reduce((sum, c) => sum + c.recipeCount, 0);

  const search = (e: FormEvent) => {
    e.preventDefault();
    navigate(query.trim() ? `/recipes?query=${encodeURIComponent(query.trim())}` : "/recipes");
  };

  return (
    <div className="page-enter">
      <section className={s.hero} aria-labelledby="hero-title">
        <img
          className={s.heroImage}
          src="/images/hero-kitchen-1920.jpg"
          srcSet="/images/hero-kitchen-960.jpg 960w, /images/hero-kitchen-1920.jpg 1920w"
          sizes="100vw"
          alt=""
          {...{ fetchpriority: "high" }}
        />
        <div className={`container ${s.heroInner}`}>
          <p className="eyebrow" style={{ color: "var(--c-saffron-500)" }}>
            {user ? `Welcome back, ${user.fullName.split(" ")[0]}` : "Real-time cooking · Global flavors"}
          </p>
          <h1 id="hero-title" className={s.heroTitle}>
            Cook the world, <em>together.</em>
          </h1>
          <p className={s.heroText}>
            Follow iconic dishes step by step with live timers, invite friends into your kitchen, and discover the stories behind
            every recipe.
          </p>
          <form className={s.heroSearch} role="search" onSubmit={search}>
            <label htmlFor="hero-search" className="visually-hidden">
              Search recipes, cuisines or countries
            </label>
            <input id="hero-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try “ramen”, “Mexican” or “Peru”" maxLength={100} />
            <Button type="submit" variant="primary" icon={<LuSearch />}>
              Search
            </Button>
          </form>
          <div className={s.heroStats} aria-live="polite">
            {recipeCount != null && (
              <>
                <div className={s.heroStat}>
                  <strong>{recipeCount}</strong>
                  <span>guided recipes</span>
                </div>
                <div className={s.heroStat}>
                  <strong>{facets.data?.countries.length}</strong>
                  <span>countries</span>
                </div>
                <div className={s.heroStat}>
                  <strong>{facets.data?.regions.length}</strong>
                  <span>culinary regions</span>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <section className={`container ${s.section}`} aria-labelledby="picks-title">
        <div className={s.sectionHeader}>
          <div>
            <p className="eyebrow">{user?.countryName ? `Inspired by ${user.countryName}` : "Featured"}</p>
            <h2 id="picks-title" className={s.sectionTitle}>
              {user ? "Picked for you" : "Start with a classic"}
            </h2>
          </div>
          <ButtonLink to="/recipes" variant="ghost" icon={<LuArrowRight />}>
            Browse all recipes
          </ButtonLink>
        </div>
        {picks.error ? <ErrorState message={picks.error.message} onRetry={picks.reload} /> : <RecipeGrid recipes={picks.data} loading={picks.loading} />}
      </section>

      {facets.data && (
        <section className={`container ${s.section}`} style={{ paddingTop: 0 }} aria-labelledby="regions-title">
          <div className={s.sectionHeader}>
            <h2 id="regions-title" className={s.sectionTitle}>
              Explore by region
            </h2>
          </div>
          <div className={s.chips}>
            {facets.data.regions.map((region) => (
              <Link key={region} to={`/recipes?region=${encodeURIComponent(region)}`} className={s.chip}>
                {region}
              </Link>
            ))}
            <Link to="/explore" className={s.chip}>
              <LuEarth aria-hidden="true" /> Open the Flavor Map
            </Link>
          </div>
        </section>
      )}

      <section className={`container ${s.section}`} aria-labelledby="pillars-title">
        <h2 id="pillars-title" className="visually-hidden">
          What you can do with SynChef
        </h2>
        <div className={s.pillars}>
          <Link to="/recipes" className={s.pillar}>
            <span className={s.pillarIcon} aria-hidden="true">
              <LuTimer />
            </span>
            <h3>Real-time cooking</h3>
            <p>One focused step at a time, with synced timers that survive reloads and follow you from laptop to phone.</p>
            <span className={s.pillarLink}>
              Pick a recipe <LuArrowRight aria-hidden="true" />
            </span>
          </Link>
          <Link to={user ? "/join" : "/register"} className={s.pillar}>
            <span className={s.pillarIcon} aria-hidden="true">
              <LuUsers />
            </span>
            <h3>Cook together</h3>
            <p>Share a six-letter code and friends join your kitchen live — everyone sees the same step and timers.</p>
            <span className={s.pillarLink}>
              {user ? "Join with a code" : "Create a free account"} <LuArrowRight aria-hidden="true" />
            </span>
          </Link>
          <Link to="/explore" className={s.pillar}>
            <span className={s.pillarIcon} aria-hidden="true">
              <LuEarth />
            </span>
            <h3>Global gastronomy</h3>
            <p>Spin the globe, explore cuisines by country, and read the cultural story behind every dish.</p>
            <span className={s.pillarLink}>
              Explore the map <LuArrowRight aria-hidden="true" />
            </span>
          </Link>
        </div>
      </section>

      {!user && (
        <section className={`container ${s.section}`}>
          <div className={s.ctaBand}>
            <div>
              <h2>Your next favourite dish is a few steps away.</h2>
              <p>Save recipes, track what you've cooked and share your own creations with the community.</p>
            </div>
            <ButtonLink to="/register" variant="accent" size="lg">
              Join SynChef — it's free
            </ButtonLink>
          </div>
        </section>
      )}
    </div>
  );
}
