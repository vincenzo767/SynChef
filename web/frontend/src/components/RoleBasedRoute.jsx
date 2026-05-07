import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import PrivateRoute from "./PrivateRoute";

/**
 * RoleBasedRoute - Restricts access to authenticated users with specific roles
 * Usage: <RoleBasedRoute roles={["ADMIN"]}><AdminPage /></RoleBasedRoute>
 */
const RoleBasedRoute = ({ children, roles = [] }) => {
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If no roles specified, allow any authenticated user
  if (roles.length === 0) {
    return <>{children}</>;
  }

  // Check if user's role is in the allowed roles
  if (user?.role && roles.includes(user.role)) {
    return <>{children}</>;
  }

  // User doesn't have required role, redirect to dashboard
  return <Navigate to="/dashboard" replace />;
};

export default RoleBasedRoute;
