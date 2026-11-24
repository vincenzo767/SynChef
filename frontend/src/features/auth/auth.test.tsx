import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { authApi } from "@/lib/api/endpoints";
import { renderApp, testUser } from "@/test/utils";
import { PublicOnly, RequireAdmin, RequireAuth } from "@/components/layout/Guards";
import reducer, { sessionExpired, signedIn } from "./authSlice";
import LoginPage from "./LoginPage";
import { validateRegistration } from "./validation";

describe("registration validation", () => {
  const valid = { fullName: "Ana", username: "ana_c", email: "ana@example.com", password: "longenough1", confirmPassword: "longenough1", countryCode: "PH" };
  it("accepts a valid form", () => {
    expect(validateRegistration(valid)).toEqual({});
  });
  it("mirrors the server rules", () => {
    const errors = validateRegistration({ ...valid, username: "a b", email: "nope", password: "short", confirmPassword: "x", countryCode: "" });
    expect(Object.keys(errors).sort()).toEqual(["confirmPassword", "countryCode", "email", "password", "username"]);
  });
});

describe("auth state", () => {
  it("expires the session in memory only", () => {
    let state = reducer(undefined, signedIn(testUser));
    expect(state.status).toBe("authenticated");
    state = reducer(state, sessionExpired());
    expect(state).toMatchObject({ status: "anonymous", user: null, sessionExpired: true });
  });
});

describe("login", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it("validates before calling the API", async () => {
    const login = vi.spyOn(authApi, "login");
    renderApp(<LoginPage />, { route: "/login", anonymous: true });
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter your email or username")).toBeInTheDocument();
    expect(screen.getByText("Enter your password")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("signs in without writing anything to browser storage", async () => {
    vi.spyOn(authApi, "login").mockResolvedValue(testUser);
    const { store } = renderApp(<LoginPage />, { route: "/login", anonymous: true });
    await userEvent.type(screen.getByLabelText("Email or username"), "chef@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correct horse");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(store.getState().auth.status).toBe("authenticated"));
    // Credentials live in an HttpOnly cookie; nothing about the session may reach Web Storage.
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    const auth = store.getState().auth;
    expect(auth).not.toHaveProperty("token");
    expect(auth.user).not.toHaveProperty("password");
  });

  it("shows the server's generic error and clears the password", async () => {
    vi.spyOn(authApi, "login").mockRejectedValue(
      Object.assign(new Error("401"), { isAxiosError: true, response: { status: 401, data: { code: "UNAUTHORIZED", message: "Incorrect email/username or password" } } })
    );
    renderApp(<LoginPage />, { route: "/login", anonymous: true });
    await userEvent.type(screen.getByLabelText("Email or username"), "chef");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-pass");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Incorrect email/username or password")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });
});

describe("route guards", () => {
  it("redirects anonymous visitors to sign in", () => {
    renderApp(<RequireAuth><p>secret kitchen</p></RequireAuth>, { route: "/dashboard", anonymous: true, extraRoutes: [{ path: "/login", element: <p>login page</p> }] });
    expect(screen.getByText("login page")).toBeInTheDocument();
    expect(screen.queryByText("secret kitchen")).not.toBeInTheDocument();
  });

  it("keeps non-admins out of the admin console", () => {
    renderApp(<RequireAdmin><p>admin console</p></RequireAdmin>, { route: "/admin", user: testUser, extraRoutes: [{ path: "/dashboard", element: <p>dashboard</p> }] });
    expect(screen.getByText("dashboard")).toBeInTheDocument();
  });

  it("lets admins in and sends signed-in users away from login", () => {
    renderApp(<RequireAdmin><p>admin console</p></RequireAdmin>, { route: "/admin", user: { ...testUser, role: "ADMIN" } });
    expect(screen.getByText("admin console")).toBeInTheDocument();
    renderApp(<PublicOnly><p>login form</p></PublicOnly>, { route: "/login", user: testUser, extraRoutes: [{ path: "/dashboard", element: <p>my kitchen</p> }] });
    expect(screen.getByText("my kitchen")).toBeInTheDocument();
  });
});
