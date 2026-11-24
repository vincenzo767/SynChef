import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { LuUserPlus } from "react-icons/lu";
import { useAppDispatch, useAppSelector } from "@/app/store";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/primitives";
import { authApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/client";
import { WORLD_COUNTRIES } from "@/lib/countries";
import { signedIn } from "./authSlice";
import { GoogleButton } from "./GoogleButton";
import { validateRegistration, type RegistrationErrors as Errors, type RegistrationForm as FormState } from "./validation";
import { AuthVisual } from "./AuthVisual";
import s from "./auth.module.css";

function passwordScore(p: string): number {
  let score = 0;
  if (p.length >= 8) score++;
  if (p.length >= 12) score++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) score++;
  return score;
}

export default function RegisterPage() {
  const dispatch = useAppDispatch();
  const googleEnabled = useAppSelector((st) => Boolean(st.auth.googleClientId));
  const [form, setForm] = useState<FormState>({ fullName: "", username: "", email: "", password: "", confirmPassword: "", countryCode: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const score = useMemo(() => passwordScore(form.password), [form.password]);

  const update = (key: keyof FormState) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validateRegistration(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const country = WORLD_COUNTRIES.find((c) => c.code === form.countryCode);
      const user = await authApi.register({
        email: form.email.trim(),
        username: form.username.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
        fullName: form.fullName.trim(),
        countryCode: form.countryCode,
        countryName: country?.name ?? form.countryCode
      });
      dispatch(signedIn(user));
    } catch (e) {
      const err = toApiError(e);
      setFormError(err.message);
      if (Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors as Errors);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={s.layout}>
      <AuthVisual title="A world of kitchens, one table" text="Cook iconic dishes from 29 culinary traditions, step by step, and invite friends to cook with you live." />
      <div className={s.panel}>
        <form className={s.form} onSubmit={submit} noValidate>
          <div>
            <p className="eyebrow">Create account</p>
            <h1 className={s.title}>Join SynChef</h1>
            <p className={s.subtitle}>Free forever. Takes less than a minute.</p>
          </div>
          {formError && <Alert tone="error">{formError}</Alert>}
          <TextField label="Full name" autoComplete="name" value={form.fullName} onChange={(e) => update("fullName")(e.target.value)} error={errors.fullName} maxLength={200} autoFocus />
          <div className={s.twoCol}>
            <TextField label="Username" autoComplete="username" value={form.username} onChange={(e) => update("username")(e.target.value)} error={errors.username} maxLength={30} />
            <SelectField label="Country" value={form.countryCode} onChange={(e) => update("countryCode")(e.target.value)} error={errors.countryCode} autoComplete="country">
              <option value="">Select…</option>
              {WORLD_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </SelectField>
          </div>
          <TextField label="Email" type="email" autoComplete="email" value={form.email} onChange={(e) => update("email")(e.target.value)} error={errors.email} maxLength={100} />
          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => update("password")(e.target.value)}
            error={errors.password}
            hint="At least 8 characters. Longer is stronger."
            maxLength={128}
          />
          <div className={s.strength} aria-hidden="true">
            {[1, 2, 3, 4].map((i) => (
              <span key={i} data-on={score >= i} />
            ))}
          </div>
          <TextField
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(e) => update("confirmPassword")(e.target.value)}
            error={errors.confirmPassword}
            maxLength={128}
          />
          <Button type="submit" variant="primary" size="lg" block loading={submitting} icon={<LuUserPlus />}>
            Create account
          </Button>
          {googleEnabled && (
            <>
              <div className={s.divider}>or</div>
              <GoogleButton />
            </>
          )}
          <p className={s.switch}>
            Already cooking with us? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
