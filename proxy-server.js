import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import mysql from "mysql2/promise";
import { ModbusTCPClient } from "jsmodbus";
import { Socket } from "net";

const app = express();

const LOCAL_FRONTEND_ORIGIN = "http://localhost:5173";
const REMOTE_ORDERS_HOST = "http://192.168.1.251:6546";
const LOCAL_AGVS_HOST = "http://127.0.0.1:6546";
const DEFAULT_IOT_INPUTS = 4;
const DEFAULT_IOT_OUTPUTS = 4;

// Middleware to parse JSON
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", LOCAL_FRONTEND_ORIGIN);
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,Accept,Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    console.log(`CORS preflight: ${req.method} ${req.path}`);
    return res.sendStatus(204);
  }
  
  console.log(`Incoming request: ${req.method} ${req.path}`);
  next();
});

// MySQL Database Configuration
const dbConfig = {
  host: "localhost",
  user: "root",
  password: "123456",
  database: "cvn",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Create MySQL connection pool
const pool = mysql.createPool(dbConfig);

const ensureIotTable = async () => {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS cvn_data_iot (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ip_address VARCHAR(255) NOT NULL,
        protocol VARCHAR(50) NOT NULL,
        port INT NOT NULL,
        start_address_input INT DEFAULT 0,
        start_address_output INT DEFAULT 0,
        slave_id INT DEFAULT 1,
        modbus_function VARCHAR(50) DEFAULT 'readCoils',
        num_inputs INT DEFAULT ${DEFAULT_IOT_INPUTS},
        num_outputs INT DEFAULT ${DEFAULT_IOT_OUTPUTS},
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check if id column has AUTO_INCREMENT, if not, alter it
    try {
      const [idColumnInfo] = await pool.execute(
        `SELECT COLUMN_TYPE, EXTRA 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'cvn_data_iot' 
         AND COLUMN_NAME = 'id'`,
        [dbConfig.database]
      );

      if (idColumnInfo.length > 0 && (!idColumnInfo[0].EXTRA || !idColumnInfo[0].EXTRA.includes('auto_increment'))) {
        console.log("⚠ Fixing id column: Adding AUTO_INCREMENT");
        try {
          // Attempt to fix the column even if table has data
          await pool.execute(`ALTER TABLE cvn_data_iot MODIFY id INT AUTO_INCREMENT PRIMARY KEY`);
          console.log("✓ Fixed id column with AUTO_INCREMENT");
        } catch (fixError) {
          console.error("❌ Failed to fix id column automatically:", fixError.message);
          console.error("Please manually run this SQL:");
          console.error("ALTER TABLE cvn_data_iot MODIFY id INT AUTO_INCREMENT PRIMARY KEY;");
        }
      } else {
        console.log("✓ cvn_data_iot table ensured (id has AUTO_INCREMENT)");
      }
    } catch (alterError) {
      console.error("Error checking/fixing id column:", alterError.message);
    }

    const columnsToEnsure = [
      { name: "start_address_input", definition: "INT DEFAULT 0" },
      { name: "start_address_output", definition: "INT DEFAULT 0" },
      { name: "slave_id", definition: "INT DEFAULT 1" },
      {
        name: "modbus_function",
        definition: "VARCHAR(50) DEFAULT 'readCoils'",
      },
      { name: "num_inputs", definition: `INT DEFAULT ${DEFAULT_IOT_INPUTS}` },
      { name: "num_outputs", definition: `INT DEFAULT ${DEFAULT_IOT_OUTPUTS}` },
      {
        name: "created_at",
        definition: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
      },
    ];

    for (const column of columnsToEnsure) {
      // Check if column exists - cannot use placeholder in SHOW COLUMNS LIKE
      // Use INFORMATION_SCHEMA instead which supports parameters
      const [exists] = await pool.execute(
        `SELECT COLUMN_NAME 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'cvn_data_iot' 
         AND COLUMN_NAME = ?`,
        [dbConfig.database, column.name]
      );

      if (exists.length === 0) {
        console.log(
          `Adding missing column ${column.name} to cvn_data_iot table`
        );
        // ALTER TABLE doesn't support placeholders for column names, use template literal
        // But we sanitize column.name to be safe (it's from our controlled array)
        await pool.execute(
          `ALTER TABLE cvn_data_iot ADD COLUMN \`${column.name}\` ${column.definition}`
        );
      }
    }

    // Force fix id column - try to ensure AUTO_INCREMENT is set (always try this)
    try {
      await pool.execute(`ALTER TABLE cvn_data_iot MODIFY COLUMN id INT AUTO_INCREMENT PRIMARY KEY`);
      console.log("✓ Force fix: id column verified/set to AUTO_INCREMENT");
    } catch (forceFixError) {
      
    }
  } catch (error) {
    console.error("Error ensuring cvn_data_iot table:", error.message);
  }
};

ensureIotTable();

// Ensure cvn_data_monitor table exists (for storing monitor nodes)
const ensureMonitorTable = async () => {
  try {
    // Try JSON type first (MySQL 5.7.8+)
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS cvn_data_monitor (
          flow_id VARCHAR(255) PRIMARY KEY,
          nodes_data JSON,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      console.log("✓ cvn_data_monitor table ensured (with JSON type)");
    } catch (jsonError) {
      // Fallback to TEXT type for older MySQL versions
      console.log("⚠ JSON type not supported, using TEXT instead");
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS cvn_data_monitor (
          flow_id VARCHAR(255) PRIMARY KEY,
          nodes_data TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      console.log("✓ cvn_data_monitor table ensured (with TEXT type)");
    }
  } catch (error) {
    console.error("Error ensuring cvn_data_monitor table:", error.message);
  }
};

// Ensure cvn_data_node table exists (for storing flow nodes/edges)
const ensureNodeTable = async () => {
  try {
    // Try to create table with JSON type first (MySQL 5.7+)
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS cvn_data_node (
          id INT AUTO_INCREMENT PRIMARY KEY,
          flow_id VARCHAR(255) DEFAULT 'default',
          nodes_data JSON,
          edges_data JSON,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_flow_id (flow_id)
        )
      `);
      console.log("✓ cvn_data_node table ensured (with JSON type)");
    } catch (jsonError) {
      // If JSON type fails, try with TEXT type (for older MySQL versions)
      console.log("JSON type not supported, trying TEXT type...");
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS cvn_data_node (
          id INT AUTO_INCREMENT PRIMARY KEY,
          flow_id VARCHAR(255) DEFAULT 'default',
          nodes_data TEXT,
          edges_data TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_flow_id (flow_id)
        )
      `);
      console.log("✓ cvn_data_node table ensured (with TEXT type)");
    }
  } catch (error) {
    console.error("Error ensuring cvn_data_node table:", error.message);
    console.error("Error stack:", error.stack);
  }
};

ensureNodeTable();
ensureMonitorTable();

// Ensure cvn_data_logs table exists
const ensureLogsTable = async () => {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS cvn_data_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        url VARCHAR(500) NOT NULL,
        type VARCHAR(100) NOT NULL,
        source TEXT,
        destination TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_created_at (created_at),
        INDEX idx_type (type)
      )
    `);
    console.log("✓ cvn_data_logs table ensured");
  } catch (error) {
    console.error("Error ensuring cvn_data_logs table:", error.message);
    console.error("Error stack:", error.stack);
  }
};

ensureLogsTable();

// Helper function to determine log type from URL
const getLogTypeFromUrl = (url) => {
  const urlLower = url.toLowerCase();
  if (urlLower.endsWith('orders')) {
    return 'Create order';
  } else if (urlLower.endsWith('ordermodifications')) {
    return 'Cancel order';
  }
  return 'Unknown';
};

// Middleware to log POST requests to /orders and /orderModifications
const logPostRequest = async (req, res, next) => {
  // Only log POST requests
  if (req.method !== 'POST') {
    return next();
  }

  try {
    const url = req.originalUrl || req.path;
    const logType = getLogTypeFromUrl(url);
    const body = req.body || {};
    
    // Extract source and destination from request body
    // สำหรับ orders: มี source และ destination โดยตรง
    // สำหรับ orderModifications: ไม่มี source/destination โดยตรง มีแค่ orderId
    const source = body.source || null;
    const destination = body.destination || null;
    
    // Save to database - เก็บเป็น string แบบธรรมดาไม่ใช่ JSON string
    await pool.execute(
      `INSERT INTO cvn_data_logs (url, type, source, destination) 
       VALUES (?, ?, ?, ?)`,
      [
        url,
        logType,
        source || null,
        destination || null,
      ]
    );
    
    console.log(`[LOG] ${logType}: ${url} - source: ${source || 'N/A'}, destination: ${destination || 'N/A'}`);
  } catch (error) {
    // Don't block the request if logging fails
    console.error('Error logging request:', error.message);
    console.error('Error stack:', error.stack);
  }
  
  // Continue to next middleware (proxy)
  next();
};

// API Routes for Logs
app.get("/api/logs", async (req, res) => {
  console.log("GET /api/logs - Request received");
  try {
    const { limit = 100, offset = 0 } = req.query;
    
    const [rows] = await pool.execute(
      `SELECT id, url, type, source, destination, created_at 
       FROM cvn_data_logs 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [parseInt(limit), parseInt(offset)]
    );
    
    // Return logs directly (source and destination are already stored as plain text)
    const logs = rows.map((row) => ({
      id: row.id,
      url: row.url,
      type: row.type,
      source: row.source || null,
      destination: row.destination || null,
      created_at: row.created_at,
    }));
    
    console.log(`GET /api/logs - Returning ${logs.length} logs`);
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error("Error fetching logs:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// API Routes for Park Management (must be before proxy middleware)

// GET all parks (optionally filter by group)
app.get("/api/parks", async (req, res) => {
  console.log("GET /api/parks - Request received");
  const { group } = req.query;
  try {
    let rows;
    if (group) {
      const [filtered] = await pool.execute(
        "SELECT external_id, use_state, groups, external_name FROM cvn_data_park WHERE groups = ? ORDER BY external_id DESC",
        [group]
      );
      rows = filtered;
      console.log(
        `GET /api/parks - Returning ${rows.length} parks for group=${group}`
      );
    } else {
      const [all] = await pool.execute(
        "SELECT external_id, use_state, groups, external_name FROM cvn_data_park ORDER BY external_id DESC"
      );
      rows = all;
      console.log(`GET /api/parks - Returning ${rows.length} parks`);
    }

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching parks:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET single park by group + external_name
app.get("/api/parks/by-group", async (req, res) => {
  const { group, externalName } = req.query;
  console.log(
    "GET /api/parks/by-group - Request received",
    "group=",
    group,
    "externalName=",
    externalName
  );

  if (!group || !externalName) {
    return res.status(400).json({
      success: false,
      error: "group and externalName are required",
    });
  }

  try {
    const [rows] = await pool.execute(
      "SELECT external_id, use_state, groups, external_name FROM cvn_data_park WHERE groups = ? AND external_name = ? LIMIT 1",
      [group, externalName]
    );

    if (rows.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: "Park not found",
      });
    }

    res.json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    console.error("Error fetching park by group/externalName:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST insert new park
app.post("/api/parks", async (req, res) => {
  console.log("POST /api/parks - Request received", req.body);
  try {
    const { park, group } = req.body;

    if (!park || !group) {
      return res.status(400).json({
        success: false,
        error: "Park and Group are required",
      });
    }

    const [result] = await pool.execute(
      "INSERT INTO cvn_data_park (external_name, groups) VALUES (?, ?)",
      [park, group]
    );

    console.log(`POST /api/parks - Inserted park with id ${result.insertId}`);
    res.json({
      success: true,
      message: "Park inserted successfully",
      id: result.insertId,
    });
  } catch (error) {
    console.error("Error inserting park:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});


// IOT Modules CRUD
app.get("/api/iot/modules", async (req, res) => {
  console.log("GET /api/iot/modules - Fetching modules");
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM cvn_data_iot ORDER BY id DESC"
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching IOT modules:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post("/api/iot/modules", async (req, res) => {
  console.log("POST /api/iot/modules - Request received", req.body);
  try {
    // Ensure id column has AUTO_INCREMENT before inserting
    try {
      await pool.execute(`ALTER TABLE cvn_data_iot MODIFY COLUMN id INT AUTO_INCREMENT PRIMARY KEY`);
      console.log("✓ Verified: id column has AUTO_INCREMENT");
    } catch (alterError) {
      // Ignore error if column is already correct
      console.log("ℹ id column check (may already be correct):", alterError.message);
    }
    
    const {
      ipAddress,
      protocol,
      port,
      startAddressInput,
      startAddressOutput,
      slaveId,
      modbusFunction,
      numInputs,
      numOutputs,
    } = req.body;

    if (!ipAddress || !protocol || !port) {
      return res.status(400).json({
        success: false,
        error: "IP Address, protocol, and port are required",
      });
    }

    const normalizedProtocol = protocol.toString().toLowerCase();
    const normalizedPort = parseInt(port) || 0;
    const normalizedStartInput =
      startAddressInput !== null && startAddressInput !== undefined
        ? parseInt(startAddressInput)
        : null;
    const normalizedStartOutput =
      startAddressOutput !== null && startAddressOutput !== undefined
        ? parseInt(startAddressOutput)
        : null;
    const normalizedSlave =
      slaveId !== null && slaveId !== undefined ? parseInt(slaveId) : null;
    const normalizedInputs =
      numInputs !== null && numInputs !== undefined
        ? parseInt(numInputs)
        : DEFAULT_IOT_INPUTS;
    const normalizedOutputs =
      numOutputs !== null && numOutputs !== undefined
        ? parseInt(numOutputs)
        : DEFAULT_IOT_OUTPUTS;

    const columns = ["ip_address", "protocol", "port"];
    const values = [ipAddress.trim(), normalizedProtocol, normalizedPort];

    const extraColumns = [];
    const extraValues = [];

    if (normalizedStartInput !== null && normalizedStartInput !== undefined) {
      extraColumns.push("start_address_input");
      extraValues.push(normalizedStartInput);
    }

    if (normalizedStartOutput !== null && normalizedStartOutput !== undefined) {
      extraColumns.push("start_address_output");
      extraValues.push(normalizedStartOutput);
    }

    if (normalizedSlave !== null && normalizedSlave !== undefined) {
      extraColumns.push("slave_id");
      extraValues.push(normalizedSlave);
    }

    if (modbusFunction) {
      extraColumns.push("modbus_function");
      extraValues.push(modbusFunction);
    }

    extraColumns.push("num_inputs");
    extraValues.push(normalizedInputs);
    extraColumns.push("num_outputs");
    extraValues.push(normalizedOutputs);

    const columnList = columns.concat(extraColumns).join(", ");
    const placeholderList = Array(columns.length + extraColumns.length)
      .fill("?")
      .join(", ");

    const [result] = await pool.execute(
      `INSERT INTO cvn_data_iot (${columnList}) VALUES (${placeholderList})`,
      values.concat(extraValues)
    );

    // After adding module, read modbus data and save to cvn_data_table_modbus
    if (normalizedProtocol === "modbus" && normalizedStartInput !== null && normalizedStartOutput !== null) {
      try {
        // Initialize empty entry in cvn_data_table_modbus for this IP
        await pool.execute(
          `INSERT INTO cvn_data_table_modbus (ip_address) VALUES (?) 
           ON DUPLICATE KEY UPDATE ip_address = ip_address`,
          [ipAddress.trim()]
        );
        console.log(`Initialized cvn_data_table_modbus entry for IP ${ipAddress.trim()}`);
      } catch (readError) {
        console.error("Error initializing modbus table entry:", readError.message);
        // Don't fail the request if initialization fails
      }
    }

    res.json({
      success: true,
      message: "IOT module added successfully",
      id: result.insertId,
    });
  } catch (error) {
    console.error("Error inserting IOT module:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.delete("/api/iot/modules/:id", async (req, res) => {
  const moduleId = parseInt(req.params.id, 10);

  if (Number.isNaN(moduleId)) {
    return res.status(400).json({
      success: false,
      error: "Invalid module ID",
    });
  }

  console.log(`DELETE /api/iot/modules/${moduleId} - Request received`);

  try {
    const [result] = await pool.execute(
      "DELETE FROM cvn_data_iot WHERE id = ?",
      [moduleId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: "IOT module not found",
      });
    }

    res.json({
      success: true,
      message: "IOT module deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting IOT module:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// IOT Read API - Read IO data from IOT device
app.post("/api/iot/read", async (req, res) => {
  console.log("POST /api/iot/read - Request received", req.body);
  
  let socket = null;
  let client = null;
  
  try {
    const { communicationType, ipAddress, port, slaveId, startAddressInput, startAddressOutput, modbusFunction, numInputs, numOutputs } = req.body;

    if (!communicationType || !ipAddress || !port) {
      return res.status(400).json({
        success: false,
        error: "Communication type, IP address, and port are required",
      });
    }

    let inputs = [];
    let outputs = [];
    let isConnected = false;

    if (communicationType === "modbus") {
      const deviceSlaveId = parseInt(slaveId) || 1;
      const inputBaseAddress = parseInt(startAddressInput) || 0;
      const outputBaseAddress = parseInt(startAddressOutput) || 0;
      
      try {
        // Create Modbus TCP connection
        socket = new Socket();
        socket.setTimeout(5000); // 5 second timeout
        
        client = new ModbusTCPClient(socket, deviceSlaveId);
        
        // Connect to Modbus device
        await new Promise((resolve, reject) => {
          socket.once("connect", () => {
            console.log(`Modbus TCP connected to ${ipAddress}:${port}, SlaveID=${deviceSlaveId}`);
            isConnected = true;
            resolve();
          });
          
          socket.once("error", (err) => {
            console.error(`Modbus TCP connection error: ${err.message}`);
            reject(err);
          });
          
          socket.once("timeout", () => {
            socket.destroy();
            reject(new Error("Connection timeout"));
          });
          
          socket.connect(parseInt(port) || 502, ipAddress);
        });
        
        // Read inputs based on modbusFunction
        if (numInputs > 0) {
          try {
            let inputResult;
            switch (modbusFunction) {
              case "readCoils":
              case "readDiscreteInputs":
                // Read discrete inputs (FC 02) or coils (FC 01)
                if (modbusFunction === "readDiscreteInputs") {
                  inputResult = await client.readDiscreteInputs(inputBaseAddress, numInputs);
                } else {
                  inputResult = await client.readCoils(inputBaseAddress, numInputs);
                }
                inputs = inputResult.response.body.valuesAsArray.slice(0, numInputs);
                break;
              case "readHoldingRegisters":
                inputResult = await client.readHoldingRegisters(inputBaseAddress, numInputs);
                // Convert register values to boolean array (non-zero = true)
                inputs = inputResult.response.body.valuesAsArray.slice(0, numInputs).map(v => v !== 0);
                break;
              case "readInputRegisters":
                inputResult = await client.readInputRegisters(inputBaseAddress, numInputs);
                inputs = inputResult.response.body.valuesAsArray.slice(0, numInputs).map(v => v !== 0);
                break;
              default:
                // Default to read coils
                inputResult = await client.readCoils(inputBaseAddress, numInputs);
                inputs = inputResult.response.body.valuesAsArray.slice(0, numInputs);
            }
          } catch (readError) {
            console.error(`Error reading inputs: ${readError.message}`);
            inputs = Array(numInputs).fill(false);
          }
        }
        
        // Read outputs (coils starting from outputBaseAddress)
        if (numOutputs > 0) {
          try {
            const outputResult = await client.readCoils(outputBaseAddress, numOutputs);
            outputs = outputResult.response.body.valuesAsArray.slice(0, numOutputs);
          } catch (readError) {
            console.error(`Error reading outputs: ${readError.message}`);
            outputs = Array(numOutputs).fill(false);
          }
        }
        
        console.log(`Modbus read success: IP=${ipAddress}:${port}, SlaveID=${deviceSlaveId}, Inputs=${JSON.stringify(inputs)}, Outputs=${JSON.stringify(outputs)}`);
        
        // Save data to cvn_data_table_modbus
        if (isConnected && (inputs.length > 0 || outputs.length > 0)) {
          try {
            // Prepare update query with all input and output fields
            const updateFields = [];
            const updateValues = [];
            
            // Map inputs to in_1 through in_8
            for (let i = 0; i < 8; i++) {
              const value = i < inputs.length ? (inputs[i] ? 1 : 0) : 0;
              updateFields.push(`in_${i + 1} = ?`);
              updateValues.push(value);
            }
            
            // Map outputs to out_1 through out_8
            for (let i = 0; i < 8; i++) {
              const value = i < outputs.length ? (outputs[i] ? 1 : 0) : 0;
              updateFields.push(`out_${i + 1} = ?`);
              updateValues.push(value);
            }
            
            // Use INSERT ... ON DUPLICATE KEY UPDATE to insert or update
            const insertFields = ['ip_address'];
            const insertValues = [ipAddress.trim()];
            const insertPlaceholders = ['?'];
            
            for (let i = 0; i < 8; i++) {
              insertFields.push(`in_${i + 1}`, `out_${i + 1}`);
              insertPlaceholders.push('?', '?');
              const inValue = i < inputs.length ? (inputs[i] ? 1 : 0) : 0;
              const outValue = i < outputs.length ? (outputs[i] ? 1 : 0) : 0;
              insertValues.push(inValue, outValue);
            }
            
            const updateClause = updateFields.join(', ');
            
            await pool.execute(
              `INSERT INTO cvn_data_table_modbus (${insertFields.join(', ')}) 
               VALUES (${insertPlaceholders.join(', ')}) 
               ON DUPLICATE KEY UPDATE ${updateClause}`,
              [...insertValues, ...updateValues]
            );
            
            console.log(`Saved modbus data to cvn_data_table_modbus for IP ${ipAddress.trim()}`);
          } catch (dbError) {
            console.error(`Error saving modbus data to database: ${dbError.message}`);
            // Don't fail the request if database save fails
          }
        }
        
      } catch (modbusError) {
        console.error(`Modbus connection/read error: ${modbusError.message}`);
        isConnected = false;
        inputs = Array(numInputs || 0).fill(false);
        outputs = Array(numOutputs || 0).fill(false);
        
        // Return error but don't fail completely - let frontend know connection failed
        return res.json({
          success: false,
          connected: false,
          error: modbusError.message,
          data: {
            inputs,
            outputs,
            timestamp: new Date().toISOString(),
          },
        });
      } finally {
        // Close connection
        if (socket) {
          socket.destroy();
        }
      }
      
    } else if (communicationType === "socket") {
      // Socket communication - for now, simulate (can be implemented later)
      console.log(`Socket read: IP=${ipAddress}:${port}, Inputs=${numInputs}, Outputs=${numOutputs}`);
      inputs = Array(numInputs || 0).fill(false);
      outputs = Array(numOutputs || 0).fill(false);
      isConnected = false; // Socket not implemented yet
    }

    res.json({
      success: true,
      connected: isConnected,
      data: {
        inputs,
        outputs,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error reading IOT data:", error);
    res.status(500).json({
      success: false,
      connected: false,
      error: error.message,
      data: {
        inputs: Array(parseInt(req.body.numInputs) || 0).fill(false),
        outputs: Array(parseInt(req.body.numOutputs) || 0).fill(false),
        timestamp: new Date().toISOString(),
      },
    });
  }
});

// IOT Write API - Write value to IOT device
app.post("/api/iot/write", async (req, res) => {
  console.log("POST /api/iot/write - Request received", req.body);
  
  let socket = null;
  let client = null;
  
  try {
    const { communicationType, ipAddress, port, slaveId, address, value, modbusFunction } = req.body;

    if (!communicationType || !ipAddress || !port || address === undefined || value === undefined) {
      return res.status(400).json({
        success: false,
        error: "Communication type, IP address, port, address, and value are required",
      });
    }

    if (communicationType === "modbus") {
      const deviceSlaveId = parseInt(slaveId) || 1;
      const writeAddress = parseInt(address);
      const writeValue = value ? 1 : 0;
      
      try {
        // Create Modbus TCP connection
        socket = new Socket();
        socket.setTimeout(5000); // 5 second timeout
        
        client = new ModbusTCPClient(socket, deviceSlaveId);
        
        // Connect to Modbus device
        await new Promise((resolve, reject) => {
          socket.once("connect", () => {
            console.log(`Modbus TCP connected to ${ipAddress}:${port}, SlaveID=${deviceSlaveId}`);
            resolve();
          });
          
          socket.once("error", (err) => {
            console.error(`Modbus TCP connection error: ${err.message}`);
            reject(err);
          });
          
          socket.once("timeout", () => {
            socket.destroy();
            reject(new Error("Connection timeout"));
          });
          
          socket.connect(parseInt(port) || 502, ipAddress);
        });
        
        // Write based on modbusFunction
        let writeResult;
        switch (modbusFunction) {
          case "writeSingleCoil":
            writeResult = await client.writeSingleCoil(writeAddress, writeValue === 1);
            break;
          case "writeSingleRegister":
            writeResult = await client.writeSingleRegister(writeAddress, writeValue);
            break;
          case "writeMultipleCoils":
            // For multiple coils, value should be an array
            const coilsArray = Array.isArray(value) ? value : [writeValue === 1];
            writeResult = await client.writeMultipleCoils(writeAddress, coilsArray);
            break;
          case "writeMultipleRegisters":
            // For multiple registers, value should be an array
            const registersArray = Array.isArray(value) ? value : [writeValue];
            writeResult = await client.writeMultipleRegisters(writeAddress, registersArray);
            break;
          default:
            // Default to write single coil
            writeResult = await client.writeSingleCoil(writeAddress, writeValue === 1);
        }
        
        console.log(`Modbus write success: IP=${ipAddress}:${port}, SlaveID=${deviceSlaveId}, Address=${writeAddress}, Value=${writeValue}, Func=${modbusFunction}`);
        
        res.json({
          success: true,
          connected: true,
          message: `Write successful: Address ${writeAddress} = ${writeValue}`,
          data: {
            address: writeAddress,
            value: writeValue,
            timestamp: new Date().toISOString(),
          },
        });
        
      } catch (modbusError) {
        console.error(`Modbus write error: ${modbusError.message}`);
        res.json({
          success: false,
          connected: false,
          error: modbusError.message,
          message: `Write failed: ${modbusError.message}`,
        });
      } finally {
        // Close connection
        if (socket) {
          socket.destroy();
        }
      }
      
    } else if (communicationType === "socket") {
      // Socket communication - not implemented yet
      console.log(`Socket write: IP=${ipAddress}:${port}, Address=${address}, Value=${value}`);
      res.json({
        success: false,
        connected: false,
        error: "Socket communication not implemented yet",
      });
    } else {
      return res.status(400).json({
        success: false,
        error: "Unsupported communication type",
      });
    }
  } catch (error) {
    console.error("Error writing IOT data:", error);
    res.status(500).json({
      success: false,
      connected: false,
      error: error.message,
    });
  }
});

// Ensure cvn_data_table_modbus table exists
const ensureModbusTable = async () => {
  try {
    // Create table with fields: ip_address, in_1 to in_8, out_1 to out_8
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS cvn_data_table_modbus (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ip_address VARCHAR(255) NOT NULL,
        in_1 TINYINT(1) DEFAULT 0,
        in_2 TINYINT(1) DEFAULT 0,
        in_3 TINYINT(1) DEFAULT 0,
        in_4 TINYINT(1) DEFAULT 0,
        in_5 TINYINT(1) DEFAULT 0,
        in_6 TINYINT(1) DEFAULT 0,
        in_7 TINYINT(1) DEFAULT 0,
        in_8 TINYINT(1) DEFAULT 0,
        out_1 TINYINT(1) DEFAULT 0,
        out_2 TINYINT(1) DEFAULT 0,
        out_3 TINYINT(1) DEFAULT 0,
        out_4 TINYINT(1) DEFAULT 0,
        out_5 TINYINT(1) DEFAULT 0,
        out_6 TINYINT(1) DEFAULT 0,
        out_7 TINYINT(1) DEFAULT 0,
        out_8 TINYINT(1) DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE(ip_address)
      )
    `;
    
    await pool.execute(createTableSQL);
    console.log("✓ cvn_data_table_modbus table ensured.");
  } catch (error) {
    console.error("Error ensuring cvn_data_table_modbus table:", error.message);
  }
};

ensureModbusTable();

// Ensure cvn_data_agv table exists for storing AGV data
const ensureAgvTable = async () => {
  try {
    // Try to create table with JSON type first (MySQL 5.7+)
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS cvn_data_agv (
          id INT AUTO_INCREMENT PRIMARY KEY,
          agv_id VARCHAR(255) NOT NULL,
          agv_data JSON NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_agv_id (agv_id)
        )
      `);
      console.log("✓ cvn_data_agv table ensured (with JSON type)");
    } catch (jsonError) {
      // If JSON type fails, try with TEXT type (for older MySQL versions)
      console.log("JSON type not supported, trying TEXT type...");
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS cvn_data_agv (
          id INT AUTO_INCREMENT PRIMARY KEY,
          agv_id VARCHAR(255) NOT NULL,
          agv_data TEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_agv_id (agv_id)
        )
      `);
      console.log("✓ cvn_data_agv table ensured (with TEXT type)");
    }
  } catch (error) {
    console.error("Error ensuring cvn_data_agv table:", error.message);
    console.error("Error stack:", error.stack);
  }
};

ensureAgvTable();

// Function to fetch AGV data from API and save to database
const fetchAndSaveAgvData = async () => {
  try {
    const response = await fetch(`${LOCAL_AGVS_HOST}/api/v2/agvs`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Normalize data - handle different response formats
    let agvList = [];
    if (Array.isArray(data)) {
      agvList = data;
    } else if (data?.agvs && Array.isArray(data.agvs)) {
      agvList = data.agvs;
    } else if (data?.data && Array.isArray(data.data)) {
      agvList = data.data;
    }

    if (agvList.length === 0) {
      console.log("[AGV Sync] No AGV data to save");
      return;
    }

    // Save each AGV to database
    for (const agv of agvList) {
      const agvId = agv?.id || agv?.name || `agv-${Date.now()}`;
      const agvDataJson = JSON.stringify(agv);

      try {
        // Check if table has JSON type
        const [tableInfo] = await pool.execute(
          `SELECT COLUMN_TYPE 
           FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = ? 
           AND TABLE_NAME = 'cvn_data_agv' 
           AND COLUMN_NAME = 'agv_data'`,
          [dbConfig.database]
        );

        const hasJsonType = tableInfo.length > 0 && tableInfo[0].COLUMN_TYPE.toLowerCase().includes('json');

        if (hasJsonType) {
          // Use JSON type
          await pool.execute(
            `INSERT INTO cvn_data_agv (agv_id, agv_data) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE agv_data = VALUES(agv_data), updated_at = CURRENT_TIMESTAMP`,
            [agvId, agvDataJson]
          );
        } else {
          // Use TEXT type
          await pool.execute(
            `INSERT INTO cvn_data_agv (agv_id, agv_data) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE agv_data = ?, updated_at = CURRENT_TIMESTAMP`,
            [agvId, agvDataJson, agvDataJson]
          );
        }
      } catch (dbError) {
        console.error(`[AGV Sync] Error saving AGV ${agvId}:`, dbError.message);
      }
    }

    console.log(`[AGV Sync] Saved ${agvList.length} AGV(s) to database`);
  } catch (error) {
    console.error("[AGV Sync] Error fetching/saving AGV data:", error.message);
  }
};

// Start AGV data synchronization (every 1 second)
let agvSyncInterval = null;
const startAgvSync = () => {
  // Initial fetch
  fetchAndSaveAgvData();
  
  // Set interval to sync every 1 second
  agvSyncInterval = setInterval(() => {
    fetchAndSaveAgvData();
  }, 1000);
  
  console.log("✓ AGV data synchronization started (every 1 second)");
};

startAgvSync();

// API to reset modbus data for a specific IP (set all in_1 to in_8, out_1 to out_8 to 0)
app.post("/api/iot/modbus/reset", async (req, res) => {
  console.log("POST /api/iot/modbus/reset - Request received", req.body);
  
  try {
    const { ipAddress } = req.body;

    if (!ipAddress) {
      return res.status(400).json({
        success: false,
        error: "IP Address is required",
      });
    }

    console.log(`POST /api/iot/modbus/reset - Resetting: IP=${ipAddress}`);

    // Reset all input and output fields to 0
    const resetFields = [];
    const resetValues = [];
    
    for (let i = 1; i <= 8; i++) {
      resetFields.push(`in_${i} = 0`, `out_${i} = 0`);
    }
    
    const updateClause = resetFields.join(', ');
    
    // Use INSERT ... ON DUPLICATE KEY UPDATE to ensure row exists
    await pool.execute(
      `INSERT INTO cvn_data_table_modbus (ip_address, in_1, in_2, in_3, in_4, in_5, in_6, in_7, in_8, out_1, out_2, out_3, out_4, out_5, out_6, out_7, out_8) 
       VALUES (?, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0) 
       ON DUPLICATE KEY UPDATE ${updateClause}`,
      [ipAddress.trim()]
    );
    
    console.log(`Reset modbus data for IP ${ipAddress.trim()}`);
    
    res.json({
      success: true,
      message: `Reset modbus data for IP ${ipAddress.trim()}`,
    });
  } catch (error) {
    console.error("Error resetting modbus data:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// API to read and save modbus data for IOT node (simplified - just pass module config to /api/iot/read)
// This endpoint will be called from frontend with iotModuleId
app.post("/api/iot/modbus/read-and-save", async (req, res) => {
  console.log("POST /api/iot/modbus/read-and-save - Request received", req.body);
  
  try {
    const { iotModuleId } = req.body;

    if (!iotModuleId) {
      return res.status(400).json({
        success: false,
        error: "IOT Module ID is required",
      });
    }

    // Get IOT module configuration
    const [modules] = await pool.execute(
      "SELECT * FROM cvn_data_iot WHERE id = ?",
      [iotModuleId]
    );

    if (modules.length === 0) {
      return res.status(404).json({
        success: false,
        error: "IOT module not found",
      });
    }

    const module = modules[0];
    const ipAddress = module.ip_address;
    const protocol = module.protocol || "modbus";
    
    if (protocol !== "modbus") {
      return res.status(400).json({
        success: false,
        error: "Only Modbus protocol is supported",
      });
    }

    // Create request object for /api/iot/read (which already saves to database)
    const readRequest = {
      communicationType: "modbus",
      ipAddress: ipAddress,
      port: module.port,
      slaveId: module.slave_id || 1,
      startAddressInput: module.start_address_input || 0,
      startAddressOutput: module.start_address_output || 0,
      modbusFunction: module.modbus_function || "readCoils",
      numInputs: module.num_inputs || 8,
      numOutputs: module.num_outputs || 8,
    };

    // Forward to /api/iot/read which already handles reading and saving
    // We'll create a helper function or just reuse the logic
    // For simplicity, we'll call the read endpoint internally
    // But since we can't easily call Express routes internally, we'll inline the logic
    // Actually, we can use the req/res from Express, but we need to create a new request
    // The simplest is to return the config and let frontend call /api/iot/read
    
    res.json({
      success: true,
      message: "IOT module configuration retrieved",
      config: readRequest,
    });
  } catch (error) {
    console.error("Error reading and saving modbus data:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// API to read modbus value from database table (must be before proxy middleware)
app.post("/api/iot/modbus/read", async (req, res) => {
  console.log("POST /api/iot/modbus/read - Request received", req.body);
  
  try {
    const { ipAddress, address } = req.body;

    if (!ipAddress || !address) {
      console.log("POST /api/iot/modbus/read - Missing ipAddress or address");
      return res.status(400).json({
        success: false,
        error: "IP Address and Address are required",
      });
    }

    console.log(`POST /api/iot/modbus/read - Reading: IP=${ipAddress}, Address=${address}`);

    // Validate address format (in_1 to in_8, out_1 to out_8)
    const validAddresses = [
      "in_1", "in_2", "in_3", "in_4", "in_5", "in_6", "in_7", "in_8",
      "out_1", "out_2", "out_3", "out_4", "out_5", "out_6", "out_7", "out_8",
    ];
    
    const normalizedAddress = address.toLowerCase();
    if (!validAddresses.includes(normalizedAddress)) {
      return res.status(400).json({
        success: false,
        error: `Invalid address. Must be one of: ${validAddresses.join(", ")}`,
      });
    }

    // Query the modbus table - use backticks for column name to handle underscore
    const [rows] = await pool.execute(
      `SELECT \`${normalizedAddress}\` as value FROM cvn_data_table_modbus WHERE ip_address = ?`,
      [ipAddress]
    );

    if (rows.length === 0) {
      // Create new row if doesn't exist
      await pool.execute(
        `INSERT INTO cvn_data_table_modbus (ip_address) VALUES (?)`,
        [ipAddress]
      );
      
      return res.json({
        success: true,
        value: 0,
        status: "off",
        message: "Created new entry with default value 0",
      });
    }

    // MySQL TINYINT(1) might return as boolean or number, normalize it
    let rawValue = rows[0].value;
    let value = 0;
    
    // Handle different types MySQL might return
    if (rawValue === true || rawValue === 1 || rawValue === "1" || rawValue === 1n) {
      value = 1;
    } else if (rawValue === false || rawValue === 0 || rawValue === "0" || rawValue === 0n) {
      value = 0;
    } else {
      // Try to parse as number
      const parsed = parseInt(rawValue);
      value = isNaN(parsed) ? 0 : (parsed ? 1 : 0);
    }
    
    const status = value === 1 ? "on" : "off";

    console.log(`Modbus DB read: IP=${ipAddress}, Address=${normalizedAddress}, RawValue=${rawValue} (type: ${typeof rawValue}), NormalizedValue=${value}, Status=${status}`);

    res.json({
      success: true,
      value: value,
      status: status,
      ipAddress: ipAddress,
      address: normalizedAddress,
    });
  } catch (error) {
    console.error("Error reading modbus value:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// API to list distinct Modbus IP addresses from cvn_data_table_modbus
app.get("/api/iot/modbus/devices", async (req, res) => {
  console.log("GET /api/iot/modbus/devices - Request received");
  try {
    const [rows] = await pool.execute(
      "SELECT DISTINCT ip_address FROM cvn_data_table_modbus ORDER BY ip_address ASC"
    );

    const devices = rows
      .map((row) => row.ip_address)
      .filter((ip) => typeof ip === "string" && ip.trim().length > 0);

    res.json({
      success: true,
      devices,
      count: devices.length,
    });
  } catch (error) {
    console.error("Error fetching Modbus devices:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// DELETE park by external_name
// PUT/PATCH update park use_state
app.put("/api/parks/:externalName/use-state", async (req, res) => {
  const { externalName } = req.params;
  const decodedName = decodeURIComponent(externalName);
  const { use_state } = req.body;
  
  console.log(`PUT /api/parks/${externalName}/use-state - Request received (decoded: ${decodedName}, use_state: ${use_state})`);
  
  try {
    if (use_state === undefined || use_state === null) {
      return res.status(400).json({
        success: false,
        error: "use_state is required",
      });
    }

    const [result] = await pool.execute(
      "UPDATE cvn_data_park SET use_state = ? WHERE external_name = ?",
      [use_state, decodedName]
    );

    if (result.affectedRows === 0) {
      console.log(`PUT /api/parks/${externalName}/use-state - Park not found`);
      return res.status(404).json({
        success: false,
        error: "Park not found",
      });
    }

    console.log(`PUT /api/parks/${externalName}/use-state - Updated successfully (${result.affectedRows} rows)`);
    res.json({
      success: true,
      message: "Park use_state updated successfully",
      data: {
        external_name: decodedName,
        use_state: use_state,
      },
    });
  } catch (error) {
    console.error("Error updating park use_state:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.delete("/api/parks/:externalName", async (req, res) => {
  const { externalName } = req.params;
  const decodedName = decodeURIComponent(externalName);
  console.log(`DELETE /api/parks/${externalName} - Request received (decoded: ${decodedName})`);
  
  try {
    const [result] = await pool.execute(
      "DELETE FROM cvn_data_park WHERE external_name = ?",
      [decodedName]
    );

    if (result.affectedRows === 0) {
      console.log(`DELETE /api/parks/${externalName} - Park not found`);
      return res.status(404).json({
        success: false,
        error: "Park not found",
      });
    }

    console.log(`DELETE /api/parks/${externalName} - Deleted successfully (${result.affectedRows} rows)`);
    res.json({
      success: true,
      message: "Park deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting park:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Flow Nodes API - Save/Load nodes and edges
// GET flow nodes/edges
app.get("/api/flow/nodes", async (req, res) => {
  console.log("GET /api/flow/nodes - Request received");
  try {
    const flowId = req.query.flow_id || "default";
    
    const [rows] = await pool.execute(
      "SELECT nodes_data, edges_data FROM cvn_data_node WHERE flow_id = ?",
      [flowId]
    );
    
    if (rows.length === 0) {
      // Return empty nodes/edges if no data found
      return res.json({
        success: true,
        data: {
          nodes: [],
          edges: [],
        },
      });
    }
    
    const row = rows[0];
    
    // Handle JSON data - could be already parsed or string
    let nodes = [];
    let edges = [];
    
    try {
      if (row.nodes_data) {
        if (typeof row.nodes_data === 'string') {
          nodes = JSON.parse(row.nodes_data);
        } else if (Array.isArray(row.nodes_data)) {
          nodes = row.nodes_data;
        } else {
          nodes = [];
        }
      }
      
      if (row.edges_data) {
        if (typeof row.edges_data === 'string') {
          edges = JSON.parse(row.edges_data);
        } else if (Array.isArray(row.edges_data)) {
          edges = row.edges_data;
        } else {
          edges = [];
        }
      }
    } catch (parseError) {
      console.error("Error parsing JSON data:", parseError);
      nodes = [];
      edges = [];
    }
    
    console.log(`GET /api/flow/nodes - Returning ${nodes.length} nodes and ${edges.length} edges`);
    res.json({
      success: true,
      data: {
        nodes: nodes || [],
        edges: edges || [],
      },
    });
  } catch (error) {
    console.error("Error fetching flow nodes:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack,
    });
  }
});

// POST/Save flow nodes/edges
app.post("/api/flow/nodes", async (req, res) => {
  console.log("POST /api/flow/nodes - Request received");
  try {
    const { nodes, edges, flow_id } = req.body;
    const flowId = flow_id || "default";
    
    if (!nodes || !Array.isArray(nodes)) {
      return res.status(400).json({
        success: false,
        error: "nodes array is required",
      });
    }
    
    if (!edges || !Array.isArray(edges)) {
      return res.status(400).json({
        success: false,
        error: "edges array is required",
      });
    }
    
    // Clean nodes data - remove handlers and other non-serializable data
    const cleanedNodes = nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        config: node.data?.config || {},
      },
    }));
    
    // Clean edges data
    const cleanedEdges = edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
    }));
    
    const nodesJson = JSON.stringify(cleanedNodes);
    const edgesJson = JSON.stringify(cleanedEdges);
    
    // Use INSERT ... ON DUPLICATE KEY UPDATE to upsert
    await pool.execute(
      `INSERT INTO cvn_data_node (flow_id, nodes_data, edges_data) 
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         nodes_data = VALUES(nodes_data),
         edges_data = VALUES(edges_data),
         updated_at = CURRENT_TIMESTAMP`,
      [flowId, nodesJson, edgesJson]
    );
    
    console.log(`POST /api/flow/nodes - Saved ${cleanedNodes.length} nodes and ${cleanedEdges.length} edges`);
    res.json({
      success: true,
      message: "Flow nodes saved successfully",
      data: {
        nodesCount: cleanedNodes.length,
        edgesCount: cleanedEdges.length,
      },
    });
  } catch (error) {
    console.error("Error saving flow nodes:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// --- Flow Runner (Phase 2 backend stub) ---
// Simple in-memory runner state; can be extended later to execute real steps.
const flowRunnerState = {
  isRunning: false,
  flowId: "default",
  startedAt: null,
  intervalId: null,
};

const loadFlowById = async (flowId = "default") => {
  const [rows] = await pool.execute(
    "SELECT nodes_data, edges_data FROM cvn_data_node WHERE flow_id = ?",
    [flowId]
  );
  if (rows.length === 0) {
    return { nodes: [], edges: [] };
  }
  const row = rows[0];
  let nodes = [];
  let edges = [];
  try {
    nodes = row.nodes_data
      ? typeof row.nodes_data === "string"
        ? JSON.parse(row.nodes_data)
        : row.nodes_data
      : [];
  } catch (e) {
    console.error("[FlowRunner] Error parsing nodes_data:", e.message);
    nodes = [];
  }
  try {
    edges = row.edges_data
      ? typeof row.edges_data === "string"
        ? JSON.parse(row.edges_data)
        : row.edges_data
      : [];
  } catch (e) {
    console.error("[FlowRunner] Error parsing edges_data:", e.message);
    edges = [];
  }
  return { nodes, edges };
};

const stopRunnerInterval = () => {
  if (flowRunnerState.intervalId) {
    clearInterval(flowRunnerState.intervalId);
    flowRunnerState.intervalId = null;
  }
};

const startRunnerInterval = () => {
  stopRunnerInterval();
  // Placeholder: tick every 1s (no-op for now). Extend here to execute flow steps.
  flowRunnerState.intervalId = setInterval(() => {
    // TODO: implement real execution logic (trigger polling, move orders, etc.)
  }, 1000);
};

app.post("/api/flow/start", async (req, res) => {
  try {
    const flowId = req.body?.flow_id || "default";
    const { nodes, edges } = await loadFlowById(flowId);

    // Basic validation: require at least 1 node to start
    if (!nodes || nodes.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No nodes to run. Please add nodes before starting.",
      });
    }

    flowRunnerState.isRunning = true;
    flowRunnerState.flowId = flowId;
    flowRunnerState.startedAt = new Date().toISOString();
    startRunnerInterval();

    console.log(`[FlowRunner] Started flow "${flowId}" with ${nodes.length} nodes, ${edges.length} edges.`);
    res.json({
      success: true,
      message: `Flow "${flowId}" started`,
      data: {
        flowId,
        nodesCount: nodes.length,
        edgesCount: edges.length,
        startedAt: flowRunnerState.startedAt,
      },
    });
  } catch (error) {
    console.error("[FlowRunner] Error starting flow:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post("/api/flow/stop", (req, res) => {
  try {
    stopRunnerInterval();
    flowRunnerState.isRunning = false;
    const stoppedAt = new Date().toISOString();
    console.log(`[FlowRunner] Stopped flow "${flowRunnerState.flowId}" at ${stoppedAt}`);
    res.json({
      success: true,
      message: `Flow "${flowRunnerState.flowId}" stopped`,
      data: {
        flowId: flowRunnerState.flowId,
        stoppedAt,
      },
    });
  } catch (error) {
    console.error("[FlowRunner] Error stopping flow:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/flow/status", (req, res) => {
  res.json({
    success: true,
    data: {
      isRunning: flowRunnerState.isRunning,
      flowId: flowRunnerState.flowId,
      startedAt: flowRunnerState.startedAt,
    },
  });
});

// ========== Monitor API ==========
// Monitor Nodes API - Save/Load nodes
app.get("/api/monitor/nodes", async (req, res) => {
  console.log("GET /api/monitor/nodes - Request received");
  try {
    const flowId = req.query.flow_id || "default";
    
    const [rows] = await pool.execute(
      "SELECT nodes_data FROM cvn_data_monitor WHERE flow_id = ?",
      [flowId]
    );
    
    if (rows.length === 0) {
      return res.json({
        success: true,
        data: {
          nodes: [],
        },
      });
    }
    
    const row = rows[0];
    let nodes = [];
    
    try {
      if (row.nodes_data) {
        if (typeof row.nodes_data === 'string') {
          nodes = JSON.parse(row.nodes_data);
        } else if (Array.isArray(row.nodes_data)) {
          nodes = row.nodes_data;
        } else {
          nodes = [];
        }
      }
    } catch (parseError) {
      console.error("Error parsing JSON data:", parseError);
      nodes = [];
    }
    
    console.log(`GET /api/monitor/nodes - Returning ${nodes.length} nodes`);
    res.json({
      success: true,
      data: {
        nodes: nodes || [],
      },
    });
  } catch (error) {
    console.error("Error fetching monitor nodes:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post("/api/monitor/nodes", async (req, res) => {
  console.log("POST /api/monitor/nodes - Request received");
  try {
    const { nodes, flow_id } = req.body;
    const flowId = flow_id || "default";
    
    if (!nodes || !Array.isArray(nodes)) {
      return res.status(400).json({
        success: false,
        error: "nodes array is required",
      });
    }
    
    // Clean nodes data - remove handlers and other non-serializable data
    const cleanedNodes = nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        config: node.data?.config || {},
      },
    }));
    
    const nodesJson = JSON.stringify(cleanedNodes);
    
    // Use INSERT ... ON DUPLICATE KEY UPDATE to upsert
    await pool.execute(
      `INSERT INTO cvn_data_monitor (flow_id, nodes_data) 
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE 
         nodes_data = VALUES(nodes_data),
         updated_at = CURRENT_TIMESTAMP`,
      [flowId, nodesJson]
    );
    
    console.log(`POST /api/monitor/nodes - Saved ${cleanedNodes.length} nodes`);
    res.json({
      success: true,
      message: "Monitor nodes saved successfully",
      data: {
        nodesCount: cleanedNodes.length,
      },
    });
  } catch (error) {
    console.error("Error saving monitor nodes:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Monitor Runner State
const monitorRunnerState = {
  isRunning: false,
  flowId: "default",
  startedAt: null,
  intervalIds: new Map(), // Store intervals for each node type
};

const loadMonitorById = async (flowId = "default") => {
  const [rows] = await pool.execute(
    "SELECT nodes_data FROM cvn_data_monitor WHERE flow_id = ?",
    [flowId]
  );
  if (rows.length === 0) {
    return { nodes: [] };
  }
  const row = rows[0];
  let nodes = [];
  try {
    nodes = row.nodes_data
      ? typeof row.nodes_data === "string"
        ? JSON.parse(row.nodes_data)
        : row.nodes_data
      : [];
  } catch (e) {
    console.error("[MonitorRunner] Error parsing nodes_data:", e.message);
    nodes = [];
  }
  return { nodes };
};

const stopMonitorIntervals = () => {
  monitorRunnerState.intervalIds.forEach((intervalId) => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  });
  monitorRunnerState.intervalIds.clear();
};

const startMonitorIntervals = async (nodes) => {
  stopMonitorIntervals();
  
  // Group nodes by type
  const nodesByType = {};
  nodes.forEach((node) => {
    if (!nodesByType[node.type]) {
      nodesByType[node.type] = [];
    }
    nodesByType[node.type].push(node);
  });
  
  // Start monitoring for each node type
  for (const [nodeType, nodeList] of Object.entries(nodesByType)) {
    if (nodeType === "lamp") {
      // Monitor lamp nodes - check park states
      const intervalId = setInterval(async () => {
        if (!monitorRunnerState.isRunning) {
          clearInterval(intervalId);
          return;
        }
        
        for (const node of nodeList) {
          const parkName = node.data?.config?.parkName;
          if (parkName) {
            try {
              const [parkRows] = await pool.execute(
                "SELECT use_state FROM cvn_data_park WHERE park_name = ?",
                [parkName]
              );
              if (parkRows.length > 0) {
                const park = parkRows[0];
                const isOn = park.use_state === 3; // Ready state
                // Store node state (can be retrieved via status endpoint)
                // For now, we just log it
                console.log(`[Monitor] Lamp ${node.id}: ${isOn ? "ON" : "OFF"}`);
              }
            } catch (error) {
              console.error(`[Monitor] Error updating lamp ${node.id}:`, error);
            }
          }
        }
      }, 1000);
      monitorRunnerState.intervalIds.set("lamp", intervalId);
    } else if (nodeType === "counter") {
      // Monitor counter nodes - increment counter
      const counters = new Map();
      nodeList.forEach((node) => {
        counters.set(node.id, 0);
      });
      
      const intervalId = setInterval(() => {
        if (!monitorRunnerState.isRunning) {
          clearInterval(intervalId);
          return;
        }
        counters.forEach((value, nodeId) => {
          counters.set(nodeId, value + 1);
        });
      }, 1000);
      monitorRunnerState.intervalIds.set("counter", intervalId);
    } else if (nodeType === "park") {
      // Monitor park nodes - check park states
      const intervalId = setInterval(async () => {
        if (!monitorRunnerState.isRunning) {
          clearInterval(intervalId);
          return;
        }
        
        for (const node of nodeList) {
          const parkName = node.data?.config?.parkName;
          if (parkName) {
            try {
              const [parkRows] = await pool.execute(
                "SELECT use_state FROM cvn_data_park WHERE park_name = ?",
                [parkName]
              );
              if (parkRows.length > 0) {
                const park = parkRows[0];
                console.log(`[Monitor] Park ${node.id} (${parkName}): use_state = ${park.use_state}`);
              }
            } catch (error) {
              console.error(`[Monitor] Error updating park ${node.id}:`, error);
            }
          }
        }
      }, 2000);
      monitorRunnerState.intervalIds.set("park", intervalId);
    } else if (nodeType === "map") {
      // Monitor map nodes - update AGV positions (data will be fetched by frontend)
      // Backend just keeps the monitoring state
      console.log(`[Monitor] Map nodes monitoring started (${nodeList.length} nodes)`);
    }
  }
};

app.post("/api/monitor/start", async (req, res) => {
  try {
    const flowId = req.body?.flow_id || "default";
    const { nodes } = await loadMonitorById(flowId);

    if (!nodes || nodes.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No nodes to monitor. Please add nodes before starting.",
      });
    }

    monitorRunnerState.isRunning = true;
    monitorRunnerState.flowId = flowId;
    monitorRunnerState.startedAt = new Date().toISOString();
    await startMonitorIntervals(nodes);

    console.log(`[MonitorRunner] Started monitor "${flowId}" with ${nodes.length} nodes.`);
    res.json({
      success: true,
      message: `Monitor "${flowId}" started`,
      data: {
        flowId,
        nodesCount: nodes.length,
        startedAt: monitorRunnerState.startedAt,
      },
    });
  } catch (error) {
    console.error("[MonitorRunner] Error starting monitor:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post("/api/monitor/stop", (req, res) => {
  try {
    stopMonitorIntervals();
    monitorRunnerState.isRunning = false;
    const stoppedAt = new Date().toISOString();
    console.log(`[MonitorRunner] Stopped monitor "${monitorRunnerState.flowId}" at ${stoppedAt}`);
    res.json({
      success: true,
      message: `Monitor "${monitorRunnerState.flowId}" stopped`,
      data: {
        flowId: monitorRunnerState.flowId,
        stoppedAt,
      },
    });
  } catch (error) {
    console.error("[MonitorRunner] Error stopping monitor:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/monitor/status", (req, res) => {
  res.json({
    success: true,
    data: {
      isRunning: monitorRunnerState.isRunning,
      flowId: monitorRunnerState.flowId,
      startedAt: monitorRunnerState.startedAt,
    },
  });
});

// Proxy middleware (must be after API routes)
// API to get AGV data from database
// IMPORTANT: This endpoint must be before the proxy middleware below
// It serves data from database instead of proxying to the original API
// API endpoint to debug AGV data structure
app.get("/api/agvs/debug", async (req, res) => {
  console.log("GET /api/agvs/debug - Request received");
  try {
    const [rows] = await pool.execute(
      "SELECT agv_id, agv_data, updated_at FROM cvn_data_agv ORDER BY updated_at DESC LIMIT 5"
    );

    const debugData = rows.map((row) => {
      let data = null;
      let parseError = null;
      
      try {
        data = typeof row.agv_data === 'string' 
          ? JSON.parse(row.agv_data) 
          : row.agv_data;
      } catch (err) {
        parseError = err.message;
      }
      
      return {
        agv_id: row.agv_id,
        updated_at: row.agv_id,
        raw_data_type: typeof row.agv_data,
        raw_data_length: row.agv_data ? String(row.agv_data).length : 0,
        parse_error: parseError,
        parsed_data: data,
        available_fields: data ? Object.keys(data) : [],
        orderId_fields: data ? {
          orderId: data.orderId,
          order_id: data.order_id,
          currentOrderId: data.currentOrderId,
          lastOrderId: data.lastOrderId,
          order: data.order,
        } : null,
      };
    });

    res.json({
      success: true,
      count: debugData.length,
      data: debugData,
    });
  } catch (error) {
    console.error("Error debugging AGV data:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// API endpoint to check if all AGVs have orderId = null
app.get("/api/agvs/check-orderid", async (req, res) => {
  console.log("GET /api/agvs/check-orderid - Request received");
  try {
    const [rows] = await pool.execute(
      "SELECT agv_id, agv_data FROM cvn_data_agv ORDER BY updated_at DESC"
    );

    if (rows.length === 0) {
      return res.json({
        success: true,
        allOrderIdNull: true,
        message: "No AGV data found",
      });
    }

    // Check all AGVs
    let allOrderIdNull = true;
    const agvStatuses = [];

    for (const row of rows) {
      try {
        // Parse JSON data
        let data = null;
        if (typeof row.agv_data === 'string') {
          try {
            data = JSON.parse(row.agv_data);
          } catch (parseErr) {
            console.error(`[Check OrderId] JSON parse error for AGV ${row.agv_id}:`, parseErr.message);
            console.error(`[Check OrderId] Raw agv_data (first 500 chars):`, row.agv_data?.substring(0, 500));
            agvStatuses.push({
              agvId: row.agv_id || 'unknown',
              orderId: null,
              orderIdRaw: null,
              isNull: true,
              error: `JSON parse error: ${parseErr.message}`,
            });
            continue;
          }
        } else {
          data = row.agv_data;
        }
        
        // Debug: Log full data structure for first AGV
        if (agvStatuses.length === 0) {
          console.log(`[Check OrderId] Sample AGV ${row.agv_id} full data:`, JSON.stringify(data, null, 2));
        }
        
        // Check only orderId field from agv_data
        // Based on user's data structure: {"orderId": null, ...}
        // อ่านค่า orderId จาก field orderId เท่านั้น
        const orderIdValue = data?.orderId;
        
        // ตรวจสอบว่า orderId เป็น null หรือไม่
        // ตามข้อมูลจริง: {"orderId": null} -> ถ้า orderId === null ถือว่าเป็น null
        // ถ้า orderId !== null และ orderId !== undefined และ orderId !== '' ถือว่ามี orderId
        const isNull = orderIdValue === null || 
                      orderIdValue === undefined || 
                      orderIdValue === '';
        
        agvStatuses.push({
          agvId: row.agv_id || data?.id || data?.name || 'unknown',
          orderId: orderIdValue,
          orderIdRaw: orderIdValue,
          isNull: isNull,
        });

        // If any AGV has a valid orderId, set flag to false
        if (!isNull && orderIdValue) {
          console.log(`[Check OrderId] ❌ AGV ${row.agv_id || data?.id || data?.name} has orderId: "${orderIdValue}"`);
          allOrderIdNull = false;
        } else {
          console.log(`[Check OrderId] ✅ AGV ${row.agv_id || data?.id || data?.name} orderId is null (value: ${orderIdValue})`);
        }
      } catch (error) {
        console.error(`[Check OrderId] ❌ Error processing AGV ${row.agv_id}:`, error.message);
        console.error(`[Check OrderId] Error stack:`, error.stack);
        agvStatuses.push({
          agvId: row.agv_id || 'unknown',
          orderId: null,
          orderIdRaw: null,
          isNull: true,
          error: error.message,
        });
      }
    }

    console.log(`GET /api/agvs/check-orderid - All orderId null: ${allOrderIdNull}, Total AGVs: ${rows.length}`);
    
    // Summary log
    const agvsWithOrderId = agvStatuses.filter(agv => !agv.isNull);
    const agvsWithoutOrderId = agvStatuses.filter(agv => agv.isNull);
    console.log(`[Check OrderId] Summary: ${agvsWithOrderId.length} AGVs with orderId, ${agvsWithoutOrderId.length} AGVs without orderId`);
    
    res.json({
      success: true,
      allOrderIdNull: allOrderIdNull,
      agvCount: rows.length,
      agvStatuses: agvStatuses,
      summary: {
        total: rows.length,
        withOrderId: agvsWithOrderId.length,
        withoutOrderId: agvsWithoutOrderId.length,
      },
    });
  } catch (error) {
    console.error("Error checking AGV orderId:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/agvs", async (req, res) => {
  console.log("GET /agvs - Request received (from database)");
  try {
    const [rows] = await pool.execute(
      "SELECT agv_id, agv_data FROM cvn_data_agv ORDER BY updated_at DESC"
    );

    // Parse JSON data
    const agvList = rows.map((row) => {
      try {
        const data = typeof row.agv_data === 'string' 
          ? JSON.parse(row.agv_data) 
          : row.agv_data;
        return data;
      } catch (parseError) {
        console.error(`Error parsing AGV data for ${row.agv_id}:`, parseError);
        return null;
      }
    }).filter(Boolean);

    console.log(`GET /agvs - Returning ${agvList.length} AGV(s) from database`);
    res.json(agvList);
  } catch (error) {
    console.error("Error fetching AGVs from database:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Apply logging middleware before proxy for /orders and /orderModifications
app.use("/orders", logPostRequest);
app.use("/orderModifications", logPostRequest);

app.use(
  "/orders",
  createProxyMiddleware({
    target: REMOTE_ORDERS_HOST,
    changeOrigin: true,
    secure: false,
    pathRewrite: { "^/orders": "/api/v2/orders" },
    timeout: 30000, // 30 seconds timeout
    proxyTimeout: 30000, // 30 seconds proxy timeout
    onProxyReq: (proxyReq, req, res) => {
      console.log(`[Proxy] Forwarding ${req.method} ${req.originalUrl} to ${REMOTE_ORDERS_HOST}${proxyReq.path}`);
      // If request body exists and has been parsed by express.json(), write it to proxyReq
      // This is necessary because express.json() consumes the request stream
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        if (req.body && typeof req.body === 'object') {
          const bodyData = JSON.stringify(req.body);
          console.log(`[Proxy] Request body:`, bodyData);
          // Update headers
          proxyReq.setHeader('Content-Type', 'application/json');
          proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
          // Remove Transfer-Encoding header if present, since we're setting Content-Length
          proxyReq.removeHeader('Transfer-Encoding');
          // Write body to proxy request and end the stream
          proxyReq.write(bodyData);
          proxyReq.end();
        } else {
          // No body, ensure headers are set correctly
          proxyReq.setHeader('Content-Length', '0');
          proxyReq.end();
        }
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log(`[Proxy] Response ${proxyRes.statusCode} from ${REMOTE_ORDERS_HOST}${req.originalUrl}`);
    },
    onError: (err, req, res) => {
      console.error(`[Proxy] Error proxying ${req.method} ${req.originalUrl}:`, err.message);
      if (!res.headersSent) {
        res.status(502).json({
          success: false,
          error: `Proxy error: ${err.message}`,
          details: `Failed to connect to ${REMOTE_ORDERS_HOST}`,
        });
      }
    },
  })
);

app.use(
  "/orderModifications",
  createProxyMiddleware({
    target: REMOTE_ORDERS_HOST,
    changeOrigin: true,
    secure: false,
    pathRewrite: { "^/orderModifications": "/api/v2/orderModifications" },
    timeout: 30000, // 30 seconds timeout
    proxyTimeout: 30000, // 30 seconds proxy timeout
    onProxyReq: (proxyReq, req, res) => {
      console.log(`[Proxy] Forwarding ${req.method} ${req.originalUrl} to ${REMOTE_ORDERS_HOST}${proxyReq.path}`);
      // If request body exists and has been parsed by express.json(), write it to proxyReq
      // This is necessary because express.json() consumes the request stream
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        if (req.body && typeof req.body === 'object') {
          const bodyData = JSON.stringify(req.body);
          console.log(`[Proxy] Request body:`, bodyData);
          // Update headers
          proxyReq.setHeader('Content-Type', 'application/json');
          proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
          // Remove Transfer-Encoding header if present, since we're setting Content-Length
          proxyReq.removeHeader('Transfer-Encoding');
          // Write body to proxy request and end the stream
          proxyReq.write(bodyData);
          proxyReq.end();
        } else {
          // No body, ensure headers are set correctly
          proxyReq.setHeader('Content-Length', '0');
          proxyReq.end();
        }
      }
    },
    onError: (err, req, res) => {
      console.error(`[Proxy] Error proxying ${req.method} ${req.originalUrl}:`, err.message);
      if (!res.headersSent) {
        res.status(502).json({
          success: false,
          error: `Proxy error: ${err.message}`,
          details: `Failed to connect to ${REMOTE_ORDERS_HOST}`,
        });
      }
    },
  })
);

app.use(
  "/agvs",
  createProxyMiddleware({
    target: LOCAL_AGVS_HOST,
    changeOrigin: true,
    secure: false,
    pathRewrite: { "^/agvs": "/api/v2/agvs" },
  })
);

const PORT = Number(process.env.PROXY_PORT ?? 4000);

app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`Proxy server running on http://localhost:${PORT}`);
  console.log(`- Orders: ${REMOTE_ORDERS_HOST}`);
  console.log(`- AGVs: ${LOCAL_AGVS_HOST}`);
  console.log(`- Parks API: GET/POST/PUT/DELETE /api/parks`);
  console.log(`  - PUT /api/parks/:externalName/use-state (Update use_state)`);
  console.log(`- Flow Nodes API: GET/POST /api/flow/nodes`);
  console.log(`- IOT API: POST /api/iot/read, POST /api/iot/write`);
  console.log(`- Modbus DB API: POST /api/iot/modbus/read`);
  console.log(`- CORS: Allowed methods: GET, POST, PUT, DELETE, OPTIONS`);
  console.log(`=================================`);
  
  // Test MySQL connection
  pool.getConnection()
    .then((connection) => {
      console.log("✓ MySQL connection established");
      connection.release();
    })
    .catch((error) => {
      console.error("✗ MySQL connection failed:", error.message);
    });
});


