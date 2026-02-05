import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { setAuthResponse, setLoading, setError } from '../store/authSlice';
import authAPI from '../services/authAPI';
import '../styles/Auth.css';

const LoginPage: React.FC = () => {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    dispatch(setLoading(true));

    try {
      const response = await authAPI.login({
        emailOrUsername,
        password,
      });

      dispatch(setAuthResponse({
        token: response.data.token,
        user: {
          id: response.data.id,
          email: response.data.email,
          username: response.data.username,
          fullName: response.data.fullName,
          profileImageUrl: response.data.profileImageUrl,
          emailVerified: response.data.emailVerified,
        }
      }));

      navigate('/');
    } catch (err: any) {
      const message = err.response?.data?.message || 'Login failed. Please check your credentials.';
      setLocalError(message);
      dispatch(setError(message));
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    setLocalError('');
    dispatch(setLoading(true));

    try {
      const response = await authAPI.loginWithGoogle({
        googleToken: credentialResponse.credential || '',
      });

      dispatch(setAuthResponse({
        token: response.data.token,
        user: {
          id: response.data.id,
          email: response.data.email,
          username: response.data.username,
          fullName: response.data.fullName,
          profileImageUrl: response.data.profileImageUrl,
          emailVerified: response.data.emailVerified,
        }
      }));

      navigate('/');
    } catch (err: any) {
      const message = err.response?.data?.message || 'Google login failed. Please try again.';
      setLocalError(message);
      dispatch(setError(message));
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handleGoogleError = () => {
    setLocalError('Google sign-in failed. Please try again.');
    dispatch(setError('Google sign-in failed'));
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Welcome Back</h1>
        <p>Enter your credentials to access your kitchen</p>

        {localError && <div className="auth-error">{localError}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="emailOrUsername">Email or Username</label>
            <input
              id="emailOrUsername"
              type="text"
              placeholder="your-email@example.com or username"
              value={emailOrUsername}
              onChange={(e) => setEmailOrUsername(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="auth-btn">
            Sign In
          </button>
        </form>

        <div className="auth-divider">
          <span>Or continue with</span>
        </div>

        <div className="google-login-wrapper">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            theme="dark"
            size="large"
            width="100%"
          />
        </div>

        <div className="auth-footer">
          <p>Don't have an account? <Link to="/register">Sign up</Link></p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
