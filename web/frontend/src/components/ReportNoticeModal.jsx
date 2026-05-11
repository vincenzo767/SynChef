import { useEffect, useState } from "react";
import { FaTimes, FaExclamationCircle, FaChevronDown } from "react-icons/fa";
import { synCookApi } from "../api";
import "./ReportNoticeModal.css";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function useCountdown(fromDate) {
  const [remaining, setRemaining] = useState({ days: 6, hrs: 23, mins: 59 });

  useEffect(() => {
    if (!fromDate) return;
    const deadline = new Date(fromDate).getTime() + SEVEN_DAYS_MS;

    const tick = () => {
      const diff = deadline - Date.now();
      if (diff <= 0) {
        setRemaining({ days: 0, hrs: 0, mins: 0 });
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hrs  = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setRemaining({ days, hrs, mins });
    };

    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [fromDate]);

  return remaining;
}

function formatAgo(isoString) {
  if (!isoString) return "recently";
  const diff = Date.now() - new Date(isoString).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

/**
 * ReportNoticeModal — shown to the recipe owner when admin files a "File for Notice".
 * Props:
 *   notification – the REPORT_FILED notification object from the backend
 *   onClose      – callback to close the modal
 */
const ReportNoticeModal = ({ notification, onClose }) => {
  const recipeTitle  = notification?.title || "Your Recipe";
  const rawMessage   = notification?.message || "";
  const reason       = rawMessage.startsWith("Filed: ")
    ? rawMessage.replace(/^Filed:\s*/, "").replace(/\. Please review.*/, "")
    : rawMessage;
  const recipeId     = notification?.referenceRecipeId;
  const createdAt    = notification?.createdAt;
  const timeAgo      = formatAgo(createdAt);

  const countdown = useCountdown(createdAt);
  const [recipeImage, setRecipeImage] = useState(null);
  const [disputeExpanded, setDisputeExpanded] = useState(false);

  useEffect(() => {
    if (!recipeId) return;
    synCookApi.getById(recipeId)
      .then((res) => { if (res.data?.imageUrl) setRecipeImage(res.data.imageUrl); })
      .catch(() => {});
  }, [recipeId]);

  return (
    <div className="rnm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rnm-modal">

        {/* Close */}
        <button className="rnm-close-btn" onClick={onClose} aria-label="Close">
          <FaTimes />
        </button>

        {/* Warning banner */}
        <div className="rnm-warning-banner">
          <FaExclamationCircle className="rnm-warn-icon" />
          <span>WARNING: Your content has been reported.</span>
        </div>

        {/* Recipe card */}
        <div className="rnm-recipe-card">
          <div className="rnm-recipe-thumb">
            {recipeImage
              ? <img src={recipeImage} alt={recipeTitle} onError={(e) => { e.currentTarget.style.display = "none"; }} />
              : <span className="rnm-thumb-placeholder">🍽</span>}
          </div>
          <div className="rnm-recipe-info">
            <p className="rnm-recipe-title">{recipeTitle}</p>
            <p className="rnm-recipe-ago">{timeAgo}</p>
            {recipeImage && (
              <div className="rnm-recipe-preview">
                <img src={recipeImage} alt="preview" onError={(e) => { e.currentTarget.style.display = "none"; }} />
              </div>
            )}
          </div>
          <button
            className="rnm-recipe-toggle"
            onClick={() => setDisputeExpanded((p) => !p)}
            aria-label="Toggle details"
          >
            <FaChevronDown className={disputeExpanded ? "flipped" : ""} />
          </button>
        </div>

        {/* Content under review */}
        <div className="rnm-review-section">
          <p className="rnm-review-label">CONTENT UNDER REVIEW</p>

          <div className="rnm-reason-row">
            <span className="rnm-reason-text">{reason}</span>
            <button className="rnm-dispute-btn">Dispute</button>
            <FaChevronDown className="rnm-reason-chevron" />
          </div>
        </div>

        {/* Critical creator review */}
        <div className="rnm-critical-block">
          <p className="rnm-critical-title">CRITICAL CREATOR REVIEW REQUIRED</p>
          <p className="rnm-critical-body">
            The content above has been flagged as violating SynChef community standards.
            Please review the recipe, make any necessary changes to ensure compliance, or
            appeal the decisions within the specified timeframe. Failure to action will result
            in permanent deletion in 7 days.
          </p>
          <p className="rnm-countdown">
            Time Remaining:&nbsp;
            <span className="rnm-countdown-value">
              [ {countdown.days} days, {countdown.hrs} hrs, {countdown.mins} mins ]
            </span>
          </p>
        </div>

        {/* Action buttons */}
        <div className="rnm-actions">
          <button className="rnm-action-btn">Edit Content</button>
          <button className="rnm-action-btn">Appeal All Reports</button>
          <button className="rnm-action-btn">Contact Support</button>
        </div>

        {/* Bottom acknowledge */}
        <button className="rnm-acknowledge-btn" onClick={onClose}>
          Mark as Reviewed (I acknowledge reports and will not change)
        </button>
      </div>
    </div>
  );
};

export default ReportNoticeModal;
