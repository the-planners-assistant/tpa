import Head from 'next/head';
import { useEffect, useState } from 'react';
import ExportButton from '@tpa/ui/src/components/ExportButton';
import Agent from '@tpa/core/src/agent.js';
import { ProcessingProgressBar } from '@tpa/ui/src/components/ProcessingProgressBar.js';
import BalanceWidget from '@tpa/ui/src/components/BalanceWidget.js';
import LocalPlanComplianceWidget from '@tpa/ui/src/components/LocalPlanComplianceWidget.js';
import { ConstraintMap } from '@tpa/map';
import { assessmentStore } from '@tpa/ui/src/components/assessmentStore.js';

function PlanningBalanceBox({ assessment, onOverride }) {
  const [open, setOpen] = useState(true);
  
  // Fallback seeded considerations if no assessment yet
  const fallback = [
    { name: 'Housing Land Supply', score: 0.8, details: 'District at 3.2 year supply; tilted balance engaged.', confidence: 0.9 },
    { name: 'Heritage Impact', score: -0.55, details: 'Impact on Grade II* church setting.', confidence: 0.8 },
    { name: 'Design Quality', score: -0.15, details: 'Some departure from SPD massing guidance.', confidence: 0.7 },
    { name: 'Economic Benefits', score: 0.4, details: 'Approx 40 FTE jobs during operation.', confidence: 0.6 },
    { name: 'Biodiversity Net Gain', score: 0.25, details: 'Projected +12% units pending metric verification.', confidence: 0.5 },
    { name: 'Residential Amenity', score: 0.1, details: 'Daylight impacts acceptable within BRE flexibility.', confidence: 0.8 }
  ];
  
  let considerations = fallback;
  if (assessment?.results?.report?.planningBalance?.qualitative?.length) {
    considerations = assessment.results.report.planningBalance.qualitative.map(q => ({
      name: q.name,
      score: q.score,
      details: q.details,
      phrase: q.phrase,
      confidence: q.confidence || 0.5
    }));
  }

  // Calculate overall recommendation
  const overallScore = considerations.reduce((sum, c) => sum + (c.score * (c.confidence || 0.5)), 0) / considerations.length;
  const recommendation = overallScore > 0.2 ? 'APPROVE' : overallScore < -0.2 ? 'REFUSE' : 'DEFER';
  const recommendationColor = recommendation === 'APPROVE' ? 'text-emerald-600 bg-emerald-50' : 
                              recommendation === 'REFUSE' ? 'text-red-600 bg-red-50' : 'text-amber-600 bg-amber-50';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">Planning Balance Assessment</h2>
          <p className="text-zinc-600 text-sm mt-1">
            Interactive weighting of material considerations
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className={`px-4 py-2 rounded-lg font-semibold ${recommendationColor}`}>
            Recommendation: {recommendation}
          </div>
          <button 
            type="button" 
            onClick={() => setOpen(o => !o)} 
            className="px-3 py-2 text-sm border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors"
          >
            {open ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>
      
      {open && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <BalanceWidget
              layout="grid"
              considerations={considerations}
              onOverride={(override) => {
                console.log('Balance override:', override);
                onOverride?.(override);
              }}
              onPhraseChange={(change) => {
                console.log('Phrase change:', change);
              }}
            />
          </div>
          
          {/* Summary Bar */}
          <div className="mt-6 p-4 bg-zinc-50 rounded-lg border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-zinc-700">Overall Balance</span>
              <span className="text-sm text-zinc-600">
                Score: {overallScore.toFixed(2)} ({(overallScore * 100 > 0 ? '+' : '')}{(overallScore * 100).toFixed(0)}%)
              </span>
            </div>
            <div className="w-full bg-zinc-200 rounded-full h-3 relative">
              <div className="absolute inset-y-0 left-1/2 w-px bg-zinc-400"></div>
              <div 
                className={`h-3 rounded-full transition-all duration-500 ${
                  overallScore > 0 ? 'bg-emerald-500' : 'bg-red-500'
                }`}
                style={{
                  width: `${Math.abs(overallScore * 50)}%`,
                  marginLeft: overallScore > 0 ? '50%' : `${50 - Math.abs(overallScore * 50)}%`
                }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-zinc-500 mt-1">
              <span>Strong Harm</span>
              <span>Neutral</span>
              <span>Strong Benefit</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DevelopmentManagement() {
  const [agent, setAgent] = useState(null);
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState({ state: 'idle', message: '' }); // idle | validating | valid | error
  const [authority, setAuthority] = useState('');
  const [authorities, setAuthorities] = useState([]);
  const [authLoading, setAuthLoading] = useState(false);
  const [authoritySearch, setAuthoritySearch] = useState('');
  const [showAuthorityList, setShowAuthorityList] = useState(false);
  const [files, setFiles] = useState([]);
  const [assessment, setAssessment] = useState(null);
  const [sitePickMode, setSitePickMode] = useState(false);
  const [balanceOverrides, setBalanceOverrides] = useState([]);
  const [draft, setDraft] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [planItQuery, setPlanItQuery] = useState('');
  const [planItResults, setPlanItResults] = useState([]);
  const [planItLoading, setPlanItLoading] = useState(false);
  // Spatial search state
  const [spatialResults, setSpatialResults] = useState([]);
  const [spatialLoading, setSpatialLoading] = useState(false);
  // Radius removed per new simplified UX
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [addressQuery, setAddressQuery] = useState('');
  const [addressSearching, setAddressSearching] = useState(false);
  // Report generation controls
  const [reportVerbosity, setReportVerbosity] = useState('medium');
  const [includeNeutralMaterial, setIncludeNeutralMaterial] = useState(false);
  const [debugContexts, setDebugContexts] = useState(false);

  useEffect(() => {
    // unified key name across app (tpa_google_api_key)
    const stored = typeof window !== 'undefined' ? localStorage.getItem('tpa_google_api_key') : null;
    if (stored) {
      const a = new Agent({ googleApiKey: stored });
      setAgent(a);
      setApiKeyValue(stored);
    }
  }, []);

  function saveApiKey(){
    if (!apiKeyValue || !apiKeyValue.trim()) return;
    try {
      localStorage.setItem('tpa_google_api_key', apiKeyValue.trim());
      const a = new Agent({ googleApiKey: apiKeyValue.trim() });
      setAgent(a);
      validateApiKey(apiKeyValue.trim());
    } catch (e){ console.warn('Failed saving API key', e); }
  }

  async function validateApiKey(key){
    setKeyStatus({ state: 'validating', message: 'Validating key...' });
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
      if (!resp.ok) throw new Error('HTTP '+resp.status);
      const data = await resp.json();
      if (data?.models) {
        setKeyStatus({ state: 'valid', message: 'Key validated ✔' });
        setTimeout(()=>{ setKeyStatus(s=> s.state==='valid'? { state:'idle', message:'' }: s); }, 4000);
      } else {
        setKeyStatus({ state: 'error', message: 'Unexpected response' });
      }
    } catch (e){
      setKeyStatus({ state: 'error', message: 'Validation failed' });
    }
  }

  // Authority UI removed; keep silent internal authority if auto-detected.

  async function refreshAuthorities(){ /* deprecated: UI hidden */ }

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
      // Prepare manual coordinates if provided
      const options = {};
  // Manual coordinate entry removed (map/address search now primary)
      if (authority) {
        options.authority = authority; // propagate selected authority for retrieval/policy context
      }
      // Call assess with adapted shape; agent.processDocuments will handle .buffer
  // Inject config overrides for report generation
  agent.config.reportVerbosity = reportVerbosity;
  agent.config.reportIncludeNeutralMaterial = includeNeutralMaterial;
  agent.config.reportDebugContexts = debugContexts;
  const assessmentResult = await agent.assessPlanningApplication(fileObjs, options);
      setAssessment(assessmentResult);
  setDraft(assessmentResult.results.report?.officerReportMarkdown || JSON.stringify(assessmentResult.results.report || {}, null, 2));
      assessmentStore.completePhase('embed');
      assessmentStore.completePhase('synthesis');
      assessmentStore.completePhase('balance');
    } catch (e) {
      console.error('Assessment error:', e);
      
      // Enhanced error handling with specific guidance
      let errorMessage = 'Assessment failed: ' + e.message;
      let errorSuggestions = [];
      
      if (e.message.includes('Could not resolve site address')) {
        errorSuggestions.push('📍 Try providing manual coordinates in the form above');
        errorSuggestions.push('📄 Ensure your document contains a clear UK address with postcode');
        errorSuggestions.push('🔧 Check that your document is readable (not a scanned image)');
        errorSuggestions.push('🌐 Verify Google API configuration if you have access to settings');
      } else if (e.message.includes('No documents provided')) {
        errorSuggestions.push('📎 Please upload at least one document to analyze');
      } else if (e.message.includes('Failed to extract text')) {
        errorSuggestions.push('📄 Try uploading a different format (PDF with text, not scanned images)');
        errorSuggestions.push('🔍 Ensure the document is not password protected');
      }
      
      // Set error state with helpful information
      setError({
        message: errorMessage,
        suggestions: errorSuggestions,
        details: e.message,
        timestamp: new Date().toISOString()
      });
      
      assessmentStore.updatePhase('ingest', { 
        status: 'error', 
        error: e.message 
      });
    } finally {
      setProcessing(false);
    }
  }

  async function runSpatialSearch(){
    if (!agent || !selectedPoint) return;
    setSpatialLoading(true);
    try {
      const { lat, lng } = { lat: selectedPoint.lat, lng: selectedPoint.lng };
      // Fixed 1km default radius internally
      const results = await agent.planItAPI.searchApplications({ lat, lng, krad: 1, pg_sz: 50 });
      setSpatialResults(results?.records || []);
      // Auto-set internal authority from first result if available
      if (!authority && results?.records?.length && results.records[0].area_name) {
        setAuthority(results.records[0].area_name);
      }
    } catch (e) {
      console.warn('Spatial search failed', e);
    } finally { setSpatialLoading(false); }
  }

  async function searchAddress(e){
    if (e) e.preventDefault();
    if (!addressQuery.trim()) return;
    setAddressSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=gb&q=${encodeURIComponent(addressQuery)}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        const hit = data[0];
        const lat = parseFloat(hit.lat);
        const lng = parseFloat(hit.lon);
        if (!isNaN(lat) && !isNaN(lng)) {
          setSelectedPoint({ lat, lng, display: hit.display_name });
          // Auto-run spatial search after selecting point
          setTimeout(()=>runSpatialSearch(), 50);
        }
      }
    } catch (err) {
      console.warn('Address geocoding failed', err);
    } finally { setAddressSearching(false); }
  }

  // Handle planning balance override events (category changes or phrase tweaks) and recompute lightweight recommendation
  function handleBalanceOverride(evt){
    setBalanceOverrides(prev => [...prev, evt]);
    if (!assessment || !agent) return;
    try {
      // Adjust internal scores heuristically: map category mid-score back into materialConsiderations structure if names match
      const updated = { ...assessment };
      const mc = updated.results?.material;
      if (mc && mc.materialConsiderations) {
        for (const ov of [evt]) {
          for (const [catName, catVal] of Object.entries(mc.materialConsiderations)) {
            const hit = catVal.considerations?.find(c => c.description?.toLowerCase().includes(ov.name.toLowerCase()));
            if (hit) {
              hit.score = Math.round(ov.newScore * 100); // convert -1..1 to 0-100 style
              hit.overridden = true;
            }
          }
        }
        // Re-run balancing exercise only (no full pipeline)
        const materialObj = mc.materialConsiderations;
        // Recalculate category overallScore as avg of child scores
        for (const cat of Object.values(materialObj)) {
          if (cat.considerations?.length) {
            const total = cat.considerations.reduce((s,c)=>s+(c.score||50),0);
            cat.overallScore = Math.round(total / cat.considerations.length);
          }
        }
        // Lightweight balance: reuse generatePlanningBalanceSection by forging assessment.results.material
        updated.results.material = mc; // already mutated
        // Synthesize new recommendation quickly
        const rec = agent.generateRecommendationSection(updated); // uses existing recommendation if present
        updated.recommendation = rec;
        setAssessment(updated);
        setDraft(JSON.stringify(updated.results.report || updated.results, null, 2));
      }
    } catch (e) {
      console.warn('Balance override update failed', e);
    }
  }

  const handleFileUpload = (event) => {
    const selected = Array.from(event.target.files || []);
    if (selected.length === 0) return;
    setFiles(prev => [...prev, ...selected]);
  };

  const draftReport = `# Draft Officer Report\n\n${draft}`;

  async function regenerateReport(){
    if (!assessment || !agent) return;
    try {
      setProcessing(true);
  agent.config.reportVerbosity = reportVerbosity;
  agent.config.reportIncludeNeutralMaterial = includeNeutralMaterial;
  agent.config.reportDebugContexts = debugContexts;
      // Re-run only phase 8 using existing assessment object
      const updated = { ...assessment };
      const phaseModule = await import('@tpa/core/src/agent/phases/reportGeneration.js');
      const newReport = await phaseModule.reportGenerationPhase(agent, updated, updated.id);
      updated.results.report = newReport;
      setAssessment(updated);
      setDraft(newReport.officerReportMarkdown || JSON.stringify(newReport,null,2));
    } catch (e){
      console.warn('Regeneration failed', e);
    } finally {
      setProcessing(false);
    }
  }

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

  // Extract constraints + site info once assessment done
  const constraints = assessment?.results?.spatial?.constraints || assessment?.results?.site?.constraints || [];
  const siteLoc = assessment?.results?.site || assessment?.results?.location || null;

  // Handler for map click to capture coordinates when pick mode enabled
  useEffect(() => {
    if (!sitePickMode) return;
    function handleWindowMsg(e){
      // future hook
    }
    window.addEventListener('message', handleWindowMsg);
    return () => window.removeEventListener('message', handleWindowMsg);
  }, [sitePickMode]);

  return (
    <div>
      <Head>
        <title>Development Management Tool - TPA</title>
        <meta name="description" content="Upload planning documents and generate draft officer reports" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

  {/* Removed duplicate page header; global layout assumed. */}

      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-zinc-100">
        <div className="container mx-auto px-6 py-8">
          {/* Removed page-level header (logo + brand) now handled by global Layout */}

          {/* Hero Banner */}
          <div className="relative mb-10 overflow-hidden rounded-2xl border border-slate-700/60 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-800 text-white shadow-lg">
            <div className="absolute inset-0 opacity-[0.15] mix-blend-overlay pointer-events-none">
              <div className="absolute w-[160%] h-[160%] -left-1/3 -top-1/3 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.8),transparent_60%)]" />
              <div className="absolute w-[160%] h-[160%] -right-1/3 -bottom-1/3 bg-[radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.6),transparent_65%)]" />
            </div>
            <div className="relative px-8 py-10 flex flex-col lg:flex-row lg:items-center gap-8">
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight mb-2">
                  Assess a planning application faster
                </h1>
                <p className="mt-4 max-w-2xl text-indigo-50/90 text-sm md:text-base leading-relaxed">
                  Upload core documents, pinpoint the site, and generate a draft officer report grounded in policies, constraints and material considerations.
                </p>
                <div className="mt-6 flex flex-wrap gap-3 text-[11px] font-medium">
                  <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur border border-white/20">Modular Report</span>
                  <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur border border-white/20">Policy Context</span>
                  <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur border border-white/20">Spatial Constraints</span>
                  <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur border border-white/20">Planning Balance</span>
                </div>
              </div>
              <div className="w-full max-w-sm bg-white/10 backdrop-blur-sm rounded-xl border border-white/25 p-5 flex flex-col gap-4 shadow-inner">
                <div>
                  <div className="text-xs uppercase tracking-wide text-white/70 font-semibold mb-2">To get started</div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-medium text-white/70">Gemini API Key</label>
                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-amber-300 hover:text-amber-200 text-[11px] font-medium underline decoration-dotted">Get a key ↗</a>
                  </div>
                  <div className="flex gap-2 items-stretch">
                    <div className="flex-1 relative">
                      <input 
                        type={showKey ? 'text' : 'password'}
                        value={apiKeyValue}
                        onChange={e=>setApiKeyValue(e.target.value)}
                        placeholder="paste key..."
                        className="w-full rounded-lg bg-white/15 border border-white/30 placeholder-white/40 text-white px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/70 focus:border-white/60 backdrop-blur"
                      />
                      <button type="button" onClick={()=>setShowKey(s=>!s)} className="absolute top-0.5 right-1.5 h-8 px-2 text-[10px] rounded-md bg-white/20 hover:bg-white/30 text-white/80 font-medium" title={showKey?'Hide key':'Show key'}>
                        {showKey ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <button 
                      type="button" 
                      onClick={saveApiKey}
                      disabled={!apiKeyValue.trim() || keyStatus.state==='validating'}
                      className="px-4 py-2 rounded-lg bg-amber-400 text-slate-900 text-sm font-semibold disabled:opacity-50 hover:bg-amber-300 shadow"
                    >{keyStatus.state==='validating' ? 'Saving…' : 'Save'}</button>
                  </div>
                  <div className="mt-1 min-h-[18px] text-[11px] font-medium">
                    {keyStatus.state==='validating' && <span className="text-amber-200 animate-pulse">{keyStatus.message}</span>}
                    {keyStatus.state==='valid' && <span className="text-emerald-300">{keyStatus.message}</span>}
                    {keyStatus.state==='error' && <span className="text-rose-300">{keyStatus.message}</span>}
                  </div>
                  {!agent && (
                    <p className="mt-2 text-[11px] leading-snug text-amber-100/90">API key stored locally only; required for AI analysis & report generation.</p>
                  )}
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-white/70 font-semibold mb-2">Quick Steps</div>
                  <ol className="space-y-1.5 text-[13px] text-white/95 marker:text-white list-decimal list-inside">
                    <li>Enter API key</li>
                    <li>Upload documents</li>
                    <li>Select / search site</li>
                    <li>Generate draft report</li>
                  </ol>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={()=>{ const el=document.getElementById('file-upload'); el?.scrollIntoView({behavior:'smooth'}); }} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-white text-indigo-700 font-medium text-sm px-4 py-2 shadow hover:bg-indigo-50">
                    {agent ? 'Upload Documents' : 'Save Key First'}
                  </button>
                </div>
                <p className="text-[10px] leading-snug text-white/60 mt-1">Experimental tool – not a substitute for formal professional planning advice or statutory determination.</p>
              </div>
            </div>
          </div>

          {/* Development Management Section Heading (renamed from Spatial Search) */}
          <div className="mb-10 bg-white/80 backdrop-blur-sm border border-zinc-200/60 rounded-xl shadow-sm p-6">
            <h1 className="text-2xl font-bold text-zinc-900 mb-3">Development Management</h1>
            <p className="text-sm text-zinc-600 mb-4">Select or search for a site (map click or address) and fetch nearby recent planning applications to ground the assessment.</p>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2 h-72 border border-zinc-200 rounded-lg overflow-hidden">
                <ConstraintMap 
                  site={selectedPoint ? { coordinates: { latitude: selectedPoint.lat, longitude: selectedPoint.lng } } : null}
                  onSelectLocation={({ lat, lng }) => setSelectedPoint({ lat, lng })}
                />
              </div>
              <div className="space-y-4">
                <form onSubmit={searchAddress} className="space-y-2">
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Address Search (UK)</label>
                  <div className="flex gap-2">
                    <input value={addressQuery} onChange={e=>setAddressQuery(e.target.value)} placeholder="Enter address / postcode" className="flex-1 border border-zinc-300 rounded px-2 py-1 text-sm" />
                    <button type="submit" disabled={addressSearching || !addressQuery.trim()} className="px-3 py-1.5 text-sm rounded bg-zinc-800 text-white disabled:opacity-50">{addressSearching ? '...' : 'Find'}</button>
                  </div>
                </form>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Selected Point</label>
                  <div className="text-sm text-zinc-800 h-6">{selectedPoint ? `${selectedPoint.lat.toFixed(5)}, ${selectedPoint.lng.toFixed(5)}` : 'None'}</div>
                  {selectedPoint?.display && <div className="text-[10px] text-zinc-500 line-clamp-2 mt-1">{selectedPoint.display}</div>}
                </div>
                {/* Radius control removed */}
                <button onClick={runSpatialSearch} disabled={!selectedPoint || spatialLoading} className="w-full px-3 py-2 text-sm font-medium rounded bg-indigo-600 text-white disabled:opacity-50">
                  {spatialLoading ? 'Searching…' : 'Run Spatial Search'}
                </button>
                {spatialResults.length>0 && (
                  <div className="max-h-32 overflow-y-auto border rounded p-2 text-xs space-y-1 bg-zinc-50">
                    {spatialResults.slice(0,25).map(r => (
                      <div key={r.name} className="p-1 rounded hover:bg-white">
                        <div className="font-medium truncate">{r.reference || r.name}</div>
                        <div className="text-zinc-600 line-clamp-2">{r.description}</div>
                        <div className="text-[10px] text-zinc-500">{r.start_date} • {r.app_state}</div>
                      </div>
                    ))}
                    {spatialResults.length>25 && <div className="text-center text-[10px] text-zinc-500">Showing first 25 of {spatialResults.length}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-12 gap-8">
            {/* Left Sidebar - Controls */}
            <div className="col-span-4 space-y-6">
              {/* (API Configuration removed; configure key via Settings page) */}

              {/* Report Controls */}
        <div className="group bg-white/80 backdrop-blur-sm border border-zinc-200/60 rounded-xl shadow-sm p-6 transition hover:shadow-md hover:border-zinc-300">
                <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center font-semibold text-sm">R</div>
          <h2 className="text-lg font-semibold text-zinc-900">Report Settings</h2>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Verbosity</label>
                    <select value={reportVerbosity} onChange={e=>setReportVerbosity(e.target.value)} className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm">
                      <option value="low">Low (succinct)</option>
                      <option value="medium">Medium</option>
                      <option value="high">High (detailed)</option>
                    </select>
                  </div>
                  <div className="flex items-start gap-2">
                    <input id="includeNeutral" type="checkbox" checked={includeNeutralMaterial} onChange={e=>setIncludeNeutralMaterial(e.target.checked)} className="mt-1" />
                    <label htmlFor="includeNeutral" className="text-sm text-zinc-700">
                      Include neutral material consideration categories (otherwise only significant ± and priority)
                    </label>
                  </div>
                  <div className="flex items-start gap-2">
                    <input id="debugContexts" type="checkbox" checked={debugContexts} onChange={e=>setDebugContexts(e.target.checked)} className="mt-1" />
                    <label htmlFor="debugContexts" className="text-sm text-zinc-700">
                      Show section context JSON (debug)
                    </label>
                  </div>
                  <button disabled={!assessment || processing} onClick={regenerateReport} className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center justify-center gap-2">
                    {processing ? 'Regenerating...' : '♻️ Regenerate Report'}
                  </button>
                </div>
              </div>

  {/* Local Authority selection removed – authority inferred internally from PlanIt spatial results (area_name). */}

        {/* Documents Section */}
        <div className="group bg-white/80 backdrop-blur-sm border border-zinc-200/60 rounded-xl shadow-sm p-6 transition hover:shadow-md hover:border-zinc-300">
                <div className="flex items-center gap-2 mb-4">
          <div className={`w-8 h-8 rounded-lg ${files.length ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-100 text-zinc-500'} flex items-center justify-center font-semibold text-sm`}>D</div>
      <h2 className="text-lg font-semibold text-zinc-900">2. Planning Documents</h2>
                </div>
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-zinc-300 rounded-lg p-6 text-center hover:border-zinc-400 transition-colors">
                    <input 
                      type="file" 
                      multiple 
                      onChange={handleFileUpload} 
                      className="hidden" 
                      id="file-upload"
                      accept=".pdf,.doc,.docx,.txt"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <div className="text-zinc-600 mb-2">
                        📄 Drop files here or click to browse
                      </div>
                      <div className="text-sm text-zinc-500">
                        PDF, DOC, DOCX files supported
                      </div>
                    </label>
                  </div>
                  
                  {files.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-zinc-700">Uploaded files:</h4>
                      <div className="max-h-32 overflow-auto space-y-1">
                        {files.map((f, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm bg-zinc-50 rounded p-2">
                            <span className="text-zinc-600">📄</span>
                            <span className="flex-1 truncate">{f.name}</span>
                            <span className="text-xs text-zinc-500">{(f.size / 1024).toFixed(0)}KB</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Error Display */}
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <span className="text-red-500 text-lg">⚠️</span>
                        <div className="flex-1">
                          <h4 className="text-red-800 font-medium mb-1">Assessment Failed</h4>
                          <p className="text-red-700 text-sm mb-3">{error.message}</p>
                          
                          {error.suggestions && error.suggestions.length > 0 && (
                            <div className="space-y-2">
                              <h5 className="text-red-800 font-medium text-sm">Possible solutions:</h5>
                              <ul className="space-y-1">
                                {error.suggestions.map((suggestion, idx) => (
                                  <li key={idx} className="text-red-700 text-sm flex items-start gap-2">
                                    <span className="text-red-400">•</span>
                                    <span>{suggestion}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          <button
                            onClick={() => setError(null)}
                            className="mt-3 text-red-600 hover:text-red-800 text-sm underline"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <button 
                    disabled={!files.length || processing || !agent} 
                    onClick={() => {
                      setError(null); // Clear any previous errors
                      startAssessment();
                    }} 
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-4 py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {processing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        ⚡ Start Assessment
                      </>
                    )}
                  </button>
                  
                  {/* Manual coordinate entry removed */}
                </div>
              </div>

  {/* Precedent Search hidden (feature deferred) */}
            </div>{/* end left sidebar */}

            {/* Main Content Area */}
            <div className="col-span-8 space-y-6">
              <div className="flex gap-6">
                {/* Report Display */}
                <div className="flex-1 bg-white/80 backdrop-blur-sm border border-zinc-200/60 rounded-xl shadow-sm p-6 min-h-[500px]">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-zinc-900">Draft Officer Report</h3>
                    {draft && (
                      <div className="flex items-center gap-2 text-sm text-emerald-600">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        Report generated
                      </div>
                    )}
                  </div>
                  
                  <div className="prose prose-sm max-w-none">
                    {draft ? (
                      <pre className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 bg-zinc-50/50 rounded-lg p-4 border">
                        {draft}
                      </pre>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-64 text-center">
                        <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
                          📄
                        </div>
                        <h4 className="text-lg font-medium text-zinc-700 mb-2">No Report Generated</h4>
                        <p className="text-zinc-500 max-w-md">
                          Upload planning documents, configure your API key, select a local authority, and run an assessment to generate a draft officer report.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Map and Constraints Sidebar */}
                <div className="w-80 space-y-4">
                  {/* Map Component */}
                  <div className="bg-white/80 backdrop-blur-sm border border-zinc-200/60 rounded-xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-zinc-200">
                      <h4 className="font-semibold text-zinc-900">Site Location</h4>
                    </div>
                    <div className="h-64 relative">
                      <ConstraintMap 
                        site={siteLoc && siteLoc.coordinates ? siteLoc : { coordinates: siteLoc?.coordinates }} 
                        constraints={constraints} 
                      />
                      {(!constraints || constraints.length === 0) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-zinc-50/80 backdrop-blur-sm">
                          <div className="text-center p-4">
                            <div className="w-12 h-12 bg-zinc-200 rounded-full flex items-center justify-center mx-auto mb-2">
                              🗺️
                            </div>
                            <p className="text-sm text-zinc-600">
                              Map will populate when site coordinates are resolved
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Constraints List */}
                  {constraints && constraints.length > 0 && (
                    <div className="bg-white/80 backdrop-blur-sm border border-zinc-200/60 rounded-xl shadow-sm">
                      <div className="p-4 border-b border-zinc-200">
                        <h4 className="font-semibold text-zinc-900">
                          Planning Constraints ({constraints.length})
                        </h4>
                      </div>
                      <div className="p-4 max-h-64 overflow-auto">
                        <div className="space-y-2">
                          {constraints.slice(0, 15).map((c, idx) => (
                            <div key={c.id || idx} className="flex items-center gap-3 p-2 bg-zinc-50 rounded-lg">
                              <div className={`w-3 h-3 rounded-full ${
                                c.severity === 'critical' ? 'bg-red-600' :
                                c.severity === 'high' ? 'bg-orange-500' :
                                c.severity === 'medium' ? 'bg-amber-500' : 
                                'bg-emerald-500'
                              }`}></div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-zinc-800 truncate">
                                  {c.name || c.type}
                                </div>
                                {c.coverage && (
                                  <div className="text-xs text-zinc-500">
                                    {c.coverage}% coverage
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          {constraints.length > 15 && (
                            <div className="text-xs text-zinc-500 text-center py-2">
                              + {constraints.length - 15} more constraints
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Planning Balance Widget */}
              {assessment && (
                <div className="bg-white/80 backdrop-blur-sm border border-zinc-200/60 rounded-xl shadow-sm">
                  <PlanningBalanceBox assessment={assessment} onOverride={handleBalanceOverride} />
                </div>
              )}

              {/* Local Plan Compliance Widget */}
              <LocalPlanComplianceWidget
                assessment={assessment}
                onComplianceResults={(results) => {
                  console.log('Received compliance results:', results);
                  // Could integrate results into the assessment display
                }}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
