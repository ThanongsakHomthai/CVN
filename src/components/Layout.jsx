import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  HiOutlineArrowPath,
  HiOutlineCog6Tooth,
  HiOutlineClipboardDocumentList,
  HiOutlineExclamationTriangle,
  HiOutlineEye,
} from "react-icons/hi2";
import { FaGamepad } from "react-icons/fa";
import "../styles/Layout.css";

const Layout = ({ children, user, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [logoError, setLogoError] = useState(false);

  // Define all menu items
  const allMenuItems = [
    { path: "/manual", label: "Manual & Operate", icon: FaGamepad, roles: ["admin"] },
    { path: "/auto", label: "Auto Condition", icon: HiOutlineArrowPath, roles: ["admin"] },
    { path: "/monitor", label: "Monitor", icon: HiOutlineEye, roles: ["admin", "user"] },
    { path: "/settings", label: "Setting & Config", icon: HiOutlineCog6Tooth, roles: ["admin"] },
    { path: "/logs", label: "Logs", icon: HiOutlineClipboardDocumentList, roles: ["admin", "user"] },
    { path: "/errors", label: "Error Message", icon: HiOutlineExclamationTriangle, roles: ["admin", "user"] },
  ];

  // Filter menu items based on user role
  const menuItems = allMenuItems.filter((item) => {
    if (!user?.role) return false;
    return item.roles.includes(user.role);
  });

  const handleLogout = () => {
    if (window.confirm("คุณต้องการออกจากระบบหรือไม่?")) {
      onLogout();
      navigate("/login");
    }
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-left">
          <div className="logo-container">
            <div className="logo-icon">
              {!logoError ? (
                <img
                  src="/assets/cvn_logo_modern .png"
                  alt="CVN Logo"
                  className="logo-image"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <span className="logo-fallback">CVN</span>
              )}
            </div>
            <span className="logo-text">
              <span className="logo-title-main">AI Technology</span>
              <span className="logo-title-sub">AGV Control VisionNav System</span>
            </span>
          </div>
        </div>
        <div className="header-right">
          <div className="user-info">
            <span className="user-name">{user?.username || "User"}</span>
            <button className="logout-button" onClick={handleLogout}>
              ออกจากระบบ
            </button>
          </div>
        </div>
      </header>

      <div className="app-body">
        <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? "←" : "→"}
          </button>
          <nav className="sidebar-nav">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${
                  location.pathname === item.path ? "active" : ""
                }`}
              >
                <span className="nav-icon">
                  <item.icon size={20} />
                </span>
                {sidebarOpen && <span className="nav-label">{item.label}</span>}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="app-content">{children}</main>
      </div>
    </div>
  );
};

export default Layout;

