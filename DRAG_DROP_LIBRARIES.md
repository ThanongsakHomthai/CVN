# Libraries และ Packages ที่ใช้สำหรับ Drag-and-Drop และ Canvas

## 📦 Libraries หลัก

### 1. **ReactFlow** (reactflow)
- **Version**: `^11.11.4`
- **Website**: https://reactflow.dev/
- **GitHub**: https://github.com/wbkd/react-flow
- **License**: MIT (Open Source)

#### สิ่งที่ ReactFlow ให้:
✅ **Canvas/Flow Editor** - พื้นที่สำหรับวาด flow diagram
✅ **Drag-and-Drop Nodes** - ลาก nodes มาวางบน canvas
✅ **Node Connections (Edges)** - ลากเส้นเชื่อมต่อระหว่าง nodes
✅ **Custom Node Components** - สร้าง custom node ได้เอง
✅ **Zoom, Pan, Controls** - ซูม, เลื่อน, และควบคุม canvas
✅ **MiniMap** - แผนที่ย่อของ flow
✅ **Background Grid** - พื้นหลังแบบตาราง
✅ **Handles** - จุดเชื่อมต่อ (input/output handles)

#### ตัวอย่างการใช้งาน:
```javascript
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
```

---

### 2. **HTML5 Drag and Drop API** (Native Browser API)
- **Built-in** - ไม่ต้องติดตั้ง library เพิ่ม
- **License**: มาตรฐานเว็บ

#### สิ่งที่ใช้สำหรับ:
✅ **Drag from Palette** - ลาก node จาก palette ไปยัง canvas

#### ตัวอย่างการใช้งาน:
```javascript
// ใน NodePalette.jsx
<div
  draggable
  onDragStart={(e) => {
    e.dataTransfer.setData("application/reactflow", nodeType);
    e.dataTransfer.effectAllowed = "move";
  }}
>

// ใน AutoConditionFlow.jsx
const onDragOver = (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
};

const onDrop = (event) => {
  event.preventDefault();
  const type = event.dataTransfer.getData("application/reactflow");
  // สร้าง node ใหม่ที่ตำแหน่งที่วาง
};
```

---

## 📚 Libraries อื่นๆ ที่เกี่ยวข้อง

### 3. **React** (^18.3.1)
- Framework หลักสำหรับสร้าง UI components
- ใช้ hooks: `useState`, `useEffect`, `useCallback`, `useRef`

### 4. **React Router DOM** (^7.9.6)
- สำหรับ routing และ navigation
- ใช้ `useLocation` เพื่อตรวจสอบ route changes

---

## 🔧 Features ที่ใช้จาก ReactFlow

### 1. **Node Types**
```javascript
const nodeTypes = {
  trigger: TriggerNode,
  move: MoveNode,
  set: SetNode,
  debug: DebugNode,
};
```

### 2. **State Management**
```javascript
const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
```

### 3. **Edge Connections**
```javascript
const onConnect = useCallback((params) => {
  setEdges((eds) =>
    addEdge(
      {
        ...params,
        markerEnd: { type: MarkerType.ArrowClosed },
        animated: true,
      },
      eds
    )
  );
}, [setEdges]);
```

### 4. **Custom Node Components**
```javascript
import { Handle, Position } from "reactflow";

export const TriggerNode = ({ data, selected, id }) => {
  return (
    <div className="custom-node">
      <Handle type="source" position={Position.Right} id="output" />
      {/* Node content */}
    </div>
  );
};
```

---

## 🌟 Alternative Libraries (ถ้าจะเปลี่ยน)

### 1. **React-DnD** (React Drag and Drop)
- สำหรับ drag-and-drop ทั่วไป
- Website: https://react-dnd.github.io/react-dnd/

### 2. **D3.js**
- สำหรับ visualization และ custom canvas
- Website: https://d3js.org/

### 3. **JointJS / Rappid**
- สำหรับ diagramming (มี license fee สำหรับ commercial)
- Website: https://www.jointjs.com/

### 4. **Mermaid**
- สำหรับ flowchart/diagram จาก text
- Website: https://mermaid.js.org/

### 5. **Cytoscape.js**
- สำหรับ graph visualization
- Website: https://js.cytoscape.org/

---

## 💡 สรุป

**Libraries หลักที่ใช้:**
1. ✅ **ReactFlow** - สำหรับ canvas และ node editor (สำคัญที่สุด)
2. ✅ **HTML5 Drag and Drop API** - สำหรับการลากจาก palette
3. ✅ **React** - Framework หลัก

**ReactFlow = Open Source และ Free!** 🎉
- MIT License
- ไม่มีค่าใช้จ่าย
- Community support ดี
- Documentation ครบถ้วน


