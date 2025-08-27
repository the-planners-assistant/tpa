import Head from 'next/head';
import { useEffect, useState } from 'react';
import ExportButton from '@tpa/ui/src/components/ExportButton';
import Agent from '@tpa/core/src/agent.js';
import { ProcessingProgressBar } from '@tpa/ui/src/components/ProcessingProgressBar.js';
import BalanceWidget from '@tpa/ui/src/components/BalanceWidget.js';
import { assessmentStore } from '@tpa/ui/src/components/assessmentStore.js';

function PlanningBalanceBox({ assessment }) {
  const [open, setOpen] = useState(true);
  // Fallback seeded considerations if no assessment yet
  const fallback = [
    { name: 'Housing Land Supply', score: 0.8, details: 'District at 3.2 year supply; tilted balance engaged.' },
    { name: 'Heritage', score: -0.55, details: 'Impact on Grade II* church setting.' },
    { name: 'Design', score: -0.15, details: 'Some departure from SPD massing guidance.' },
    { name: 'Economic Uplift', score: 0.4, details: 'Approx 40 FTE jobs during operation.' },
    { name: 'Biodiversity Net Gain', score: 0.25, details: 'Projected +12% units pending metric verification.' },
    { name: 'Amenity', score: 0.1, details: 'Daylight impacts acceptable within BRE flexibility.' }
  ];
  let considerations = fallback;
  if (assessment?.results?.report?.planningBalance?.qualitative?.length) {
    considerations = assessment.results.report.planningBalance.qualitative.map(q => ({
      name: q.name,
      score: q.score,
      details: q.details,
      phrase: q.phrase
    }));
  }
  return (
    <div className="p-4 bg-white border rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-800">Planning Balance</h2>
        <button type="button" onClick={()=>setOpen(o=>!o)} className="text-[10px] px-2 py-1 border rounded bg-zinc-100 hover:bg-zinc-200">
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open && (
        <BalanceWidget
          layout="grid"
          considerations={considerations}
          onOverride={o => console.log('Override', o)}
          onPhraseChange={p => console.log('Phrase change', p)}
        />
      )}
    </div>
  );
}

export default function DevelopmentManagement() {
  const [agent, setAgent] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [authority, setAuthority] = useState('');
  const [authorities, setAuthorities] = useState([]);
  const [authLoading, setAuthLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [assessment, setAssessment] = useState(null);
  const [draft, setDraft] = useState('');
  const [processing, setProcessing] = useState(false);
  const [planItQuery, setPlanItQuery] = useState('');
  const [planItResults, setPlanItResults] = useState([]);
  const [planItLoading, setPlanItLoading] = useState(false);

  useEffect(() => {
    // unified key name across app (tpa_google_api_key)
    const stored = localStorage.getItem('tpa_google_api_key');
    if (stored) {
      setApiKey(stored);
      const a = new Agent({ googleApiKey: stored });
      setAgent(a);
    }
  }, []);

  // Load authorities when agent ready
  useEffect(() => {
    let cancelled = false;
    async function loadAuthorities() {
      if (!agent) return;
      setAuthLoading(true);
      try {
        // Ensure seed (non-forced, dynamic fetch inside manager handles if empty)
        await agent.localAuthorities.seedAuthorities();
        // Read from Dexie
        const list = await agent.database.localAuthorityData.toArray();
        if (!cancelled) setAuthorities(list.sort((a,b)=>a.name.localeCompare(b.name)));
      } catch (e){
        console.warn('Failed loading authorities', e);
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }
    loadAuthorities();
    return () => { cancelled = true; };
  }, [agent]);

  async function refreshAuthorities(){
    if (!agent) return;
    setAuthLoading(true);
    try {
      await agent.localAuthorities.seedAuthorities({ force:true, max:150 });
      const list = await agent.database.localAuthorityData.toArray();
      setAuthorities(list.sort((a,b)=>a.name.localeCompare(b.name)));
    } finally { setAuthLoading(false); }
  }

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

  async function runPlanItSearch(e){
    e.preventDefault();
    if (!agent || !planItQuery.trim()) return;
    setPlanItLoading(true);
    try {
      const res = await agent.searchPlanItApplications(planItQuery);
      setPlanItResults(res.results.slice(0,25));
    } catch (err) {
      console.error(err);
    } finally {
      setPlanItLoading(false);
    }
  }

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
              <div className="flex gap-2 items-center">
                <select value={authority} onChange={e=>setAuthority(e.target.value)} className="w-full border rounded px-2 py-1 text-sm">
                  <option value="">{authLoading ? 'Loading authorities...' : 'Select authority...'}</option>
                  {authorities.map(a => (
                    <option key={a.code} value={a.code}>{a.name}</option>
                  ))}
                </select>
                <button type="button" onClick={refreshAuthorities} className="text-[10px] px-2 py-1 border rounded bg-zinc-100 hover:bg-zinc-200">↻</button>
              </div>
              {authority && <div className="text-[10px] text-zinc-500">Selected: {authority}</div>}
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
            <div className="p-4 bg-white border rounded-lg shadow-sm space-y-3">
              <h2 className="text-sm font-semibold tracking-wide text-zinc-800">4. PlanIt Search</h2>
              <form onSubmit={runPlanItSearch} className="space-y-2">
                <input type="text" value={planItQuery} onChange={e=>setPlanItQuery(e.target.value)} placeholder="Search applications (ref, address)" className="w-full px-2 py-1 border rounded text-sm" />
                <button type="submit" disabled={planItLoading || !planItQuery.trim()} className="text-xs bg-indigo-600 disabled:opacity-40 text-white px-3 py-1 rounded font-medium w-full">
                  {planItLoading ? 'Searching...' : 'Search'}
                </button>
              </form>
              <ul className="text-[11px] max-h-52 overflow-auto divide-y">
                {planItResults.map(r => (
                  <li key={r.id || r.reference} className="py-1">
                    <div className="font-medium text-zinc-800 truncate">{r.reference || r.id}</div>
                    <div className="text-zinc-500 truncate">{r.address || r.site_address || r.location}</div>
                    {r.authority && <div className="text-zinc-400">{r.authority}</div>}
                  </li>
                ))}
                {!planItLoading && planItResults.length===0 && planItQuery && <li className="py-2 text-zinc-500">No results.</li>}
              </ul>
            </div>
          </div>
          <div className="col-span-8 space-y-6">
            <div className="p-4 bg-white border rounded-lg shadow-sm min-h-[400px] prose whitespace-pre-wrap text-xs">
              {draft ? draft : <div className="text-zinc-500 text-sm">Upload documents, select an authority and run an assessment to see the draft report.</div>}
            </div>
            <PlanningBalanceBox assessment={assessment} />
          </div>
        </div>
      </main>
    </div>
  );
}
