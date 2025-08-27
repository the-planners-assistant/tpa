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
import LocalPlanManager from './local-plan-manager.js';
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
      geminiModel: config.geminiModel || 'gemini-2.5-flash',
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
      // Pro model for grounding / reasoning bursts (optional)
      try {
        this.proModel = this.genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
      } catch { this.proModel = null; }
    } else {
      this.genAI = null;
      this.model = null;
      this.visionModel = null;
      this.proModel = null;
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
    this.localPlanManager = new LocalPlanManager(this.database);
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
  // Vector stores (separate by role plus aggregate for backwards compatibility)
  this.vectorStore = []; // aggregate legacy store (all)
  this.vectorStoreApplication = [];
  this.vectorStorePolicy = [];
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
      // Support structured document roles: { application: [...], policy: [...] }
      const isStructured = !Array.isArray(documentFiles) && typeof documentFiles === 'object';
      const assessment = {
        id: assessmentId,
        status: 'initializing',
        startTime: new Date(),
        documents: documentFiles,
        applicationDocuments: isStructured ? (documentFiles.application || []) : (Array.isArray(documentFiles) ? documentFiles : []),
        policyDocuments: isStructured ? (documentFiles.policy || []) : [],
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
      
      // Inject manual coordinates (pre-phase) if provided so downstream address phase can adopt them
      let manualCoords = null;
      if (options.manualCoordinates && Array.isArray(options.manualCoordinates) && options.manualCoordinates.length === 2) {
        manualCoords = options.manualCoordinates;
      } else if (options.latitude && options.longitude) {
        manualCoords = [options.longitude, options.latitude];
      }

      // Phase 2: Address Resolution and Site Identification
      assessment.status = 'resolving_address';
      this.addTimelineEvent(assessment, 'phase_2_start', 'Resolving site address and location');
      
      const addressResults = await resolveAddressPhase(this, documentResults, assessment);
      assessment.results.address = addressResults;

      // Enhanced fallback handling for coordinates
      let finalCoordinates = null;
      let coordinateSource = 'none';
      
      // Priority 1: Use resolved address coordinates
      if (addressResults.primaryAddress?.coordinates) {
        finalCoordinates = addressResults.primaryAddress.coordinates;
        coordinateSource = addressResults.resolutionStrategy || 'standard';
        this.addTimelineEvent(assessment, 'coordinates_resolved', 
          `Coordinates obtained from ${coordinateSource} resolution: [${finalCoordinates[1]}, ${finalCoordinates[0]}]`);
      }
      
      // Priority 2: Use manual coordinates if provided and no address coordinates
      if (!finalCoordinates && manualCoords) {
        finalCoordinates = manualCoords;
        coordinateSource = 'manual';
        
        // Create a basic address object for manual coordinates
        if (!addressResults.primaryAddress) {
          addressResults.primaryAddress = {
            rawText: 'Manual coordinates',
            cleaned: `Manual coordinates: ${manualCoords[1]}, ${manualCoords[0]}`,
            confidence: 0.4,
            fallbackMethod: 'manual'
          };
        }
        addressResults.primaryAddress.coordinates = finalCoordinates;
        this.addTimelineEvent(assessment, 'coordinates_manual', 'Using manually provided coordinates');
      }
      
      // Priority 3: Try to extract coordinates from text if available
      if (!finalCoordinates) {
        const extractedCoords = await this.extractCoordinatesFromText(documentResults.extractedData?.fullText);
        if (extractedCoords) {
          finalCoordinates = extractedCoords;
          coordinateSource = 'text_extraction';
          
          if (!addressResults.primaryAddress) {
            addressResults.primaryAddress = {
              rawText: 'Coordinates from document',
              cleaned: `Extracted coordinates: ${extractedCoords[1]}, ${extractedCoords[0]}`,
              confidence: 0.3,
              fallbackMethod: 'text_extraction'
            };
          }
          addressResults.primaryAddress.coordinates = finalCoordinates;
          this.addTimelineEvent(assessment, 'coordinates_extracted', 'Coordinates extracted from document text');
        }
      }
      
      // Enhanced error handling with detailed diagnostics
      if (!finalCoordinates) {
        const errorDetails = {
          addressResolutionStrategy: addressResults.resolutionStrategy || 'unknown',
          addressesFound: addressResults.addresses?.length || 0,
          highestConfidence: addressResults.addresses?.[0]?.confidence || 0,
          manualCoordsProvided: !!manualCoords,
          googleApiConfigured: !!this.config.googleApiKey,
          documentTextLength: documentResults.extractedData?.fullText?.length || 0,
          diagnostics: addressResults.diagnostics || {}
        };
        
        this.addTimelineEvent(assessment, 'coordinate_resolution_failed', 
          `Failed to obtain coordinates. Diagnostics: ${JSON.stringify(errorDetails)}`);
        
        console.error('Coordinate Resolution Failed:', errorDetails);
        
        throw new Error(
          `Could not resolve site address and coordinates.\n` +
          `Resolution details:\n` +
          `- Address strategy: ${errorDetails.addressResolutionStrategy}\n` +
          `- Addresses found: ${errorDetails.addressesFound}\n` +
          `- Highest confidence: ${(errorDetails.highestConfidence * 100).toFixed(1)}%\n` +
          `- Google API configured: ${errorDetails.googleApiConfigured}\n` +
          `- Document text length: ${errorDetails.documentTextLength} chars\n` +
          `\nSolutions:\n` +
          `1. Provide manual coordinates: options.manualCoordinates = [longitude, latitude]\n` +
          `2. Ensure document contains clear UK address with postcode\n` +
          `3. Configure Google Geocoding API key if not already set\n` +
          `4. Check that uploaded document contains readable text`
        );
      }

      // Update address results with final coordinates and source info
      addressResults.finalCoordinates = finalCoordinates;
      addressResults.coordinateSource = coordinateSource;
      
      this.addTimelineEvent(assessment, 'address_resolution_complete', 
        `Address resolution completed using ${coordinateSource} strategy`);

      // Phase 3: Spatial Analysis and Constraint Assessment
      assessment.status = 'spatial_analysis';
      this.addTimelineEvent(assessment, 'phase_3_start', 'Conducting spatial analysis');
      
      const spatialResults = await spatialAnalysisPhase(this, finalCoordinates, assessment);
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

      // Store in database (clean object to avoid ArrayBuffer issues)
      if (this.database) {
        const cleanAssessment = this.sanitizeForStorage(assessment);
        await this.database.assessments.add(cleanAssessment);
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

  /**
   * Enhanced text analysis with additional context from retrieval
   */
  async analyzeTextContentWithContext(chunks, retrievedContext) {
    if (!chunks || chunks.length === 0) return null;
    
    const combinedText = chunks.map(c => c.content).join('\n\n').substring(0, 6000);
    const contextText = retrievedContext?.slice(0, 5).map(c => 
      `${c.source}: ${c.content || c.description || JSON.stringify(c).substring(0, 200)}`
    ).join('\n').substring(0, 2000);
    
    const prompt = `Analyze this planning application with additional context from related data sources.

MAIN DOCUMENT CONTENT:
${combinedText}

RELATED CONTEXT:
${contextText}

Provide a comprehensive analysis in JSON format including:
{
  "developmentDescription": "clear description of the proposed development",
  "keyCharacteristics": ["characteristic1", "characteristic2"],
  "technicalSpecs": {
    "height": "extracted height info",
    "units": "number of units if residential",
    "area": "floor area or site area",
    "parking": "parking provision"
  },
  "planningConsiderations": ["consideration1", "consideration2"],
  "environmentalFactors": ["factor1", "factor2"],
  "heritageImpacts": "any heritage or conservation impacts",
  "transportAccess": "transport and access arrangements",
  "communityBenefits": ["benefit1", "benefit2"],
  "identifiedRisks": ["risk1", "risk2"],
  "contextualInsights": "how the retrieved context informs this application",
  "confidence": 0.8
}`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          parsed.hasContext = true;
          parsed.contextSources = retrievedContext?.length || 0;
          return parsed;
        }
      } catch (parseError) {
        console.warn('JSON parsing failed, using text response');
      }
      
      return { 
        summary: text, 
        hasContext: true,
        contextSources: retrievedContext?.length || 0,
        analysis: 'enhanced_with_context' 
      };
    } catch (error) {
      console.error('Enhanced text analysis failed:', error);
      return { error: error.message, confidence: 0 };
    }
  }

  /**
   * Infer development type from document chunks
   */
  async inferDevelopmentType(chunks) {
    if (!chunks || chunks.length === 0) return null;
    
    const combinedText = chunks.map(c => c.content).join(' ').substring(0, 2000).toLowerCase();
    
    // Simple heuristic-based inference
    if (combinedText.includes('residential') || combinedText.includes('housing') || combinedText.includes('dwelling')) {
      return 'residential';
    } else if (combinedText.includes('commercial') || combinedText.includes('retail') || combinedText.includes('office')) {
      return 'commercial';
    } else if (combinedText.includes('industrial') || combinedText.includes('warehouse') || combinedText.includes('manufacturing')) {
      return 'industrial';
    } else if (combinedText.includes('mixed use') || combinedText.includes('mixed-use')) {
      return 'mixed-use';
    }
    
    return 'other';
  }

  /**
   * Enhanced contextual analysis
   */
  async performEnhancedContextualAnalysis(documentResults, spatialResults, retrievalResults) {
    if (!this.model) return null;

    const prompt = `Perform a comprehensive contextual analysis of this planning proposal.

DOCUMENT ANALYSIS:
${JSON.stringify(documentResults.extractedData || {}, null, 2)}

SPATIAL CONTEXT:
${JSON.stringify(spatialResults.siteMetrics || {}, null, 2)}
Constraints: ${JSON.stringify(Object.keys(spatialResults.intersections || {}), null, 2)}

RETRIEVED CONTEXT:
${retrievalResults?.combined?.slice(0, 5).map(r => `${r.source}: ${r.content || JSON.stringify(r).substring(0, 200)}`).join('\n')}

Provide a contextual analysis considering:
1. How this proposal fits within the local context
2. Relationship to planning policy framework
3. Precedent applications and their outcomes
4. Site-specific considerations and constraints
5. Strategic planning implications

Respond in JSON format with structured analysis.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { analysis: text, type: 'enhanced_contextual' };
      } catch (parseError) {
        return { analysis: text, type: 'enhanced_contextual', parseError: true };
      }
    } catch (error) {
      console.error('Enhanced contextual analysis failed:', error);
      return { error: error.message };
    }
  }

  /**
   * Generate evidence chains linking claims to supporting evidence
   */
  async generateEvidenceChains(textAnalysis, contextualAnalysis, retrievalResults) {
    const evidenceChains = [];
    
    if (!textAnalysis || !this.model) return evidenceChains;

    // Extract key claims from the analysis
    const keyClaims = [];
    if (textAnalysis.planningConsiderations) {
      keyClaims.push(...textAnalysis.planningConsiderations.map(c => ({ type: 'planning_consideration', claim: c })));
    }
    if (textAnalysis.environmentalFactors) {
      keyClaims.push(...textAnalysis.environmentalFactors.map(c => ({ type: 'environmental_factor', claim: c })));
    }
    if (textAnalysis.identifiedRisks) {
      keyClaims.push(...textAnalysis.identifiedRisks.map(c => ({ type: 'risk', claim: c })));
    }

    // For each claim, find supporting evidence
    for (const claimObj of keyClaims.slice(0, 10)) {
      const supportingEvidence = [];
      
      // Look for supporting evidence in retrieved context
      if (retrievalResults?.combined) {
        for (const item of retrievalResults.combined) {
          if (this.isEvidenceSupporting(claimObj.claim, item)) {
            supportingEvidence.push({
              source: item.source,
              content: item.content || item.description || '',
              relevance: item.relevanceScore || 0.5,
              type: 'retrieved_context'
            });
          }
        }
      }

      if (supportingEvidence.length > 0) {
        evidenceChains.push({
          claim: claimObj.claim,
          claimType: claimObj.type,
          evidence: supportingEvidence.slice(0, 3), // Top 3 pieces of evidence
          strength: this.calculateEvidenceStrength(supportingEvidence),
          chainId: `CHAIN_${evidenceChains.length + 1}`
        });
      }
    }

    return evidenceChains;
  }

  /**
   * Check if a piece of evidence supports a claim
   */
  isEvidenceSupporting(claim, evidence) {
    if (!claim || !evidence) return false;
    
    const claimWords = claim.toLowerCase().split(/\s+/);
    const evidenceText = (evidence.content || evidence.description || '').toLowerCase();
    
    // Simple keyword matching - could be enhanced with semantic similarity
    return claimWords.some(word => evidenceText.includes(word));
  }

  /**
   * Calculate the strength of an evidence chain
   */
  calculateEvidenceStrength(evidence) {
    if (!evidence || evidence.length === 0) return 0;
    
    const avgRelevance = evidence.reduce((sum, e) => sum + (e.relevance || 0.5), 0) / evidence.length;
    const sourceVariety = new Set(evidence.map(e => e.source)).size;
    const evidenceCount = Math.min(evidence.length, 5); // Cap at 5 for diminishing returns
    
    return Math.min(1.0, avgRelevance * 0.6 + (sourceVariety / 5) * 0.2 + (evidenceCount / 5) * 0.2);
  }

  /**
   * Comprehensive planning assessment with enhanced evidence
   */
  async performComprehensivePlanningAssessment(documentResults, spatialResults, aiResults) {
    if (!this.model) return null;

    const prompt = `Provide a comprehensive planning assessment for this development proposal.

PROPOSAL ANALYSIS:
${JSON.stringify(aiResults.textAnalysis, null, 2)}

SPATIAL CONTEXT:
Site area: ${spatialResults.siteMetrics?.area || 'unknown'}
Constraints: ${Object.keys(spatialResults.intersections || {}).join(', ')}

EVIDENCE CHAINS:
${aiResults.evidenceChains?.map(chain => 
  `${chain.claim} (Strength: ${chain.strength.toFixed(2)}) - ${chain.evidence.length} supporting items`
).join('\n')}

CONTEXTUAL ANALYSIS:
${JSON.stringify(aiResults.contextualAnalysis, null, 2)}

Provide a structured assessment including:
{
  "overallAssessment": "comprehensive summary",
  "keyPlanningIssues": ["issue1", "issue2"],
  "policyCompliance": {
    "compliant": ["policy area 1"],
    "nonCompliant": ["policy area 2"],
    "uncertain": ["policy area 3"]
  },
  "materialConsiderations": [
    {
      "factor": "factor name",
      "weight": "high/medium/low",
      "assessment": "detailed assessment",
      "evidenceStrength": 0.8
    }
  ],
  "recommendationFactors": {
    "positive": ["factor1", "factor2"],
    "negative": ["factor1", "factor2"],
    "neutral": ["factor1"]
  },
  "uncertainties": ["uncertainty1", "uncertainty2"],
  "additionalInvestigation": ["investigation1", "investigation2"],
  "confidence": 0.85
}`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { assessment: text, type: 'comprehensive' };
      } catch (parseError) {
        return { assessment: text, type: 'comprehensive', parseError: true };
      }
    } catch (error) {
      console.error('Comprehensive planning assessment failed:', error);
      return { error: error.message };
    }
  }

  /**
   * Enhanced AI confidence calculation
   */
  calculateEnhancedAIConfidence(results) {
    let confidence = 0;
    let factors = 0;

    // Base text analysis confidence
    if (results.textAnalysis) {
      confidence += (results.textAnalysis.confidence || 0.5) * 0.3;
      factors += 0.3;
    }

    // Contextual analysis confidence
    if (results.contextualAnalysis && !results.contextualAnalysis.error) {
      confidence += 0.7 * 0.25;
      factors += 0.25;
    }

    // Evidence chain strength
    if (results.evidenceChains && results.evidenceChains.length > 0) {
      const avgChainStrength = results.evidenceChains.reduce((sum, chain) => sum + chain.strength, 0) / results.evidenceChains.length;
      confidence += avgChainStrength * 0.25;
      factors += 0.25;
    }

    // Retrieval coverage
    if (results.retrievalResults) {
      const totalSources = [
  results.retrievalResults.localApplication?.length || 0,
  results.retrievalResults.localPolicy?.length || 0,
        results.retrievalResults.planIt?.length || 0,
        results.retrievalResults.policies?.length || 0,
        results.retrievalResults.constraints?.length || 0
      ].reduce((a, b) => a + b, 0);
      
      const retrievalConfidence = Math.min(1.0, totalSources / 10); // 10+ sources = max confidence
      confidence += retrievalConfidence * 0.2;
      factors += 0.2;
    }

    return factors > 0 ? confidence / factors : 0.3; // Default low confidence if no factors
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
    // Overloaded: searchVectorStore(query) -> legacy aggregate (strings)
    // searchVectorStore(query, category) -> detailed objects for category ('application'|'policy')
    const category = arguments[1];
    if (category === 'application' || category === 'policy') {
      const store = category === 'application' ? this.vectorStoreApplication : this.vectorStorePolicy;
      if (!store || store.length === 0) return [];
      const queryEmbedding = await this.embedder.embed(query.slice(0, 5000));
      // Merge in persistent vectors (dual DB) if available
      let persistent = [];
      try {
        if (this.database) {
          if (category === 'policy' && typeof this.database.searchGovernmentVectors === 'function') {
            persistent = await this.database.searchGovernmentVectors(queryEmbedding, { limit: 18, threshold: 0.45 });
          } else if (category === 'application' && typeof this.database.searchApplicantVectors === 'function') {
            persistent = await this.database.searchApplicantVectors(queryEmbedding, { limit: 18, threshold: 0.45 });
          }
        }
      } catch (e) {
        console.warn('Persistent vector search failed', e.message);
      }
      const mem = store.map(item => ({
        content: item.text,
        similarity: this.cosineSimilarity(queryEmbedding, item.embedding || []),
        metadata: item.metadata || {},
        role: category
      })).filter(r => !Number.isNaN(r.similarity));
      const combined = [...mem, ...persistent];
      // De-duplicate by content hash (simple length+first40 heuristic)
      const seen = new Set();
      const deduped = [];
      for (const r of combined) {
        const key = r.content.length + ':' + r.content.slice(0,40);
        if (!seen.has(key)) { seen.add(key); deduped.push(r); }
      }
      deduped.sort((a,b)=>b.similarity-a.similarity);
      return deduped.slice(0, 24); // richer objects, expanded limit due to fusion
    }
    if (!this.vectorStore || this.vectorStore.length === 0) return [];
    const queryEmbedding = await this.embedder.embed(query.slice(0, 5000));
    const scored = this.vectorStore.map(item => ({
      text: item.text,
      similarity: this.cosineSimilarity(queryEmbedding, item.embedding || [])
    })).filter(r => !Number.isNaN(r.similarity));
    scored.sort((a,b)=>b.similarity-a.similarity);
    return scored.slice(0, 8).map(r => r.text);
  }

  /** 
   * Enhanced hybrid retrieval with agentic data fetching
   * LLM can request additional data as needed for comprehensive assessment
   */
  async agenticRetrieve(query, context = {}, options = {}) {
    // Hierarchical retrieval: differentiate application vs policy context.
    const retrievalResults = {
      localApplication: [],
      localPolicy: [],
      planIt: [],
      policies: [], // external policy fetch (legacy)
      constraints: [],
      precedents: [],
      additionalData: [],
      retrievalStrategy: 'hierarchical'
    };

    try {
      // Phase 1: Role-aware local semantic search
      const applicationLocal = await this.searchVectorStore(query, 'application');
      const policyLocal = await this.searchVectorStore(query, 'policy');
      retrievalResults.localApplication = applicationLocal;
      retrievalResults.localPolicy = policyLocal;

      // Phase 2: Minimal data-needs reasoning (reuse existing logic if LLM available)
      let dataNeeds = { needsPlanItData: false, needsPolicyData: false, needsConstraintData: false, needsPrecedentData: false, additionalQueries: [] };
      if (this.model && options.useAgentic !== false) {
        dataNeeds = await this.assessDataNeeds(query, context, applicationLocal.map(r=>r.content));
      }

      // Adjust heuristics: only allow broad PlanIt queries if query appears highly specific (has a number or address tokens) or address provided
      const hasSpecificity = /\b(\d{1,4})\b/.test(query) || (context.address && context.address.length > 5);
      if (!hasSpecificity) {
        dataNeeds.needsPlanItData = false; // suppress generic precedent noise
      }

      // Phase 3: Targeted external fetches
      const fetchPromises = [];
      if (dataNeeds.needsPlanItData && (context.address || context.coordinates)) {
        const planItQuery = context.address ? `applications near ${context.address}` : query;
        fetchPromises.push(
          this.searchPlanItApplications(planItQuery, { limit: 6 })
            .then(resp => ({ type: 'planIt', data: resp.results || [] }))
            .catch(e => ({ type: 'planIt', data: [], warn: e.message }))
        );
      }
      if (dataNeeds.needsPolicyData && context.authority) {
        fetchPromises.push(
          this.fetchLocalPlanPolicies(context.authority)
            .then(policies => ({ type: 'policies', data: policies.filter(p=>this.isRelevantPolicy(p, query, context)).slice(0, 8) }))
            .catch(e => ({ type: 'policies', data: [], warn: e.message }))
        );
      }
      if (dataNeeds.needsConstraintData && context.coordinates) {
        fetchPromises.push(
          Promise.resolve().then(async () => {
            if (!this.spatialAnalyzer.initialized) await this.spatialAnalyzer.initialize();
            return this.spatialAnalyzer.queryConstraints(context.coordinates, dataNeeds.constraintTypes || ['conservationAreas','listedBuildings','floodZones']);
          }).then(res => ({ type: 'constraints', data: res || [] }))
            .catch(e => ({ type: 'constraints', data: [], warn: e.message }))
        );
      }
      if (dataNeeds.needsPrecedentData) {
        fetchPromises.push(
          this.searchSimilarCases(query, context)
            .then(res => ({ type: 'precedents', data: res || [] }))
            .catch(e => ({ type: 'precedents', data: [], warn: e.message }))
        );
      }
      if (dataNeeds.additionalQueries && dataNeeds.additionalQueries.length) {
        for (const q of dataNeeds.additionalQueries.slice(0,3)) {
          fetchPromises.push(
            this.executeTargetedSearch(q, context)
              .then(res => ({ type: 'additionalData', data: res, query: q }))
              .catch(e => ({ type: 'additionalData', data: [], query: q, warn: e.message }))
          );
        }
      }
      if (fetchPromises.length) {
        const settled = await Promise.allSettled(fetchPromises);
        for (const s of settled) {
          if (s.status === 'fulfilled') {
            const { type, data, query: q } = s.value;
            if (type === 'additionalData') retrievalResults.additionalData.push({ query: q, results: data }); else retrievalResults[type] = data;
          }
        }
      }

      // Phase 4: Combine and rank
      retrievalResults.combined = this.combineAndRankResults(retrievalResults, query, context);
      // Diversify & prune to avoid context collapse
      retrievalResults.combined = this.diversifyResults(retrievalResults.combined, 25);
      // Build policy matrix
      retrievalResults.policyMatrix = this.buildPolicyMatrix(retrievalResults);
      // Apply role/token budgets for LLM context
      retrievalResults.limitedContext = this.applyContextBudget(retrievalResults.combined, {
        policyTokens: 1200,
        applicationTokens: 800,
        otherTokens: 400,
        maxTotal: 2400
      });
      retrievalResults.metrics = { combinedCount: retrievalResults.combined.length, limitedCount: retrievalResults.limitedContext.length };

      // Grounding: if low coverage / sparse policy matrix and pro model available, run up to 2 targeted web grounding searches
      if (this.proModel && options.enableGrounding !== false) {
        const needGrounding = (retrievalResults.policyMatrix?.count || 0) < 3 && (retrievalResults.limitedContext.length < 6);
        if (needGrounding) {
          retrievalResults.grounding = [];
          const groundingQueries = this.generateGroundingQueries(query, context).slice(0,2);
          for (const gq of groundingQueries) {
            try {
              const grounded = await this.performGroundedSearch(gq);
              if (grounded) retrievalResults.grounding.push(grounded);
            } catch (e) {
              console.warn('Grounding search failed:', e.message);
            }
          }
          // Merge grounded snippets with moderate weight
          if (retrievalResults.grounding.length) {
            const groundedItems = retrievalResults.grounding.flatMap(g => (g.snippets||[]).map(s => ({ source: 'grounded_web', content: s, relevanceScore: 0.45 })));
            retrievalResults.combined.push(...groundedItems);
            retrievalResults.combined = this.diversifyResults(retrievalResults.combined, 30);
            retrievalResults.limitedContext = this.applyContextBudget(retrievalResults.combined, { policyTokens: 1200, applicationTokens: 800, otherTokens: 500, maxTotal: 2500 });
          }
        }
      }
      return retrievalResults;
    } catch (e) {
      console.error('Hierarchical agentic retrieval failed:', e);
      const fallback = await this.searchVectorStore(query);
      return { localApplication: [], localPolicy: [], planIt: [], policies: [], constraints: [], precedents: [], additionalData: [], combined: fallback.slice(0,5), retrievalStrategy: 'fallback' };
    }
  }

  /**
   * LLM assesses what additional data is needed for comprehensive analysis
   */
  async assessDataNeeds(query, context, localResults) {
    if (!this.model) {
      return { needsPlanItData: true, needsPolicyData: true, needsConstraintData: true };
    }

    const prompt = `As a planning assessment AI, analyze this query and context to determine what additional data is needed for a comprehensive response.

Query: "${query}"

Context: ${JSON.stringify(context, null, 2)}

Local Results Found: ${localResults.length} documents

Current Assessment: The local search found ${localResults.length} relevant documents. 

Please analyze what additional data sources would improve the assessment:

1. Do we need to search planning applications database (PlanIt)? (e.g., for precedents, similar cases)
2. Do we need specific local plan policies? (e.g., for policy interpretation, development standards)
3. Do we need constraint data? (e.g., for heritage, environmental, or planning constraints)
4. Do we need precedent/appeal decisions? (e.g., for similar cases, inspector decisions)
5. What specific additional search queries would help?

Respond in JSON format:
{
  "needsPlanItData": boolean,
  "needsPolicyData": boolean, 
  "needsConstraintData": boolean,
  "needsPrecedentData": boolean,
  "constraintTypes": ["conservationAreas", "listedBuildings", etc.],
  "additionalQueries": ["specific search query 1", "specific search query 2"],
  "reasoning": "brief explanation of data needs"
}`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback if parsing fails
      return {
        needsPlanItData: text.toLowerCase().includes('planit') || text.toLowerCase().includes('precedent'),
        needsPolicyData: text.toLowerCase().includes('policy') || text.toLowerCase().includes('local plan'),
        needsConstraintData: text.toLowerCase().includes('constraint') || text.toLowerCase().includes('heritage'),
        needsPrecedentData: text.toLowerCase().includes('precedent') || text.toLowerCase().includes('appeal'),
        reasoning: "JSON parsing failed, using heuristic analysis"
      };

    } catch (error) {
      console.warn('Data needs assessment failed:', error);
      // Conservative fallback - fetch everything
      return {
        needsPlanItData: true,
        needsPolicyData: true,
        needsConstraintData: true,
        needsPrecedentData: true,
        reasoning: "Assessment failed, fetching all available data"
      };
    }
  }

  /**
   * Search for similar planning cases and precedents
   */
  async searchSimilarCases(query, context) {
    const precedents = [];
    
    // Search local database for similar assessments
    if (this.database) {
      try {
        const similarAssessments = await this.database.assessments
          .where('status').equals('completed')
          .toArray();
        
        // Find similar cases based on keywords and context
        for (const assessment of similarAssessments.slice(0, 5)) {
          if (assessment.results?.ai?.textAnalysis) {
            const similarity = this.calculateTextSimilarity(
              query, 
              assessment.results.ai.textAnalysis.summary || ''
            );
            
            if (similarity > 0.3) {
              precedents.push({
                type: 'local_assessment',
                reference: assessment.id,
                similarity: similarity,
                recommendation: assessment.recommendation?.decision,
                keyIssues: assessment.recommendation?.keyConsiderations || [],
                context: assessment.results?.ai?.textAnalysis?.summary
              });
            }
          }
        }
      } catch (e) {
        console.warn('Local precedent search failed:', e);
      }
    }

    return precedents;
  }

  /**
   * Execute targeted search based on LLM-generated query
   */
  async executeTargetedSearch(searchQuery, context) {
    const results = [];
    
    // Try multiple search strategies
    try {
      // 1. Semantic search in local documents
      const localResults = await this.searchVectorStore(searchQuery);
      results.push(...localResults.map(r => ({ ...r, source: 'local_semantic' })));

      // 2. PlanIt search if context suggests it's relevant
      if (searchQuery.toLowerCase().includes('application') || 
          searchQuery.toLowerCase().includes('planning') ||
          searchQuery.toLowerCase().includes('development')) {
        try {
          const planItResults = await this.planItAPI.searchApplications({ 
            search: searchQuery, 
            pg_sz: 10 
          });
          results.push(...(planItResults?.records || []).map(r => ({ 
            ...r, 
            source: 'planit_targeted' 
          })));
        } catch (e) {
          console.warn('Targeted PlanIt search failed:', e);
        }
      }

      // 3. Policy search if query relates to development standards
      if (context.authority && (
          searchQuery.toLowerCase().includes('policy') ||
          searchQuery.toLowerCase().includes('standard') ||
          searchQuery.toLowerCase().includes('requirement'))) {
        try {
          const policies = await this.fetchLocalPlanPolicies(context.authority);
          const relevantPolicies = policies.filter(p => 
            p.text && p.text.toLowerCase().includes(searchQuery.toLowerCase().split(' ')[0])
          ).slice(0, 5);
          results.push(...relevantPolicies.map(r => ({ ...r, source: 'policy_targeted' })));
        } catch (e) {
          console.warn('Targeted policy search failed:', e);
        }
      }

    } catch (error) {
      console.error('Targeted search execution failed:', error);
    }

    return results;
  }

  /**
   * Combine and rank results from multiple sources
   */
  combineAndRankResults(retrievalResults, query, context) {
    const allResults = [];

    // Highest priority: local policy (uploaded policy documents)
    (retrievalResults.localPolicy || []).forEach(r => allResults.push({
      source: 'local_policy',
      content: r.content || r.text || r,
      relevanceScore: 1.0 * (r.similarity || r.relevance || 0.6),
      role: 'policy'
    }));

    // Next: local application docs
    (retrievalResults.localApplication || []).forEach(r => allResults.push({
      source: 'local_application',
      content: r.content || r.text || r,
      relevanceScore: 0.9 * (r.similarity || r.relevance || 0.5),
      role: 'application'
    }));

    // External policies (if any) slightly lower
    (retrievalResults.policies || []).forEach(r => allResults.push({
      source: 'external_policy',
      content: r.text || r.description || JSON.stringify(r).substring(0,400),
      relevanceScore: 0.75
    }));

    // Constraints
    (retrievalResults.constraints || []).forEach(r => allResults.push({
      source: 'constraints',
      content: r.description || r.name || JSON.stringify(r).substring(0,200),
      relevanceScore: 0.7
    }));

    // PlanIt precedents (downgraded weight)
    (retrievalResults.planIt || []).forEach(r => allResults.push({
      source: 'planit',
      content: `${r.description || ''} ${r.address || ''}`.trim(),
      relevanceScore: 0.55
    }));

    // Local precedents
    (retrievalResults.precedents || []).forEach(r => allResults.push({
      source: 'precedent_local',
      content: r.context || r.reference || JSON.stringify(r).substring(0,200),
      relevanceScore: 0.6 * (r.similarity || 0.5)
    }));

    // Additional targeted queries
    (retrievalResults.additionalData || []).forEach(block => {
      (block.results || []).forEach(r => allResults.push({
        source: 'additional_targeted',
        targetedQuery: block.query,
        content: r.content || r.text || r.description || JSON.stringify(r).substring(0,200),
        relevanceScore: 0.5
      }));
    });

    return allResults.sort((a,b)=> (b.relevanceScore||0)-(a.relevanceScore||0)).slice(0,25);
  }

  /** Diversify results to reduce redundancy and over-representation */
  diversifyResults(results, limit=25) {
    if (!Array.isArray(results)) return [];
    const maxPerSource = { local_policy: 8, local_application: 8, external_policy: 4, constraints: 4, planit: 4, precedent_local: 4, additional_targeted: 3 };
    const picked = [];
    const counts = {};
    const isNearDuplicate = (a,b) => {
      const wa = new Set(String(a.content||'').toLowerCase().split(/\W+/));
      const wb = new Set(String(b.content||'').toLowerCase().split(/\W+/));
      if (!wa.size || !wb.size) return false;
      let inter=0; wb.forEach(w=>{ if (wa.has(w)) inter++;});
      const jacc = inter / (wa.size + wb.size - inter);
      return jacc > 0.9;
    };
    for (const r of results) {
      if (picked.length >= limit) break;
      const src = r.source || 'other';
      counts[src] = counts[src] || 0;
      if (maxPerSource[src] !== undefined && counts[src] >= maxPerSource[src]) continue;
      if (picked.some(p=>isNearDuplicate(p,r))) continue;
      picked.push(r); counts[src]++;
    }
    return picked;
  }

  /** Estimate tokens (rough) */
  estimateTokens(text){ if(!text) return 0; return Math.ceil(String(text).split(/\s+/).length * 0.75); }

  /** Apply role/token budgets */
  applyContextBudget(results, budgets){
    const out = [];
    let policyT=0, appT=0, otherT=0, total=0;
    for (const r of results) {
      const role = r.source;
      const tok = this.estimateTokens(r.content);
      if (budgets.maxTotal && total + tok > budgets.maxTotal) continue;
      if (role === 'local_policy' || role === 'external_policy') {
        if (policyT + tok > budgets.policyTokens) continue; policyT += tok; out.push(r); total += tok; continue;
      }
      if (role === 'local_application') {
        if (appT + tok > budgets.applicationTokens) continue; appT += tok; out.push(r); total += tok; continue;
      }
      if (otherT + tok > budgets.otherTokens) continue; otherT += tok; out.push(r); total += tok;
    }
    return out;
  }

  /** Extract a simple policy compliance matrix from retrieved policy context */
  buildPolicyMatrix(retrievalResults){
    const policies = [];
    const policyItems = [...(retrievalResults.localPolicy||[]), ...(retrievalResults.policies||[]), ...(retrievalResults.combined||[]).filter(r=>/policy/.test(r.source||''))];
    const seen = new Set();
    const codeRegexes = [/(?:Policy\s+)?([A-Z]{2,}\d{1,3}[A-Z]?)/g, /\b([A-Z]{2,}-\d{1,3})\b/g];
    for (const item of policyItems.slice(0,60)) {
      const text = item.content || item.text || '';
      for (const rx of codeRegexes) {
        let m; while ((m = rx.exec(text)) !== null) {
          const code = m[1];
          if (code && !seen.has(code)) {
            seen.add(code);
            policies.push({ code, snippet: text.substring(0,240) });
          }
        }
      }
      if (policies.length > 40) break;
    }
    return { count: policies.length, policies };
  }

  /** Suggest grounding queries */
  generateGroundingQueries(originalQuery, context){
    const qs = [];
    if (context.authority) qs.push(`${context.authority} local plan policy summary`);
    if (context.developmentType) qs.push(`${context.developmentType} planning policy key issues UK`);
    qs.push(`${originalQuery} planning policy UK`);
    return Array.from(new Set(qs));
  }

  /** Perform a grounded web reasoning pass using Google GenAI pro model streaming */
  async performGroundedSearch(searchQuery){
    if (!this.proModel) return null;
    const contents = [
      { role: 'user', parts: [{ text: `You can perform a grounded reasoning step. Run a concise web-oriented reasoning to identify authoritative planning policy or guidance relevant to: ${searchQuery}. Return JSON with {\n  query:string,\n  inferredTopics:[string],\n  snippets:[string]\n}. Keep snippets under 220 chars.` }] }
    ];
    try {
      const stream = await this.proModel.generateContentStream({ model: 'gemini-2.5-pro', contents, config: { thinkingConfig: { thinkingBudget: -1 } } });
      let acc = '';
      for await (const chunk of stream) { if (chunk.text) acc += chunk.text; }
      const jsonMatch = acc.match(/\{[\s\S]*\}/);
      let parsed = null;
      if (jsonMatch) { try { parsed = JSON.parse(jsonMatch[0]); } catch { /* ignore */ } }
      if (!parsed) parsed = { query: searchQuery, raw: acc.substring(0,800) };
      parsed.query = parsed.query || searchQuery;
      return parsed;
    } catch (e) {
      console.warn('performGroundedSearch error', e.message);
      return null;
    }
  }

  /**
   * Calculate similarity between texts (simple implementation)
   */
  calculateTextSimilarity(text1, text2) {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
  }

  /**
   * Check if a policy is relevant to the query and context
   */
  isRelevantPolicy(policy, query, context) {
    if (!policy.text && !policy.description) return false;
    
    const policyText = (policy.text || policy.description || '').toLowerCase();
    const queryWords = query.toLowerCase().split(/\s+/);
    
    // Check for direct keyword matches
    return queryWords.some(word => policyText.includes(word)) ||
           (context.developmentType && policyText.includes(context.developmentType.toLowerCase()));
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
        // Parallel embedding generation for vector store
        const embeddingPromises = parseResult.chunks.map(async (chunk) => {
          try {
            const embedding = await this.embedder.embed(chunk.content);
            return { text: chunk.content, embedding };
          } catch (error) {
            console.warn('Vector store embedding failed for chunk:', error.message);
            return null;
          }
        });
        
        const embeddings = await Promise.all(embeddingPromises);
        if (!this.vectorStore) this.vectorStore = [];
        this.vectorStore.push(...embeddings.filter(item => item !== null));
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
    const resolvedAddress = assessment.results.address?.primaryAddress?.formattedAddress || assessment.results.address?.primaryAddress?.cleaned;

    return {
      applicationSite: spatial?.address || resolvedAddress || 'Address not resolved',
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
  const resolvedAddress = address?.primaryAddress?.formattedAddress || address?.primaryAddress?.cleaned;

    return {
      location: {
    address: resolvedAddress,
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

  /**
   * Extract coordinates from document text using various patterns
   * @param {string} textContent - The document text content
   * @returns {Promise<[number, number]|null>} - [longitude, latitude] or null
   */
  async extractCoordinatesFromText(textContent) {
    if (!textContent || typeof textContent !== 'string') {
      return null;
    }

    // Various coordinate patterns to look for
    const coordinatePatterns = [
      // Decimal degrees: lat, lng or lng, lat
      /(?:lat|latitude|north)[:\s]+(-?\d+\.?\d*)[,\s]+(?:lng|lon|longitude|east)[:\s]+(-?\d+\.?\d*)/gi,
      /(?:lng|lon|longitude|east)[:\s]+(-?\d+\.?\d*)[,\s]+(?:lat|latitude|north)[:\s]+(-?\d+\.?\d*)/gi,
      
      // Degrees, minutes, seconds
      /(\d+)°\s*(\d+)'\s*(\d+(?:\.\d+)?)"?\s*([NS])[,\s]*(\d+)°\s*(\d+)'\s*(\d+(?:\.\d+)?)"?\s*([EW])/gi,
      
      // Grid references (simplified - would need proper conversion)
      /(?:grid\s*ref|gridref|os\s*ref)[:\s]*([A-Z]{2}\s*\d{6,10})/gi,
      
      // Easting/Northing
      /(?:easting|x)[:\s]*(\d{6,7})[,\s]*(?:northing|y)[:\s]*(\d{6,7})/gi,
      
      // Simple decimal coordinate pairs
      /(-?\d{1,2}\.\d{4,})[,\s]+(-?\d{1,3}\.\d{4,})/g
    ];

    for (const pattern of coordinatePatterns) {
      const matches = [...textContent.matchAll(pattern)];
      
      for (const match of matches) {
        try {
          let lat = null, lng = null;
          
          if (pattern.source.includes('lat|latitude')) {
            // Pattern with explicit lat/lng labels
            lat = parseFloat(match[1]);
            lng = parseFloat(match[2]);
          } else if (pattern.source.includes('lng|lon|longitude')) {
            // Pattern with lng first
            lng = parseFloat(match[1]);
            lat = parseFloat(match[2]);
          } else if (pattern.source.includes('°')) {
            // DMS format - convert to decimal
            const latDeg = parseInt(match[1]);
            const latMin = parseInt(match[2]);
            const latSec = parseFloat(match[3]);
            const latDir = match[4];
            
            const lngDeg = parseInt(match[5]);
            const lngMin = parseInt(match[6]);
            const lngSec = parseFloat(match[7]);
            const lngDir = match[8];
            
            lat = latDeg + latMin/60 + latSec/3600;
            if (latDir === 'S') lat = -lat;
            
            lng = lngDeg + lngMin/60 + lngSec/3600;
            if (lngDir === 'W') lng = -lng;
          } else if (pattern.source.includes('easting')) {
            // OS Grid reference conversion would be complex, skip for now
            continue;
          } else {
            // Simple decimal pair - assume lat, lng order for UK
            lat = parseFloat(match[1]);
            lng = parseFloat(match[2]);
          }
          
          // Validate coordinates are reasonable for UK
          if (lat && lng && 
              lat >= 49.5 && lat <= 61.0 &&  // UK latitude range
              lng >= -8.5 && lng <= 2.0) {    // UK longitude range
            
            console.log(`Extracted coordinates from text: [${lng}, ${lat}]`);
            return [lng, lat];
          }
        } catch (error) {
          console.warn('Failed to parse coordinate match:', match, error);
        }
      }
    }
    
    return null;
  }

  /**
   * Sanitize assessment object for storage by removing non-serializable data
   */
  sanitizeForStorage(assessment) {
    // Deep clone and remove problematic data types
    const sanitized = JSON.parse(JSON.stringify(assessment, (key, value) => {
      // Remove ArrayBuffers, Functions, and other non-serializable types
      if (value instanceof ArrayBuffer || 
          value instanceof Uint8Array ||
          value instanceof Blob ||
          value instanceof File ||
          typeof value === 'function') {
        return '[Removed for storage]';
      }
      
      // Convert large objects to summaries
      if (key === 'vectorStore' && Array.isArray(value)) {
        return `[Vector store with ${value.length} embeddings]`;
      }
      
      if (key === 'rawContent' && typeof value === 'string' && value.length > 1000) {
        return value.substring(0, 1000) + '... [truncated for storage]';
      }
      
      // Remove large binary data
      if (key === 'embedding' && Array.isArray(value) && value.length > 100) {
        return `[Embedding vector, length: ${value.length}]`;
      }
      
      return value;
    }));
    
    // Add storage metadata
    sanitized.storedAt = new Date().toISOString();
    sanitized.storageVersion = '1.0';
    
    return sanitized;
  }

  /**
   * Retrieve relevant local plan policies for assessment
   * Enhanced for Phase 3: Development Management Integration
   */
  async retrieveRelevantPolicies(assessmentData, options = {}) {
    const { topK = 10, categories = null, authorityCode = null } = options;
    
    try {
      // Extract key information for policy search
      const searchTerms = this._extractPolicySearchTerms(assessmentData);
      const searchQuery = searchTerms.join(' ');
      
      console.log(`🔍 Searching for policies: "${searchQuery}"`);
      
      // Find relevant local plans
      let localPlans = await this.localPlanManager.listLocalPlans();
      
      // Filter by authority if specified
      if (authorityCode) {
        localPlans = localPlans.filter(plan => plan.authorityCode === authorityCode);
      }
      
      // Search policies across all relevant plans
      const policyResults = [];
      
      for (const plan of localPlans) {
        try {
          const planPolicies = await this.localPlanManager.searchPoliciesSemantics(
            plan.id, 
            searchQuery, 
            { topK: Math.ceil(topK / localPlans.length), categories }
          );
          
          // Add plan context to results
          const enrichedPolicies = planPolicies.map(result => ({
            ...result,
            planContext: {
              planId: plan.id,
              planName: plan.name,
              authority: plan.authorityCode,
              adoptionDate: plan.adoptionDate,
              status: plan.status
            }
          }));
          
          policyResults.push(...enrichedPolicies);
        } catch (error) {
          console.warn(`Failed to search policies in plan ${plan.name}:`, error);
        }
      }
      
      // Sort by similarity and return top results
      const sortedResults = policyResults
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);
      
      console.log(`✅ Found ${sortedResults.length} relevant policies`);
      
      return {
        policies: sortedResults,
        searchQuery,
        searchTerms,
        metadata: {
          totalPlansSearched: localPlans.length,
          categoriesSearched: categories || 'all',
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      console.error('Policy retrieval failed:', error);
      return {
        policies: [],
        searchQuery: '',
        searchTerms: [],
        error: error.message
      };
    }
  }

  /**
   * Extract search terms from assessment data for policy retrieval
   */
  _extractPolicySearchTerms(assessmentData) {
    const terms = [];
    
    // Extract from description
    if (assessmentData.description) {
      const description = assessmentData.description.toLowerCase();
      
      // Development types
      const devTypes = ['residential', 'commercial', 'industrial', 'retail', 'office', 'mixed use', 'housing'];
      devTypes.forEach(type => {
        if (description.includes(type)) terms.push(type);
      });
      
      // Key planning concepts
      const concepts = ['development', 'extension', 'conversion', 'change of use', 'demolition', 'new build'];
      concepts.forEach(concept => {
        if (description.includes(concept)) terms.push(concept);
      });
    }
    
    // Extract from spatial analysis
    if (assessmentData.spatial) {
      if (assessmentData.spatial.constraints) {
        assessmentData.spatial.constraints.forEach(constraint => {
          terms.push(constraint.type.toLowerCase());
        });
      }
      
      if (assessmentData.spatial.designations) {
        assessmentData.spatial.designations.forEach(designation => {
          terms.push(designation.toLowerCase());
        });
      }
    }
    
    // Extract from material considerations
    if (assessmentData.materialConsiderations) {
      assessmentData.materialConsiderations.forEach(consideration => {
        if (consideration.category) {
          terms.push(consideration.category.toLowerCase());
        }
      });
    }
    
    // Unique terms only
    return [...new Set(terms)];
  }

  /**
   * Integrate policy retrieval into assessment workflow
   */
  async enhanceAssessmentWithPolicies(assessmentData) {
    try {
      // Get relevant policies
      const policyResults = await this.retrieveRelevantPolicies(assessmentData, {
        topK: 15,
        authorityCode: assessmentData.spatial?.authority
      });
      
      // Format policies for AI analysis
      const policyContext = policyResults.policies.map(result => ({
        policyRef: result.policy.policyRef,
        title: result.policy.title,
        category: result.policy.category,
        relevantContent: result.matchingChunk,
        similarity: result.similarity,
        planName: result.planContext.planName,
        authority: result.planContext.authority
      }));
      
      // Add to assessment data
      assessmentData.relevantPolicies = policyContext;
      assessmentData.policySearchMetadata = policyResults.metadata;
      
      return assessmentData;
      
    } catch (error) {
      console.error('Failed to enhance assessment with policies:', error);
      assessmentData.relevantPolicies = [];
      assessmentData.policyError = error.message;
      return assessmentData;
    }
  }
}

export default Agent;
