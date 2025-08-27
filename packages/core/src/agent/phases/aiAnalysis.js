export async function aiAnalysisPhase(agent, documentResults, spatialResults, assessment) {
  if (!agent.visionModel) return { available: false, reason: 'No AI model configured' };
  agent.addTimelineEvent(assessment, 'ai_analysis_start', 'Starting AI-powered multimodal analysis');
  const results = { textAnalysis: null, imageAnalysis: [], contextualAnalysis: null, planningAssessment: null, confidence: 0 };
  try {
    if (documentResults.chunks?.length) results.textAnalysis = await agent.analyzeTextContent(documentResults.chunks);
    if (documentResults.images?.length) results.imageAnalysis = await agent.analyzeImages(documentResults.images);
    results.contextualAnalysis = await agent.performContextualAnalysis(documentResults, spatialResults);
    results.planningAssessment = await agent.performPlanningAssessment(documentResults, spatialResults, results);
    results.confidence = agent.calculateAIConfidence(results);
    agent.addTimelineEvent(assessment, 'ai_analysis_complete', `AI analysis completed with ${(results.confidence * 100).toFixed(0)}% confidence`);
  } catch (error) {
    console.error('AI analysis failed:', error);
    results.error = error.message;
    results.confidence = 0;
  }
  return results;
}
