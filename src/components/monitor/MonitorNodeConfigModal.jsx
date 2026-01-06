import React, { useState, useEffect } from "react";

const API_BASE = "http://localhost:4000";

const MonitorNodeConfigModal = ({ node, onSave, onClose, parks, agvs, isRunning, onDelete }) => {
  const [config, setConfig] = useState(node?.data?.config || {});

  useEffect(() => {
    setConfig(node?.data?.config || {});
  }, [node]);

  if (!node) return null;

  const handleSave = () => {
    if (isRunning) {
      return;
    }
    onSave(node.id, config);
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm(`คุณต้องการลบ Node "${node.id}" (${node.type}) ใช่หรือไม่?`)) {
      onDelete(node.id);
      onClose();
    }
  };

  const renderConfigForm = () => {
    switch (node.type) {
      case "lamp":
        return (
          <LampConfigForm config={config} setConfig={setConfig} />
        );
      case "counter":
        return (
          <CounterConfigForm config={config} setConfig={setConfig} parks={parks || []} />
        );
      case "park":
        return (
          <ParkConfigForm config={config} setConfig={setConfig} parks={parks || []} />
        );
      case "map":
        return (
          <MapConfigForm config={config} setConfig={setConfig} />
        );
      case "label":
        return (
          <LabelConfigForm config={config} setConfig={setConfig} />
        );
      case "battery":
        return (
          <BatteryConfigForm config={config} setConfig={setConfig} agvs={agvs || []} />
        );
      case "date":
        return (
          <DateConfigForm config={config} setConfig={setConfig} />
        );
      default:
        return null;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Configure {node.type} Node</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {isRunning && (
            <div className="alert alert-warning" style={{ marginBottom: "12px" }}>
              ขณะนี้ Monitor กำลังทำงานอยู่ ไม่สามารถบันทึกการตั้งค่าได้ (กด Stop ก่อน)
            </div>
          )}
          {renderConfigForm()}
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save" onClick={handleSave} disabled={isRunning}>Save</button>
          {!isRunning && (
            <button className="btn-delete" onClick={handleDelete} style={{ marginLeft: "auto" }}>
              🗑️ ลบ Node
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const LampConfigForm = ({ config, setConfig }) => {
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        setLoadingDevices(true);
        setError(null);
        const response = await fetch(`${API_BASE}/api/iot/modbus/devices`);
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || `HTTP ${response.status}`);
        }
        setDevices(result.devices || []);
      } catch (err) {
        console.error("Error loading Modbus devices:", err);
        setError(err.message);
      } finally {
        setLoadingDevices(false);
      }
    };

    fetchDevices();
  }, []);

  const addressOptions = [
    "in_1","in_2","in_3","in_4","in_5","in_6","in_7","in_8",
    "out_1","out_2","out_3","out_4","out_5","out_6","out_7","out_8",
  ];

  return (
    <div className="config-form">
      <div className="form-group">
        <label>Label *</label>
        <input
          type="text"
          value={config.label || ""}
          onChange={(e) => setConfig({ ...config, label: e.target.value })}
          placeholder="เช่น Lamp Modbus 1"
        />
      </div>

      <div className="form-group">
        <label>Modbus IP (ip_address)</label>
        <select
          value={config.ipAddress || ""}
          onChange={(e) => setConfig({ ...config, ipAddress: e.target.value })}
        >
          <option value="">-- เลือก IP --</option>
          {devices.map((ip) => (
            <option key={ip} value={ip}>
              {ip}
            </option>
          ))}
        </select>
        {loadingDevices && (
          <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 4 }}>
            กำลังโหลดรายการ IP...
          </div>
        )}
        {error && (
          <div style={{ fontSize: "0.8rem", color: "#b91c1c", marginTop: 4 }}>
            โหลด IP ไม่สำเร็จ: {error}
          </div>
        )}
      </div>

      <div className="form-group">
        <label>Address (in_1..in_8, out_1..out_8)</label>
        <select
          value={config.address || ""}
          onChange={(e) => setConfig({ ...config, address: e.target.value })}
        >
          <option value="">-- เลือก Address --</option>
          {addressOptions.map((addr) => (
            <option key={addr} value={addr}>
              {addr}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>สีตอน On</label>
        <input
          type="color"
          value={config.color || "#10b981"}
          onChange={(e) => setConfig({ ...config, color: e.target.value })}
        />
      </div>

      <div
        className="form-info"
        style={{
          padding: "10px",
          background: "#f0f9ff",
          borderRadius: "6px",
          fontSize: "0.8rem",
          color: "#0369a1",
          marginTop: "8px",
        }}
      >
        <strong>การทำงาน:</strong> Lamp จะอ่านค่าจากตาราง <code>cvn_data_table_modbus</code>{" "}
        ที่ IP และ Address ที่เลือก ทุก ๆ 1 วินาที โดยถือว่า <code>0 = Off</code>,{" "}
        <code>1 = On</code> แล้วเปลี่ยนสี Lamp ให้ตรงกับสถานะ
      </div>
    </div>
  );
};

const CounterConfigForm = ({ config, setConfig, parks }) => {
  const groups = Array.from(
    new Set((parks || []).map((p) => p.groups).filter(Boolean))
  );

  return (
    <div className="config-form">
      <div className="form-group">
        <label>Label *</label>
        <input
          type="text"
          value={config.label || ""}
          onChange={(e) => setConfig({ ...config, label: e.target.value })}
          placeholder="Enter counter label"
        />
      </div>
      <div className="form-group">
        <label>Group *</label>
        <select
          value={config.group || ""}
          onChange={(e) => setConfig({ ...config, group: e.target.value })}
        >
          <option value="">-- เลือก Group --</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "4px" }}>
          เลือก Group เพื่อนับจำนวนเมื่อ use_state เปลี่ยนจาก 1 เป็น 3
        </div>
      </div>
      <div
        className="form-info"
        style={{
          padding: "10px",
          background: "#f0f9ff",
          borderRadius: "6px",
          fontSize: "0.8rem",
          color: "#0369a1",
          marginTop: "8px",
        }}
      >
        <strong>การทำงาน:</strong> Counter จะนับเพิ่ม +1 เมื่อใน Group ที่เลือกมี Park ใดๆ ที่ use_state เปลี่ยนจาก 1 เป็น 3 (นับแค่จังหวะแรกที่มีการอัพเดท)
      </div>
    </div>
  );
};

const ParkConfigForm = ({ config, setConfig, parks }) => {
  const groups = Array.from(
    new Set((parks || []).map((p) => p.groups).filter(Boolean))
  );

  const filteredParks = (parks || []).filter(
    (p) => !config.group || p.groups === config.group
  );

  return (
    <div className="config-form">
      <div className="form-group">
        <label>Group *</label>
        <select
          value={config.group || ""}
          onChange={(e) =>
            setConfig({
              ...config,
              group: e.target.value,
              externalName: "", // reset externalName เมื่อเปลี่ยน group
            })
          }
        >
          <option value="">-- เลือก Group --</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>External Name *</label>
        <select
          value={config.externalName || ""}
          onChange={(e) =>
            setConfig({
              ...config,
              externalName: e.target.value,
            })
          }
          disabled={!config.group}
        >
          <option key="placeholder" value="">
            {config.group ? "-- เลือก External Name --" : "เลือก Group ก่อน"}
          </option>
          {filteredParks.map((park, index) => {
            const key =
              park.external_id != null && park.external_id !== ""
                ? `park-${park.external_id}`
                : `park-${park.groups || "g"}-${park.external_name || "name"}-${index}`;
            return (
              <option key={key} value={park.external_name}>
                {park.external_name}
              </option>
            );
          })}
        </select>
      </div>

      <div className="form-group">
        <label>Park Box Width (px)</label>
        <input
          type="number"
          min="60"
          max="400"
          placeholder="40 - 400"
          // value={config.boxWidth || 140}
          onChange={(e) =>
            setConfig({
              ...config,
              boxWidth: parseInt(e.target.value, 10) || 140,
            })
          }
        />
      </div>

      <div className="form-group">
        <label>Park Box Height (px)</label>
        <input
          type="number"
          min="40"
          max="300"
          placeholder="40 - 400"
          // value={config.boxHeight || 70}
          onChange={(e) =>
            setConfig({
              ...config,
              boxHeight: parseInt(e.target.value, 10) || 70,
            })
          }
        />
      </div>

      <div
        className="form-info"
        style={{
          padding: "10px",
          background: "#f0f9ff",
          borderRadius: "6px",
          fontSize: "0.8rem",
          color: "#0369a1",
          marginTop: "8px",
        }}
      >
        <strong>การทำงาน:</strong> Park node จะเปลี่ยนสีกรอบตามสถานะ Park
      </div>
    </div>
  );
};

const LabelConfigForm = ({ config, setConfig }) => {
  return (
    <div className="config-form">
      <div className="form-group">
        <label>ข้อความ (Label Text)</label>
        <textarea
          value={config.text || ""}
          onChange={(e) => setConfig({ ...config, text: e.target.value })}
          rows={3}
          placeholder="ข้อความที่ต้องการแสดงบน Label"
        />
      </div>
      <div className="form-group">
        <label>ขนาดตัวอักษร (px)</label>
        <input
          type="number"
          min="8"
          max="72"
          value={config.fontSize || 16}
          onChange={(e) =>
            setConfig({
              ...config,
              fontSize: parseInt(e.target.value, 10) || 16,
            })
          }
        />
      </div>
      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={!!config.bold}
            onChange={(e) =>
              setConfig({
                ...config,
                bold: e.target.checked,
              })
            }
          />{" "}
          ตัวหนา (Bold)
        </label>
      </div>
      <div className="form-group">
        <label>สีตัวอักษร</label>
        <input
          type="color"
          value={config.color || "#e5e7eb"}
          onChange={(e) =>
            setConfig({
              ...config,
              color: e.target.value,
            })
          }
        />
      </div>
      <div className="form-group">
        <label>จัดตำแหน่งข้อความ</label>
        <select
          value={config.align || "center"}
          onChange={(e) =>
            setConfig({
              ...config,
              align: e.target.value,
            })
          }
        >
          <option value="left">ชิดซ้าย</option>
          <option value="center">กึ่งกลาง</option>
          <option value="right">ชิดขวา</option>
        </select>
      </div>
      <div
        className="form-info"
        style={{
          padding: "10px",
          background: "#f0f9ff",
          borderRadius: "6px",
          fontSize: "0.8rem",
          color: "#0369a1",
          marginTop: "8px",
        }}
      >
        หลังจากกด Run, Label node จะแสดงข้อความตามที่กำหนดไว้บน canvas
      </div>
    </div>
  );
};

const MapConfigForm = ({ config, setConfig }) => {
  // Load saved map settings from localStorage (same as ManualOperate)
  const loadMapSettings = () => {
    const savedOrigin = localStorage.getItem("mapOriginOffset");
    const savedMapSize = localStorage.getItem("mapSizeMeters");
    const savedScales = localStorage.getItem("mapScales");

    if (savedOrigin && !config.originOffset) {
      try {
        const parsed = JSON.parse(savedOrigin);
        setConfig({ ...config, originOffset: { x: parsed.x || 0, y: parsed.y || 0 } });
      } catch (e) {
        console.error("Error loading origin offset:", e);
      }
    }

    if (savedMapSize && (!config.mapWidth || !config.mapHeight)) {
      try {
        const parsed = JSON.parse(savedMapSize);
        setConfig({ ...config, mapWidth: parsed.width || 50, mapHeight: parsed.height || 50 });
      } catch (e) {
        console.error("Error loading map size:", e);
      }
    }

    if (savedScales && (!config.scaleX || !config.scaleY)) {
      try {
        const parsed = JSON.parse(savedScales);
        setConfig({ ...config, scaleX: parsed.scaleX || 10, scaleY: parsed.scaleY || 10 });
      } catch (e) {
        console.error("Error loading map scales:", e);
      }
    }
  };

  useEffect(() => {
    loadMapSettings();
  }, []);

  // Default values for checkboxes
  const showMapImage = config.showMapImage !== undefined ? config.showMapImage : true;
  const showAgvIcons = config.showAgvIcons !== undefined ? config.showAgvIcons : true;
  
  // Default values for offset (แสดงเป็นค่าว่างถ้ายังไม่ได้ตั้งค่า)
  const offsetX = config.offsetX !== undefined && config.offsetX !== null ? String(config.offsetX) : '';
  const offsetY = config.offsetY !== undefined && config.offsetY !== null ? String(config.offsetY) : '';

  return (
    <div className="config-form">
      {/* ส่วนที่ 1: การแสดงรูปภาพแผนที่ */}
      <div style={{
        padding: "16px",
        background: "#f8fafc",
        borderRadius: "8px",
        marginBottom: "16px",
        border: "1px solid #e2e8f0"
      }}>
        <h3 style={{
          margin: "0 0 12px 0",
          fontSize: "1rem",
          fontWeight: "600",
          color: "#1e293b"
        }}>📷 ส่วนที่ 1: รูปภาพแผนที่</h3>
        <div className="form-group">
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showMapImage}
              onChange={(e) =>
                setConfig({
                  ...config,
                  showMapImage: e.target.checked,
                })
              }
            />
            <span>แสดงรูปภาพแผนที่ (Map Image)</span>
          </label>
          <div style={{
            fontSize: "0.8rem",
            color: "#64748b",
            marginTop: "4px",
            paddingLeft: "24px"
          }}>
            เมื่อเลือก: จะแสดงรูปภาพแผนที่ (/assets/Map.PNG) เป็นพื้นหลัง
          </div>
        </div>
      </div>

      {/* ส่วนที่ 2: การแสดง Icon AGV */}
      <div style={{
        padding: "16px",
        background: "#f8fafc",
        borderRadius: "8px",
        marginBottom: "16px",
        border: "1px solid #e2e8f0"
      }}>
        <h3 style={{
          margin: "0 0 12px 0",
          fontSize: "1rem",
          fontWeight: "600",
          color: "#1e293b"
        }}>🚗 ส่วนที่ 2: Icon AGV</h3>
        <div className="form-group">
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showAgvIcons}
              onChange={(e) =>
                setConfig({
                  ...config,
                  showAgvIcons: e.target.checked,
                })
              }
            />
            <span>แสดง Icon AGV</span>
          </label>
          <div style={{
            fontSize: "0.8rem",
            color: "#64748b",
            marginTop: "4px",
            paddingLeft: "24px"
          }}>
            เมื่อเลือก: จะแสดง icon AGV (/assets/SLIM/auto.png) บนตำแหน่งที่ AGV อยู่
          </div>
        </div>
      </div>

      {/* ส่วนที่ 3: Offset สำหรับปรับตำแหน่ง Icon */}
      <div style={{
        padding: "16px",
        background: "#f8fafc",
        borderRadius: "8px",
        marginBottom: "16px",
        border: "1px solid #e2e8f0"
      }}>
        <h3 style={{
          margin: "0 0 12px 0",
          fontSize: "1rem",
          fontWeight: "600",
          color: "#1e293b"
        }}>⚙️ ส่วนที่ 3: Offset ตำแหน่ง Icon</h3>
        <div className="form-group">
          <label>Offset แกน X (pixels)</label>
          <input
            type="number"
            value={offsetX}
            onChange={(e) => {
              const inputValue = e.target.value;
              if (inputValue === '' || inputValue === '-') {
                setConfig({ ...config, offsetX: null });
              } else {
                const value = parseFloat(inputValue);
                if (!isNaN(value)) {
                  setConfig({ ...config, offsetX: value });
                }
              }
            }}
            placeholder="0"
            step="1"
            min="-9999"
            max="9999"
          />
          <div style={{
            fontSize: "0.8rem",
            color: "#64748b",
            marginTop: "4px"
          }}>
            ค่าบวก = เลื่อนไปทางขวา, ค่าลบ = เลื่อนไปทางซ้าย
          </div>
        </div>
        <div className="form-group">
          <label>Offset แกน Y (pixels)</label>
          <input
            type="number"
            value={offsetY}
            onChange={(e) => {
              const inputValue = e.target.value;
              if (inputValue === '' || inputValue === '-') {
                setConfig({ ...config, offsetY: null });
              } else {
                const value = parseFloat(inputValue);
                if (!isNaN(value)) {
                  setConfig({ ...config, offsetY: value });
                }
              }
            }}
            placeholder="0"
            step="1"
            min="-9999"
            max="9999"
          />
          <div style={{
            fontSize: "0.8rem",
            color: "#64748b",
            marginTop: "4px"
          }}>
            ค่าบวก = เลื่อนลง, ค่าลบ = เลื่อนขึ้น
          </div>
        </div>
        <div style={{
          fontSize: "0.8rem",
          color: "#64748b",
          marginTop: "8px",
          padding: "8px",
          background: "#f1f5f9",
          borderRadius: "4px"
        }}>
          <strong>คำแนะนำ:</strong> ใช้ offset เพื่อปรับตำแหน่ง icon AGV ให้ตรงกับหน้า Manual & Operate หากตำแหน่งไม่ตรงกัน
        </div>
      </div>

      <div className="form-info" style={{
        padding: "12px",
        background: "#f0f9ff",
        borderRadius: "6px",
        fontSize: "0.85rem",
        color: "#0369a1",
        marginTop: "8px"
      }}>
        <strong>หมายเหตุ:</strong> Map node จะใช้ข้อมูลจาก Manual & Operate อัตโนมัติ (ข้อมูล AGV และการตั้งค่าแผนที่จาก localStorage)
      </div>
    </div>
  );
};

const BatteryConfigForm = ({ config, setConfig, agvs }) => {
  // โหลดรายการ AGV สำหรับใช้ใน dropdown (ให้เลือกได้แม้ยังไม่กด Run)
  const [localAgvs, setLocalAgvs] = useState([]);

  // เลือก source ข้อมูล AGV: ใช้ agvs จาก props ถ้ามี, ถ้าไม่มีใช้ localAgvs ที่โหลดเอง
  const sourceAgvs = React.useMemo(
    () => (Array.isArray(agvs) && agvs.length > 0 ? agvs : localAgvs),
    [agvs, localAgvs]
  );

  useEffect(() => {
    // ถ้า parent ยังไม่ได้ส่ง agvs มา ให้โหลดเองจาก API
    if (Array.isArray(agvs) && agvs.length > 0) {
      return;
    }

    let cancelled = false;

    const fetchAgvsForBattery = async () => {
      try {
        const response = await fetch(`${API_BASE}/agvs`);
        if (!response.ok) return;
        const data = await response.json();
        const normalized = Array.isArray(data)
          ? data
          : data?.agvs || data?.data || [];
        if (!cancelled) {
          setLocalAgvs(normalized || []);
        }
      } catch (err) {
        console.error("[BatteryConfigForm] Error loading AGVs:", err);
      }
    };

    fetchAgvsForBattery();

    return () => {
      cancelled = true;
    };
  }, [agvs]);

  // ดึงรายการ AGV IDs โดย "พยายามใช้ agv_id ก่อน" แต่ fallback ไปที่ id / name เพื่อให้มีค่าให้เลือก
  const agvIds = React.useMemo(() => {
    const ids = new Set();
    (sourceAgvs || []).forEach((agv) => {
      if (!agv) return;
      // ใช้ agv_id เป็นหลัก ถ้ามี
      if (agv.agv_id) {
        ids.add(String(agv.agv_id));
        return;
      }
      // เผื่อกรณี API ยังส่งมาเป็น id หรือ name เหมือนหน้าจออื่น
      if (agv.id) {
        ids.add(String(agv.id));
        return;
      }
      if (agv.name) {
        ids.add(String(agv.name));
      }
    });
    return Array.from(ids).sort();
  }, [sourceAgvs]);

  return (
    <div className="config-form">
      <div className="form-group">
        <label>Label *</label>
        <input
          type="text"
          value={config.label || ""}
          onChange={(e) => setConfig({ ...config, label: e.target.value })}
          placeholder="เช่น Battery AGV 0001"
        />
      </div>

      <div className="form-group">
        <label>AGV ID *</label>
        <select
          value={config.agvId || ""}
          onChange={(e) => setConfig({ ...config, agvId: e.target.value })}
        >
          <option value="">-- เลือก AGV ID --</option>
          {agvIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        {agvIds.length === 0 && (
          <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 4 }}>
            ยังไม่มีข้อมูล AGV (จะแสดงเมื่อ Monitor ทำงาน)
          </div>
        )}
      </div>

      <div
        className="form-info"
        style={{
          padding: "10px",
          background: "#f0f9ff",
          borderRadius: "6px",
          fontSize: "0.8rem",
          color: "#0369a1",
          marginTop: "8px",
        }}
      >
        <strong>การทำงาน:</strong> Battery node จะดึงค่าข้อมูล "battery" จาก JSON ใน{" "}
        <code>cvn_data_agv</code> ใน field <code>agv_data</code> และนำค่ามาแสดงเป็นเปอร์เซ็นต์ (%){" "}
        เมื่อ node เริ่มทำการ run อัพเดททุก 2 วินาที
      </div>
    </div>
  );
};

const DateConfigForm = ({ config, setConfig }) => {
  const formatOptions = [
    { value: "datetime", label: "วันที่และเวลา (Date & Time)" },
    { value: "date", label: "วันที่เท่านั้น (Date Only)" },
    { value: "time", label: "เวลาเท่านั้น (Time Only)" },
    { value: "datetime-short", label: "วันที่และเวลาสั้น (Short)" },
    { value: "datetime-long", label: "วันที่และเวลายาว (Long)" },
  ];

  const formatDate = (format) => {
    const now = new Date();
    switch (format) {
      case "date":
        return now.toLocaleDateString("th-TH", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
      case "time":
        return now.toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      case "datetime-short":
        return now.toLocaleString("th-TH", {
          year: "2-digit",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
      case "datetime-long":
        return now.toLocaleString("th-TH", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      case "datetime":
      default:
        return now.toLocaleString("th-TH", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
    }
  };

  return (
    <div className="config-form">
      <div className="form-group">
        <label>Label *</label>
        <input
          type="text"
          value={config.label || ""}
          onChange={(e) => setConfig({ ...config, label: e.target.value })}
          placeholder="เช่น Date & Time"
        />
      </div>

      <div className="form-group">
        <label>รูปแบบการแสดงผล (Format)</label>
        <select
          value={config.format || "datetime"}
          onChange={(e) => setConfig({ ...config, format: e.target.value })}
        >
          {formatOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "4px" }}>
          ตัวอย่าง: {formatDate(config.format || "datetime")}
        </div>
      </div>

      <div className="form-group">
        <label>ขนาดตัวอักษร (px)</label>
        <input
          type="number"
          min="8"
          max="72"
          value={config.fontSize || 16}
          onChange={(e) =>
            setConfig({
              ...config,
              fontSize: parseInt(e.target.value, 10) || 16,
            })
          }
        />
      </div>

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={!!config.bold}
            onChange={(e) =>
              setConfig({
                ...config,
                bold: e.target.checked,
              })
            }
          />{" "}
          ตัวหนา (Bold)
        </label>
      </div>

      <div className="form-group">
        <label>สีตัวอักษร</label>
        <input
          type="color"
          value={config.color || "#e5e7eb"}
          onChange={(e) =>
            setConfig({
              ...config,
              color: e.target.value,
            })
          }
        />
      </div>

      <div className="form-group">
        <label>สีพื้นหลัง</label>
        <input
          type="color"
          value={config.backgroundColor || "#000000"}
          onChange={(e) => {
            const color = e.target.value;
            setConfig({
              ...config,
              backgroundColor: color === "#000000" ? "transparent" : color,
            });
          }}
        />
        <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "4px" }}>
          เลือกสีดำ (#000000) เพื่อใช้พื้นหลังโปร่งใส
        </div>
        {config.backgroundColor && config.backgroundColor !== "transparent" && (
          <button
            type="button"
            onClick={() => setConfig({ ...config, backgroundColor: "transparent" })}
            style={{
              marginTop: "4px",
              padding: "4px 8px",
              fontSize: "0.75rem",
              backgroundColor: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            ล้างสีพื้นหลัง
          </button>
        )}
      </div>

      <div className="form-group">
        <label>จัดตำแหน่งข้อความ</label>
        <select
          value={config.align || "center"}
          onChange={(e) =>
            setConfig({
              ...config,
              align: e.target.value,
            })
          }
        >
          <option value="left">ชิดซ้าย</option>
          <option value="center">กึ่งกลาง</option>
          <option value="right">ชิดขวา</option>
        </select>
      </div>

      <div
        className="form-info"
        style={{
          padding: "10px",
          background: "#f0f9ff",
          borderRadius: "6px",
          fontSize: "0.8rem",
          color: "#0369a1",
          marginTop: "8px",
        }}
      >
        <strong>การทำงาน:</strong> Date node จะแสดงเวลาและวันที่ปัจจุบัน อัพเดททุก 1 วินาที ตามรูปแบบที่เลือก
      </div>
    </div>
  );
};

export default MonitorNodeConfigModal;

