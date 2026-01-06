import { useState, useEffect } from "react";
import "../styles/Pages.css";
import "../styles/Logs.css";

const API_BASE = "http://localhost:4000";

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterDate, setFilterDate] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "created_at",
    direction: "desc",
  });

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      // ดึง log ล่าสุดจาก backend แล้วมาคัดกรองตามวันที่ฝั่ง frontend
      const response = await fetch(`${API_BASE}/api/logs?limit=100`);
      const result = await response.json();
      
      if (result.success) {
        setLogs(result.data || []);
      } else {
        throw new Error(result.error || "Failed to fetch logs");
      }
    } catch (err) {
      console.error("Error fetching logs:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // Auto refresh every 5 วินาที ตามช่วงวันที่ที่เลือก
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [filterDate]);

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "asc" };
    });
  };

  const isSameDay = (dateTimeValue, dateFilter) => {
    if (!dateFilter) return true;

    // แปลงค่าจาก backend ให้เป็นรูปแบบ YYYY-MM-DD โดยไม่พึ่ง timezone ของ Date()
    if (!dateTimeValue) return false;

    // ถ้า backend ส่ง Date object มา
    if (dateTimeValue instanceof Date) {
      const y = dateTimeValue.getFullYear();
      const m = String(dateTimeValue.getMonth() + 1).padStart(2, "0");
      const d = String(dateTimeValue.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}` === dateFilter;
    }

    const str = String(dateTimeValue);

    // กรณีเป็น ISO string เช่น "2025-12-04T10:02:11.000Z"
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      const dayPart = str.slice(0, 10); // "YYYY-MM-DD"
      return dayPart === dateFilter;
    }

    // ถ้าเป็นฟอร์แมตอื่น ลอง parse ด้วย Date เป็นตัวเลือกสุดท้าย
    try {
      const d = new Date(str);
      if (Number.isNaN(d.getTime())) return false;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}` === dateFilter;
    } catch {
      return false;
    }
  };

  const filteredLogs = logs.filter((log) =>
    isSameDay(log.created_at, filterDate)
  );

  const sortedLogs = [...filteredLogs].sort((a, b) => {
    const { key, direction } = sortConfig;
    const dir = direction === "asc" ? 1 : -1;

    if (key === "created_at") {
      const da = new Date(a.created_at).getTime() || 0;
      const db = new Date(b.created_at).getTime() || 0;
      return (da - db) * dir;
    }

    const va = (a[key] || "").toString().toLowerCase();
    const vb = (b[key] || "").toString().toLowerCase();
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return "N/A";
    try {
      const date = new Date(dateTimeString);
      return date.toLocaleString("th-TH", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch (e) {
      return dateTimeString;
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Logs</h1>
          <p>บันทึกและประวัติการทำงานของระบบ</p>
        </div>
      </div>
      <div className="page-content">
        <div className="card">
          <h2>บันทึกการทำงาน</h2>
          
          <div className="logs-filters">
            <div className="filter-group">
              <label>วันที่</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>
            <button
              className="logs-clear-filter"
              onClick={() => {
                setFilterDate("");
              }}
              disabled={!filterDate}
            >
              แสดงทุกวัน
            </button>
          </div>
          
          {loading && logs.length === 0 && (
            <div className="logs-loading">กำลังโหลดข้อมูล...</div>
          )}
          
          {error && (
            <div className="logs-error">
              <p>เกิดข้อผิดพลาด: {error}</p>
              <button onClick={fetchLogs}>ลองอีกครั้ง</button>
            </div>
          )}
          
          {!loading && !error && logs.length === 0 && (
            <div className="logs-empty">ไม่มีข้อมูลบันทึก</div>
          )}
          
          {!loading && !error && logs.length > 0 && (
            <div className="logs-table-container">
              <table className="logs-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort("created_at")} className="sortable">
                      Time
                      {sortConfig.key === "created_at" && (
                        <span className="sort-indicator">
                          {sortConfig.direction === "asc" ? "▲" : "▼"}
                        </span>
                      )}
                    </th>
                    <th onClick={() => handleSort("type")} className="sortable">
                      Type
                      {sortConfig.key === "type" && (
                        <span className="sort-indicator">
                          {sortConfig.direction === "asc" ? "▲" : "▼"}
                        </span>
                      )}
                    </th>
                    <th onClick={() => handleSort("source")} className="sortable">
                      Source
                      {sortConfig.key === "source" && (
                        <span className="sort-indicator">
                          {sortConfig.direction === "asc" ? "▲" : "▼"}
                        </span>
                      )}
                    </th>
                    <th onClick={() => handleSort("destination")} className="sortable">
                      Destination
                      {sortConfig.key === "destination" && (
                        <span className="sort-indicator">
                          {sortConfig.direction === "asc" ? "▲" : "▼"}
                        </span>
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="log-time">{formatDateTime(log.created_at)}</td>
                      <td className="log-type">
                        <span className={`type-badge type-${log.type.toLowerCase().replace(/\s+/g, '-')}`}>
                          {log.type}
                        </span>
                      </td>
                      <td className="log-source">{log.source || "-"}</td>
                      <td className="log-destination">{log.destination || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Logs;
