import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { motion } from "framer-motion";
import { FaEye, FaChevronDown, FaFlag, FaExclamationTriangle } from "react-icons/fa";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { reportApi } from "../api";
import "./AdminReportsPage.css";

const POLL_INTERVAL = 30000; // fallback poll — WebSocket handles real-time
const WS_URL = "http://localhost:8080/ws";

function formatDate(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

const AdminReportsPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [filingId, setFilingId] = useState(null);
  const containerRef = useRef(null);
  const pollRef = useRef(null);
  const stompRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) navigate("/login");
    else if (user?.role !== "ADMIN") navigate("/dashboard");
  }, [isAuthenticated, user, navigate]);

  const fetchReports = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await reportApi.getAll();
      setReports(res.data || []);
    } catch {
      // silently fail on poll errors
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
    pollRef.current = setInterval(() => fetchReports(true), POLL_INTERVAL);

    const stomp = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 5000,
      onConnect: () => {
        stomp.subscribe("/topic/admin/reports", (msg) => {
          const newReport = JSON.parse(msg.body);
          setReports((prev) =>
            prev.some((r) => r.id === newReport.id) ? prev : [newReport, ...prev]
          );
        });
        stomp.subscribe("/topic/admin/reports/update", (msg) => {
          const updated = JSON.parse(msg.body);
          setReports((prev) =>
            prev.map((r) => (r.id === updated.id ? updated : r))
          );
        });
      },
    });
    stomp.activate();
    stompRef.current = stomp;

    return () => {
      clearInterval(pollRef.current);
      stomp.deactivate();
    };
  }, [fetchReports]);

  /* Close dropdown when clicking outside */
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleDropdown = useCallback((id) => {
    setOpenDropdownId((prev) => (prev === id ? null : id));
  }, []);

  const handleFileNotice = useCallback(async (reportId) => {
    setFilingId(reportId);
    try {
      await reportApi.fileNotice(reportId);
      await fetchReports(true);
    } catch {
      // ignore
    } finally {
      setFilingId(null);
    }
  }, [fetchReports]);

  const handleAction = useCallback((action, reportId) => {
    setOpenDropdownId(null);
    if (action === "file-notice") handleFileNotice(reportId);
  }, [handleFileNotice]);

  const getCategoryClass = (cat) => {
    if (cat === "Critical") return "rp-badge badge-critical";
    if (cat === "Medium")   return "rp-badge badge-medium";
    return null;
  };

  return (
    <motion.div
      className="rp-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* ── Page header ── */}
      <div className="rp-header">
        <h1 className="rp-title">Admin :: Pending Recipe Reports</h1>
        <button className="rp-view-all-btn">View all reports</button>
      </div>

      {/* ── Warning banner ── */}
      <div className="rp-warning">
        <FaExclamationTriangle className="rp-warn-icon" />
        <div className="rp-warn-body">
          <p className="rp-warn-title">SYSTEM WARNING</p>
          <p className="rp-warn-msg">
            CRITICAL: Multiple high-urgency recipe reports detected (e.g.,&nbsp;
            &lsquo;Contamination risk&rsquo;, &lsquo;Harmful advice&rsquo;). Priority review required.
            System is monitoring.
          </p>
        </div>
        <FaExclamationTriangle className="rp-warn-icon" />
      </div>

      {/* ── Reports table ── */}
      <div className="rp-table-wrap" ref={containerRef}>
        {isLoading ? (
          <p className="rp-loading">Loading reports…</p>
        ) : (
          <table className="rp-table">
            <thead>
              <tr className="rp-thead-row">
                <th className="rp-th">Report ID</th>
                <th className="rp-th">Reporter</th>
                <th className="rp-th">Recipe Title (linked)</th>
                <th className="rp-th">Category</th>
                <th className="rp-th">Reason</th>
                <th className="rp-th">Report Date</th>
                <th className="rp-th rp-th-center">View Recipe</th>
                <th className="rp-th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report, idx) => {
                const catClass = getCategoryClass(report.category);
                const ddOpen   = openDropdownId === report.id;
                const viewing  = viewingId === report.id;
                const filing   = filingId === report.id;
                const filed    = report.status === "FILED";

                return (
                  <motion.tr
                    key={report.id}
                    className="rp-row"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                  >
                    {/* Report ID */}
                    <td className="rp-td rp-td-id">{report.id}</td>

                    {/* Reporter */}
                    <td className="rp-td">{report.reporterName}</td>

                    {/* Recipe Title */}
                    <td className="rp-td">
                      <span className="rp-recipe-link">{report.recipeTitle}</span>
                    </td>

                    {/* Category */}
                    <td className="rp-td">
                      {catClass
                        ? <span className={catClass}>{report.category}</span>
                        : <span className="rp-cat-plain">{report.category}</span>}
                    </td>

                    {/* Reason */}
                    <td className="rp-td rp-td-reason">{report.reason}</td>

                    {/* Report Date */}
                    <td className="rp-td rp-td-date">{formatDate(report.reportDate)}</td>

                    {/* View Recipe */}
                    <td className="rp-td rp-td-center">
                      <button
                        className={`rp-eye-btn${viewing ? " active" : ""}`}
                        title="View recipe"
                        onClick={() => setViewingId(viewing ? null : report.id)}
                      >
                        <FaEye />
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="rp-td">
                      <div className="rp-actions">
                        <button
                          className="rp-notice-btn"
                          disabled={filing || filed}
                          onClick={() => handleFileNotice(report.id)}
                        >
                          <FaFlag className="rp-flag-icon" />
                          {filing ? "Filing…" : filed ? "Filed" : "File for Notice"}
                        </button>

                        <div className="rp-dd-wrap">
                          <button
                            className="rp-dd-toggle"
                            onClick={() => toggleDropdown(report.id)}
                            aria-label="More actions"
                          >
                            <FaChevronDown className={`rp-chevron${ddOpen ? " flipped" : ""}`} />
                          </button>

                          {ddOpen && (
                            <div className="rp-dd-menu">
                              <button
                                className="rp-dd-item"
                                onClick={() => handleAction("review-complete", report.id)}
                              >
                                Review Complete (Clear)
                              </button>
                              <button
                                className="rp-dd-item"
                                onClick={() => handleAction("flag-followup", report.id)}
                              >
                                Flag for follow-up
                              </button>
                              <button
                                className="rp-dd-item"
                                onClick={() => handleAction("assign-team", report.id)}
                              >
                                Assign to content team
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </motion.div>
  );
};

export default AdminReportsPage;
