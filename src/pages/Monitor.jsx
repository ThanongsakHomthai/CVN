import { useState, useEffect, useCallback, useRef } from "react";
import ReactFlow, {
  MiniMap,
  Controls,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";
import "../styles/Pages.css";
import "./Monitor.css";

import MonitorNodePalette from "../components/monitor/MonitorNodePalette";
import MonitorNodeConfigModal from "../components/monitor/MonitorNodeConfigModal";
import DrawingTools from "../components/monitor/DrawingTools";
import CanvasDrawing from "../components/monitor/CanvasDrawing";
import { LampNode, CounterNode, ParkNode, MapNode, LabelNode, BatteryNode, DateNode } from "../components/monitor/MonitorNodes";

const API_BASE = "http://localhost:4000";

const nodeTypes = {
  lamp: LampNode,
  counter: CounterNode,
  park: ParkNode,
  map: MapNode,
  label: LabelNode,
  battery: BatteryNode,
  date: DateNode,
};

const initialNodes = [];
const initialEdges = []; // Monitor ไม่ใช้ edges

function Monitor({ user }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [parks, setParks] = useState([]);
  const [agvs, setAgvs] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const nodeIdCounter = useRef(1);
  const [selectedDrawingTool, setSelectedDrawingTool] = useState(null);
  const [drawings, setDrawings] = useState([]);
  const [drawingStrokeColor, setDrawingStrokeColor] = useState("#3b82f6");
  const [drawingStrokeWidth, setDrawingStrokeWidth] = useState(2);
  const [canvasLocked, setCanvasLocked] = useState(false);
  const [showCanvasControls, setShowCanvasControls] = useState(true);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const isRunningRef = useRef(isRunning);
  const statusPollIntervalRef = useRef(null);
  const nodeUpdateIntervalRef = useRef(null);
  const batteryUpdateIntervalRef = useRef(null);
  const dateUpdateIntervalRef = useRef(null);
  // Track previous use_state for counter nodes (key: nodeId, value: Map of park external_name -> use_state)
  const counterPreviousStatesRef = useRef(new Map());

  // Update refs when state changes
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    isRunningRef.current = isRunning;
    if (isRunning) {
      setCanvasLocked(true); // ล็อกอัตโนมัติเมื่อกด Run
    }
  }, [isRunning]);

  // Sync fullscreen state
  const handleFullscreenChange = useCallback(() => {
    const fsElement =
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement;

    // fullscreen เฉพาะเมื่อ element นี้กำลังถูก fullscreen
    if (!reactFlowWrapper.current) {
      setIsFullscreen(false);
      return;
    }
    setIsFullscreen(fsElement === reactFlowWrapper.current);
  }, []);

  useEffect(() => {
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, [handleFullscreenChange]);

  // Load parks data
  useEffect(() => {
    const fetchParks = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/parks`);
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setParks(result.data || []);
          }
        }
      } catch (error) {
        console.error("Error fetching parks:", error);
      }
    };
    fetchParks();
  }, []);

  // Delete node - must be declared before loadSavedNodes
  const handleDeleteNode = useCallback((nodeId) => {
    // Prevent deletion for user role
    if (user?.role === "user") {
      return;
    }
    if (isRunningRef.current) {
      alert("ไม่สามารถลบ Node ขณะ Monitor กำลังทำงานอยู่");
      return;
    }
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setSelectedNode((prev) => {
      if (prev?.id === nodeId) {
        return null;
      }
      return prev;
    });
    setConfigModalOpen(false);
  }, [setNodes, user]);

  // Load saved nodes from database on mount
  const loadSavedNodes = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/monitor/nodes?flow_id=default`);
      const result = await response.json();
      
      if (result.success && result.data) {
        const savedNodes = result.data.nodes || [];
        
        if (savedNodes.length > 0) {
          // Find max node ID to continue numbering
          const maxId = savedNodes.reduce((max, node) => {
            const match = node.id.match(/monitor-(\d+)/);
            if (match) {
              const idNum = parseInt(match[1], 10);
              return Math.max(max, idNum);
            }
            return max;
          }, 0);
          nodeIdCounter.current = maxId + 1;
          
          // Restore nodes with handlers
          const restoredNodes = savedNodes.map((node) => ({
            ...node,
            data: {
              ...node.data,
              config: node.data?.config || {},
              value: node.type === "counter" ? (node.data?.value !== undefined ? node.data.value : 0) : 
                     (node.type === "date" ? (node.data?.value || new Date().toLocaleString("th-TH", {
                       year: "numeric",
                       month: "2-digit",
                       day: "2-digit",
                       hour: "2-digit",
                       minute: "2-digit",
                       second: "2-digit",
                     })) : node.data?.value),
              onEdit: user?.role === "admin" ? (nodeId) => {
                const n = nodesRef.current.find((n) => n.id === nodeId);
                if (n) {
                  setSelectedNode(n);
                  setConfigModalOpen(true);
                }
              } : undefined,
              onDelete: user?.role === "admin" ? handleDeleteNode : undefined,
            },
          }));
          
          setNodes(restoredNodes);
          console.log(`[Monitor] Loaded ${restoredNodes.length} nodes from database`);
        }
      }
    } catch (error) {
      console.error("Error loading saved nodes:", error);
    }
  }, [setNodes, user, handleDeleteNode]);

  // Load saved nodes on mount
  useEffect(() => {
    loadSavedNodes();
  }, [loadSavedNodes]);

  // Save nodes to database
  const saveNodesToDatabase = useCallback(async (nodesToSave) => {
    try {
      if (isRunningRef.current) {
        return;
      }
      
      const response = await fetch(`${API_BASE}/api/monitor/nodes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nodes: nodesToSave,
          flow_id: "default",
        }),
      });
      
      const result = await response.json();
      if (result.success) {
        console.log(`Saved ${nodesToSave.length} nodes to database`);
      } else {
        console.error("Error saving nodes:", result.error);
      }
    } catch (error) {
      console.error("Error saving nodes to database:", error);
    }
  }, []);

  // Auto-save nodes when they change (debounced)
  useEffect(() => {
    if (nodes.length === 0) return;
    
    const timeoutId = setTimeout(() => {
      saveNodesToDatabase(nodes);
    }, 1000); // Debounce 1 second
    
    return () => clearTimeout(timeoutId);
  }, [nodes, saveNodesToDatabase]);

  // Load AGVs data for map nodes (only when running)
  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const fetchAgvs = async () => {
      try {
        const response = await fetch(`${API_BASE}/agvs`);
        if (response.ok) {
          const data = await response.json();
          const normalized = Array.isArray(data) ? data : (data?.agvs || data?.data || []);
          setAgvs(normalized);
          
          // Load map settings from localStorage (same as ManualOperate)
          const savedOrigin = localStorage.getItem("mapOriginOffset");
          const savedMapSize = localStorage.getItem("mapSizeMeters");
          const savedScales = localStorage.getItem("mapScales");
          
          let originOffset = { x: 0, y: 0 };
          let mapWidthMeters = 50;
          let mapHeightMeters = 50;
          let mapScaleX = null;
          let mapScaleY = null;
          
          if (savedOrigin) {
            try {
              const parsed = JSON.parse(savedOrigin);
              originOffset = { x: parsed.x || 0, y: parsed.y || 0 };
            } catch (e) {
              console.error("Error loading origin offset:", e);
            }
          }
          
          if (savedMapSize) {
            try {
              const parsed = JSON.parse(savedMapSize);
              mapWidthMeters = parsed.width || 50;
              mapHeightMeters = parsed.height || 50;
            } catch (e) {
              console.error("Error loading map size:", e);
            }
          }
          
          if (savedScales) {
            try {
              const parsed = JSON.parse(savedScales);
              mapScaleX = parsed.scaleX || null;
              mapScaleY = parsed.scaleY || null;
            } catch (e) {
              console.error("Error loading map scales:", e);
            }
          }

          // Update map nodes with AGV positions and map settings
          setNodes((nds) =>
            nds.map((node) => {
              if (node.type === "map") {
                // Get map dimensions from node data (will be set when image loads)
                const mapDimensions = node.data?.mapDimensions || { width: 0, height: 0 };
                
                return {
                  ...node,
                  data: { 
                    ...node.data, 
                    agvs: normalized, // Pass raw AGV data, MapNode will process it
                    mapDimensions,
                    mapWidthMeters,
                    mapHeightMeters,
                    mapScaleX,
                    mapScaleY,
                    originOffset,
                  },
                };
              }
              return node;
            })
          );
        }
      } catch (error) {
        console.error("Error fetching AGVs:", error);
      }
    };

    fetchAgvs();
    const interval = setInterval(fetchAgvs, 5000);
    return () => clearInterval(interval);
  }, [isRunning, setNodes]);

  // Handle drag and drop
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      // Prevent adding new nodes for user role
      if (user?.role === "user") {
        return;
      }

      if (isRunningRef.current) {
        return;
      }

      const type = event.dataTransfer.getData("application/reactflow");

      if (!type || !reactFlowInstance) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Set default config
      const defaultConfig = {};

      const newNode = {
        id: `monitor-${nodeIdCounter.current++}`,
        type,
        position,
          data: {
            config: defaultConfig,
            value: type === "counter" ? 0 : (type === "date" ? new Date().toLocaleString("th-TH", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }) : null),
          onEdit: user?.role === "admin" ? (nodeId) => {
            const node = nodesRef.current.find((n) => n.id === nodeId);
            if (node) {
              setSelectedNode(node);
              setConfigModalOpen(true);
            }
          } : undefined,
          onDelete: user?.role === "admin" ? handleDeleteNode : undefined,
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes, handleDeleteNode, user]
  );

  // Handle node click
  const onNodeClick = useCallback((event, node) => {
    event.stopPropagation();
    // Only allow selection for admin
    if (user?.role === "admin") {
      setSelectedNode(node);
    }
  }, [user]);

  // Handle node double click
  const onNodeDoubleClick = useCallback((event, node) => {
    event.stopPropagation();
    // Prevent opening config modal for user role
    if (user?.role === "user") {
      return;
    }
    setSelectedNode(node);
    setConfigModalOpen(true);
  }, [user]);

  // Save node config
  const handleSaveNodeConfig = useCallback((nodeId, config) => {
    // Prevent saving config for user role
    if (user?.role === "user") {
      return;
    }
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              config,
            },
          };
        }
        return node;
      })
    );
  }, [setNodes, user]);

  // API calls for Monitor
  const callMonitorStart = useCallback(async () => {
    const response = await fetch(`${API_BASE}/api/monitor/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flow_id: "default" }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    return result;
  }, []);

  const callMonitorStop = useCallback(async () => {
    const response = await fetch(`${API_BASE}/api/monitor/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    return result;
  }, []);

  const callMonitorStatus = useCallback(async () => {
    const response = await fetch(`${API_BASE}/api/monitor/status`);
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    return result.data || {};
  }, []);

  // Poll monitor status and update node values
  useEffect(() => {
    if (!isRunning) {
      if (statusPollIntervalRef.current) {
        clearInterval(statusPollIntervalRef.current);
        statusPollIntervalRef.current = null;
      }
      if (nodeUpdateIntervalRef.current) {
        clearInterval(nodeUpdateIntervalRef.current);
        nodeUpdateIntervalRef.current = null;
      }
      if (batteryUpdateIntervalRef.current) {
        clearInterval(batteryUpdateIntervalRef.current);
        batteryUpdateIntervalRef.current = null;
      }
      if (dateUpdateIntervalRef.current) {
        clearInterval(dateUpdateIntervalRef.current);
        dateUpdateIntervalRef.current = null;
      }
      return;
    }

    // Poll status from backend
    const pollStatus = async () => {
      try {
        const status = await callMonitorStatus();
        if (status.isRunning !== isRunningRef.current) {
          setIsRunning(status.isRunning);
          isRunningRef.current = status.isRunning;
        }
      } catch (error) {
        console.error("[Monitor] Error polling status:", error);
      }
    };

    // Poll node values from backend (lamp, counter, park)
    const pollNodeValues = async () => {
      const currentNodes = nodesRef.current;
      
      for (const node of currentNodes) {
        if (node.type === "lamp") {
          const ipAddress = node.data?.config?.ipAddress;
          const address = node.data?.config?.address;

          if (ipAddress && address) {
            try {
              const response = await fetch(`${API_BASE}/api/iot/modbus/read`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ipAddress, address }),
              });

              if (response.ok) {
                const result = await response.json();
                if (result.success) {
                  const isOn = result.value === 1;
                  setNodes((nds) =>
                    nds.map((n) =>
                      n.id === node.id
                        ? { ...n, data: { ...n.data, value: isOn, isRunning: true } }
                        : n
                    )
                  );
                }
              }
            } catch (error) {
              console.error(`[Monitor] Error updating lamp ${node.id}:`, error);
            }
          }
        } else if (node.type === "counter") {
          const group = node.data?.config?.group;
          if (group) {
            try {
              const response = await fetch(
                `${API_BASE}/api/parks?group=${encodeURIComponent(group)}`
              );
              if (response.ok) {
                const result = await response.json();
                if (result.success && Array.isArray(result.data)) {
                  // normalize ข้อมูลป้องกัน space / type mismatch
                  const normalizedParks = result.data.map((p) => ({
                    ...p,
                    groups: (p.groups || "").trim(),
                    external_name: (p.external_name || "").trim(),
                    use_state: Number(p.use_state),
                  }));

                  // Get previous states for this counter node
                  const previousStates = counterPreviousStatesRef.current.get(node.id) || new Map();
                  
                  // Check for state changes from 1 to 3
                  let shouldIncrement = false;
                  const newStates = new Map();
                  
                  normalizedParks.forEach((park) => {
                    const parkKey = park.external_name;
                    const currentState = park.use_state;
                    const previousState = previousStates.get(parkKey);
                    
                    newStates.set(parkKey, currentState);
                    
                    // Check if state changed from 1 to 3 (only on first update)
                    if (previousState !== undefined && previousState === 1 && currentState === 3) {
                      shouldIncrement = true;
                    }
                  });
                  
                  // Update previous states
                  counterPreviousStatesRef.current.set(node.id, newStates);
                  
                  // Initialize previous states if this is the first time
                  if (previousStates.size === 0) {
                    // First time, just store current states without incrementing
                    counterPreviousStatesRef.current.set(node.id, newStates);
                  } else if (shouldIncrement) {
                    // Increment counter
                    setNodes((nds) =>
                      nds.map((n) =>
                        n.id === node.id
                          ? {
                              ...n,
                              data: {
                                ...n.data,
                                value: ((n.data?.value || 0) + 1),
                                isRunning: true,
                              },
                            }
                          : n
                      )
                    );
                  } else {
                    // Just mark as running
                    setNodes((nds) =>
                      nds.map((n) =>
                        n.id === node.id
                          ? { ...n, data: { ...n.data, isRunning: true } }
                          : n
                      )
                    );
                  }
                }
              }
            } catch (error) {
              console.error(`[Monitor] Error updating counter ${node.id}:`, error);
              setNodes((nds) =>
                nds.map((n) =>
                  n.id === node.id
                    ? { ...n, data: { ...n.data, isRunning: true } }
                    : n
                )
              );
            }
          } else {
            // No group selected, just mark as running
            setNodes((nds) =>
              nds.map((n) =>
                n.id === node.id
                  ? { ...n, data: { ...n.data, isRunning: true } }
                  : n
              )
            );
          }
        } else if (node.type === "park") {
          const group = node.data?.config?.group;
          const externalName = node.data?.config?.externalName;
          if (group && externalName) {
            try {
              const response = await fetch(
                `${API_BASE}/api/parks?group=${encodeURIComponent(group)}`
              );
              if (response.ok) {
                const result = await response.json();
                if (result.success && Array.isArray(result.data)) {
                  // normalize ข้อมูลป้องกัน space / type mismatch
                  const normalizedParks = result.data.map((p) => ({
                    ...p,
                    groups: (p.groups || "").trim(),
                    external_name: (p.external_name || "").trim(),
                    use_state: Number(p.use_state),
                  }));

                  const park = normalizedParks.find(
                    (p) =>
                      p.groups === group.trim() &&
                      p.external_name === externalName.trim()
                  );

                  if (park) {
                    const useState = Number(park.use_state) || 0;
                    const isOn = useState === 3; // 3 = on, 1 = off
                    setNodes((nds) =>
                      nds.map((n) =>
                        n.id === node.id
                          ? {
                              ...n,
                              data: {
                                ...n.data,
                                value: isOn,
                                config: {
                                  ...n.data.config,
                                  useState,
                                },
                                isRunning: true,
                              },
                            }
                          : n
                      )
                    );
                  }
                }
              }
            } catch (error) {
              console.error(`[Monitor] Error updating park ${node.id}:`, error);
            }
          }
        } else if (node.type === "map") {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === node.id
                ? { ...n, data: { ...n.data, isRunning: true } }
                : n
            )
          );
        } else if (node.type === "label") {
          // Label node แค่แสดงข้อความ ไม่ต้องดึงข้อมูลจาก backend
          setNodes((nds) =>
            nds.map((n) =>
              n.id === node.id
                ? { ...n, data: { ...n.data, isRunning: true } }
                : n
            )
          );
        } else if (node.type === "battery") {
          const agvId = node.data?.config?.agvId;
          if (agvId) {
            try {
              // ดึงข้อมูล AGV จาก API
              const response = await fetch(`${API_BASE}/agvs`);
              if (response.ok) {
                const raw = await response.json();
                const normalized = Array.isArray(raw) ? raw : (raw?.agvs || raw?.data || []);
                
                // หา AGV ที่ตรงกับ agvId
                const agv = normalized.find((a) => 
                  a?.id === agvId || 
                  a?.name === agvId || 
                  a?.agv_id === agvId
                );
                
                if (agv) {
                  // ดึงค่า battery จาก agv_data หรือ agv.battery
                  let batteryValue = null;
                  
                  // ลองดึงจาก agv_data (JSON field)
                  if (agv?.agv_data) {
                    try {
                      const agvData = typeof agv.agv_data === 'string' 
                        ? JSON.parse(agv.agv_data) 
                        : agv.agv_data;
                      let rawBattery = agvData?.battery;
                      if (rawBattery !== null && rawBattery !== undefined) {
                        const num = Number(rawBattery);
                        if (Number.isFinite(num)) {
                          // กรณีค่ามาเป็นสัดส่วน (0.86) ให้คูณ 100 เพื่อแสดงเป็นเปอร์เซ็นต์
                          batteryValue = num <= 1 ? num * 100 : num;
                        }
                      }
                    } catch (e) {
                      console.error(`[Monitor] Error parsing agv_data for ${agvId}:`, e);
                    }
                  }
                  
                  // ถ้ายังไม่มี ลองดึงจาก agv.battery โดยตรง
                  if (batteryValue === null || batteryValue === undefined) {
                    const rawBattery = agv?.battery;
                    if (rawBattery !== null && rawBattery !== undefined) {
                      const num = Number(rawBattery);
                      if (Number.isFinite(num)) {
                        // กรณีค่ามาเป็นสัดส่วน (0.86) ให้คูณ 100 เพื่อแสดงเป็นเปอร์เซ็นต์
                        batteryValue = num <= 1 ? num * 100 : num;
                      }
                    }
                  }
                  
                  // แปลงเป็นตัวเลขและจำกัดช่วง 0-100
                  const batteryNum = batteryValue !== null && batteryValue !== undefined 
                    ? Math.max(0, Math.min(100, Number(batteryValue))) 
                    : null;
                  
                  setNodes((nds) =>
                    nds.map((n) =>
                      n.id === node.id
                        ? { 
                            ...n, 
                            data: { 
                              ...n.data, 
                              value: batteryNum,
                              isRunning: true 
                            } 
                          }
                        : n
                    )
                  );
                } else {
                  // ไม่พบ AGV
                  setNodes((nds) =>
                    nds.map((n) =>
                      n.id === node.id
                        ? { 
                            ...n, 
                            data: { 
                              ...n.data, 
                              value: null,
                              isRunning: true 
                            } 
                          }
                        : n
                    )
                  );
                }
              }
            } catch (error) {
              console.error(`[Monitor] Error updating battery ${node.id}:`, error);
            }
          }
        } else if (node.type === "date") {
          // Date nodes are updated by dedicated interval, just mark as running
          setNodes((nds) =>
            nds.map((n) =>
              n.id === node.id
                ? { ...n, data: { ...n.data, isRunning: true } }
                : n
            )
          );
        }
      }
    };

    statusPollIntervalRef.current = setInterval(pollStatus, 2000);
    nodeUpdateIntervalRef.current = setInterval(pollNodeValues, 1000);
    
    // Battery nodes อัพเดททุก 2 วินาที (แยกจาก nodeUpdateInterval)
    const pollBatteryValues = async () => {
      const currentNodes = nodesRef.current;
      const batteryNodes = currentNodes.filter((n) => n.type === "battery");
      
      if (batteryNodes.length === 0) return;
      
      try {
        // ดึงข้อมูล AGV จาก API
        const response = await fetch(`${API_BASE}/agvs`);
        if (response.ok) {
          const raw = await response.json();
          const normalized = Array.isArray(raw) ? raw : (raw?.agvs || raw?.data || []);
          
          // อัพเดทแต่ละ battery node
          batteryNodes.forEach((node) => {
            const agvId = node.data?.config?.agvId;
            if (!agvId) return;
            
            const agv = normalized.find((a) => 
              a?.id === agvId || 
              a?.name === agvId || 
              a?.agv_id === agvId
            );
            
            if (agv) {
              // ดึงค่า battery จาก agv_data หรือ agv.battery
              let batteryValue = null;
              
              if (agv?.agv_data) {
                try {
                  const agvData = typeof agv.agv_data === 'string' 
                    ? JSON.parse(agv.agv_data) 
                    : agv.agv_data;
                  let rawBattery = agvData?.battery;
                  if (rawBattery !== null && rawBattery !== undefined) {
                    const num = Number(rawBattery);
                    if (Number.isFinite(num)) {
                      // กรณีค่ามาเป็นสัดส่วน (0.86) ให้คูณ 100 เพื่อแสดงเป็นเปอร์เซ็นต์
                      batteryValue = num <= 1 ? num * 100 : num;
                    }
                  }
                } catch (e) {
                  console.error(`[Monitor] Error parsing agv_data for ${agvId}:`, e);
                }
              }
              
              if (batteryValue === null || batteryValue === undefined) {
                const rawBattery = agv?.battery;
                if (rawBattery !== null && rawBattery !== undefined) {
                  const num = Number(rawBattery);
                  if (Number.isFinite(num)) {
                    // กรณีค่ามาเป็นสัดส่วน (0.86) ให้คูณ 100 เพื่อแสดงเป็นเปอร์เซ็นต์
                    batteryValue = num <= 1 ? num * 100 : num;
                  }
                }
              }
              
              const batteryNum = batteryValue !== null && batteryValue !== undefined 
                ? Math.max(0, Math.min(100, Number(batteryValue))) 
                : null;
              
              setNodes((nds) =>
                nds.map((n) =>
                  n.id === node.id
                    ? { 
                        ...n, 
                        data: { 
                          ...n.data, 
                          value: batteryNum,
                          isRunning: true 
                        } 
                      }
                    : n
                )
              );
            } else {
              setNodes((nds) =>
                nds.map((n) =>
                  n.id === node.id
                    ? { 
                        ...n, 
                        data: { 
                          ...n.data, 
                          value: null,
                          isRunning: true 
                        } 
                      }
                    : n
                )
              );
            }
          });
        }
      } catch (error) {
        console.error("[Monitor] Error polling battery values:", error);
      }
    };
    
    batteryUpdateIntervalRef.current = setInterval(pollBatteryValues, 2000);
    
    // Date nodes อัพเดททุก 1 วินาที
    const updateDateNodes = () => {
      const currentNodes = nodesRef.current;
      const dateNodes = currentNodes.filter((n) => n.type === "date");
      
      if (dateNodes.length === 0) return;
      
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
      
      setNodes((nds) =>
        nds.map((n) => {
          if (n.type === "date") {
            const format = n.data?.config?.format || "datetime";
            const dateTimeString = formatDate(format);
            return { ...n, data: { ...n.data, value: dateTimeString, isRunning: true } };
          }
          return n;
        })
      );
    };
    
    dateUpdateIntervalRef.current = setInterval(updateDateNodes, 1000);

    return () => {
      if (statusPollIntervalRef.current) {
        clearInterval(statusPollIntervalRef.current);
        statusPollIntervalRef.current = null;
      }
      if (nodeUpdateIntervalRef.current) {
        clearInterval(nodeUpdateIntervalRef.current);
        nodeUpdateIntervalRef.current = null;
      }
      if (batteryUpdateIntervalRef.current) {
        clearInterval(batteryUpdateIntervalRef.current);
        batteryUpdateIntervalRef.current = null;
      }
      if (dateUpdateIntervalRef.current) {
        clearInterval(dateUpdateIntervalRef.current);
        dateUpdateIntervalRef.current = null;
      }
    };
  }, [isRunning, callMonitorStatus, setNodes]);

  // Start monitoring - call backend API
  const startMonitoring = useCallback(async () => {
    if (isRunningRef.current) {
      return;
    }

    try {
      await callMonitorStart();
      setIsRunning(true);
      isRunningRef.current = true;
    } catch (error) {
      console.error("[Monitor] Error starting monitor:", error);
      alert(`ไม่สามารถเริ่ม Monitor ได้: ${error.message}`);
    }
  }, [callMonitorStart]);

  // Stop monitoring - call backend API
  const stopMonitoring = useCallback(async () => {
    try {
      await callMonitorStop();
      setIsRunning(false);
      isRunningRef.current = false;

      // Reset node states
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          data: { ...node.data, isRunning: false },
        }))
      );
    } catch (error) {
      console.error("[Monitor] Error stopping monitor:", error);
      alert(`ไม่สามารถหยุด Monitor ได้: ${error.message}`);
    }
  }, [callMonitorStop, setNodes]);

  // Handle start button
  const handleStart = useCallback(() => {
    if (nodes.length === 0) {
      alert("กรุณาเพิ่ม Node ก่อนเริ่ม Monitor");
      return;
    }
    startMonitoring();
  }, [nodes.length, startMonitoring]);

  // Handle stop button
  const handleStop = useCallback(() => {
    stopMonitoring();
  }, [stopMonitoring]);

  // Fullscreen toggle สำหรับ canvas
  const toggleFullscreen = useCallback(() => {
    const element = reactFlowWrapper.current;
    if (!element) return;

    // หากยังไม่ fullscreen ให้ขอ fullscreen เฉพาะ canvas
    const fsElement =
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement;

    if (!fsElement) {
      const request =
        element.requestFullscreen ||
        element.webkitRequestFullscreen ||
        element.mozRequestFullScreen ||
        element.msRequestFullscreen;
      if (request) {
        request.call(element).catch((err) => {
          console.error("Error attempting fullscreen:", err);
        });
      }
    } else {
      const exit =
        document.exitFullscreen ||
        document.webkitExitFullscreen ||
        document.mozCancelFullScreen ||
        document.msExitFullscreen;
      if (exit) {
        exit.call(document).catch((err) => {
          console.error("Error exiting fullscreen:", err);
        });
      }
    }
  }, []);

  // Ensure all nodes have handlers
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        const needsUpdate = !node.data?.onEdit || !node.data?.onDelete;

        if (needsUpdate) {
          return {
            ...node,
            data: {
              ...node.data,
              config: node.data?.config || {},
              value: node.type === "counter" ? (node.data?.value !== undefined ? node.data.value : 0) :
                     (node.type === "date" ? (node.data?.value || new Date().toLocaleString("th-TH", {
                       year: "numeric",
                       month: "2-digit",
                       day: "2-digit",
                       hour: "2-digit",
                       minute: "2-digit",
                       second: "2-digit",
                     })) : node.data?.value),
              onEdit: user?.role === "admin" ? (node.data?.onEdit || ((nodeId) => {
                const n = nodesRef.current.find((n) => n.id === nodeId);
                if (n) {
                  setSelectedNode(n);
                  setConfigModalOpen(true);
                }
              })) : undefined,
              onDelete: user?.role === "admin" ? (node.data?.onDelete || handleDeleteNode) : undefined,
            },
          };
        }
        return node;
      })
    );
  }, [setNodes, handleDeleteNode, user]);

  return (
    <div className="monitor-page">
      <div className="monitor-header">
        <h1>Monitor</h1>
        <p>Monitor สถานะต่างๆ ของระบบ</p>
      </div>

      <div className="monitor-toolbar">
        <button
          className={`btn-run ${isRunning ? "running" : ""}`}
          onClick={handleStart}
          disabled={isRunning}
        >
          ▶ Run
        </button>
        <button
          className="btn-stop"
          onClick={handleStop}
          disabled={!isRunning}
        >
          ⏹ Stop
        </button>
        {user?.role === "admin" && (
          <>
            <button
              className={`btn-lock ${canvasLocked ? "locked" : "unlocked"}`}
              onClick={() => setCanvasLocked((prev) => !prev)}
            >
              {canvasLocked ? "🔒 Lock" : "🔓 Unlock"}
            </button>
            <button
              className="btn-export"
              onClick={() => {
                const flowData = {
                  nodes: nodesRef.current,
                  edges: edgesRef.current,
                };
                const dataStr = JSON.stringify(flowData, null, 2);
                const dataBlob = new Blob([dataStr], { type: "application/json" });
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `monitor-${Date.now()}.json`;
                link.click();
                URL.revokeObjectURL(url);
              }}
              disabled={isRunning}
            >
              📥 Export
            </button>
            <button
              className="btn-import"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "application/json";
                input.onchange = (e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      try {
                        const flowData = JSON.parse(event.target.result);
                        if (flowData.nodes) {
                          setNodes(flowData.nodes);
                        }
                      } catch (error) {
                        alert("Error importing file: " + error.message);
                      }
                    };
                    reader.readAsText(file);
                  }
                };
                input.click();
              }}
              disabled={isRunning}
            >
              📤 Import
            </button>
          </>
        )}
        <button
          className={`btn-fullscreen ${isFullscreen ? "active" : ""}`}
          onClick={toggleFullscreen}
        >
          {isFullscreen ? "⤢ Exit Full Screen" : "⤢ Full Screen"}
        </button>
      </div>

      <div className="monitor-layout">
        {user?.role === "admin" && (
          <MonitorNodePalette onAddNode={() => {}} isRunning={isRunning} />
        )}
        <div className="monitor-canvas-container" ref={reactFlowWrapper}>
          <div
            className={`monitor-canvas ${isRunning ? "running-dark" : ""}`}
            onMouseMove={(e) => {
              if (!isFullscreen) {
                setShowCanvasControls(true);
                return;
              }
              const threshold = window.innerHeight - 80;
              if (e.clientY >= threshold) {
                setShowCanvasControls(true);
              } else {
                setShowCanvasControls(false);
              }
            }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onInit={setReactFlowInstance}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeClick={onNodeClick}
              onNodeDoubleClick={onNodeDoubleClick}
              nodeTypes={nodeTypes}
              fitView
              attributionPosition="bottom-left"
              nodesDraggable={user?.role === "admin" && !canvasLocked}
              nodesConnectable={user?.role === "admin" && !canvasLocked}
              edgesUpdatable={false}
              edgesFocusable={false}
            >
              <div
                className={`monitor-flow-controls ${
                  isFullscreen && !showCanvasControls ? "hidden" : ""
                }`}
              >
                <Controls />
                <MiniMap />
              </div>
            </ReactFlow>
          </div>
        </div>
      </div>

      {configModalOpen && selectedNode && (
        <MonitorNodeConfigModal
          node={selectedNode}
          onSave={handleSaveNodeConfig}
          onClose={() => {
            setConfigModalOpen(false);
            setSelectedNode(null);
          }}
          parks={parks}
          agvs={agvs}
          isRunning={isRunning}
          onDelete={handleDeleteNode}
        />
      )}
    </div>
  );
}

export default Monitor;

