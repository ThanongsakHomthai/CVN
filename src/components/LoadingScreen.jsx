import { useEffect, useState } from "react";
import "../styles/LoadingScreen.css";

const LoadingScreen = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Update progress from 0 to 100 over 3 seconds
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + (100 / 30); // 30 updates over 3 seconds (100ms each)
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="loading-screen">
      <div className="loading-content">
        {/* Circular Progress Ring */}
        <div className="loading-ring-container">
          <svg className="loading-ring" viewBox="0 0 200 200">
            {/* Background Circle */}
            <circle
              className="loading-ring-background"
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth="8"
            />
            {/* Progress Circle */}
            <circle
              className="loading-ring-progress"
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="url(#gradient)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 80}`}
              strokeDashoffset={`${2 * Math.PI * 80 * (1 - progress / 100)}`}
              transform="rotate(-90 100 100)"
            />
            {/* Gradient Definition */}
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="50%" stopColor="#0ea5e9" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
          </svg>
          
          {/* Logo in Center */}
          <div className="loading-logo">
            <div className="loading-logo-inner">CVN</div>
          </div>
        </div>

        {/* Loading Text */}
        <div className="loading-text">
          <p className="loading-title">กำลังเข้าสู่ระบบ...</p>
          <p className="loading-subtitle">Control AGV VisionNav</p>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;

