import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { LuLogIn } from "react-icons/lu";
import { useAppDispatch, useAppSelector } from "@/app/store";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/primitives";
import { authApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/client";
import { signedIn } from "./authSlice";
import { GoogleButton } from "./GoogleButton";
import { AuthVisual } from "./AuthVisual";
import s from "./auth.module.css";

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const googleEnabled = useAppSelector((st) => Boolean(st.auth.googleClientId));
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!identifier.trim()) next.identifier = "Enter your email or username";
    if (!password) next.password = "Enter your password";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const user = await authApi.login(identifier.trim(), password);
      dispatch(signedIn(user)); // PublicOnly guard then redirects to the intended page
    } catch (e) {
      setFormError(toApiError(e).message);
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={s.layout}>
      <AuthVisual title="Welcome back to your kitchen" text="Pick up a cook right where you left off — your timers and progress are saved on every device." />
      <div className={s.panel}>
        <form className={s.form} onSubmit={submit} noValidate>
          <div>
            <p className="eyebrow">Sign in</p>
            <h1 className={s.title}>Good to see you, Chef</h1>
            <p className={s.subtitle}>Sign in to save recipes, cook along with friends and share your dishes.</p>
          </div>
          {formError && <Alert tone="error">{formError}</Alert>}
          <TextField
            label="Email or username"
            name="username"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            error={errors.identifier}
            maxLength={100}
            autoFocus
          />
          <TextField
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            maxLength={128}
          />
          <Button type="submit" variant="primary" size="lg" block loading={submitting} icon={<LuLogIn />}>
            Sign in
          </Button>
          {googleEnabled && (
            <>
              <div className={s.divider}>or</div>
              <GoogleButton />
            </>
          )}
          <p className={s.switch}>
            New to SynChef? <Link to="/register">Create a free account</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
