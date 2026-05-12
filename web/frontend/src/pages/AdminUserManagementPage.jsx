import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaUsers, FaSearch, FaTrash, FaBan, FaCheckCircle,
  FaUserShield, FaUser, FaArrowLeft, FaTimes,
} from "react-icons/fa";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { adminApi } from "../api";
import "./AdminUserManagementPage.css";

const WS_URL = "http://localhost:8080/ws";

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getInitials(name, username) {
  const src = name || username || "?";
  return src.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

const AdminUserManagementPage = () => {
  const navigate = useNavigate();
  const { user: adminUser, isAuthenticated } = useSelector((s) => s.auth);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actioningId, setActioningId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [error, setError] = useState("");
  const stompRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) navigate("/login");
    else if (adminUser?.role !== "ADMIN") navigate("/dashboard");
  }, [isAuthenticated, adminUser, navigate]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await adminApi.getUsers();
      setUsers(res.data || []);
    } catch {
      setError("Failed to load users.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();

    const stomp = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 5000,
      onConnect: () => {
        stomp.subscribe("/topic/admin/stats", () => fetchUsers());
      },
    });
    stomp.activate();
    stompRef.current = stomp;
    return () => stomp.deactivate();
  }, [fetchUsers]);

  const handleToggleStatus = async (userId) => {
    setActioningId(userId);
    try {
      const res = await adminApi.toggleUserStatus(userId);
      setUsers((prev) => prev.map((u) => (u.id === userId ? res.data : u)));
    } catch {
      setError("Failed to update user status.");
    } finally {
      setActioningId(null);
    }
  };

  const handleChangeRole = async (userId, role) => {
    setActioningId(userId);
    try {
      const res = await adminApi.changeUserRole(userId, role);
      setUsers((prev) => prev.map((u) => (u.id === userId ? res.data : u)));
    } catch {
      setError("Failed to update role.");
    } finally {
      setActioningId(null);
    }
  };

  const handleDelete = async (userId) => {
    setActioningId(userId);
    try {
      await adminApi.deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch {
      setError("Failed to delete user.");
    } finally {
      setActioningId(null);
      setConfirmDelete(null);
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      !q ||
      u.fullName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q)
    );
  });

  const totalActive = users.filter((u) => u.active).length;
  const totalBanned = users.filter((u) => !u.active).length;
  const totalAdmins = users.filter((u) => u.role === "ADMIN").length;

  return (
    <motion.div
      className="um-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="um-container">
        {/* Header */}
        <div className="um-header">
          <button className="um-back-btn" onClick={() => navigate("/admin/dashboard")}>
            <FaArrowLeft /> Back
          </button>
          <div className="um-title-block">
            <FaUsers className="um-title-icon" />
            <div>
              <h1 className="um-title">User Management</h1>
              <p className="um-subtitle">Manage user accounts, roles and permissions</p>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="um-summary">
          <div className="um-summary-card um-summary-total">
            <span className="um-summary-num">{users.length}</span>
            <span className="um-summary-lbl">Total Users</span>
          </div>
          <div className="um-summary-card um-summary-active">
            <span className="um-summary-num">{totalActive}</span>
            <span className="um-summary-lbl">Active</span>
          </div>
          <div className="um-summary-card um-summary-banned">
            <span className="um-summary-num">{totalBanned}</span>
            <span className="um-summary-lbl">Banned</span>
          </div>
          <div className="um-summary-card um-summary-admin">
            <span className="um-summary-num">{totalAdmins}</span>
            <span className="um-summary-lbl">Admins</span>
          </div>
        </div>

        {/* Search */}
        <div className="um-search-wrap">
          <FaSearch className="um-search-icon" />
          <input
            className="um-search"
            placeholder="Search by name, email or username…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="um-search-clear" onClick={() => setSearch("")}>
              <FaTimes />
            </button>
          )}
        </div>

        {error && <p className="um-error">{error}</p>}

        {/* Table */}
        <div className="um-table-wrap">
          {isLoading ? (
            <p className="um-loading">Loading users…</p>
          ) : filtered.length === 0 ? (
            <p className="um-empty">No users found.</p>
          ) : (
            <table className="um-table">
              <thead>
                <tr className="um-thead-row">
                  <th className="um-th">User</th>
                  <th className="um-th">Email</th>
                  <th className="um-th">Role</th>
                  <th className="um-th">Status</th>
                  <th className="um-th">Country</th>
                  <th className="um-th">Joined</th>
                  <th className="um-th um-th-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filtered.map((u, idx) => {
                    const isSelf = u.id === adminUser?.id;
                    const busy = actioningId === u.id;
                    return (
                      <motion.tr
                        key={u.id}
                        className="um-row"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ delay: idx * 0.02 }}
                      >
                        {/* User avatar + name */}
                        <td className="um-td um-td-user">
                          <div className="um-avatar">{getInitials(u.fullName, u.username)}</div>
                          <div>
                            <div className="um-name">{u.fullName || u.username}</div>
                            <div className="um-username">@{u.username}</div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="um-td um-td-email">{u.email}</td>

                        {/* Role */}
                        <td className="um-td">
                          <select
                            className={`um-role-select ${u.role === "ADMIN" ? "role-admin" : "role-user"}`}
                            value={u.role || "USER"}
                            disabled={busy || isSelf}
                            onChange={(e) => handleChangeRole(u.id, e.target.value)}
                          >
                            <option value="USER">USER</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                        </td>

                        {/* Status */}
                        <td className="um-td">
                          <span className={`um-status-badge ${u.active ? "status-active" : "status-banned"}`}>
                            {u.active ? <FaCheckCircle /> : <FaBan />}
                            {u.active ? "Active" : "Banned"}
                          </span>
                        </td>

                        {/* Country */}
                        <td className="um-td um-td-country">
                          {u.countryCode
                            ? `${u.countryCode}${u.countryName ? ` · ${u.countryName}` : ""}`
                            : "—"}
                        </td>

                        {/* Joined */}
                        <td className="um-td um-td-date">{formatDate(u.createdAt)}</td>

                        {/* Actions */}
                        <td className="um-td um-td-actions">
                          <button
                            className={`um-action-btn ${u.active ? "btn-ban" : "btn-activate"}`}
                            disabled={busy || isSelf}
                            onClick={() => handleToggleStatus(u.id)}
                            title={u.active ? "Ban user" : "Activate user"}
                          >
                            {u.active ? <FaBan /> : <FaCheckCircle />}
                            {busy ? "…" : u.active ? "Ban" : "Activate"}
                          </button>
                          <button
                            className="um-action-btn btn-delete"
                            disabled={busy || isSelf}
                            onClick={() => setConfirmDelete(u)}
                            title="Delete user"
                          >
                            <FaTrash />
                            Delete
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

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            className="um-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              className="um-modal"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <FaTrash className="um-modal-icon" />
              <h2>Delete User?</h2>
              <p>
                Are you sure you want to permanently delete{" "}
                <strong>{confirmDelete.fullName || confirmDelete.username}</strong>? This cannot be undone.
              </p>
              <div className="um-modal-actions">
                <button className="um-modal-cancel" onClick={() => setConfirmDelete(null)}>
                  Cancel
                </button>
                <button
                  className="um-modal-confirm"
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

export default AdminUserManagementPage;
