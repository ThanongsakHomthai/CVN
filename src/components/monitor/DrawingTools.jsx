import { useState, useCallback, useRef, useEffect } from "react";
import {
  HiOutlinePencil,
  HiOutlineMinus,
  HiOutlineDocumentText,
  HiOutlineStop,
  HiOutlineCheckCircle,
} from "react-icons/hi2";
import { FaSquare, FaCircle, FaEraser } from "react-icons/fa";

const DRAWING_TOOLS = {
  pen: { icon: HiOutlinePencil, label: "Pen", color: "#3b82f6" },
  line: { icon: HiOutlineMinus, label: "Line", color: "#10b981" },
  rectangle: { icon: FaSquare, label: "Rectangle", color: "#f59e0b" },
  circle: { icon: FaCircle, label: "Circle", color: "#ef4444" },
  text: { icon: HiOutlineDocumentText, label: "Text", color: "#8b5cf6" },
  eraser: { icon: FaEraser, label: "Eraser", color: "#6b7280" },
};

const DrawingTools = ({ 
  isRunning, 
  onDrawingChange, 
  drawings = [], 
  selectedTool,
  onToolSelect,
  strokeColor = "#3b82f6",
  strokeWidth = 2,
  onColorChange,
  onWidthChange,
}) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState(null);
  const [startPoint, setStartPoint] = useState(null);
  const drawingRef = useRef(null);

  const handleToolSelect = (tool) => {
    if (isRunning) return;
    onToolSelect(tool);
  };

  return (
    <div className="drawing-tools">
      <div className="drawing-tools-header">
        <h4>Drawing Tools</h4>
      </div>
      <div className="drawing-tools-buttons">
        {Object.entries(DRAWING_TOOLS).map(([tool, config]) => (
          <button
            key={tool}
            className={`drawing-tool-btn ${selectedTool === tool ? "active" : ""}`}
            onClick={() => handleToolSelect(tool)}
            disabled={isRunning}
            title={config.label}
            style={{ borderLeftColor: config.color }}
          >
            <config.icon size={18} />
            <span>{config.label}</span>
          </button>
        ))}
      </div>
      {selectedTool && selectedTool !== "eraser" && (
        <div className="drawing-tools-options">
          <div className="drawing-option-group">
            <label>Color</label>
            <input
              type="color"
              value={strokeColor}
              onChange={(e) => onColorChange(e.target.value)}
              disabled={isRunning}
            />
          </div>
          <div className="drawing-option-group">
            <label>Width</label>
            <input
              type="number"
              min="1"
              max="20"
              value={strokeWidth}
              onChange={(e) => onWidthChange(parseInt(e.target.value) || 2)}
              disabled={isRunning}
            />
          </div>
        </div>
      )}
      {drawings.length > 0 && (
        <div className="drawing-tools-actions">
          <button
            className="drawing-action-btn"
            onClick={() => {
              if (window.confirm("คุณต้องการลบการวาดทั้งหมดหรือไม่?")) {
                onDrawingChange([]);
              }
            }}
            disabled={isRunning}
          >
            🗑️ Clear All
          </button>
        </div>
      )}
    </div>
  );
};

export default DrawingTools;

