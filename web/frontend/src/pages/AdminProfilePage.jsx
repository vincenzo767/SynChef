import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { motion } from "framer-motion";
import "./AdminProfilePage.css";

const MOCK_ACTIVITY = [
  { id: 1, label: "Recipe Upload for Approval - Pending", type: "upload", ago: "1 hour ago",  code: "GO.31" },
  { id: 2, label: "Reported Recipe - Pending",             type: "report", ago: "1 hour ago",  code: "GO.32" },
  { id: 3, label: "Recipe Upload for Approval - Pending", type: "upload", ago: "1 week ago",  code: "GO.33" },
  { id: 4, label: "Reported Recipe - Pending",             type: "report", ago: "1 week ago",  code: "GO.34" },
];

const AdminProfilePage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  const [activityLog, setActivityLog] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const adminStats = { activeMark: 24, approvedRecipes: 12, rankings: 38 };

  useEffect(() => {
    if (!isAuthenticated) navigate("/login");
    else if (user?.role !== "ADMIN") navigate("/dashboard");
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setActivityLog(MOCK_ACTIVITY);
      setIsLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const initials = (() => {
    const name = user?.fullName?.trim() || "";
    if (name) {
      const parts = name.split(/\s+/);
      return parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : name.substring(0, 2).toUpperCase();
    }
    return "CA";
  })();

  return (
    <motion.div
      className="ap-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* ── Purple gradient header ── */}
      <div className="ap-header">
        <div className="ap-avatar-row">
          <div className="ap-avatar">{initials}</div>
          <div className="ap-identity">
            <h1 className="ap-name">Chef Admin</h1>
            <p className="ap-email">{user?.email || "chef.admin.com"}</p>
          </div>
        </div>

        <div className="ap-stats-row">
          <div className="ap-stat">
            <span className="ap-stat-val green">{adminStats.activeMark}</span>
            <span className="ap-stat-lbl green">Active Marks</span>
          </div>
          <div className="ap-stat-sep" />
          <div className="ap-stat">
            <span className="ap-stat-val blue">{adminStats.approvedRecipes}</span>
            <span className="ap-stat-lbl blue">Approved Recipes</span>
          </div>
          <div className="ap-stat-sep" />
          <div className="ap-stat">
            <span className="ap-stat-val red">{adminStats.rankings}</span>
            <span className="ap-stat-lbl red">Rankings</span>
          </div>
        </div>
      </div>

      {/* ── Activity Cuisines section ── */}
      <div className="ap-activity">
        <p className="ap-activity-heading">Activity Cuisines</p>

        {isLoading ? (
          <p className="ap-loading">Loading activity…</p>
        ) : (
          <div className="ap-activity-list">
            {activityLog.map((item, idx) => (
              <motion.div
                key={item.id}
                className="ap-activity-item"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.07 }}
              >
                <div className={`ap-bar ${item.type === "report" ? "bar-red" : "bar-orange"}`} />
                <div className="ap-activity-body">
                  <div className="ap-activity-text">
                    <span className="ap-activity-label">{item.label}</span>
                    <span className="ap-activity-ago">{item.ago}</span>
                  </div>
                  <span className="ap-activity-code">{item.code}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AdminProfilePage;
