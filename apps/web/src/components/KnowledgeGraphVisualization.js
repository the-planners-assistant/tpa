import React, { useState, useEffect, useRef } from 'react';
import KnowledgeGraph from '@tpa/core/src/knowledge-graph.js';

/**
 * KnowledgeGraphVisualization
 * Interactive knowledge graph for exploring policy relationships and evidence connections
 */
export default function KnowledgeGraphVisualization({ planId, onClose }) {
  const [loading, setLoading] = useState(false);
  const [graphData, setGraphData] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [viewMode, setViewMode] = useState('policies'); // policies, evidence, full
  const [filters, setFilters] = useState({
    showWeakConnections: false,
    minConnectionStrength: 0.3,
    nodeTypes: ['policy', 'evidence', 'site']
  });
  const canvasRef = useRef(null);
  const knowledgeGraph = useRef(new KnowledgeGraph());

  useEffect(() => {
    if (planId) {
      loadGraphData();
    }
  }, [planId, viewMode, filters]);

  const loadGraphData = async () => {
    setLoading(true);
    try {
      const data = await knowledgeGraph.current.generateGraph(planId, {
        includeWeakConnections: filters.showWeakConnections,
        minConnectionStrength: filters.minConnectionStrength,
        nodeTypes: filters.nodeTypes
      });
      
      setGraphData(data);
      renderGraph(data);
    } catch (error) {
      console.error('Failed to load graph data:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderGraph = (data) => {
    if (!canvasRef.current || !data) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Simple force-directed layout simulation
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const radius = Math.min(centerX, centerY) * 0.8;

    // Position nodes in a circle initially
    data.nodes.forEach((node, index) => {
      const angle = (index / data.nodes.length) * 2 * Math.PI;
      node.x = centerX + Math.cos(angle) * radius * (0.5 + Math.random() * 0.5);
      node.y = centerY + Math.sin(angle) * radius * (0.5 + Math.random() * 0.5);
    });

    // Draw connections
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    data.edges.forEach(edge => {
      const sourceNode = data.nodes.find(n => n.id === edge.source);
      const targetNode = data.nodes.find(n => n.id === edge.target);
      
      if (sourceNode && targetNode) {
        ctx.beginPath();
        ctx.moveTo(sourceNode.x, sourceNode.y);
        ctx.lineTo(targetNode.x, targetNode.y);
        
        // Vary line thickness based on connection strength
        ctx.lineWidth = Math.max(1, edge.weight * 3);
        ctx.strokeStyle = `rgba(107, 114, 128, ${edge.weight})`;
        ctx.stroke();
      }
    });

    // Draw nodes
    data.nodes.forEach(node => {
      const nodeRadius = getNodeRadius(node);
      const nodeColor = getNodeColor(node.type);
      
      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI);
      ctx.fillStyle = nodeColor;
      ctx.fill();
      
      // Node border
      ctx.strokeStyle = selectedNode?.id === node.id ? '#2563eb' : '#6b7280';
      ctx.lineWidth = selectedNode?.id === node.id ? 3 : 1;
      ctx.stroke();
      
      // Node label
      ctx.fillStyle = '#374151';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(
        truncateLabel(node.label),
        node.x,
        node.y + nodeRadius + 15
      );
    });
  };

  const getNodeRadius = (node) => {
    switch (node.type) {
      case 'policy': return 8;
      case 'evidence': return 6;
      case 'site': return 10;
      case 'constraint': return 5;
      default: return 6;
    }
  };

  const getNodeColor = (type) => {
    switch (type) {
      case 'policy': return '#3b82f6';
      case 'evidence': return '#10b981';
      case 'site': return '#f59e0b';
      case 'constraint': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const truncateLabel = (label) => {
    return label.length > 15 ? label.substring(0, 12) + '...' : label;
  };

  const handleCanvasClick = (event) => {
    if (!graphData) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Find clicked node
    const clickedNode = graphData.nodes.find(node => {
      const distance = Math.sqrt(
        Math.pow(x - node.x, 2) + Math.pow(y - node.y, 2)
      );
      return distance <= getNodeRadius(node) + 5;
    });

    setSelectedNode(clickedNode || null);
  };

  const getConnectedNodes = (nodeId) => {
    if (!graphData) return [];
    
    const connections = graphData.edges.filter(
      edge => edge.source === nodeId || edge.target === nodeId
    );
    
    return connections.map(edge => 
      edge.source === nodeId ? edge.target : edge.source
    );
  };

  const getNodeStats = (node) => {
    if (!graphData) return {};
    
    const connections = getConnectedNodes(node.id);
    const strongConnections = graphData.edges.filter(
      edge => (edge.source === node.id || edge.target === node.id) && edge.weight > 0.7
    );

    return {
      totalConnections: connections.length,
      strongConnections: strongConnections.length,
      centrality: connections.length / graphData.nodes.length
    };
  };

  const exportGraph = () => {
    if (!graphData) return;
    
    const exportData = {
      nodes: graphData.nodes,
      edges: graphData.edges,
      metadata: {
        planId,
        generated: new Date().toISOString(),
        viewMode,
        filters
      }
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `knowledge-graph-${planId}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[95vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Knowledge Graph</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex h-full">
          {/* Controls Panel */}
          <div className="w-80 bg-gray-50 p-6 border-r overflow-y-auto">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  View Mode
                </label>
                <select
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                >
                  <option value="policies">Policy Network</option>
                  <option value="evidence">Evidence Connections</option>
                  <option value="full">Complete Graph</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Connection Strength
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={filters.minConnectionStrength}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    minConnectionStrength: parseFloat(e.target.value)
                  }))}
                  className="w-full"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Minimum: {filters.minConnectionStrength}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Node Types
                </label>
                <div className="space-y-2">
                  {['policy', 'evidence', 'site', 'constraint'].map(type => (
                    <label key={type} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.nodeTypes.includes(type)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters(prev => ({
                              ...prev,
                              nodeTypes: [...prev.nodeTypes, type]
                            }));
                          } else {
                            setFilters(prev => ({
                              ...prev,
                              nodeTypes: prev.nodeTypes.filter(t => t !== type)
                            }));
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="capitalize">{type}</span>
                      <div 
                        className="w-3 h-3 rounded-full ml-2"
                        style={{ backgroundColor: getNodeColor(type) }}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.showWeakConnections}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    showWeakConnections: e.target.checked
                  }))}
                  className="mr-2"
                />
                Show Weak Connections
              </label>

              <button
                onClick={loadGraphData}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Refresh Graph'}
              </button>

              <button
                onClick={exportGraph}
                disabled={!graphData}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Export Graph Data
              </button>

              {/* Node Details */}
              {selectedNode && (
                <div className="bg-white p-4 rounded-lg border">
                  <h3 className="font-semibold text-lg mb-2">
                    {selectedNode.label}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Type:</span> {selectedNode.type}
                    </div>
                    <div>
                      <span className="font-medium">ID:</span> {selectedNode.id}
                    </div>
                    {selectedNode.metadata && (
                      <>
                        {selectedNode.metadata.category && (
                          <div>
                            <span className="font-medium">Category:</span> {selectedNode.metadata.category}
                          </div>
                        )}
                        {selectedNode.metadata.policyRef && (
                          <div>
                            <span className="font-medium">Policy Ref:</span> {selectedNode.metadata.policyRef}
                          </div>
                        )}
                      </>
                    )}
                    
                    {(() => {
                      const stats = getNodeStats(selectedNode);
                      return (
                        <div className="mt-3 pt-3 border-t">
                          <div className="font-medium mb-2">Connection Stats:</div>
                          <div>Total: {stats.totalConnections}</div>
                          <div>Strong: {stats.strongConnections}</div>
                          <div>Centrality: {(stats.centrality * 100).toFixed(1)}%</div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Graph Statistics */}
              {graphData && (
                <div className="bg-white p-4 rounded-lg border">
                  <h3 className="font-semibold mb-2">Graph Statistics</h3>
                  <div className="space-y-1 text-sm">
                    <div>Nodes: {graphData.nodes.length}</div>
                    <div>Edges: {graphData.edges.length}</div>
                    <div>Avg Connections: {(graphData.edges.length * 2 / graphData.nodes.length).toFixed(1)}</div>
                    <div>Density: {((graphData.edges.length * 2) / (graphData.nodes.length * (graphData.nodes.length - 1)) * 100).toFixed(1)}%</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Graph Canvas */}
          <div className="flex-1 relative">
            {loading && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading knowledge graph...</p>
                </div>
              </div>
            )}

            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="w-full h-full cursor-pointer"
              style={{ minHeight: '600px' }}
            />

            {!loading && !graphData && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <p>Click "Refresh Graph" to load the knowledge network</p>
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-lg border">
              <h4 className="font-semibold mb-2 text-sm">Legend</h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                  Policy
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                  Evidence
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                  Site
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                  Constraint
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
