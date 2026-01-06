import { useState, useEffect } from "react";

// Import useEffect for MoveConfigForm

const NodeConfigModal = ({ node, onSave, onClose, iotModules, parks, isRunning, onDelete }) => {
  const [config, setConfig] = useState(node?.data?.config || {});

  useEffect(() => {
    setConfig(node?.data?.config || {});
  }, [node]);

  if (!node) return null;

  const handleSave = () => {
    if (isRunning) {
      return;
    }
    // Just save the config - Set node will execute when flow runs and previous node connects
    onSave(node.id, config);
    onClose();
  };

  const renderConfigForm = () => {
    switch (node.type) {
      case "trigger":
        return (
          <TriggerConfigForm
            config={config}
            setConfig={setConfig}
            iotModules={iotModules || []}
          />
        );
      case "move":
        return (
          <MoveConfigForm
            config={config}
            setConfig={setConfig}
            parks={parks || []}
          />
        );
      case "set":
        return (
          <SetConfigForm
            config={config}
            setConfig={setConfig}
            parks={parks || []}
          />
        );
      case "iot":
        return (
          <IOTConfigForm
            config={config}
            setConfig={setConfig}
            iotModules={iotModules || []}
          />
        );
      case "check":
        return (
          <CheckConfigForm
            config={config}
            setConfig={setConfig}
            parks={parks || []}
          />
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
              ขณะนี้ Flow กำลังทำงานอยู่ ไม่สามารถบันทึกการตั้งค่าได้ (กด Stop ก่อน)
            </div>
          )}
          {renderConfigForm()}
        </div>
        <div className="modal-footer">
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
            <div>
              {onDelete && (
                <button 
                  className="btn-delete" 
                  onClick={() => {
                    if (window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบ Node นี้?")) {
                      onDelete(node.id);
                      onClose();
                    }
                  }} 
                  disabled={isRunning}
                  style={{
                    background: "#ef4444",
                    color: "white",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "4px",
                    cursor: isRunning ? "not-allowed" : "pointer",
                    opacity: isRunning ? 0.5 : 1
                  }}
                >
                  🗑️ ลบ Node
                </button>
              )}
            </div>
            <div>
              <button className="btn-cancel" onClick={onClose}>Cancel</button>
              <button className="btn-save" onClick={handleSave} disabled={isRunning}>Save</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const TriggerConfigForm = ({ config, setConfig, iotModules }) => {
  const selectedModule = iotModules.find((m) => String(m.id) === String(config.iotId));

  // Generate address options: in_1 to in_8 and out_1 to out_8
  const addressOptions = [
    ...Array.from({ length: 8 }, (_, i) => `in_${i + 1}`),
    ...Array.from({ length: 8 }, (_, i) => `out_${i + 1}`),
  ];

  return (
    <div className="config-form">
      <div className="form-group">
        <label>IOT Module *</label>
        <select
          value={config.iotId || ""}
          onChange={(e) => {
            const module = iotModules.find((m) => String(m.id) === String(e.target.value));
            setConfig({
              ...config,
              iotId: e.target.value,
              iotIp: module?.ip_address || module?.ipAddress || "",
            });
          }}
        >
          <option value="">-- เลือก IOT --</option>
          {iotModules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.ip_address || m.ipAddress} ({m.protocol || m.communicationType})
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Address *</label>
        <select
          value={config.address || ""}
          onChange={(e) => setConfig({ ...config, address: e.target.value })}
        >
          <option value="">-- เลือก Address --</option>
          {addressOptions.map((addr) => (
            <option key={addr} value={addr}>
              {addr.toUpperCase()}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Trigger Value *</label>
        <select
          value={config.triggerValue !== undefined && config.triggerValue !== null ? config.triggerValue : 1}
          onChange={(e) => {
            const value = parseInt(e.target.value);
            console.log(`[TriggerConfigForm] Setting triggerValue to:`, value, typeof value);
            setConfig({ ...config, triggerValue: value });
          }}
        >
          <option value={0}>0 (OFF)</option>
          <option value={1}>1 (ON)</option>
        </select>
        {config.triggerValue !== undefined && config.triggerValue !== null && (
          <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "4px" }}>
            Current: {config.triggerValue === 1 ? "ON" : "OFF"} (value: {config.triggerValue}, type: {typeof config.triggerValue})
          </div>
        )}
      </div>
    </div>
  );
};

const MoveConfigForm = ({ config, setConfig, parks }) => {
  const groups = [...new Set(parks.map((p) => p.groups).filter(Boolean))];
  const group1 = config.group1 || "";
  const group2 = config.group2 || "";
  
  // Helper function to get first park from group
  const getFirstParkFromGroup = (groupName) => {
    const groupParks = parks
      .filter((p) => p.groups === groupName && (p.use_state === 1 || p.use_state === "1"))
      .sort((a, b) => {
        const nameA = (a.external_name || a.external_id || "").toString();
        const nameB = (b.external_name || b.external_id || "").toString();
        return nameA.localeCompare(nameB);
      });
    
    if (groupParks.length === 0) return null;
    return groupParks[0].external_name || groupParks[0].external_id || null;
  };

  // Get park count for display
  const getParkCount = (groupName) => {
    return parks.filter(
      (p) => p.groups === groupName && (p.use_state === 1 || p.use_state === "1")
    ).length;
  };

  const group1ParkCount = getParkCount(group1);
  const group2ParkCount = getParkCount(group2);
  const firstParkGroup1 = group1 ? getFirstParkFromGroup(group1) : null;
  const firstParkGroup2 = group2 ? getFirstParkFromGroup(group2) : null;

  return (
    <div className="config-form">
      <div className="form-group">
        <label>Group 1 (Source) *</label>
        <select
          value={group1}
          onChange={(e) => {
            setConfig({ 
              ...config, 
              group1: e.target.value 
            });
          }}
        >
          <option value="">-- เลือก Group 1 --</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        {group1 && (
          <span className="form-hint" style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "4px", display: "block" }}>
            {group1ParkCount > 0 
              ? `จะใช้: ${firstParkGroup1 || "N/A"} (จาก ${group1ParkCount} parks)` 
              : "⚠ ไม่มี Park ที่ use_state = 1 ใน Group นี้"}
          </span>
        )}
      </div>
      <div className="form-group">
        <label>Group 2 (Destination) *</label>
        <select
          value={group2}
          onChange={(e) => {
            setConfig({ 
              ...config, 
              group2: e.target.value 
            });
          }}
        >
          <option value="">-- เลือก Group 2 --</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        {group2 && (
          <span className="form-hint" style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "4px", display: "block" }}>
            {group2ParkCount > 0 
              ? `จะใช้: ${firstParkGroup2 || "N/A"} (จาก ${group2ParkCount} parks)` 
              : "⚠ ไม่มี Park ที่ use_state = 1 ใน Group นี้"}
          </span>
        )}
      </div>
      <div className="form-info" style={{ 
        padding: "12px", 
        background: "#f0f9ff", 
        borderRadius: "6px", 
        fontSize: "0.85rem",
        color: "#0369a1",
        marginTop: "8px"
      }}>
        <strong>หมายเหตุ:</strong> ระบบจะเลือก Park แรกที่มี use_state ว่างจากแต่ละ Group อัตโนมัติ
      </div>
    </div>
  );
};

const SetConfigForm = ({ config, setConfig, parks }) => {
  // Get all unique park names from parks
  const parkNames = [...new Set(parks.map((p) => p.external_name || p.external_id).filter(Boolean))].sort();

  return (
    <div className="config-form">
      <div className="form-group">
        <label>Park Name (external_name) *</label>
        <select
          value={config.parkName || ""}
          onChange={(e) => setConfig({ ...config, parkName: e.target.value })}
        >
          <option value="">-- เลือก Park --</option>
          {parkNames.map((parkName) => (
            <option key={parkName} value={parkName}>
              {parkName}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Use State *</label>
        <select
          value={config.useState || ""}
          onChange={(e) => setConfig({ ...config, useState: parseInt(e.target.value) })}
        >
          <option value="">-- เลือก Use State --</option>
          <option value={1}>1</option>
          <option value={3}>3</option>
        </select>
      </div>
      <div className="form-info" style={{ 
        padding: "12px", 
        background: "#fef3c7", 
        borderRadius: "6px", 
        fontSize: "0.85rem",
        color: "#92400e",
        marginTop: "8px"
      }}>
        <strong>หมายเหตุ:</strong> Node นี้จะทำงานเมื่อมี node ก่อนหน้าเชื่อมต่อมาและทำงานผ่านเงื่อนไขแล้ว (เมื่อ flow run)
      </div>
    </div>
  );
};

const IOTConfigForm = ({ config, setConfig, iotModules }) => {
  return (
    <div className="config-form">
      <div className="form-group">
        <label>IOT Module *</label>
        <select
          value={config.iotId || ""}
          onChange={(e) => {
            const module = iotModules.find((m) => String(m.id) === String(e.target.value));
            setConfig({
              ...config,
              iotId: e.target.value,
              iotIp: module?.ip_address || module?.ipAddress || "",
            });
          }}
        >
          <option value="">-- เลือก IOT Module --</option>
          {iotModules.map((module) => (
            <option key={module.id} value={module.id}>
              {module.ip_address || module.ipAddress || `IOT ${module.id}`}
            </option>
          ))}
        </select>
      </div>
      {config.iotIp && (
        <div className="form-info" style={{ 
          padding: "12px", 
          background: "#f0f9ff", 
          borderRadius: "6px", 
          fontSize: "0.85rem",
          color: "#0369a1",
          marginTop: "8px"
        }}>
          <strong>IOT IP:</strong> {config.iotIp}
          <br />
          <strong>หมายเหตุ:</strong> Node นี้จะอ่านค่า modbus และบันทึกลง database ทุก 1 วินาทีเมื่อ run
        </div>
      )}
    </div>
  );
};

const CheckConfigForm = ({ config, setConfig, parks }) => {
  // Get unique groups from parks
  const groups = [...new Set(parks.map((p) => p.groups).filter(Boolean))];
  
  return (
    <div className="config-form">
      <div className="form-group">
        <label>Group *</label>
        <select
          value={config.group || ""}
          onChange={(e) => setConfig({ ...config, group: e.target.value })}
        >
          <option value="">-- เลือก Group --</option>
          {groups.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Check use_state *</label>
        <select
          value={config.useState !== undefined ? config.useState : ""}
          onChange={(e) => setConfig({ ...config, useState: parseInt(e.target.value) })}
        >
          <option value="">-- เลือก use_state --</option>
          <option value="1">use_state = 1</option>
          <option value="3">use_state = 3</option>
        </select>
      </div>
      {config.group && config.useState !== undefined && (
        <div className="form-info" style={{ 
          padding: "12px", 
          background: "#f0f9ff", 
          borderRadius: "6px", 
          fontSize: "0.85rem",
          color: "#0369a1",
          marginTop: "8px"
        }}>
          <strong>หมายเหตุ:</strong> Node นี้จะตรวจสอบว่ามี Park ใน Group "{config.group}" ที่มี use_state = {config.useState} หรือไม่
          <br />
          หากพบข้อมูล ถือว่าผ่านเงื่อนไข
        </div>
      )}
    </div>
  );
};

export default NodeConfigModal;


