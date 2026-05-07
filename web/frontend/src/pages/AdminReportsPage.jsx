import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { motion } from "framer-motion";
import { FaEye, FaChevronDown, FaFlag, FaExclamationTriangle } from "react-icons/fa";
import "./AdminReportsPage.css";

const MOCK_REPORTS = [
  {
    id: 191,
    reporter: "Jaram",
    recipeTitle: "Stamfunwate Recipe",
    recipeSuffix: "(recipe)",
    category: "Critical",
    reason: "Contamination risk (non-food item)",
    reportDate: "07/11/2023",
  },
  {
    id: 192,
    reporter: "Marramw",
    recipeTitle: "Month Westernins",
    recipeSuffix: "(recipes)",
    category: "Recipe",
    reason: "Inaccurate/Harmful measurements",
    reportDate: "07/11/2023",
  },
  {
    id: 193,
    reporter: "Kein",
    recipeTitle: "Chicken Bowden",
    recipeSuffix: "(recipe)",
    category: "Recipe",
    reason: "Inaccurate cooking temperature",
    reportDate: "07/11/2023",
  },
  {
    id: 794,
    reporter: "Robiala",
    recipeTitle: "Martle Cinning",
    recipeSuffix: "(recipe)",
    category: "Recipe",
    reason: "Intellectual Property infringement",
    reportDate: "07/11/2023",
  },
  {
    id: 795,
    reporter: "Aymy",
    recipeTitle: "The Green Bosted Pack",
    recipeSuffix: "(recipe)",
    category: "Medium",
    reason: "Misleading nutritional info",
    reportDate: "07/11/2023",
  },
  {
    id: 796,
    reporter: "Raman",
    recipeTitle: "Vanlic Powller feuch",
    recipeSuffix: "(recipe)",
    category: "Recipe",
    reason: "Inappropriate language in description",
    reportDate: "07/11/2023",
  },
  {
    id: 797,
    reporter: "Kerna",
    recipeTitle: "Marmutsfi Recipe",
    recipeSuffix: "(recipes)",
    category: "Recipe",
    reason: "Inappropriate language in description",
    reportDate: "07/11/2023",
  },
  {
    id: 298,
    reporter: "Habern",
    recipeTitle: "Stewmarie Cooking",
    recipeSuffix: "(recipe)",
    category: "Recipe",
    reason: "Intellectual Property infringement",
    reportDate: "07/11/2023",
  },
  {
    id: 299,
    reporter: "Berchalt",
    recipeTitle: "Camera Rooinn",
    recipeSuffix: "(recipe1)",
    category: "Medium",
    reason: "Inaccurate/Harmful measurements",
    reportDate: "07/11/2023",
  },
];

const AdminReportsPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) navigate("/login");
    else if (user?.role !== "ADMIN") navigate("/dashboard");
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    setIsLoading(true);
    const t = setTimeout(() => {
      setReports(MOCK_REPORTS);
      setIsLoading(false);
    }, 450);
    return () => clearTimeout(t);
  }, []);

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

  const handleAction = useCallback((action, reportId) => {
    console.log(`[Admin Reports] action="${action}" reportId=${reportId}`);
    setOpenDropdownId(null);
  }, []);

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
                    <td className="rp-td">{report.reporter}</td>

                    {/* Recipe Title */}
                    <td className="rp-td">
                      <span className="rp-recipe-link">
                        {report.recipeTitle}&nbsp;
                        <span className="rp-recipe-suffix">{report.recipeSuffix}</span>
                      </span>
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
                    <td className="rp-td rp-td-date">{report.reportDate}</td>

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
                          onClick={() => handleAction("file-notice", report.id)}
                        >
                          <FaFlag className="rp-flag-icon" />
                          File for Notice
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
