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
  const [authority, setAuthority] = useState('');
  const [authorities, setAuthorities] = useState([]);
  const [authLoading, setAuthLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [assessment, setAssessment] = useState(null);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [sitePickMode, setSitePickMode] = useState(false);
  const [balanceOverrides, setBalanceOverrides] = useState([]);
  const [draft, setDraft] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [planItQuery, setPlanItQuery] = useState('');
  const [planItResults, setPlanItResults] = useState([]);
  const [planItLoading, setPlanItLoading] = useState(false);

  useEffect(() => {
    // unified key name across app (tpa_google_api_key)
    const stored = typeof window !== 'undefined' ? localStorage.getItem('tpa_google_api_key') : null;
    if (stored) {
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
      if (manualLat && manualLng && !isNaN(parseFloat(manualLat)) && !isNaN(parseFloat(manualLng))) {
        options.manualCoordinates = [parseFloat(manualLng), parseFloat(manualLat)]; // lng, lat ordering for internal usage
      }
      // Call assess with adapted shape; agent.processDocuments will handle .buffer
      const assessmentResult = await agent.assessPlanningApplication(fileObjs, options);
      setAssessment(assessmentResult);
      setDraft(JSON.stringify(assessmentResult.results.report || {}, null, 2));
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

      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-zinc-100">
        <div className="container mx-auto px-6 py-8">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Development Management</h1>
                <p className="text-zinc-600 mt-1">AI-assisted planning application assessment</p>
              </div>
              {draft && (
                <div className="flex items-center gap-3">
                  <div className="h-8 w-px bg-zinc-300"></div>
                  <ExportButton content={draftReport} fileName="draft-officer-report" />
                </div>
              )}
            </div>
            <div className="w-80">
              <ProcessingProgressBar />
            </div>
          </div>
          
          <div className="grid grid-cols-12 gap-8">
            {/* Left Sidebar - Controls */}
            <div className="col-span-4 space-y-6">
              {/* (API Configuration removed; configure key via Settings page) */}

        {/* Local Authority Section */}
              <div className="bg-white/80 backdrop-blur-sm border border-zinc-200/60 rounded-xl shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-2 h-2 rounded-full ${authority ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
          <h2 className="text-lg font-semibold text-zinc-900">1. Local Authority</h2>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <select 
                      value={authority} 
                      onChange={e=>setAuthority(e.target.value)} 
                      className="flex-1 px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    >
                      <option value="">{authLoading ? 'Loading authorities...' : 'Select authority...'}</option>
                      {authorities.map(a => (
                        <option key={a.code} value={a.code}>{a.name}</option>
                      ))}
                    </select>
                    <button 
                      type="button" 
                      onClick={refreshAuthorities} 
                      className="px-3 py-3 border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors"
                      title="Refresh authorities list"
                    >
                      ↻
                    </button>
                  </div>
                  {authority && (
                    <div className="text-sm text-emerald-600 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      Authority selected: {authorities.find(a => a.code === authority)?.name || authority}
                    </div>
                  )}
                </div>
              </div>

        {/* Documents Section */}
              <div className="bg-white/80 backdrop-blur-sm border border-zinc-200/60 rounded-xl shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-2 h-2 rounded-full ${files.length ? 'bg-emerald-500' : 'bg-zinc-400'}`}></div>
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
                  
                  {/* Manual Coordinates */}
                  <details className="text-sm">
                    <summary className="cursor-pointer text-zinc-600 hover:text-zinc-800 font-medium mb-2">
                      Optional: Manual Site Coordinates
                    </summary>
                    <div className="space-y-3 pt-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input 
                          value={manualLat} 
                          onChange={e=>setManualLat(e.target.value)} 
                          placeholder="Latitude" 
                          className="px-3 py-2 border border-zinc-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                        <input 
                          value={manualLng} 
                          onChange={e=>setManualLng(e.target.value)} 
                          placeholder="Longitude" 
                          className="px-3 py-2 border border-zinc-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                      </div>
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        Use when automatic address detection fails. You can also click on the map once it's visible.
                      </p>
                    </div>
                  </details>
                </div>
              </div>

        {/* PlanIt Search Section */}
              <div className="bg-white/80 backdrop-blur-sm border border-zinc-200/60 rounded-xl shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
          <h2 className="text-lg font-semibold text-zinc-900">3. Precedent Search</h2>
                </div>
                <form onSubmit={runPlanItSearch} className="space-y-3">
                  <input 
                    type="text" 
                    value={planItQuery} 
                    onChange={e=>setPlanItQuery(e.target.value)} 
                    placeholder="Search planning applications..." 
                    className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                  <button 
                    type="submit" 
                    disabled={planItLoading || !planItQuery.trim()} 
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-4 py-3 rounded-lg transition-colors"
                  >
                    {planItLoading ? 'Searching...' : '🔍 Search Applications'}
                  </button>
                </form>
                
                {planItResults.length > 0 && (
                  <div className="mt-4 max-h-64 overflow-auto">
                    <h4 className="text-sm font-medium text-zinc-700 mb-2">Results:</h4>
                    <div className="space-y-2">
                      {planItResults.map((r, idx) => (
                        <div key={r.id || r.reference || idx} className="p-3 bg-zinc-50 rounded-lg border">
                          <div className="font-medium text-zinc-800 text-sm">{r.reference || r.id}</div>
                          <div className="text-zinc-600 text-xs mt-1 line-clamp-2">{r.address || r.site_address || r.location}</div>
                          {r.authority && <div className="text-zinc-500 text-xs mt-1">{r.authority}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {!planItLoading && planItResults.length === 0 && planItQuery && (
                  <div className="mt-4 text-center text-zinc-500 text-sm py-4">
                    No applications found matching your search.
                  </div>
                )}
              </div>
            </div>
            
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
