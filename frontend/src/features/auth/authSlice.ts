import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { authApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/client";
import type { UserProfile } from "@/lib/api/types";

/**
 * Authentication state lives only in memory. The credential itself is an HttpOnly cookie that
 * JavaScript cannot read; on page load the SPA asks the server who is signed in.
 * Nothing here is ever written to localStorage or sessionStorage.
 */
export type AuthStatus = "unknown" | "authenticated" | "anonymous";

export interface AuthState {
  status: AuthStatus;
  user: UserProfile | null;
  googleClientId: string | null;
  sessionExpired: boolean;
}

const initialState: AuthState = {
  status: "unknown",
  user: null,
  googleClientId: null,
  sessionExpired: false
};

export const bootstrapSession = createAsyncThunk("auth/bootstrap", async (_, { rejectWithValue }) => {
  try {
    return await authApi.session();
  } catch (error) {
    return rejectWithValue(toApiError(error));
  }
});

export const logout = createAsyncThunk("auth/logout", async () => {
  try {
    await authApi.logout();
  } catch {
    // Even if the network call fails, the local session state is cleared.
  }
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    signedIn(state, action: PayloadAction<UserProfile>) {
      state.status = "authenticated";
      state.user = action.payload;
      state.sessionExpired = false;
    },
    profileUpdated(state, action: PayloadAction<UserProfile>) {
      if (state.user && state.user.id === action.payload.id) state.user = action.payload;
    },
    favoritesChanged(state, action: PayloadAction<number[]>) {
      if (state.user) state.user.favoriteRecipeIds = action.payload;
    },
    sessionExpired(state) {
      if (state.status === "authenticated") {
        state.status = "anonymous";
        state.user = null;
        state.sessionExpired = true;
      }
    },
    acknowledgeExpiry(state) {
      state.sessionExpired = false;
    },
    signedOutLocally(state) {
      state.status = "anonymous";
      state.user = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(bootstrapSession.fulfilled, (state, action) => {
        state.googleClientId = action.payload.googleEnabled ? action.payload.googleClientId : null;
        state.user = action.payload.user;
        state.status = action.payload.authenticated && action.payload.user ? "authenticated" : "anonymous";
      })
      .addCase(bootstrapSession.rejected, (state) => {
        state.status = "anonymous";
        state.user = null;
      })
      .addCase(logout.fulfilled, (state) => {
        state.status = "anonymous";
        state.user = null;
        state.sessionExpired = false;
      });
  }
});

export const { signedIn, profileUpdated, favoritesChanged, sessionExpired, acknowledgeExpiry, signedOutLocally } =
  authSlice.actions;
export default authSlice.reducer;
