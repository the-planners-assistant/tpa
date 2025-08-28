export async function reportGenerationPhase(agent, assessment, assessmentId) {
  agent.addTimelineEvent(assessment, 'report_generation_start', 'Generating assessment report (modular)');

  const report = buildStructuredReportSkeleton(agent, assessment);

  // If no pro model or modular disabled, fall back to legacy single-pass behaviour
  if (!agent.proModel || agent.config?.modularOfficerReport === false) {
    return await legacySinglePass(agent, assessment, report);
  }

  try {
    // Stage 1: Generate outline plan to constrain later verbosity
  const outline = await generateReportOutline(agent, report, assessment);
    report.outline = outline;
    agent.addTimelineEvent(assessment, 'report_generation_outline', 'Report outline generated');

    // Stage 2: Section-by-section generation with filtered context
    const orderedSections = [
      'Introduction',
      'Site and Surroundings',
      'Proposal',
      'Relevant Planning History',
      'Policy Context',
      'Key Issues Assessment',
      'Planning Balance',
      'Recommendation',
      'Proposed Conditions'
    ];

    const sectionMarkdown = [];
    for (const sectionName of orderedSections) {
      const md = await generateSection(agent, sectionName, report, outline, assessment);
      if (md) sectionMarkdown.push(md.trim());
    }

    const assembled = `# Officer Report\n\n${sectionMarkdown.join('\n\n')}`.trim();
    report.officerReportMarkdown = assembled;
    agent.addTimelineEvent(assessment, 'report_generation_markdown', 'Modular officer report generated');
  } catch (e) {
    report.officerReportMarkdownError = e.message;
    report.officerReportMarkdown = basicMarkdownFallback(report);
    agent.addTimelineEvent(assessment, 'report_generation_markdown_error', `Modular report generation failed – fallback used: ${e.message}`);
  }

  agent.addTimelineEvent(assessment, 'report_generation_complete', 'Report generation phase complete');
  return report;
}

/** Build core structured data used by all prompts */
function buildStructuredReportSkeleton(agent, assessment){
  return {
    executive: agent.generateExecutiveSummary(assessment),
    siteAnalysis: agent.generateSiteAnalysisSection(assessment),
    proposalAnalysis: agent.generateProposalAnalysisSection(assessment),
    constraintsAssessment: agent.generateConstraintsSection(assessment),
    materialConsiderations: agent.generateMaterialConsiderationsSection(assessment),
    planningBalance: agent.generatePlanningBalanceSection(assessment),
    recommendation: agent.generateRecommendationSection(assessment),
    conditions: agent.generateConditionsSection(assessment),
    evidence: agent.generateEvidenceSection(assessment),
    appendices: agent.generateAppendicesSection(assessment)
  };
}

async function legacySinglePass(agent, assessment, report){
  if (!agent.proModel) {
    report.officerReportMarkdown = basicMarkdownFallback(report);
    agent.addTimelineEvent(assessment, 'report_generation_markdown_fallback', 'No pro model – fallback');
    return report;
  }
  try {
    const structuredSummary = JSON.stringify({
      executive: report.executive,
      keyIssues: report.recommendation?.keyConsiderations || [],
      constraints: Object.keys(report.siteAnalysis?.constraints||{}),
      material: report.materialConsiderations?.materialConsiderations || {},
      planningBalance: report.planningBalance?.balancingExercise || {},
      recommendation: report.recommendation,
      conditions: report.conditions?.conditions || []
    });
    const prompt = `You are a UK local planning authority case officer. Draft a professional, neutral OFFICER REPORT in Markdown. Only use provided data. Be concise.\n\nDATA:\n${structuredSummary}\n\nReturn ONLY Markdown.`;
    const stream = await agent.proModel.generateContentStream({
      model: 'gemini-2.5-pro',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
    });
    let md='';
    for await (const chunk of stream) { if (chunk.text) md += chunk.text; }
    report.officerReportMarkdown = md.trim();
    agent.addTimelineEvent(assessment, 'report_generation_markdown', 'Legacy single-pass officer report generated');
  } catch (e) {
    report.officerReportMarkdownError = e.message;
    report.officerReportMarkdown = basicMarkdownFallback(report);
    agent.addTimelineEvent(assessment, 'report_generation_markdown_error', `Legacy generation failed – fallback used: ${e.message}`);
  }
  return report;
}

/** Stage 1: Outline */
async function generateReportOutline(agent, report, assessment){
  const materialFiltered = filterMaterialForInclusion(agent, report.materialConsiderations?.materialConsiderations||{});
  const payload = {
    executive: report.executive,
    site: {
      location: report.siteAnalysis?.location,
      keyConstraints: Object.keys(report.siteAnalysis?.constraints||{}).slice(0,12)
    },
    proposal: {
      summary: report.proposalAnalysis?.extractedData?.description,
      keySpecs: pickTopSpecs(report.proposalAnalysis?.extractedData)
    },
    materialCategories: Object.keys(materialFiltered),
    planningBalance: {
      overallBalance: report.planningBalance?.overallBalance,
      benefits: report.planningBalance?.benefits?.slice(0,5),
      harms: report.planningBalance?.harms?.slice(0,5)
    },
    recommendation: report.recommendation?.decision
  };
  const prompt = `You are preparing a UK planning officer report. Create a STRICT OUTLINE (bullets) deciding what to include or omit. \nRules: \n- Include only material categories listed.\n- Omit trivial / neutral issues.\n- Maximum 3 bullets per section (except Key Issues: one bullet per included sub-issue).\n- If no relevant content, mark section: 'None relevant'.\nSections: Introduction; Site and Surroundings; Proposal; Relevant Planning History; Policy Context; Key Issues Assessment; Planning Balance; Recommendation; Proposed Conditions.\nReturn JSON with shape: { "sections": { "Section Name": { include: true/false, bullets: [".."], subsections?: {"Name": ["bullet", ...]} } } }.\nDATA:\n${JSON.stringify(payload)}\n`;
  const res = await agent.proModel.generateContent({ model: 'gemini-2.5-pro', contents:[{role:'user', parts:[{text:prompt}]}], generationConfig:{temperature:0.1, maxOutputTokens:1024}});
  const text = res.response.text();
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch { /* ignore */ }
  return { raw: text };
}

/** Stage 2: Generate individual section */
async function generateSection(agent, sectionName, report, outline, assessment){
  const sectionPlan = outline?.sections?.[sectionName];
  if (sectionPlan && sectionPlan.include === false) {
    return `## ${sectionName}\nNone relevant.`;
  }
  const context = buildSectionContext(agent, sectionName, report, assessment);
  const planBullets = (sectionPlan?.bullets||[]).slice(0,4).join('\n- ');
  const materialCats = Object.keys(context.material||{});
  const verbosity = agent.config?.reportVerbosity || 'medium';
  const caps = { low: 110, medium: 160, high: 230 };
  const keyIssueSubCap = { low: 70, medium: 90, high: 120 };
  const wordCap = caps[verbosity] || caps.medium;
  const subCap = keyIssueSubCap[verbosity] || keyIssueSubCap.medium;
  const prompt = `Draft ONLY the "${sectionName}" section of a UK planning officer report in Markdown.\nConstraints:\n- Max ${wordCap} words${sectionName==='Key Issues Assessment'?` (per sub-issue max ${subCap} words)`:''}.\n- Use only provided data.\n- Summarise; do not list every constraint/policy unless directly relevant.\n- Cite policy codes only if present.\n- Avoid repetition.\n- Do not speculate or invent.\nVerbosity level: ${verbosity}.\nIf data for this section is minimal, write a single concise sentence stating that.\nSection plan bullets (may refine):\n${planBullets ? '- '+planBullets : '(No explicit bullets – summarise core facts)'}\n\nDATA:\n${JSON.stringify(context)}\n\nReturn Markdown starting with "## ${sectionName}". Do NOT include other sections.`;
  try {
    if (agent.config?.reportDebugContexts) {
      agent.addTimelineEvent(assessment, 'report_generation_section_prompt', `${sectionName} prompt tokens≈${prompt.length/4|0}`);
    }
    const res = await agent.proModel.generateContent({ model:'gemini-2.5-pro', contents:[{role:'user', parts:[{text:prompt}]}], generationConfig:{temperature:0.15, maxOutputTokens:800}});
    const md = res.response.text();
    // Basic guard: ensure heading
    let final = md.trim();
    if (!/^##\s+/.test(final)) {
      final = `## ${sectionName}\n${final}`;
    }
    // If only heading (model returned nothing substantive), craft fallback line
    if (/^##\s+.+$/.test(final) && !/\n.+/.test(final)) {
      const fallbackLine = synthesizeFallbackLine(sectionName, context);
      final = `${final}\n${fallbackLine}`;
      agent.addTimelineEvent(assessment, 'report_generation_section_fallback', `${sectionName} empty – fallback sentence inserted`);
    }
    // Append debug JSON context if enabled
    if (agent.config?.reportDebugContexts) {
      const debugJson = JSON.stringify(context, null, 2).slice(0, 2000);
      final += `\n\n<details><summary>🔍 Section Context JSON (debug)</summary>\n\n\n\n\`\`\`json\n${debugJson}\n\`\`\`\n</details>`;
    }
    return truncateMarkdownSection(final, sectionName, sectionName==='Key Issues Assessment'? 900: 600 + (agent.config?.reportDebugContexts?2000:0));
  } catch (e) {
    agent.addTimelineEvent(assessment, 'report_generation_section_error', `${sectionName} failed: ${e.message}`);
    if (agent.config?.reportDebugContexts) {
      const debugErr = { error: e.message, section: sectionName, contextKeys: Object.keys(context||{}), promptPreview: prompt.slice(0,400) };
      agent.addTimelineEvent(assessment, 'report_generation_section_error_detail', JSON.stringify(debugErr));
    }
    return `## ${sectionName}\nSection generation failed.`;
  }
}

function buildSectionContext(agent, sectionName, report, assessment){
  const retrieval = assessment.results.ai?.retrievalResults || {};
  const policyItems = [
    ...(retrieval.localPolicy||[]),
    ...(retrieval.policies||[]),
    ...(retrieval.combined||[]).filter(r=>/policy/i.test(r.source||''))
  ].slice(0,12);
  const materialAll = report.materialConsiderations?.materialConsiderations || {};
  const materialFiltered = filterMaterialForInclusion(agent, materialAll);
  const base = { section: sectionName };
  switch(sectionName){
    case 'Introduction':
      return { ...base, executive: report.executive };
    case 'Site and Surroundings':
      return { ...base, site: { location: report.siteAnalysis.location, siteCharacteristics: limitKeys(report.siteAnalysis.siteCharacteristics,12), constraints: sampleConstraints(report.siteAnalysis.constraints,8) } };
    case 'Proposal':
      return { ...base, proposal: report.proposalAnalysis.extractedData };
    case 'Relevant Planning History':
      // Placeholder – could filter retrieval for precedent cases
      return { ...base, history: (retrieval.planIt||[]).slice(0,5) };
    case 'Policy Context':
      return { ...base, policies: policyItems.map(p=>{
        const obj = pick(p,['code','title','content','source']);
        if (obj.content && obj.content.length > 400) obj.content = obj.content.slice(0,400)+'…';
        return obj;
      }).slice(0,15) };
    case 'Key Issues Assessment':
      return { ...base, material: materialFiltered };
    case 'Planning Balance':
      return { ...base, balance: report.planningBalance };
    case 'Recommendation':
      return { ...base, recommendation: report.recommendation };
    case 'Proposed Conditions':
      return { ...base, conditions: report.conditions.conditions || [] };
    default:
      return base;
  }
}

function filterMaterialForInclusion(agent, material){
  const out = {};
  for (const [cat, obj] of Object.entries(material)) {
    const score = obj.overallScore;
  const includeNeutral = agent?.config?.reportIncludeNeutralMaterial === true;
  const scoreInclude = typeof score === 'number' && (score >= 70 || score <= 30);
  const priority = ['Heritage','Statutory','Transport','Environment'].includes(cat);
  const neutralOk = includeNeutral && typeof score === 'number' && score > 30 && score < 70;
  const include = scoreInclude || priority || neutralOk;
    if (include) out[cat] = {
      overallScore: obj.overallScore,
      considerations: (obj.considerations||[]).slice(0,4).map(c=>({ name: c.name||c.factor||c.title, score: c.score, summary: truncate((c.analysis||'').replace(/\n+/g,' '), 280), conditions: c.conditions||[] }))
    };
  }
  return out;
}

function pickTopSpecs(extracted){
  if(!extracted) return {};
  const keys = ['units','floors','height','storeys','parking','siteArea','floorArea'];
  const out={};
  for(const k of keys){ if(extracted[k]!=null) out[k]=extracted[k]; }
  return out;
}

function limitKeys(obj, max){
  if(!obj) return {};
  return Object.fromEntries(Object.entries(obj).slice(0,max));
}
function sampleConstraints(constraintsObj, max){
  if(!constraintsObj) return [];
  const arr = Object.entries(constraintsObj).map(([k,v])=>({ type:k, count:v.count, present:v.present }));
  return arr.slice(0,max);
}
function truncate(str, max){ if(!str) return str; return str.length>max? str.slice(0,max-3)+'...': str; }
function truncateMarkdownSection(md, heading, maxChars){
  if(md.length <= maxChars) return md;
  // Preserve first paragraph(s) until limit
  return md.slice(0,maxChars-15).trimEnd()+`\n\n<!-- truncated for brevity -->`;
}
function pick(obj, keys){ if(!obj) return {}; const out={}; for(const k of keys){ if(obj[k]!=null) out[k]=obj[k]; } return out; }

function synthesizeFallbackLine(sectionName, context){
  switch(sectionName){
    case 'Introduction':
      return 'No additional introductory detail available beyond headline data.';
    case 'Site and Surroundings':
      return 'Limited site data; no significant contextual constraints beyond those listed elsewhere.';
    case 'Proposal':
      return 'Proposal details minimal in source documents.';
    case 'Relevant Planning History':
      return 'No relevant planning history identified in supplied or retrieved data.';
    case 'Policy Context':
      return 'Only core policy references identified; no further policy exposition required.';
    case 'Key Issues Assessment':
      return 'No significant material considerations met inclusion thresholds.';
    case 'Planning Balance':
      return `Overall balance: ${context?.balance?.overallBalance || 'neutral'} with no further elaboration required.`;
    case 'Recommendation':
      return `Recommendation remains ${context?.recommendation?.decision || 'undetermined'} based on limited data.`;
    case 'Proposed Conditions':
      return (context?.conditions?.length ? 'Conditions listed above form the full recommended set.' : 'No conditions recommended based on available data.');
    default:
      return 'No additional information.';
  }
}

function basicMarkdownFallback(report){
  const conds = (report.conditions?.conditions||[]).map((c,i)=>`${i+1}. ${c}`).join('\n') || 'None.';
  return `# Officer Report (Fallback)\n\n## Introduction\nAuto-generated fallback report.\n\n## Site and Surroundings\n${report.executive?.applicationSite||'Unknown site.'}\n\n## Proposal\n${report.executive?.proposalSummary||'Description unavailable.'}\n\n## Policy Context\nPolicies derived from provided data only.\n\n## Key Issues Assessment\n(Structured analysis unavailable in fallback mode.)\n\n## Planning Balance\n${report.planningBalance?.balancingExercise?.balancingNarrative || 'Balance narrative unavailable.'}\n\n## Recommendation\n**Decision:** ${report.recommendation?.decision||'N/A'} – ${report.recommendation?.reasoning||'No reasoning'}\n\n## Proposed Conditions\n${conds}\n`;
}
