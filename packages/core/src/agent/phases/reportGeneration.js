export async function reportGenerationPhase(agent, assessment, assessmentId) {
  agent.addTimelineEvent(assessment, 'report_generation_start', 'Generating comprehensive assessment report');
  const report = {
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
  // Generate prose officer report (Markdown) using pro model if available
  if (agent.proModel) {
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
      const prompt = `You are a UK local planning authority case officer. Draft a professional, neutral, well-structured OFFICER REPORT in Markdown. Audience: planning committee + public. Base ONLY on the provided structured assessment data. Do not invent new policies.

REQUIRED SECTIONS (Markdown H2/H3):
1. Introduction
2. Site and Surroundings
3. Proposal
4. Relevant Planning History (state 'None relevant' if none provided)
5. Policy Context (only policies explicitly present in data)
6. Key Issues Assessment (Design / Character; Amenity; Heritage; Transport & Access; Environment & Sustainability; Other where relevant)
7. Planning Balance
8. Recommendation
9. Proposed Conditions (numbered list; each with Reason referencing policy where available)

STYLE:
- Concise, factual, evidence-grounded.
- Cite only provided policy codes.
- Flag any data limitations plainly.
- No marketing language.

DATA:
${structuredSummary}

Return ONLY Markdown.`;
      const stream = await agent.proModel.generateContentStream({
        model: 'gemini-2.5-pro',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
      });
      let md='';
      for await (const chunk of stream) { if (chunk.text) md += chunk.text; }
      report.officerReportMarkdown = md.trim();
      agent.addTimelineEvent(assessment, 'report_generation_markdown', 'Officer Markdown report generated');
    } catch (e) {
      // Fallback basic markdown template
      report.officerReportMarkdownError = e.message;
      report.officerReportMarkdown = basicMarkdownFallback(report);
      agent.addTimelineEvent(assessment, 'report_generation_markdown_error', `Officer report generation failed – fallback used: ${e.message}`);
    }
  } else {
    report.officerReportMarkdown = basicMarkdownFallback(report);
  }
  agent.addTimelineEvent(assessment, 'report_generation_complete', 'Comprehensive report generated');
  return report;
}

function basicMarkdownFallback(report){
  const conds = (report.conditions?.conditions||[]).map((c,i)=>`${i+1}. ${c}`).join('\n') || 'None.';
  return `# Officer Report (Fallback)\n\n## Introduction\nAuto-generated fallback report.\n\n## Site and Surroundings\n${report.executive?.applicationSite||'Unknown site.'}\n\n## Proposal\n${report.executive?.proposalSummary||'Description unavailable.'}\n\n## Policy Context\nPolicies derived from provided data only.\n\n## Key Issues Assessment\n(Structured analysis unavailable in fallback mode.)\n\n## Planning Balance\n${report.planningBalance?.balancingExercise?.balancingNarrative || 'Balance narrative unavailable.'}\n\n## Recommendation\n**Decision:** ${report.recommendation?.decision||'N/A'} – ${report.recommendation?.reasoning||'No reasoning'}\n\n## Proposed Conditions\n${conds}\n`;
}
