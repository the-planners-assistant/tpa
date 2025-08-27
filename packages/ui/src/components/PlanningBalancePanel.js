import React from 'react';
import { assessmentStore } from './assessmentStore.js';

const DEFAULT_CONSIDERATIONS = [
  { key: 'design', label: 'Design' },
  { key: 'heritage', label: 'Heritage' },
  { key: 'transport', label: 'Transport' },
  { key: 'amenity', label: 'Amenity' },
  { key: 'environment', label: 'Environment' }
];

export function PlanningBalancePanel({ onWeightsChange }) {
  const [weights, setWeights] = React.useState(() => Object.fromEntries(DEFAULT_CONSIDERATIONS.map(c => [c.key, 1])));
  function update(k, v){
    const next = { ...weights, [k]: v };
    setWeights(next);
    onWeightsChange?.(next);
  }
  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm space-y-4">
      <h3 className="font-semibold text-sm tracking-wide text-zinc-800">Planning Balance</h3>
      {DEFAULT_CONSIDERATIONS.map(c => (
        <div key={c.key}>
          <label className="flex justify-between text-xs font-medium mb-1 text-zinc-600">
            <span>{c.label}</span><span>{weights[c.key].toFixed(2)}</span>
          </label>
          <input type="range" min={0} max={2} step={0.05} value={weights[c.key]} onChange={e => update(c.key, parseFloat(e.target.value))} className="w-full" />
        </div>
      ))}
    </div>
  );
}
