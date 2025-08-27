import React from 'react';

export function ProvenanceChip({ id, confidence, onClick }) {
  const tone = confidence == null ? 'bg-zinc-100 border-zinc-200' : confidence > 0.75 ? 'bg-emerald-100 border-emerald-300' : confidence > 0.5 ? 'bg-amber-100 border-amber-300' : 'bg-rose-100 border-rose-300';
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium tracking-wide ${tone} hover:ring-2 ring-amber-400 focus:outline-none focus:ring-2`}>EV:{id}</button>
  );
}
