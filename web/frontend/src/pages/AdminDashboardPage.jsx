import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { motion } from "framer-motion";
import { FaChartBar, FaClipboardList, FaUsers, FaShieldAlt } from "react-icons/fa";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { adminApi } from "../api";
import "./AdminDashboardPage.css";

const WS_URL = "http://localhost:8080/ws";

const AdminDashboardPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  const [stats, setStats] = useState({
    totalUsers: 0, activeUsers: 0, totalSynCookRecipes: 0,
    pendingReports: 0, totalReports: 0, totalComments: 0,
  });
  const stompRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) navigate("/login");
    else if (user?.role !== "ADMIN") navigate("/dashboard");
  }, [isAuthenticated, user, navigate]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await adminApi.getStats();
      setStats(res.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchStats();

    const stomp = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 5000,
      onConnect: () => {
        stomp.subscribe("/topic/admin/stats", (msg) => {
          setStats(JSON.parse(msg.body));
        });
      },
    });
    stomp.activate();
    stompRef.current = stomp;

    return () => stomp.deactivate();
  }, [fetchStats]);

  const adminMenuItems = [
    {
      id: 1,
      icon: <FaClipboardList />,
      title: "Recipe Reports",
      description: "Review and manage pending recipe reports",
      path: "/admin/reports",
      count: stats.pendingReports,
      color: "#ef4444",
    },
    {
      id: 2,
      icon: <FaUsers />,
      title: "User Management",
      description: "Manage user accounts and permissions",
      path: "/admin/users",
      count: stats.totalUsers,
      color: "#10b981",
    },
    {
      id: 3,
      icon: <FaChartBar />,
      title: "Analytics",
      description: "View detailed analytics and statistics",
      path: "/admin/analytics",
      count: stats.totalSynCookRecipes,
      color: "#3b82f6",
    },
    {
      id: 4,
      icon: <FaShieldAlt />,
      title: "Content Moderation",
      description: "Flag and manage inappropriate content",
      path: "/admin/moderation",
      count: stats.totalComments,
      color: "#f59e0b",
    },
  ];

  return (
    <motion.div
      className="admin-dashboard-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="admin-dashboard-container">
        {/* Header */}
        <motion.div
          className="admin-dashboard-header"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1>Admin Dashboard</h1>
            <p>Welcome back, {user?.fullName || "Admin"}!</p>
          </div>
          <div className="header-badge">
            <FaShieldAlt />
            <span>Administrator</span>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          className="quick-stats"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="stat-item">
            <span className="stat-value">{stats.totalSynCookRecipes}</span>
            <span className="stat-label">Total Recipes</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.activeUsers}</span>
            <span className="stat-label">Active Users</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.pendingReports}</span>
            <span className="stat-label">Pending Reports</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.totalComments}</span>
            <span className="stat-label">Total Comments</span>
          </div>
        </motion.div>

        {/* Admin Menu Grid */}
        <motion.div
          className="admin-menu-grid"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {adminMenuItems.map((item, index) => (
            <motion.button
              key={item.id}
              className="admin-menu-card"
              onClick={() => navigate(item.path)}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 + index * 0.05 }}
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="menu-card-icon" style={{ backgroundColor: `${item.color}20` }}>
                {item.icon}
              </div>
              <div className="menu-card-content">
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
              <div className="menu-card-count" style={{ backgroundColor: item.color }}>
                {item.count}
              </div>
            </motion.button>
          ))}
        </motion.div>

        {/* Info Section */}
        <motion.div
          className="admin-info-section"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="info-card">
            <h3>Quick Tips</h3>
            <ul>
              <li>Check pending reports daily for critical issues</li>
              <li>Review user activity to ensure community safety</li>
              <li>Monitor analytics to track platform health</li>
              <li>Flag inappropriate content promptly</li>
            </ul>
          </div>
          <div className="info-card">
            <h3>Recent Updates</h3>
            <ul>
              <li>Admin role system fully implemented</li>
              <li>Recipe report workflow activated</li>
              <li>User moderation tools available</li>
              <li>Analytics dashboard ready for use</li>
            </ul>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default AdminDashboardPage;
