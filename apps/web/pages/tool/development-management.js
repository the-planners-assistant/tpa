import Head from 'next/head';
import { useEffect, useState } from 'react';
import ExportButton from '@tpa/ui/src/components/ExportButton';
import Agent from '@tpa/core/src/agent.js';
import { ProcessingProgressBar } from '@tpa/ui/src/components/ProcessingProgressBar.js';
import { PlanningBalancePanel } from '@tpa/ui/src/components/PlanningBalancePanel.js';
import { assessmentStore } from '@tpa/ui/src/components/assessmentStore.js';

export default function DevelopmentManagement() {
  const [agent, setAgent] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [authority, setAuthority] = useState('');
  const [files, setFiles] = useState([]);
  const [assessment, setAssessment] = useState(null);
  const [draft, setDraft] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    // unified key name across app (tpa_google_api_key)
    const stored = localStorage.getItem('tpa_google_api_key');
    if (stored) {
      setApiKey(stored);
      setAgent(new Agent({ googleApiKey: stored }));
    }
  }, []);

  const saveApiKey = () => {
    if (!apiKey || apiKey.trim().length < 10) return;
    localStorage.setItem('tpa_google_api_key', apiKey.trim());
    setAgent(new Agent({ googleApiKey: apiKey.trim() }));
  };

  const considerations = [
    { name: 'Heritage', weight: 50 },
    { name: 'Housing Delivery', weight: 70 },
    { name: 'Economic Growth', weight: 60 },
    { name: 'Sustainability', weight: 80 },
  ];

  const handleWeightChange = (name, value) => {
    console.log(`Consideration '${name}' weight changed to: ${value}`);
  };

  function updatePhase(id, progress, status){
    if (status) assessmentStore.setPhaseStatus(id, status);
    if (progress != null) assessmentStore.setPhaseProgress(id, progress);
    if (progress === 1) assessmentStore.completePhase(id);
  }

  async function startAssessment(){
    if (!agent || files.length===0) return;
    setProcessing(true);
    updatePhase('ingest', 0.1, 'running');
    try {
      // Convert files to objects with ArrayBuffer for parser
      const fileObjs = await Promise.all(files.map(async f => ({ name: f.name, buffer: await f.arrayBuffer(), original: f })));
      updatePhase('ingest', 1);
      updatePhase('embed', 0.05, 'running');
      // Call assess with adapted shape; agent.processDocuments will handle .buffer
      const assessmentResult = await agent.assessPlanningApplication(fileObjs);
      setAssessment(assessmentResult);
      setDraft(JSON.stringify(assessmentResult.results.report || {}, null, 2));
      assessmentStore.completePhase('embed');
      assessmentStore.completePhase('synthesis');
      assessmentStore.completePhase('balance');
    } catch (e) {
      console.error(e);
      assessmentStore.updatePhase('ingest', { status: 'error' });
    } finally {
      setProcessing(false);
    }
  }

  const handleFileUpload = (event) => {
    const selected = Array.from(event.target.files || []);
    if (selected.length === 0) return;
    setFiles(prev => [...prev, ...selected]);
  };

  const draftReport = `# Draft Officer Report\n\n${draft}`;

  return (
    <div>
      <Head>
        <title>Development Management Tool - TPA</title>
        <meta name="description" content="Upload planning documents and generate draft officer reports" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Development Management Assessment</h1>
            {draft && <ExportButton content={draftReport} fileName="draft-officer-report" />}
          </div>
          <div className="w-1/2"><ProcessingProgressBar /></div>
        </div>
        <div className="grid grid-cols-12 gap-8 items-start">
          <div className="col-span-4 space-y-6">
            <div className="p-4 bg-white border rounded-lg shadow-sm space-y-3">
              <h2 className="text-sm font-semibold tracking-wide text-zinc-800">1. API Key</h2>
              <input type="password" placeholder="Google / Gemini API Key" value={apiKey} onChange={e=>setApiKey(e.target.value)} className="w-full px-2 py-1 border rounded" />
              <button onClick={saveApiKey} className="text-xs bg-amber-500 text-black px-3 py-1 rounded font-medium">Save Key</button>
            </div>
            <div className="p-4 bg-white border rounded-lg shadow-sm space-y-3">
              <h2 className="text-sm font-semibold tracking-wide text-zinc-800">2. Local Authority</h2>
              <select value={authority} onChange={e=>setAuthority(e.target.value)} className="w-full border rounded px-2 py-1 text-sm">
                <option value="">Select authority...</option>
                <option value="camden">Camden</option>
                <option value="bristol">Bristol</option>
                <option value="leeds">Leeds</option>
              </select>
            </div>
            <div className="p-4 bg-white border rounded-lg shadow-sm space-y-3">
              <h2 className="text-sm font-semibold tracking-wide text-zinc-800">3. Documents</h2>
              <input type="file" multiple onChange={handleFileUpload} className="w-full" />
              <ul className="text-xs max-h-40 overflow-auto space-y-1">
                {files.map(f => <li key={f.name} className="truncate">{f.name}</li>)}
              </ul>
              <button disabled={!files.length || processing} onClick={startAssessment} className="text-xs bg-emerald-600 disabled:opacity-50 text-white px-3 py-1 rounded font-medium">
                {processing ? 'Running...' : 'Start Assessment'}
              </button>
            </div>
            <PlanningBalancePanel onWeightsChange={() => { /* TODO recompute balance */ }} />
          </div>
          <div className="col-span-8">
            <div className="p-4 bg-white border rounded-lg shadow-sm min-h-[400px] prose whitespace-pre-wrap text-xs">
              {draft ? draft : <div className="text-zinc-500 text-sm">Upload documents, select an authority and run an assessment to see the draft report.</div>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
