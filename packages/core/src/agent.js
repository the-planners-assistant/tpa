import { GoogleGenerativeAI } from '@google/generative-ai';
import Embedder from '@tpa/nlp/src/index.js';
import Reranker from '@tpa/nlp/src/reranker.js';
import Parser from '@tpa/ingest/src/index.js';
import { getDatabase } from './database.js';
import SpatialAnalyzer from './spatial-analyzer.js';
import MaterialConsiderations from './material-considerations.js';
import EvidenceEngine from './evidence-engine.js';
import AddressExtractor from './address-extractor.js';
import PlanningDataAPI from './planning-data-api.js';
import PlanItAPI from './planit-api.js';
import LocalAuthorityManager from './local-authority-manager.js';
import ImageRetriever from './image-retriever.js';
// Phase modules
import { processDocumentsPhase } from './agent/phases/documentProcessing.js';
import { resolveAddressPhase } from './agent/phases/addressResolution.js';
import { spatialAnalysisPhase } from './agent/phases/spatialAnalysis.js';
import { aiAnalysisPhase } from './agent/phases/aiAnalysis.js';
import { materialConsiderationsPhase } from './agent/phases/materialConsiderations.js';
import { evidenceCompilationPhase } from './agent/phases/evidenceCompilation.js';
import { decisionSynthesisPhase } from './agent/phases/decisionSynthesis.js';
import { reportGenerationPhase } from './agent/phases/reportGeneration.js';

/**
 * Enhanced Agent Orchestrator
 * Main coordination system for TPA multimodal planning assessment
 * Integrates all components: spatial analysis, document processing, AI analysis,
 * material considerations, evidence tracking, and decision support
 */
class Agent {
  constructor(config = {}) {
    // Configuration
    this.config = {
      googleApiKey: config.googleApiKey || config.apiKey,
      geminiModel: config.geminiModel || 'gemini-2.0-flash-exp',
      confidenceThreshold: config.confidenceThreshold || 0.7,
      enableVision: config.enableVision !== false,
      enableAdvancedReasoning: config.enableAdvancedReasoning !== false,
      maxRetries: config.maxRetries || 3,
      ...config
    };

    // Initialize AI client
    if (this.config.googleApiKey) {
      this.genAI = new GoogleGenerativeAI(this.config.googleApiKey);
      this.model = this.genAI.getGenerativeModel({ 
        model: this.config.geminiModel,
        generationConfig: {
          temperature: 0.1,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        }
      });
      this.visionModel = this.genAI.getGenerativeModel({ 
        model: this.config.geminiModel,
        generationConfig: {
          temperature: 0.1,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      });
    } else {
      this.genAI = null;
      this.model = null;
      this.visionModel = null;
    }
    
    // Initialize components
    this.embedder = new Embedder();
    this.reranker = new Reranker();
    this.parser = new Parser();
    this.database = getDatabase();
    this.spatialAnalyzer = new SpatialAnalyzer();
    this.materialConsiderations = new MaterialConsiderations(this.database);
    this.evidenceEngine = new EvidenceEngine(this.database, this.spatialAnalyzer);
    this.addressExtractor = new AddressExtractor();
    this.planningDataAPI = new PlanningDataAPI();
  this.planItAPI = new PlanItAPI();
  this.localAuthorities = new LocalAuthorityManager(this.database, this.planItAPI);
  this.imageRetriever = new ImageRetriever();
    
    // Configure components with API keys
    if (this.config.googleApiKey) {
      // Correct method name on SpatialAnalyzer
      if (typeof this.spatialAnalyzer.setGoogleMapsApiKey === 'function') {
        this.spatialAnalyzer.setGoogleMapsApiKey(this.config.googleApiKey);
      }
      this.addressExtractor.setGoogleApiKey(this.config.googleApiKey);
      // Provide raw API key to parser for optional per-image analysis
      if (typeof this.parser.setGeminiApiKey === 'function') {
        this.parser.setGeminiApiKey(this.config.googleApiKey);
      }
    }
    
    // Orchestration state
    this.activeAssessments = new Map();
    this.taskQueue = [];
    this.analysisCache = new Map();
    this.contextWindow = new Map();
    this.assessmentHistory = [];
    this.confidenceThreshold = this.config.confidenceThreshold;
    
    this.initialized = false;
    
    // Skip database initialization for testing environments
    if (this.config.skipDatabaseInit) {
      this.initialized = true;
      this.initPromise = Promise.resolve();
    } else {
      this.initPromise = this.initialize();
    }
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      await this.database.initialize();
      await this.materialConsiderations.initialize();
  await this.localAuthorities.seedAuthorities();
      if (this.planningDataAPI && typeof this.planningDataAPI.initialize === 'function') {
        await this.planningDataAPI.initialize();
      }
  // PlanIt API has no explicit initialize; lazy warm optional
      
      this.initialized = true;
      console.log('TPA Agent initialized successfully');
    } catch (error) {
      console.error('Failed to initialize TPA Agent:', error);
      throw error;
    }
  }

  /** Search planning applications via PlanIt API with local cache fallback */
  async searchPlanItApplications(query, options = {}) {
    await this.initPromise;
    if (!query || query.trim().length < 2) return { query, results: [] };
    try {
      const data = await this.planItAPI.searchApplications(query.trim(), options);
      const list = data?.results || data || [];
      if (this.database?.upsertPlanItApplications) {
        await this.database.upsertPlanItApplications(list);
      }
      return { query, results: list, cached: false };
    } catch (error) {
      console.warn('PlanIt search failed, cache fallback:', error.message);
      const cached = await this.database.searchCachedApplications(query, options.limit || 20);
      return { query, results: cached, cached: true, error: error.message };
    }
  }

  // Local authority helpers
  async syncLocalAuthority(name){
    await this.initPromise;
    return this.localAuthorities.syncAuthority(name);
  }
  async fetchLocalPlanPolicies(authority){
    await this.initPromise;
    return this.localAuthorities.fetchLocalPlanPolicies(authority);
  }

  generateConditionsSection(assessment) {
    const recommendation = assessment.recommendation;
    const material = assessment.results.material;

    const conditions = [];
    
    // Add conditions from recommendation
    if (recommendation?.conditions) {
      conditions.push(...recommendation.conditions);
    }

    // Add conditions from material considerations
    if (material?.materialConsiderations) {
      for (const consideration of Object.values(material.materialConsiderations)) {
        for (const subConsideration of consideration.considerations || []) {
          if (subConsideration.conditions) {
            conditions.push(...subConsideration.conditions);
          }
        }
      }
    }

    return { conditions: [...new Set(conditions)] }; // Remove duplicates
  }

  generateEvidenceSection(assessment) {
    const evidence = assessment.results.evidence;
    
    return {
      summary: {
        totalItems: evidence?.citations?.size || 0,
        spatial: evidence?.spatial?.length || 0,
        textual: evidence?.textual?.length || 0,
        visual: evidence?.visual?.length || 0,
        policy: evidence?.policy?.length || 0,
        computed: evidence?.computed?.length || 0
      },
      citations: evidence?.citations ? Array.from(evidence.citations.entries()) : [],
      crossValidation: 'Evidence cross-validation completed'
    };
  }

  generateAppendicesSection(assessment) {
    return {
      timeline: assessment.timeline || [],
      processingDetails: assessment.results.documents?.processed || [],
      spatialAnalysisDetails: assessment.results.spatial || {},
      aiAnalysisDetails: assessment.results.ai || {}
    };
  }

  assessConstraintSeverity(constraintType, intersection) {
    const severityMap = {
      'listedBuildings': 'high',
      'conservationAreas': 'high',
      'floodZones': 'high',
      'scheduledMonuments': 'high',
      'greenBelt': 'high',
      'treePreservationOrders': 'medium',
      'localWildlifeSites': 'medium',
      'airQualityManagementAreas': 'medium',
      'noiseContours': 'low'
    };
    
    return severityMap[constraintType] || 'medium';
  }

  // Assessment monitoring and management
  getActiveAssessments() {
    return Array.from(this.activeAssessments.values());
  }

  getAssessmentStatus(assessmentId) {
    return this.activeAssessments.get(assessmentId);
  }

  async cancelAssessment(assessmentId) {
    const assessment = this.activeAssessments.get(assessmentId);
    if (assessment) {
      assessment.status = 'cancelled';
      assessment.endTime = new Date();
      this.addTimelineEvent(assessment, 'cancelled', 'Assessment cancelled by user');
      this.activeAssessments.delete(assessmentId);
      return true;
    }
    return false;
  }

  /**
   * Main orchestration method - comprehensive planning assessment
   */
  async assessPlanningApplication(documentFiles, options = {}) {
    await this.initPromise;
    
    const assessmentId = this.generateAssessmentId();
    
    try {
      // Initialize assessment tracking
      const assessment = {
        id: assessmentId,
        status: 'initializing',
        startTime: new Date(),
        documents: documentFiles,
        options: options,
        results: {},
        confidence: 0,
        recommendation: null,
        evidence: [],
        issues: [],
        timeline: []
      };

      this.activeAssessments.set(assessmentId, assessment);
      this.addTimelineEvent(assessment, 'assessment_started', 'Planning assessment initiated');

      // Phase 1: Document Processing and Information Extraction
      assessment.status = 'processing_documents';
      this.addTimelineEvent(assessment, 'phase_1_start', 'Starting document processing');
      
  const documentResults = await processDocumentsPhase(this, documentFiles, assessment);
      assessment.results.documents = documentResults;
      
      // Phase 2: Address Resolution and Site Identification
      assessment.status = 'resolving_address';
      this.addTimelineEvent(assessment, 'phase_2_start', 'Resolving site address and location');
      
  const addressResults = await resolveAddressPhase(this, documentResults, assessment);
      assessment.results.address = addressResults;

      if (!addressResults.primaryAddress || !addressResults.primaryAddress.coordinates) {
        throw new Error('Could not resolve site address and coordinates');
      }

      // Phase 3: Spatial Analysis and Constraint Assessment
      assessment.status = 'spatial_analysis';
      this.addTimelineEvent(assessment, 'phase_3_start', 'Conducting spatial analysis');
      
      const spatialResults = await spatialAnalysisPhase(this, addressResults.primaryAddress.coordinates, assessment);
      assessment.results.spatial = spatialResults;
      // Imagery fallback phase (if no images extracted earlier)
      if (!assessment.results.media) assessment.results.media = {};
      if (!assessment.results.media.imagesFromPdf || assessment.results.media.imagesFromPdf.length === 0) {
        const retrieved = await this.imageRetriever.retrieve(addressResults.primaryAddress.coordinates);
        assessment.results.media.retrievedImages = retrieved.images;
        assessment.results.media.allImages = retrieved.images;
        this.addTimelineEvent(assessment, 'imagery_retrieved', `Retrieved ${retrieved.retrievedCount} supplementary images`);
      }

      // Phase 4: AI-Powered Multimodal Analysis
      assessment.status = 'ai_analysis';
      this.addTimelineEvent(assessment, 'phase_4_start', 'Performing AI analysis');
      
  const aiResults = await aiAnalysisPhase(this, documentResults, spatialResults, assessment);
      assessment.results.ai = aiResults;

      // Phase 5: Material Considerations Assessment
      assessment.status = 'material_considerations';
      this.addTimelineEvent(assessment, 'phase_5_start', 'Assessing material considerations');
      
  const materialResults = await materialConsiderationsPhase(this, documentResults, spatialResults, aiResults, assessment);
      assessment.results.material = materialResults;

      // Phase 6: Evidence Compilation and Validation
      assessment.status = 'evidence_compilation';
      this.addTimelineEvent(assessment, 'phase_6_start', 'Compiling and validating evidence');
      
  const evidenceResults = await evidenceCompilationPhase(this, documentResults, spatialResults, aiResults, materialResults, assessmentId, assessment);
      assessment.results.evidence = evidenceResults;

      // Phase 7: Decision Synthesis and Recommendation
      assessment.status = 'decision_synthesis';
      this.addTimelineEvent(assessment, 'phase_7_start', 'Synthesizing decision recommendation');
      
  const recommendation = await decisionSynthesisPhase(this, assessment, assessmentId);
      assessment.recommendation = recommendation;
      assessment.confidence = recommendation.confidence;

      // Phase 8: Report Generation
      assessment.status = 'report_generation';
      this.addTimelineEvent(assessment, 'phase_8_start', 'Generating comprehensive report');
      
  const report = await reportGenerationPhase(this, assessment, assessmentId);
      assessment.results.report = report;

      // Finalization
      assessment.status = 'completed';
      assessment.endTime = new Date();
      assessment.duration = assessment.endTime - assessment.startTime;
      this.addTimelineEvent(assessment, 'assessment_completed', `Assessment completed in ${this.formatDuration(assessment.duration)}`);

      // Store in database
      if (this.database) {
        await this.database.assessments.add(assessment);
      }

      return assessment;

    } catch (error) {
      const assessment = this.activeAssessments.get(assessmentId);
      if (assessment) {
        assessment.status = 'error';
        assessment.error = error.message;
        assessment.endTime = new Date();
        this.addTimelineEvent(assessment, 'error', `Assessment failed: ${error.message}`);
      }
      
      console.error('Assessment failed:', error);
      throw error;
    } finally {
      this.activeAssessments.delete(assessmentId);
    }
  }
  // Analysis helper methods used by AI phase modules
  async analyzeTextContent(chunks) {
    const combinedText = chunks.map(chunk => chunk.content).join('\n\n');
    const prompt = `\nAnalyze the following planning application text content and extract key information:\n\n${combinedText.substring(0, 4000)} ${combinedText.length > 4000 ? '...[truncated]' : ''}\n\nPlease provide a structured analysis covering:\n1. Development description and key characteristics\n2. Planning considerations mentioned\n3. Technical specifications (heights, areas, units, parking, etc.)\n4. Environmental considerations\n5. Access and transport arrangements\n6. Any heritage or conservation mentions\n7. Community benefits or impacts mentioned\n8. Identified risks or concerns\n\nProvide your response in a structured JSON format.\n`;
    try {
      const result = await this.visionModel.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      try { return JSON.parse(text); } catch { return { analysis: text, format: 'text' }; }
    } catch (error) { console.error('Text analysis failed:', error); return { error: error.message }; }
  }

  async analyzeImages(images) {
    const results = [];
    for (let i = 0; i < Math.min(images.length, 10); i++) {
      const image = images[i];
      try {
        const prompt = `\nAnalyze this planning-related image and provide detailed information about:\n1. Image type (site photo, architectural drawing, plan, elevation, etc.)\n2. Key visible features and characteristics\n3. Planning considerations evident in the image\n4. Scale, dimensions, or measurements visible\n5. Relationship to surrounding context\n6. Any heritage, environmental, or design considerations\n7. Quality and condition of existing structures\n8. Access arrangements and transport features\n9. Landscape and boundary treatments\n10. Any potential planning issues or benefits\n`;
        const imagePart = { inlineData: { data: image.data, mimeType: image.mimeType } };
        const result = await this.visionModel.generateContent([prompt, imagePart]);
        const response = await result.response;
        results.push({ imageIndex: i, type: image.type || 'unknown', analysis: response.text(), confidence: 0.8 });
      } catch (error) { console.error(`Image analysis failed for image ${i}:`, error); results.push({ imageIndex: i, error: error.message, confidence: 0 }); }
    }
    return results;
  }

  async performContextualAnalysis(documentResults, spatialResults) {
    const prompt = `Perform a comprehensive contextual analysis for this planning application:\n\nSPATIAL CONTEXT:\n${JSON.stringify(spatialResults, null, 2)}\n\nDOCUMENT EXTRACTED DATA:\n${JSON.stringify(documentResults.extractedData, null, 2)}\n\nProvide a structured contextual analysis.`;
    try { const result = await this.visionModel.generateContent(prompt); const response = await result.response; return { analysis: response.text(), confidence: 0.75 }; } catch (error) { console.error('Contextual analysis failed:', error); return { error: error.message, confidence: 0 }; }
  }

  async performPlanningAssessment(documentResults, spatialResults, aiResults) {
    const prompt = `DEVELOPMENT PROPOSAL:\n${JSON.stringify(documentResults.extractedData, null, 2)}\n\nSPATIAL ANALYSIS:\n${JSON.stringify(spatialResults, null, 2)}\n\nAI ANALYSIS RESULTS:\nText Analysis: ${JSON.stringify(aiResults.textAnalysis, null, 2)}\nContextual Analysis: ${aiResults.contextualAnalysis?.analysis || 'Not available'}\n\nProvide a structured professional planning assessment.`;
    try { const result = await this.visionModel.generateContent(prompt); const response = await result.response; return { assessment: response.text(), confidence: 0.7 }; } catch (error) { console.error('Planning assessment failed:', error); return { error: error.message, confidence: 0 }; }
  }

  // Legacy run method for backwards compatibility
  async run(query) {
    await this.initPromise;
    
    // Simple query processing for backwards compatibility
    const searchResults = await this.searchVectorStore(query);

    // Use Gemini API to generate a response or fallback to local model
    if (this.model) {
      const prompt = `Based on the following information, answer the query: "${query}"\n\nInformation:\n${searchResults.join('\n')}`;
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } else {
      return `This is a locally generated response to the query: "${query}".\n\nI found the following relevant information:\n${searchResults.join('\n')}`;
    }
  }

  // Legacy search methods for backwards compatibility
  async searchVectorStore(query) {
    if (!this.vectorStore || this.vectorStore.length === 0) {
      return [];
    }

    const queryEmbedding = await this.embedder.embed(query);

    const results = this.vectorStore.map(item => {
      const similarity = this.cosineSimilarity(queryEmbedding, item.embedding);
      return { ...item, similarity };
    });

    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, 5).map(item => item.text);
  }

  cosineSimilarity(vecA, vecB) {
    let dotProduct = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async loadPdf(file) {
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataBuffer = event.target.result;
  const parseResult = await this.parser.parse(dataBuffer);
      
      if (parseResult.chunks) {
        for (const chunk of parseResult.chunks) {
          const embedding = await this.embedder.embed(chunk.content);
          if (!this.vectorStore) this.vectorStore = [];
          this.vectorStore.push({ text: chunk.content, embedding });
        }
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // Utility methods
  generateAssessmentId() {
    return 'TPA_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  addTimelineEvent(assessment, type, description) {
    if (assessment && assessment.timeline) {
      assessment.timeline.push({
        timestamp: new Date(),
        type: type,
        description: description
      });
    }
  }

  formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  }

  mergeExtractedData(existing, newData) {
    const merged = { ...existing };
    
    for (const [key, value] of Object.entries(newData)) {
      if (merged[key] === undefined) {
        merged[key] = value;
      } else if (Array.isArray(merged[key]) && Array.isArray(value)) {
        merged[key] = [...merged[key], ...value];
      } else if (typeof merged[key] === 'number' && typeof value === 'number') {
        merged[key] = Math.max(merged[key], value); // Take max for numeric values
      }
    }
    
    return merged;
  }

  calculateAIConfidence(results) {
    const scores = [];
    
    if (results.textAnalysis && !results.textAnalysis.error) scores.push(0.8);
    if (results.imageAnalysis && results.imageAnalysis.length > 0) {
      const avgImageConfidence = results.imageAnalysis
        .filter(img => !img.error)
        .reduce((sum, img) => sum + (img.confidence || 0.5), 0) / results.imageAnalysis.length;
      scores.push(avgImageConfidence);
    }
    if (results.contextualAnalysis && !results.contextualAnalysis.error) {
      scores.push(results.contextualAnalysis.confidence || 0.7);
    }
    if (results.planningAssessment && !results.planningAssessment.error) {
      scores.push(results.planningAssessment.confidence || 0.7);
    }

    return scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
  }

  calculateEvidenceConfidence(evidenceResults) {
    if (!evidenceResults || !evidenceResults.citations) {
      return 0.3;
    }

    const totalItems = evidenceResults.citations.size;
    if (totalItems === 0) return 0.3;

    // Simple heuristic: more evidence = higher confidence
    if (totalItems >= 20) return 0.9;
    if (totalItems >= 10) return 0.8;
    if (totalItems >= 5) return 0.7;
    return 0.6;
  }

  identifyRiskFactors(assessment) {
    const risks = [];
    const spatial = assessment.results.spatial;

    // Heritage risks
    if (spatial?.intersections?.conservationAreas?.length > 0) {
      risks.push({
        type: 'heritage',
        level: 'high',
        description: 'Site within Conservation Area - significant heritage considerations'
      });
    }

    if (spatial?.intersections?.listedBuildings?.length > 0) {
      risks.push({
        type: 'heritage',
        level: 'high',
        description: 'Listed buildings affected - statutory consultation required'
      });
    }

    // Environmental risks
    if (spatial?.intersections?.floodZones?.length > 0) {
      risks.push({
        type: 'environment',
        level: 'medium',
        description: 'Flood risk considerations - drainage assessment required'
      });
    }

    // Low confidence risks
    if (assessment.recommendation?.confidence < 0.6) {
      risks.push({
        type: 'procedural',
        level: 'medium',
        description: 'Low confidence recommendation - additional information required'
      });
    }

    return risks;
  }

  extractKeyConsiderations(assessment) {
    const considerations = [];
    const material = assessment.results.material;

    if (material?.materialConsiderations) {
      for (const [category, consideration] of Object.entries(material.materialConsiderations)) {
        if (consideration.keyIssues && consideration.keyIssues.length > 0) {
          considerations.push(...consideration.keyIssues.map(issue => ({
            category: category,
            issue: issue.consideration,
            severity: issue.severity
          })));
        }
      }
    }

    return considerations;
  }

  suggestConditions(assessment) {
    const conditions = [];
    const material = assessment.results.material;

    if (material?.materialConsiderations) {
      for (const consideration of Object.values(material.materialConsiderations)) {
        if (consideration.recommendedConditions) {
          conditions.push(...consideration.recommendedConditions);
        }
      }
    }

    return [...new Set(conditions)]; // Remove duplicates
  }

  identifyInformationRequirements(assessment) {
    const requirements = [];
    
    // Check for missing evidence
    const evidence = assessment.results.evidence;
    if (!evidence || evidence.citations?.size < 5) {
      requirements.push('Additional supporting documents required');
    }

    // Check AI analysis completeness
    const ai = assessment.results.ai;
    if (!ai || ai.confidence < 0.6) {
      requirements.push('Clarification of proposal details required');
    }

    return requirements;
  }

  assessAppealRisk(assessment) {
    const recommendation = assessment.recommendation;
    const confidence = recommendation?.confidence || 0.5;

    if (recommendation?.decision === 'refuse' && confidence < 0.7) {
      return 'medium';
    } else if (recommendation?.decision === 'refuse' && confidence >= 0.8) {
      return 'low';
    } else {
      return 'low';
    }
  }

  // Report generation helper methods
  generateExecutiveSummary(assessment) {
    const recommendation = assessment.recommendation;
    const spatial = assessment.results.spatial;
    const documents = assessment.results.documents;

    return {
      applicationSite: spatial?.address || 'Address not resolved',
      proposalSummary: documents?.extractedData?.description || 'Description not extracted',
      recommendation: recommendation?.decision || 'No recommendation',
      confidence: recommendation?.confidence || 0,
      keyIssues: recommendation?.keyConsiderations || [],
      decision: recommendation?.decision,
      reasoning: recommendation?.reasoning
    };
  }

  generateSiteAnalysisSection(assessment) {
    const spatial = assessment.results.spatial;
    const address = assessment.results.address;

    return {
      location: {
        address: address?.primaryAddress?.formattedAddress,
        coordinates: address?.primaryAddress?.coordinates,
        accuracy: address?.primaryAddress?.accuracy
      },
      siteCharacteristics: spatial?.siteMetrics || {},
      accessibility: spatial?.accessibilityAnalysis || {},
      constraints: spatial?.intersections || {},
      proximities: spatial?.proximities || {},
      context: spatial?.contextualFactors || {}
    };
  }

  generateProposalAnalysisSection(assessment) {
    const documents = assessment.results.documents;
    const ai = assessment.results.ai;

    return {
      extractedData: documents?.extractedData || {},
      documentSummary: documents?.processed || [],
      aiAnalysis: ai?.textAnalysis || null,
      imageAnalysis: ai?.imageAnalysis || [],
      contextualAssessment: ai?.contextualAnalysis || null
    };
  }

  generateConstraintsSection(assessment) {
    const spatial = assessment.results.spatial;
    const intersections = spatial?.intersections || {};

    const constraints = {};
    for (const [type, items] of Object.entries(intersections)) {
      constraints[type] = {
        present: items.length > 0,
        count: items.length,
        details: items.map(item => ({
          name: item.name,
          coverage: item.coveragePercent,
          area: item.area,
          severity: this.assessConstraintSeverity(type, item)
        }))
      };
    }

    return constraints;
  }

  generateMaterialConsiderationsSection(assessment) {
    return assessment.results.material || {};
  }

  generatePlanningBalanceSection(assessment) {
    const material = assessment.results.material;
    const exercise = material?.balancingExercise || {};
    // Normalize considerations into qualitative categories expected by UI (if present)
    const qualitative = [];
    if (exercise?.significantBenefits) {
      for (const b of exercise.significantBenefits) {
        qualitative.push({
          name: b.name || b.title || b.type || 'Benefit',
          direction: 'positive',
            // Map a rough numeric score if provided else derive from weighting phrase heuristics
          score: typeof b.score === 'number' ? b.score : (
            /very substantial|considerable/i.test(b.weighting||'') ? 0.8 :
            /moderate/i.test(b.weighting||'') ? 0.5 :
            /limited|some/i.test(b.weighting||'') ? 0.15 : 0.3
          ),
          phrase: b.weighting || b.phrase || null,
          details: b.reason || b.details || b.description || ''
        });
      }
    }
    if (exercise?.significantHarms) {
      for (const h of exercise.significantHarms) {
        qualitative.push({
          name: h.name || h.title || h.type || 'Harm',
          direction: 'negative',
          score: typeof h.score === 'number' ? h.score : -(
            /substantial/i.test(h.weighting||'') ? 0.85 :
            /significant|considerable/i.test(h.weighting||'') ? 0.5 :
            /limited|some/i.test(h.weighting||'') ? 0.15 : 0.3
          ),
          phrase: h.weighting || h.phrase || null,
          details: h.reason || h.details || h.description || ''
        });
      }
    }
    return {
      balancingExercise: exercise,
      benefits: exercise.significantBenefits || [],
      harms: exercise.significantHarms || [],
      overallBalance: exercise.overallBalance || 'unknown',
      qualitative // UI binds to this if available
    };
  }

  generateRecommendationSection(assessment) {
    return assessment.recommendation || {};
  }

  generateConditionsSection(assessment) {
    const recommendation = assessment.recommendation;
    const material = assessment.results.material;

    const conditions = [];
    
    // Add conditions from recommendation
    if (recommendation?.conditions) {
      conditions.push(...recommendation.conditions);
    }

    // Add conditions from material considerations
    if (material?.materialConsiderations) {
      for (const consideration of Object.values(material.materialConsiderations)) {
        for (const subConsideration of consideration.considerations || []) {
          if (subConsideration.conditions) {
            conditions.push(...subConsideration.conditions);
          }
        }
      }
    }

    return { conditions: [...new Set(conditions)] }; // Remove duplicates
  }

  generateEvidenceSection(assessment) {
    const evidence = assessment.results.evidence;
    
    return {
      summary: {
        totalItems: evidence?.citations?.size || 0,
        spatial: evidence?.spatial?.length || 0,
        textual: evidence?.textual?.length || 0,
        visual: evidence?.visual?.length || 0,
        policy: evidence?.policy?.length || 0,
        computed: evidence?.computed?.length || 0
      },
      citations: evidence?.citations ? Array.from(evidence.citations.entries()) : [],
      crossValidation: 'Evidence cross-validation completed'
    };
  }

  generateAppendicesSection(assessment) {
    return {
      timeline: assessment.timeline || [],
      processingDetails: assessment.results.documents?.processed || [],
      spatialAnalysisDetails: assessment.results.spatial || {},
      aiAnalysisDetails: assessment.results.ai || {}
    };
  }

  assessConstraintSeverity(constraintType, intersection) {
    const severityMap = {
      'listedBuildings': 'high',
      'conservationAreas': 'high',
      'floodZones': 'high',
      'scheduledMonuments': 'high',
      'greenBelt': 'high',
      'treePreservationOrders': 'medium',
      'localWildlifeSites': 'medium',
      'airQualityManagementAreas': 'medium',
      'noiseContours': 'low'
    };
    
    return severityMap[constraintType] || 'medium';
  }

  // Assessment monitoring and management
  getActiveAssessments() {
    return Array.from(this.activeAssessments.values());
  }

  getAssessmentStatus(assessmentId) {
    return this.activeAssessments.get(assessmentId);
  }

  async cancelAssessment(assessmentId) {
    const assessment = this.activeAssessments.get(assessmentId);
    if (assessment) {
      assessment.status = 'cancelled';
      assessment.endTime = new Date();
      this.addTimelineEvent(assessment, 'cancelled', 'Assessment cancelled by user');
      this.activeAssessments.delete(assessmentId);
      return true;
    }
    return false;
  }
}

export default Agent;
