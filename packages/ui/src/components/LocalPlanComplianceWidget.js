import React, { useState, useEffect } from 'react';
import { Shield, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import ComplianceChecker from '@tpa/ui/src/components/ComplianceChecker';

export default function LocalPlanComplianceWidget({ 
  assessment, 
  onComplianceResults,
  className = ""
}) {
  const [localPlans, setLocalPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [showChecker, setShowChecker] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    loadLocalPlans();
  }, []);

  const loadLocalPlans = async () => {
    try {
      const LocalPlanManager = (await import('@tpa/core/src/local-plan-manager.js')).default;
      const manager = new LocalPlanManager();
      const plans = await manager.listLocalPlans();
      setLocalPlans(plans);
      
      // Auto-select first plan if available
      if (plans.length > 0) {
        setSelectedPlanId(plans[0].id);
      }
    } catch (error) {
      console.error('Failed to load local plans:', error);
    }
  };

  if (!assessment) {
    return null;
  }

  return (
    <div className={`bg-white/80 backdrop-blur-sm border border-zinc-200/60 rounded-xl shadow-sm ${className}`}>
      <div 
        className="p-4 border-b border-zinc-200 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
            <Shield className="h-5 w-5 text-blue-600" />
            <div>
              <h4 className="font-semibold text-zinc-900">Local Plan Compliance</h4>
              <p className="text-sm text-zinc-600">Check against adopted local plan policies</p>
            </div>
          </div>
          {selectedPlanId && (
            <div className="text-sm text-blue-600">
              {localPlans.find(p => p.id === selectedPlanId)?.name || 'Local Plan'}
            </div>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="p-4">
          {localPlans.length === 0 ? (
            <div className="text-center py-6">
              <Shield className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600 text-sm mb-3">No local plans available</p>
              <a
                href="/tool/local-plan"
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
              >
                <ExternalLink className="h-4 w-4" />
                Set up local plan mode
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Local Plan
                </label>
                <select
                  value={selectedPlanId || ''}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  {localPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} ({plan.status})
                    </option>
                  ))}
                </select>
              </div>

              {selectedPlanId && (
                <div>
                  <button
                    onClick={() => setShowChecker(true)}
                    disabled={!assessment.id}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {showChecker ? 'Compliance Check Active' : 'Run Compliance Check'}
                  </button>
                  
                  {!assessment.id && (
                    <p className="text-xs text-gray-500 mt-1">
                      Complete assessment first to run compliance check
                    </p>
                  )}
                </div>
              )}

              {showChecker && selectedPlanId && assessment.id && (
                <div className="mt-4 border-t border-gray-200 pt-4">
                  <ComplianceChecker
                    assessmentId={assessment.id}
                    localPlanId={selectedPlanId}
                    onComplianceComplete={(results) => {
                      console.log('Compliance results:', results);
                      onComplianceResults?.(results);
                    }}
                    onError={(error) => {
                      console.error('Compliance error:', error);
                      alert(error);
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
