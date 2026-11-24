import { useState } from "react";
import { LuCheck, LuCopy, LuShare2 } from "react-icons/lu";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/primitives";
import s from "./cooking.module.css";

export function ShareDialog({ open, code, recipeName, onClose }: { open: boolean; code: string | null | undefined; recipeName: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = code ? `${window.location.origin}/join/${code}` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: `Cook ${recipeName} with me on SynChef`, text: `Join my kitchen with code ${code}`, url: link });
    } catch {
      // User dismissed the share sheet.
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite friends to cook along"
      description="Anyone signed in to SynChef can join with this code. They'll see the same step and timers as you, live."
      width={480}
      footer={
        <>
          {"share" in navigator && (
            <Button variant="secondary" icon={<LuShare2 />} onClick={() => void share()}>
              Share…
            </Button>
          )}
          <Button variant="primary" icon={copied ? <LuCheck /> : <LuCopy />} onClick={() => void copy()} data-autofocus>
            {copied ? "Link copied" : "Copy invite link"}
          </Button>
        </>
      }
    >
      {code ? (
        <>
          <div className={s.code} aria-label={`Session code ${code.split("").join(" ")}`}>
            {code.split("").map((ch, i) => (
              <span key={i} aria-hidden="true">
                {ch}
              </span>
            ))}
          </div>
          <p className="muted" style={{ textAlign: "center", wordBreak: "break-all", fontSize: "var(--fs-sm)" }}>
            {link}
          </p>
        </>
      ) : (
        <Alert tone="warning">Creating your invite code…</Alert>
      )}
    </Modal>
  );
}
