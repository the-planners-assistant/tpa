import Head from 'next/head';
import { useState, useEffect } from 'react';
import { 
  Plus, 
  Upload, 
  FileText, 
  Map, 
  BarChart3, 
  Network, 
  Settings,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Target,
  TreePine,
  Database
} from 'lucide-react';
import PolicyUpload from '@tpa/ui/src/components/PolicyUpload';
import PolicyBrowser from '@tpa/ui/src/components/PolicyBrowser';
import ScenarioBuilder from '@tpa/ui/src/components/ScenarioBuilder';
import ReportsPanel from '../../src/components/ReportsPanel';
import KnowledgeGraphVisualization from '../../src/components/KnowledgeGraphVisualization';

export default function LocalPlan() {
  const [activeLocalPlan, setActiveLocalPlan] = useState(null);
  const [localPlans, setLocalPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [stats, setStats] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [siteAllocations, setSiteAllocations] = useState([]);
  const [evidenceBase, setEvidenceBase] = useState([]);
  const [showReportsPanel, setShowReportsPanel] = useState(false);
  const [showKnowledgeGraph, setShowKnowledgeGraph] = useState(false);

  // Load local plans
  useEffect(() => {
    const loadLocalPlans = async () => {
      try {
        const LocalPlanManager = (await import('@tpa/core/src/local-plan-manager.js')).default;
        const manager = new LocalPlanManager();
        
        const plans = await manager.listLocalPlans();
        setLocalPlans(plans);
        
        // Auto-select first plan if available
        if (plans.length > 0 && !activeLocalPlan) {
          setActiveLocalPlan(plans[0]);
        }
        
      } catch (error) {
        console.error('Failed to load local plans:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLocalPlans();
  }, [activeLocalPlan]);

  // Load plan statistics and related data
  useEffect(() => {
    const loadStats = async () => {
      if (!activeLocalPlan) return;
      
      try {
        const LocalPlanManager = (await import('@tpa/core/src/local-plan-manager.js')).default;
        const ScenarioModeler = (await import('@tpa/core/src/scenario-modeler.js')).default;
        const manager = new LocalPlanManager();
        const modeler = new ScenarioModeler();
        
        const [planStats, planScenarios, allocations, evidence] = await Promise.all([
          manager.getPolicyStats(activeLocalPlan.id),
          modeler.getScenarios(activeLocalPlan.id),
          manager.getSiteAllocations(activeLocalPlan.id),
          manager.getEvidenceBase(activeLocalPlan.id)
        ]);
        
        setStats(planStats);
        setScenarios(planScenarios);
        setSiteAllocations(allocations);
        setEvidenceBase(evidence);
      } catch (error) {
        console.error('Failed to load plan data:', error);
      }
    };

    loadStats();
  }, [activeLocalPlan]);

  // Create new local plan
  const handleCreatePlan = async (planData) => {
    try {
      const LocalPlanManager = (await import('@tpa/core/src/local-plan-manager.js')).default;
      const manager = new LocalPlanManager();
      
      const newPlan = await manager.createLocalPlan(planData);
      setLocalPlans(prev => [newPlan, ...prev]);
      setActiveLocalPlan(newPlan);
      setShowCreatePlan(false);
    } catch (error) {
      console.error('Failed to create local plan:', error);
      alert('Failed to create local plan. Please try again.');
    }
  };

  // Tab content components
  const TabContent = () => {
    switch (activeTab) {
      case 'policies':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Policy Management</h3>
              <button
                onClick={() => setActiveTab('upload')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Upload className="h-4 w-4" />
                Upload Policies
              </button>
            </div>
            
            {activeLocalPlan && (
              <PolicyBrowser
                planId={activeLocalPlan.id}
                onPolicySelect={(policy) => console.log('Selected:', policy)}
                onPolicyEdit={(policy) => console.log('Edit:', policy)}
                showReferences={true}
                showHierarchy={true}
              />
            )}
          </div>
        );

      case 'upload':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Upload Policy Documents</h3>
              <button
                onClick={() => setActiveTab('policies')}
                className="text-blue-600 hover:text-blue-700"
              >
                Back to Policies
              </button>
            </div>
            
            {activeLocalPlan && (
              <PolicyUpload
                planId={activeLocalPlan.id}
                onUploadComplete={(results) => {
                  console.log('Upload complete:', results);
                  setActiveTab('policies'); // Return to policies view
                }}
                onError={(error) => {
                  console.error('Upload error:', error);
                  alert(error);
                }}
              />
            )}
          </div>
        );

      case 'allocations':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Site Allocations</h3>
              <button
                onClick={() => {
                  // TODO: Implement site allocation creation
                  alert('Site allocation creation will be implemented in the next update');
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add Site
              </button>
            </div>

            {siteAllocations.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <Map className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">No site allocations yet</h4>
                <p className="text-gray-600 mb-6">
                  Add site allocations to define development opportunities within your local plan.
                </p>
                <button
                  onClick={() => {
                    alert('Site allocation creation will be implemented in the next update');
                  }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Plus className="h-5 w-5" />
                  Add First Site
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {siteAllocations.map((site) => (
                  <div
                    key={site.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-medium text-gray-900">{site.name}</h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        site.status === 'allocated' ? 'bg-green-100 text-green-700' :
                        site.status === 'proposed' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {site.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{site.siteRef}</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Capacity:</span>
                        <span className="font-medium">{site.capacity || 'TBD'} units</span>
                      </div>
                      {site.constraints && site.constraints.length > 0 && (
                        <div>
                          <span className="text-xs text-gray-500">Constraints:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {site.constraints.slice(0, 3).map((constraint, i) => (
                              <span key={i} className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                                {constraint}
                              </span>
                            ))}
                            {site.constraints.length > 3 && (
                              <span className="text-xs text-gray-500">+{site.constraints.length - 3} more</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'evidence':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Evidence Base</h3>
              <button
                onClick={() => {
                  // TODO: Implement evidence upload
                  alert('Evidence base upload will be implemented in the next update');
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Upload className="h-4 w-4" />
                Upload Evidence
              </button>
            </div>

            {evidenceBase.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">No evidence documents yet</h4>
                <p className="text-gray-600 mb-6">
                  Upload evidence base documents to support your local plan policies.
                </p>
                <button
                  onClick={() => {
                    alert('Evidence base upload will be implemented in the next update');
                  }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Upload className="h-5 w-5" />
                  Upload First Document
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {Object.entries(
                    evidenceBase.reduce((acc, doc) => {
                      acc[doc.category] = (acc[doc.category] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([category, count]) => (
                    <div key={category} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="text-lg font-semibold text-gray-900">{count}</div>
                      <div className="text-sm text-gray-600 capitalize">{category} documents</div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  {evidenceBase.map((doc) => (
                    <div
                      key={doc.id}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{doc.title}</h4>
                          <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                            <span className="capitalize">{doc.category}</span>
                            <span>{doc.fileType?.toUpperCase()}</span>
                            <span>{new Date(doc.uploadDate).toLocaleDateString()}</span>
                          </div>
                          {doc.linkedPolicyIds && doc.linkedPolicyIds.length > 0 && (
                            <div className="mt-2">
                              <span className="text-xs text-gray-500">Linked to {doc.linkedPolicyIds.length} policies</span>
                            </div>
                          )}
                        </div>
                        <button className="text-blue-600 hover:text-blue-700">
                          <FileText className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'scenarios':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Scenario Modeling</h3>
              <button
                onClick={() => setSelectedScenario('new')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                New Scenario
              </button>
            </div>

            {selectedScenario ? (
              <ScenarioBuilder
                planId={activeLocalPlan.id}
                scenarioId={selectedScenario === 'new' ? null : selectedScenario}
                onScenarioSaved={(scenario) => {
                  setScenarios(prev => {
                    const existing = prev.find(s => s.id === scenario.id);
                    if (existing) {
                      return prev.map(s => s.id === scenario.id ? scenario : s);
                    } else {
                      return [scenario, ...prev];
                    }
                  });
                  setSelectedScenario(scenario.id);
                }}
                onScenarioRun={(results) => {
                  console.log('Scenario results:', results);
                }}
                onError={(error) => {
                  console.error('Scenario error:', error);
                  alert(error);
                }}
              />
            ) : (
              <div>
                {scenarios.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No scenarios yet</h4>
                    <p className="text-gray-600 mb-6">
                      Create your first scenario to explore different development options for your local plan.
                    </p>
                    <button
                      onClick={() => setSelectedScenario('new')}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      <Plus className="h-5 w-5" />
                      Create First Scenario
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {scenarios.map((scenario) => (
                      <div
                        key={scenario.id}
                        className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
                        onClick={() => setSelectedScenario(scenario.id)}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="font-medium text-gray-900">{scenario.name}</h4>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            scenario.status === 'modeled' ? 'bg-green-100 text-green-700' :
                            scenario.status === 'error' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {scenario.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{scenario.description}</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-500">Housing:</span>
                            <span className="font-medium ml-1">{scenario.parameters.housing.totalUnits}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Jobs:</span>
                            <span className="font-medium ml-1">{scenario.parameters.employment.totalJobs}</span>
                          </div>
                        </div>
                        {scenario.results && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">Success Rate:</span>
                              <span className={`font-medium ${
                                scenario.results.summary.successProbability >= 70 ? 'text-green-600' :
                                scenario.results.summary.successProbability >= 50 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {scenario.results.summary.successProbability}%
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'knowledge-graph':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Policy Knowledge Graph</h3>
              <button
                onClick={() => setShowKnowledgeGraph(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Network className="h-4 w-4" />
                View Interactive Graph
              </button>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <p className="text-gray-600 mb-4">
                Explore the relationships between policies, evidence documents, and site allocations 
                through an interactive knowledge graph visualization.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <Network className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <div className="font-medium text-blue-900">Policy Network</div>
                  <div className="text-sm text-blue-600">Explore policy relationships</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <Database className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <div className="font-medium text-green-900">Evidence Links</div>
                  <div className="text-sm text-green-600">See evidence connections</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <Target className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                  <div className="font-medium text-purple-900">Site Analysis</div>
                  <div className="text-sm text-purple-600">Analyze site relationships</div>
                </div>
              </div>
              
              <button
                onClick={() => setShowKnowledgeGraph(true)}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700"
              >
                Launch Knowledge Graph Visualization
              </button>
            </div>
          </div>
        );

      case 'reports':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Reports & Analysis</h3>
              <button
                onClick={() => setShowReportsPanel(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <FileText className="h-4 w-4" />
                Generate Report
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <FileText className="h-8 w-8 text-blue-600 mr-3" />
                  <h4 className="text-lg font-medium">Topic Papers</h4>
                </div>
                <p className="text-gray-600 mb-4">
                  Generate comprehensive topic papers for specific policy areas like housing, transport, or environment.
                </p>
                <button
                  onClick={() => setShowReportsPanel(true)}
                  className="w-full bg-blue-50 text-blue-700 py-2 px-4 rounded-md hover:bg-blue-100"
                >
                  Generate Topic Paper
                </button>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <Database className="h-8 w-8 text-green-600 mr-3" />
                  <h4 className="text-lg font-medium">Evidence Base Summary</h4>
                </div>
                <p className="text-gray-600 mb-4">
                  Comprehensive summary of all evidence documents and their relationships to policies.
                </p>
                <button
                  onClick={() => setShowReportsPanel(true)}
                  className="w-full bg-green-50 text-green-700 py-2 px-4 rounded-md hover:bg-green-100"
                >
                  Create Summary
                </button>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <BarChart3 className="h-8 w-8 text-purple-600 mr-3" />
                  <h4 className="text-lg font-medium">Policy Impact Reports</h4>
                </div>
                <p className="text-gray-600 mb-4">
                  Detailed analysis of individual policy effectiveness and implementation outcomes.
                </p>
                <button
                  onClick={() => setShowReportsPanel(true)}
                  className="w-full bg-purple-50 text-purple-700 py-2 px-4 rounded-md hover:bg-purple-100"
                >
                  Analyze Impact
                </button>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <CheckCircle2 className="h-8 w-8 text-orange-600 mr-3" />
                  <h4 className="text-lg font-medium">Compliance Dashboard</h4>
                </div>
                <p className="text-gray-600 mb-4">
                  Real-time dashboard showing policy compliance rates and application assessment trends.
                </p>
                <button
                  onClick={() => setShowReportsPanel(true)}
                  className="w-full bg-orange-50 text-orange-700 py-2 px-4 rounded-md hover:bg-orange-100"
                >
                  View Dashboard
                </button>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <Target className="h-8 w-8 text-indigo-600 mr-3" />
                  <h4 className="text-lg font-medium">Scenario Comparison</h4>
                </div>
                <p className="text-gray-600 mb-4">
                  Compare multiple planning scenarios to identify optimal development strategies.
                </p>
                <button
                  onClick={() => setShowReportsPanel(true)}
                  className="w-full bg-indigo-50 text-indigo-700 py-2 px-4 rounded-md hover:bg-indigo-100"
                >
                  Compare Scenarios
                </button>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <Map className="h-8 w-8 text-emerald-600 mr-3" />
                  <h4 className="text-lg font-medium">Site Assessment Report</h4>
                </div>
                <p className="text-gray-600 mb-4">
                  Comprehensive site suitability analysis with multi-criteria assessment results.
                </p>
                <button
                  onClick={() => setShowReportsPanel(true)}
                  className="w-full bg-emerald-50 text-emerald-700 py-2 px-4 rounded-md hover:bg-emerald-100"
                >
                  Assess Sites
                </button>
              </div>
            </div>
          </div>
        );

      default: // overview
        return (
          <div className="space-y-6">
            {/* Quick actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <button
                onClick={() => setActiveTab('upload')}
                className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center space-x-3">
                  <Upload className="h-8 w-8 text-blue-600" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Upload Policies</p>
                    <p className="text-sm text-gray-500">Add new policy documents</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </button>

              <button
                onClick={() => setActiveTab('policies')}
                className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center space-x-3">
                  <FileText className="h-8 w-8 text-green-600" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Browse Policies</p>
                    <p className="text-sm text-gray-500">View and manage policies</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </button>

              <button
                onClick={() => setActiveTab('scenarios')}
                className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center space-x-3">
                  <BarChart3 className="h-8 w-8 text-orange-600" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Scenarios</p>
                    <p className="text-sm text-gray-500">Model plan scenarios</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </button>

              <button
                onClick={() => setShowReportsPanel(true)}
                className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center space-x-3">
                  <FileText className="h-8 w-8 text-purple-600" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Generate Reports</p>
                    <p className="text-sm text-gray-500">Topic papers & analysis</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </button>

              <button
                onClick={() => setShowKnowledgeGraph(true)}
                className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center space-x-3">
                  <Network className="h-8 w-8 text-indigo-600" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Knowledge Graph</p>
                    <p className="text-sm text-gray-500">Explore relationships</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </button>

              <button
                onClick={() => setActiveTab('allocations')}
                className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center space-x-3">
                  <Map className="h-8 w-8 text-emerald-600" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Site Allocations</p>
                    <p className="text-sm text-gray-500">Manage site allocations</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            {/* Plan statistics */}
            {stats && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Plan Statistics</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{stats.totalPolicies}</div>
                    <div className="text-sm text-gray-500">Total Policies</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.totalAllocations}</div>
                    <div className="text-sm text-gray-500">Site Allocations</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{stats.totalEvidence}</div>
                    <div className="text-sm text-gray-500">Evidence Documents</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{stats.totalCapacity}</div>
                    <div className="text-sm text-gray-500">Total Capacity</div>
                  </div>
                </div>
                
                {/* Category breakdown */}
                {Object.keys(stats.categories).length > 0 && (
                  <div className="mt-6">
                    <h5 className="font-medium text-gray-900 mb-3">Policies by Category</h5>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                      {Object.entries(stats.categories).map(([category, count]) => (
                        <div key={category} className="bg-gray-50 rounded-lg p-3 text-center">
                          <div className="font-medium text-gray-900">{count}</div>
                          <div className="text-xs text-gray-500 capitalize">{category}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Recent activity placeholder */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h4>
              <div className="space-y-3">
                <div className="flex items-center space-x-3 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-gray-600">Local plan created</span>
                  <span className="text-gray-400">• Just now</span>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <Head>
        <title>Local Plan Tool - TPA</title>
        <meta name="description" content="Comprehensive local plan management and policy analysis" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-h1 font-h1 mb-2">Local Plan Management</h1>
              <p className="text-gray-600">
                Comprehensive policy management, scenario modeling, and evidence base organization
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Plan selector */}
              {localPlans.length > 0 && (
                <select
                  value={activeLocalPlan?.id || ''}
                  onChange={(e) => {
                    const plan = localPlans.find(p => p.id === parseInt(e.target.value));
                    setActiveLocalPlan(plan);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Local Plan</option>
                  {localPlans.map(plan => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} ({plan.status})
                    </option>
                  ))}
                </select>
              )}

              <button
                onClick={() => setShowCreatePlan(true)}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                New Plan
              </button>
            </div>
          </div>

          {/* Main content */}
          {!activeLocalPlan ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Local Plan Selected</h3>
              <p className="text-gray-500 mb-6">
                Create a new local plan or select an existing one to get started.
              </p>
              <button
                onClick={() => setShowCreatePlan(true)}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Create Local Plan
              </button>
            </div>
          ) : (
            <>
              {/* Tab navigation */}
              <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                  {[
                    { id: 'overview', label: 'Overview', icon: BarChart3 },
                    { id: 'policies', label: 'Policies', icon: FileText },
                    { id: 'upload', label: 'Upload', icon: Upload },
                    { id: 'allocations', label: 'Allocations', icon: Map },
                    { id: 'evidence', label: 'Evidence', icon: Database },
                    { id: 'scenarios', label: 'Scenarios', icon: BarChart3 },
                    { id: 'knowledge-graph', label: 'Knowledge Graph', icon: Network },
                    { id: 'reports', label: 'Reports', icon: FileText }
                  ].map(tab => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                          activeTab === tab.id
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Tab content */}
              <TabContent />
            </>
          )}
        </div>
      </main>

      {/* Create Plan Modal */}
      {showCreatePlan && (
        <CreatePlanModal
          onClose={() => setShowCreatePlan(false)}
          onCreate={handleCreatePlan}
        />
      )}

      {/* Reports Panel */}
      {showReportsPanel && (
        <ReportsPanel
          planId={activeLocalPlan?.id}
          onClose={() => setShowReportsPanel(false)}
        />
      )}

      {/* Knowledge Graph Visualization */}
      {showKnowledgeGraph && (
        <KnowledgeGraphVisualization
          planId={activeLocalPlan?.id}
          onClose={() => setShowKnowledgeGraph(false)}
        />
      )}
    </div>
  );
}

// Create Plan Modal Component
function CreatePlanModal({ onClose, onCreate }) {
  const [formData, setFormData] = useState({
    name: '',
    authorityCode: '',
    adoptionDate: '',
    status: 'draft'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.authorityCode) {
      alert('Please fill in required fields');
      return;
    }
    onCreate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Local Plan</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Plan Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Cambridge Local Plan 2040"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Authority Code *
            </label>
            <input
              type="text"
              value={formData.authorityCode}
              onChange={(e) => setFormData(prev => ({ ...prev, authorityCode: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Cambridge"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Adoption Date
            </label>
            <input
              type="date"
              value={formData.adoptionDate}
              onChange={(e) => setFormData(prev => ({ ...prev, adoptionDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="draft">Draft</option>
              <option value="consultation">Consultation</option>
              <option value="examination">Examination</option>
              <option value="adopted">Adopted</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
            >
              Create Plan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
