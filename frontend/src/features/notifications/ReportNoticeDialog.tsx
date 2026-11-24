import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuFlag, LuPencil, LuSend } from "react-icons/lu";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
import { Alert, Badge, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/useToast";
import { reportApi, userApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/client";
import { useAsync } from "@/lib/useAsync";
import { formatRelative } from "@/lib/format";
import type { Report } from "@/lib/api/types";

const STATUS_COPY: Record<string, { label: string; tone: "warning" | "info" | "success" | "neutral" }> = {
  FILED: { label: "Action requested", tone: "warning" },
  APPEALED: { label: "Appeal under review", tone: "info" },
  RESOLVED: { label: "Resolved", tone: "success" },
  DISMISSED: { label: "Dismissed", tone: "neutral" }
};

/**
 * Shown to a dish owner when a moderator files a notice. Every action here is functional:
 * edit the dish, or send an appeal that moderators see in the admin queue.
 */
export function ReportNoticeDialog({ recipeId, onClose }: { recipeId: number | null; onClose: () => void }) {
  const open = recipeId != null;
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, setData } = useAsync((signal) => userApi.myReports({ signal }), [recipeId], open);
  const [appeal, setAppeal] = useState("");
  const [sending, setSending] = useState(false);
  const [appealError, setAppealError] = useState<string | undefined>();

  const reports = (data ?? []).filter((r) => r.recipeId === recipeId);
  const actionable = reports.find((r) => r.status === "FILED");

  const sendAppeal = async (report: Report) => {
    if (appeal.trim().length < 10) {
      setAppealError("Please explain in at least 10 characters.");
      return;
    }
    setSending(true);
    setAppealError(undefined);
    try {
      const updated = await reportApi.appeal(report.id, appeal.trim());
      setData((list) => list?.map((r) => (r.id === updated.id ? updated : r)));
      setAppeal("");
      toast.success("Appeal sent", "A moderator will review it shortly.");
    } catch (e) {
      setAppealError(toApiError(e).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={sending}
      title="Your dish was reported"
      description="Community moderators reviewed a report about one of your shared dishes."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="secondary"
            icon={<LuPencil />}
            onClick={() => {
              onClose();
              navigate(`/community?edit=${recipeId}`);
            }}
          >
            Edit dish
          </Button>
        </>
      }
    >
      {loading && <Spinner label="Loading report details" />}
      {error && <Alert tone="error">{error.message}</Alert>}
      {!loading && !error && reports.length === 0 && <Alert>This report has already been closed. No action is needed.</Alert>}
      <div className="stack">
        {reports.map((r) => (
          <div key={r.id} className="stack" style={{ gap: "var(--sp-2)" }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>
                <LuFlag aria-hidden="true" style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
                {r.recipeTitle}
              </strong>
              <Badge tone={STATUS_COPY[r.status]?.tone ?? "neutral"}>{STATUS_COPY[r.status]?.label ?? r.status}</Badge>
            </div>
            <p className="muted">
              Reason: <strong style={{ color: "var(--text)" }}>{r.reason}</strong> · {formatRelative(r.reportDate)}
            </p>
            {r.appealMessage && <Alert tone="success">Your appeal: “{r.appealMessage}”</Alert>}
          </div>
        ))}
        {actionable && (
          <>
            <p className="muted">
              Please review your dish and update anything that may break the community guidelines. If you believe the report is a
              mistake, explain why below.
            </p>
            <TextArea
              label="Appeal message"
              value={appeal}
              onChange={(e) => setAppeal(e.target.value)}
              maxLength={1000}
              rows={3}
              error={appealError}
              hint={`${appeal.length}/1000`}
            />
            <div>
              <Button variant="primary" icon={<LuSend />} loading={sending} onClick={() => void sendAppeal(actionable)}>
                Send appeal
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
