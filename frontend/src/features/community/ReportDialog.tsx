import { useState } from "react";
import { LuFlag } from "react-icons/lu";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/primitives";
import { reportApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/client";
import s from "./community.module.css";

/** Report reasons and severity categories carried over from the previous report modal. */
const REASONS = [
  { label: "Contamination risk (non-food item)", category: "Critical" },
  { label: "Inaccurate or harmful measurements", category: "Recipe" },
  { label: "Inaccurate cooking temperature", category: "Recipe" },
  { label: "Intellectual Property infringement", category: "Recipe" },
  { label: "Misleading nutritional information", category: "Medium" },
  { label: "Inappropriate language in description", category: "Recipe" },
  { label: "Spam or repeated content", category: "Recipe" },
  { label: "False or dangerous recipe claims", category: "Medium" }
];

export function ReportDialog({ dishId, dishTitle, onClose }: { dishId: number | null; dishTitle: string; onClose: () => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setSelected(null);
    setDone(false);
    setError(null);
    onClose();
  };

  const submit = async () => {
    const reason = selected != null ? REASONS[selected] : undefined;
    if (!reason || dishId == null) return;
    setSending(true);
    setError(null);
    try {
      await reportApi.create(dishId, reason.category, reason.label);
      setDone(true);
    } catch (e) {
      setError(toApiError(e).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={dishId != null}
      onClose={close}
      busy={sending}
      width={480}
      title={done ? "Thanks for letting us know" : `Report “${dishTitle}”`}
      description={done ? undefined : "Reports are confidential — the dish owner won't see who reported it."}
      footer={
        done ? (
          <Button variant="primary" onClick={close} data-autofocus>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close} disabled={sending}>
              Cancel
            </Button>
            <Button variant="danger" icon={<LuFlag />} disabled={selected == null} loading={sending} onClick={() => void submit()}>
              Submit report
            </Button>
          </>
        )
      }
    >
      {done ? (
        <Alert tone="success">Our moderators will review this dish. You'll be notified if any action is taken.</Alert>
      ) : (
        <fieldset className={s.reasons} style={{ border: "none", padding: 0, margin: 0 }}>
          <legend className="visually-hidden">Reason</legend>
          {error && <Alert tone="error">{error}</Alert>}
          {REASONS.map((r, i) => (
            <label key={r.label} className={s.reason}>
              <input type="radio" name="report-reason" checked={selected === i} onChange={() => setSelected(i)} />
              {r.label}
            </label>
          ))}
        </fieldset>
      )}
    </Modal>
  );
}
