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
  agent.addTimelineEvent(assessment, 'report_generation_complete', 'Comprehensive report generated');
  return report;
}
