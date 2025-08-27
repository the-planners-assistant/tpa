export async function decisionSynthesisPhase(agent, assessment, assessmentId) {
  agent.addTimelineEvent(assessment, 'decision_synthesis_start', 'Synthesizing final recommendation');
  const materialRecommendation = assessment.results.material?.overallRecommendation;
  const aiAssessment = assessment.results.ai?.planningAssessment;
  const evidenceQuality = assessment.results.evidence;
  const materialConfidence = materialRecommendation?.confidence || 0.5;
  const aiConfidence = assessment.results.ai?.confidence || 0.5;
  const evidenceConfidence = agent.calculateEvidenceConfidence(evidenceQuality);
  const overallConfidence = (materialConfidence * 0.4 + aiConfidence * 0.3 + evidenceConfidence * 0.3);
  let decision = 'defer'; let reasoning = 'Insufficient information for clear recommendation';
  if (materialRecommendation?.decision) { decision = materialRecommendation.decision; reasoning = materialRecommendation.reasoning; }
  const riskFactors = agent.identifyRiskFactors(assessment);
  const recommendation = { decision, reasoning, confidence: overallConfidence, riskFactors, keyConsiderations: agent.extractKeyConsiderations(assessment), conditions: agent.suggestConditions(assessment), informationRequirements: agent.identifyInformationRequirements(assessment), appealRisk: agent.assessAppealRisk(assessment), synthesis: { materialBalance: materialRecommendation, aiInsights: aiAssessment, evidenceQuality: evidenceConfidence, overallConfidence } };
  agent.addTimelineEvent(assessment, 'decision_synthesis_complete', `Recommendation: ${decision} (${(overallConfidence * 100).toFixed(0)}% confidence)`);
  return recommendation;
}
