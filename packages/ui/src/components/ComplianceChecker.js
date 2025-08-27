import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Clock, 
  FileText, 
  Shield,
  TrendingUp,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

export default function ComplianceChecker({ 
  assessmentId, 
  localPlanId,
  onComplianceComplete,
  onError
}) {
  const [complianceCheck, setComplianceCheck] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedPolicies, setExpandedPolicies] = useState(new Set());
  const [activeTab, setActiveTab] = useState('overview');
  const [applicationData, setApplicationData] = useState(null);

  useEffect(() => {
    loadApplicationData();
  }, [assessmentId]);

  const loadApplicationData = async () => {
    try {
      const db = (await import('@tpa/core/src/database.js')).getDatabase();
      const assessment = await db.assessments.get(assessmentId);
      
      if (assessment) {
        const documents = await db.documents
          .where('id')
          .anyOf(assessment.documentIds)
          .toArray();
        
        setApplicationData({
          assessment,
          documents,
          documentCount: documents.length
        });
      }
    } catch (error) {
      console.error('Failed to load application data:', error);
      onError?.('Failed to load application data');
    }
  };

  const runComplianceCheck = async () => {
    if (!assessmentId || !localPlanId) {
      onError?.('Missing assessment or local plan ID');
      return;
    }

    setIsRunning(true);
    try {
      const PolicyComplianceEngine = (await import('@tpa/core/src/policy-compliance.js')).default;
      const engine = new PolicyComplianceEngine();
      
      const results = await engine.runComplianceCheck(assessmentId, localPlanId, {
        generateRecommendations: true,
        detailedAnalysis: true,
        includeGapAnalysis: true
      });
      
      setComplianceCheck(results);
      onComplianceComplete?.(results);
    } catch (error) {
      console.error('Compliance check failed:', error);
      onError?.('Compliance check failed: ' + error.message);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'compliant':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'mostly_compliant':
        return <CheckCircle2 className="h-5 w-5 text-blue-500" />;
      case 'partially_compliant':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'non_compliant':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'compliant':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'mostly_compliant':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'partially_compliant':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'non_compliant':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-blue-600';
    if (score >= 0.4) return 'text-yellow-600';
    return 'text-red-600';
  };

  const togglePolicyExpansion = (policyId) => {
    const newExpanded = new Set(expandedPolicies);
    if (newExpanded.has(policyId)) {
      newExpanded.delete(policyId);
    } else {
      newExpanded.add(policyId);
    }
    setExpandedPolicies(newExpanded);
  };

  const OverviewTab = () => {
    if (!complianceCheck) return null;

    return (
      <div className="space-y-6">
        {/* Overall Status */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Overall Compliance</h3>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(complianceCheck.status)}`}>
              {getStatusIcon(complianceCheck.status)}
              {complianceCheck.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className={`text-3xl font-bold ${getScoreColor(complianceCheck.overallScore)}`}>
                {Math.round(complianceCheck.overallScore * 100)}%
              </div>
              <div className="text-sm text-gray-500">Overall Score</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {complianceCheck.policyResults.length}
              </div>
              <div className="text-sm text-gray-500">Policies Evaluated</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {complianceCheck.policyResults.filter(p => p.status === 'compliant').length}
              </div>
              <div className="text-sm text-gray-500">Compliant</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {complianceCheck.policyResults.filter(p => p.status === 'non_compliant').length}
              </div>
              <div className="text-sm text-gray-500">Non-Compliant</div>
            </div>
          </div>
        </div>

        {/* Key Issues */}
        {complianceCheck.gapAnalysis && complianceCheck.gapAnalysis.critical.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <h3 className="text-lg font-medium text-red-900">Critical Issues</h3>
            </div>
            <div className="space-y-2">
              {complianceCheck.gapAnalysis.critical.map((gap, index) => (
                <div key={index} className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-red-900">{gap.policy}</div>
                    <div className="text-red-800">{gap.issue}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {complianceCheck.recommendations && complianceCheck.recommendations.immediate_actions.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-blue-900 mb-4">Immediate Actions Required</h3>
            <div className="space-y-3">
              {complianceCheck.recommendations.immediate_actions.map((action, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                    action.priority === 'high' ? 'bg-red-500' : 
                    action.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                  }`} />
                  <div>
                    <div className="font-medium text-blue-900">{action.action}</div>
                    <div className="text-sm text-blue-800">{action.timeline}</div>
                    {action.details && Array.isArray(action.details) && (
                      <ul className="mt-1 text-sm text-blue-700 list-disc list-inside">
                        {action.details.map((detail, i) => (
                          <li key={i}>{detail}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const PolicyResultsTab = () => {
    if (!complianceCheck) return null;

    return (
      <div className="space-y-4">
        {complianceCheck.policyResults.map((result, index) => (
          <div key={index} className="bg-white border border-gray-200 rounded-lg">
            <div 
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
              onClick={() => togglePolicyExpansion(result.policy.id)}
            >
              <div className="flex items-center gap-3">
                {expandedPolicies.has(result.policy.id) ? 
                  <ChevronDown className="h-4 w-4 text-gray-400" /> :
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                }
                {getStatusIcon(result.status)}
                <div>
                  <div className="font-medium text-gray-900">{result.policy.policyRef}</div>
                  <div className="text-sm text-gray-600">{result.policy.title}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className={`text-lg font-bold ${getScoreColor(result.complianceScore)}`}>
                    {Math.round(result.complianceScore * 100)}%
                  </div>
                  <div className="text-xs text-gray-500">
                    Relevance: {Math.round(result.relevance * 100)}%
                  </div>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(result.status)}`}>
                  {result.status.replace('_', ' ')}
                </div>
              </div>
            </div>

            {expandedPolicies.has(result.policy.id) && (
              <div className="border-t border-gray-200 p-4 bg-gray-50">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Compliance Details</h4>
                    <div className="space-y-3">
                      {result.compliance.criteria.map((criterion, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                            criterion.score >= 0.7 ? 'bg-green-500' :
                            criterion.score >= 0.4 ? 'bg-yellow-500' : 'bg-red-500'
                          }`} />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              {criterion.description}
                            </div>
                            <div className="text-xs text-gray-600">{criterion.reasoning}</div>
                            <div className={`text-xs font-medium ${getScoreColor(criterion.score)}`}>
                              Score: {Math.round(criterion.score * 100)}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Policy Requirements</h4>
                    <div className="space-y-2">
                      {result.compliance.requirements.slice(0, 3).map((req, i) => (
                        <div key={i} className="text-sm">
                          <div className="font-medium text-gray-700">{req.text}</div>
                          <div className="text-gray-600">{req.context}</div>
                        </div>
                      ))}
                    </div>

                    {result.compliance.strengths.length > 0 && (
                      <div className="mt-4">
                        <h5 className="text-sm font-medium text-green-700 mb-1">Strengths</h5>
                        <ul className="text-xs text-green-600 list-disc list-inside">
                          {result.compliance.strengths.slice(0, 2).map((strength, i) => (
                            <li key={i}>{strength}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.compliance.weaknesses.length > 0 && (
                      <div className="mt-4">
                        <h5 className="text-sm font-medium text-red-700 mb-1">Areas for Improvement</h5>
                        <ul className="text-xs text-red-600 list-disc list-inside">
                          {result.compliance.weaknesses.slice(0, 2).map((weakness, i) => (
                            <li key={i}>{weakness}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const RecommendationsTab = () => {
    if (!complianceCheck?.recommendations) return null;

    const { recommendations } = complianceCheck;

    return (
      <div className="space-y-6">
        {recommendations.immediate_actions.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Immediate Actions</h3>
            <div className="space-y-3">
              {recommendations.immediate_actions.map((action, index) => (
                <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="font-medium text-red-900">{action.action}</div>
                      <div className="text-sm text-red-800 mt-1">{action.timeline}</div>
                      {action.details && (
                        <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                          {action.details.map((detail, i) => (
                            <li key={i}>{detail}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {recommendations.improvements.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Suggested Improvements</h3>
            <div className="space-y-3">
              {recommendations.improvements.map((improvement, index) => (
                <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <TrendingUp className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="font-medium text-yellow-900">{improvement.action}</div>
                      {improvement.policy && (
                        <div className="text-sm text-yellow-800 mt-1">Policy: {improvement.policy}</div>
                      )}
                      {improvement.details && (
                        <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside">
                          {improvement.details.map((detail, i) => (
                            <li key={i}>{detail}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {recommendations.additional_evidence.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Evidence Required</h3>
            <div className="space-y-3">
              {recommendations.additional_evidence.map((evidence, index) => (
                <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="font-medium text-blue-900">{evidence.action}</div>
                      <div className="text-sm text-blue-800 mt-1">{evidence.timeline}</div>
                      {evidence.details && (
                        <ul className="mt-2 text-sm text-blue-700 list-disc list-inside">
                          {evidence.details.map((detail, i) => (
                            <li key={i}>{detail}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const TabButton = ({ id, label, count = null }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        activeTab === id
          ? 'border-blue-500 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {label}
      {count !== null && (
        <span className={`px-2 py-0.5 text-xs rounded-full ${
          activeTab === id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
        }`}>
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div className="bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Policy Compliance Check</h2>
            {applicationData && (
              <p className="text-sm text-gray-600 mt-1">
                {applicationData.documentCount} documents uploaded • 
                Site: {applicationData.assessment.siteAddress}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {complianceCheck && (
              <button
                onClick={runComplianceCheck}
                disabled={isRunning}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100"
              >
                <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
                Re-run Check
              </button>
            )}

            <button
              onClick={runComplianceCheck}
              disabled={isRunning}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Running Check...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4" />
                  Run Compliance Check
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {!complianceCheck && !isRunning ? (
        <div className="text-center py-12">
          <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Ready to Check Policy Compliance
          </h3>
          <p className="text-gray-600 mb-6">
            Run a comprehensive policy compliance check against the selected local plan.
          </p>
          <button
            onClick={runComplianceCheck}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Shield className="h-5 w-5" />
            Start Compliance Check
          </button>
        </div>
      ) : isRunning ? (
        <div className="text-center py-12">
          <RefreshCw className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Running Compliance Check
          </h3>
          <p className="text-gray-600">
            Analyzing application against local plan policies...
          </p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="flex space-x-1">
              <TabButton id="overview" label="Overview" />
              <TabButton 
                id="policies" 
                label="Policy Results" 
                count={complianceCheck?.policyResults?.length} 
              />
              <TabButton 
                id="recommendations" 
                label="Recommendations" 
                count={
                  complianceCheck?.recommendations ? 
                  (complianceCheck.recommendations.immediate_actions?.length || 0) +
                  (complianceCheck.recommendations.improvements?.length || 0) +
                  (complianceCheck.recommendations.additional_evidence?.length || 0) : 0
                }
              />
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'policies' && <PolicyResultsTab />}
          {activeTab === 'recommendations' && <RecommendationsTab />}
        </>
      )}
    </div>
  );
}
