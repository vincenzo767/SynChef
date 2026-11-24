import axios, { AxiosError, type AxiosRequestConfig } from "axios";

/**
 * HTTP client.
 *
 * Security model: authentication lives in an HttpOnly cookie set by the server, so this code never
 * sees or stores a credential. State-changing requests carry the CSRF token: axios copies the
 * XSRF-TOKEN cookie into the X-XSRF-TOKEN header for same-origin requests.
 */
export const http = axios.create({
  baseURL: "/api",
  withCredentials: true,
  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "X-XSRF-TOKEN",
  timeout: 20_000,
  headers: { "X-Requested-With": "XMLHttpRequest" }
});

export interface ApiError {
  status: number;
  code: string;
  message: string;
  fieldErrors: Record<string, string>;
}

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

/** Notified when the server rejects the session (expired, revoked or signed out elsewhere). */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

interface RetriableConfig extends AxiosRequestConfig {
  _csrfRetried?: boolean;
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<Partial<ApiError>>) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const code = error.response?.data?.code;

    // The CSRF cookie may be missing (first visit, cleared cookies): fetch it and retry once.
    if (status === 403 && code === "CSRF_INVALID" && config && !config._csrfRetried) {
      config._csrfRetried = true;
      await http.get("/auth/session");
      return http.request(config);
    }

    if (status === 401 && config?.url && !config.url.startsWith("/auth/")) {
      unauthorizedListeners.forEach((listener) => listener());
    }
    return Promise.reject(error);
  }
);

/** Converts any thrown value into a user-presentable {@link ApiError}. Never exposes internals. */
export function toApiError(error: unknown): ApiError {
  if (axios.isCancel(error)) {
    return { status: 0, code: "CANCELLED", message: "Request cancelled", fieldErrors: {} };
  }
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Partial<ApiError> | undefined;
    if (error.response) {
      return {
        status: error.response.status,
        code: data?.code ?? "HTTP_" + error.response.status,
        message: data?.message ?? defaultMessage(error.response.status),
        fieldErrors: data?.fieldErrors ?? {}
      };
    }
    if (error.code === "ECONNABORTED") {
      return { status: 0, code: "TIMEOUT", message: "The server took too long to respond. Please try again.", fieldErrors: {} };
    }
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    return {
      status: 0,
      code: offline ? "OFFLINE" : "NETWORK",
      message: offline ? "You're offline. Check your connection and try again." : "Can't reach SynChef right now. Please try again.",
      fieldErrors: {}
    };
  }
  return { status: 0, code: "UNKNOWN", message: "Something went wrong. Please try again.", fieldErrors: {} };
}

export function isCancelled(error: unknown): boolean {
  return axios.isCancel(error);
}

function defaultMessage(status: number): string {
  if (status === 401) return "Please sign in to continue.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "We couldn't find what you were looking for.";
  if (status === 409) return "That conflicts with a recent change. Please refresh and try again.";
  if (status === 413) return "That file is too large.";
  if (status === 429) return "Too many attempts. Please wait a moment.";
  if (status >= 500) return "Something went wrong on our side. Please try again.";
  return "The request could not be completed.";
}
