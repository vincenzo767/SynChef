import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { LuEye, LuEyeOff } from "react-icons/lu";
import { Button } from "./Button";
import s from "./ui.module.css";

interface FieldChrome {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
}

function Chrome({ id, label, hint, error, children }: FieldChrome & { id: string; children: ReactNode }) {
  return (
    <div className={s.field}>
      <label className={s.label} htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? (
        <span id={`${id}-error`} className={s.error} role="alert">
          {error}
        </span>
      ) : (
        hint && (
          <span id={`${id}-hint`} className={s.hint}>
            {hint}
          </span>
        )
      )}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: ReactNode) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

export const TextField = forwardRef<HTMLInputElement, FieldChrome & InputHTMLAttributes<HTMLInputElement>>(function TextField(
  { label, hint, error, id: idProp, className, type, ...rest },
  ref
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [reveal, setReveal] = useState(false);
  const isPassword = type === "password";
  const input = (
    <input
      ref={ref}
      id={id}
      type={isPassword && reveal ? "text" : type}
      className={[s.control, className].filter(Boolean).join(" ")}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(id, error, hint)}
      {...rest}
    />
  );
  return (
    <Chrome id={id} label={label} hint={hint} error={error}>
      {isPassword ? (
        <div className={s.inputWrap}>
          {input}
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            className={s.inputAction}
            aria-label={reveal ? "Hide password" : "Show password"}
            aria-pressed={reveal}
            onClick={() => setReveal((r) => !r)}
            icon={reveal ? <LuEyeOff /> : <LuEye />}
          />
        </div>
      ) : (
        input
      )}
    </Chrome>
  );
});

export const TextArea = forwardRef<HTMLTextAreaElement, FieldChrome & TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(
  { label, hint, error, id: idProp, className, ...rest },
  ref
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <Chrome id={id} label={label} hint={hint} error={error}>
      <textarea
        ref={ref}
        id={id}
        className={[s.control, className].filter(Boolean).join(" ")}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...rest}
      />
    </Chrome>
  );
});

export const SelectField = forwardRef<HTMLSelectElement, FieldChrome & SelectHTMLAttributes<HTMLSelectElement>>(function SelectField(
  { label, hint, error, id: idProp, className, children, ...rest },
  ref
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <Chrome id={id} label={label} hint={hint} error={error}>
      <select
        ref={ref}
        id={id}
        className={[s.control, className].filter(Boolean).join(" ")}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...rest}
      >
        {children}
      </select>
    </Chrome>
  );
});
