import React, { useState, useEffect, useRef } from 'react';
import ReportGenerator from '@tpa/core/src/report-generator.js';

/**
 * ReportsPanel
 * Advanced reporting interface for local plan analysis and topic papers
 */
export default function ReportsPanel({ planId, onClose }) {
  const [reportType, setReportType] = useState('topicPaper');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [reportOptions, setReportOptions] = useState({
    topic: 'housing',
    includeEvidence: true,
    includePolicies: true,
    format: 'html'
  });
  const [availableTopics, setAvailableTopics] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const reportGenerator = useRef(new ReportGenerator());

  useEffect(() => {
    loadData();
  }, [planId]);

  const loadData = async () => {
    try {
      // Load available data for report generation
      const db = reportGenerator.current.db;
      const [policiesData, scenariosData] = await Promise.all([
        db.localPlanPolicies.where('planId').equals(planId).toArray(),
        db.scenarios.where('planId').equals(planId).toArray()
      ]);

      setPolicies(policiesData);
      setScenarios(scenariosData);

      // Extract available topics from policies
      const topics = [...new Set(policiesData.map(p => p.category?.toLowerCase()).filter(Boolean))];
      setAvailableTopics(topics);
    } catch (error) {
      console.error('Failed to load report data:', error);
    }
  };

  const generateReport = async () => {
    if (!planId) return;
    
    setLoading(true);
    try {
      let generatedReport;
      
      switch (reportType) {
        case 'topicPaper':
          generatedReport = await reportGenerator.current.generateTopicPaper(
            planId, 
            reportOptions.topic,
            reportOptions
          );
          break;
          
        case 'evidenceBaseSummary':
          generatedReport = await reportGenerator.current.generateEvidenceBaseSummary(
            planId,
            reportOptions
          );
          break;
          
        case 'policyImpactReport':
          if (reportOptions.selectedPolicyId) {
            generatedReport = await reportGenerator.current.generatePolicyImpactReport(
              planId,
              reportOptions.selectedPolicyId,
              reportOptions
            );
          }
          break;
          
        case 'complianceDashboard':
          generatedReport = await reportGenerator.current.generateComplianceDashboard(
            planId,
            reportOptions
          );
          break;
          
        case 'scenarioComparison':
          if (reportOptions.selectedScenarios?.length >= 2) {
            generatedReport = await reportGenerator.current.generateScenarioComparisonReport(
              reportOptions.selectedScenarios,
              reportOptions
            );
          }
          break;
          
        default:
          throw new Error('Unknown report type');
      }
      
      setReport(generatedReport);
    } catch (error) {
      console.error('Report generation failed:', error);
      alert(`Failed to generate report: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    if (!report) return;
    
    const blob = new Blob([report], { 
      type: reportOptions.format === 'html' ? 'text/html' : 'text/plain' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${reportType}-${Date.now()}.${reportOptions.format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderReportOptions = () => {
    switch (reportType) {
      case 'topicPaper':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Topic
              </label>
              <select
                value={reportOptions.topic}
                onChange={(e) => setReportOptions(prev => ({ ...prev, topic: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-lg"
              >
                {availableTopics.map(topic => (
                  <option key={topic} value={topic}>
                    {topic.charAt(0).toUpperCase() + topic.slice(1)}
                  </option>
                ))}
                <option value="housing">Housing</option>
                <option value="transport">Transport</option>
                <option value="environment">Environment</option>
                <option value="economy">Economy</option>
                <option value="heritage">Heritage</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={reportOptions.includeEvidence}
                  onChange={(e) => setReportOptions(prev => ({ 
                    ...prev, 
                    includeEvidence: e.target.checked 
                  }))}
                  className="mr-2"
                />
                Include Evidence Base
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={reportOptions.includePolicies}
                  onChange={(e) => setReportOptions(prev => ({ 
                    ...prev, 
                    includePolicies: e.target.checked 
                  }))}
                  className="mr-2"
                />
                Include Policy Framework
              </label>
            </div>
          </div>
        );
        
      case 'policyImpactReport':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Policy
            </label>
            <select
              value={reportOptions.selectedPolicyId || ''}
              onChange={(e) => setReportOptions(prev => ({ 
                ...prev, 
                selectedPolicyId: e.target.value 
              }))}
              className="w-full p-2 border border-gray-300 rounded-lg"
            >
              <option value="">Select a policy...</option>
              {policies.map(policy => (
                <option key={policy.id} value={policy.id}>
                  {policy.policyRef}: {policy.title}
                </option>
              ))}
            </select>
          </div>
        );
        
      case 'scenarioComparison':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Scenarios (minimum 2)
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {scenarios.map(scenario => (
                <label key={scenario.id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={reportOptions.selectedScenarios?.includes(scenario.id) || false}
                    onChange={(e) => {
                      const selected = reportOptions.selectedScenarios || [];
                      if (e.target.checked) {
                        setReportOptions(prev => ({
                          ...prev,
                          selectedScenarios: [...selected, scenario.id]
                        }));
                      } else {
                        setReportOptions(prev => ({
                          ...prev,
                          selectedScenarios: selected.filter(id => id !== scenario.id)
                        }));
                      }
                    }}
                    className="mr-2"
                  />
                  {scenario.name}
                </label>
              ))}
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  const canGenerateReport = () => {
    switch (reportType) {
      case 'policyImpactReport':
        return reportOptions.selectedPolicyId;
      case 'scenarioComparison':
        return reportOptions.selectedScenarios?.length >= 2;
      default:
        return true;
    }
  };

  const renderDashboardReport = (dashboardData) => {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-900">
              {dashboardData.summary.totalChecks}
            </div>
            <div className="text-sm text-blue-600">Total Checks</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-900">
              {dashboardData.summary.compliantApplications}
            </div>
            <div className="text-sm text-green-600">Compliant</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-yellow-900">
              {dashboardData.summary.averageScore.toFixed(1)}
            </div>
            <div className="text-sm text-yellow-600">Average Score</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-900">
              {dashboardData.summary.trendsData.trend}
            </div>
            <div className="text-sm text-purple-600">Trend</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-4 rounded-lg border">
            <h3 className="text-lg font-semibold mb-3">Policy Performance</h3>
            <div className="space-y-2">
              {dashboardData.policyPerformance.slice(0, 5).map(policy => (
                <div key={policy.policyRef} className="flex justify-between items-center">
                  <span className="text-sm">{policy.policyRef}</span>
                  <span className="text-sm font-medium">
                    {policy.averageScore.toFixed(1)} ({policy.checksCount} checks)
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border">
            <h3 className="text-lg font-semibold mb-3">Recent Activity</h3>
            <div className="space-y-2">
              {dashboardData.recentActivity.slice(0, 5).map(activity => (
                <div key={activity.id} className="flex justify-between items-center text-sm">
                  <span>App {activity.applicationId}</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    activity.status === 'compliant' 
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {activity.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {dashboardData.keyIssues.length > 0 && (
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <h3 className="text-lg font-semibold text-red-900 mb-3">Key Issues</h3>
            <ul className="space-y-2">
              {dashboardData.keyIssues.map((issue, index) => (
                <li key={index} className="text-red-800">
                  • {issue.description} ({issue.count} instances)
                </li>
              ))}
            </ul>
          </div>
        )}

        {dashboardData.recommendations.length > 0 && (
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">Recommendations</h3>
            <ul className="space-y-2">
              {dashboardData.recommendations.map((rec, index) => (
                <li key={index} className="text-blue-800">• {rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Reports & Analysis</h2>
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
          {/* Sidebar */}
          <div className="w-80 bg-gray-50 p-6 border-r">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Report Type
                </label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                >
                  <option value="topicPaper">Topic Paper</option>
                  <option value="evidenceBaseSummary">Evidence Base Summary</option>
                  <option value="policyImpactReport">Policy Impact Report</option>
                  <option value="complianceDashboard">Compliance Dashboard</option>
                  <option value="scenarioComparison">Scenario Comparison</option>
                </select>
              </div>

              {renderReportOptions()}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Format
                </label>
                <select
                  value={reportOptions.format}
                  onChange={(e) => setReportOptions(prev => ({ ...prev, format: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                >
                  <option value="html">HTML</option>
                  <option value="markdown">Markdown</option>
                  <option value="json">JSON</option>
                </select>
              </div>

              <button
                onClick={generateReport}
                disabled={loading || !canGenerateReport()}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Generating...' : 'Generate Report'}
              </button>

              {report && (
                <button
                  onClick={downloadReport}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700"
                >
                  Download Report
                </button>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Generating report...</p>
                </div>
              </div>
            )}

            {!loading && !report && (
              <div className="text-center text-gray-500 h-64 flex items-center justify-center">
                <div>
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>Select report options and click "Generate Report" to begin</p>
                </div>
              </div>
            )}

            {!loading && report && (
              <div className="space-y-6">
                {reportType === 'complianceDashboard' && typeof report === 'object' ? (
                  renderDashboardReport(report)
                ) : (
                  <div 
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={{ 
                      __html: typeof report === 'string' ? report : JSON.stringify(report, null, 2)
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
