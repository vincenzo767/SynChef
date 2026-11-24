import s from "./auth.module.css";

export function AuthVisual({ title, text }: { title: string; text: string }) {
  return (
    <aside className={s.visual} aria-hidden="true">
      <img src="/images/hero-kitchen-960.jpg" srcSet="/images/hero-kitchen-960.jpg 960w, /images/hero-kitchen-1920.jpg 1920w" sizes="50vw" alt="" />
      <div className={s.visualCopy}>
        <p className="eyebrow" style={{ color: "var(--c-saffron-500)" }}>
          SynChef
        </p>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </aside>
  );
}
