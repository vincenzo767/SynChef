import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaShieldAlt, FaArrowLeft, FaTrash, FaSearch,
  FaTimes, FaComments, FaClipboardList,
} from "react-icons/fa";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { adminApi } from "../api";
import "./AdminModerationPage.css";

const WS_URL = "http://localhost:8080/ws";

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function truncate(str, max = 120) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "…" : str;
}

function getInitials(name) {
  return (name || "?").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

const AdminModerationPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useSelector((s) => s.auth);
  const [tab, setTab] = useState("comments"); // "comments" | "reports"
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [error, setError] = useState("");
  const stompRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) navigate("/login");
    else if (user?.role !== "ADMIN") navigate("/dashboard");
  }, [isAuthenticated, user, navigate]);

  const fetchComments = useCallback(async () => {
    try {
      const res = await adminApi.getComments();
      setComments(res.data || []);
    } catch {
      setError("Failed to load comments.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComments();

    const stomp = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 5000,
      onConnect: () => {
        stomp.subscribe("/topic/admin/stats", () => fetchComments());
      },
    });
    stomp.activate();
    stompRef.current = stomp;
    return () => stomp.deactivate();
  }, [fetchComments]);

  const handleDelete = async (commentId) => {
    setDeletingId(commentId);
    try {
      await adminApi.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      setError("Failed to delete comment.");
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  const filtered = comments.filter((c) => {
    const q = search.toLowerCase();
    return (
      !q ||
      c.authorName?.toLowerCase().includes(q) ||
      c.recipeTitle?.toLowerCase().includes(q) ||
      c.content?.toLowerCase().includes(q)
    );
  });

  return (
    <motion.div
      className="mod-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mod-container">
        {/* Header */}
        <div className="mod-header">
          <button className="mod-back-btn" onClick={() => navigate("/admin/dashboard")}>
            <FaArrowLeft /> Back
          </button>
          <div className="mod-title-block">
            <FaShieldAlt className="mod-title-icon" />
            <div>
              <h1 className="mod-title">Content Moderation</h1>
              <p className="mod-subtitle">Review and remove inappropriate user-generated content</p>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="mod-summary">
          <div className="mod-summary-card">
            <FaComments className="mod-sum-icon" style={{ color: "#f59e0b" }} />
            <div>
              <span className="mod-sum-num">{comments.length}</span>
              <span className="mod-sum-lbl">Total Comments</span>
            </div>
          </div>
          <div className="mod-summary-card">
            <FaClipboardList className="mod-sum-icon" style={{ color: "#ef4444" }} />
            <div>
              <span className="mod-sum-num" onClick={() => navigate("/admin/reports")} style={{ cursor: "pointer", textDecoration: "underline" }}>
                View Reports
              </span>
              <span className="mod-sum-lbl">Recipe Reports Page</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mod-tabs">
          <button
            className={`mod-tab ${tab === "comments" ? "mod-tab-active" : ""}`}
            onClick={() => setTab("comments")}
          >
            <FaComments /> Comments ({comments.length})
          </button>
          <button
            className={`mod-tab ${tab === "reports" ? "mod-tab-active" : ""}`}
            onClick={() => navigate("/admin/reports")}
          >
            <FaClipboardList /> Recipe Reports
          </button>
        </div>

        {/* Search */}
        <div className="mod-search-wrap">
          <FaSearch className="mod-search-icon" />
          <input
            className="mod-search"
            placeholder="Search by author, recipe or content…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="mod-search-clear" onClick={() => setSearch("")}>
              <FaTimes />
            </button>
          )}
        </div>

        {error && <p className="mod-error">{error}</p>}

        {/* Comments table */}
        <div className="mod-table-wrap">
          {isLoading ? (
            <p className="mod-loading">Loading comments…</p>
          ) : filtered.length === 0 ? (
            <p className="mod-empty">
              {search ? "No comments match your search." : "No comments yet."}
            </p>
          ) : (
            <table className="mod-table">
              <thead>
                <tr className="mod-thead-row">
                  <th className="mod-th">ID</th>
                  <th className="mod-th">Author</th>
                  <th className="mod-th">Recipe</th>
                  <th className="mod-th mod-th-wide">Content</th>
                  <th className="mod-th">Date</th>
                  <th className="mod-th mod-th-center">Delete</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filtered.map((c, idx) => {
                    const busy = deletingId === c.id;
                    return (
                      <motion.tr
                        key={c.id}
                        className="mod-row"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ delay: idx * 0.02 }}
                      >
                        {/* ID */}
                        <td className="mod-td mod-td-id">#{c.id}</td>

                        {/* Author */}
                        <td className="mod-td">
                          <div className="mod-author">
                            <div className="mod-avatar">{getInitials(c.authorName)}</div>
                            <span className="mod-author-name">{c.authorName}</span>
                          </div>
                        </td>

                        {/* Recipe */}
                        <td className="mod-td mod-td-recipe">
                          <span className="mod-recipe-title">{c.recipeTitle}</span>
                        </td>

                        {/* Content */}
                        <td className="mod-td mod-td-content">
                          <span className="mod-content-text" title={c.content}>
                            {truncate(c.content)}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="mod-td mod-td-date">{formatDate(c.createdAt)}</td>

                        {/* Delete */}
                        <td className="mod-td mod-td-center">
                          <button
                            className="mod-delete-btn"
                            disabled={busy}
                            onClick={() => setConfirmDelete(c)}
                            title="Delete comment"
                          >
                            {busy ? "…" : <FaTrash />}
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Confirm delete modal */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            className="mod-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              className="mod-modal"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <FaTrash className="mod-modal-icon" />
              <h2>Delete Comment?</h2>
              <p>
                Remove this comment by <strong>{confirmDelete.authorName}</strong>?
                <br />
                <em className="mod-modal-preview">"{truncate(confirmDelete.content, 80)}"</em>
              </p>
              <div className="mod-modal-actions">
                <button className="mod-modal-cancel" onClick={() => setConfirmDelete(null)}>
                  Cancel
                </button>
                <button
                  className="mod-modal-confirm"
                  onClick={() => handleDelete(confirmDelete.id)}
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AdminModerationPage;
