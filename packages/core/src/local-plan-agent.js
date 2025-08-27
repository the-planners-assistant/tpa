import { GoogleGenerativeAI } from '@google/generative-ai';
import Embedder from '@tpa/nlp/src/index.js';
import Reranker from '@tpa/nlp/src/reranker.js';
import { getDatabase } from './database.js';
import Agent from './agent.js';
import ApplicantDataManager from './applicant-data-manager.js';
import PolicyComplianceEngine from './policy-compliance.js';
import ScenarioModeler from './scenario-modeler.js';
import SiteSuitabilityAnalyzer from './site-suitability-analyzer.js';
import KnowledgeGraph from './knowledge-graph.js';

/**
 * LocalPlanAgent
 * AI-powered agent for intelligent local plan management, analysis, and decision support
 * Extends the main TPA Agent with specialized local plan capabilities
 */
export default class LocalPlanAgent extends Agent {
  constructor(config = {}) {
    super(config);
    
    // Local plan specific components
    this.applicantDataManager = new ApplicantDataManager(this.database);
    this.policyComplianceEngine = new PolicyComplianceEngine(this.database);
    this.scenarioModeler = new ScenarioModeler(this.database);
    this.siteSuitabilityAnalyzer = new SiteSuitabilityAnalyzer(this.database);
    this.knowledgeGraph = new KnowledgeGraph(this.database);
    
    // AI-specific configuration for local plan analysis
    this.localPlanConfig = {
      policyAnalysisModel: config.policyAnalysisModel || 'gemini-2.5-flash',
      scenarioModelingDepth: config.scenarioModelingDepth || 'comprehensive',
      complianceThreshold: config.complianceThreshold || 0.75,
      enablePredictiveAnalysis: config.enablePredictiveAnalysis !== false,
      enableSemanticSearch: config.enableSemanticSearch !== false,
      maxPolicyConnections: config.maxPolicyConnections || 50
    };
    
    // Context management for local plan analysis
    this.localPlanContext = new Map();
    this.policyEmbeddings = new Map();
    this.analysisHistory = [];
  }

  /**
   * Intelligent Policy Analysis
   * Uses AI to analyze policy documents and extract structured information
   */
  async analyzePolicy(policyDocument, planId, options = {}) {
    await this.initPromise;
    
    try {
      const analysis = {
        id: this.generateAssessmentId(),
        timestamp: new Date().toISOString(),
        planId,
        status: 'analyzing'
      };

      // Phase 1: Document parsing and content extraction
      const documentResults = await this.parser.parseDocument(policyDocument);
      analysis.content = documentResults.fullText;
      analysis.metadata = documentResults.metadata;

      // Phase 2: AI-powered policy structure analysis
      const structureAnalysis = await this.analyzePolicyStructure(documentResults.fullText);
      analysis.structure = structureAnalysis;

      // Phase 3: Policy classification and categorization
      const classification = await this.classifyPolicy(documentResults.fullText, structureAnalysis);
      analysis.classification = classification;

      // Phase 4: Extract policy requirements and criteria
      const requirements = await this.extractPolicyRequirements(documentResults.fullText);
      analysis.requirements = requirements;

      // Phase 5: Generate semantic embeddings for search and matching
      if (this.localPlanConfig.enableSemanticSearch) {
        const embeddings = await this.embedder.embed(documentResults.fullText);
        analysis.embeddings = embeddings;
        this.policyEmbeddings.set(analysis.id, embeddings);
      }

      // Phase 6: Cross-reference with existing policies
      const crossReferences = await this.findPolicyCrossReferences(
        documentResults.fullText, 
        planId, 
        classification.category
      );
      analysis.crossReferences = crossReferences;

      // Phase 7: Generate implementation guidance
      const implementationGuidance = await this.generateImplementationGuidance(
        documentResults.fullText,
        requirements,
        classification
      );
      analysis.implementationGuidance = implementationGuidance;

      analysis.status = 'completed';
      analysis.confidence = this.calculateAnalysisConfidence(analysis);

      return analysis;
    } catch (error) {
      console.error('Policy analysis failed:', error);
      throw new Error(`Failed to analyze policy: ${error.message}`);
    }
  }

  /**
   * AI-powered policy structure analysis
   */
  async analyzePolicyStructure(policyText) {
    if (!this.model) {
      throw new Error('AI model not configured');
    }

    const prompt = `
Analyze the structure of this planning policy document and extract:

1. Policy hierarchy (main sections, subsections)
2. Policy reference numbers/codes
3. Key objectives and aims
4. Specific requirements and criteria
5. Related policies mentioned
6. Geographic scope (if specified)
7. Implementation timeframe

Policy Text:
${policyText}

Return a structured JSON response with the following format:
{
  "hierarchy": [...],
  "policyReferences": [...],
  "objectives": [...],
  "requirements": [...],
  "relatedPolicies": [...],
  "geographicScope": "...",
  "timeframe": "..."
}`;

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();
      
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback to basic structure if JSON parsing fails
      return this.extractBasicStructure(policyText);
    } catch (error) {
      console.warn('AI structure analysis failed, using fallback:', error);
      return this.extractBasicStructure(policyText);
    }
  }

  /**
   * AI-powered policy classification
   */
  async classifyPolicy(policyText, structure) {
    if (!this.model) {
      return this.classifyPolicyFallback(policyText);
    }

    const prompt = `
Classify this planning policy into appropriate categories and determine its characteristics:

Policy Text: ${policyText.substring(0, 2000)}...

Structure Context: ${JSON.stringify(structure, null, 2)}

Classify into:
1. Primary category (housing, transport, environment, heritage, economy, etc.)
2. Policy type (strategic, development management, site allocation, etc.)
3. Geographic level (strategic, local, site-specific)
4. Enforcement level (mandatory, advisory, guidance)
5. Complexity score (1-5)
6. Key themes and topics

Return JSON format:
{
  "category": "...",
  "type": "...",
  "geographicLevel": "...",
  "enforcementLevel": "...",
  "complexityScore": 1-5,
  "themes": [...],
  "topics": [...],
  "confidence": 0.0-1.0
}`;

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();
      
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return this.classifyPolicyFallback(policyText);
    } catch (error) {
      console.warn('AI classification failed, using fallback:', error);
      return this.classifyPolicyFallback(policyText);
    }
  }

  /**
   * Extract policy requirements using AI
   */
  async extractPolicyRequirements(policyText) {
    if (!this.model) {
      return this.extractRequirementsFallback(policyText);
    }

    const prompt = `
Extract specific requirements and criteria from this planning policy:

${policyText}

Identify:
1. Mandatory requirements (must/shall/required)
2. Advisory guidelines (should/recommended)
3. Quantitative criteria (numbers, percentages, sizes)
4. Qualitative criteria (design principles, standards)
5. Assessment criteria for applications
6. Evidence requirements
7. Consultation requirements

Return structured JSON:
{
  "mandatory": [...],
  "advisory": [...],
  "quantitative": {...},
  "qualitative": [...],
  "assessmentCriteria": [...],
  "evidenceRequirements": [...],
  "consultationRequirements": [...]
}`;

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();
      
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return this.extractRequirementsFallback(policyText);
    } catch (error) {
      console.warn('AI requirements extraction failed, using fallback:', error);
      return this.extractRequirementsFallback(policyText);
    }
  }

  /**
   * AI-powered application assessment against local plan policies
   */
  async assessApplicationCompliance(applicationData, planId, options = {}) {
    await this.initPromise;

    try {
      // Get relevant policies for this application
      const relevantPolicies = await this.findRelevantPolicies(applicationData, planId);
      
      // Run comprehensive compliance assessment
      const complianceResults = await this.policyComplianceEngine.runComplianceCheck(
        applicationData.id,
        relevantPolicies.map(p => p.id),
        {
          enableAIAnalysis: true,
          includeRecommendations: true,
          confidenceThreshold: this.localPlanConfig.complianceThreshold
        }
      );

      // Enhanced AI analysis of compliance gaps
      const gapAnalysis = await this.analyzeComplianceGaps(
        applicationData,
        relevantPolicies,
        complianceResults
      );

      // Generate intelligent recommendations
      const recommendations = await this.generateComplianceRecommendations(
        applicationData,
        complianceResults,
        gapAnalysis
      );

      return {
        applicationId: applicationData.id,
        planId,
        timestamp: new Date().toISOString(),
        relevantPolicies: relevantPolicies.length,
        complianceScore: complianceResults.overallScore,
        complianceStatus: this.determineComplianceStatus(complianceResults.overallScore),
        detailedResults: complianceResults,
        gapAnalysis,
        recommendations,
        confidence: complianceResults.confidence
      };
    } catch (error) {
      console.error('Application compliance assessment failed:', error);
      throw new Error(`Failed to assess application compliance: ${error.message}`);
    }
  }

  /**
   * AI-powered scenario modeling and impact assessment
   */
  async runIntelligentScenarioModeling(scenarioParameters, planId, options = {}) {
    await this.initPromise;

    try {
      // Run base scenario modeling
      const baseResults = await this.scenarioModeler.runScenarioModeling(scenarioParameters);

      // AI-enhanced impact prediction
      const aiImpactAnalysis = await this.predictScenarioImpacts(scenarioParameters, planId);

      // Risk assessment using AI
      const riskAssessment = await this.assessScenarioRisks(scenarioParameters, baseResults);

      // Generate optimization suggestions
      const optimizationSuggestions = await this.generateScenarioOptimizations(
        scenarioParameters,
        baseResults,
        aiImpactAnalysis
      );

      // Comparative analysis with existing scenarios
      const comparativeAnalysis = await this.compareWithExistingScenarios(
        scenarioParameters,
        planId
      );

      return {
        scenarioId: baseResults.scenarioId,
        baseResults,
        aiImpactAnalysis,
        riskAssessment,
        optimizationSuggestions,
        comparativeAnalysis,
        confidence: this.calculateScenarioConfidence(baseResults, aiImpactAnalysis),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Intelligent scenario modeling failed:', error);
      throw new Error(`Failed to run intelligent scenario modeling: ${error.message}`);
    }
  }

  /**
   * AI-powered site suitability assessment
   */
  async runIntelligentSiteAssessment(siteData, planId, options = {}) {
    await this.initPromise;

    try {
      // Run base suitability analysis
      const baseAssessment = await this.siteSuitabilityAnalyzer.assessSiteSuitability(siteData);

      // AI-enhanced constraint analysis
      const aiConstraintAnalysis = await this.analyzeConstraintsWithAI(siteData, planId);

      // Predictive capacity modeling
      const capacityPrediction = await this.predictSiteCapacity(siteData, baseAssessment);

      // Market viability assessment with AI
      const marketViability = await this.assessMarketViabilityWithAI(siteData, planId);

      // Generate development recommendations
      const developmentRecommendations = await this.generateDevelopmentRecommendations(
        siteData,
        baseAssessment,
        aiConstraintAnalysis
      );

      return {
        siteId: siteData.id,
        baseAssessment,
        aiConstraintAnalysis,
        capacityPrediction,
        marketViability,
        developmentRecommendations,
        overallSuitability: this.calculateOverallSuitability(baseAssessment, aiConstraintAnalysis),
        confidence: this.calculateSiteAssessmentConfidence(baseAssessment, aiConstraintAnalysis),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Intelligent site assessment failed:', error);
      throw new Error(`Failed to run intelligent site assessment: ${error.message}`);
    }
  }

  /**
   * Find relevant policies for an application using semantic search
   */
  async findRelevantPolicies(applicationData, planId) {
    const applicationText = this.extractApplicationText(applicationData);
    
    if (this.localPlanConfig.enableSemanticSearch) {
      // Use semantic search with embeddings
      const queryEmbedding = await this.embedder.embed(applicationText);
      const policies = await this.database.localPlanPolicies
        .where('planId')
        .equals(planId)
        .toArray();

      const relevantPolicies = [];
      
      for (const policy of policies) {
        if (this.policyEmbeddings.has(policy.id)) {
          const policyEmbedding = this.policyEmbeddings.get(policy.id);
          const similarity = this.calculateCosineSimilarity(queryEmbedding, policyEmbedding);
          
          if (similarity > this.localPlanConfig.complianceThreshold) {
            relevantPolicies.push({
              ...policy,
              relevanceScore: similarity
            });
          }
        }
      }

      return relevantPolicies.sort((a, b) => b.relevanceScore - a.relevanceScore);
    } else {
      // Fallback to keyword-based matching
      return this.findRelevantPoliciesKeyword(applicationText, planId);
    }
  }

  /**
   * Generate implementation guidance using AI
   */
  async generateImplementationGuidance(policyText, requirements, classification) {
    if (!this.model) {
      return this.generateImplementationGuidanceFallback(requirements);
    }

    const prompt = `
Generate practical implementation guidance for this planning policy:

Policy Classification: ${JSON.stringify(classification, null, 2)}
Policy Requirements: ${JSON.stringify(requirements, null, 2)}

Policy Text: ${policyText.substring(0, 1500)}...

Provide guidance on:
1. How planners should apply this policy
2. What evidence applicants should provide
3. Common interpretation issues to watch for
4. Suggested conditions or requirements
5. Integration with other policies
6. Key decision-making criteria

Return structured JSON:
{
  "applicationGuidance": [...],
  "evidenceRequirements": [...],
  "commonIssues": [...],
  "suggestedConditions": [...],
  "policyIntegration": [...],
  "decisionCriteria": [...]
}`;

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();
      
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return this.generateImplementationGuidanceFallback(requirements);
    } catch (error) {
      console.warn('AI guidance generation failed, using fallback:', error);
      return this.generateImplementationGuidanceFallback(requirements);
    }
  }

  // Fallback methods for when AI is not available

  extractBasicStructure(text) {
    return {
      hierarchy: [],
      policyReferences: this.extractPolicyReferences(text),
      objectives: this.extractObjectives(text),
      requirements: this.extractBasicRequirements(text),
      relatedPolicies: [],
      geographicScope: 'unknown',
      timeframe: 'unknown'
    };
  }

  classifyPolicyFallback(text) {
    const categories = ['housing', 'transport', 'environment', 'heritage', 'economy'];
    const category = categories.find(cat => 
      text.toLowerCase().includes(cat)) || 'general';

    return {
      category,
      type: 'unknown',
      geographicLevel: 'unknown',
      enforcementLevel: 'unknown',
      complexityScore: 3,
      themes: [],
      topics: [],
      confidence: 0.5
    };
  }

  extractRequirementsFallback(text) {
    return {
      mandatory: this.extractMandatoryRequirements(text),
      advisory: this.extractAdvisoryRequirements(text),
      quantitative: {},
      qualitative: [],
      assessmentCriteria: [],
      evidenceRequirements: [],
      consultationRequirements: []
    };
  }

  generateImplementationGuidanceFallback(requirements) {
    return {
      applicationGuidance: ['Review requirements against application details'],
      evidenceRequirements: ['Provide supporting documentation'],
      commonIssues: ['Incomplete information'],
      suggestedConditions: ['Standard planning conditions may apply'],
      policyIntegration: ['Consider relationship with other policies'],
      decisionCriteria: ['Assess against policy requirements']
    };
  }

  // Utility methods

  calculateAnalysisConfidence(analysis) {
    let confidence = 0.5; // Base confidence
    
    if (analysis.structure?.objectives?.length > 0) confidence += 0.1;
    if (analysis.requirements?.mandatory?.length > 0) confidence += 0.1;
    if (analysis.classification?.confidence) confidence += analysis.classification.confidence * 0.3;
    if (analysis.crossReferences?.length > 0) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  determineComplianceStatus(score) {
    if (score >= 0.8) return 'compliant';
    if (score >= 0.6) return 'partially_compliant';
    if (score >= 0.4) return 'non_compliant_minor';
    return 'non_compliant_major';
  }

  calculateScenarioConfidence(baseResults, aiAnalysis) {
    return Math.min(
      (baseResults.confidence || 0.7) + (aiAnalysis.confidence || 0.6),
      1.0
    );
  }

  calculateOverallSuitability(baseAssessment, aiAnalysis) {
    const baseScore = baseAssessment.overallScore || 0.5;
    const aiScore = aiAnalysis.suitabilityScore || 0.5;
    return (baseScore + aiScore) / 2;
  }

  calculateSiteAssessmentConfidence(baseAssessment, aiAnalysis) {
    return Math.min(
      (baseAssessment.confidence || 0.7) + (aiAnalysis.confidence || 0.6),
      1.0
    );
  }

  extractApplicationText(applicationData) {
    return [
      applicationData.description,
      applicationData.proposal,
      applicationData.address,
      applicationData.type
    ].filter(Boolean).join(' ');
  }

  calculateCosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  generateAssessmentId() {
    return 'lpa_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  addTimelineEvent(assessment, eventType, description) {
    assessment.timeline.push({
      timestamp: new Date().toISOString(),
      eventType,
      description
    });
  }
}
