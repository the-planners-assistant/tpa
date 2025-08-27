import React from 'react';
import { assessmentStore } from './assessmentStore.js';

export function ProcessingProgressBar() {
  const [phases, setPhases] = React.useState(assessmentStore.getState().phases);
  const [isExpanded, setIsExpanded] = React.useState(false);
  
  React.useEffect(() => assessmentStore.subscribe(s => setPhases(s.phases)), []);
  
  const activePhase = phases.find(p => p.status === 'running');
  const completedCount = phases.filter(p => p.status === 'complete').length;
  const overallProgress = completedCount / phases.length;
  const hasAnyActivity = phases.some(p => p.status !== 'pending');

  if (!hasAnyActivity) {
    return (
      <div className="text-center py-2">
        <div className="text-sm text-zinc-500">Ready to process documents</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Compact Progress Bar */}
      <div className="relative">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-zinc-700">
                {activePhase ? `Processing: ${activePhase.label}` : 
                 completedCount === phases.length ? 'Assessment Complete' : 'Processing...'}
              </div>
              <div className="text-xs text-zinc-500">
                {completedCount}/{phases.length} phases
              </div>
            </div>
            
            {/* Overall Progress Bar */}
            <div className="w-full bg-zinc-200 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${
                  completedCount === phases.length ? 'bg-emerald-500' : 'bg-blue-500'
                }`}
                style={{ width: `${overallProgress * 100}%` }}
              />
            </div>
            
            {/* Active Phase Detail */}
            {activePhase && activePhase.progress > 0 && (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <div className="text-xs text-zinc-600">
                    {activePhase.label}: {(activePhase.progress * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="w-full bg-blue-100 rounded-full h-1 mt-1">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                    style={{ width: `${activePhase.progress * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-zinc-400 hover:text-zinc-600 transition-colors"
            title="Show/hide phase details"
          >
            {isExpanded ? '⌄' : '⌃'}
          </button>
        </div>
      </div>

      {/* Expanded Phase Details */}
      {isExpanded && (
        <div className="bg-white/80 border border-zinc-200 rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-semibold text-zinc-700 mb-3">Processing Phases</h4>
          <div className="grid gap-2">
            {phases.map((phase, index) => (
              <div key={phase.id} className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {phase.status === 'complete' && (
                    <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                  {phase.status === 'running' && (
                    <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    </div>
                  )}
                  {phase.status === 'error' && (
                    <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✗</span>
                    </div>
                  )}
                  {phase.status === 'pending' && (
                    <div className="w-5 h-5 bg-zinc-300 rounded-full flex items-center justify-center">
                      <span className="text-zinc-600 text-xs">{index + 1}</span>
                    </div>
                  )}
                  {phase.status === 'skipped' && (
                    <div className="w-5 h-5 bg-zinc-400 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">-</span>
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${
                      phase.status === 'complete' ? 'text-emerald-700' :
                      phase.status === 'running' ? 'text-blue-700' :
                      phase.status === 'error' ? 'text-red-700' :
                      'text-zinc-600'
                    }`}>
                      {phase.label}
                    </span>
                    {phase.status === 'running' && phase.progress > 0 && (
                      <span className="text-xs text-blue-600">
                        {(phase.progress * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  
                  {phase.status === 'running' && phase.progress > 0 && (
                    <div className="w-full bg-blue-100 rounded-full h-1 mt-1">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                        style={{ width: `${phase.progress * 100}%` }}
                      />
                    </div>
                  )}
                  
                  {phase.status === 'error' && phase.error && (
                    <div className="text-xs text-red-600 mt-1 truncate">
                      Error: {phase.error}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {/* Processing Stats */}
          <div className="mt-4 pt-3 border-t border-zinc-200">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-semibold text-emerald-600">{completedCount}</div>
                <div className="text-xs text-zinc-500">Completed</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-blue-600">
                  {phases.filter(p => p.status === 'running').length}
                </div>
                <div className="text-xs text-zinc-500">Active</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-zinc-600">
                  {phases.filter(p => p.status === 'pending').length}
                </div>
                <div className="text-xs text-zinc-500">Pending</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Legacy component for backwards compatibility
export function ProcessingProgressBarCompact() {
  const [phases, setPhases] = React.useState(assessmentStore.getState().phases);
  React.useEffect(() => assessmentStore.subscribe(s => setPhases(s.phases)), []);
  
  return (
    <div className="flex w-full h-2 rounded bg-zinc-200 overflow-hidden">
      {phases.map(p => (
        <div key={p.id} className={segmentClass(p)} style={{ width: `${100 / phases.length}%` }} title={`${p.label}: ${p.status}`}> 
          <div className="h-full bg-amber-500 transition-all" style={{ width: `${p.progress * 100}%` }} />
        </div>
      ))}
    </div>
  );
}

function segmentClass(p){
  switch(p.status){
    case 'complete': return 'relative bg-green-200';
    case 'running': return 'relative bg-amber-200';
    case 'error': return 'relative bg-red-300';
    case 'skipped': return 'relative bg-zinc-300 opacity-60';
    default: return 'relative bg-zinc-300';
  }
}
