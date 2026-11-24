export interface RegistrationForm {
  fullName: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  countryCode: string;
}

export type RegistrationErrors = Partial<Record<keyof RegistrationForm, string>>;

/** Mirrors the server-side rules (AuthDtos.RegisterRequest) for instant feedback. */
export function validateRegistration(f: RegistrationForm): RegistrationErrors {
  const e: RegistrationErrors = {};
  if (!f.fullName.trim()) e.fullName = "Enter your name";
  if (!/^[A-Za-z0-9._-]{3,30}$/.test(f.username.trim())) e.username = "3–30 letters, numbers, dot, dash or underscore";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = "Enter a valid email address";
  if (f.password.length < 8) e.password = "Use at least 8 characters";
  else if (f.password.length > 128) e.password = "Use 128 characters or fewer";
  if (f.confirmPassword !== f.password) e.confirmPassword = "Passwords don't match";
  if (!f.countryCode) e.countryCode = "Choose your country — we use it for recommendations";
  return e;
}
