import { memo } from "react";
import { Handle, Position } from "reactflow";
import { 
  HiOutlineBell,
  HiOutlineTruck,
  HiOutlineCog6Tooth,
  HiOutlineBugAnt,
  HiOutlineSignal,
  HiOutlineCheckCircle
} from "react-icons/hi2";

// Trigger Node Component สำหรับ React Flow
export const TriggerNode = memo(({ data, selected, id }) => {
  const isRunning = data?.isRunning || false;
  const isConfigured = data.config?.iotId && data.config?.address;
  const nodeId = id || data?.id;
  
  return (
    <div className={`custom-node trigger-node ${selected ? "selected" : ""} ${isRunning ? "running" : ""} ${!isConfigured ? "not-configured" : ""}`}>
      <div className="node-header">
        <span className="node-icon">
          <HiOutlineBell size={18} />
        </span>
        <span className="node-title">Trigger</span>
        {isRunning && <span className="node-running-indicator">●</span>}
      </div>
      <Handle type="source" position={Position.Right} id="output" />
      <div className="node-content">
        {isConfigured ? (
          <>
            <div className="node-info">
              <div>IOT: {data.config?.iotIp || "N/A"}</div>
              <div>Address: {data.config?.address ? data.config.address.toUpperCase() : "N/A"}</div>
              <div>Trigger: {data.config?.triggerValue === 1 || data.config?.triggerValue === "1" ? "ON" : data.config?.triggerValue === 0 || data.config?.triggerValue === "0" ? "OFF" : "NOT SET"}</div>
              <div className="node-status">
                Current: <strong style={{ 
                  color: (data.currentValue === 1 || data.currentValue === "1") ? "#10b981" : "#ef4444",
                  fontWeight: "bold"
                }}>
                  {data.currentValue !== null && data.currentValue !== undefined 
                    ? (data.currentValue === 1 || data.currentValue === "1" ? "ON" : "OFF")
                    : "---"}
                </strong>
                {data.currentValue !== null && (
                  <span style={{ fontSize: "0.7rem", color: "#64748b", marginLeft: "4px" }}>
                    ({data.currentValue})
                  </span>
                )}
              </div>
            </div>
            {data.config && data.onEdit && (
              <button className="node-edit-btn" onClick={() => data.onEdit?.(nodeId)}>
                ⚙️ แก้ไข
              </button>
            )}
          </>
        ) : (
          <>
            <div className="node-warning">⚠️ ยังไม่ได้ตั้งค่า</div>
            {data.onEdit && (
              <button
                className="node-edit-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (data.onEdit && nodeId) {
                    data.onEdit(nodeId);
                  }
                }}
                title="ตั้งค่า Node"
              >
                ⚙️ ตั้งค่า
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
});
TriggerNode.displayName = "TriggerNode";

// Move Node Component สำหรับ React Flow
export const MoveNode = memo(({ data, selected, id }) => {
  const isRunning = data?.isRunning || false;
  const isConfigured = data.config?.group1 && data.config?.group2;
  const nodeId = id || data?.id;
  
  return (
    <div className={`custom-node move-node ${selected ? "selected" : ""} ${isRunning ? "running" : ""} ${!isConfigured ? "not-configured" : ""}`}>
      <div className="node-header">
        <span className="node-icon">
          <HiOutlineTruck size={18} />
        </span>
        <span className="node-title">Move</span>
        {isRunning && <span className="node-running-indicator">●</span>}
      </div>
      <Handle type="target" position={Position.Left} id="input" />
      <Handle type="source" position={Position.Right} id="output" />
      <div className="node-content">
        {isConfigured ? (
          <>
            <div className="node-info">
              <div>Group 1: {data.config.group1}</div>
              <div>Group 2: {data.config.group2}</div>
              <div className="node-hint" style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "4px" }}>
                (Auto-select park จากแต่ละ Group)
              </div>
            </div>
                <button className="node-edit-btn" onClick={() => data.onEdit?.(nodeId)}>
                  ⚙️ แก้ไข
                </button>
          </>
        ) : (
          <>
            <div className="node-warning">⚠️ ยังไม่ได้ตั้งค่า</div>
            {data.onEdit && (
              <button
                className="node-edit-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (data.onEdit && nodeId) {
                    data.onEdit(nodeId);
                  }
                }}
                title="ตั้งค่า Node"
              >
                ⚙️ ตั้งค่า
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
});
MoveNode.displayName = "MoveNode";

// Set Node Component สำหรับ React Flow
export const SetNode = memo(({ data, selected, id }) => {
  const isRunning = data?.isRunning || false;
  const isConfigured = data.config?.parkName && data.config?.useState;
  const nodeId = id || data?.id;
  
  return (
    <div className={`custom-node set-node ${selected ? "selected" : ""} ${isRunning ? "running" : ""} ${!isConfigured ? "not-configured" : ""}`}>
      <div className="node-header">
        <span className="node-icon">
          <HiOutlineCog6Tooth size={18} />
        </span>
        <span className="node-title">Set</span>
        {isRunning && <span className="node-running-indicator">●</span>}
      </div>
      <Handle type="target" position={Position.Left} id="input" />
      <Handle type="source" position={Position.Right} id="output" />
      <div className="node-content">
        {isConfigured ? (
          <>
            <div className="node-info">
              <div>Park: {data.config.parkName}</div>
              <div>Use State: {data.config.useState}</div>
            </div>
                <button className="node-edit-btn" onClick={() => data.onEdit?.(nodeId)}>
                  ⚙️ แก้ไข
                </button>
          </>
        ) : (
          <>
            <div className="node-warning">⚠️ ยังไม่ได้ตั้งค่า</div>
            {data.onEdit && (
              <button
                className="node-edit-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (data.onEdit && nodeId) {
                    data.onEdit(nodeId);
                  }
                }}
                title="ตั้งค่า Node"
              >
                ⚙️ ตั้งค่า
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
});
SetNode.displayName = "SetNode";

// Debug Node Component สำหรับ React Flow
export const DebugNode = memo(({ data, selected, id }) => {
  const nodeId = id || data?.id;
  const isConfigured = data.config?.message;
  return (
    <div className={`custom-node debug-node ${selected ? "selected" : ""} ${!isConfigured ? "not-configured" : ""}`}>
      <div className="node-header">
        <span className="node-icon">
          <HiOutlineBugAnt size={18} />
        </span>
        <span className="node-title">Debug</span>
      </div>
      <Handle type="target" position={Position.Left} id="input" />
      <div className="node-content">
        {data.config?.message ? (
          <>
            <div className="node-info">
              <div>{data.config.message}</div>
            </div>
                <button className="node-edit-btn" onClick={() => data.onEdit?.(nodeId)}>
                  ⚙️ แก้ไข
                </button>
          </>
        ) : (
          <>
            <div className="node-warning">⚠️ ยังไม่ได้ตั้งค่า</div>
            {data.onEdit && (
              <button
                className="node-edit-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (data.onEdit && nodeId) {
                    data.onEdit(nodeId);
                  }
                }}
                title="ตั้งค่า Node"
              >
                ⚙️ ตั้งค่า
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
});
DebugNode.displayName = "DebugNode";

// IOT Node Component สำหรับ React Flow
export const IOTNode = memo(({ data, selected, id }) => {
  const isRunning = data?.isRunning || false;
  const isConfigured = data.config?.iotId;
  const nodeId = id || data?.id;
  
  return (
    <div className={`custom-node iot-node ${selected ? "selected" : ""} ${isRunning ? "running" : ""} ${!isConfigured ? "not-configured" : ""}`}>
      <div className="node-header">
        <span className="node-icon">
          <HiOutlineSignal size={18} />
        </span>
        <span className="node-title">IOT</span>
        {isRunning && <span className="node-running-indicator">●</span>}
      </div>
      <Handle type="source" position={Position.Right} id="output" />
      <div className="node-content">
        {isConfigured ? (
          <>
            <div className="node-info">
              <div>IOT: {data.config?.iotIp || "N/A"}</div>
              <div className="node-status">
                Status: <strong style={{ 
                  color: data.isRunning ? "#10b981" : "#64748b",
                  fontWeight: "bold"
                }}>
                  {data.isRunning ? "Running" : "Stopped"}
                </strong>
              </div>
            </div>
            {data.config && (
              <>
                <button className="node-edit-btn" onClick={() => data.onEdit?.(nodeId)}>
                  ⚙️ แก้ไข
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <div className="node-warning">⚠️ ยังไม่ได้ตั้งค่า</div>
            {data.onEdit && (
              <button
                className="node-edit-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (data.onEdit && nodeId) {
                    data.onEdit(nodeId);
                  }
                }}
                title="ตั้งค่า Node"
              >
                ⚙️ ตั้งค่า
              </button>
            )}
            {data.onDelete && (
              <button 
                className="node-delete-btn" 
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const nodeIdToDelete = nodeId || data?.id;
                  if (data.onDelete && nodeIdToDelete) {
                    data.onDelete(nodeIdToDelete);
                  }
                }}
                title="ลบ Node (Delete)"
                style={{ marginTop: "8px" }}
              >
                × ลบ
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
});
IOTNode.displayName = "IOTNode";

// Check Node Component สำหรับ React Flow
export const CheckNode = memo(({ data, selected, id }) => {
  const isRunning = data?.isRunning || false;
  const isConfigured = data.config?.group && data.config?.useState !== undefined;
  const nodeId = id || data?.id;
  
  return (
    <div className={`custom-node check-node ${selected ? "selected" : ""} ${isRunning ? "running" : ""} ${!isConfigured ? "not-configured" : ""}`}>
      <div className="node-header">
        <span className="node-icon">
          <HiOutlineCheckCircle size={18} />
        </span>
        <span className="node-title">Check</span>
        {isRunning && <span className="node-running-indicator">●</span>}
      </div>
      <Handle type="target" position={Position.Left} id="input" />
      <Handle type="source" position={Position.Right} id="output" />
      <div className="node-content">
        {isConfigured ? (
          <>
            <div className="node-info">
              <div>Group: <strong>{data.config.group}</strong></div>
              <div>Check use_state: <strong>{data.config.useState}</strong></div>
            </div>
            {data.onEdit && (
              <button
                className="node-edit-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (data.onEdit && nodeId) {
                    data.onEdit(nodeId);
                  }
                }}
                title="แก้ไข Node"
              >
                ⚙️ แก้ไข
              </button>
            )}
          </>
        ) : (
          <>
            <div className="node-warning">⚠️ ยังไม่ได้ตั้งค่า</div>
            {data.onEdit && (
              <button
                className="node-edit-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (data.onEdit && nodeId) {
                    data.onEdit(nodeId);
                  }
                }}
                title="ตั้งค่า Node"
              >
                ⚙️ ตั้งค่า
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
});
CheckNode.displayName = "CheckNode";


