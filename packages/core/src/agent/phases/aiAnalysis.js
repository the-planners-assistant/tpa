export async function aiAnalysisPhase(agent, documentResults, spatialResults, assessment) {
  if (!agent.visionModel) {
    agent.addTimelineEvent(assessment, 'ai_analysis_skip', 'AI analysis skipped - no model configured');
    return { available: false, reason: 'No AI model configured' };
  }

  agent.addTimelineEvent(assessment, 'ai_analysis_start', 'Starting enhanced AI-powered multimodal analysis with parallel processing');
  
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
    // Phase 1: Enhanced text analysis with agentic retrieval (sequential)
    let developmentType = null;
    let retrievalResults = null;
    
    if (documentResults.chunks?.length) {
      agent.addTimelineEvent(assessment, 'ai_text_analysis', 'Analyzing document content with enhanced retrieval');
      
      // Use agentic retrieval to find relevant additional context
      const context = {
        authority: assessment.authority,
        coordinates: assessment.results?.address?.primaryAddress?.coordinates,
        developmentType: await agent.inferDevelopmentType(documentResults.chunks)
      };
      developmentType = context.developmentType;

      retrievalResults = await agent.agenticRetrieve(
        `planning analysis ${documentResults.extractedData?.description || 'development proposal'}`,
        context,
        { useAgentic: true }
      );
      results.retrievalResults = retrievalResults;
    }

    // Phase 2: Parallel AI Analysis - Run multiple analyses simultaneously
    agent.addTimelineEvent(assessment, 'ai_parallel_analysis', 'Running parallel AI analyses');
    
    const parallelAnalyses = [];
    
    // Text analysis with retrieved context
    if (documentResults.chunks?.length) {
      parallelAnalyses.push(
        agent.analyzeTextContentWithContext(documentResults.chunks, retrievalResults.combined)
          .then(result => ({ type: 'textAnalysis', result }))
          .catch(error => ({ type: 'textAnalysis', error: error.message }))
      );
    }
    
    // Image analysis (if images available)
    if (documentResults.images?.length) {
      parallelAnalyses.push(
        agent.analyzeImages(documentResults.images)
          .then(result => ({ type: 'imageAnalysis', result }))
          .catch(error => ({ type: 'imageAnalysis', error: error.message }))
      );
    }
    
    // Contextual analysis
    parallelAnalyses.push(
      agent.performEnhancedContextualAnalysis(documentResults, spatialResults, retrievalResults)
        .then(result => ({ type: 'contextualAnalysis', result }))
        .catch(error => ({ type: 'contextualAnalysis', error: error.message }))
    );
    
    // Execute all parallel analyses
    const parallelResults = await Promise.allSettled(parallelAnalyses);
    
    // Process parallel results
    for (const settledResult of parallelResults) {
      if (settledResult.status === 'fulfilled') {
        const { type, result, error } = settledResult.value;
        if (error) {
          console.warn(`${type} failed:`, error);
          agent.addTimelineEvent(assessment, `ai_${type}_error`, `${type} failed: ${error}`);
        } else {
          results[type] = result;
          agent.addTimelineEvent(assessment, `ai_${type}_complete`, `${type} completed successfully`);
        }
      } else {
        console.warn('Parallel analysis promise rejected:', settledResult.reason);
      }
    }

    // Phase 3: Sequential post-processing that depends on parallel results
    agent.addTimelineEvent(assessment, 'ai_evidence_generation', 'Generating evidence chains');
    
    // Generate evidence chains and comprehensive assessment in parallel
    const postProcessingPromises = [
      agent.generateEvidenceChains(results.textAnalysis, results.contextualAnalysis, results.retrievalResults)
        .then(result => ({ type: 'evidenceChains', result }))
        .catch(error => ({ type: 'evidenceChains', error: error.message })),
      
      agent.performComprehensivePlanningAssessment(documentResults, spatialResults, results)
        .then(result => ({ type: 'planningAssessment', result }))
        .catch(error => ({ type: 'planningAssessment', error: error.message }))
    ];
    
    const postProcessingResults = await Promise.allSettled(postProcessingPromises);
    
    // Process post-processing results
    for (const settledResult of postProcessingResults) {
      if (settledResult.status === 'fulfilled') {
        const { type, result, error } = settledResult.value;
        if (error) {
          console.warn(`${type} failed:`, error);
          results[type] = [];
        } else {
          results[type] = result;
        }
      }
    }

    // Phase 4: Calculate overall confidence
    results.confidence = agent.calculateEnhancedAIConfidence(results);

    const completedAnalyses = Object.entries(results).filter(([key, value]) => 
      value && !['confidence', 'retrievalResults'].includes(key)).length;
    
    agent.addTimelineEvent(assessment, 'ai_analysis_complete', 
      `Enhanced AI analysis completed with ${(results.confidence * 100).toFixed(0)}% confidence, ` +
      `${results.evidenceChains?.length || 0} evidence chains generated, ` +
      `${completedAnalyses} analyses completed in parallel`
    );

  } catch (error) {
    console.error('Enhanced AI analysis failed:', error);
    agent.addTimelineEvent(assessment, 'ai_analysis_error', `Analysis failed: ${error.message}`);
    results.error = error.message;
    results.confidence = 0;
  }

  return results;
}
