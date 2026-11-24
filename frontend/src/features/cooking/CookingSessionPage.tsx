import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import {
  LuArrowLeft,
  LuArrowRight,
  LuCheck,
  LuDoorOpen,
  LuLightbulb,
  LuListChecks,
  LuPause,
  LuPlay,
  LuRotateCcw,
  LuShare2,
  LuThermometer,
  LuTimer,
  LuUsers,
  LuWifi,
  LuWifiOff
} from "react-icons/lu";
import { useAppSelector } from "@/app/store";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Avatar, Badge, Card, ErrorState, ProgressRing, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/useToast";
import { cookingApi } from "@/lib/api/endpoints";
import { useConnectionStatus } from "@/lib/realtime";
import { formatClock, formatDuration, formatMinutes, formatRelative } from "@/lib/format";
import type { CookingSession, CookingTimer } from "@/lib/api/types";
import { ShareDialog } from "./ShareDialog";
import { playTimerAlert, remainingSeconds, useCookingSession, useTicker, useWakeLock } from "./useCookingSession";
import s from "./cooking.module.css";

export default function CookingSessionPage() {
  const { sessionId } = useParams();
  const id = Number(sessionId);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const me = useAppSelector((st) => st.auth.user);
  const connection = useConnectionStatus();
  const { session, recipe, error, loading, clockOffset, activity, run, optimisticStep, reload } = useCookingSession(id);
  const [shareOpen, setShareOpen] = useState(params.get("invite") === "1");
  const [confirm, setConfirm] = useState<"leave" | "end" | null>(null);
  const [busy, setBusy] = useState(false);
  const direction = useRef(1);

  const active = session?.status === "ACTIVE";
  const anyRunning = Boolean(session?.timers.some((t) => t.state === "RUNNING"));
  const now = useTicker(anyRunning);
  useWakeLock(active);

  // Alert once when a running timer reaches zero (any participant's timer).
  const alerted = useRef(new Set<string>());
  useEffect(() => {
    session?.timers.forEach((t) => {
      const key = `${t.stepIndex}:${t.endsAt ?? ""}`;
      if (t.state === "RUNNING" && remainingSeconds(t, clockOffset, now) === 0 && !alerted.current.has(key)) {
        alerted.current.add(key);
        playTimerAlert();
        toast.success(`${t.label} is done`, `Step ${t.stepIndex + 1} timer finished.`);
      }
    });
  }, [session?.timers, clockOffset, now, toast]);

  const steps = recipe?.scaledSteps ?? [];
  const index = session?.currentStepIndex ?? 0;
  const step = steps[index];
  const completed = useMemo(() => new Set(session?.completedSteps ?? []), [session?.completedSteps]);
  const timer = session?.timers.find((t) => t.stepIndex === index);
  const isHost = session?.hostUserId === me?.id;

  const command = useCallback(
    async (fn: () => Promise<CookingSession>, failure: string) => {
      const err = await run(fn);
      if (err) toast.error(failure, err.message);
      return err;
    },
    [run, toast]
  );

  const goTo = useCallback(
    (next: number) => {
      if (!session || next < 0 || next >= steps.length || next === session.currentStepIndex) return;
      direction.current = next > session.currentStepIndex ? 1 : -1;
      optimisticStep(next);
      void command(() => cookingApi.goToStep(id, next), "Couldn't change step");
    },
    [session, steps.length, optimisticStep, command, id]
  );

  // Keyboard navigation (ignored while typing in a field or a dialog is open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [role=dialog]")) return;
      if (e.key === "ArrowRight") goTo(index + 1);
      if (e.key === "ArrowLeft") goTo(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, index]);

  const onSwipe = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) < 80 || Math.abs(info.velocity.x) < 200) return;
    goTo(info.offset.x < 0 ? index + 1 : index - 1);
  };

  const toggleDone = () => {
    const done = completed.has(index);
    void command(() => cookingApi.setCompleted(id, index, !done), "Couldn't update the step").then((err) => {
      if (!err && !done && index < steps.length - 1) goTo(index + 1);
    });
  };

  const openShare = async () => {
    setShareOpen(true);
    if (!session?.joinCode) await command(() => cookingApi.share(id), "Couldn't create an invite code");
  };

  const finish = async () => {
    setBusy(true);
    const err = await command(() => cookingApi.complete(id), "Couldn't finish the session");
    setBusy(false);
    if (!err) toast.success("Dish complete!", "Added to your cooking history.");
  };

  const leaveOrEnd = async () => {
    setBusy(true);
    const err = await command(() => (confirm === "end" ? cookingApi.abandon(id) : cookingApi.leave(id)), "Couldn't leave the session");
    setBusy(false);
    setConfirm(null);
    if (!err) navigate("/dashboard");
  };

  if (!Number.isFinite(id)) return <ErrorState title="Session not found" message="This cooking session link is invalid." />;
  if (loading && !session) return <Spinner label="Opening your kitchen" />;
  if (error && !session) {
    return (
      <div className="container page">
        <ErrorState
          title={error.status === 403 ? "You're not part of this session" : error.status === 404 ? "Session not found" : "Couldn't open the session"}
          message={error.status === 403 ? "Ask the host for an invite code to join." : error.message}
          onRetry={error.status >= 500 || error.status === 0 ? () => reload() : undefined}
        />
      </div>
    );
  }
  if (!session || !recipe) return <Spinner label="Opening your kitchen" />;

  const progress = steps.length ? completed.size / steps.length : 0;

  if (session.status !== "ACTIVE") {
    const minutes = session.completedAt ? Math.max(1, Math.round((new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / 60000)) : null;
    return (
      <div className="container page page-enter">
        <div className={s.celebrate}>
          <span className={s.celebrateEmoji} aria-hidden="true">
            {session.status === "COMPLETED" ? "🍽️" : "👋"}
          </span>
          <h2>{session.status === "COMPLETED" ? `${session.recipeName} is served!` : "This session has ended"}</h2>
          <p className="muted">
            {session.status === "COMPLETED"
              ? `Cooked${recipe.originalServings != null ? ` for ${session.servings}` : ""}${minutes ? ` in ${formatMinutes(minutes)}` : ""} with ${session.participants.length} ${session.participants.length === 1 ? "chef" : "chefs"}.`
              : "The host ended this cook-along."}
          </p>
          <div className="row" style={{ justifyContent: "center" }}>
            <ButtonLink to="/dashboard" variant="primary">
              Back to my kitchen
            </ButtonLink>
            <ButtonLink to={`/recipes/${session.recipeId}`} variant="secondary">
              Cook it again
            </ButtonLink>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`container ${s.page} page-enter`}>
      <header className={s.header}>
        <div>
          <p className="eyebrow">Cooking now</p>
          <h1 className={s.title}>{session.recipeName}</h1>
          <div className={s.subtitle}>
            <span>{recipe.originalServings != null ? `Serves ${session.servings}` : `×${session.servings} batch`}</span>
            <span aria-hidden="true">·</span>
            <span>
              {completed.size}/{steps.length} steps done
            </span>
            <Badge tone={connection === "connected" ? "success" : "warning"} icon={connection === "connected" ? <LuWifi aria-hidden="true" /> : <LuWifiOff aria-hidden="true" />}>
              {connection === "connected" ? "Live" : "Reconnecting"}
            </Badge>
          </div>
        </div>
        <div className="row">
          <Button variant="secondary" icon={<LuShare2 />} onClick={() => void openShare()}>
            Invite
          </Button>
          <Button variant="ghost" icon={<LuDoorOpen />} onClick={() => setConfirm(isHost && session.participants.length > 1 ? "end" : "leave")}>
            {isHost && session.participants.length > 1 ? "End" : "Leave"}
          </Button>
        </div>
      </header>

      <div className={s.progressTrack} role="progressbar" aria-label="Recipe progress" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={completed.size}>
        <div className={s.progressBar} style={{ width: `${progress * 100}%` }} />
      </div>

      <div className={s.layout}>
        <section aria-labelledby="current-step">
          <AnimatePresence mode="wait" initial={false} custom={direction.current}>
            <motion.article
              key={index}
              className={s.focus}
              custom={direction.current}
              initial={{ opacity: 0, x: direction.current * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction.current * -40 }}
              transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              onDragEnd={onSwipe}
            >
              <div className={s.stepMeta}>
                <span id="current-step" className={s.stepIndex}>
                  Step {index + 1} of {steps.length}
                </span>
                {completed.has(index) && (
                  <Badge tone="success" icon={<LuCheck aria-hidden="true" />}>
                    Done
                  </Badge>
                )}
              </div>
              <p className={s.instruction}>{step?.instruction}</p>

              {(step?.temperature || step?.tips) && (
                <div className={s.widgets}>
                  {step.temperature && (
                    <div className={`${s.widget} ${s.widgetTemp}`}>
                      <LuThermometer aria-hidden="true" />
                      <div>
                        <span className={s.widgetLabel}>Heat</span>
                        {step.temperature}
                      </div>
                    </div>
                  )}
                  {step.tips && (
                    <div className={`${s.widget} ${s.widgetTip}`}>
                      <LuLightbulb aria-hidden="true" />
                      <div>
                        <span className={s.widgetLabel}>Chef's tip</span>
                        {step.tips}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step?.scaledTimerSeconds ? (
                <TimerWidget
                  timer={timer}
                  label={step.timerLabel ?? `Step ${index + 1}`}
                  duration={step.scaledTimerSeconds}
                  remaining={timer ? remainingSeconds(timer, clockOffset, now) : step.scaledTimerSeconds}
                  onStart={() => void command(() => cookingApi.timer(id, index, "start"), "Couldn't start the timer")}
                  onPause={() => void command(() => cookingApi.timer(id, index, "pause"), "Couldn't pause the timer")}
                  onReset={() => void command(() => cookingApi.timer(id, index, "reset"), "Couldn't reset the timer")}
                />
              ) : null}

              <div className={s.navRow}>
                <Button variant="secondary" icon={<LuArrowLeft />} onClick={() => goTo(index - 1)} disabled={index === 0}>
                  Back
                </Button>
                <div className={s.dots} aria-hidden="true">
                  {steps.map((_, i) => (
                    <button key={i} type="button" tabIndex={-1} className={s.dot} data-done={completed.has(i)} aria-current={i === index ? "step" : undefined} onClick={() => goTo(i)} />
                  ))}
                </div>
                {index === steps.length - 1 && completed.size >= steps.length - 1 ? (
                  <Button variant="accent" icon={<LuCheck />} onClick={() => void finish()} loading={busy}>
                    Finish dish
                  </Button>
                ) : (
                  <Button variant="primary" icon={completed.has(index) ? <LuArrowRight /> : <LuCheck />} onClick={completed.has(index) ? () => goTo(index + 1) : toggleDone}>
                    {completed.has(index) ? "Next step" : "Mark done"}
                  </Button>
                )}
              </div>
            </motion.article>
          </AnimatePresence>
          <p className="muted" style={{ marginTop: "var(--sp-3)", fontSize: "var(--fs-xs)", textAlign: "center" }}>
            Tip: use ← → keys or swipe to move between steps. Your progress is saved automatically.
          </p>
        </section>

        <aside className={s.side} aria-label="Session details">
          <ActiveTimers timers={session.timers} offset={clockOffset} now={now} onJump={goTo} />

          <Card>
            <h2 className={s.panelTitle}>
              <span>
                <LuUsers aria-hidden="true" style={{ display: "inline", verticalAlign: "-3px", marginRight: 6 }} />
                In the kitchen
              </span>
              <Badge>{session.participants.length}</Badge>
            </h2>
            <ul className={s.participants}>
              {session.participants.map((p) => (
                <li key={p.userId} className={s.participant}>
                  <span className={s.presence} data-online={p.online || p.userId === me?.id}>
                    <Avatar name={p.displayName} size={36} />
                  </span>
                  <span style={{ flex: 1 }}>
                    {p.displayName}
                    {p.userId === me?.id && <span className="muted"> (you)</span>}
                  </span>
                  {p.host && <Badge tone="accent">Host</Badge>}
                </li>
              ))}
            </ul>
            {session.participants.length === 1 && (
              <Button variant="ghost" size="sm" block icon={<LuShare2 />} style={{ marginTop: 12 }} onClick={() => void openShare()}>
                Invite someone to cook along
              </Button>
            )}
          </Card>

          <Card>
            <h2 className={s.panelTitle}>
              <span>
                <LuListChecks aria-hidden="true" style={{ display: "inline", verticalAlign: "-3px", marginRight: 6 }} />
                Steps
              </span>
            </h2>
            <ol className={s.stepList}>
              {steps.map((st, i) => (
                <li key={st.stepId}>
                  <button type="button" className={s.stepItem} aria-current={i === index ? "step" : undefined} data-done={completed.has(i)} onClick={() => goTo(i)}>
                    <span className={s.stepItemNum}>{completed.has(i) ? <LuCheck aria-hidden="true" /> : i + 1}</span>
                    <span className={s.stepItemText}>{st.instruction}</span>
                  </button>
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <h2 className={s.panelTitle}>Ingredients</h2>
            <ul className={s.ingredientsMini}>
              {recipe.scaledIngredients.map((ing, i) => (
                <li key={i}>
                  <strong>{ing.displayAmount}</strong>
                  {ing.ingredientName}
                  {ing.preparation ? `, ${ing.preparation}` : ""}
                </li>
              ))}
            </ul>
          </Card>

          {activity.length > 0 && (
            <Card>
              <h2 className={s.panelTitle}>Kitchen activity</h2>
              <ul className={s.activity} aria-live="polite">
                {activity.map((a) => (
                  <li key={a.id}>
                    {a.text} <span style={{ color: "var(--text-subtle)" }}>· {formatRelative(new Date(a.at).toISOString())}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>

      <ShareDialog
        open={shareOpen}
        code={session.joinCode}
        recipeName={session.recipeName}
        onClose={() => {
          setShareOpen(false);
          if (params.get("invite")) setParams({}, { replace: true });
        }}
      />
      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "end" ? "End the session for everyone?" : "Leave this session?"}
        message={
          confirm === "end"
            ? "Everyone in the kitchen will be disconnected. Your progress so far won't count as a finished dish."
            : isHost
              ? "You can start this recipe again any time."
              : "You can rejoin later with the same code while the session is active."
        }
        confirmLabel={confirm === "end" ? "End session" : "Leave"}
        danger={confirm === "end"}
        busy={busy}
        onConfirm={() => void leaveOrEnd()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function TimerWidget({
  timer,
  label,
  duration,
  remaining,
  onStart,
  onPause,
  onReset
}: {
  timer: CookingTimer | undefined;
  label: string;
  duration: number;
  remaining: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
}) {
  const total = timer?.durationSeconds ?? duration;
  const running = timer?.state === "RUNNING" && remaining > 0;
  const done = Boolean(timer) && remaining === 0 && timer?.state !== "PAUSED";
  const state = !timer ? "Ready" : done ? "Done" : running ? "Running" : "Paused";
  return (
    <div className={`${s.timer} ${done ? s.timerDone : ""}`}>
      <ProgressRing value={timer ? 1 - remaining / total : 0} size={96} stroke={8} label={`${label} timer`}>
        <LuTimer aria-hidden="true" style={{ width: 26, height: 26, color: "var(--brand-text)" }} />
      </ProgressRing>
      <div className={s.timerInfo}>
        <div className={s.timerLabel}>{label}</div>
        <div className={s.timerClock} aria-live={done ? "assertive" : "off"}>
          {formatClock(timer ? remaining : duration)}
        </div>
        <div className={s.timerState}>
          {state} · {formatDuration(total)}
        </div>
      </div>
      <div className="row">
        {running ? (
          <Button variant="secondary" icon={<LuPause />} onClick={onPause}>
            Pause
          </Button>
        ) : (
          !done && (
            <Button variant="primary" icon={<LuPlay />} onClick={onStart}>
              {timer?.state === "PAUSED" ? "Resume" : "Start timer"}
            </Button>
          )
        )}
        {timer && (
          <Button variant="ghost" icon={<LuRotateCcw />} onClick={onReset}>
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}

function ActiveTimers({ timers, offset, now, onJump }: { timers: CookingTimer[]; offset: number; now: number; onJump: (i: number) => void }) {
  if (timers.length === 0) return null;
  return (
    <Card>
      <h2 className={s.panelTitle}>
        <span>
          <LuTimer aria-hidden="true" style={{ display: "inline", verticalAlign: "-3px", marginRight: 6 }} />
          Timers
        </span>
      </h2>
      <ul className={s.timerDock}>
        {timers.map((t) => {
          const left = remainingSeconds(t, offset, now);
          return (
            <li key={t.stepIndex}>
              <button type="button" className={s.dockItem} style={{ width: "100%", border: "none" }} onClick={() => onJump(t.stepIndex)}>
                <span>
                  {t.label} <span className="muted">· step {t.stepIndex + 1}</span>
                </span>
                <span className={s.dockClock}>{t.state === "PAUSED" ? `⏸ ${formatClock(left)}` : left === 0 ? "✓ Done" : formatClock(left)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
