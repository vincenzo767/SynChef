import { useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/app/store";
import { authApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/client";
import { Alert } from "@/components/ui/primitives";
import { signedIn } from "./authSlice";
import s from "./auth.module.css";

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";
let scriptPromise: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error("Google script failed to load"));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

/**
 * Google Identity Services button. The returned ID token is sent once to the backend, which
 * verifies it and sets the session cookie; it is not stored in the browser.
 */
export function GoogleButton({ onSignedIn }: { onSignedIn?: () => void }) {
  const clientId = useAppSelector((st) => st.auth.googleClientId);
  const dispatch = useAppDispatch();
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const onSignedInRef = useRef(onSignedIn);
  onSignedInRef.current = onSignedIn;

  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !ref.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async ({ credential }) => {
            setError(null);
            try {
              const user = await authApi.google(credential);
              dispatch(signedIn(user));
              onSignedInRef.current?.();
            } catch (e) {
              setError(toApiError(e).message);
            }
          }
        });
        window.google.accounts.id.renderButton(ref.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: Math.min(ref.current.offsetWidth || 380, 400)
        });
      })
      .catch(() => {
        if (!cancelled) setError("Google sign-in is unavailable right now. You can still use your email.");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, dispatch]);

  if (!clientId) return null;
  return (
    <>
      <div ref={ref} className={s.google} />
      {error && <Alert tone="error">{error}</Alert>}
    </>
  );
}
