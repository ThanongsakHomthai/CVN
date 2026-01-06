import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import ManualOperate from "./pages/ManualOperate";
import AutoCondition from "./pages/AutoConditionFlow";
import Monitor from "./pages/Monitor";
import Settings from "./pages/Settings";
import Logs from "./pages/Logs";
import ErrorMessage from "./pages/ErrorMessage";
import "./styles/Layout.css";
import "./styles/Pages.css";

// Component to handle GitHub Pages 404 redirect
const GitHubPagesRedirect = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have a redirect query parameter from 404.html
    // Format: ?redirect=/path/to/page
    const searchParams = new URLSearchParams(location.search);
    const redirectPath = searchParams.get('redirect');
    
    if (redirectPath) {
      // Remove the redirect parameter from URL and navigate to the path
      searchParams.delete('redirect');
      const newSearch = searchParams.toString();
      const newPath = redirectPath + (newSearch ? '?' + newSearch : '') + location.hash;
      navigate(newPath, { replace: true });
    }
  }, [location.search, location.hash, navigate]);

  return null;
};

const App = () => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  const ProtectedRoute = ({ children }) => {
    return user ? children : <Navigate to="/login" replace />;
  };

  // Route protection based on role
  const RoleProtectedRoute = ({ children, allowedRoles }) => {
    if (!user) {
      return <Navigate to="/login" replace />;
    }
    if (!allowedRoles.includes(user.role)) {
      // Redirect to first allowed route based on role
      if (user.role === "user") {
        return <Navigate to="/monitor" replace />;
      }
      return <Navigate to="/manual" replace />;
    }
    return children;
  };

  // Get base path from environment variable (for GitHub Pages)
  // Default to "/" for local development
  const basename = import.meta.env.VITE_BASE_PATH || '/';

  return (
    <BrowserRouter basename={basename}>
      <GitHubPagesRedirect />
      <Routes>
        <Route
          path="/login"
          element={
            user ? (
              user.role === "admin" ? (
                <Navigate to="/manual" replace />
              ) : (
                <Navigate to="/monitor" replace />
              )
            ) : (
              <Login onLogin={handleLogin} />
            )
          }
        />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout user={user} onLogout={handleLogout}>
                <Routes>
                  <Route 
                    path="/" 
                    element={
                      user?.role === "admin" ? (
                        <Navigate to="/manual" replace />
                      ) : (
                        <Navigate to="/monitor" replace />
                      )
                    } 
                  />
                  <Route 
                    path="/manual" 
                    element={
                      <RoleProtectedRoute allowedRoles={["admin"]}>
                        <ManualOperate />
                      </RoleProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/auto" 
                    element={
                      <RoleProtectedRoute allowedRoles={["admin"]}>
                        <AutoCondition />
                      </RoleProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/monitor" 
                    element={
                      <RoleProtectedRoute allowedRoles={["admin", "user"]}>
                        <Monitor user={user} />
                      </RoleProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/settings" 
                    element={
                      <RoleProtectedRoute allowedRoles={["admin"]}>
                        <Settings />
                      </RoleProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/logs" 
                    element={
                      <RoleProtectedRoute allowedRoles={["admin", "user"]}>
                        <Logs />
                      </RoleProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/errors" 
                    element={
                      <RoleProtectedRoute allowedRoles={["admin", "user"]}>
                        <ErrorMessage />
                      </RoleProtectedRoute>
                    } 
                  />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
