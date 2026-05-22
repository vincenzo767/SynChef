import { useEffect, useRef, useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import { setAuthResponse, setLoading, setError } from "../store/authSlice";
import authAPI from "../services/authAPI";
import "./LoginPage.css";

const waitForGoogleIdentity = (timeoutMs = 5000) =>
  new Promise((resolve, reject) => {
    if (globalThis.google?.accounts?.id) {
      resolve(globalThis.google);
      return;
    }

    const startedAt = Date.now();
    const intervalId = setInterval(() => {
      if (globalThis.google?.accounts?.id) {
        clearInterval(intervalId);
        resolve(globalThis.google);
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(intervalId);
        reject(new Error("Google script unavailable"));
      }
    }, 100);
  });

const LoginPage = () => {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [localError, setLocalError] = useState("");
  const [localInfo, setLocalInfo] = useState("");
  const googleButtonRef = useRef(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isAuthenticated, isLoading, user } = useSelector((state) => state.auth);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    const rememberedEmail = localStorage.getItem("rememberedLoginEmail");
    if (rememberedEmail) {
      setEmailOrUsername(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      const destination = user?.role === "ADMIN" ? "/admin/dashboard" : "/dashboard";
      navigate(destination, { replace: true });
    }
  }, [isAuthenticated, navigate, user]);

  useEffect(() => {
    let cancelled = false;

    const renderGoogleButton = async () => {
      if (!googleClientId || !googleButtonRef.current) {
        return;
      }

      try {
        await waitForGoogleIdentity();
        if (cancelled || !googleButtonRef.current) {
          return;
        }

        globalThis.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredential,
        });

        globalThis.google.accounts.id.renderButton(googleButtonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text: "signin_with",
          width: 160,
          locale: "en"
        });
      } catch {
        if (!cancelled) {
          setLocalInfo("Google sign-in is taking longer than usual. Please refresh and try again.");
        }
      }
    };

    renderGoogleButton();

    return () => {
      cancelled = true;
      if (googleButtonRef.current) {
        googleButtonRef.current.innerHTML = "";
      }
    };
  }, [googleClientId]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLocalError("");
    setLocalInfo("");
    dispatch(setLoading(true));
    try {
      if (rememberMe) {
        localStorage.setItem("rememberedLoginEmail", emailOrUsername);
      } else {
        localStorage.removeItem("rememberedLoginEmail");
      }
      const response = await authAPI.login({ emailOrUsername, password });
      const role = response.data.role || "USER";
      dispatch(setAuthResponse({
        token: response.data.token,
        user: {
          id: response.data.id,
          email: response.data.email,
          username: response.data.username,
          fullName: response.data.fullName,
          profileImageUrl: response.data.profileImageUrl,
          emailVerified: response.data.emailVerified,
          countryCode: response.data.countryCode || null,
          countryName: response.data.countryName || null,
          role,
          favoriteRecipeIds: response.data.favoriteRecipeIds || []
        }
      }));
      navigate(role === "ADMIN" ? "/admin/dashboard" : "/dashboard");
    } catch (err) {
      const message = err.response?.data?.message
        || (err.request
          ? "Cannot reach backend API. Start backend server on http://localhost:8080."
          : "Login failed. Please check your credentials.");
      setLocalError(message);
      dispatch(setError(message));
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handleForgotPassword = () => {
    setLocalError("");
    setLocalInfo("Forgot password is not available yet. Please contact support.");
  };

  const handleGoogleCredential = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      setLocalError("Google did not return a valid credential.");
      return;
    }

    dispatch(setLoading(true));
    setLocalError("");
    setLocalInfo("");

    try {
      const response = await authAPI.googleLogin({ idToken: credentialResponse.credential });
      const role = response.data.role || "USER";
      dispatch(setAuthResponse({
        token: response.data.token,
        user: {
          id: response.data.id,
          email: response.data.email,
          username: response.data.username,
          fullName: response.data.fullName,
          profileImageUrl: response.data.profileImageUrl,
          emailVerified: response.data.emailVerified,
          countryCode: response.data.countryCode || null,
          countryName: response.data.countryName || null,
          role,
          favoriteRecipeIds: response.data.favoriteRecipeIds || []
        }
      }));
      navigate(role === "ADMIN" ? "/admin/dashboard" : "/dashboard");
    } catch (err) {
      const message = err.response?.data?.message
        || (err.request
          ? "Cannot reach backend API. Start backend server on http://localhost:8080."
          : "Google login failed. Please try again.");
      setLocalError(message);
      dispatch(setError(message));
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handleSocialLoginClick = (provider) => {
    setLocalError("");
    setLocalInfo(`${provider} login is not available yet.`);
  };

  return (
    <div className="login-page-shell">
      <motion.div
        className="auth-layout"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -14 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <section className="auth-brand-panel">
          <img src="/synchef-logo.png" alt="SynChef" className="auth-brand-logo" />
          <h1 className="auth-brand-title">
            Discover <span>Global</span> Flavors
          </h1>
          <p className="auth-brand-subtitle">
            Explore authentic recipes from around the world, powered by AI-driven recommendations tailored to your taste.
          </p>
        </section>

        <section className="login-card">
          <div className="login-header">
            <h1>Recipe Discovery</h1>
            <p>Explore Global Culinary Traditions</p>
          </div>

          {localError && <div className="login-alert login-alert-error">{localError}</div>}
          {localInfo && <div className="login-alert login-alert-info">{localInfo}</div>}

          <form onSubmit={handleLogin} className="login-form" noValidate>
            <div className="login-field">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="password">Password</label>
              <div className="password-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <div className="login-row">
              <label className="remember-me-control" htmlFor="rememberMe">
                <input
                  id="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>
              <button type="button" className="forgot-password-btn" onClick={handleForgotPassword}>
                Forgot password?
              </button>
            </div>

            <button type="submit" className="login-submit-btn" disabled={isLoading}>
              {isLoading ? "Signing In..." : "Sign In"}
            </button>
          </form>

          <div className="signup-row">
            <p>Don't have an account? <Link to="/register">Sign up</Link></p>
          </div>

          <div className="social-login-divider">
            <span>Or continue with</span>
          </div>

          <div className="social-login-grid">
            <div className="google-button-shell" ref={googleButtonRef} aria-label="Google sign-in button" />
            <button type="button" className="social-btn" onClick={() => handleSocialLoginClick("Facebook")}>
              <svg className="social-icon" fill="#1877F2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M24 12.073C24 5.446 18.627.073 12 .073S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              <span>Facebook</span>
            </button>
          </div>
        </section>
      </motion.div>
    </div>
  );
};

export default LoginPage;
