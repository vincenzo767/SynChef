import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import authReducer from "@/features/auth/authSlice";

export function createStore() {
  return configureStore({ reducer: { auth: authReducer } });
}

export const store = createStore();

export type AppStore = ReturnType<typeof createStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

export const selectUser = (s: RootState) => s.auth.user;
export const selectStatus = (s: RootState) => s.auth.status;
export const selectIsAdmin = (s: RootState) => s.auth.user?.role === "ADMIN";
