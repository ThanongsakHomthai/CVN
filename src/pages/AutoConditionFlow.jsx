import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import "../styles/Pages.css";
import "./AutoCondition.css";
import "./AutoConditionFlow.css";

import NodePalette from "../components/flow/NodePalette";
import NodeConfigModal from "../components/flow/NodeConfigModal";
import { TriggerNode, MoveNode, SetNode, IOTNode, CheckNode } from "../components/flow/CustomNodes";
import ConsoleMonitor from "../components/flow/ConsoleMonitor";

const API_BASE = "http://localhost:4000";

const nodeTypes = {
  trigger: TriggerNode,
  move: MoveNode,
  set: SetNode,
  iot: IOTNode,
  check: CheckNode,
};

const initialNodes = [];
const initialEdges = [];

function AutoConditionFlow() {
  const location = useLocation();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  // Logs state: object with nodeId as key, array of logs as value
  const [logsByNode, setLogsByNode] = useState({}); // { [nodeId]: [logs] }
  const [iotModules, setIotModules] = useState([]);
  const [parks, setParks] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [hideNodePalette, setHideNodePalette] = useState(false);
  const [hideCanvas, setHideCanvas] = useState(false);
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const nodeIdCounter = useRef(1);
  const triggerPreviousValues = useRef(new Map()); // Store previous values for trigger nodes
  const nodesRef = useRef(nodes); // Keep reference to current nodes
  const edgesRef = useRef(edges); // Keep reference to current edges
  const isRunningRef = useRef(isRunning); // Keep reference to isRunning for checking in async functions
  const isLoadingNodesRef = useRef(false); // Flag to prevent saving while loading
  const lastStatusRunningRef = useRef(isRunning); // Track last status from backend

  const openNodeConfig = useCallback((nodeId) => {
    if (isRunningRef.current) return;
    const foundNode = nodesRef.current.find((n) => n.id === nodeId);
    setSelectedNode(foundNode || null);
    setConfigModalOpen(true);
  }, []);
  
  // Multi-node protection: Lock mechanism for orderId check and POST orders
  const orderCheckLock = useRef(false); // Lock for checking orderId and sending POST orders
  const orderCheckQueue = useRef([]); // Queue for nodes waiting to check orderId and send POST
  
  // Multi-node protection: Lock mechanism for Park selection
  const parkSelectionLock = useRef(false); // Lock for selecting parks
  const selectedParks = useRef(new Set()); // Track selected parks to prevent duplicates
  
  // Multi-node protection: Track running nodes to prevent duplicate execution
  const runningNodes = useRef(new Set()); // Track which nodes are currently executing

  // Update refs when nodes/edges change
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

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

  const logsByNodeRef = useRef({});
  const addLogRef = useRef(null);
  
  // Update logsByNodeRef when logsByNode change
  useEffect(() => {
    logsByNodeRef.current = logsByNode;
  }, [logsByNode]);
  
  // addLog function: accepts nodeId and logEntry, stores logs separately for each node
  const addLog = useCallback((nodeId, logEntry) => {
    if (!nodeId) {
      console.error("[addLog] nodeId is required, logEntry:", logEntry);
      return;
    }
    console.log(`[addLog] Adding log for nodeId="${nodeId}":`, logEntry);
    setLogsByNode((prev) => {
      const nodeLogs = prev[nodeId] || [];
      const newLogs = [logEntry, ...nodeLogs].slice(0, 100); // Keep last 100 logs per node
      const newLogsByNode = {
        ...prev,
        [nodeId]: newLogs,
      };
      logsByNodeRef.current = newLogsByNode;
      console.log(`[addLog] Updated logsByNode for nodeId="${nodeId}", total logs: ${newLogs.length}`, newLogsByNode);
      return newLogsByNode;
    });
  }, []);
  
  // Keep addLog ref updated
  useEffect(() => {
    addLogRef.current = addLog;
  }, [addLog]);

  // Handle delete node - must be declared before onDrop
  const handleDeleteNode = useCallback(
    (nodeId) => {
      if (isRunningRef.current) {
        console.warn("[handleDeleteNode] Ignored delete while running");
        return;
      }
      console.log(`[handleDeleteNode] Deleting node: ${nodeId}`);
      
      if (!nodeId) {
        console.error("[handleDeleteNode] No nodeId provided!");
        return;
      }
      
      // Delete node
      setNodes((nds) => {
        const filtered = nds.filter((node) => node.id !== nodeId);
        console.log(`[handleDeleteNode] Nodes before: ${nds.length}, after: ${filtered.length}`);
        return filtered;
      });
      
      // Remove edges connected to deleted node
      setEdges((eds) => {
        const filtered = eds.filter((edge) => 
          edge.source !== nodeId && edge.target !== nodeId
        );
        console.log(`[handleDeleteNode] Edges before: ${eds.length}, after: ${filtered.length}`);
        return filtered;
      });
      
      // Clean up logs
      setLogsByNode((prev) => {
        const newLogs = { ...prev };
        delete newLogs[nodeId];
        return newLogs;
      });
      
      // Clean up trigger previous values
      triggerPreviousValues.current.delete(nodeId);
      
      // Clear selection if deleted node was selected
      setSelectedNode((prev) => {
        if (prev?.id === nodeId) {
          return null;
        }
        return prev;
      });
      
      console.log(`[handleDeleteNode] Node ${nodeId} deleted successfully`);
    },
    [setNodes, setEdges]
  );

  // Save nodes/edges to database
  const saveNodesToDatabase = useCallback(async (nodesToSave, edgesToSave) => {
    try {
      // Don't save if flow is running
      if (isRunningRef.current) {
        return;
      }
      
      const response = await fetch(`${API_BASE}/api/flow/nodes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nodes: nodesToSave,
          edges: edgesToSave,
          flow_id: "default",
        }),
      });
      
      const result = await response.json();
      if (result.success) {
        console.log(`Saved ${nodesToSave.length} nodes and ${edgesToSave.length} edges to database`);
      } else {
        console.error("Error saving nodes:", result.error);
      }
    } catch (error) {
      console.error("Error saving nodes to database:", error);
    }
  }, []);

  // Load saved nodes/edges from database on mount
  const loadSavedNodes = useCallback(async () => {
    try {
      isLoadingNodesRef.current = true; // Set flag to prevent saving during load
      
      const response = await fetch(`${API_BASE}/api/flow/nodes?flow_id=default`);
      const result = await response.json();
      
      if (result.success && result.data) {
        const savedNodes = result.data.nodes || [];
        const savedEdges = result.data.edges || [];
        
        if (savedNodes.length > 0 || savedEdges.length > 0) {
          // Find max node ID to continue numbering
          const maxId = savedNodes.reduce((max, node) => {
            const match = node.id.match(/node-(\d+)/);
            if (match) {
              const idNum = parseInt(match[1], 10);
              return Math.max(max, idNum);
            }
            return max;
          }, 0);
          nodeIdCounter.current = maxId + 1;
          
          // Restore nodes with handlers
          const restoredNodes = savedNodes.map((node) => {
          const restoredNode = {
              ...node,
              data: {
                ...node.data,
                config: node.data?.config || {},
                // id is already in node.id, don't need to pass to data
              onEdit: openNodeConfig,
                onDelete: (nodeId) => {
                  console.log(`[Delete Button] onDelete called for nodeId: ${nodeId}`);
                  handleDeleteNode(nodeId);
                },
              },
            };
            return restoredNode;
          });
          
          // Restore edges with markers
          const restoredEdges = savedEdges.map((edge) => ({
            ...edge,
            markerEnd: {
              type: MarkerType.ArrowClosed,
            },
            animated: true,
          }));
          
          setNodes(restoredNodes);
          setEdges(restoredEdges);
          
          console.log(`✅ Loaded ${restoredNodes.length} nodes and ${restoredEdges.length} edges from database`);
        } else {
          console.log("📭 No saved nodes found in database");
        }
      }
    } catch (error) {
      console.error("❌ Error loading saved nodes:", error);
    } finally {
      // Wait a bit before allowing saves to prevent race condition
      setTimeout(() => {
        isLoadingNodesRef.current = false;
      }, 500);
    }
  }, [handleDeleteNode, setNodes, setEdges]);

  // Ensure all nodes have onDelete and onEdit handlers after nodes change
  useEffect(() => {
    // This effect runs after nodes are loaded/updated to ensure all have handlers
    setNodes((nds) =>
      nds.map((node) => {
        // Only update if handlers are missing
        if (!node.data?.onDelete || !node.data?.onEdit) {
          return {
            ...node,
            data: {
              ...node.data,
              config: node.data?.config || {},
              onEdit: node.data?.onEdit || openNodeConfig,
              onDelete: node.data?.onDelete || handleDeleteNode,
            },
          };
        }
        return node;
      })
    );
  }, [handleDeleteNode, setNodes]);

  // Load saved nodes on mount
  useEffect(() => {
    loadSavedNodes();
  }, [loadSavedNodes]);

  // Save nodes/edges when they change (debounced)
  useEffect(() => {
    // Don't save if flow is running or if nodes/edges are empty (initial state)
    if (isRunning || (nodes.length === 0 && edges.length === 0)) {
      return;
    }
    
    // Debounce saving to avoid too many database calls
    const saveTimeout = setTimeout(() => {
      saveNodesToDatabase(nodes, edges);
    }, 1000); // Wait 1 second after last change
    
    return () => clearTimeout(saveTimeout);
  }, [nodes, edges, isRunning, saveNodesToDatabase]);

  // Save nodes/edges before route change (using location change)
  const prevLocationRef = useRef(location.pathname);
  useEffect(() => {
    // Save when leaving Auto Condition page
    if (prevLocationRef.current === "/auto" && location.pathname !== "/auto") {
      const currentNodes = nodesRef.current || [];
      const currentEdges = edgesRef.current || [];
      if (currentNodes.length > 0 || currentEdges.length > 0) {
        console.log(`💾 Saving ${currentNodes.length} nodes and ${currentEdges.length} edges before leaving Auto Condition page...`);
        isLoadingNodesRef.current = false; // Allow save
        // Force save immediately (don't await, but at least attempt)
        saveNodesToDatabase(currentNodes, currentEdges).catch(err => {
          console.error("Error saving on route change:", err);
        });
      }
    }
    prevLocationRef.current = location.pathname;
  }, [location.pathname, saveNodesToDatabase]);

  // Save nodes/edges when component unmounts
  useEffect(() => {
    return () => {
      // Save on unmount (cleanup function) - force save even if loading
      const currentNodes = nodesRef.current;
      const currentEdges = edgesRef.current;
      if ((currentNodes && currentNodes.length > 0) || (currentEdges && currentEdges.length > 0)) {
        console.log("💾 Saving nodes before unmount...");
        // Temporarily allow save during unmount
        const wasLoading = isLoadingNodesRef.current;
        isLoadingNodesRef.current = false;
        
        // Use synchronous-like approach with async/await in cleanup
        const savePromise = saveNodesToDatabase(currentNodes, currentEdges);
        // Note: We can't await in cleanup, but we can at least attempt to save
        savePromise.catch(err => console.error("Error saving on unmount:", err));
      }
    };
  }, [saveNodesToDatabase]);

  // Handle drag and drop from palette
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event) => {
      // Block adding nodes while running
      if (isRunningRef.current) return;

      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");

      if (typeof type === "undefined" || !type) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: `node-${nodeIdCounter.current++}`,
        type,
        position,
        data: {
          config: {},
          onEdit: openNodeConfig,
          onDelete: (nodeId) => {
            handleDeleteNode(nodeId);
          },
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes, handleDeleteNode]
  );

  const onConnect = useCallback(
    (params) => {
      // Block connecting while running
      if (isRunningRef.current) return;

      setEdges((eds) =>
        addEdge(
          {
            ...params,
            markerEnd: {
              type: MarkerType.ArrowClosed,
            },
            animated: true,
          },
          eds
        )
      );
    },
    [setEdges]
  );

  // Handle edge double click - delete edge
  const onEdgeDoubleClick = useCallback((event, edge) => {
    // Block deleting edges while running
    if (isRunningRef.current) return;
    
    // Confirm deletion
    if (window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบเส้นเชื่อมนี้?")) {
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
      console.log(`✅ Deleted edge: ${edge.id}`);
    }
  }, [setEdges]);

  const onNodeClick = useCallback((event, node) => {
    // เพียงแค่เลือก node ไม่เปิด config modal (ใช้ double click แทน)
    setSelectedNode(node);
  }, []);

  const onNodeDoubleClick = useCallback((event, node) => {
    if (isRunningRef.current) return;
    setSelectedNode(node);
    setConfigModalOpen(true);
  }, []);

  // Handle node deletion - triggered when node is deleted via React Flow's built-in delete (Backspace/Delete key)
  const onNodesDelete = useCallback((deleted) => {
    deleted.forEach((node) => {
      handleDeleteNode(node.id);
    });
  }, [handleDeleteNode]);

  // Handle keyboard delete key
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Only delete when a node is selected and Delete or Backspace is pressed
      if ((event.key === "Delete" || event.key === "Backspace") && selectedNode && !configModalOpen && !isRunningRef.current) {
        // Don't delete if user is typing in an input field
        if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA") {
          return;
        }
        
        event.preventDefault();
        
        // Use handleDeleteNode function to delete the selected node
        handleDeleteNode(selectedNode.id);
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNode, configModalOpen, handleDeleteNode]);

  const handleSaveNodeConfig = useCallback(
    (nodeId, config) => {
      if (isRunningRef.current) {
        console.warn("[handleSaveNodeConfig] Ignored save while running");
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
                // Ensure onEdit and onDelete handlers are preserved
                onEdit: node.data?.onEdit || openNodeConfig,
                onDelete: node.data?.onDelete || handleDeleteNode,
              },
            };
          }
          return node;
        })
      );
    },
    [setNodes, handleDeleteNode, openNodeConfig]
  );

  // Helper function to get first park from group with specified use_state
  const getFirstParkFromGroup = useCallback((groupName, useState) => {
    const groupParks = parks
      .filter((p) => p.groups === groupName && (p.use_state === useState || p.use_state === String(useState)))
      .sort((a, b) => {
        const nameA = (a.external_name || a.external_id || "").toString();
        const nameB = (b.external_name || b.external_id || "").toString();
        return nameA.localeCompare(nameB);
      });
    
    if (groupParks.length === 0) return null;
    return groupParks[0].external_name || groupParks[0].external_id || null;
  }, [parks]);

  // Helper function to fetch latest parks and get first park from group
  const getFirstParkFromGroupLatest = useCallback(async (groupName, useState) => {
    try {
      // Fetch latest parks data from API
      const response = await fetch(`${API_BASE}/api/parks`);
      const result = await response.json();
      
      if (!result.success) {
        console.error("Failed to fetch parks:", result);
        return null;
      }
      
      const latestParks = result.data || [];
      
      // Filter and sort parks for the group with specified use_state
      const groupParks = latestParks
        .filter((p) => p.groups === groupName && (p.use_state === useState || p.use_state === String(useState)))
        .sort((a, b) => {
          const nameA = (a.external_name || a.external_id || "").toString();
          const nameB = (b.external_name || b.external_id || "").toString();
          return nameA.localeCompare(nameB);
        });
      
      if (groupParks.length === 0) return null;
      return groupParks[0].external_name || groupParks[0].external_id || null;
    } catch (error) {
      console.error("Error fetching parks:", error);
      return null;
    }
  }, []);

  // Execute move node with retry logic
  const executeMoveNode = useCallback(
    async (moveNode) => {
      // Check if still running before executing
      if (!isRunningRef.current) {
        console.log("[Move Node] Stopped - flow is not running");
        return false;
      }

      const { group1, group2 } = moveNode.data?.config || {};
      const nodeId = moveNode.id;
      const logFn = addLogRef.current || addLog;
      
      if (!group1 || !group2) {
        logFn(nodeId, {
          type: "error",
          message: `❌ Group 1 หรือ Group 2 ยังไม่ได้ตั้งค่า`,
          timestamp: new Date(),
        });
        return false;
      }

      // Log: กำลังดึงข้อมูล Park ล่าสุด
      logFn(nodeId, {
        type: "info",
        message: `🔄 กำลังตรวจเช็คข้อมูล Park ล่าสุดจาก Group 1 และ Group 2...`,
        timestamp: new Date(),
      });

      // Multi-node protection: Lock park selection to prevent duplicate selection
      const acquireParkLock = async () => {
        return new Promise((resolve) => {
          const tryAcquire = () => {
            if (!parkSelectionLock.current) {
              parkSelectionLock.current = true;
              resolve();
            } else {
              setTimeout(tryAcquire, 100);
            }
          };
          tryAcquire();
        });
      };

      const releaseParkLock = () => {
        parkSelectionLock.current = false;
      };

      // Acquire park selection lock
      await acquireParkLock();

      let source = null;
      let destination = null;

      try {
        // Fetch latest parks and get all available parks from each group
        // Group 1 uses use_state = 3, Group 2 uses use_state = 1
        const response = await fetch(`${API_BASE}/api/parks`);
        const result = await response.json();
        
        if (!result.success) {
          logFn(nodeId, {
            type: "error",
            message: `❌ ไม่สามารถดึงข้อมูล Park ได้: ${result.error || "Unknown error"}`,
            timestamp: new Date(),
          });
          return false;
        }

        const latestParks = result.data || [];

        // Filter and sort parks for Group 1 with use_state = 3
        const group1Parks = latestParks
          .filter((p) => p.groups === group1 && (p.use_state === 3 || p.use_state === "3"))
          .sort((a, b) => {
            const nameA = (a.external_name || a.external_id || "").toString();
            const nameB = (b.external_name || b.external_id || "").toString();
            return nameA.localeCompare(nameB);
          })
          .map(p => p.external_name || p.external_id || null)
          .filter(Boolean)
          .filter(park => !selectedParks.current.has(park)); // Filter out already reserved parks

        // Filter and sort parks for Group 2 with use_state = 1
        const group2Parks = latestParks
          .filter((p) => p.groups === group2 && (p.use_state === 1 || p.use_state === "1"))
          .sort((a, b) => {
            const nameA = (a.external_name || a.external_id || "").toString();
            const nameB = (b.external_name || b.external_id || "").toString();
            return nameA.localeCompare(nameB);
          })
          .map(p => p.external_name || p.external_id || null)
          .filter(Boolean)
          .filter(park => !selectedParks.current.has(park)); // Filter out already reserved parks

        source = group1Parks.length > 0 ? group1Parks[0] : null;
        destination = group2Parks.length > 0 ? group2Parks[0] : null;

        // Reserve selected parks
        if (source) {
          selectedParks.current.add(source);
          logFn(nodeId, {
            type: "info",
            message: `🔒 [Multi-Node Protection] Reserve Park: "${source}"`,
            timestamp: new Date(),
          });
        }
        if (destination) {
          selectedParks.current.add(destination);
          logFn(nodeId, {
            type: "info",
            message: `🔒 [Multi-Node Protection] Reserve Park: "${destination}"`,
            timestamp: new Date(),
          });
        }
      } finally {
        releaseParkLock();
      }

      // Log: แสดงผล Park ที่ดึงมาใหม่
      if (source) {
        logFn(nodeId, {
          type: "info",
          message: `📍 Group 1 (${group1}): พบ Park = "${source}" (use_state = 3)`,
          timestamp: new Date(),
        });
      }
      if (destination) {
        logFn(nodeId, {
          type: "info",
          message: `📍 Group 2 (${group2}): พบ Park = "${destination}" (use_state = 1)`,
          timestamp: new Date(),
        });
      }

      if (!source || !destination) {
        logFn(nodeId, {
          type: "info",
          message: `⚠️ The park not ready !!`,
          timestamp: new Date(),
          data: {
            group1: group1,
            group2: group2,
            sourceMissing: !source,
            destinationMissing: !destination,
            sourceUseState: 3,
            destinationUseState: 1,
          },
        });
        return false;
      }

      // Log: Move node เริ่มทำงาน
      logFn(nodeId, {
        type: "info",
        message: `▶ [Move Node] เริ่มทำงาน: Source="${source}", Destination="${destination}"`,
        timestamp: new Date(),
      });

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

      // Multi-node protection: Wait in queue if another node is checking orderId/sending POST
      const acquireOrderLock = async () => {
        return new Promise((resolve) => {
          const tryAcquire = () => {
            if (!orderCheckLock.current) {
              orderCheckLock.current = true;
              resolve();
            } else {
              // Wait and try again
              setTimeout(tryAcquire, 100);
            }
          };
          tryAcquire();
        });
      };

      const releaseOrderLock = () => {
        orderCheckLock.current = false;
        // Process next in queue
        if (orderCheckQueue.current.length > 0) {
          const next = orderCheckQueue.current.shift();
          setTimeout(next, 0);
        }
      };

      // Acquire lock before checking orderId and sending POST
      logFn(nodeId, {
        type: "info",
        message: `🔒 [Multi-Node Protection] รอ Lock สำหรับตรวจสอบ orderId และส่ง POST...`,
        timestamp: new Date(),
      });

      await acquireOrderLock();

      try {
        // Check orderId before sending POST API
        logFn(nodeId, {
          type: "info",
          message: `🔍 กำลังตรวจสอบ orderId จาก AGV...`,
          timestamp: new Date(),
        });

        // Retry logic for checking orderId - check until all orderId are null
        let checkAttempt = 1;
        const checkRetryDelay = 1000; // 1 second between checks
        let allOrderIdNull = false;

        while (!allOrderIdNull) {
          // Check if still running before retry - this is the only way to exit the loop
          if (!isRunningRef.current) {
            logFn(nodeId, {
              type: "info",
              message: `⏹ หยุดการทำงาน: Flow ถูกหยุดระหว่างตรวจสอบ orderId`,
              timestamp: new Date(),
            });
            return false;
          }

          try {
            const checkResponse = await fetch(`${API_BASE}/api/agvs/check-orderid`);
            if (!checkResponse.ok) {
              throw new Error(`HTTP ${checkResponse.status}: ${checkResponse.statusText}`);
            }

            const checkResult = await checkResponse.json();
            
            if (checkResult.success && checkResult.allOrderIdNull) {
              allOrderIdNull = true;
              logFn(nodeId, {
                type: "success",
                message: `✅ ตรวจสอบ orderId สำเร็จ: orderId ทั้งหมดเป็น null (ครั้งที่ ${checkAttempt})`,
                timestamp: new Date(),
              });
              break;
            } else {
              // Log which AGVs still have orderId
              const agvsWithOrderId = checkResult.agvStatuses?.filter(agv => !agv.isNull) || [];
              
              // Only log every 5 attempts to avoid too many logs
              if (checkAttempt === 1 || checkAttempt % 5 === 0) {
                logFn(nodeId, {
                  type: "info",
                  message: `⏳ รอ orderId เป็น null... (ครั้งที่ ${checkAttempt}) - มี AGV ที่มี orderId: ${agvsWithOrderId.length} รายการ`,
                  timestamp: new Date(),
                });
              }

              // Wait before next check
              await new Promise(resolve => setTimeout(resolve, checkRetryDelay));
              checkAttempt++;
            }
          } catch (checkError) {
            console.error(`Error checking orderId (attempt ${checkAttempt}):`, checkError);
            
            // Only log error every 5 attempts to avoid too many logs
            if (checkAttempt === 1 || checkAttempt % 5 === 0) {
              logFn(nodeId, {
                type: "error",
                message: `❌ เกิดข้อผิดพลาดขณะตรวจสอบ orderId (ครั้งที่ ${checkAttempt}): ${checkError.message}`,
                timestamp: new Date(),
              });
            }
            
            // Wait before retry on error
            await new Promise(resolve => setTimeout(resolve, checkRetryDelay));
            checkAttempt++;
          }
        }
      } finally {
        // Release lock after checking orderId (before sending POST, lock will be held during POST too)
      }

      // Retry logic - try until success
      let attempt = 1;
      const maxAttempts = 100; // Prevent infinite loop, but allow many retries
      const retryDelay = 2000; // 2 seconds between retries
      
      // Log: เริ่มส่ง API
      logFn(nodeId, {
        type: "info",
        message: `📤 เริ่มส่ง Order API: Source="${source}", Destination="${destination}"`,
        timestamp: new Date(),
        data: {
          ...orderData,
          jsonString: JSON.stringify(orderData, null, 2),
        },
      });
      
      while (attempt <= maxAttempts) {
        // Check if still running before retry
        if (!isRunningRef.current) {
          logFn(nodeId, {
            type: "info",
            message: `⏹ หยุดการทำงาน: Flow ถูกหยุดระหว่าง retry`,
            timestamp: new Date(),
          });
          return false;
        }

        try {
          const response = await fetch(`${API_BASE}/orders`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(orderData),
          });

          if (response.ok) {
            const responseData = await response.json().catch(() => ({}));
            logFn(nodeId, {
              type: "success",
              message: `✅ ส่งสำเร็จ (ครั้งที่ ${attempt}): Source="${source}", Destination="${destination}"`,
              timestamp: new Date(),
              data: {
                attempt,
                source,
                destination,
                response: responseData,
              },
            });
            
            // Update use_state after successful API call
            // Source (Group 1): update use_state from 3 to 1
            // Destination (Group 2): update use_state from 1 to 3
            try {
              logFn(nodeId, {
                type: "info",
                message: `🔄 กำลังอัพเดท use_state ของ Park...`,
                timestamp: new Date(),
              });
              
              // Update source: use_state from 3 to 1
              const sourceUpdateResponse = await fetch(`${API_BASE}/api/parks/${encodeURIComponent(source)}/use-state`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ use_state: 1 }),
              });
              
              if (sourceUpdateResponse.ok) {
                logFn(nodeId, {
                  type: "success",
                  message: `✅ อัพเดท Source (${source}) สำเร็จ: use_state = 3 → 1`,
                  timestamp: new Date(),
                });
              } else {
                const errorText = await sourceUpdateResponse.text().catch(() => sourceUpdateResponse.statusText);
                logFn(nodeId, {
                  type: "warning",
                  message: `⚠️ อัพเดท Source (${source}) ล้มเหลว: ${errorText}`,
                  timestamp: new Date(),
                });
              }
              
              // Update destination: use_state from 1 to 3
              const destUpdateResponse = await fetch(`${API_BASE}/api/parks/${encodeURIComponent(destination)}/use-state`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ use_state: 3 }),
              });
              
              if (destUpdateResponse.ok) {
                logFn(nodeId, {
                  type: "success",
                  message: `✅ อัพเดท Destination (${destination}) สำเร็จ: use_state = 1 → 3`,
                  timestamp: new Date(),
                });
              } else {
                const errorText = await destUpdateResponse.text().catch(() => destUpdateResponse.statusText);
                logFn(nodeId, {
                  type: "warning",
                  message: `⚠️ อัพเดท Destination (${destination}) ล้มเหลว: ${errorText}`,
                  timestamp: new Date(),
                });
              }
            } catch (updateError) {
              logFn(nodeId, {
                type: "warning",
                message: `⚠️ เกิดข้อผิดพลาดในการอัพเดท use_state: ${updateError.message}`,
                timestamp: new Date(),
              });
            }
            
            // Release selected parks after successful POST (parks are now being used)
            if (source) {
              selectedParks.current.delete(source);
              logFn(nodeId, {
                type: "info",
                message: `🔓 [Multi-Node Protection] Release Park: "${source}" (after successful POST)`,
                timestamp: new Date(),
              });
            }
            if (destination) {
              selectedParks.current.delete(destination);
              logFn(nodeId, {
                type: "info",
                message: `🔓 [Multi-Node Protection] Release Park: "${destination}" (after successful POST)`,
                timestamp: new Date(),
              });
            }
            
            // Release lock after successful POST
            releaseOrderLock();
            return true;
          } else {
            const errorText = await response.text().catch(() => response.statusText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }
        } catch (error) {
          if (attempt === 1 || attempt % 5 === 0 || attempt === maxAttempts) {
            // Log only first attempt, every 5th attempt, and last attempt
            logFn(nodeId, {
              type: "error",
              message: `❌ ครั้งที่ ${attempt} ล้มเหลว: ${error.message}`,
              timestamp: new Date(),
              data: {
                attempt,
                source,
                destination,
                error: error.message,
              },
            });
          }

          // On final failure, release parks and lock
          if (attempt >= maxAttempts) {
            // Release selected parks on failure
            if (source) {
              selectedParks.current.delete(source);
              logFn(nodeId, {
                type: "info",
                message: `🔓 [Multi-Node Protection] Release Park: "${source}" (on failure)`,
                timestamp: new Date(),
              });
            }
            if (destination) {
              selectedParks.current.delete(destination);
              logFn(nodeId, {
                type: "info",
                message: `🔓 [Multi-Node Protection] Release Park: "${destination}" (on failure)`,
                timestamp: new Date(),
              });
            }
            // Release lock on final failure
            releaseOrderLock();
          }

          // Wait before retry (except on last attempt)
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
          }
          
          attempt++;
        }
      }

      // If we get here, all attempts failed
      // Release parks and lock on final failure (in case not already released)
      if (source) {
        selectedParks.current.delete(source);
      }
      if (destination) {
        selectedParks.current.delete(destination);
      }
      releaseOrderLock();
      
      logFn(nodeId, {
        type: "error",
        message: `❌ ส่งล้มเหลวทั้งหมด ${maxAttempts} ครั้ง: Source="${source}", Destination="${destination}"`,
        timestamp: new Date(),
        data: {
          source,
          destination,
          totalAttempts: maxAttempts,
        },
      });
      return false;
    },
    [addLog]
  );

  // Execute set node - update park use_state
  const executeSetNode = useCallback(
    async (setNode) => {
      // Check if still running before executing
      if (!isRunningRef.current) {
        console.log("[Set Node] Stopped - flow is not running");
        return false;
      }

      const { parkName, useState } = setNode.data?.config || {};
      const nodeId = setNode.id;
      const logFn = addLogRef.current || addLog;
      
      if (!parkName || useState === undefined || useState === null) {
        logFn(nodeId, {
          type: "error",
          message: `❌ Park Name หรือ Use State ยังไม่ได้ตั้งค่า`,
          timestamp: new Date(),
        });
        return false;
      }

      // Log: Set node เริ่มทำงาน
      logFn(nodeId, {
        type: "info",
        message: `⚙️ [Set Node] กำลังอัพเดท Park: "${parkName}" เป็น use_state = ${useState}`,
        timestamp: new Date(),
      });

      try {
        const response = await fetch(`${API_BASE}/api/parks/${encodeURIComponent(parkName)}/use-state`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ use_state: useState }),
        });

        if (response.ok) {
          const responseData = await response.json().catch(() => ({}));
          logFn(nodeId, {
            type: "success",
            message: `✅ อัพเดทสำเร็จ: Park "${parkName}" use_state = ${useState}`,
            timestamp: new Date(),
            data: {
              parkName,
              useState,
              response: responseData,
            },
          });
          return true;
        } else {
          const errorText = await response.text().catch(() => response.statusText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
      } catch (error) {
        logFn(nodeId, {
          type: "error",
          message: `❌ อัพเดทล้มเหลว: ${error.message}`,
          timestamp: new Date(),
          data: {
            parkName,
            useState,
            error: error.message,
          },
        });
        return false;
      }
    },
    [addLog]
  );

  // Execute check node - check if park exists with specified use_state
  const executeCheckNode = useCallback(
    async (checkNode) => {
      // Check if still running before executing
      if (!isRunningRef.current) {
        console.log("[Check Node] Stopped - flow is not running");
        return false;
      }

      const { group, useState } = checkNode.data?.config || {};
      const nodeId = checkNode.id;
      const logFn = addLogRef.current || addLog;
      
      if (!group || useState === undefined) {
        logFn(nodeId, {
          type: "error",
          message: `❌ Group หรือ use_state ยังไม่ได้ตั้งค่า`,
          timestamp: new Date(),
        });
        return false;
      }

      // Log: กำลังตรวจสอบ
      logFn(nodeId, {
        type: "info",
        message: `🔍 กำลังตรวจสอบ Group "${group}" ที่มี use_state = ${useState}...`,
        timestamp: new Date(),
      });

      try {
        // Fetch parks from API
        const response = await fetch(`${API_BASE}/api/parks`);
        const result = await response.json();
        
        if (!result.success) {
          throw new Error("ไม่สามารถดึงข้อมูล Parks ได้");
        }
        
        const allParks = result.data || [];
        
        // Filter parks by group and use_state
        const matchingParks = allParks.filter(
          (p) => p.groups === group && (p.use_state === useState || p.use_state === String(useState))
        );
        
        if (matchingParks.length > 0) {
          logFn(nodeId, {
            type: "success",
            message: `✅ พบข้อมูล: มี ${matchingParks.length} Park(s) ใน Group "${group}" ที่มี use_state = ${useState}`,
            timestamp: new Date(),
            data: {
              group,
              useState,
              parkCount: matchingParks.length,
              parks: matchingParks.map((p) => p.external_name || p.external_id),
            },
          });
          return true; // Pass condition
        } else {
          logFn(nodeId, {
            type: "warning",
            message: `⚠️ ไม่พบข้อมูล: ไม่มี Park ใน Group "${group}" ที่มี use_state = ${useState}`,
            timestamp: new Date(),
            data: {
              group,
              useState,
            },
          });
          return false; // Fail condition - stop chain execution
        }
      } catch (error) {
        logFn(nodeId, {
          type: "error",
          message: `❌ เกิดข้อผิดพลาด: ${error.message}`,
          timestamp: new Date(),
          data: {
            group,
            useState,
            error: error.message,
          },
        });
        return false;
      }
    },
    [addLog]
  );

  // Execute connected nodes in sequence (chain execution)
  const executeNodeChain = useCallback(async (startNodeId) => {
    const visited = new Set();
    
    const executeNext = async (nodeId) => {
      // Check if still running before executing
      if (!isRunningRef.current) {
        console.log("[Execute Chain] Stopped - flow is not running");
        return;
      }

      if (visited.has(nodeId)) {
        return; // Prevent infinite loops
      }
      visited.add(nodeId);

      // Get current state from refs
      const currentNode = nodesRef.current.find((n) => n.id === nodeId);
      if (!currentNode) {
        return;
      }

      // Execute based on node type
      const logFn = addLogRef.current || addLog;
      
      // Check if node has input connections (except for trigger nodes which start the chain)
      const allEdges = edgesRef.current;
      const hasInputEdge = allEdges.some((e) => e.target === nodeId);
      
      // For move and set nodes, they must have input connection from previous node
      if (currentNode.type === "move" || currentNode.type === "set") {
        if (!hasInputEdge && currentNode.type !== "trigger") {
          // This node should not execute if no input connection
          // Only execute if it's part of a chain (has input)
          console.log(`[Execute Chain] Skipping ${currentNode.type} node ${nodeId}: No input connection`);
          return;
        }
      }
      
      if (currentNode.type === "move") {
        // Multi-node protection: Check if node is already running
        if (runningNodes.current.has(nodeId)) {
          console.log(`[Execute Chain] Node ${nodeId} is already running, skipping...`);
          return;
        }

        // Mark node as running
        runningNodes.current.add(nodeId);
        
        // Mark as running in UI
        setNodes((nds) =>
          nds.map((node) => {
            if (node.id === nodeId) {
              return {
                ...node,
                data: { ...node.data, isRunning: true },
              };
            }
            return node;
          })
        );

        try {
          await executeMoveNode(currentNode);
        } finally {
          // Remove from running nodes
          runningNodes.current.delete(nodeId);
        }

        // Mark as not running
        setTimeout(() => {
          setNodes((nds) =>
            nds.map((node) => {
              if (node.id === nodeId) {
                return {
                  ...node,
                  data: { ...node.data, isRunning: false },
                };
              }
              return node;
            })
          );
        }, 500);
      } else if (currentNode.type === "set") {
        // Multi-node protection: Check if node is already running
        if (runningNodes.current.has(nodeId)) {
          console.log(`[Execute Chain] Node ${nodeId} is already running, skipping...`);
          return;
        }

        // Mark node as running
        runningNodes.current.add(nodeId);
        
        // Mark as running in UI
        setNodes((nds) =>
          nds.map((node) => {
            if (node.id === nodeId) {
              return {
                ...node,
                data: { ...node.data, isRunning: true },
              };
            }
            return node;
          })
        );

        try {
          await executeSetNode(currentNode);
        } finally {
          // Remove from running nodes
          runningNodes.current.delete(nodeId);
        }

        // Mark as not running
        setTimeout(() => {
          setNodes((nds) =>
            nds.map((node) => {
              if (node.id === nodeId) {
                return {
                  ...node,
                  data: { ...node.data, isRunning: false },
                };
              }
              return node;
            })
          );
        }, 500);
      } else if (currentNode.type === "check") {
        // Multi-node protection: Check if node is already running
        if (runningNodes.current.has(nodeId)) {
          console.log(`[Execute Chain] Node ${nodeId} is already running, skipping...`);
          return;
        }

        // Mark node as running
        runningNodes.current.add(nodeId);
        
        // Mark as running in UI
        setNodes((nds) =>
          nds.map((node) => {
            if (node.id === nodeId) {
              return {
                ...node,
                data: { ...node.data, isRunning: true },
              };
            }
            return node;
          })
        );

        try {
          const checkPassed = await executeCheckNode(currentNode);
          
          // If check failed, stop chain execution
          if (!checkPassed) {
            console.log(`[Check Node] Condition not met, stopping chain execution`);
            return;
          }
        } finally {
          // Remove from running nodes
          runningNodes.current.delete(nodeId);
        }

        // Mark as not running
        setTimeout(() => {
          setNodes((nds) =>
            nds.map((node) => {
              if (node.id === nodeId) {
                return {
                  ...node,
                  data: { ...node.data, isRunning: false },
                };
              }
              return node;
            })
          );
        }, 500);
      }

      // Find and execute next connected nodes sequentially
      const currentEdges = edgesRef.current;
      const connectedEdges = currentEdges.filter((e) => e.source === nodeId);
      
      // Execute sequentially (not parallel)
      for (const edge of connectedEdges) {
        await executeNext(edge.target);
      }
    };

    await executeNext(startNodeId);
  }, [executeMoveNode, executeSetNode, executeCheckNode, addLog, setNodes]);

  // Validate flow before running
  const validateFlow = useCallback(() => {
    const errors = [];
    
    // Check if there are any nodes
    if (nodes.length === 0) {
      errors.push("ไม่มี Node ใน Flow กรุณาเพิ่ม Node ก่อน");
      return { valid: false, errors };
    }

    // Check trigger nodes
    const triggerNodes = nodes.filter((n) => n.type === "trigger");
    if (triggerNodes.length === 0) {
      errors.push("ไม่พบ Trigger Node กรุณาเพิ่ม Trigger Node");
    }

    for (const triggerNode of triggerNodes) {
      if (!triggerNode.data?.config?.iotId) {
        errors.push(`Trigger Node "${triggerNode.id}" ยังไม่ได้ตั้งค่า IOT Module`);
      }
      if (!triggerNode.data?.config?.address) {
        errors.push(`Trigger Node "${triggerNode.id}" ยังไม่ได้ตั้งค่า Address`);
      }
    }

    // Check move nodes - only validate configuration, not park availability
    // Park availability will be checked when the node actually executes
    const moveNodes = nodes.filter((n) => n.type === "move");
    for (const moveNode of moveNodes) {
      if (!moveNode.data?.config?.group1 || !moveNode.data?.config?.group2) {
        errors.push(`Move Node "${moveNode.id}" ยังไม่ได้ตั้งค่า Group 1 หรือ Group 2`);
      }
      // Note: We don't check park availability here because:
      // - Parks may not be available when Run is clicked
      // - Parks will be checked when the node actually executes (when flow reaches this node)
      // - This allows the flow to start even if parks are not ready yet
    }

    // Check set nodes
    const setNodes = nodes.filter((n) => n.type === "set");
    for (const setNode of setNodes) {
      if (!setNode.data?.config?.parkName) {
        errors.push(`Set Node "${setNode.id}" ยังไม่ได้ตั้งค่า Park Name`);
      }
      if (setNode.data?.config?.useState === undefined || setNode.data?.config?.useState === null) {
        errors.push(`Set Node "${setNode.id}" ยังไม่ได้ตั้งค่า Use State`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }, [nodes, getFirstParkFromGroup]);

  // --- Flow runner helpers (Phase 1 refactor) ---
  const markNodesRunningOnStart = useCallback(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          // Trigger nodes show running indicator; others false (unchanged behavior)
          isRunning: node.type === "trigger",
        },
      }))
    );
  }, [setNodes]);

  const markNodesRunningOnStop = useCallback(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isRunning: false,
          // Reset currentValue for trigger nodes (match previous behavior)
          ...(node.type === "trigger" ? { currentValue: undefined } : {}),
        },
      }))
    );
  }, [setNodes]);

  const startFlowRun = useCallback(() => {
    const validation = validateFlow();
    if (!validation.valid) {
      alert(`ไม่สามารถเริ่มทำงานได้:\n${validation.errors.join("\n")}`);
      return;
    }
    setIsRunning(true);
    markNodesRunningOnStart();
  }, [validateFlow, markNodesRunningOnStart]);

  const stopFlowRun = useCallback(() => {
    console.log("[Stop] Stopping flow and resetting all values...");

    // Stop polling/execution
    setIsRunning(false);

    // Clear runtime states/locks
    triggerPreviousValues.current.clear();
    setLogsByNode({});
    logsByNodeRef.current = {};
    orderCheckLock.current = false;
    orderCheckQueue.current = [];
    parkSelectionLock.current = false;
    selectedParks.current.clear();
    runningNodes.current.clear();

    // Reset nodes' running flags and trigger currentValue
    markNodesRunningOnStop();

    console.log("[Stop] Flow stopped and all values reset");
  }, [markNodesRunningOnStop, setLogsByNode]);

  // Handle Run button
  const handleRun = useCallback(() => {
    startFlowRun();
  }, [startFlowRun]);

  // Handle Stop button - Stop all nodes and reset everything
  const handleStop = useCallback(() => {
    stopFlowRun();
  }, [stopFlowRun]);

  // --- Flow runner API bridge (Phase 3 begin) ---
  const callFlowStart = useCallback(async () => {
    const response = await fetch(`${API_BASE}/api/flow/start`, {
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

  const callFlowStop = useCallback(async () => {
    const response = await fetch(`${API_BASE}/api/flow/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    return result;
  }, []);

  const callFlowStatus = useCallback(async () => {
    const response = await fetch(`${API_BASE}/api/flow/status`);
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    return result.data || {};
  }, []);

  const syncRunningFromStatus = useCallback(
    (running) => {
      // Only react on changes to avoid flicker
      if (running === isRunningRef.current) return;

      if (running) {
        setIsRunning(true);
        markNodesRunningOnStart();
      } else {
        setIsRunning(false);
        markNodesRunningOnStop();
      }
    },
    [markNodesRunningOnStart, markNodesRunningOnStop]
  );

  // Hook Run/Stop buttons to backend start/stop while keeping current behavior
  const handleRunWithBackend = useCallback(async () => {
    try {
      const validation = validateFlow();
      if (!validation.valid) {
        alert(`ไม่สามารถเริ่มทำงานได้:\n${validation.errors.join("\n")}`);
        return;
      }
      await callFlowStart();
      startFlowRun(); // keep existing local behavior
    } catch (err) {
      console.error("[FlowRunner] start error:", err);
      alert(`ไม่สามารถเริ่มการทำงานได้: ${err.message}`);
    }
  }, [validateFlow, callFlowStart, startFlowRun]);

  const handleStopWithBackend = useCallback(async () => {
    try {
      await callFlowStop();
    } catch (err) {
      console.error("[FlowRunner] stop error:", err);
      // Even if backend stop fails, continue stopping locally to avoid stuck UI
    } finally {
      stopFlowRun();
    }
  }, [callFlowStop, stopFlowRun]);

  // Poll backend status to keep UI in sync (e.g., after navigation)
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await callFlowStatus();
        lastStatusRunningRef.current = data.isRunning ?? false;
        syncRunningFromStatus(lastStatusRunningRef.current);
      } catch (err) {
        // Don't spam console, log once
        console.warn("[FlowRunner] status check failed:", err.message);
      }
    };

    // Initial check
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, [callFlowStatus, syncRunningFromStatus]);

  // Export flow to JSON
  const handleExportFlow = useCallback(() => {
    const flowData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: {
          config: node.data?.config || {},
        },
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
      })),
    };
    
    const jsonString = JSON.stringify(flowData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `flow-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log("Flow exported:", flowData);
  }, [nodes, edges]);

  // Import flow from JSON
  const handleImportFlow = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const flowData = JSON.parse(e.target?.result || "{}");
          
          // Validate flow data structure
          if (!flowData.nodes || !Array.isArray(flowData.nodes)) {
            throw new Error("Invalid flow data: missing or invalid nodes array");
          }
          if (!flowData.edges || !Array.isArray(flowData.edges)) {
            throw new Error("Invalid flow data: missing or invalid edges array");
          }
          
          // Reset current flow state
          setIsRunning(false);
          setLogsByNode({});
          triggerPreviousValues.current.clear();
          
          // Find max node ID to continue numbering
          const maxId = flowData.nodes.reduce((max, node) => {
            const match = node.id.match(/node-(\d+)/);
            if (match) {
              const idNum = parseInt(match[1], 10);
              return Math.max(max, idNum);
            }
            return max;
          }, 0);
          nodeIdCounter.current = maxId + 1;
          
          // Restore nodes with onEdit and onDelete handlers
          const restoredNodes = flowData.nodes.map((node) => ({
            ...node,
            data: {
              ...node.data,
              config: node.data?.config || {},
              onEdit: (nodeId) => {
                const foundNode = nodesRef.current.find((n) => n.id === nodeId);
                setSelectedNode(foundNode || null);
                setConfigModalOpen(true);
              },
              onDelete: (nodeId) => {
                handleDeleteNode(nodeId);
              },
            },
          }));
          
          // Restore edges
          const restoredEdges = flowData.edges.map((edge) => ({
            ...edge,
            markerEnd: {
              type: MarkerType.ArrowClosed,
            },
            animated: true,
          }));
          
          setNodes(restoredNodes);
          setEdges(restoredEdges);
          
          console.log("Flow imported:", flowData);
          alert(`นำเข้า Flow สำเร็จ!\n- Nodes: ${restoredNodes.length}\n- Edges: ${restoredEdges.length}`);
        } catch (error) {
          console.error("Error importing flow:", error);
          alert(`เกิดข้อผิดพลาดในการนำเข้า Flow: ${error.message}`);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [setNodes, setEdges, handleDeleteNode]);

  // Poll trigger nodes and execute connected nodes (only when running)
  useEffect(() => {
    if (!isRunning) {
      triggerPreviousValues.current.clear();
      return;
    }
    
    // Don't log when polling starts - only log when triggers activate

    const pollInterval = setInterval(async () => {
      const currentNodes = nodesRef.current;
      const triggerNodes = currentNodes.filter((n) => n.type === "trigger" && n.data?.config?.iotId && n.data?.config?.address);
      
      if (triggerNodes.length === 0) {
        return;
      }

      // Log polling cycle
      console.log(`[Polling] Checking ${triggerNodes.length} trigger node(s)...`);
      
      // Use addLog from ref (always fresh)
      const logFn = addLogRef.current || addLog;
      if (!logFn) {
        console.error(`[Polling] No addLog function available!`);
        return;
      }

      for (const triggerNode of triggerNodes) {
        const config = triggerNode.data.config || {};
        const nodeId = triggerNode.id;
        
        // Debug: Log config to see what we have
        console.log(`[Polling] Trigger Node ${nodeId} config:`, {
          iotId: config.iotId,
          address: config.address,
          triggerValue: config.triggerValue,
          triggerValueType: typeof config.triggerValue,
          fullConfig: config,
        });
        
        try {
          const module = iotModules.find((m) => String(m.id) === String(config.iotId));
          if (!module) {
            console.warn(`[Polling] Trigger Node ${nodeId}: IOT module not found for iotId=${config.iotId}`);
            continue;
          }
          
          if (!config.address) {
            console.warn(`[Polling] Trigger Node ${nodeId}: address is not configured`);
            continue;
          }
          
          if (config.triggerValue === undefined || config.triggerValue === null) {
            console.warn(`[Polling] Trigger Node ${nodeId}: triggerValue is not configured, defaulting to 1`);
            // Update the node config with default triggerValue
            setNodes((nds) =>
              nds.map((node) => {
                if (node.id === nodeId) {
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      config: {
                        ...node.data.config,
                        triggerValue: 1, // Default to 1 (ON)
                      },
                    },
                  };
                }
                return node;
              })
            );
            // Use default value for this polling cycle
            config.triggerValue = 1;
          }

          const response = await fetch(`${API_BASE}/api/iot/modbus/read`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ipAddress: module.ip_address || module.ipAddress,
              address: config.address,
            }),
          });

          // Check if response is OK
          if (!response.ok) {
            const text = await response.text();
            throw new Error(`HTTP ${response.status}: ${response.statusText}. Response: ${text.substring(0, 200)}`);
          }

          // Check response content type before parsing JSON
          const contentType = response.headers.get("content-type") || "";
          if (!contentType.includes("application/json")) {
            const text = await response.text();
            console.error(`Expected JSON but got ${contentType}. Response:`, text.substring(0, 500));
            throw new Error(`Server returned ${contentType} instead of JSON. Is the proxy server running? Response: ${text.substring(0, 200)}`);
          }

          const result = await response.json();
          
          if (!result) {
            throw new Error("Empty response from server");
          }

          if (result.success) {
            // Parse value - can be number 0/1, string "0"/"1", or status "on"/"off"
            let newValue = 0;
            if (result.value === 1 || result.value === "1" || result.status === "on" || result.status === "ON") {
              newValue = 1;
            } else if (result.value === 0 || result.value === "0" || result.status === "off" || result.status === "OFF") {
              newValue = 0;
            }

            console.log(`Trigger ${nodeId}: Read value from DB - ${JSON.stringify(result)}, parsed to: ${newValue}`);

            // Get previous value from ref
            let previousValue = triggerPreviousValues.current.get(nodeId);
            
            // Initialize previous value if not set
            if (previousValue === undefined) {
              previousValue = newValue;
              triggerPreviousValues.current.set(nodeId, newValue);
              console.log(`Trigger ${nodeId}: Initialized previous value to: ${previousValue}`);
            }

            // Update current value in node - always update, even if same value
            setNodes((nds) =>
              nds.map((node) => {
                if (node.id === nodeId) {
                  console.log(`Trigger ${nodeId}: Updating currentValue from ${node.data?.currentValue} to ${newValue}`);
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      currentValue: newValue,
                    },
                  };
                }
                return node;
              })
            );

            // Normalize triggerValue - ensure it's a number (0 or 1)
            let triggerValue = config.triggerValue;
            if (triggerValue === undefined || triggerValue === null) {
              // Default to 1 if not set
              triggerValue = 1;
              console.warn(`[Trigger Check] Node ${nodeId}: triggerValue is undefined/null, defaulting to 1`);
            } else {
              triggerValue = Number(triggerValue);
              if (isNaN(triggerValue)) {
                triggerValue = 1;
                console.warn(`[Trigger Check] Node ${nodeId}: triggerValue is not a number, defaulting to 1`);
              }
            }

            // Check trigger condition - only trigger when value changes from non-trigger to trigger value
            const shouldTrigger = newValue === triggerValue && previousValue !== triggerValue;

            // Debug logging
            if (previousValue !== undefined) {
              console.log(`[Trigger Check] Node ${nodeId}: currentValue=${newValue}, triggerValue=${triggerValue}, previousValue=${previousValue}, shouldTrigger=${shouldTrigger}`, {
                config: config,
                rawTriggerValue: config.triggerValue,
                normalizedTriggerValue: triggerValue,
              });
            }

            if (shouldTrigger) {
              console.log(`[TRIGGER ACTIVATE] ✅ Node ${nodeId} - Value changed from ${previousValue} to ${newValue}`);
              
              // Log: Trigger activate (เข้าเงื่อนไข)
              const normalizedTriggerValue = Number(config.triggerValue ?? 1);
              logFn(nodeId, {
                type: "trigger",
                message: `🔔 เข้าเงื่อนไข: ${module.ip_address || module.ipAddress} ${config.address.toUpperCase()} = ${normalizedTriggerValue === 1 ? "ON" : "OFF"} (ค่าเดิม: ${previousValue === 1 ? "ON" : "OFF"})`,
                timestamp: new Date(),
              });

              // Mark trigger node as running
              setNodes((nds) =>
                nds.map((node) => {
                  if (node.id === nodeId) {
                    return {
                      ...node,
                      data: { ...node.data, isRunning: true },
                    };
                  }
                  return node;
                })
              );

              // Execute connected nodes in sequence
              console.log(`[CHAIN START] Starting chain execution from trigger ${nodeId}`);

              executeNodeChain(nodeId).then(() => {
                logFn(nodeId, {
                  type: "success",
                  message: `✅ Flow execution เสร็จสมบูรณ์`,
                  timestamp: new Date(),
                });
                // Mark trigger node as not running after execution completes
                setTimeout(() => {
                  setNodes((nds) =>
                    nds.map((node) => {
                      if (node.id === nodeId) {
                        return {
                          ...node,
                          data: { ...node.data, isRunning: false },
                        };
                      }
                      return node;
                    })
                  );
                }, 1000);
              });
            }

            // Update previous value in ref
            triggerPreviousValues.current.set(nodeId, newValue);
          }
        } catch (error) {
          console.error("Error polling trigger:", error);
          const logFnError = addLogRef.current || addLog;
          logFnError(nodeId, {
            type: "error",
            message: `❌ Error: ${error.message}`,
            timestamp: new Date(),
            data: {
              error: error.message,
            },
          });
        }
      }
    }, 2000);

    return () => {
      clearInterval(pollInterval);
      console.log("[Polling] Stopped polling trigger nodes");
    };
  }, [isRunning, iotModules, addLog, setNodes, executeNodeChain]);

  // Track if IOT nodes have been reset (first run flag)
  const iotNodeResetFlags = useRef(new Map()); // { [nodeId]: boolean }
  const iotPollingIntervalRef = useRef(null); // Store interval ID

  // Poll IOT nodes every 1 second (only when running)
  useEffect(() => {
    // Clear any existing interval first
    if (iotPollingIntervalRef.current) {
      clearInterval(iotPollingIntervalRef.current);
      iotPollingIntervalRef.current = null;
    }

    if (!isRunning) {
      // Clear reset flags when stopped
      iotNodeResetFlags.current.clear();
      
      // Mark all IOT nodes as not running when stopped
      setNodes((nds) =>
        nds.map((node) => {
          if (node.type === "iot") {
            return {
              ...node,
              data: { ...node.data, isRunning: false },
            };
          }
          return node;
        })
      );
      
      return;
    }

    const pollIOTInterval = setInterval(async () => {
      // Check if still running before polling
      if (!isRunningRef.current) {
        console.log("[IOT Polling] Stopped - flow is not running");
        return;
      }

      const currentNodes = nodesRef.current;
      const iotNodes = currentNodes.filter((n) => n.type === "iot" && n.data?.config?.iotId);
      
      if (iotNodes.length === 0) {
        return;
      }

      const logFn = addLogRef.current || addLog;

      for (const iotNode of iotNodes) {
        // Check again inside loop
        if (!isRunningRef.current) {
          console.log("[IOT Polling] Stopped during loop - flow is not running");
          break;
        }
        const config = iotNode.data?.config || {};
        const nodeId = iotNode.id;
        const iotId = config.iotId;

        try {
          // Find IOT module
          const module = iotModules.find((m) => String(m.id) === String(iotId));
          if (!module) {
            console.warn(`[IOT Polling] Node ${nodeId}: IOT module not found for iotId=${iotId}`);
            continue;
          }

          const ipAddress = module.ip_address || module.ipAddress;
          
          // Check if this is the first run for this node - reset data first
          const hasBeenReset = iotNodeResetFlags.current.get(nodeId);
          if (!hasBeenReset) {
            // Check again before async operation
            if (!isRunningRef.current) {
              console.log(`[IOT Polling] Stopped before reset - flow is not running`);
              break;
            }

            console.log(`[IOT Polling] Node ${nodeId}: First run - resetting modbus data for IP ${ipAddress}`);
            
            // Reset modbus data (set all in_1 to in_8, out_1 to out_8 to 0)
            try {
              const resetResponse = await fetch(`${API_BASE}/api/iot/modbus/reset`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ipAddress }),
              });

              // Check again after async operation
              if (!isRunningRef.current) {
                console.log(`[IOT Polling] Stopped after reset - flow is not running`);
                break;
              }

              if (resetResponse.ok) {
                const resetResult = await resetResponse.json();
                if (resetResult.success) {
                  // Check again before logging
                  if (!isRunningRef.current) {
                    console.log(`[IOT Polling] Stopped before reset log - flow is not running`);
                    break;
                  }
                  logFn(nodeId, {
                    type: "info",
                    message: `🔄 รีเซ็ตข้อมูล modbus สำหรับ IP ${ipAddress} เรียบร้อย`,
                    timestamp: new Date(),
                  });
                  iotNodeResetFlags.current.set(nodeId, true);
                }
              }
            } catch (resetError) {
              // Check if still running before logging error
              if (!isRunningRef.current) {
                console.log(`[IOT Polling] Stopped during reset error - flow is not running`);
                break;
              }
              console.error(`[IOT Polling] Error resetting modbus data:`, resetError);
              logFn(nodeId, {
                type: "error",
                message: `❌ ไม่สามารถรีเซ็ตข้อมูล modbus: ${resetError.message}`,
                timestamp: new Date(),
              });
            }
          }

          // Read and save modbus data
          try {
            // Check again before async operation
            if (!isRunningRef.current) {
              console.log(`[IOT Polling] Stopped before read - flow is not running`);
              break;
            }

            // Get module config from database
            const moduleResponse = await fetch(`${API_BASE}/api/iot/modules`);
            
            // Check again after first async operation
            if (!isRunningRef.current) {
              console.log(`[IOT Polling] Stopped after modules fetch - flow is not running`);
              break;
            }

            const moduleResult = await moduleResponse.json();
            
            if (moduleResult.success) {
              const moduleData = moduleResult.data.find((m) => String(m.id) === String(iotId));
              
              if (moduleData) {
                // Check again before second async operation
                if (!isRunningRef.current) {
                  console.log(`[IOT Polling] Stopped before read - flow is not running`);
                  break;
                }

                // Call /api/iot/read which already saves to database
                const readResponse = await fetch(`${API_BASE}/api/iot/read`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    communicationType: "modbus",
                    ipAddress: moduleData.ip_address,
                    port: moduleData.port,
                    slaveId: moduleData.slave_id || 1,
                    startAddressInput: moduleData.start_address_input || 0,
                    startAddressOutput: moduleData.start_address_output || 0,
                    modbusFunction: moduleData.modbus_function || "readCoils",
                    numInputs: moduleData.num_inputs || 8,
                    numOutputs: moduleData.num_outputs || 8,
                  }),
                });

                // Check again after async operation
                if (!isRunningRef.current) {
                  console.log(`[IOT Polling] Stopped after read - flow is not running`);
                  break;
                }

                if (readResponse.ok) {
                  const readResult = await readResponse.json();
                  
                  // Check again before logging
                  if (!isRunningRef.current) {
                    console.log(`[IOT Polling] Stopped after read result - flow is not running`);
                    break;
                  }

                  if (readResult.success && readResult.connected) {
                    logFn(nodeId, {
                      type: "info",
                      message: `📡 อ่านและบันทึกข้อมูล modbus สำหรับ IP ${ipAddress} เรียบร้อย`,
                      timestamp: new Date(),
                    });
                  } else {
                    logFn(nodeId, {
                      type: "warning",
                      message: `⚠️ ไม่สามารถเชื่อมต่อ IOT device: ${readResult.error || "Unknown error"}`,
                      timestamp: new Date(),
                    });
                  }
                }
              }
            }
          } catch (readError) {
            // Check if still running before logging error
            if (!isRunningRef.current) {
              console.log(`[IOT Polling] Stopped during error handling - flow is not running`);
              break;
            }
            console.error(`[IOT Polling] Error reading modbus data:`, readError);
            logFn(nodeId, {
              type: "error",
              message: `❌ ไม่สามารถอ่านข้อมูล modbus: ${readError.message}`,
              timestamp: new Date(),
            });
          }

          // Update node running state only if still running
          if (isRunningRef.current) {
            setNodes((nds) =>
              nds.map((node) => {
                if (node.id === nodeId) {
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      isRunning: true,
                    },
                  };
                }
                return node;
              })
            );
          }
        } catch (error) {
          // Check if still running before logging error
          if (!isRunningRef.current) {
            console.log(`[IOT Polling] Stopped during error - flow is not running`);
            break;
          }
          console.error(`[IOT Polling] Error for node ${nodeId}:`, error);
        }
      }
    }, 1000); // Poll every 1 second

    // Store interval ID in ref
    iotPollingIntervalRef.current = pollIOTInterval;

    return () => {
      if (iotPollingIntervalRef.current) {
        clearInterval(iotPollingIntervalRef.current);
        iotPollingIntervalRef.current = null;
        console.log("[IOT Polling] Stopped polling IOT nodes");
      }
    };
  }, [isRunning, iotModules, addLog, setNodes]);

  // Clear IOT reset flags when flow stops
  useEffect(() => {
    if (!isRunning) {
      iotNodeResetFlags.current.clear();
    }
  }, [isRunning]);

  return (
    <div className="auto-condition-page">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Auto Condition</h1>
          <p>ลาก Node และเส้นเชื่อมกันเพื่อสร้าง Step การทำงานอัตโนมัติ</p>
        </div>
        <div className="page-header-right">
          <button 
            className="btn-toggle-panel-header"
            onClick={() => setHideNodePalette(!hideNodePalette)}
            title={hideNodePalette ? "แสดง Node Palette" : "ซ่อน Node Palette"}
          >
            {hideNodePalette ? "◀" : "▶"} Node Menu
          </button>
          <button 
            className="btn-toggle-panel-header"
            onClick={() => {
              console.log("[Toggle Canvas] Before:", hideCanvas);
              setHideCanvas((prev) => {
                const newValue = !prev;
                console.log("[Toggle Canvas] After:", newValue);
                return newValue;
              });
            }}
            title={hideCanvas ? "แสดง Canvas" : "ซ่อน Canvas"}
          >
            {hideCanvas ? "◀" : "▶"} Canvas
          </button>
        </div>
      </div>

      <div className={`auto-condition-layout-flow ${hideNodePalette ? 'hide-palette' : ''} ${hideCanvas ? 'hide-canvas' : ''} ${hideNodePalette && hideCanvas ? 'full-console' : ''}`}>
        {/* Left Side - Node Palette */}
        <NodePalette onAddNode={() => {}} isRunning={isRunning} />

        {/* Center - Flow Canvas */}
        <div className={`flow-container ${isRunning ? 'running-dark' : ''}`} ref={reactFlowWrapper}>
          {/* Run/Stop Controls */}
          <div className="flow-controls">
            <div className="flow-controls-left">
              <h3>Flow Editor</h3>
            </div>
            <div className="flow-controls-right">
              <button 
                className="btn-export" 
                onClick={handleExportFlow}
                title="Export Flow เป็น JSON"
                style={{ marginRight: "8px" }}
              >
                📥 Export
              </button>
              <button 
                className="btn-import" 
                onClick={handleImportFlow}
                title="Import Flow จาก JSON"
                style={{ marginRight: "8px" }}
              >
                📤 Import
              </button>
              {!isRunning ? (
                <button className="btn-run" onClick={handleRunWithBackend}>
                  ▶ Run
                </button>
              ) : (
                <button className="btn-stop" onClick={handleStopWithBackend}>
                  ⏹ Stop
                </button>
              )}
              <div className={`flow-status ${isRunning ? "running" : "stopped"}`}>
                <span className="status-indicator"></span>
                {isRunning ? "Running" : "Stopped"}
              </div>
            </div>
          </div>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodesDelete={onNodesDelete}
            onEdgeDoubleClick={onEdgeDoubleClick}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-left"
            nodesDraggable={!isRunning}
            nodesConnectable={!isRunning}
          >
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        {/* Right Side - Console Monitor */}
        <div className="console-panel">
          <ConsoleMonitor 
            logsByNode={logsByNode} 
            nodes={nodes}
          />
        </div>
      </div>

      {/* Node Config Modal */}
      {configModalOpen && selectedNode && (
        <NodeConfigModal
          node={selectedNode}
          onSave={handleSaveNodeConfig}
          onClose={() => {
            setConfigModalOpen(false);
            setSelectedNode(null);
          }}
          onDelete={handleDeleteNode}
          iotModules={iotModules}
          parks={parks}
          isRunning={isRunning}
        />
      )}
    </div>
  );
}

export default AutoConditionFlow;
