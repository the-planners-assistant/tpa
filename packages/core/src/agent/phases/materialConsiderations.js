export async function materialConsiderationsPhase(agent, documentResults, spatialResults, aiResults, assessment) {
  agent.addTimelineEvent(assessment, 'material_considerations_start', 'Assessing material planning considerations');
  const mc = await agent.materialConsiderations.assessApplication(documentResults.extractedData, spatialResults, documentResults);
  agent.addTimelineEvent(assessment, 'material_considerations_complete', `Material considerations assessed: ${mc.overallRecommendation?.decision || 'unknown'}`);
  return mc;
}
