import { useState, useEffect, useCallback } from "react";
import { 
  HiOutlineBuildingOffice2,
  HiOutlineSignal,
  HiOutlineCpuChip,
  HiOutlineTruck,
  HiOutlineArrowPath
} from "react-icons/hi2";
import "../styles/Settings.css";
import "../styles/Pages.css";

const API_BASE = "http://localhost:4000";
const DEFAULT_IOT_INPUTS = 4;
const DEFAULT_IOT_OUTPUTS = 4;

// Park Config Component (moved from main Settings)
const ParkConfig = () => {
  const [park, setPark] = useState("");
  const [group, setGroup] = useState("");
  const [parks, setParks] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Fetch parks data (only updates table, doesn't affect form)
  const fetchParks = async () => {
    try {
      setTableLoading(true);
      
      const response = await fetch(`${API_BASE}/api/parks`);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.error("API endpoint not found");
          return;
        }
        console.error(`HTTP ${response.status}: ${response.statusText}`);
        return;
      }
      
      const result = await response.json();

      if (result.success) {
        setParks(result.data || []);
      } else {
        console.error("Error fetching parks:", result.error);
      }
    } catch (err) {
      console.error("Error fetching parks:", err);
    } finally {
      setTableLoading(false);
    }
  };

  // Insert new park
  const handleInsert = async (e) => {
    e.preventDefault();
    
    if (!park.trim() || !group.trim()) {
      setFormError("กรุณากรอกข้อมูล Park และ Group ให้ครบถ้วน");
      return;
    }

    try {
      setFormLoading(true);
      setFormError("");
      setFormSuccess("");

      const response = await fetch(`${API_BASE}/api/parks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          park: park.trim(),
          group: group.trim(),
        }),
      });

      const result = await response.json();

      if (result.success) {
        setFormSuccess("เพิ่มข้อมูล Park สำเร็จ");
        setPark("");
        setGroup("");
        await fetchParks();
      } else {
        setFormError(result.error || "ไม่สามารถเพิ่มข้อมูลได้");
      }
    } catch (err) {
      setFormError(`เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setFormLoading(false);
    }
  };

  // Delete park
  const handleDelete = async (externalName) => {
    if (!window.confirm(`คุณต้องการลบ Park "${externalName}" หรือไม่?`)) {
      return;
    }

    try {
      setTableLoading(true);

      const response = await fetch(`${API_BASE}/api/parks/${encodeURIComponent(externalName)}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        await fetchParks();
      } else {
        alert(result.error || "ไม่สามารถลบข้อมูลได้");
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert(`เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    fetchParks();
    const intervalId = setInterval(() => {
      fetchParks();
    }, 2000);
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="settings-content">
      <div className="card form-card">
        <h2>เพิ่ม Park ใหม่</h2>
        
        {formError && <div className="alert alert-error">{formError}</div>}
        {formSuccess && <div className="alert alert-success">{formSuccess}</div>}

        <form onSubmit={handleInsert} className="park-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="park">Park *</label>
              <input
                id="park"
                type="text"
                value={park}
                onChange={(e) => setPark(e.target.value)}
                placeholder="กรอกชื่อ Park"
                disabled={formLoading}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="group">Group *</label>
              <input
                id="group"
                type="text"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                placeholder="กรอกชื่อ Group"
                disabled={formLoading}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={formLoading}
          >
            {formLoading ? "กำลังบันทึก..." : "Insert"}
          </button>
        </form>
      </div>

      <div className="card table-card">
        <div className="table-header">
          <div>
            <h2>รายการ Park ทั้งหมด</h2>
            <p className="auto-refresh-indicator">
              {/* อัพเดทอัตโนมัติทุก 2 วินาที */}
            </p>
          </div>
          <button
            type="button"
            className="btn-refresh"
            onClick={fetchParks}
            disabled={tableLoading}
          >
            <HiOutlineArrowPath size={16} style={{ marginRight: "6px", verticalAlign: "middle" }} />
            Refresh
          </button>
        </div>

        {tableLoading && parks.length === 0 ? (
          <div className="loading">กำลังโหลดข้อมูล...</div>
        ) : parks.length === 0 ? (
          <div className="empty-state">ไม่พบข้อมูล Park</div>
        ) : (
          <div className="table-wrapper">
            <table className="parks-table">
              <thead>
                <tr>
                  <th>Park</th>
                  <th>Status</th>
                  <th>Group</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {parks
                  .filter((item) => item.external_id != null || item.external_name != null)
                  .map((item, index) => (
                    <tr key={item.external_id || item.external_name || `park-${index}`}>
                      <td>{item.external_name || item.external_id}</td>
                      <td>
                        <span
                          className={`status-badge ${
                            item.use_state === 1 || item.use_state === "1"
                              ? "active"
                              : "inactive"
                          }`}
                        >
                          {item.use_state === 1 || item.use_state === "1"
                            ? "ใช้งาน"
                            : "ไม่ใช้งาน"}
                        </span>
                      </td>
                      <td>{item.groups || "-"}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-delete"
                          onClick={() => handleDelete(item.external_name || item.external_id)}
                          disabled={tableLoading}
                          title={`ลบ ${item.external_name || item.external_id}`}
                        >
                          🗑️ ลบ
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// IOT Module Component - Display individual IOT device
const IOTModule = ({ module, onDelete }) => {
  const moduleInputs = Number.isFinite(module.numInputs)
    ? Number(module.numInputs)
    : DEFAULT_IOT_INPUTS;
  const moduleOutputs = Number.isFinite(module.numOutputs)
    ? Number(module.numOutputs)
    : DEFAULT_IOT_OUTPUTS;
  const [ioStatus, setIoStatus] = useState({
    inputs: Array(moduleInputs).fill(false),
    outputs: Array(moduleOutputs).fill(false),
  });
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Read IO data for this specific module
  const readIOData = useCallback(async () => {
    try {
      const config = {
        communicationType: module.communicationType,
        ipAddress: module.ipAddress,
        port: parseInt(module.port) || 0,
        slaveId: module.communicationType === "modbus" ? parseInt(module.slaveId) || 1 : null,
        startAddressInput: module.communicationType === "modbus" ? parseInt(module.startAddressInput) || 0 : null,
        startAddressOutput: module.communicationType === "modbus" ? parseInt(module.startAddressOutput) || 0 : null,
        modbusFunction: module.communicationType === "modbus" ? module.modbusFunction : null,
        numInputs: moduleInputs,
        numOutputs: moduleOutputs,
      };

      const response = await fetch(`${API_BASE}/api/iot/read`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Check if connection is successful and data is available
      if (result.success && result.data) {
        setIoStatus({
          inputs: result.data.inputs?.slice(0, moduleInputs) || Array(moduleInputs).fill(false),
          outputs: result.data.outputs?.slice(0, moduleOutputs) || Array(moduleOutputs).fill(false),
        });
        // Set connection status based on API response
        setIsConnected(result.connected === true);
        if (result.connected === true) {
          setLastUpdate(new Date());
        }
      } else {
        // Connection failed or error
        setIsConnected(false);
        // Keep previous IO status or set to all false
        setIoStatus({
          inputs: Array(moduleInputs).fill(false),
          outputs: Array(moduleOutputs).fill(false),
        });
      }
    } catch (error) {
      console.error(`Error reading IO data for ${module.ipAddress}:`, error);
      setIsConnected(false);
      // Set IO status to all false on error
      setIoStatus({
        inputs: Array(moduleInputs).fill(false),
        outputs: Array(moduleOutputs).fill(false),
      });
    }
  }, [module]);

  // Polling effect - read IO data periodically
  useEffect(() => {
    // Read immediately on mount
    readIOData();

    // Set up polling interval (read every 2 seconds)
    const intervalId = setInterval(() => {
      readIOData();
    }, 2000);

    return () => {
      clearInterval(intervalId);
    };
  }, [readIOData]);

  // Write output value
  const writeOutput = async (index, value) => {
    if (module.communicationType !== "modbus") {
      alert("การเขียน Output ใช้ได้เฉพาะ Modbus เท่านั้น");
      return;
    }

    try {
      const outputAddress = parseInt(module.startAddressOutput || 0) + index;
      const config = {
        communicationType: module.communicationType,
        ipAddress: module.ipAddress,
        port: parseInt(module.port) || 0,
        slaveId: parseInt(module.slaveId) || 1,
        address: outputAddress,
        value: value ? 1 : 0,
        modbusFunction: "writeSingleCoil",
      };

      const response = await fetch(`${API_BASE}/api/iot/write`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success && result.connected === true) {
        // Update local state
        setIoStatus((prev) => ({
          ...prev,
          outputs: prev.outputs.map((status, i) => (i === index ? value : status)),
        }));
        // Re-read after write
        setTimeout(readIOData, 500);
      } else {
        // Write failed - connection issue
        const errorMsg = result.error || "ไม่สามารถเชื่อมต่อกับอุปกรณ์ได้";
        console.error("Error writing output:", errorMsg);
        alert(`ไม่สามารถเขียน Output ได้: ${errorMsg}`);
        // Update connection status
        setIsConnected(false);
      }
    } catch (error) {
      console.error("Error writing output:", error);
      alert(`ไม่สามารถเขียน Output ได้: ${error.message}`);
      setIsConnected(false);
    }
  };

  const toggleOutput = (index) => {
    const currentValue = ioStatus.outputs[index];
    writeOutput(index, !currentValue);
  };

  return (
    <div className="iot-module-card">
      <div className="iot-module-header">
        <div className="iot-module-info">
          <h3 className="iot-module-ip">{module.ipAddress}:{module.port}</h3>
          <div className="iot-module-meta">
            <span className="iot-module-type">{module.communicationType.toUpperCase()}</span>
            {module.communicationType === "modbus" && (
              <span className="iot-module-slave">Slave ID: {module.slaveId}</span>
            )}
          </div>
        </div>
        <div className="iot-module-actions">
          <span className={`iot-module-status ${isConnected ? "connected" : "disconnected"}`}>
            {isConnected ? "●" : "○"}
          </span>
          <button
            type="button"
            className="iot-module-delete"
            onClick={() => onDelete(module.id)}
            title="ลบ Module"
          >
            ×
          </button>
        </div>
      </div>

      <div className="iot-module-io">
        <div className="iot-module-io-section">
          <div className="iot-module-io-label">Inputs ({moduleInputs})</div>
          <div className="iot-module-io-blocks">
            {Array.from({ length: moduleInputs }, (_, index) => (
              <div
                key={`input-${index}`}
                className={`iot-module-io-block ${ioStatus.inputs[index] ? "on" : "off"}`}
                title={`Input ${index + 1}`}
              >
                <div className="iot-module-io-number">I{index + 1}</div>
                <div className="iot-module-io-state">{ioStatus.inputs[index] ? "1" : "0"}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="iot-module-io-section">
          <div className="iot-module-io-label">Outputs ({moduleOutputs})</div>
          <div className="iot-module-io-blocks">
            {Array.from({ length: moduleOutputs }, (_, index) => (
              <div
                key={`output-${index}`}
                className={`iot-module-io-block ${ioStatus.outputs[index] ? "on" : "off"} clickable`}
                onClick={() => toggleOutput(index)}
                title={`Output ${index + 1} - คลิกเพื่อเปิด/ปิด`}
              >
                <div className="iot-module-io-number">O{index + 1}</div>
                <div className="iot-module-io-state">{ioStatus.outputs[index] ? "1" : "0"}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {lastUpdate && (
        <div className="iot-module-footer">
          <span className="iot-module-update">
            อัพเดท: {lastUpdate.toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>
  );
};

// IOT Config Component
const IOTConfig = () => {
  const [communicationType, setCommunicationType] = useState("socket");
  const [ipAddress, setIpAddress] = useState("");
  const [port, setPort] = useState("");
  const [slaveId, setSlaveId] = useState("1");
  const [startAddressInput, setStartAddressInput] = useState("");
  const [startAddressOutput, setStartAddressOutput] = useState("");
  const [modbusFunction, setModbusFunction] = useState("readCoils");
  const [numInputs, setNumInputs] = useState(DEFAULT_IOT_INPUTS);
  const [numOutputs, setNumOutputs] = useState(DEFAULT_IOT_OUTPUTS);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [iotModules, setIotModules] = useState([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [moduleError, setModuleError] = useState("");

  const normalizeIotModule = useCallback((module) => {
    if (!module) {
      return null;
    }

    const protocol = (module.protocol || module.communicationType || "socket")
      .toString()
      .toLowerCase();

    return {
      id: module.id,
      communicationType: protocol,
      ipAddress: module.ip_address || module.ipAddress || "",
      port: Number(module.port) || 0,
      slaveId:
        module.slave_id ??
        module.slaveId ??
        (protocol === "modbus" ? 1 : null),
      startAddressInput:
        module.start_address_input ??
        module.startAddressInput ??
        (protocol === "modbus" ? 0 : null),
      startAddressOutput:
        module.start_address_output ??
        module.startAddressOutput ??
        (protocol === "modbus" ? 0 : null),
      modbusFunction:
        module.modbus_function ||
        module.modbusFunction ||
        (protocol === "modbus" ? "readCoils" : null),
      numInputs:
        Number.isFinite(module.num_inputs ?? module.numInputs)
          ? Number(module.num_inputs ?? module.numInputs)
          : DEFAULT_IOT_INPUTS,
      numOutputs:
        Number.isFinite(module.num_outputs ?? module.numOutputs)
          ? Number(module.num_outputs ?? module.numOutputs)
          : DEFAULT_IOT_OUTPUTS,
    };
  }, []);

  const fetchIotModules = useCallback(async () => {
    try {
      setModulesLoading(true);
      setModuleError("");

      const response = await fetch(`${API_BASE}/api/iot/modules`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        const normalized =
          result.data?.map((item) => normalizeIotModule(item)).filter(Boolean) ||
          [];
        setIotModules(normalized);
      } else {
        setModuleError(result.error || "ไม่สามารถดึงข้อมูล IOT Modules ได้");
      }
    } catch (error) {
      console.error("Error fetching IOT modules:", error);
      setModuleError(error.message || "ไม่สามารถดึงข้อมูล IOT Modules ได้");
    } finally {
      setModulesLoading(false);
    }
  }, [normalizeIotModule]);

  useEffect(() => {
    fetchIotModules();
  }, [fetchIotModules]);

  const handleAddModule = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");
    setFormSuccess("");

    // Validation
    if (!ipAddress.trim() || !port.trim()) {
      setFormError("กรุณากรอก IP Address และ Port");
      setFormLoading(false);
      return;
    }

    if (communicationType === "modbus") {
      if (!slaveId.trim()) {
        setFormError("กรุณากรอก Slave ID สำหรับ Modbus");
        setFormLoading(false);
        return;
      }
      if (!startAddressInput.trim() || !startAddressOutput.trim()) {
        setFormError("กรุณากรอก Start Address Input และ Output สำหรับ Modbus");
        setFormLoading(false);
        return;
      }
    }

    // Check if IP:Port already exists
    const existingModule = iotModules.find(
      (m) =>
        m.ipAddress === ipAddress.trim() &&
        String(m.port) === String(parseInt(port) || 0)
    );

    if (existingModule) {
      setFormError("IP Address และ Port นี้มีอยู่แล้ว");
      setFormLoading(false);
      return;
    }

    try {
      const payload = {
        ipAddress: ipAddress.trim(),
        protocol: communicationType,
        port: parseInt(port) || 0,
        startAddressInput:
          communicationType === "modbus" ? parseInt(startAddressInput) || 0 : null,
        startAddressOutput:
          communicationType === "modbus" ? parseInt(startAddressOutput) || 0 : null,
        slaveId:
          communicationType === "modbus" ? parseInt(slaveId) || 1 : null,
        modbusFunction:
          communicationType === "modbus" ? modbusFunction : null,
        numInputs: parseInt(numInputs) || DEFAULT_IOT_INPUTS,
        numOutputs: parseInt(numOutputs) || DEFAULT_IOT_OUTPUTS,
      };

      const response = await fetch(`${API_BASE}/api/iot/modules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        setFormSuccess("เพิ่ม IOT Module สำเร็จ");
        setIpAddress("");
        setPort("");
        setStartAddressInput("");
        setStartAddressOutput("");
        setSlaveId("1");
        setModbusFunction("readCoils");
        setNumInputs(DEFAULT_IOT_INPUTS);
        setNumOutputs(DEFAULT_IOT_OUTPUTS);
        await fetchIotModules();
        setTimeout(() => {
          setFormSuccess("");
        }, 3000);
      } else {
        setFormError(result.error || "ไม่สามารถเพิ่ม IOT Module ได้");
      }
    } catch (error) {
      console.error("Error adding IOT module:", error);
      setFormError(error.message || "ไม่สามารถเพิ่ม IOT Module ได้");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteModule = async (moduleId) => {
    if (!window.confirm("คุณต้องการลบ IOT Module นี้หรือไม่?")) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/iot/modules/${moduleId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        await fetchIotModules();
      } else {
        alert(result.error || "ไม่สามารถลบ IOT Module ได้");
      }
    } catch (error) {
      console.error("Error deleting IOT Module:", error);
      alert(error.message || "ไม่สามารถลบ IOT Module ได้");
    }
  };

  const handleInputCountChange = (value) => {
    const count = parseInt(value) || 0;
    if (count >= 0 && count <= 16) {
      setNumInputs(count);
    }
  };

  const handleOutputCountChange = (value) => {
    const count = parseInt(value) || 0;
    if (count >= 0 && count <= 16) {
      setNumOutputs(count);
    }
  };

  return (
    <div className="iot-config-layout">
      {/* Left side - Form (1 part) */}
      <div className="iot-config-left">
        <div className="card form-card">
          <h2>การตั้งค่า IOT Communication</h2>
          
          {formError && <div className="alert alert-error">{formError}</div>}
          {formSuccess && <div className="alert alert-success">{formSuccess}</div>}

          <form onSubmit={handleAddModule} className="iot-form">
          <div className="form-group">
            <label htmlFor="communication">Communication Type *</label>
            <select
              id="communication"
              value={communicationType}
              onChange={(e) => {
                setCommunicationType(e.target.value);
              }}
              className="form-select"
              disabled={formLoading}
              required
            >
              <option value="socket">Socket</option>
              <option value="modbus">Modbus</option>
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="ipAddress">IP Address *</label>
              <input
                id="ipAddress"
                type="text"
                value={ipAddress}
                onChange={(e) => {
                  setIpAddress(e.target.value);
                }}
                placeholder="เช่น 192.168.1.100"
                disabled={formLoading}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="port">Port *</label>
              <input
                id="port"
                type="number"
                value={port}
                onChange={(e) => {
                  setPort(e.target.value);
                }}
                placeholder="เช่น 502, 8080"
                disabled={formLoading}
                required
                min="1"
                max="65535"
              />
            </div>
          </div>

          {communicationType === "modbus" && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="slaveId">Slave ID *</label>
                  <input
                    id="slaveId"
                    type="number"
                    value={slaveId}
                    onChange={(e) => {
                      setSlaveId(e.target.value);
                    }}
                    placeholder="เช่น 1, 2, 247"
                    disabled={formLoading}
                    min="1"
                    max="247"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="startAddressInput">Start Address Input *</label>
                  <input
                    id="startAddressInput"
                    type="number"
                    value={startAddressInput}
                    onChange={(e) => {
                      setStartAddressInput(e.target.value);
                    }}
                    placeholder="เช่น 0, 1000"
                    disabled={formLoading}
                    min="0"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="startAddressOutput">Start Address Output *</label>
                  <input
                    id="startAddressOutput"
                    type="number"
                    value={startAddressOutput}
                    onChange={(e) => {
                      setStartAddressOutput(e.target.value);
                    }}
                    placeholder="เช่น 8, 1008"
                    disabled={formLoading}
                    min="0"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="modbusFunction">Modbus Function *</label>
                <select
                  id="modbusFunction"
                  value={modbusFunction}
                  onChange={(e) => {
                    setModbusFunction(e.target.value);
                  }}
                  className="form-select"
                  disabled={formLoading}
                  required
                >
                  <optgroup label="Read Functions">
                    <option value="readCoils">Read Coils (FC 01)</option>
                    <option value="readDiscreteInputs">Read Discrete Inputs (FC 02)</option>
                    <option value="readHoldingRegisters">Read Holding Registers (FC 03)</option>
                    <option value="readInputRegisters">Read Input Registers (FC 04)</option>
                  </optgroup>
                  <optgroup label="Write Functions">
                    <option value="writeSingleCoil">Write Single Coil (FC 05)</option>
                    <option value="writeMultipleCoils">Write Multiple Coils (FC 15)</option>
                    <option value="writeSingleRegister">Write Single Register (FC 06)</option>
                    <option value="writeMultipleRegisters">Write Multiple Registers (FC 16)</option>
                  </optgroup>
                </select>
              </div>
            </>
          )}

          <div className="form-actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={formLoading}
            >
              {formLoading ? "กำลังเพิ่ม..." : "Add"}
            </button>
          </div>
        </form>
      </div>
      </div>

      {/* Right side - IOT Modules (3 parts) */}
      <div className="iot-config-right">
        <div className="card">
          <div className="iot-modules-header">
            <h2>IOT Modules ({iotModules.length})</h2>
            <p className="iot-modules-subtitle">แสดงสถานะและ IO ของ IOT Devices ที่บันทึกไว้</p>
          </div>

          {moduleError && (
            <div className="alert alert-error">{moduleError}</div>
          )}

          {modulesLoading ? (
            <div className="loading">กำลังโหลดข้อมูล IOT Modules...</div>
          ) : iotModules.length === 0 ? (
            <div className="empty-state">
              <p>ยังไม่มี IOT Module</p>
              <p className="empty-state-hint">กรอกข้อมูลและกดปุ่ม "Add" เพื่อเพิ่ม Module</p>
            </div>
          ) : (
            <div className="iot-modules-grid">
              {iotModules.map((module) => (
                <IOTModule
                  key={module.id}
                  module={module}
                  onDelete={handleDeleteModule}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// RCS Config Component (placeholder)
const RCSConfig = () => {
  return (
    <div className="settings-content">
      <div className="card">
        <h2>RCS Config</h2>
        <p>การตั้งค่า Robot Control System</p>
        <div className="placeholder-content">
          <p>Coming soon...</p>
        </div>
      </div>
    </div>
  );
};

// AGV Config Component
const AGVConfig = () => {
  const [configData, setConfigData] = useState(null);
  const [editedData, setEditedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [isArray, setIsArray] = useState(false);
  const [fieldPage, setFieldPage] = useState(0);
  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState("");

  const CONFIG_API_URL = "http://192.168.1.20:5050/config";
  const FILES_API_URL = "http://192.168.1.20:5050/files";
  const SELECT_FILE_API_URL = "http://192.168.1.20:5050/select-file";

  // Fetch config data
  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const response = await fetch(CONFIG_API_URL, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Check if data is an array
      if (Array.isArray(data)) {
        setIsArray(true);
        setConfigData(data);
        setEditedData(JSON.parse(JSON.stringify(data))); // Deep copy
        setCurrentPage(0);
        setFieldPage(0);
      } else {
        setIsArray(false);
        setConfigData(data);
        setEditedData(JSON.parse(JSON.stringify(data))); // Deep copy
        setFieldPage(0);
      }
    } catch (err) {
      console.error("Error fetching config:", err);
      setError(`ไม่สามารถดึงข้อมูลได้: ${err.message}`);
      setConfigData(null);
      setEditedData(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch file list for dropdown
  const fetchFiles = async () => {
    try {
      setFilesLoading(true);
      setError("");

      const response = await fetch(FILES_API_URL, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const normalized =
        Array.isArray(data) ? data : data?.files || data?.data || [];

      const list = normalized
        .map((item) => {
          if (typeof item === "string") {
            return item;
          }
          if (item && typeof item === "object") {
            return item.filename || item.fileName || item.name;
          }
          return null;
        })
        .filter(Boolean);

      setFiles(list);
      if (list.length > 0) {
        setSelectedFile(list[0]);
      }
    } catch (err) {
      console.error("Error fetching files:", err);
      setError(`ไม่สามารถดึงรายการไฟล์ได้: ${err.message}`);
      setFiles([]);
      setSelectedFile("");
    } finally {
      setFilesLoading(false);
    }
  };

  // Save config data
  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const dataToSave = isArray ? editedData : editedData;

      const response = await fetch(CONFIG_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataToSave),
      });

      let result;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        result = await response.json();
      } else {
        const text = await response.text();
        result = { message: text || response.statusText };
      }

      if (response.ok) {
        setSuccess(result.message || "บันทึกข้อมูลสำเร็จ");
        // Update configData with saved data
        setConfigData(JSON.parse(JSON.stringify(editedData)));
        setTimeout(() => {
          setSuccess("");
        }, 3000);
      } else {
        setError(result.error || result.message || `HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      console.error("Error saving config:", err);
      setError(`ไม่สามารถบันทึกข้อมูลได้: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Select file POST
  const handleSelectFile = async () => {
    try {
      if (!selectedFile) {
        setError("กรุณาเลือกไฟล์ก่อน");
        return;
      }
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch(SELECT_FILE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileName: selectedFile }),
      });

      let result;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        result = await response.json();
      } else {
        const text = await response.text();
        result = { message: text || response.statusText };
      }

      if (response.ok) {
        setSuccess(result.message || "เลือกไฟล์สำเร็จ");
        await fetchConfig(); // auto refresh config after selecting file
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(result.error || result.message || `HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      console.error("Error selecting file:", err);
      setError(`ไม่สามารถเลือกไฟล์ได้: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Update edited data - uses dot notation where array indices are numeric strings
  const updateField = (path, value) => {
    setEditedData((prev) => {
      const newData = JSON.parse(JSON.stringify(prev));
      const parts = path.split(".").filter(p => p !== "");
      
      if (parts.length === 0) return newData;
      
      // Helper to set nested value
      const setNestedValue = (obj, pathParts, val) => {
        if (pathParts.length === 1) {
          const part = pathParts[0];
          const isNumeric = /^\d+$/.test(part);
          
          if (isNumeric) {
            const index = parseInt(part);
            if (!Array.isArray(obj)) {
              obj = [];
            }
            while (obj.length <= index) {
              obj.push(undefined);
            }
            obj[index] = val;
          } else {
            if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
              obj = {};
            }
            obj[part] = val;
          }
          return obj;
        }
        
        const [first, ...rest] = pathParts;
        const isNumeric = /^\d+$/.test(first);
        
        if (isNumeric) {
          const index = parseInt(first);
          if (!Array.isArray(obj)) {
            obj = [];
          }
          while (obj.length <= index) {
            obj.push({});
          }
          if (obj[index] === null || obj[index] === undefined || typeof obj[index] !== "object") {
            obj[index] = {};
          }
          obj[index] = setNestedValue(obj[index], rest, val);
        } else {
          if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
            obj = {};
          }
          // Check if next part is numeric
          const nextIsNumeric = /^\d+$/.test(rest[0]);
          if (!obj[first]) {
            obj[first] = nextIsNumeric ? [] : {};
          } else if (nextIsNumeric && !Array.isArray(obj[first])) {
            // Convert to array
            const temp = obj[first];
            obj[first] = [];
            if (typeof temp === "object" && temp !== null) {
              Object.keys(temp).forEach(k => {
                const numKey = parseInt(k);
                if (!isNaN(numKey)) {
                  obj[first][numKey] = temp[k];
                }
              });
            }
          } else if (!nextIsNumeric && Array.isArray(obj[first])) {
            // Convert to object
            obj[first] = {};
          }
          obj[first] = setNestedValue(obj[first], rest, val);
        }
        
        return obj;
      };
      
      if (isArray) {
        const newArray = [...newData];
        newArray[currentPage] = setNestedValue(newArray[currentPage], parts, value);
        return newArray;
      } else {
        return setNestedValue(newData, parts, value);
      }
    });
  };

  // Render editable field
  const renderField = (key, value, path = "") => {
    const fullPath = path ? `${path}.${key}` : key;

    if (value === null || value === undefined) {
      return (
        <div key={fullPath} className="agv-config-field">
          <label>{key}:</label>
          <input
            type="text"
            value=""
            onChange={(e) => updateField(fullPath, e.target.value)}
            placeholder="null"
          />
        </div>
      );
    }

    if (typeof value === "boolean") {
      return (
        <div key={fullPath} className="agv-config-field">
          <label>{key}:</label>
          <select
            value={value.toString()}
            onChange={(e) => updateField(fullPath, e.target.value === "true")}
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        </div>
      );
    }

    if (typeof value === "number") {
      return (
        <div key={fullPath} className="agv-config-field">
          <label>{key}:</label>
          <input
            type="number"
            value={value}
            onChange={(e) => updateField(fullPath, parseFloat(e.target.value) || 0)}
          />
        </div>
      );
    }

    if (typeof value === "string") {
      return (
        <div key={fullPath} className="agv-config-field">
          <label>{key}:</label>
          <input
            type="text"
            value={value}
            onChange={(e) => updateField(fullPath, e.target.value)}
          />
        </div>
      );
    }

    if (Array.isArray(value)) {
      return (
        <div key={fullPath} className="agv-config-field agv-config-nested">
          <label>{key}:</label>
          <div className="agv-config-array">
            {value.map((item, index) => (
              <div key={index} className="agv-config-array-item">
                {typeof item === "object" && item !== null
                  ? Object.entries(item).map(([k, v]) => renderField(k, v, `${fullPath}.${index}`))
                  : renderField(index.toString(), item, `${fullPath}.${index}`)}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (typeof value === "object") {
      return (
        <div key={fullPath} className="agv-config-field agv-config-nested">
          <label className="agv-config-object-label">{key}:</label>
          <div className="agv-config-object">
            {Object.entries(value).map(([k, v]) => renderField(k, v, fullPath))}
          </div>
        </div>
      );
    }

    return null;
  };

  // Get current data to display
  const getCurrentData = () => {
    if (!editedData) return null;
    return isArray ? editedData[currentPage] : editedData;
  };

  useEffect(() => {
    fetchConfig();
    fetchFiles();
  }, []);

  const currentData = getCurrentData();
  const totalPages = isArray && editedData ? editedData.length : 1;
  const FIELD_PAGE_SIZE = 15; // 5 columns x 3 rows
  const fieldEntries =
    currentData && typeof currentData === "object" && !Array.isArray(currentData)
      ? Object.entries(currentData)
      : [];
  const totalFieldPages = Math.max(1, Math.ceil(fieldEntries.length / FIELD_PAGE_SIZE));
  const paginatedFields = fieldEntries.slice(
    fieldPage * FIELD_PAGE_SIZE,
    fieldPage * FIELD_PAGE_SIZE + FIELD_PAGE_SIZE
  );

  return (
    <div className="settings-content">
      <div className="card">
        <div className="agv-config-header">
          <div>
            <h2>AGV Config</h2>
            <p>การตั้งค่า Automated Guided Vehicle</p>
          </div>
          <div className="agv-config-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={handleSave}
              disabled={saving || !editedData}
            >
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>

        <div className="agv-config-filebar">
          <div className="agv-file-select">
            <label htmlFor="agv-file-dropdown">ไฟล์คอนฟิก</label>
            <select
              id="agv-file-dropdown"
              value={selectedFile}
              onChange={(e) => setSelectedFile(e.target.value)}
              disabled={filesLoading || files.length === 0}
            >
              {files.length === 0 ? (
                <option value="">ไม่มีไฟล์</option>
              ) : (
                files.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="agv-file-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={handleSelectFile}
              disabled={saving || !selectedFile}
            >
              {saving ? "กำลังดำเนินการ..." : "เลือกไฟล์นี้"}
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {loading ? (
          <div className="loading">กำลังโหลดข้อมูล...</div>
        ) : !editedData ? (
          <div className="empty-state">ไม่พบข้อมูล Config</div>
        ) : (
          <>
            {isArray && totalPages > 1 && (
              <div className="agv-config-pagination">
                <button
                  type="button"
                  className="btn-pagination"
                  onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
                  disabled={currentPage === 0}
                >
                  ← ก่อนหน้า
                </button>
                <span className="pagination-info">
                  หน้า {currentPage + 1} จาก {totalPages}
                </span>
                <button
                  type="button"
                  className="btn-pagination"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))}
                  disabled={currentPage >= totalPages - 1}
                >
                  ถัดไป →
                </button>
              </div>
            )}

            <div className="agv-config-editor">
              {currentData && typeof currentData === "object" && currentData !== null ? (
                <>
                  <div className="agv-fields-grid">
                    {paginatedFields.map(([key, value]) => (
                      <div key={key} className="agv-field-card">
                        {renderField(key, value)}
                      </div>
                    ))}
                  </div>
                  {fieldEntries.length > FIELD_PAGE_SIZE && (
                    <div className="agv-field-pagination">
                      <button
                        type="button"
                        className="btn-pagination"
                        onClick={() => setFieldPage((prev) => Math.max(0, prev - 1))}
                        disabled={fieldPage === 0}
                      >
                        ←
                      </button>
                      <span className="pagination-info">
                        Page {fieldPage + 1} of {totalFieldPages}
                      </span>
                      <button
                        type="button"
                        className="btn-pagination"
                        onClick={() => setFieldPage((prev) => Math.min(totalFieldPages - 1, prev + 1))}
                        disabled={fieldPage >= totalFieldPages - 1}
                      >
                        →
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-state">ข้อมูลไม่ถูกต้อง</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Main Settings Component
const Settings = () => {
  const [activeTab, setActiveTab] = useState("park");

  const tabs = [
    { id: "park", label: "Park Config", icon: HiOutlineBuildingOffice2 },
    { id: "iot", label: "IOT Config", icon: HiOutlineSignal },
    { id: "rcs", label: "RCS Config", icon: HiOutlineCpuChip },
    { id: "agv", label: "AGV Config", icon: HiOutlineTruck },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "park":
        return <ParkConfig />;
      case "iot":
        return <IOTConfig />;
      case "rcs":
        return <RCSConfig />;
      case "agv":
        return <AGVConfig />;
      default:
        return <ParkConfig />;
    }
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>Setting & Config</h1>
        <p>ตั้งค่าและการกำหนดค่าต่างๆ ของระบบ</p>
      </div>

      <div className="settings-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`settings-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">
              <tab.icon size={18} />
            </span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="settings-tab-content">
        {renderContent()}
      </div>
    </div>
  );
};

export default Settings;
