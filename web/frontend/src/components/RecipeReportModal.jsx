import { useState } from "react";
import { FaChevronRight, FaTimes, FaExclamationCircle } from "react-icons/fa";
import { reportApi } from "../api";
import "./RecipeReportModal.css";

const REPORT_CATEGORIES = [
  { label: "Contamination risk (non-food item)",     category: "Critical" },
  { label: "Inaccurate or harmful measurements",     category: "Recipe"   },
  { label: "Inaccurate cooking temperature",         category: "Recipe"   },
  { label: "Intellectual Property infringement",     category: "Recipe"   },
  { label: "Misleading nutritional information",     category: "Medium"   },
  { label: "Inappropriate language in description",  category: "Recipe"   },
  { label: "Spam or repeated content",               category: "Recipe"   },
  { label: "False or dangerous recipe claims",       category: "Medium"   },
  { label: "I don't want to see this",               category: "Recipe"   },
];

/**
 * RecipeReportModal — matches the Facebook-style report modal in the design.
 * Props:
 *   recipeId    – ID of the SynCook recipe being reported
 *   recipeTitle – Display title shown in the modal header
 *   onClose     – callback to close the modal
 */
const RecipeReportModal = ({ recipeId, recipeTitle, onClose }) => {
  const [selected, setSelected]   = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState("");

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError("");
    try {
      await reportApi.create(recipeId, selected.category, selected.label);
      setDone(true);
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to submit report. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rrm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rrm-modal">

        {/* Header */}
        <div className="rrm-header">
          <h2 className="rrm-title">Report</h2>
          <button className="rrm-close-btn" onClick={onClose} aria-label="Close">
            <FaTimes />
          </button>
        </div>

        {done ? (
          /* ── Success state ── */
          <div className="rrm-success">
            <FaExclamationCircle className="rrm-success-icon" />
            <p className="rrm-success-title">Report submitted</p>
            <p className="rrm-success-msg">
              Thank you for helping keep SynChef safe. Our team will review your report within 24 hours.
            </p>
            <button className="rrm-done-btn" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <div className="rrm-subtitle-block">
              <p className="rrm-subtitle">Why are you reporting this post?</p>
              <p className="rrm-hint">
                Help us understand the problem with <strong>{recipeTitle}</strong>. Your report is anonymous.
              </p>
            </div>

            <div className="rrm-category-list">
              {REPORT_CATEGORIES.map((item) => (
                <button
                  key={item.label}
                  className={`rrm-category-row${selected?.label === item.label ? " selected" : ""}`}
                  onClick={() => setSelected(item)}
                >
                  <span className="rrm-category-label">{item.label}</span>
                  <FaChevronRight className="rrm-category-arrow" />
                </button>
              ))}
            </div>

            {error && <p className="rrm-error">{error}</p>}

            <div className="rrm-footer">
              <button className="rrm-cancel-btn" onClick={onClose}>Cancel</button>
              <button
                className="rrm-submit-btn"
                onClick={handleSubmit}
                disabled={!selected || submitting}
              >
                {submitting ? "Submitting…" : "Submit Report"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RecipeReportModal;
