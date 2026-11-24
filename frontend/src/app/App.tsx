import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { PublicOnly, RequireAdmin, RequireAuth } from "@/components/layout/Guards";
import { Spinner } from "@/components/ui/primitives";
import { bootstrapSession, sessionExpired } from "@/features/auth/authSlice";
import { onUnauthorized } from "@/lib/api/client";
import { connectRealtime, disconnectRealtime } from "@/lib/realtime";
import { ErrorBoundary } from "./ErrorBoundary";
import { useAppDispatch, useAppSelector } from "./store";
import { useThemeSync } from "./theme";

const HomePage = lazy(() => import("@/features/recipes/HomePage"));
const DiscoverPage = lazy(() => import("@/features/recipes/DiscoverPage"));
const RecipeDetailPage = lazy(() => import("@/features/recipes/RecipeDetailPage"));
const FlavorMapPage = lazy(() => import("@/features/explore/FlavorMapPage"));
const LoginPage = lazy(() => import("@/features/auth/LoginPage"));
const RegisterPage = lazy(() => import("@/features/auth/RegisterPage"));
const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage"));
const CommunityPage = lazy(() => import("@/features/community/CommunityPage"));
const CookingSessionPage = lazy(() => import("@/features/cooking/CookingSessionPage"));
const JoinSessionPage = lazy(() => import("@/features/cooking/JoinSessionPage"));
const ProfilePage = lazy(() => import("@/features/profile/ProfilePage"));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage"));
const AdminLayout = lazy(() => import("@/features/admin/AdminLayout"));
const AdminOverviewPage = lazy(() => import("@/features/admin/AdminOverviewPage"));
const AdminReportsPage = lazy(() => import("@/features/admin/AdminReportsPage"));
const AdminUsersPage = lazy(() => import("@/features/admin/AdminUsersPage"));
const AdminAnalyticsPage = lazy(() => import("@/features/admin/AdminAnalyticsPage"));
const AdminModerationPage = lazy(() => import("@/features/admin/AdminModerationPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

/** Old /recipe/:id and /cooking/:id links (recipe IDs) still land on the recipe page. */
function LegacyRecipeRedirect() {
  const { id } = useParams();
  return <Navigate to={`/recipes/${id ?? ""}`} replace />;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}

export default function App() {
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.auth.status);
  const location = useLocation();
  useThemeSync();

  useEffect(() => {
    void dispatch(bootstrapSession());
    return onUnauthorized(() => dispatch(sessionExpired()));
  }, [dispatch]);

  useEffect(() => {
    if (status === "authenticated") connectRealtime();
    else if (status === "anonymous") disconnectRealtime();
  }, [status]);

  return (
    <MotionConfig reducedMotion="user">
      <ScrollToTop />
      <AppShell>
        <ErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<Spinner label="Loading page" />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/recipes" element={<DiscoverPage />} />
              <Route path="/recipes/:id" element={<RecipeDetailPage />} />
              <Route path="/explore" element={<FlavorMapPage />} />
              <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
              <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />

              <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
              <Route path="/community" element={<RequireAuth><CommunityPage /></RequireAuth>} />
              <Route path="/cook/:sessionId" element={<RequireAuth><CookingSessionPage /></RequireAuth>} />
              <Route path="/join" element={<RequireAuth><JoinSessionPage /></RequireAuth>} />
              <Route path="/join/:code" element={<RequireAuth><JoinSessionPage /></RequireAuth>} />
              <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
              <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />

              <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
                <Route index element={<AdminOverviewPage />} />
                <Route path="reports" element={<AdminReportsPage />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="analytics" element={<AdminAnalyticsPage />} />
                <Route path="moderation" element={<AdminModerationPage />} />
                <Route path="dashboard" element={<Navigate to="/admin" replace />} />
              </Route>

              {/* Links from the previous version of the app */}
              <Route path="/recipe/:id" element={<LegacyRecipeRedirect />} />
              <Route path="/cooking/:id" element={<LegacyRecipeRedirect />} />
              <Route path="/flavor-map" element={<Navigate to="/explore" replace />} />

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </AppShell>
    </MotionConfig>
  );
}
