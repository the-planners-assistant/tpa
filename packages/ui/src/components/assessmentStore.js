// Simple evented assessment store (can be replaced by more robust state later)
export class AssessmentStore {
  constructor() {
    this.listeners = new Set();
    this.state = {
      phases: [
        { id: 'ingest', label: 'Ingest', status: 'pending', progress: 0 },
        { id: 'embed', label: 'Embed', status: 'pending', progress: 0 },
        { id: 'policies', label: 'Policies', status: 'pending', progress: 0 },
        { id: 'spatial', label: 'Spatial', status: 'pending', progress: 0 },
        { id: 'vision', label: 'Vision', status: 'pending', progress: 0 },
        { id: 'retrieval', label: 'Retrieval', status: 'pending', progress: 0 },
        { id: 'synthesis', label: 'Synthesis', status: 'pending', progress: 0 },
        { id: 'balance', label: 'Balance', status: 'pending', progress: 0 }
      ],
      scenarios: [],
      activeScenarioId: null,
      evidencePreview: null,
      recommendation: null
    };
  }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(this.state); }
  getState() { return this.state; }
  updatePhase(id, patch) {
    this.state.phases = this.state.phases.map(p => p.id === id ? { ...p, ...patch } : p);
    this.emit();
  }
  setPhaseStatus(id, status) { this.updatePhase(id, { status }); }
  setPhaseProgress(id, progress) { this.updatePhase(id, { progress, status: 'running' }); }
  completePhase(id) { this.updatePhase(id, { progress: 1, status: 'complete' }); }
  setRecommendation(rec) { this.state.recommendation = rec; this.emit(); }
}

export const assessmentStore = new AssessmentStore();
