import { useState } from "react";
import "../styles/Login.css";
import LoadingScreen from "../components/LoadingScreen";

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError("กรุณากรอก Username และ Password");
      return;
    }
    
    // Validate credentials and determine role
    let role = null;
    if (username === "admin" && password === "admin") {
      role = "admin";
    } else if (username === "user" && password === "1234") {
      role = "user";
    } else {
      setError("Username หรือ Password ไม่ถูกต้อง");
      return;
    }
    
    // Show loading screen
    setIsLoading(true);
    
    // Wait 3 seconds then call onLogin
    setTimeout(() => {
      onLogin({ username, role });
    }, 3000);
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">CVN</div>
          <h1>Control AGV VisionNav</h1>
          <p>เข้าสู่ระบบ</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="กรอก Username"
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="กรอก Password"
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="login-button">
            เข้าสู่ระบบ
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;

