import { useMemo, useEffect } from "react";

const ConsoleMonitor = ({ logsByNode, nodes }) => {
  // Debug: Log when component receives new data
  useEffect(() => {
    console.log("[ConsoleMonitor] Received data:", {
      nodesCount: nodes?.length || 0,
      logsByNodeKeys: logsByNode ? Object.keys(logsByNode) : [],
      logsByNode: logsByNode,
    });
  }, [logsByNode, nodes]);

  // Get all configured nodes (trigger, move) sorted by type and ID
  const nodesToDisplay = useMemo(() => {
    if (!nodes) return [];
    
      const configuredNodes = nodes.filter((node) => {
      // Filter out nodes that are not configured
      if (node.type === "trigger") {
        return node.data?.config?.iotId && node.data?.config?.address;
      } else if (node.type === "move") {
        return node.data?.config?.group1 && node.data?.config?.group2;
      } else if (node.type === "set") {
        return node.data?.config?.parkName && node.data?.config?.useState;
      }
      return false;
    });

    return configuredNodes.sort((a, b) => {
      // Sort by type first (trigger, move, set)
      const typeOrder = { trigger: 1, move: 2, set: 3 };
      const typeDiff = (typeOrder[a.type] || 999) - (typeOrder[b.type] || 999);
      if (typeDiff !== 0) return typeDiff;
      // Then sort by ID
      return a.id.localeCompare(b.id);
    });
  }, [nodes]);

  const getNodeDisplayName = (node) => {
    if (node.type === "trigger") {
      const config = node.data?.config || {};
      const address = config.address ? config.address.toUpperCase() : "N/A";
      return `Trigger (${address})`;
    } else if (node.type === "move") {
      const config = node.data?.config || {};
      const group1 = config.group1 || "N/A";
      const group2 = config.group2 || "N/A";
      return `Move (${group1} → ${group2})`;
    } else if (node.type === "set") {
      const config = node.data?.config || {};
      const parkName = config.parkName || "N/A";
      const useState = config.useState || "N/A";
      return `Set (${parkName} = ${useState})`;
    }
    return `${node.type} (${node.id})`;
  };

  if (nodesToDisplay.length === 0) {
    return (
      <div className="console-monitor">
        <div className="console-header">
          <h3>Console Monitor</h3>
        </div>
        <div className="console-content">
          <div className="console-empty">No configured nodes yet. Please configure nodes first.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="console-monitor">
      <div className="console-header">
        <h3>Console Monitor</h3>
        <span className="console-count">{nodesToDisplay.length} configured node(s)</span>
      </div>
      <div className="console-content-separated">
        {nodesToDisplay.map((node) => {
          const logs = logsByNode?.[node.id] || [];
          
          return (
            <div key={node.id} className="console-node-section">
              <div className="console-node-header">
                <span className="console-node-title">{getNodeDisplayName(node)}</span>
                <span className="console-node-count">{logs.length} log(s)</span>
              </div>
              <div className="console-node-content">
                {logs.length === 0 ? (
                  <div className="console-empty">No logs for this node</div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className={`console-log console-log-${log.type}`}>
                      <div className="console-log-main">
                        <span className="console-time">
                          {log.timestamp instanceof Date
                            ? log.timestamp.toLocaleTimeString()
                            : new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="console-type">[{log.type.toUpperCase()}]</span>
                        <span className="console-message">{log.message}</span>
                      </div>
                      {log.data && (
                        <div className="console-log-data">
                          {log.data.source && log.data.destination && (
                            <div className="console-data-item">
                              <strong>Source:</strong> {log.data.source} → <strong>Destination:</strong> {log.data.destination}
                            </div>
                          )}
                          {log.data.attempt && (
                            <div className="console-data-item">
                              <strong>Attempt:</strong> {log.data.attempt}
                            </div>
                          )}
                          {log.data.jsonString && (
                            <details className="console-data-details">
                              <summary style={{ cursor: "pointer", color: "#64748b", fontSize: "0.85rem" }}>
                                📄 View JSON Data
                              </summary>
                              <pre className="console-json">{log.data.jsonString}</pre>
                            </details>
                          )}
                          {log.data.response && (
                            <details className="console-data-details">
                              <summary style={{ cursor: "pointer", color: "#64748b", fontSize: "0.85rem" }}>
                                📥 View Response
                              </summary>
                              <pre className="console-json">{JSON.stringify(log.data.response, null, 2)}</pre>
                            </details>
                          )}
                          {log.data.error && (
                            <div className="console-data-item" style={{ color: "#ef4444" }}>
                              <strong>Error:</strong> {log.data.error}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ConsoleMonitor;