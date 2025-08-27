export async function spatialAnalysisPhase(agent, coordinates, assessment) {
  agent.addTimelineEvent(assessment, 'spatial_analysis_start', 'Starting comprehensive spatial analysis');
  const spatialResult = await agent.spatialAnalyzer.analyzeSite(coordinates);
  agent.addTimelineEvent(assessment, 'spatial_analysis_complete', `Identified ${Object.keys(spatialResult.intersections || {}).length} constraint types`);
  return spatialResult;
}
