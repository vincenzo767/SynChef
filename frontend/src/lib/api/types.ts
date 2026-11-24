/** Types mirroring the Spring Boot DTOs (see backend dto package). */

export type Role = "USER" | "ADMIN";
export type ThemePreference = "LIGHT" | "DARK" | "SYSTEM";
export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export interface UserProfile {
  id: number;
  email: string;
  username: string;
  fullName: string;
  profileImageUrl: string | null;
  emailVerified: boolean;
  countryCode: string | null;
  countryName: string | null;
  favoriteRecipeIds: number[];
  createdAt: string | null;
  role: Role;
  themePreference: ThemePreference;
  notifyOnComments: boolean;
  hasPassword: boolean;
}

export interface SessionResponse {
  authenticated: boolean;
  user: UserProfile | null;
  googleEnabled: boolean;
  googleClientId: string | null;
}

export interface UserStats {
  savedRecipes: number;
  countriesExplored: number;
  recipesCooked: number;
  totalCookingMinutes: number;
  activeSessions: number;
  sharedDishes: number;
}

export interface SessionInfo {
  id: number;
  createdAt: string;
  lastSeenAt: string;
  userAgent: string | null;
  current: boolean;
}

export interface RecipeSummary {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  cuisine: string | null;
  region: string | null;
  countryCode: string;
  countryName: string;
  flagEmoji: string | null;
  /** null when the source does not publish a total time. */
  totalTimeMinutes: number | null;
  difficulty: Difficulty | string | null;
  /** null when the source gives no yield: scaling then works in batches (×1, ×2 …). */
  defaultServings: number | null;
  stepCount: number;
  timerCount: number;
}

export interface IngredientLine {
  id: number;
  name: string;
  amountText: string;
  quantity: number | null;
  unit: string;
  preparation: string | null;
  optional: boolean;
  notes: string | null;
}

export interface StepLine {
  id: number;
  orderIndex: number;
  instruction: string;
  timerSeconds: number | null;
  timerLabel: string | null;
  tips: string | null;
  temperature: string | null;
  parallel: boolean;
  parallelGroup: number | null;
}

export interface RecipeDetail {
  summary: RecipeSummary;
  culturalContext: string | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  categories: { id: number; name: string; icon: string | null; color: string | null }[];
  ingredients: IngredientLine[];
  steps: StepLine[];
  sourceUrl: string | null;
  imageSourceUrl: string | null;
  videoUrl: string | null;
}

export interface ScaledIngredient {
  ingredientId: number;
  ingredientName: string;
  originalQuantity: number | null;
  scaledQuantity: number | null;
  unit: string;
  displayAmount: string;
  preparation: string | null;
  isOptional: boolean;
  notes: string | null;
}

export interface ScaledStep {
  stepId: number;
  orderIndex: number;
  instruction: string;
  hasTimer: boolean;
  originalTimerSeconds: number | null;
  scaledTimerSeconds: number | null;
  timerLabel: string | null;
  isParallel: boolean;
  parallelGroup: number | null;
  tips: string | null;
  temperature: string | null;
}

export interface ScaledRecipe {
  recipeId: number;
  recipeName: string;
  originalServings: number | null;
  requestedServings: number;
  scalingFactor: number;
  scaledIngredients: ScaledIngredient[];
  scaledSteps: ScaledStep[];
  adjustedTotalTime: number | null;
}

export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface CountryOption {
  code: string;
  name: string;
  flagEmoji: string | null;
  recipeCount: number;
}

export interface RecipeFacets {
  regions: string[];
  countries: CountryOption[];
  difficulties: string[];
}

export interface Country {
  id: number;
  code: string;
  name: string;
  continent: string;
  flagEmoji: string | null;
  latitude: number;
  longitude: number;
  description: string | null;
  recipeCount: number;
}

export type TimerState = "RUNNING" | "PAUSED" | "DONE";

export interface CookingTimer {
  stepIndex: number;
  label: string;
  durationSeconds: number;
  state: TimerState;
  endsAt: string | null;
  remainingSeconds: number | null;
}

export interface Participant {
  userId: number;
  displayName: string;
  joinedAt: string;
  host: boolean;
  online: boolean;
}

export type CookingStatus = "ACTIVE" | "COMPLETED" | "ABANDONED";

export interface CookingSession {
  id: number;
  recipeId: number;
  recipeName: string;
  recipeImageUrl: string | null;
  servings: number;
  currentStepIndex: number;
  totalSteps: number;
  completedSteps: number[];
  timers: CookingTimer[];
  participants: Participant[];
  status: CookingStatus;
  joinCode?: string | null;
  hostUserId: number;
  startedAt: string;
  updatedAt: string;
  completedAt?: string | null;
  version: number;
  serverTime: string;
  lastAction?: string | null;
  recipe?: ScaledRecipe;
}

export interface Comment {
  id: number;
  authorId: number;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface Dish {
  id: number;
  title: string;
  country: string;
  ingredients: string[];
  procedures: string[];
  imageUrl: string | null;
  privacy: "PUBLIC" | "PRIVATE";
  ownerId: number;
  ownerName: string;
  canEdit: boolean;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
  comments: Comment[];
}

export interface DishInput {
  title: string;
  country: string;
  ingredients: string[];
  procedures: string[];
  imageUrl: string | null;
  privacy: "PUBLIC" | "PRIVATE";
}

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  senderId: number | null;
  senderName: string | null;
  referenceRecipeId: number | null;
  isRead: boolean;
  isSystem: boolean;
  createdAt: string;
}

export type ReportStatus = "PENDING" | "FILED" | "APPEALED" | "RESOLVED" | "DISMISSED";

export interface Report {
  id: number;
  reporterId: number | null;
  reporterName: string | null;
  recipeId: number;
  recipeTitle: string;
  recipeOwnerId: number | null;
  recipeOwnerName: string | null;
  category: string;
  reason: string;
  status: ReportStatus;
  reportDate: string;
  appealMessage: string | null;
  resolvedAt: string | null;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  totalSynCookRecipes: number;
  publicRecipes: number;
  pendingReports: number;
  totalReports: number;
  totalComments: number;
}

export interface TrendPoint {
  date: string;
  count: number;
}

export interface Analytics {
  overview: AdminStats;
  platformRecipes: number;
  userRegistrationsLast30Days: TrendPoint[];
  reportsLast30Days: TrendPoint[];
  cookingSessionsLast30Days: TrendPoint[];
}

export interface AdminUser {
  id: number;
  email: string;
  username: string;
  fullName: string;
  role: Role;
  active: boolean;
  countryCode: string | null;
  countryName: string | null;
  profileImageUrl: string | null;
  createdAt: string | null;
}

export interface ModerationComment {
  id: number;
  recipeId: number;
  recipeTitle: string;
  authorId: number;
  authorName: string;
  content: string;
  createdAt: string;
}
