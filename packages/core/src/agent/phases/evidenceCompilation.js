export async function evidenceCompilationPhase(agent, documentResults, spatialResults, aiResults, materialResults, assessmentId, assessment) {
  agent.addTimelineEvent(assessment, 'evidence_compilation_start', 'Compiling comprehensive evidence base');
  const evidence = await agent.evidenceEngine.generateEvidence(assessmentId, documentResults, spatialResults, aiResults);
  agent.addTimelineEvent(assessment, 'evidence_compilation_complete', `Evidence compiled: ${evidence.citations.size} citations generated`);
  return evidence;
}
