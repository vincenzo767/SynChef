import { afterEach, describe, expect, it, vi } from "vitest";
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { http, onUnauthorized, toApiError } from "./client";

function errorResponse(status: number, data: unknown, config: InternalAxiosRequestConfig) {
  return new AxiosError("fail", "ERR", config, undefined, {
    status,
    statusText: "",
    headers: {},
    config,
    data
  });
}

describe("api client", () => {
  const originalAdapter = http.defaults.adapter;
  afterEach(() => {
    http.defaults.adapter = originalAdapter;
  });

  it("is configured for cookie sessions with CSRF double-submit", () => {
    expect(http.defaults.withCredentials).toBe(true);
    expect(http.defaults.xsrfCookieName).toBe("XSRF-TOKEN");
    expect(http.defaults.xsrfHeaderName).toBe("X-XSRF-TOKEN");
    expect(http.defaults.headers.common?.Authorization).toBeUndefined();
  });

  it("refreshes the CSRF token once and retries", async () => {
    const calls: string[] = [];
    http.defaults.adapter = async (config) => {
      calls.push(`${config.method} ${config.url}`);
      if (config.url === "/auth/session") return { data: {}, status: 200, statusText: "OK", headers: {}, config };
      if (calls.filter((c) => c === "post /things").length === 1) {
        throw errorResponse(403, { code: "CSRF_INVALID" }, config);
      }
      return { data: { ok: true }, status: 200, statusText: "OK", headers: {}, config };
    };
    const res = await http.post("/things", {});
    expect(res.data).toEqual({ ok: true });
    expect(calls).toEqual(["post /things", "get /auth/session", "post /things"]);
  });

  it("notifies listeners when the session is rejected (but not for auth endpoints)", async () => {
    const listener = vi.fn();
    const off = onUnauthorized(listener);
    http.defaults.adapter = async (config) => {
      throw errorResponse(401, { code: "UNAUTHORIZED", message: "Please sign in" }, config);
    };
    await expect(http.get("/users/me")).rejects.toBeTruthy();
    await expect(http.post("/auth/login", {})).rejects.toBeTruthy();
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });

  it("maps errors to safe user-facing messages", () => {
    const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
    const api = toApiError(errorResponse(400, { code: "VALIDATION_FAILED", message: "Bad", fieldErrors: { email: "Invalid" } }, config));
    expect(api).toMatchObject({ status: 400, code: "VALIDATION_FAILED", message: "Bad", fieldErrors: { email: "Invalid" } });

    const server = toApiError(errorResponse(500, "<html>stack trace</html>", config));
    expect(server.message).toBe("Something went wrong on our side. Please try again.");
    expect(server.message).not.toContain("stack");

    const network = toApiError(new AxiosError("Network Error", "ERR_NETWORK", config));
    expect(network.code === "NETWORK" || network.code === "OFFLINE").toBe(true);
    expect(toApiError(new Error("boom")).message).toBe("Something went wrong. Please try again.");
  });
});
