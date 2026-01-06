import React, { memo } from "react";
import { 
  HiOutlineLightBulb,
  HiOutlineHashtag,
  HiOutlineCube,
  HiOutlineMap,
  HiOutlineDocumentText,
  HiOutlineBattery100,
  HiOutlineCalendar,
} from "react-icons/hi2";

// Lamp Node Component - แสดงเป็น LED
export const LampNode = memo(({ data, selected, id }) => {
  const isRunning = data?.isRunning || false;
  const isOn = data?.value || false;
  const nodeId = id || data?.id;
  const label = data?.config?.label || "Lamp";
  const color = data?.config?.color || "#10b981";

  return (
    <div className={`monitor-node lamp-node ${selected ? "selected" : ""} ${isRunning ? "running" : ""}`}>
      <div className="monitor-node-header">
        <span className="monitor-node-icon">
          <HiOutlineLightBulb size={18} />
        </span>
        <span className="monitor-node-title">{label}</span>
        {isRunning && <span className="monitor-node-running-indicator">●</span>}
      </div>
      <div className="monitor-node-content">
        <div 
          className={`lamp-indicator ${isOn ? "lamp-on" : "lamp-off"}`}
          style={{ 
            backgroundColor: isOn ? color : "#4b5563",
            boxShadow: isOn ? `0 0 20px ${color}, 0 0 40px ${color}` : "none"
          }}
        >
          <div className="lamp-glow" style={{ opacity: isOn ? 1 : 0 }}></div>
        </div>
        {data.onEdit && (
          <button
            className="monitor-node-edit-btn"
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
      </div>
    </div>
  );
});
LampNode.displayName = "LampNode";

// Counter Node Component - แสดงเป็น display number
export const CounterNode = memo(({ data, selected, id }) => {
  const isRunning = data?.isRunning || false;
  const value = data?.value !== undefined ? data.value : 0;
  const nodeId = id || data?.id;
  const label = data?.config?.label || "Counter";

  return (
    <div className={`monitor-node counter-node ${selected ? "selected" : ""} ${isRunning ? "running" : ""}`}>
      <div className="monitor-node-header">
        <span className="monitor-node-icon">
          <HiOutlineHashtag size={18} />
        </span>
        <span className="monitor-node-title">{label}</span>
        {isRunning && <span className="monitor-node-running-indicator">●</span>}
      </div>
      <div className="monitor-node-content">
        <div className="counter-display">
          <div className="counter-value">{Math.floor(value).toString()}</div>
        </div>
        {data.onEdit && (
          <button
            className="monitor-node-edit-btn"
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
      </div>
    </div>
  );
});
CounterNode.displayName = "CounterNode";

// Park Node Component - แสดงเป็น box
export const ParkNode = memo(({ data, selected, id }) => {
  const isRunning = data?.isRunning || false;
  const nodeId = id || data?.id;
  const group = data?.config?.group || "";
  const externalName = data?.config?.externalName || "";
  const useStateRaw =
    data?.config?.useState !== undefined ? data.config.useState : 0;
  const useState = Number(useStateRaw) || 0;
  const boxWidth = data?.config?.boxWidth || 140;
  const boxHeight = data?.config?.boxHeight || 70;

  // ปรับขนาดตัวอักษรตามขนาดของ park-box แบบสัดส่วน
  const titleFontSize = Math.max(10, Math.round(boxHeight * 0.28)); // ข้อความหลัก
  const valueFontSize = Math.max(9, Math.round(boxHeight * 0.22)); // ข้อความรายละเอียด

  const getStateColor = (state) => {
    switch (state) {
      case 0: return "#6b7280";
      case 1: return "#6b7280"; // OFF
      case 2: return "#f59e0b";
      case 3: return "#10b981"; // ON
      default: return "#6b7280";
    }
  };

  const getStateText = (state) => {
    switch (state) {
      case 0: return "Available";
      case 1: return "Reserved";
      case 2: return "Occupied";
      case 3: return "Ready";
      default: return "Unknown";
    }
  };

  return (
    <div className={`monitor-node park-node ${selected ? "selected" : ""} ${isRunning ? "running" : ""}`}>
      <div className="monitor-node-header">
        <span className="monitor-node-icon">
          <HiOutlineCube size={18} />
        </span>
        <span className="monitor-node-title">
          {externalName || "Park"}
        </span>
        {isRunning && <span className="monitor-node-running-indicator">●</span>}
      </div>
      <div className="monitor-node-content">
        <div 
          className="park-box"
          style={{
            backgroundColor: getStateColor(useState),
            borderColor: getStateColor(useState),
            width: `${boxWidth}px`,
            height: `${boxHeight}px`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "4px",
          }}
        >
          <div
            className="park-state-text"
            style={{ fontSize: `${titleFontSize}px`, lineHeight: 1.1 }}
          >
            {externalName || getStateText(useState)}
          </div>
          {/* ซ่อนรายละเอียดกลุ่มและค่า state ตามคำขอ ไม่ต้องแสดงข้อความใต้หัวข้อ */}
        </div>
        {data.onEdit && (
          <button
            className="monitor-node-edit-btn"
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
      </div>
    </div>
  );
});
ParkNode.displayName = "ParkNode";

// Map Node Component - แสดงรูปภาพและข้อมูล AGV จาก Manual & Operate
export const MapNode = memo(({ data, selected, id }) => {
  const isRunning = data?.isRunning || false;
  const nodeId = id || data?.id;
  const agvs = data?.agvs || [];
  const incomingDimensions = data?.mapDimensions || { width: 0, height: 0 };
  
  // โหลด map settings จาก localStorage เพื่อให้ใช้ข้อมูลเดียวกันกับ ManualOperate
  const [mapSettings, setMapSettings] = React.useState(() => {
    const savedOrigin = localStorage.getItem("mapOriginOffset");
    const savedScales = localStorage.getItem("mapScales");
    
    let originOffset = { x: 0, y: 0 };
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
    
    if (savedScales) {
      try {
        const parsed = JSON.parse(savedScales);
        mapScaleX = parsed.scaleX || null;
        mapScaleY = parsed.scaleY || null;
      } catch (e) {
        console.error("Error loading map scales:", e);
      }
    }
    
    return { originOffset, mapScaleX, mapScaleY };
  });
  
  // อัพเดท map settings เมื่อมีการเปลี่ยนใน localStorage หรือจาก props
  React.useEffect(() => {
    const savedOrigin = localStorage.getItem("mapOriginOffset");
    const savedScales = localStorage.getItem("mapScales");
    
    let originOffset = data?.originOffset || { x: 0, y: 0 };
    let mapScaleX = data?.mapScaleX || null;
    let mapScaleY = data?.mapScaleY || null;
    
    // ถ้ามีใน localStorage ให้ใช้จาก localStorage ก่อน (เพราะเป็นข้อมูลล่าสุดจาก ManualOperate)
    if (savedOrigin) {
      try {
        const parsed = JSON.parse(savedOrigin);
        originOffset = { x: parsed.x || 0, y: parsed.y || 0 };
      } catch (e) {
        console.error("Error loading origin offset:", e);
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
    
    setMapSettings({ originOffset, mapScaleX, mapScaleY });
  }, [data?.originOffset, data?.mapScaleX, data?.mapScaleY]);
  
  // ใช้ map settings จาก state (ที่โหลดจาก localStorage)
  const mapScaleX = mapSettings.mapScaleX;
  const mapScaleY = mapSettings.mapScaleY;
  const originOffset = mapSettings.originOffset;

  // ใช้ ref เพื่อเก็บขนาดอ้างอิงที่คงที่แม้เมื่อปิดแสดงรูปภาพ
  const referenceDimensionsRef = React.useRef(null);
  
  // ใช้สถานะภายในสำหรับขนาดรูปแผนที่ (เหมือน Manual & Operate)
  const [mapDimensions, setMapDimensions] = React.useState(incomingDimensions);

  // อัปเดตจาก props หากมีการเปลี่ยน (เช่น จาก Monitor.jsx)
  React.useEffect(() => {
    if (incomingDimensions.width && incomingDimensions.height) {
      setMapDimensions(incomingDimensions);
      // เก็บขนาดอ้างอิงเมื่อได้รับข้อมูลใหม่
      if (!referenceDimensionsRef.current || 
          (incomingDimensions.width && incomingDimensions.height)) {
        referenceDimensionsRef.current = {
          width: incomingDimensions.width,
          height: incomingDimensions.height,
        };
      }
    }
  }, [incomingDimensions.width, incomingDimensions.height]);

  // อ่านรูปภาพแผนที่จาก localStorage (ที่บันทึกไว้ใน ManualOperate)
  // หรือใช้ default ถ้ายังไม่มี
  const [mapImage, setMapImage] = React.useState(() => {
    const savedMapImage = localStorage.getItem("mapImageUrl");
    return savedMapImage || "/assets/Map.PNG";
  });

  // อัพเดทรูปภาพเมื่อมีการเปลี่ยนใน localStorage (จาก ManualOperate)
  React.useEffect(() => {
    const handleMapImageChange = () => {
      const savedMapImage = localStorage.getItem("mapImageUrl");
      const newImage = savedMapImage || "/assets/Map.PNG";
      if (newImage !== mapImage) {
        setMapImage(newImage);
      }
    };

    // ฟัง custom event เมื่อมีการเปลี่ยนรูปภาพใน ManualOperate
    window.addEventListener('mapImageChanged', handleMapImageChange);
    
    // ฟัง storage event (เมื่อมีการเปลี่ยน localStorage ในหน้าอื่น/แท็บอื่น)
    window.addEventListener('storage', handleMapImageChange);

    // ตรวจสอบการเปลี่ยนแปลงใน localStorage เป็นระยะ (fallback)
    const interval = setInterval(handleMapImageChange, 2000); // ตรวจสอบทุก 2 วินาที

    return () => {
      window.removeEventListener('mapImageChanged', handleMapImageChange);
      window.removeEventListener('storage', handleMapImageChange);
      clearInterval(interval);
    };
  }, [mapImage]);

  // ใช้ค่า default เมื่อไม่มีรูปภาพ (สำหรับกรณีที่ปิดการแสดงรูปภาพ)
  // ใช้ขนาดอ้างอิงเพื่อรองรับการขยับหรืออัพเดทตำแหน่งของ icon เมื่อ icon ทำงาน
  const effectiveMapDimensions = React.useMemo(() => {
    // ใช้ขนาดอ้างอิงที่เก็บไว้ก่อน (แม้เมื่อปิดแสดงรูปภาพ)
    if (referenceDimensionsRef.current?.width && referenceDimensionsRef.current?.height) {
      return referenceDimensionsRef.current;
    }
    
    // ถ้ายังไม่มีขนาดอ้างอิง ให้ใช้ขนาดปัจจุบัน
    if (mapDimensions.width && mapDimensions.height) {
      return mapDimensions;
    }
    
    // ใช้ค่า default จาก config หรือ localStorage
    const savedMapSize = localStorage.getItem("mapSizeMeters");
    if (savedMapSize) {
      try {
        const parsed = JSON.parse(savedMapSize);
        // แปลงจากเมตรเป็นพิกเซลโดยประมาณ (ใช้ scale 10 pixels/meter)
        const defaultDims = {
          width: (parsed.width || 50) * 10,
          height: (parsed.height || 50) * 10,
        };
        // เก็บเป็นขนาดอ้างอิง
        if (!referenceDimensionsRef.current) {
          referenceDimensionsRef.current = defaultDims;
        }
        return defaultDims;
      } catch (e) {
        console.error("Error parsing map size:", e);
      }
    }
    
    // ค่า default ถ้าไม่มีข้อมูล
    const defaultDims = { width: 500, height: 500 };
    if (!referenceDimensionsRef.current) {
      referenceDimensionsRef.current = defaultDims;
    }
    return defaultDims;
  }, [mapDimensions.width, mapDimensions.height]);

  // โหลด mapWidthMeters และ mapHeightMeters จาก localStorage
  const mapWidthMeters = React.useMemo(() => {
    const savedMapSize = localStorage.getItem("mapSizeMeters");
    if (savedMapSize) {
      try {
        const parsed = JSON.parse(savedMapSize);
        return parsed.width || 50;
      } catch (e) {
        return 50;
      }
    }
    return data?.mapWidthMeters || 50;
  }, [data?.mapWidthMeters]);
  
  const mapHeightMeters = React.useMemo(() => {
    const savedMapSize = localStorage.getItem("mapSizeMeters");
    if (savedMapSize) {
      try {
        const parsed = JSON.parse(savedMapSize);
        return parsed.height || 50;
      } catch (e) {
        return 50;
      }
    }
    return data?.mapHeightMeters || 50;
  }, [data?.mapHeightMeters]);

  // ฟังก์ชัน meterToPixel เหมือนใน ManualOperate.jsx (ใช้สูตรเดียวกันทุกประการ)
  const meterToPixel = React.useCallback(
    (x, y) => {
      const mapWidth = effectiveMapDimensions.width || 1;
      const mapHeight = effectiveMapDimensions.height || 1;

      // scale แยกแกน X/Y เหมือน ManualOperate
      // ใช้ scale จาก localStorage (ที่ calibrate แล้ว) หรือคำนวณจาก mapWidth/mapWidthMeters
      const fallbackScale =
        mapWidth > 0 && mapWidthMeters > 0
          ? mapWidth / mapWidthMeters
          : 1;
      const scaleX = mapScaleX || fallbackScale;
      const scaleY = mapScaleY || fallbackScale;

      // ใช้สูตรเดียวกันกับ meterToPixel ใน ManualOperate.jsx ทุกประการ
      // pixelX = originOffset.x + (x * scaleX)
      // pixelY = (mapHeight - originOffset.y) - (y * scaleY)
      const pixelX = originOffset.x + (x * scaleX);
      const pixelY = (mapHeight - originOffset.y) - (y * scaleY);

      return { pixelX, pixelY };
    },
    [effectiveMapDimensions.width, effectiveMapDimensions.height, mapScaleX, mapScaleY, originOffset.x, originOffset.y, mapWidthMeters]
  );

  // แปลง AGV list -> position บนรูป (logic ใกล้เคียง ManualOperate)
  const processedAgvs = React.useMemo(() => {
    if (!effectiveMapDimensions.width || !effectiveMapDimensions.height) return [];

    return agvs
      .map((agv) => {
        const pos = agv?.position || agv?.pose || {
          x: agv?.x,
          y: agv?.y,
          theta: agv?.theta || agv?.yaw || agv?.angle || 0,
        };

        if (!Number.isFinite(pos?.x) || !Number.isFinite(pos?.y)) return null;

        // ใช้ข้อมูลตำแหน่งเดียวกันกับ ManualOperate
        const { pixelX, pixelY } = meterToPixel(pos.x, pos.y);
        
        // เพิ่ม offset จาก config (ถ้ามี) เพื่อปรับตำแหน่งให้ตรงกับ ManualOperate
        // ถ้า offset เป็น null หรือ undefined ให้ใช้ 0
        const offsetX = (data?.config?.offsetX !== undefined && data?.config?.offsetX !== null) ? data.config.offsetX : 0;
        const offsetY = (data?.config?.offsetY !== undefined && data?.config?.offsetY !== null) ? data.config.offsetY : 0;
        const adjustedPixelX = pixelX + offsetX;
        const adjustedPixelY = pixelY + offsetY;

        let theta = pos.theta || 0;
        if (Math.abs(theta) < 6.28) {
          theta = (theta * 180) / Math.PI;
        }
        theta = theta + 180;
        theta = ((theta % 360) + 360) % 360;

        const isOffline =
          agv?.state === "offline" ||
          agv?.isPowerOff === true ||
          agv?.powerOff === true ||
          (agv?.lastMessageTime &&
            Date.now() - new Date(agv.lastMessageTime).getTime() > 60000);

        let stateText = agv?.state || "unknown";
        if (agv?.workState !== undefined) {
          const workStates = {
            0: "Idle",
            1: "Working",
            2: "Charging",
            3: "Error",
            4: "Maintenance",
          };
          stateText = workStates[agv.workState] || `State ${agv.workState}`;
        }

        const percentX = (adjustedPixelX / effectiveMapDimensions.width) * 100;
        const percentY = (adjustedPixelY / effectiveMapDimensions.height) * 100;

        return {
          id: agv?.id ?? agv?.name ?? `agv-${Math.random()}`,
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
          percentX: Math.max(0, Math.min(100, percentX)),
          percentY: Math.max(0, Math.min(100, percentY)),
          originalX: pos.x,
          originalY: pos.y,
          theta,
        };
      })
      .filter(Boolean);
  }, [agvs, effectiveMapDimensions.width, effectiveMapDimensions.height, meterToPixel]);

  // อ่าน config สำหรับการแสดงผล
  const showMapImage = data?.config?.showMapImage !== undefined ? data.config.showMapImage : true;
  const showAgvIcons = data?.config?.showAgvIcons !== undefined ? data.config.showAgvIcons : true;

  return (
    <div className={`monitor-node map-node ${selected ? "selected" : ""} ${isRunning ? "running" : ""}`}>
      <div className="monitor-node-header">
        <span className="monitor-node-icon">
          <HiOutlineMap size={18} />
        </span>
        <span className="monitor-node-title">Map</span>
        {isRunning && <span className="monitor-node-running-indicator">●</span>}
      </div>
      <div className="monitor-node-content">
        <div className="map-container" style={{
          // ใช้ขนาดอ้างอิงเพื่อรักษาขนาด node ให้คงที่แม้เมื่อปิดแสดงรูปภาพ
          minWidth: effectiveMapDimensions.width ? `${effectiveMapDimensions.width}px` : undefined,
          minHeight: effectiveMapDimensions.height ? `${effectiveMapDimensions.height}px` : undefined,
        }}>
          {/* โหลดรูปภาพเสมอเพื่อเก็บขนาดอ้างอิง แต่ซ่อนเมื่อ showMapImage เป็น false */}
          <img
            src={mapImage}
            alt="Map"
            className="map-image"
            style={{
              display: showMapImage ? 'block' : 'none',
            }}
            onLoad={(e) => {
              const img = e.target;
              if (img.naturalWidth && img.naturalHeight) {
                const newDims = {
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                };
                setMapDimensions(newDims);
                // เก็บขนาดอ้างอิงเพื่อใช้เมื่อปิดแสดงรูปภาพ
                referenceDimensionsRef.current = newDims;
              }
            }}
          />
          {/* แสดง AGV Icons ตาม config */}
          {showAgvIcons && processedAgvs.map((agv) => (
            <div
              key={agv.id}
              className="agv-marker"
              style={{
                left: `${agv.percentX}%`,
                top: `${agv.percentY}%`,
                transform: `rotate(${agv.theta}deg)`,
              }}
              title={`${agv.label} - ${agv.state}`}
            >
              <img
                src="/assets/SLIM/auto.png"
                alt={agv.label}
                className={`agv-icon-image ${agv.offline ? "offline" : ""}`}
              />
            </div>
          ))}
        </div>
        {data.onEdit && (
          <button
            className="monitor-node-edit-btn"
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
      </div>
    </div>
  );
});
MapNode.displayName = "MapNode";

// Label Node Component - แสดงข้อความอย่างเดียว
export const LabelNode = memo(({ data, selected, id }) => {
  const isRunning = data?.isRunning || false;
  const nodeId = id || data?.id;
  const text = data?.config?.text || "Label";
  const fontSize = data?.config?.fontSize || 16;
  const isBold = data?.config?.bold || false;
  const color = data?.config?.color || "#e5e7eb";
  const align = data?.config?.align || "center";

  return (
    <div className={`monitor-node label-node ${selected ? "selected" : ""} ${isRunning ? "running" : ""}`}>
      <div className="monitor-node-header">
        <span className="monitor-node-icon">
          <HiOutlineDocumentText size={18} />
        </span>
        <span className="monitor-node-title">Label</span>
        {isRunning && <span className="monitor-node-running-indicator">●</span>}
      </div>
      <div className="monitor-node-content">
        <div
          className="label-text"
          style={{
            fontSize: `${fontSize}px`,
            fontWeight: isBold ? "700" : "400",
            color,
            textAlign: align,
          }}
        >
          {text}
        </div>
        {data.onEdit && (
          <button
            className="monitor-node-edit-btn"
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
      </div>
    </div>
  );
});
LabelNode.displayName = "LabelNode";

// Battery Node Component - แสดงค่า battery เป็นเปอร์เซ็นต์
export const BatteryNode = memo(({ data, selected, id }) => {
  const isRunning = data?.isRunning || false;
  const nodeId = id || data?.id;
  const label = data?.config?.label || "Battery";
  const agvId = data?.config?.agvId || "";
  const batteryValue = data?.value !== undefined && data?.value !== null ? Number(data.value) : null;
  
  // แสดงค่า battery เป็นเปอร์เซ็นต์
  const displayValue = batteryValue !== null ? `${Math.round(batteryValue)}%` : "---";
  
  // กำหนดสีตามระดับ battery
  const getBatteryColor = (value) => {
    if (value === null || value === undefined) return "#6b7280";
    if (value >= 50) return "#10b981"; // เขียว
    if (value >= 20) return "#f59e0b"; // ส้ม
    return "#ef4444"; // แดง
  };
  
  const batteryColor = getBatteryColor(batteryValue);

  return (
    <div className={`monitor-node battery-node ${selected ? "selected" : ""} ${isRunning ? "running" : ""}`}>
      <div className="monitor-node-header">
        <span className="monitor-node-icon">
          <HiOutlineBattery100 size={18} />
        </span>
        <span className="monitor-node-title">{label}</span>
        {isRunning && <span className="monitor-node-running-indicator">●</span>}
      </div>
      <div className="monitor-node-content">
        <div className="battery-display">
          <div className="battery-value" style={{ color: batteryColor }}>
            {displayValue}
          </div>
          {agvId && (
            <div className="battery-agv-id">AGV: {agvId}</div>
          )}
          {/* Battery bar indicator */}
          <div className="battery-bar-container">
            <div 
              className="battery-bar-fill"
              style={{
                width: batteryValue !== null ? `${Math.max(0, Math.min(100, batteryValue))}%` : "0%",
                backgroundColor: batteryColor,
              }}
            />
          </div>
        </div>
        {data.onEdit && (
          <button
            className="monitor-node-edit-btn"
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
      </div>
    </div>
  );
});
BatteryNode.displayName = "BatteryNode";

// Date Node Component - แสดงเวลาและวันที่
export const DateNode = memo(({ data, selected, id }) => {
  const isRunning = data?.isRunning || false;
  const nodeId = id || data?.id;
  const label = data?.config?.label || "Date & Time";
  const dateTime = data?.value || new Date().toLocaleString("th-TH");
  
  // Get config values with defaults
  const fontSize = data?.config?.fontSize || 16;
  const isBold = data?.config?.bold || false;
  const textColor = data?.config?.color || "#e5e7eb";
  const backgroundColor = data?.config?.backgroundColor || "transparent";
  const align = data?.config?.align || "center";

  return (
    <div className={`monitor-node date-node ${selected ? "selected" : ""} ${isRunning ? "running" : ""}`}>
      <div className="monitor-node-header">
        <span className="monitor-node-icon">
          <HiOutlineCalendar size={18} />
        </span>
        <span className="monitor-node-title">{label}</span>
        {isRunning && <span className="monitor-node-running-indicator">●</span>}
      </div>
      <div className="monitor-node-content">
        <div 
          className="date-display" 
          style={{
            padding: "12px",
            textAlign: align,
            fontSize: `${fontSize}px`,
            fontWeight: isBold ? "700" : "400",
            color: textColor,
            backgroundColor: backgroundColor !== "transparent" ? backgroundColor : undefined,
            borderRadius: backgroundColor !== "transparent" ? "4px" : undefined,
            minHeight: "40px",
            display: "flex",
            alignItems: "center",
            justifyContent: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
          }}
        >
          <div className="date-value">
            {dateTime}
          </div>
        </div>
        {data.onEdit && (
          <button
            className="monitor-node-edit-btn"
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
      </div>
    </div>
  );
});
DateNode.displayName = "DateNode";


