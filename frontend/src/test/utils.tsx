import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { createStore } from "@/app/store";
import { signedIn } from "@/features/auth/authSlice";
import { ToastProvider } from "@/components/ui/Toast";
import type { UserProfile } from "@/lib/api/types";

export const testUser: UserProfile = {
  id: 7,
  email: "chef@example.com",
  username: "chef",
  fullName: "Ana Cruz",
  profileImageUrl: null,
  emailVerified: true,
  countryCode: "PH",
  countryName: "Philippines",
  favoriteRecipeIds: [],
  createdAt: "2026-01-01T00:00:00",
  role: "USER",
  themePreference: "SYSTEM",
  notifyOnComments: true,
  hasPassword: true
};

export function renderApp(ui: ReactElement, { route = "/", user, anonymous = false, extraRoutes = [] }: { route?: string; user?: UserProfile; anonymous?: boolean; extraRoutes?: { path: string; element: ReactElement }[] } = {}) {
  const store = createStore();
  if (user) store.dispatch(signedIn(user));
  else if (anonymous) store.dispatch({ type: "auth/bootstrap/fulfilled", payload: { authenticated: false, user: null, googleEnabled: false, googleClientId: null } });
  const result = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ToastProvider>
          <Routes>
            <Route path={route.split("?")[0]} element={ui} />
            {extraRoutes.map((r) => (
              <Route key={r.path} path={r.path} element={r.element} />
            ))}
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    </Provider>
  );
  return { store, ...result };
}
