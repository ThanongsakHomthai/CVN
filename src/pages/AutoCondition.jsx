import { useState, useEffect, useCallback } from "react";
import "../styles/Pages.css";
import "./AutoCondition.css";

const API_BASE = "http://localhost:4000";
const ORDERS_API = "http://192.168.1.251:6546/api/v2/orders";

// Trigger Node Component
const TriggerNode = ({ node, onUpdate, onDelete, iotModules, onLog, onTriggerActivated }) => {
  const [selectedIOT, setSelectedIOT] = useState(node.config?.iotId || "");
  const [ioType, setIoType] = useState(node.config?.ioType || "input");
  const [address, setAddress] = useState(node.config?.address || "");
  const [triggerValue, setTriggerValue] = useState(node.config?.triggerValue || 1);
  const [currentValue, setCurrentValue] = useState(null);

  const selectedModule = iotModules.find((m) => String(m.id) === String(selectedIOT));

  // Poll IOT value
  useEffect(() => {
    if (!selectedIOT || !address) {
      setCurrentValue(null);
      return;
    }

    const pollValue = async () => {
      try {
        const module = iotModules.find((m) => String(m.id) === String(selectedIOT));
        if (!module) return;

        const config = {
          communicationType: module.protocol || module.communicationType || "modbus",
          ipAddress: module.ip_address || module.ipAddress,
          port: parseInt(module.port) || 502,
          slaveId: module.slave_id || module.slaveId || 1,
          startAddress: parseInt(module.start_address || module.startAddress || 0),
          modbusFunction: module.modbus_function || module.modbusFunction || "readCoils",
          numInputs: module.num_inputs || module.numInputs || 4,
          numOutputs: module.num_outputs || module.numOutputs || 4,
        };

        const response = await fetch(`${API_BASE}/api/iot/read`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        });

        const result = await response.json();
        if (result.success && result.data) {
          const addr = parseInt(address) || 0;
          const baseAddr = parseInt(config.startAddress) || 0;
          const index = addr - baseAddr;

          let newValue = null;
          if (ioType === "input") {
            const value = result.data.inputs?.[index];
            newValue = value ? 1 : 0;
          } else {
            const outputIndex = index - (config.numInputs || 0);
            const value = result.data.outputs?.[outputIndex];
            newValue = value ? 1 : 0;
          }

          setCurrentValue(newValue);

          // Check trigger condition - only trigger on change from non-trigger to trigger value
          if (newValue === triggerValue && currentValue !== triggerValue && currentValue !== null) {
            onLog({
              type: "trigger",
              message: `Trigger activated: ${selectedModule?.ip_address || ""} ${ioType.toUpperCase()} address ${address} = ${triggerValue}`,
              timestamp: new Date(),
            });
            // Trigger move nodes
            if (onTriggerActivated) {
              onTriggerActivated();
            }
          }
        }
      } catch (error) {
        console.error("Error polling trigger value:", error);
      }
    };

    pollValue();
    const interval = setInterval(pollValue, 2000);
    return () => clearInterval(interval);
  }, [selectedIOT, address, ioType, triggerValue, iotModules, selectedModule, currentValue, node, onLog]);

  const handleSave = () => {
    onUpdate({
      ...node,
      config: {
        iotId: selectedIOT,
        ioType,
        address,
        triggerValue,
      },
    });
  };

  return (
    <div className="fbp-node trigger-node">
      <div className="node-header">
        <span className="node-icon">🔔</span>
        <span className="node-title">Trigger Node</span>
        <button className="node-delete" onClick={() => onDelete(node.id)}>×</button>
      </div>
      <div className="node-content">
        <div className="node-field">
          <label>IOT Module</label>
          <select value={selectedIOT} onChange={(e) => setSelectedIOT(e.target.value)}>
            <option value="">-- เลือก IOT --</option>
            {iotModules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.ip_address || m.ipAddress} ({m.protocol || m.communicationType})
              </option>
            ))}
          </select>
        </div>
        <div className="node-field">
          <label>IO Type</label>
          <select value={ioType} onChange={(e) => setIoType(e.target.value)}>
            <option value="input">Input</option>
            <option value="output">Output</option>
          </select>
        </div>
        <div className="node-field">
          <label>Address</label>
          <input
            type="number"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="เช่น 0, 1000"
          />
        </div>
        <div className="node-field">
          <label>Trigger Value</label>
          <select value={triggerValue} onChange={(e) => setTriggerValue(parseInt(e.target.value))}>
            <option value={0}>0 (OFF)</option>
            <option value={1}>1 (ON)</option>
          </select>
        </div>
        {currentValue !== null && (
          <div className="node-status">
            Current Value: <strong>{currentValue}</strong>
          </div>
        )}
        <button className="node-save-btn" onClick={handleSave}>Save</button>
      </div>
    </div>
  );
};

// Move Node Component
const MoveNode = ({ node, onUpdate, onDelete, parks, onLog, onExecute }) => {
  const [selectedGroup, setSelectedGroup] = useState(node.config?.group || "");
  const [source, setSource] = useState(node.config?.source || "");
  const [destination, setDestination] = useState(node.config?.destination || "");

  // Get unique groups from parks
  const groups = [...new Set(parks.map((p) => p.groups).filter(Boolean))];

  // Filter parks by selected group and use_state = 1
  const availableParks = parks
    .filter((p) => p.groups === selectedGroup && (p.use_state === 1 || p.use_state === "1"))
    .sort((a, b) => {
      const nameA = a.external_name || a.external_id || "";
      const nameB = b.external_name || b.external_id || "";
      return nameA.localeCompare(nameB);
    });

  const handleSave = () => {
    onUpdate({
      ...node,
      config: {
        group: selectedGroup,
        source,
        destination,
      },
    });
  };

  const handleExecute = async () => {
    if (!source || !destination) {
      alert("กรุณาเลือก Source และ Destination");
      return;
    }

    try {
      const timestamp = Date.now();
      const orderData = {
        id: String(timestamp),
        systemId: "RCS",
        type: "LoadingAndUnloading",
        flag: "",
        description: "",
        requiredAgvs: ["0001"],
        priority: 1,
        source: source,
        destination: destination,
        cargo: "goods",
        parameters: "",
        validPeriod: 0,
        Dependencies: "",
        Sequence: null,
      };

      onLog({
        type: "move",
        message: `Sending order: ${source} → ${destination}`,
        timestamp: new Date(),
        data: orderData,
      });

      // Send via proxy
      const response = await fetch(`${API_BASE}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      if (response.ok) {
        onLog({
          type: "success",
          message: `Order sent successfully: ${source} → ${destination}`,
          timestamp: new Date(),
        });
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      onLog({
        type: "error",
        message: `Failed to send order: ${error.message}`,
        timestamp: new Date(),
      });
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    }
  };

  return (
    <div className="fbp-node move-node">
      <div className="node-header">
        <span className="node-icon">🚚</span>
        <span className="node-title">Move Node</span>
        <button className="node-delete" onClick={() => onDelete(node.id)}>×</button>
      </div>
      <div className="node-content">
        <div className="node-field">
          <label>Group</label>
          <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}>
            <option value="">-- เลือก Group --</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div className="node-field">
          <label>Source</label>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">-- เลือก Source --</option>
            {availableParks.map((p) => (
              <option key={p.external_id || p.external_name} value={p.external_name || p.external_id}>
                {p.external_name || p.external_id}
              </option>
            ))}
          </select>
        </div>
        <div className="node-field">
          <label>Destination</label>
          <select value={destination} onChange={(e) => setDestination(e.target.value)}>
            <option value="">-- เลือก Destination --</option>
            {availableParks.map((p) => (
              <option key={p.external_id || p.external_name} value={p.external_name || p.external_id}>
                {p.external_name || p.external_id}
              </option>
            ))}
          </select>
        </div>
        <button className="node-save-btn" onClick={handleSave}>Save</button>
        <button className="node-execute-btn" onClick={handleExecute}>Execute</button>
      </div>
    </div>
  );
};

// Console Monitor Component
const ConsoleMonitor = ({ logs }) => {
  return (
    <div className="console-monitor">
      <div className="console-header">
        <h3>Console Monitor</h3>
        <span className="console-count">{logs.length} entries</span>
      </div>
      <div className="console-content">
        {logs.length === 0 ? (
          <div className="console-empty">No logs yet</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className={`console-log console-log-${log.type}`}>
              <span className="console-time">{log.timestamp.toLocaleTimeString()}</span>
              <span className="console-type">[{log.type.toUpperCase()}]</span>
              <span className="console-message">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Main Auto Condition Component
const AutoCondition = () => {
  const [nodes, setNodes] = useState([]);
  const [logs, setLogs] = useState([]);
  const [iotModules, setIotModules] = useState([]);
  const [parks, setParks] = useState([]);
  const [nodeIdCounter, setNodeIdCounter] = useState(1);
  const [selectedNodeType, setSelectedNodeType] = useState("");

  // Fetch IOT modules
  const fetchIOTModules = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/iot/modules`);
      const result = await response.json();
      if (result.success) {
        setIotModules(result.data || []);
      }
    } catch (error) {
      console.error("Error fetching IOT modules:", error);
    }
  }, []);

  // Fetch Parks
  const fetchParks = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/parks`);
      const result = await response.json();
      if (result.success) {
        setParks(result.data || []);
      }
    } catch (error) {
      console.error("Error fetching parks:", error);
    }
  }, []);

  useEffect(() => {
    fetchIOTModules();
    fetchParks();
  }, [fetchIOTModules, fetchParks]);

  const addNode = (type) => {
    const newNode = {
      id: nodeIdCounter,
      type,
      config: {},
    };

    setNodes((prev) => [...prev, newNode]);
    setNodeIdCounter((prev) => prev + 1);
    setSelectedNodeType("");
  };

  const addLog = useCallback((logEntry) => {
    setLogs((prev) => [logEntry, ...prev].slice(0, 100)); // Keep last 100 logs
  }, []);

  // Execute move node when trigger is activated
  const executeMoveNode = useCallback(async (moveNode) => {
    const { source, destination } = moveNode.config || {};
    if (!source || !destination) {
      addLog({
        type: "error",
        message: "Move node: Source or Destination is not configured",
        timestamp: new Date(),
      });
      return;
    }

    try {
      const timestamp = Date.now();
      const orderData = {
        id: String(timestamp),
        systemId: "RCS",
        type: "LoadingAndUnloading",
        flag: "",
        description: "",
        requiredAgvs: ["0001"],
        priority: 1,
        source: source,
        destination: destination,
        cargo: "goods",
        parameters: "",
        validPeriod: 0,
        Dependencies: "",
        Sequence: null,
      };

      addLog({
        type: "move",
        message: `Sending order: ${source} → ${destination}`,
        timestamp: new Date(),
        data: orderData,
      });

      const response = await fetch(`${API_BASE}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      if (response.ok) {
        addLog({
          type: "success",
          message: `Order sent successfully: ${source} → ${destination}`,
          timestamp: new Date(),
        });
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      addLog({
        type: "error",
        message: `Failed to send order: ${error.message}`,
        timestamp: new Date(),
      });
    }
  }, [addLog]);

  const updateNode = (updatedNode) => {
    setNodes((prev) => prev.map((n) => (n.id === updatedNode.id ? updatedNode : n)));
  };

  const deleteNode = (nodeId) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
  };

  const renderNode = (node) => {
    switch (node.type) {
      case "trigger":
        return (
          <TriggerNode
            key={node.id}
            node={node}
            onUpdate={updateNode}
            onDelete={deleteNode}
            iotModules={iotModules}
            onLog={addLog}
            onTriggerActivated={() => {
              // Execute all move nodes when trigger is activated
              const moveNodes = nodes.filter((n) => n.type === "move" && n.config.source && n.config.destination);
              moveNodes.forEach((moveNode) => {
                executeMoveNode(moveNode);
              });
            }}
          />
        );
      case "move":
        return (
          <MoveNode
            key={node.id}
            node={node}
            onUpdate={updateNode}
            onDelete={deleteNode}
            parks={parks}
            onLog={addLog}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="auto-condition-page">
      <div className="page-header">
        <h1>Auto Condition</h1>
        <p>Flow-Based Programming สำหรับการทำงานอัตโนมัติ</p>
      </div>

      <div className="auto-condition-layout">
        {/* Left Side - FBP Editor */}
        <div className="fbp-editor">
          <div className="fbp-toolbar">
            <h2>FBP Nodes</h2>
            <div className="node-type-buttons">
              <button
                className="btn-add-node"
                onClick={() => addNode("trigger")}
                title="เพิ่ม Trigger Node"
              >
                + Trigger
              </button>
              <button
                className="btn-add-node"
                onClick={() => addNode("move")}
                title="เพิ่ม Move Node"
              >
                + Move
              </button>
            </div>
          </div>

          <div className="fbp-nodes-container">
            {nodes.length === 0 ? (
              <div className="fbp-empty">
                <p>ยังไม่มี Node</p>
                <p className="fbp-empty-hint">คลิกปุ่มด้านบนเพื่อเพิ่ม Node</p>
              </div>
            ) : (
              nodes.map((node) => renderNode(node))
            )}
          </div>
        </div>

        {/* Right Side - Console Monitor */}
        <div className="console-panel">
          <ConsoleMonitor logs={logs} />
        </div>
      </div>
    </div>
  );
};

export default AutoCondition;
