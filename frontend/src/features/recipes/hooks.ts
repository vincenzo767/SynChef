import { useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/app/store";
import { favoritesChanged } from "@/features/auth/authSlice";
import { useToast } from "@/components/ui/useToast";
import { cookingApi, userApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/client";

/** Signed-out visitors are sent to sign in and brought back afterwards. */
export function useRequireSignIn() {
  const signedIn = useAppSelector((s) => s.auth.status === "authenticated");
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(() => {
    if (signedIn) return true;
    navigate("/login", { state: { from: location.pathname + location.search } });
    return false;
  }, [signedIn, navigate, location]);
}

/** Optimistic favorite toggle backed by the server (rolled back if the request fails). */
export function useFavorite(recipeId: number) {
  const ids = useAppSelector((s) => s.auth.user?.favoriteRecipeIds);
  const dispatch = useAppDispatch();
  const toast = useToast();
  const requireSignIn = useRequireSignIn();
  const [pending, setPending] = useState(false);
  const isFavorite = Boolean(ids?.includes(recipeId));

  const toggle = useCallback(async () => {
    if (!requireSignIn() || pending || !ids) return;
    const previous = ids;
    const optimistic = isFavorite ? ids.filter((id) => id !== recipeId) : [...ids, recipeId];
    dispatch(favoritesChanged(optimistic));
    setPending(true);
    try {
      const updated = isFavorite ? await userApi.removeFavorite(recipeId) : await userApi.addFavorite(recipeId);
      dispatch(favoritesChanged(updated));
      if (!isFavorite) toast.success("Saved to your kitchen");
    } catch (e) {
      dispatch(favoritesChanged(previous));
      toast.error("Couldn't update favorites", toApiError(e).message);
    } finally {
      setPending(false);
    }
  }, [requireSignIn, pending, ids, isFavorite, recipeId, dispatch, toast]);

  return { isFavorite, toggle, pending };
}

/** Starts (or resumes) a server-side cooking session and opens it. */
export function useStartCooking() {
  const navigate = useNavigate();
  const toast = useToast();
  const requireSignIn = useRequireSignIn();
  const [starting, setStarting] = useState(false);

  const start = useCallback(
    async (recipeId: number, servings: number, options: { invite?: boolean } = {}) => {
      if (!requireSignIn()) return;
      setStarting(true);
      try {
        let session = await cookingApi.start(recipeId, servings);
        if (options.invite) session = await cookingApi.share(session.id);
        navigate(`/cook/${session.id}${options.invite ? "?invite=1" : ""}`);
      } catch (e) {
        toast.error("Couldn't start cooking", toApiError(e).message);
      } finally {
        setStarting(false);
      }
    },
    [requireSignIn, navigate, toast]
  );

  return { start, starting };
}
