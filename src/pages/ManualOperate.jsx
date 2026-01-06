import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import "../styles/ManualOperate.css";

const API_PROXY_BASE = "http://localhost:4000";
const ORDERS_URL = `${API_PROXY_BASE}/orders`;
const AGVS_URL = `${API_PROXY_BASE}/agvs`;
const ORDER_MOD_URL = `${API_PROXY_BASE}/orderModifications`;
const AUTO_REFRESH_MS = 7000;
const MAX_STATUS = 8;

const toTimestamp = () => Date.now().toString();

const handleNetworkResponse = async (response) => {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `${response.status} ${response.statusText}: ${errorText || "Unknown"}`
    );
  }
  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  return isJson ? response.json() : null;
};

const buildOrderPayload = (source, destination) => ({
  id: toTimestamp(),
  systemId: "RCS",
  type: "LoadingAndUnloading",
  flag: "",
  description: "",
  requiredAgvs: ["0001"],
  priority: 1,
  source,
  destination,
  cargo: "goods",
  parameters: "",
  validPeriod: 0,
  Dependencies: "",
  Sequence: null,
});

const fetchAgvs = async () => {
  const response = await fetch(AGVS_URL, {
    headers: { Accept: "application/json" },
  });
  return handleNetworkResponse(response);
};

const postOrder = async (payload) => {
  const response = await fetch(ORDERS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleNetworkResponse(response);
};

const postOrderModification = async (orderId) => {
  const response = await fetch(ORDER_MOD_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: toTimestamp(),
      type: 2,
      orderId,
    }),
  });
  return handleNetworkResponse(response);
};

const normalizeAgvList = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (raw?.agvs && Array.isArray(raw.agvs)) return raw.agvs;
  if (raw?.data && Array.isArray(raw.data)) return raw.data;
  return [];
};

const extractOrderIds = (agvs) => {
  const ids = new Set();
  agvs.forEach((agv) => {
    if (agv?.orderId) ids.add(agv.orderId);
    if (agv?.currentOrderId) ids.add(agv.currentOrderId);
    if (agv?.lastOrderId) ids.add(agv.lastOrderId);
    if (agv?.order?.id) ids.add(agv.order.id);
  });
  return [...ids].filter(Boolean);
};

const meterToPixel = (x, y, mapWidth, mapHeight, scaleX, scaleY, originOffset = { x: 0, y: 0 }) => {
  // originOffset.x: ตำแหน่ง X ของ origin (0,0) จากด้านซ้าย (pixels)
  // originOffset.y: ตำแหน่ง Y ของ origin (0,0) จากด้านล่าง (pixels)
  // เมื่อ x=0, y=0 ควรได้ตำแหน่งตรงกับ origin marker
  
  // Origin marker แสดงที่: top = (mapHeight - originOffset.y) / mapHeight * 100%
  // ดังนั้นตำแหน่ง Y จากด้านบน = mapHeight - originOffset.y
  
  // X coordinate: เพิ่ม x ในหน่วย meter คูณด้วย scaleX
  const pixelX = originOffset.x + (x * scaleX);
  
  // Y coordinate: 
  // - Origin อยู่ที่ Y จากด้านบน = mapHeight - originOffset.y
  // - เมื่อ y (meter) เพิ่มขึ้น, pixelY ลดลง (เพราะ Y เริ่มจากด้านบน)
  // - ดังนั้น: pixelY = (mapHeight - originOffset.y) - (y * scaleY)
  const pixelY = (mapHeight - originOffset.y) - (y * scaleY);
  
  return { pixelX, pixelY };
};

const ManualOperate = () => {
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [statusLog, setStatusLog] = useState([]);
  const [agvs, setAgvs] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isStartLoading, setIsStartLoading] = useState(false);
  const [isClearLoading, setIsClearLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mapDimensions, setMapDimensions] = useState({ width: 0, height: 0 });
  // ขนาดจริงของแผนที่ในหน่วยเมตร (อ้างอิงจาก Map.PNG)
  // ค่าเหล่านี้ควรตรงกับขนาดจริงของพื้นที่ที่แสดงในแผนที่
  // ตัวอย่าง: ถ้าแผนที่แสดงพื้นที่ 50m x 50m ให้ตั้งค่าเป็น 50
  const [mapWidthMeters, setMapWidthMeters] = useState(50); // ขนาดความกว้างของแผนที่ในหน่วยเมตร
  const [mapHeightMeters, setMapHeightMeters] = useState(50); // ขนาดความสูงของแผนที่ในหน่วยเมตร
  const [mapScaleX, setMapScaleX] = useState(null); // Scale X: pixels per meter
  const [mapScaleY, setMapScaleY] = useState(null); // Scale Y: pixels per meter
  const [isEditMapMode, setIsEditMapMode] = useState(false);
  const [editMapModeType, setEditMapModeType] = useState(null); // "setZero" or "calibrate"
  const [originOffset, setOriginOffset] = useState({ x: 0, y: 0 });
  // Calibrate mode states
  const [calibratePoints, setCalibratePoints] = useState([]); // Array of {x, y} points (pixels)
  const [calibrateDistance, setCalibrateDistance] = useState(""); // Distance in mm
  const [calibrateAxis, setCalibrateAxis] = useState(null); // "x" or "y" - which axis we're calibrating
  const [showCalibrateModal, setShowCalibrateModal] = useState(false);
  const [showEditMapDropdown, setShowEditMapDropdown] = useState(false);
  const [mapImageUrl, setMapImageUrl] = useState("/assets/Map.PNG"); // URL ของรูปภาพแผนที่ (default หรือที่เลือก)
  const fileInputRef = useRef(null);
  
  // คำนวณสเกลจากขนาดจริงของแผนที่ (fallback if not calibrated)
  // scale = pixels / meters (จำนวน pixel ต่อ 1 เมตร)
  const mapScale = useMemo(() => {
    // ถ้ามี scale ที่ calibrate แล้ว ใช้ค่าเฉลี่ยระหว่าง X และ Y
    if (mapScaleX && mapScaleY) {
      return (mapScaleX + mapScaleY) / 2;
    }
    // ถ้ามี scale แค่ตัวเดียว ใช้ตัวนั้น
    if (mapScaleX) return mapScaleX;
    if (mapScaleY) return mapScaleY;
    // ถ้ายังไม่มี scale ใช้ค่าคำนวณจาก map dimensions
    if (mapDimensions.width > 0 && mapWidthMeters > 0) {
      return mapDimensions.width / mapWidthMeters;
    }
    return 1; // default fallback
  }, [mapDimensions.width, mapWidthMeters, mapScaleX, mapScaleY]);
  const mapContainerRef = useRef(null);

  const addStatus = useCallback((message, level = "info") => {
    setStatusLog((prev) => {
      const next = [{ message, level, id: crypto.randomUUID() }, ...prev];
      return next.slice(0, MAX_STATUS);
    });
  }, []);

  const refreshAgvs = useCallback(async () => {
    try {
      const raw = await fetchAgvs();
      const normalized = normalizeAgvList(raw);
      if (!normalized.length) {
        addStatus("No infomation found of agv", "info");
      } else {
        addStatus(`Read position AGV success.`, "success");
      }
      setAgvs(normalized);
      setLastUpdated(new Date());
      return normalized;
    } catch (error) {
      addStatus(`AGV data loading failed: ${error.message}`, "error");
      throw error;
    }
  }, [addStatus]);

  const handleStart = async (event) => {
    event.preventDefault();
    if (!source.trim() || !destination.trim()) {
      addStatus("กรุณากรอกข้อมูลให้ครบ", "error");
      return;
    }
    setIsStartLoading(true);
    try {
      const payload = buildOrderPayload(source.trim(), destination.trim());
      await postOrder(payload);
      addStatus(
        `ส่งคำสั่งเรียบร้อย: ${payload.source} → ${payload.destination}`,
        "success"
      );
      setSource("");
      setDestination("");
      await refreshAgvs();
    } catch (error) {
      addStatus(`ส่งคำสั่งไม่สำเร็จ: ${error.message}`, "error");
    } finally {
      setIsStartLoading(false);
    }
  };

  const handleClear = async () => {
    setIsClearLoading(true);
    try {
      const latestAgvs = await refreshAgvs();
      const orderIds = extractOrderIds(latestAgvs);
      if (!orderIds.length) {
        addStatus("ไม่พบ orderId จากข้อมูล AGV", "info");
        return;
      }
      await Promise.all(orderIds.map((id) => postOrderModification(id)));
      addStatus(
        `ส่งคำสั่งยกเลิก ${orderIds.length} รายการสำเร็จ`,
        "success"
      );
      await refreshAgvs();
    } catch (error) {
      addStatus(`ยกเลิกคำสั่งล้มเหลว: ${error.message}`, "error");
    } finally {
      setIsClearLoading(false);
    }
  };

  // Load origin offset and map dimensions from localStorage on mount
  useEffect(() => {
    const savedOrigin = localStorage.getItem("mapOriginOffset");
    if (savedOrigin) {
      try {
        const parsed = JSON.parse(savedOrigin);
        setOriginOffset({ x: parsed.x || 0, y: parsed.y || 0 });
      } catch (e) {
        console.error("Error loading origin offset:", e);
      }
    }
    
    // Load map dimensions in meters
    const savedMapSize = localStorage.getItem("mapSizeMeters");
    if (savedMapSize) {
      try {
        const parsed = JSON.parse(savedMapSize);
        setMapWidthMeters(parsed.width || 50);
        setMapHeightMeters(parsed.height || 50);
      } catch (e) {
        console.error("Error loading map size:", e);
      }
    }
    
    // Load calibrated scales
    const savedScales = localStorage.getItem("mapScales");
    if (savedScales) {
      try {
        const parsed = JSON.parse(savedScales);
        if (parsed.scaleX) setMapScaleX(parsed.scaleX);
        if (parsed.scaleY) setMapScaleY(parsed.scaleY);
      } catch (e) {
        console.error("Error loading map scales:", e);
      }
    }
    
    // Load saved map image URL
    const savedMapImage = localStorage.getItem("mapImageUrl");
    if (savedMapImage) {
      try {
        setMapImageUrl(savedMapImage);
      } catch (e) {
        console.error("Error loading map image:", e);
      }
    }
  }, []);

  // Handle wheel event with non-passive listener to allow preventDefault
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoomLevel((prev) => {
        const newZoom = Math.max(0.5, Math.min(3, prev + delta));
        return newZoom;
      });
    };

    // Attach event listener with non-passive option
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  useEffect(() => {
    let timerId;
    const setup = async () => {
      await refreshAgvs();
      timerId = setInterval(refreshAgvs, AUTO_REFRESH_MS);
    };
    setup();

    const visibilityHandler = () => {
      if (document.hidden) {
        clearInterval(timerId);
      } else {
        refreshAgvs();
        timerId = setInterval(refreshAgvs, AUTO_REFRESH_MS);
      }
    };

    document.addEventListener("visibilitychange", visibilityHandler);

    return () => {
      clearInterval(timerId);
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
  }, [refreshAgvs]);

  const agvMarkers = useMemo(() => {
    if (!mapDimensions.width || !mapDimensions.height) return [];

    return agvs
      .map((agv) => {
        const pos = agv?.position || agv?.pose || { 
          x: agv?.x, 
          y: agv?.y,
          theta: agv?.theta || agv?.yaw || agv?.angle || 0
        };
        
        if (!Number.isFinite(pos?.x) || !Number.isFinite(pos?.y)) return null;

        // Use separate scales for X and Y, fallback to mapScale if not calibrated
        const scaleX = mapScaleX || mapScale;
        const scaleY = mapScaleY || mapScale;
        const { pixelX, pixelY } = meterToPixel(
          pos.x,
          pos.y,
          mapDimensions.width,
          mapDimensions.height,
          scaleX,
          scaleY,
          originOffset
        );

        let theta = pos.theta || 0;
        if (Math.abs(theta) < 6.28) {
          // แปลงจาก radian เป็น degree
          theta = (theta * 180) / Math.PI;
        }
        // ปรับทิศทางให้ถูกต้อง: เพิ่ม 180 องศาเพื่อแก้ไขการกลับหัว
        // ในระบบพิกัดแผนที่ Y เริ่มจากด้านบน แต่ theta อาจอ้างอิงจากระบบที่ Y เริ่มจากล่าง
        theta = theta + 180;
        // ทำให้อยู่ในช่วง 0-360
        theta = ((theta % 360) + 360) % 360;

        // Determine offline status: check multiple conditions
        const isOffline = agv?.state === "offline" || 
                         agv?.isPowerOff === true || 
                         agv?.powerOff === true ||
                         (agv?.lastMessageTime && (Date.now() - new Date(agv.lastMessageTime).getTime() > 60000)); // 60 seconds timeout
        
        // Determine state/status text
        let stateText = agv?.state || "unknown";
        if (agv?.workState !== undefined) {
          const workStates = {
            0: "Idle",
            1: "Working",
            2: "Charging",
            3: "Error",
            4: "Maintenance"
          };
          stateText = workStates[agv.workState] || `State ${agv.workState}`;
        }

        // Convert pixel coordinates to percentage for consistent scaling
        const percentX = (pixelX / mapDimensions.width) * 100;
        const percentY = (pixelY / mapDimensions.height) * 100;

        return {
          id: agv?.id ?? agv?.name ?? crypto.randomUUID(),
          label: agv?.name ?? agv?.id ?? "AGV",
          initials: agv?.name?.slice(-2) ?? agv?.id?.slice(-2) ?? "AG",
          offline: isOffline,
          state: stateText,
          workState: agv?.workState,
          operatingMode: agv?.operatingMode,
          battery: agv?.battery,
          errors: agv?.errors || [],
          orderId: agv?.orderId,
          lastOrderId: agv?.lastOrderId,
          x: pixelX,
          y: pixelY,
          percentX: percentX,
          percentY: percentY,
          originalX: pos.x, // X จาก API (meter)
          originalY: pos.y, // Y จาก API (meter)
          theta: theta,
        };
      })
      .filter(Boolean);
  }, [agvs, mapDimensions, mapScale, mapScaleX, mapScaleY, originOffset]);

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleZoomReset = () => {
    setZoomLevel(1);
    setPanX(0);
    setPanY(0);
  };

  const handleEditMap = (modeType) => {
    setEditMapModeType(modeType);
    setIsEditMapMode(true);
    if (modeType === "setZero") {
      addStatus("โหมด Set Zero: คลิกบนแผนที่เพื่อตั้งจุด Origin (0,0)", "info");
    } else if (modeType === "calibrate") {
      setCalibratePoints([]);
      setCalibrateDistance("");
      addStatus("โหมด Calibrate: คลิกบนแผนที่เพื่อเลือกจุดที่ 1", "info");
    }
  };

  const handleSetZero = () => {
    handleEditMap("setZero");
  };

  const handleCalibrate = () => {
    setCalibratePoints([]);
    setCalibrateDistance("");
    setCalibrateAxis("y"); // เริ่มด้วย Y axis ก่อน
    setShowCalibrateModal(false);
    setIsEditMapMode(true);
    setEditMapModeType("calibrate");
    addStatus("Calibrate: เริ่มต้นด้วยแกน Y - คลิกเลือก 2 จุดในแนวแกน Y", "info");
  };

  // Handle file selection for map image
  const handleMapImageChange = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // ตรวจสอบว่าเป็นไฟล์รูปภาพหรือไม่
    if (!file.type.startsWith('image/')) {
      addStatus("กรุณาเลือกไฟล์รูปภาพเท่านั้น", "error");
      return;
    }

    // อ่านไฟล์และแปลงเป็น data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setMapImageUrl(dataUrl);
      // บันทึกไว้ใน localStorage
      localStorage.setItem("mapImageUrl", dataUrl);
      // ส่ง custom event เพื่อแจ้งให้ Monitor page อัพเดทรูปภาพ
      window.dispatchEvent(new CustomEvent('mapImageChanged', { detail: { imageUrl: dataUrl } }));
      addStatus(`เปลี่ยนรูปภาพแผนที่สำเร็จ: ${file.name}`, "success");
      // Reset file input เพื่อให้สามารถเลือกไฟล์เดิมได้อีกครั้ง
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      addStatus("เกิดข้อผิดพลาดในการอ่านไฟล์", "error");
    };
    reader.readAsDataURL(file);
  }, [addStatus]);

  const handleSaveOrigin = () => {
    if (editMapModeType === "setZero") {
      // Save to localStorage
      localStorage.setItem("mapOriginOffset", JSON.stringify(originOffset));
      setIsEditMapMode(false);
      setEditMapModeType(null);
      addStatus("บันทึกจุด Origin (0,0) สำเร็จ", "success");
    } else if (editMapModeType === "calibrate") {
      // Handle calibrate save
      if (calibratePoints.length !== 2) {
        addStatus("กรุณาเลือก 2 จุดในแผนที่", "error");
        return;
      }
      if (!calibrateDistance || parseFloat(calibrateDistance) <= 0) {
        addStatus("กรุณากรอกระยะทาง (mm) ที่ถูกต้อง", "error");
        return;
      }
      
      // Calculate distance between two points in pixels
      const dx = calibratePoints[1].x - calibratePoints[0].x;
      const dy = calibratePoints[1].y - calibratePoints[0].y;
      
      // Convert distance from mm to meters
      const distanceMeters = parseFloat(calibrateDistance) / 1000;
      
      if (calibrateAxis === "y") {
        // Calibrate Y axis - ใช้ระยะห่างในแนว Y (dy)
        const pixelDistanceY = Math.abs(dy);
        const newScaleY = pixelDistanceY / distanceMeters;
        
        setMapScaleY(newScaleY);
        setCalibratePoints([]);
        setCalibrateDistance("");
        setShowCalibrateModal(false);
        setCalibrateAxis("x"); // ต่อไป calibrate X axis
        
        // Save current progress
        const currentScaleX = mapScaleX || null;
        localStorage.setItem("mapScales", JSON.stringify({
          scaleX: currentScaleX,
          scaleY: newScaleY,
          calibratedAt: new Date().toISOString()
        }));
        
        addStatus(`Calibrate แกน Y สำเร็จ: ระยะ ${calibrateDistance}mm = ${pixelDistanceY.toFixed(2)} pixels, Scale Y = ${newScaleY.toFixed(2)} px/m. ต่อไป: Calibrate แกน X - คลิกเลือก 2 จุดในแนวแกน X`, "success");
      } else if (calibrateAxis === "x") {
        // Calibrate X axis - ใช้ระยะห่างในแนว X (dx)
        const pixelDistanceX = Math.abs(dx);
        const newScaleX = pixelDistanceX / distanceMeters;
        
        setMapScaleX(newScaleX);
        
        // Save both scales
        localStorage.setItem("mapScales", JSON.stringify({
          scaleX: newScaleX,
          scaleY: mapScaleY,
          calibratedAt: new Date().toISOString()
        }));
        
        setIsEditMapMode(false);
        setEditMapModeType(null);
        setCalibratePoints([]);
        setCalibrateDistance("");
        setCalibrateAxis(null);
        setShowCalibrateModal(false);
        addStatus(`Calibrate สำเร็จ: Scale X = ${newScaleX.toFixed(2)} px/m, Scale Y = ${mapScaleY?.toFixed(2) || "N/A"} px/m`, "success");
      }
    }
  };

  const handleCancelEdit = () => {
    if (editMapModeType === "setZero") {
      // Reload from localStorage
      const savedOrigin = localStorage.getItem("mapOriginOffset");
      if (savedOrigin) {
        try {
          const parsed = JSON.parse(savedOrigin);
          setOriginOffset({ x: parsed.x || 0, y: parsed.y || 0 });
        } catch (e) {
          setOriginOffset({ x: 0, y: 0 });
        }
      } else {
        setOriginOffset({ x: 0, y: 0 });
      }
    } else if (editMapModeType === "calibrate") {
      setCalibratePoints([]);
      setCalibrateDistance("");
      setCalibrateAxis(null);
      setShowCalibrateModal(false);
    }
    setIsEditMapMode(false);
    setEditMapModeType(null);
    addStatus("ยกเลิกการแก้ไข", "info");
  };

  const handleMapClick = useCallback((e) => {
    if (!isEditMapMode) return;
    
    // Don't handle map clicks when modal is open
    if (showCalibrateModal) return;
    
    // Prevent drag when clicking in edit mode
    e.stopPropagation();
    e.preventDefault();
    
    // Get click position relative to map background image
    const mapBg = e.currentTarget.querySelector('.map-background');
    if (!mapBg || mapDimensions.width === 0) return;
    
    const bgRect = mapBg.getBoundingClientRect();
    
    // Calculate click position relative to image
    const clickX = e.clientX - bgRect.left;
    const clickY = e.clientY - bgRect.top;
    
    // Convert to original image coordinates
    const scaleX = mapDimensions.width / bgRect.width;
    const scaleY = mapDimensions.height / bgRect.height;
    
    const mapX = clickX * scaleX;
    const mapY = clickY * scaleY;
    
    if (editMapModeType === "setZero") {
      // Set origin offset (relative to original 0,0 which is bottom-left)
      // originOffset.y represents the offset from bottom
      const newOriginX = mapX;
      const newOriginY = mapDimensions.height - mapY;
      
      setOriginOffset({ x: newOriginX, y: newOriginY });
      addStatus(`ตั้งจุด Origin (0,0) ที่ตำแหน่ง Pixel (${Math.round(mapX)}, ${Math.round(mapY)})`, "success");
    } else if (editMapModeType === "calibrate") {
      // Handle calibrate mode - select 2 points
      const newPoint = { x: mapX, y: mapY };
      const axisLabel = calibrateAxis === "y" ? "แกน Y" : calibrateAxis === "x" ? "แกน X" : "แกน";
      
      if (calibratePoints.length === 0) {
        setCalibratePoints([newPoint]);
        addStatus(`Calibrate ${axisLabel}: เลือกจุดที่ 1: (${Math.round(mapX)}, ${Math.round(mapY)}), กรุณาเลือกจุดที่ 2`, "info");
      } else if (calibratePoints.length === 1) {
        setCalibratePoints([...calibratePoints, newPoint]);
        const dx = newPoint.x - calibratePoints[0].x;
        const dy = newPoint.y - calibratePoints[0].y;
        const pixelDistance = calibrateAxis === "y" ? Math.abs(dy) : Math.abs(dx);
        addStatus(`Calibrate ${axisLabel}: เลือกจุดที่ 2: (${Math.round(mapX)}, ${Math.round(mapY)}), ระยะห่าง = ${pixelDistance.toFixed(2)} pixels, กรุณากรอกระยะทาง (mm)`, "info");
        setShowCalibrateModal(true);
      }
    }
  }, [isEditMapMode, editMapModeType, mapDimensions, calibratePoints, showCalibrateModal, addStatus]);

  const handleMouseDown = useCallback((e) => {
    if (isEditMapMode) {
      // In edit mode, handle click for setting origin
      handleMapClick(e);
      return;
    }
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
    }
  }, [panX, panY, isEditMapMode, handleMapClick]);

  const handleMouseMove = useCallback(
    (e) => {
      if (isDragging) {
        setPanX(e.clientX - dragStart.x);
        setPanY(e.clientY - dragStart.y);
      }
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showEditMapDropdown) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('.edit-map-dropdown')) {
        setShowEditMapDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showEditMapDropdown]);

  return (
    <div className="manual-operate-page">
      <div className="page-header">
        <h1>Manual & Operate</h1>
        <p>กรอกข้อมูลต้นทาง-ปลายทาง แล้วสั่งงานหรือยกเลิกคำสั่งล่าสุด</p>
      </div>

      <div className="page-content-grid">
        <section className="controls-section">
          <form className="card" onSubmit={handleStart}>
            <h2>สร้างคำสั่งใหม่</h2>
            <div className="field-grid">
              <label className="field">
                <span>Source *</span>
                <input
                  type="text"
                  placeholder="เช่น A01"
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>Destination *</span>
                <input
                  type="text"
                  placeholder="เช่น B02"
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  required
                />
              </label>
            </div>
            <button type="submit" className="primary" disabled={isStartLoading}>
              {isStartLoading ? "กำลังส่ง..." : "Start Create Order"}
            </button>
          </form>

          <section className="card">
            <h2>ยกเลิกคำสั่ง</h2>
            <p className="helper" style={{ marginBottom: "20px" }}>
              ทำการยกเลิกออเดอร์ปัจจุบันที่กำลังทำงานอยู่บน AGV 
            </p>
            <button
              type="button"
              className="danger"
              onClick={handleClear}
              disabled={isClearLoading}
            >
              {isClearLoading ? "กำลังยกเลิก..." : "Clear Orders"}
            </button>
          </section>

          <section className="card status-card">
            <h2>สถานะล่าสุด</h2>
            <ul id="status-log" aria-live="polite">
              {statusLog.length === 0 && (
                <li className="info">ยังไม่มีการทำรายการ</li>
              )}
              {statusLog.map((entry) => (
                <li key={entry.id} className={entry.level}>
                  {entry.message}
                </li>
              ))}
            </ul>
          </section>
        </section>

        <section className="map-section">
          <div className="map-header">
            <h2>แผนที่ & ตำแหน่ง AGV</h2>
            <div className="map-actions">
              {!isEditMapMode ? (
                <>
                  <div className="edit-map-dropdown">
                    <button 
                      type="button" 
                      className="btn-edit-map"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowEditMapDropdown(!showEditMapDropdown);
                      }}
                    >
                       Edit Map ▼
                    </button>
                    {showEditMapDropdown && (
                      <div className="edit-map-dropdown-menu">
                        <button 
                          type="button"
                          className="dropdown-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            fileInputRef.current?.click();
                            setShowEditMapDropdown(false);
                          }}
                        >
                          Update Picture
                        </button>
                        <button 
                          type="button"
                          className="dropdown-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetZero();
                            setShowEditMapDropdown(false);
                          }}
                        >
                           Set Zero
                        </button>
                        <button 
                          type="button"
                          className="dropdown-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCalibrate();
                            setShowEditMapDropdown(false);
                          }}
                        >
                           Calibrate
                        </button>
                      </div>
                    )}
                    {/* Hidden file input for map image */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleMapImageChange}
                    />
                  </div>
                  <span className="last-updated">
                    {lastUpdated
                      ? `อัปเดตเมื่อ ${lastUpdated.toLocaleTimeString()}`
                      : "—"}
                  </span>
                </>
              ) : (
                <>
                  <button 
                    type="button" 
                    className="btn-save-map"
                    onClick={handleSaveOrigin}
                  >
                    💾 Save
                  </button>
                  <button 
                    type="button" 
                    className="btn-cancel-map"
                    onClick={handleCancelEdit}
                  >
                    ❌ Cancel
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="map-stage card">
            <div
              ref={mapContainerRef}
              className="map-container"
              onMouseDown={handleMouseDown}
              style={{ 
                cursor: isEditMapMode && !showCalibrateModal ? "crosshair" : (isDragging ? "grabbing" : "grab"),
                pointerEvents: showCalibrateModal ? "none" : "auto"
              }}
            >
              <div
                className="map-content"
                style={{
                  transform: `translate(${panX}px, ${panY}px) scale(${zoomLevel})`,
                  transformOrigin: "center center",
                }}
              >
                <img
                  src={mapImageUrl}
                  alt="Map background"
                  className="map-background"
                  onLoad={(e) => {
                    const img = e.target;
                    setMapDimensions({
                      width: img.naturalWidth,
                      height: img.naturalHeight,
                    });
                  }}
                  onError={(e) => {
                    // ถ้าโหลดรูปภาพที่เลือกไม่สำเร็จ ให้กลับไปใช้รูปภาพ default
                    console.error("Error loading map image, falling back to default");
                    setMapImageUrl("/assets/Map.PNG");
                    localStorage.removeItem("mapImageUrl");
                  }}
                />
                {isEditMapMode && (
                  <div className="map-edit-overlay">
                    {/* Grid lines */}
                    <svg className="map-grid" width="100%" height="100%">
                      {/* Vertical lines */}
                      {Array.from({ length: 20 }).map((_, i) => (
                        <line
                          key={`v-${i}`}
                          x1={`${(i * 5)}%`}
                          y1="0"
                          x2={`${(i * 5)}%`}
                          y2="100%"
                          stroke="#dc2626"
                          strokeWidth="1"
                          strokeOpacity="0.3"
                        />
                      ))}
                      {/* Horizontal lines */}
                      {Array.from({ length: 20 }).map((_, i) => (
                        <line
                          key={`h-${i}`}
                          x1="0"
                          y1={`${(i * 5)}%`}
                          x2="100%"
                          y2={`${(i * 5)}%`}
                          stroke="#dc2626"
                          strokeWidth="1"
                          strokeOpacity="0.3"
                        />
                      ))}
                      {/* Calibrate line between two points */}
                      {editMapModeType === "calibrate" && calibratePoints.length === 2 && (
                        <line
                          x1={`${(calibratePoints[0].x / mapDimensions.width) * 100}%`}
                          y1={`${(calibratePoints[0].y / mapDimensions.height) * 100}%`}
                          x2={`${(calibratePoints[1].x / mapDimensions.width) * 100}%`}
                          y2={`${(calibratePoints[1].y / mapDimensions.height) * 100}%`}
                          stroke="#3b82f6"
                          strokeWidth="2"
                          strokeDasharray="5,5"
                        />
                      )}
                    </svg>
                    
                    {/* Set Zero mode: Origin point marker and axes */}
                    {editMapModeType === "setZero" && mapDimensions.width > 0 && (
                      <div
                        className="origin-marker-wrapper"
                        style={{
                          position: "absolute",
                          left: `${(originOffset.x / mapDimensions.width) * 100}%`,
                          top: `${((mapDimensions.height - originOffset.y) / mapDimensions.height) * 100}%`,
                          transform: "translate(-50%, -50%)",
                        }}
                      >
                        {/* Origin crosshair */}
                        <div className="origin-marker">
                          <div className="origin-crosshair">
                            <div className="origin-line origin-line-h"></div>
                            <div className="origin-line origin-line-v"></div>
                          </div>
                          <div className="origin-label">(0,0)</div>
                        </div>
                        {/* X axis */}
                        <div className="axis axis-x">
                          <div className="axis-label axis-x-label">X</div>
                        </div>
                        {/* Y axis */}
                        <div className="axis axis-y">
                          <div className="axis-label axis-y-label">Y</div>
                        </div>
                      </div>
                    )}
                    
                    {/* Calibrate mode: Show selected points */}
                    {editMapModeType === "calibrate" && calibratePoints.map((point, index) => (
                      <div
                        key={`calibrate-point-${index}`}
                        className="calibrate-point-marker"
                        style={{
                          position: "absolute",
                          left: `${(point.x / mapDimensions.width) * 100}%`,
                          top: `${(point.y / mapDimensions.height) * 100}%`,
                          transform: "translate(-50%, -50%)",
                        }}
                      >
                        <div className="calibrate-point-circle">
                          <div className="calibrate-point-label">จุดที่ {index + 1}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Calibrate Distance Modal */}
                {showCalibrateModal && calibratePoints.length === 2 && (
                  <div className="modal-overlay" onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      setShowCalibrateModal(false);
                    }
                  }}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                      <h3>กรอกระยะทาง Calibrate {calibrateAxis === "y" ? "แกน Y" : calibrateAxis === "x" ? "แกน X" : ""}</h3>
                      <p style={{ marginBottom: "16px", color: "#64748b" }}>
                        {calibrateAxis === "y" 
                          ? "ระยะห่างระหว่าง 2 จุดในแนวแกน Y (หน่วย: mm)" 
                          : calibrateAxis === "x"
                          ? "ระยะห่างระหว่าง 2 จุดในแนวแกน X (หน่วย: mm)"
                          : "ระยะห่างระหว่าง 2 จุดที่เลือก (หน่วย: mm)"}
                      </p>
                      <div className="field" style={{ marginBottom: "20px" }}>
                        <label>
                          <span>ระยะทาง (mm) *</span>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={calibrateDistance}
                            onChange={(e) => setCalibrateDistance(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onFocus={(e) => e.stopPropagation()}
                            placeholder="เช่น 5000"
                            autoFocus
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              border: "1px solid #e2e8f0",
                              borderRadius: "6px",
                              fontSize: "1rem",
                              pointerEvents: "auto"
                            }}
                          />
                        </label>
                      </div>
                      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="btn-cancel-map"
                          onClick={() => {
                            setShowCalibrateModal(false);
                            setCalibratePoints([]);
                            setCalibrateDistance("");
                          }}
                        >
                          ยกเลิก
                        </button>
                        <button
                          type="button"
                          className="btn-save-map"
                          onClick={() => {
                            if (calibrateDistance && parseFloat(calibrateDistance) > 0) {
                              handleSaveOrigin();
                            } else {
                              addStatus("กรุณากรอกระยะทาง (mm) ที่ถูกต้อง", "error");
                            }
                          }}
                        >
                          บันทึก
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="agv-layer" role="presentation">
                  {agvMarkers.map((marker) => (
                    <div
                      key={marker.id}
                      className={`agv-icon-container ${marker.offline ? "offline" : ""}`}
                      style={{
                        left: `${marker.percentX}%`,
                        top: `${marker.percentY}%`,
                        transform: `translate(-50%, -50%) scale(${1 / zoomLevel}) rotate(${marker.theta}deg)`,
                      }}
                    >
                      <img
                        src="/assets/SLIM/standby.png"
                        alt={marker.label}
                        className="agv-icon-image"
                        title={`${marker.label} (${marker.state})`}
                      />
                      <span className="agv-label">{marker.initials}</span>
                      <div className="agv-position-info">
                        <div className="agv-position-row">
                          <span className="agv-position-label">API:</span>
                          <span className="agv-position-value">
                            X: {marker.originalX?.toFixed(2) || "N/A"}, Y: {marker.originalY?.toFixed(2) || "N/A"}
                          </span>
                        </div>
                        <div className="agv-position-row">
                          <span className="agv-position-label">Pixel:</span>
                          <span className="agv-position-value">
                            X: {marker.x?.toFixed(0) || "N/A"}, Y: {marker.y?.toFixed(0) || "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="zoom-controls">
              <button
                type="button"
                className="zoom-btn"
                onClick={handleZoomIn}
                title="Zoom In"
              >
                +
              </button>
              <button
                type="button"
                className="zoom-btn"
                onClick={handleZoomOut}
                title="Zoom Out"
              >
                −
              </button>
              <button
                type="button"
                className="zoom-btn"
                onClick={handleZoomReset}
                title="Reset Zoom"
              >
                ⌂
              </button>
              <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ManualOperate;

