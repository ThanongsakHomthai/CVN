import { useCallback } from "react";
import { 
  HiOutlineLightBulb,
  HiOutlineHashtag,
  HiOutlineCube,
  HiOutlineMap,
  HiOutlineDocumentText,
  HiOutlineBattery100,
  HiOutlineCalendar,
} from "react-icons/hi2";

const MONITOR_NODE_TYPES = [
  {
    type: "lamp",
    label: "Lamp",
    icon: HiOutlineLightBulb,
    description: "LED status display",
    color: "#ff3d3d",
  },
  {
    type: "counter",
    label: "Counter",
    icon: HiOutlineHashtag,
    description: "Display number",
    color: "#ff3d3d",
  },
  {
    type: "park",
    label: "Park",
    icon: HiOutlineCube,
    description: "Park status box",
    color: "#ff3d3d",
  },
  {
    type: "map",
    label: "Map",
    icon: HiOutlineMap,
    description: "Map with AGV positions",
    color: "#ff3d3d",
  },
  {
    type: "label",
    label: "Label",
    icon: HiOutlineDocumentText,
    description: "Label text display",
    color: "#ff3d3d",
  },
  {
    type: "battery",
    label: "Battery",
    icon: HiOutlineBattery100,
    description: "AGV battery percentage",
    color: "#ff3d3d",
  },
  {
    type: "date",
    label: "Date",
    icon: HiOutlineCalendar,
    description: "Date and time display",
    color: "#ff3d3d",
  },
];

const MonitorNodePalette = ({ onAddNode, isRunning }) => {
  const handleDragStart = useCallback(
    (event, nodeType) => {
      event.dataTransfer.setData("application/reactflow", nodeType);
      event.dataTransfer.effectAllowed = "move";
    },
    []
  );

  return (
    <div className="node-palette monitor-palette">
      <div className="palette-header">
        <h3>Monitor Nodes</h3>
        <p className="palette-subtitle">ลากวางบนพื้นที่ Monitor Canvas</p>
      </div>
      <div className="palette-nodes">
        {MONITOR_NODE_TYPES.map((node) => (
          <div
            key={node.type}
            className={`palette-node ${isRunning ? "palette-node-disabled" : ""}`}
            draggable={!isRunning}
            onDragStart={
              isRunning ? undefined : (e) => handleDragStart(e, node.type)
            }
            style={{ borderLeftColor: node.color }}
          >
            <span className="palette-node-icon">
              <node.icon size={20} />
            </span>
            <div className="palette-node-info">
              <div className="palette-node-label">{node.label}</div>
              <div className="palette-node-desc">{node.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MonitorNodePalette;

