import { useCallback } from "react";
import { 
  HiOutlineBell,
  HiOutlineTruck,
  HiOutlineCog6Tooth,
  HiOutlineSignal,
  HiOutlineCheckCircle
} from "react-icons/hi2";

const NODE_TYPES = [
  {
    type: "trigger",
    label: "Trigger",
    icon: HiOutlineBell,
    description: "Trigger from IOT device",
    color: "#dc2626",
  },
  {
    type: "move",
    label: "Move",
    icon: HiOutlineTruck,
    description: "Send AGV order",
    color: "#dc2626",
  },
  {
    type: "set",
    label: "Set",
    icon: HiOutlineCog6Tooth,
    description: "Set park status",
    color: "#dc2626",
  },
  {
    type: "iot",
    label: "IOT",
    icon: HiOutlineSignal,
    description: "Read IOT modbus data",
    color: "#dc2626",
  },
  {
    type: "check",
    label: "Check",
    icon: HiOutlineCheckCircle,
    description: "Check park status",
    color: "#dc2626",
  },
];

const NodePalette = ({ onAddNode, isRunning }) => {
  const handleDragStart = useCallback(
    (event, nodeType) => {
      event.dataTransfer.setData("application/reactflow", nodeType);
      event.dataTransfer.effectAllowed = "move";
    },
    []
  );

  return (
    <div className="node-palette">
      <div className="palette-header">
        <h3>Nodes</h3>
        <p className="palette-subtitle">ลากวางบนพื้นที่ Flow Editor</p>
      </div>
      <div className="palette-nodes">
        {NODE_TYPES.map((node) => (
          <div
            key={node.type}
            className={`palette-node ${isRunning ? "palette-node-disabled" : ""}`}
            draggable={!isRunning}
            onDragStart={
              isRunning ? undefined : (e) => handleDragStart(e, node.type)
            }
            style={{ borderLeftColor: "#ff3d3d" }}
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

export default NodePalette;


