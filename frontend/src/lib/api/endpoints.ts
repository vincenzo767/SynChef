import { http } from "./client";
import type {
  AdminStats,
  AdminUser,
  Analytics,
  AppNotification,
  Comment,
  CookingSession,
  Country,
  Dish,
  DishInput,
  ModerationComment,
  Page,
  RecipeDetail,
  RecipeFacets,
  RecipeSummary,
  Report,
  Role,
  ScaledRecipe,
  SessionInfo,
  SessionResponse,
  ThemePreference,
  UserProfile,
  UserStats
} from "./types";

type Signal = { signal?: AbortSignal };
const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const authApi = {
  session: (o: Signal = {}) => data<SessionResponse>(http.get("/auth/session", o)),
  login: (emailOrUsername: string, password: string) =>
    data<UserProfile>(http.post("/auth/login", { emailOrUsername, password })),
  register: (body: {
    email: string;
    username: string;
    password: string;
    confirmPassword: string;
    fullName: string;
    countryCode: string;
    countryName: string;
  }) => data<UserProfile>(http.post("/auth/register", body)),
  google: (idToken: string) => data<UserProfile>(http.post("/auth/google", { idToken })),
  logout: () => http.post("/auth/logout")
};

export interface RecipeQuery {
  query?: string;
  region?: string;
  country?: string;
  difficulty?: string;
  maxMinutes?: number;
  page?: number;
  size?: number;
}

export const recipeApi = {
  search: (params: RecipeQuery, o: Signal = {}) => data<Page<RecipeSummary>>(http.get("/recipes", { params, ...o })),
  facets: (o: Signal = {}) => data<RecipeFacets>(http.get("/recipes/facets", o)),
  recommendations: (limit = 6, countryCode?: string, o: Signal = {}) =>
    data<RecipeSummary[]>(http.get("/recipes/recommendations", { params: { limit, countryCode }, ...o })),
  detail: (id: number, o: Signal = {}) => data<RecipeDetail>(http.get(`/recipes/${id}`, o)),
  scaled: (id: number, servings: number, o: Signal = {}) =>
    data<ScaledRecipe>(http.get(`/recipes/${id}/scale`, { params: { servings }, ...o }))
};

export const countryApi = {
  all: (o: Signal = {}) => data<Country[]>(http.get("/countries", o)),
  recipes: (code: string, o: Signal = {}) => data<RecipeSummary[]>(http.get(`/countries/code/${encodeURIComponent(code)}/recipes`, o))
};

export const userApi = {
  me: (o: Signal = {}) => data<UserProfile>(http.get("/users/me", o)),
  update: (fullName: string, countryCode: string, countryName: string) =>
    data<UserProfile>(http.put("/users/me", { fullName, countryCode, countryName })),
  preferences: (prefs: { themePreference?: ThemePreference; notifyOnComments?: boolean }) =>
    data<UserProfile>(http.put("/users/me/preferences", prefs)),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return data<UserProfile>(http.post("/users/me/profile-image", form));
  },
  stats: (o: Signal = {}) => data<UserStats>(http.get("/users/me/stats", o)),
  favoriteRecipes: (o: Signal = {}) => data<RecipeSummary[]>(http.get("/users/me/favorites/recipes", o)),
  addFavorite: (id: number) => data<number[]>(http.post(`/users/me/favorites/${id}`)),
  removeFavorite: (id: number) => data<number[]>(http.delete(`/users/me/favorites/${id}`)),
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) =>
    http.post("/users/me/password", { currentPassword, newPassword, confirmPassword }),
  sessions: (o: Signal = {}) => data<SessionInfo[]>(http.get("/users/me/sessions", o)),
  revokeOtherSessions: () => data<{ revoked: number }>(http.post("/users/me/sessions/revoke-others")),
  deleteAccount: (password: string, confirmation: string) =>
    http.delete("/users/me", { data: { password, confirmation } }),
  myReports: (o: Signal = {}) => data<Report[]>(http.get("/users/me/reports", o))
};

export const notificationApi = {
  list: (o: Signal = {}) => data<AppNotification[]>(http.get("/users/me/notifications", o)),
  markRead: (id: number) => data<AppNotification>(http.patch(`/users/me/notifications/${id}/read`)),
  markAllRead: () => http.post("/users/me/notifications/read-all")
};

export const cookingApi = {
  start: (recipeId: number, servings: number) => data<CookingSession>(http.post("/cooking-sessions", { recipeId, servings })),
  get: (id: number, o: Signal = {}) => data<CookingSession>(http.get(`/cooking-sessions/${id}`, o)),
  active: (o: Signal = {}) => data<CookingSession[]>(http.get("/cooking-sessions/active", o)),
  history: (o: Signal = {}) => data<CookingSession[]>(http.get("/cooking-sessions/history", o)),
  join: (code: string) => data<CookingSession>(http.post("/cooking-sessions/join", { code })),
  goToStep: (id: number, index: number) => data<CookingSession>(http.post(`/cooking-sessions/${id}/step`, { index })),
  setCompleted: (id: number, index: number, completed: boolean) =>
    data<CookingSession>(http.post(`/cooking-sessions/${id}/steps/${index}/completion`, { completed })),
  timer: (id: number, stepIndex: number, action: "start" | "pause" | "reset") =>
    data<CookingSession>(http.post(`/cooking-sessions/${id}/timers/${stepIndex}/${action}`)),
  share: (id: number) => data<CookingSession>(http.post(`/cooking-sessions/${id}/share`)),
  leave: (id: number) => data<CookingSession>(http.post(`/cooking-sessions/${id}/leave`)),
  complete: (id: number) => data<CookingSession>(http.post(`/cooking-sessions/${id}/complete`)),
  abandon: (id: number) => data<CookingSession>(http.post(`/cooking-sessions/${id}/abandon`))
};

export const dishApi = {
  feed: (country?: string, o: Signal = {}) => data<Dish[]>(http.get("/syncook/public", { params: { country }, ...o })),
  mine: (o: Signal = {}) => data<Dish[]>(http.get("/syncook/mine", o)),
  get: (id: number, o: Signal = {}) => data<Dish>(http.get(`/syncook/${id}`, o)),
  create: (body: DishInput) => data<Dish>(http.post("/syncook", body)),
  update: (id: number, body: DishInput) => data<Dish>(http.put(`/syncook/${id}`, body)),
  remove: (id: number) => http.delete(`/syncook/${id}`),
  comment: (id: number, content: string) => data<Comment>(http.post(`/syncook/${id}/comments`, { content })),
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return data<{ url: string }>(http.post("/syncook/images", form));
  }
};

export const reportApi = {
  create: (recipeId: number, category: string, reason: string) => data<Report>(http.post("/reports", { recipeId, category, reason })),
  appeal: (id: number, message: string) => data<Report>(http.post(`/reports/${id}/appeal`, { message }))
};

export const adminApi = {
  stats: (o: Signal = {}) => data<AdminStats>(http.get("/admin/stats", o)),
  analytics: (o: Signal = {}) => data<Analytics>(http.get("/admin/analytics", o)),
  users: (o: Signal = {}) => data<AdminUser[]>(http.get("/admin/users", o)),
  toggleStatus: (id: number) => data<AdminUser>(http.patch(`/admin/users/${id}/status`)),
  setRole: (id: number, role: Role) => data<AdminUser>(http.patch(`/admin/users/${id}/role`, { role })),
  deleteUser: (id: number) => http.delete(`/admin/users/${id}`),
  comments: (o: Signal = {}) => data<ModerationComment[]>(http.get("/admin/comments", o)),
  deleteComment: (id: number) => http.delete(`/admin/comments/${id}`),
  reports: (o: Signal = {}) => data<Report[]>(http.get("/admin/reports", o)),
  fileNotice: (id: number) => data<Report>(http.post(`/admin/reports/${id}/file-notice`)),
  resolve: (id: number) => data<Report>(http.post(`/admin/reports/${id}/resolve`)),
  dismiss: (id: number) => data<Report>(http.post(`/admin/reports/${id}/dismiss`))
};
