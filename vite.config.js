import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  // สำหรับ GitHub Pages - ใช้ base path ตามชื่อ repository
  // ถ้า repository ชื่อ "demo-vn-control" จะเป็น "/demo-vn-control/"
  // ถ้าใช้ custom domain หรือ root domain ให้ตั้งเป็น "/"
  base: process.env.NODE_ENV === 'production' ? process.env.VITE_BASE_PATH || '/' : '/',
});


