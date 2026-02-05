import { Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import HomePage from './pages/HomePage';
import FlavorMapPage from './pages/FlavorMapPage';
import RecipeDetailPage from './pages/RecipeDetailPage';
import CookingModePage from './pages/CookingModePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Navigation from './components/Navigation';
import PrivateRoute from './components/PrivateRoute';
import './App.css';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id-for-development';

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="app">
        <Navigation />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/flavor-map" element={<FlavorMapPage />} />
          <Route path="/recipe/:id" element={<RecipeDetailPage />} />
          <Route path="/cooking/:id" element={<CookingModePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Routes>
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;
