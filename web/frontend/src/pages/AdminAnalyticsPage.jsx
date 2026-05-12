import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { motion } from "framer-motion";
import {
  FaChartBar, FaUsers, FaClipboardList, FaComments,
  FaUtensils, FaArrowLeft, FaGlobe,
} from "react-icons/fa";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { adminApi } from "../api";
import "./AdminAnalyticsPage.css";

const WS_URL = "http://localhost:8080/ws";

function BarChart({ data, color, label }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const visible = data.slice(-14); // show last 14 days for readability
  return (
    <div className="an-chart-wrap">
      <p className="an-chart-label">{label}</p>
      <div className="an-chart">
        {visible.map((d, i) => {
          const pct = (d.count / max) * 100;
          const parts = d.date.split("-");
          const shortDate = `${parts[1]}/${parts[2]}`;
          return (
            <div key={d.date} className="an-bar-col">
              <span className="an-bar-tip">{d.count}</span>
              <motion.div
                className="an-bar"
                style={{ background: color }}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(pct, d.count > 0 ? 4 : 0)}%` }}
                transition={{ delay: i * 0.03, duration: 0.5, ease: "easeOut" }}
              />
              <span className="an-bar-lbl">{shortDate}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const AdminAnalyticsPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useSelector((s) => s.auth);
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const stompRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) navigate("/login");
    else if (user?.role !== "ADMIN") navigate("/dashboard");
  }, [isAuthenticated, user, navigate]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await adminApi.getAnalytics();
      setAnalytics(res.data);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    fetchAnalytics();

    const stomp = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 5000,
      onConnect: () => {
        stomp.subscribe("/topic/admin/stats", () => fetchAnalytics());
      },
    });
    stomp.activate();
    stompRef.current = stomp;
    return () => stomp.deactivate();
  }, [fetchAnalytics]);

  const ov = analytics?.overview || {};

  const overviewCards = [
    { icon: <FaUsers />, label: "Total Users", value: ov.totalUsers ?? 0, color: "#10b981", sub: `${ov.activeUsers ?? 0} active · ${ov.bannedUsers ?? 0} banned` },
    { icon: <FaUtensils />, label: "User Recipes", value: ov.totalSynCookRecipes ?? 0, color: "#3b82f6", sub: `${ov.publicRecipes ?? 0} public` },
    { icon: <FaGlobe />, label: "Platform Recipes", value: analytics?.platformRecipes ?? 0, color: "#8b5cf6", sub: "Curated library" },
    { icon: <FaClipboardList />, label: "Total Reports", value: ov.totalReports ?? 0, color: "#ef4444", sub: `${ov.pendingReports ?? 0} pending` },
    { icon: <FaComments />, label: "Comments", value: ov.totalComments ?? 0, color: "#f59e0b", sub: "Across all recipes" },
  ];

  return (
    <motion.div
      className="an-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="an-container">
        {/* Header */}
        <div className="an-header">
          <button className="an-back-btn" onClick={() => navigate("/admin/dashboard")}>
            <FaArrowLeft /> Back
          </button>
          <div className="an-title-block">
            <FaChartBar className="an-title-icon" />
            <div>
              <h1 className="an-title">Analytics</h1>
              <p className="an-subtitle">Platform health at a glance — updates in real time</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <p className="an-loading">Loading analytics…</p>
        ) : (
          <>
            {/* Overview cards */}
            <motion.div
              className="an-overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {overviewCards.map((c, i) => (
                <motion.div
                  key={c.label}
                  className="an-card"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15 + i * 0.06 }}
                  whileHover={{ y: -4 }}
                >
                  <div className="an-card-icon" style={{ background: `${c.color}20`, color: c.color }}>
                    {c.icon}
                  </div>
                  <div className="an-card-body">
                    <span className="an-card-val" style={{ color: c.color }}>{c.value}</span>
                    <span className="an-card-lbl">{c.label}</span>
                    <span className="an-card-sub">{c.sub}</span>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Charts row */}
            <motion.div
              className="an-charts-row"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {/* User growth */}
              <div className="an-chart-card">
                <div className="an-chart-header">
                  <FaUsers className="an-chart-icon" style={{ color: "#10b981" }} />
                  <h2>User Registrations <span className="an-chart-period">Last 14 days</span></h2>
                </div>
                {analytics?.userRegistrationsLast30Days?.length ? (
                  <BarChart
                    data={analytics.userRegistrationsLast30Days}
                    color="linear-gradient(180deg, #10b981 0%, #059669 100%)"
                    label=""
                  />
                ) : <p className="an-no-data">No registration data yet.</p>}
              </div>

              {/* Reports trend */}
              <div className="an-chart-card">
                <div className="an-chart-header">
                  <FaClipboardList className="an-chart-icon" style={{ color: "#ef4444" }} />
                  <h2>Reports Filed <span className="an-chart-period">Last 14 days</span></h2>
                </div>
                {analytics?.reportsLast30Days?.length ? (
                  <BarChart
                    data={analytics.reportsLast30Days}
                    color="linear-gradient(180deg, #ef4444 0%, #dc2626 100%)"
                    label=""
                  />
                ) : <p className="an-no-data">No report data yet.</p>}
              </div>
            </motion.div>

            {/* Content breakdown */}
            <motion.div
              className="an-breakdown"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
            >
              <h2 className="an-breakdown-title">Content Breakdown</h2>
              <div className="an-breakdown-grid">
                <BreakdownRow
                  label="Active users" value={ov.activeUsers ?? 0}
                  total={ov.totalUsers ?? 1} color="#10b981"
                />
                <BreakdownRow
                  label="Banned users" value={ov.bannedUsers ?? 0}
                  total={ov.totalUsers ?? 1} color="#ef4444"
                />
                <BreakdownRow
                  label="Public recipes" value={ov.publicRecipes ?? 0}
                  total={ov.totalSynCookRecipes ?? 1} color="#3b82f6"
                />
                <BreakdownRow
                  label="Private recipes"
                  value={(ov.totalSynCookRecipes ?? 0) - (ov.publicRecipes ?? 0)}
                  total={ov.totalSynCookRecipes ?? 1} color="#9ca3af"
                />
                <BreakdownRow
                  label="Pending reports" value={ov.pendingReports ?? 0}
                  total={ov.totalReports ?? 1} color="#f59e0b"
                />
                <BreakdownRow
                  label="Resolved reports"
                  value={(ov.totalReports ?? 0) - (ov.pendingReports ?? 0)}
                  total={ov.totalReports ?? 1} color="#6b7280"
                />
              </div>
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  );
};

function BreakdownRow({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="an-brow">
      <div className="an-brow-top">
        <span className="an-brow-label">{label}</span>
        <span className="an-brow-count">{value} <span className="an-brow-pct">({pct}%)</span></span>
      </div>
      <div className="an-brow-track">
        <motion.div
          className="an-brow-fill"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export default AdminAnalyticsPage;
