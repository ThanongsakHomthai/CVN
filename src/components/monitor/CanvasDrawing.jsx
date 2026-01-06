import { useCallback, useRef, useEffect } from "react";

const CanvasDrawing = ({
  drawings = [],
  selectedTool,
  strokeColor = "#3b82f6",
  strokeWidth = 2,
  onDrawingAdd,
  reactFlowInstance,
  isRunning,
}) => {
  const svgRef = useRef(null);
  const isDrawingRef = useRef(false);
  const currentPathRef = useRef(null);
  const startPointRef = useRef(null);
  const currentDrawingRef = useRef(null);

  // Get SVG container bounds
  const getSVGBounds = useCallback(() => {
    if (!svgRef.current) return null;
    return svgRef.current.getBoundingClientRect();
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (isRunning || !selectedTool || !reactFlowInstance) return;
    
    const rect = getSVGBounds();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const flowPos = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });

    isDrawingRef.current = true;
    startPointRef.current = { screenX, screenY, flowX: flowPos.x, flowY: flowPos.y };

    if (selectedTool === "pen") {
      currentPathRef.current = `M ${screenX} ${screenY}`;
      currentDrawingRef.current = {
        type: "path",
        path: currentPathRef.current,
        color: strokeColor,
        strokeWidth: strokeWidth,
        points: [{ x: flowPos.x, y: flowPos.y }],
      };
    } else if (selectedTool === "line") {
      currentDrawingRef.current = {
        type: "line",
        x1: screenX,
        y1: screenY,
        x2: screenX,
        y2: screenY,
        color: strokeColor,
        strokeWidth: strokeWidth,
        startPoint: { x: flowPos.x, y: flowPos.y },
        endPoint: { x: flowPos.x, y: flowPos.y },
      };
    } else if (selectedTool === "rectangle") {
      currentDrawingRef.current = {
        type: "rectangle",
        x: screenX,
        y: screenY,
        rectWidth: 0,
        rectHeight: 0,
        color: strokeColor,
        strokeWidth: strokeWidth,
        fill: "none",
        startPoint: { x: flowPos.x, y: flowPos.y },
        endPoint: { x: flowPos.x, y: flowPos.y },
      };
    } else if (selectedTool === "circle") {
      currentDrawingRef.current = {
        type: "circle",
        cx: screenX,
        cy: screenY,
        r: 0,
        color: strokeColor,
        strokeWidth: strokeWidth,
        fill: "none",
        center: { x: flowPos.x, y: flowPos.y },
        radius: 0,
      };
    } else if (selectedTool === "text") {
      const text = prompt("Enter text:");
      if (text) {
        const drawing = {
          type: "text",
          x: screenX,
          y: screenY,
          text: text,
          color: strokeColor,
          fontSize: strokeWidth * 5,
          flowX: flowPos.x,
          flowY: flowPos.y,
        };
        onDrawingAdd(drawing);
      }
      isDrawingRef.current = false;
      return;
    } else if (selectedTool === "eraser") {
      // Find and remove drawing at this point
      const clickedDrawing = drawings.find((drawing) => {
        if (drawing.type === "path") {
          return drawing.points?.some((p) => {
            const screen = reactFlowInstance.flowToScreenPosition({ x: p.x, y: p.y });
            const rect = getSVGBounds();
            if (!rect) return false;
            const screenXInSVG = screen.x - rect.left;
            const screenYInSVG = screen.y - rect.top;
            const dist = Math.sqrt(
              Math.pow(screenXInSVG - screenX, 2) + Math.pow(screenYInSVG - screenY, 2)
            );
            return dist < 10;
          });
        } else if (drawing.type === "line") {
          const dist = distanceToLine(
            screenX,
            screenY,
            drawing.x1,
            drawing.y1,
            drawing.x2,
            drawing.y2
          );
          return dist < 10;
        }
        return false;
      });
      if (clickedDrawing) {
        onDrawingAdd(null, clickedDrawing.id);
      }
      isDrawingRef.current = false;
      return;
    }
  }, [selectedTool, strokeColor, strokeWidth, reactFlowInstance, isRunning, drawings, getSVGBounds, onDrawingAdd]);

  const handleMouseMove = useCallback((e) => {
    if (!isDrawingRef.current || !currentDrawingRef.current || !reactFlowInstance) return;

    const rect = getSVGBounds();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const flowPos = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });

    if (selectedTool === "pen") {
      currentPathRef.current += ` L ${screenX} ${screenY}`;
      currentDrawingRef.current.path = currentPathRef.current;
      currentDrawingRef.current.points.push({ x: flowPos.x, y: flowPos.y });
    } else if (selectedTool === "line") {
      currentDrawingRef.current.x2 = screenX;
      currentDrawingRef.current.y2 = screenY;
      currentDrawingRef.current.endPoint = { x: flowPos.x, y: flowPos.y };
    } else if (selectedTool === "rectangle") {
      const width = screenX - startPointRef.current.screenX;
      const height = screenY - startPointRef.current.screenY;
      currentDrawingRef.current.x = Math.min(startPointRef.current.screenX, screenX);
      currentDrawingRef.current.y = Math.min(startPointRef.current.screenY, screenY);
      currentDrawingRef.current.rectWidth = Math.abs(width);
      currentDrawingRef.current.rectHeight = Math.abs(height);
      currentDrawingRef.current.endPoint = { x: flowPos.x, y: flowPos.y };
    } else if (selectedTool === "circle") {
      const radius = Math.sqrt(
        Math.pow(screenX - startPointRef.current.screenX, 2) +
        Math.pow(screenY - startPointRef.current.screenY, 2)
      );
      currentDrawingRef.current.r = radius;
      currentDrawingRef.current.radius = radius / reactFlowInstance.getZoom();
    }
  }, [selectedTool, reactFlowInstance]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawingRef.current || !currentDrawingRef.current) return;

    if (selectedTool !== "text" && selectedTool !== "eraser") {
      const drawing = {
        ...currentDrawingRef.current,
        id: `drawing-${Date.now()}-${Math.random()}`,
      };
      onDrawingAdd(drawing);
    }

    isDrawingRef.current = false;
    currentPathRef.current = null;
    currentDrawingRef.current = null;
    startPointRef.current = null;
  }, [selectedTool, onDrawingAdd]);

  // Helper function to calculate distance to line
  const distanceToLine = (px, py, x1, y1, x2, y2) => {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    let xx, yy;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }
    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Get SVG dimensions from ReactFlow viewport
  useEffect(() => {
    if (!svgRef.current || !reactFlowInstance) return;

    const updateSVGSize = () => {
      const viewport = reactFlowInstance.getViewport();
      const bounds = reactFlowInstance.getBounds();
      // Set SVG to cover entire viewport
      if (svgRef.current) {
        svgRef.current.setAttribute("width", "100%");
        svgRef.current.setAttribute("height", "100%");
      }
    };

    updateSVGSize();
    const interval = setInterval(updateSVGSize, 100);
    return () => clearInterval(interval);
  }, [reactFlowInstance]);

  if (!selectedTool || isRunning) {
    return null;
  }

  return (
    <svg
      ref={svgRef}
      className="canvas-drawing-overlay"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: selectedTool ? "auto" : "none",
        zIndex: 10,
      }}
    >
      {/* Render existing drawings */}
      {drawings.map((drawing) => {
        if (drawing.type === "path") {
          return (
            <path
              key={drawing.id}
              d={drawing.path}
              stroke={drawing.color}
              strokeWidth={drawing.strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        } else if (drawing.type === "line") {
          return (
            <line
              key={drawing.id}
              x1={drawing.x1}
              y1={drawing.y1}
              x2={drawing.x2}
              y2={drawing.y2}
              stroke={drawing.color}
              strokeWidth={drawing.strokeWidth}
              strokeLinecap="round"
            />
          );
        } else if (drawing.type === "rectangle") {
          return (
            <rect
              key={drawing.id}
              x={drawing.x}
              y={drawing.y}
              width={drawing.rectWidth}
              height={drawing.rectHeight}
              stroke={drawing.color}
              strokeWidth={drawing.strokeWidth}
              fill={drawing.fill || "none"}
            />
          );
        } else if (drawing.type === "circle") {
          return (
            <circle
              key={drawing.id}
              cx={drawing.cx}
              cy={drawing.cy}
              r={drawing.r}
              stroke={drawing.color}
              strokeWidth={drawing.strokeWidth}
              fill={drawing.fill || "none"}
            />
          );
        } else if (drawing.type === "text") {
          return (
            <text
              key={drawing.id}
              x={drawing.x}
              y={drawing.y}
              fill={drawing.color}
              fontSize={drawing.fontSize || 16}
              fontFamily="Arial, sans-serif"
            >
              {drawing.text}
            </text>
          );
        }
        return null;
      })}
    </svg>
  );
};

export default CanvasDrawing;

