import React from 'react';
import { assessmentStore } from './assessmentStore.js';

export function ProcessingProgressBar() {
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
