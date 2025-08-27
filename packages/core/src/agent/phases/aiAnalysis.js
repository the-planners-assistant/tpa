export async function aiAnalysisPhase(agent, documentResults, spatialResults, assessment) {
  if (!agent.visionModel) {
    agent.addTimelineEvent(assessment, 'ai_analysis_skip', 'AI analysis skipped - no model configured');
    return { available: false, reason: 'No AI model configured' };
  }

  agent.addTimelineEvent(assessment, 'ai_analysis_start', 'Starting enhanced AI-powered multimodal analysis');
  
  const results = { 
    textAnalysis: null, 
    imageAnalysis: [], 
    contextualAnalysis: null, 
    planningAssessment: null, 
    retrievalResults: null,
    evidenceChains: [],
    confidence: 0 
  };

  try {
    // Phase 1: Enhanced text analysis with agentic retrieval
    if (documentResults.chunks?.length) {
      agent.addTimelineEvent(assessment, 'ai_text_analysis', 'Analyzing document content with enhanced retrieval');
      
      // Use agentic retrieval to find relevant additional context
      const context = {
        authority: assessment.authority,
        coordinates: assessment.results?.address?.primaryAddress?.coordinates,
        developmentType: await agent.inferDevelopmentType(documentResults.chunks)
      };

      const retrievalResults = await agent.agenticRetrieve(
        `planning analysis ${documentResults.extractedData?.description || 'development proposal'}`,
        context,
        { useAgentic: true }
      );
      results.retrievalResults = retrievalResults;

      // Enhanced text analysis with retrieved context
      results.textAnalysis = await agent.analyzeTextContentWithContext(
        documentResults.chunks, 
        retrievalResults.combined
      );
    }

    // Phase 2: Image analysis (if images available)
    if (documentResults.images?.length) {
      agent.addTimelineEvent(assessment, 'ai_image_analysis', `Analyzing ${documentResults.images.length} images`);
      results.imageAnalysis = await agent.analyzeImages(documentResults.images);
    }

    // Phase 3: Contextual analysis with enhanced evidence
    agent.addTimelineEvent(assessment, 'ai_contextual_analysis', 'Performing contextual analysis with evidence chains');
    results.contextualAnalysis = await agent.performEnhancedContextualAnalysis(
      documentResults, 
      spatialResults, 
      results.retrievalResults
    );

    // Phase 4: Generate evidence chains for key claims
    results.evidenceChains = await agent.generateEvidenceChains(
      results.textAnalysis,
      results.contextualAnalysis,
      results.retrievalResults
    );

    // Phase 5: Comprehensive planning assessment
    agent.addTimelineEvent(assessment, 'ai_planning_assessment', 'Generating comprehensive planning assessment');
    results.planningAssessment = await agent.performComprehensivePlanningAssessment(
      documentResults, 
      spatialResults, 
      results
    );

    // Phase 6: Calculate overall confidence
    results.confidence = agent.calculateEnhancedAIConfidence(results);

    agent.addTimelineEvent(assessment, 'ai_analysis_complete', 
      `Enhanced AI analysis completed with ${(results.confidence * 100).toFixed(0)}% confidence, ${results.evidenceChains.length} evidence chains generated`
    );

  } catch (error) {
    console.error('Enhanced AI analysis failed:', error);
    agent.addTimelineEvent(assessment, 'ai_analysis_error', `Analysis failed: ${error.message}`);
    results.error = error.message;
    results.confidence = 0;
  }

  return results;
}
