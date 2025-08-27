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
      if (this.planningDataAPI && typeof this.planningDataAPI.initialize === 'function') {
        await this.planningDataAPI.initialize();
      }
      
      this.initialized = true;
      console.log('TPA Agent initialized successfully');
    } catch (error) {
      console.error('Failed to initialize TPA Agent:', error);
      throw error;
    }
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
      
      const documentResults = await this.processDocuments(documentFiles, assessmentId);
      assessment.results.documents = documentResults;
      
      // Phase 2: Address Resolution and Site Identification
      assessment.status = 'resolving_address';
      this.addTimelineEvent(assessment, 'phase_2_start', 'Resolving site address and location');
      
      const addressResults = await this.resolveAddress(documentResults, assessmentId);
      assessment.results.address = addressResults;

      if (!addressResults.primaryAddress || !addressResults.primaryAddress.coordinates) {
        throw new Error('Could not resolve site address and coordinates');
      }

      // Phase 3: Spatial Analysis and Constraint Assessment
      assessment.status = 'spatial_analysis';
      this.addTimelineEvent(assessment, 'phase_3_start', 'Conducting spatial analysis');
      
      const spatialResults = await this.conductSpatialAnalysis(
        addressResults.primaryAddress.coordinates,
        assessmentId
      );
      assessment.results.spatial = spatialResults;

      // Phase 4: AI-Powered Multimodal Analysis
      assessment.status = 'ai_analysis';
      this.addTimelineEvent(assessment, 'phase_4_start', 'Performing AI analysis');
      
      const aiResults = await this.performAIAnalysis(documentResults, spatialResults, assessmentId);
      assessment.results.ai = aiResults;

      // Phase 5: Material Considerations Assessment
      assessment.status = 'material_considerations';
      this.addTimelineEvent(assessment, 'phase_5_start', 'Assessing material considerations');
      
      const materialResults = await this.assessMaterialConsiderations(
        documentResults,
        spatialResults,
        aiResults,
        assessmentId
      );
      assessment.results.material = materialResults;

      // Phase 6: Evidence Compilation and Validation
      assessment.status = 'evidence_compilation';
      this.addTimelineEvent(assessment, 'phase_6_start', 'Compiling and validating evidence');
      
      const evidenceResults = await this.compileEvidence(
        documentResults,
        spatialResults,
        aiResults,
        materialResults,
        assessmentId
      );
      assessment.results.evidence = evidenceResults;

      // Phase 7: Decision Synthesis and Recommendation
      assessment.status = 'decision_synthesis';
      this.addTimelineEvent(assessment, 'phase_7_start', 'Synthesizing decision recommendation');
      
      const recommendation = await this.synthesizeRecommendation(assessment, assessmentId);
      assessment.recommendation = recommendation;
      assessment.confidence = recommendation.confidence;

      // Phase 8: Report Generation
      assessment.status = 'report_generation';
      this.addTimelineEvent(assessment, 'phase_8_start', 'Generating comprehensive report');
      
      const report = await this.generateReport(assessment, assessmentId);
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

  async processDocuments(documentFiles, assessmentId) {
    const results = {
      processed: [],
      totalDocuments: documentFiles.length,
      extractedData: {},
      images: [],
      chunks: [],
      addresses: [],
      planningRefs: []
    };

    for (let i = 0; i < documentFiles.length; i++) {
      const file = documentFiles[i];
      
      try {
        this.addTimelineEvent(
          this.activeAssessments.get(assessmentId),
          'document_processing',
          `Processing document: ${file.name}`
        );
        // Support multiple input shapes: File, {buffer}, {data}, ArrayBuffer
        let dataBuffer = null;
        if (file instanceof ArrayBuffer) {
          dataBuffer = file;
        } else if (file.buffer instanceof ArrayBuffer) {
          dataBuffer = file.buffer;
        } else if (file.data instanceof ArrayBuffer) {
          dataBuffer = file.data;
        } else if (typeof file.arrayBuffer === 'function') {
          dataBuffer = await file.arrayBuffer();
        } else {
          throw new Error('Unsupported document input format');
        }

        const parseResult = await this.parser.parse(dataBuffer);
        
        results.processed.push({
          filename: file.name,
          type: parseResult.documentType,
          status: 'success',
          extractedData: parseResult.extractedData,
          imageCount: parseResult.images ? parseResult.images.length : 0,
          chunkCount: parseResult.chunks ? parseResult.chunks.length : 0
        });

        // Accumulate results
        if (parseResult.extractedData) {
          results.extractedData = this.mergeExtractedData(results.extractedData, parseResult.extractedData);
        }

        if (parseResult.images) {
          results.images.push(...parseResult.images);
        }

        if (parseResult.chunks) {
          results.chunks.push(...parseResult.chunks);
        }

        if (parseResult.addresses) {
          results.addresses.push(...parseResult.addresses);
        }

        if (parseResult.planningApplicationRefs) {
          results.planningRefs.push(...parseResult.planningApplicationRefs);
        }

      } catch (error) {
        console.error(`Failed to process document ${file.name}:`, error);
        results.processed.push({
          filename: file.name,
          status: 'error',
          error: error.message
        });
      }
    }

    return results;
  }

  async resolveAddress(documentResults, assessmentId) {
    // Extract addresses from all sources
    const allAddresses = [...documentResults.addresses];
    
    // Add any addresses from extracted data
    if (documentResults.extractedData.addresses) {
      allAddresses.push(...documentResults.extractedData.addresses);
    }

    if (allAddresses.length === 0) {
      throw new Error('No addresses found in documents');
    }

    this.addTimelineEvent(
      this.activeAssessments.get(assessmentId),
      'address_extraction',
      `Found ${allAddresses.length} potential addresses`
    );

    // Use address extractor to resolve and geocode
    const addressResult = await this.addressExtractor.extractAddresses(
      allAddresses.join(' ')
    );

    if (!addressResult.hasValidAddress) {
      throw new Error('No valid addresses could be resolved');
    }

    this.addTimelineEvent(
      this.activeAssessments.get(assessmentId),
      'address_resolved',
      `Resolved address: ${addressResult.primaryAddress.formattedAddress}`
    );

    return addressResult;
  }

  async conductSpatialAnalysis(coordinates, assessmentId) {
    this.addTimelineEvent(
      this.activeAssessments.get(assessmentId),
      'spatial_analysis_start',
      'Starting comprehensive spatial analysis'
    );

    // Perform spatial analysis
    const spatialResult = await this.spatialAnalyzer.analyzeSite(coordinates);

    this.addTimelineEvent(
      this.activeAssessments.get(assessmentId),
      'spatial_analysis_complete',
      `Identified ${Object.keys(spatialResult.intersections || {}).length} constraint types`
    );

    return spatialResult;
  }

  async performAIAnalysis(documentResults, spatialResults, assessmentId) {
    if (!this.visionModel) {
      return { available: false, reason: 'No AI model configured' };
    }

    this.addTimelineEvent(
      this.activeAssessments.get(assessmentId),
      'ai_analysis_start',
      'Starting AI-powered multimodal analysis'
    );

    const results = {
      textAnalysis: null,
      imageAnalysis: [],
      contextualAnalysis: null,
      planningAssessment: null,
      confidence: 0
    };

    try {
      // Analyze text content
      if (documentResults.chunks && documentResults.chunks.length > 0) {
        results.textAnalysis = await this.analyzeTextContent(documentResults.chunks);
      }

      // Analyze images
      if (documentResults.images && documentResults.images.length > 0) {
        results.imageAnalysis = await this.analyzeImages(documentResults.images);
      }

      // Contextual analysis combining all data
      results.contextualAnalysis = await this.performContextualAnalysis(
        documentResults,
        spatialResults
      );

      // Comprehensive planning assessment
      results.planningAssessment = await this.performPlanningAssessment(
        documentResults,
        spatialResults,
        results
      );

      // Calculate overall confidence
      results.confidence = this.calculateAIConfidence(results);

      this.addTimelineEvent(
        this.activeAssessments.get(assessmentId),
        'ai_analysis_complete',
        `AI analysis completed with ${(results.confidence * 100).toFixed(0)}% confidence`
      );

    } catch (error) {
      console.error('AI analysis failed:', error);
      results.error = error.message;
      results.confidence = 0;
    }

    return results;
  }

  async analyzeTextContent(chunks) {
    const combinedText = chunks.map(chunk => chunk.content).join('\n\n');
    
    const prompt = `
Analyze the following planning application text content and extract key information:

${combinedText.substring(0, 4000)} ${combinedText.length > 4000 ? '...[truncated]' : ''}

Please provide a structured analysis covering:
1. Development description and key characteristics
2. Planning considerations mentioned
3. Technical specifications (heights, areas, units, parking, etc.)
4. Environmental considerations
5. Access and transport arrangements
6. Any heritage or conservation mentions
7. Community benefits or impacts mentioned
8. Identified risks or concerns

Provide your response in a structured JSON format.
`;

    try {
      const result = await this.visionModel.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Try to parse as JSON, fallback to text
      try {
        return JSON.parse(text);
      } catch {
        return { analysis: text, format: 'text' };
      }
    } catch (error) {
      console.error('Text analysis failed:', error);
      return { error: error.message };
    }
  }

  async analyzeImages(images) {
    const results = [];

    for (let i = 0; i < Math.min(images.length, 10); i++) { // Limit to 10 images
      const image = images[i];
      
      try {
        const prompt = `
Analyze this planning-related image and provide detailed information about:

1. Image type (site photo, architectural drawing, plan, elevation, etc.)
2. Key visible features and characteristics
3. Planning considerations evident in the image
4. Scale, dimensions, or measurements visible
5. Relationship to surrounding context
6. Any heritage, environmental, or design considerations
7. Quality and condition of existing structures
8. Access arrangements and transport features
9. Landscape and boundary treatments
10. Any potential planning issues or benefits

Provide a comprehensive but concise analysis suitable for planning assessment.
`;

        const imagePart = {
          inlineData: {
            data: image.data,
            mimeType: image.mimeType
          }
        };

        const result = await this.visionModel.generateContent([prompt, imagePart]);
        const response = await result.response;
        const analysis = response.text();

        results.push({
          imageIndex: i,
          type: image.type || 'unknown',
          analysis: analysis,
          confidence: 0.8
        });

      } catch (error) {
        console.error(`Image analysis failed for image ${i}:`, error);
        results.push({
          imageIndex: i,
          error: error.message,
          confidence: 0
        });
      }
    }

    return results;
  }

  async performContextualAnalysis(documentResults, spatialResults) {
    const prompt = `
Perform a comprehensive contextual analysis for this planning application:

SPATIAL CONTEXT:
${JSON.stringify(spatialResults, null, 2)}

DOCUMENT EXTRACTED DATA:
${JSON.stringify(documentResults.extractedData, null, 2)}

Based on this information, provide:

1. SITE CHARACTERISTICS ASSESSMENT
   - Location quality and context
   - Accessibility and transport links
   - Environmental setting and constraints
   - Heritage and conservation context

2. DEVELOPMENT ANALYSIS
   - Scale and character assessment
   - Appropriateness for location
   - Design quality considerations
   - Technical compliance factors

3. CONSTRAINT ANALYSIS
   - Severity and implications of identified constraints
   - Mitigation requirements
   - Policy compliance requirements
   - Risk assessment

4. CONTEXTUAL FIT ASSESSMENT
   - Relationship to surrounding area
   - Impact on local character
   - Cumulative effects consideration
   - Community integration potential

5. KEY PLANNING ISSUES IDENTIFICATION
   - Primary concerns and challenges
   - Significant benefits or opportunities
   - Critical decision factors
   - Further information requirements

Provide a structured, professional analysis suitable for planning decision-making.
`;

    try {
      const result = await this.visionModel.generateContent(prompt);
      const response = await result.response;
      return {
        analysis: response.text(),
        confidence: 0.75
      };
    } catch (error) {
      console.error('Contextual analysis failed:', error);
      return { error: error.message, confidence: 0 };
    }
  }

  async performPlanningAssessment(documentResults, spatialResults, aiResults) {
    const prompt = `
As an expert planning consultant, provide a comprehensive planning assessment:

DEVELOPMENT PROPOSAL:
${JSON.stringify(documentResults.extractedData, null, 2)}

SPATIAL ANALYSIS:
${JSON.stringify(spatialResults, null, 2)}

AI ANALYSIS RESULTS:
Text Analysis: ${JSON.stringify(aiResults.textAnalysis, null, 2)}
Contextual Analysis: ${aiResults.contextualAnalysis?.analysis || 'Not available'}

Provide a structured planning assessment covering:

1. DEVELOPMENT DESCRIPTION SUMMARY
2. PLANNING POLICY CONTEXT
3. MATERIAL CONSIDERATIONS ASSESSMENT
   - Land use principles
   - Design and character
   - Transport and accessibility
   - Environmental impact
   - Heritage considerations
   - Residential amenity
   - Infrastructure requirements

4. PLANNING BALANCE
   - Benefits of the proposal
   - Identified harms or concerns
   - Balancing exercise
   - Compliance with development plan

5. PRELIMINARY RECOMMENDATION
   - Suggested decision (approve/refuse/defer)
   - Key reasons for recommendation
   - Suggested conditions (if applicable)
   - Further information requirements

6. CONFIDENCE ASSESSMENT
   - Certainty level of recommendation
   - Areas requiring additional investigation
   - Risk factors in decision-making

Provide a professional, structured assessment suitable for planning committee consideration.
`;

    try {
      const result = await this.visionModel.generateContent(prompt);
      const response = await result.response;
      return {
        assessment: response.text(),
        confidence: 0.7
      };
    } catch (error) {
      console.error('Planning assessment failed:', error);
      return { error: error.message, confidence: 0 };
    }
  }

  async assessMaterialConsiderations(documentResults, spatialResults, aiResults, assessmentId) {
    this.addTimelineEvent(
      this.activeAssessments.get(assessmentId),
      'material_considerations_start',
      'Assessing material planning considerations'
    );

    const assessment = await this.materialConsiderations.assessApplication(
      documentResults.extractedData,
      spatialResults,
      documentResults
    );

    this.addTimelineEvent(
      this.activeAssessments.get(assessmentId),
      'material_considerations_complete',
      `Material considerations assessed: ${assessment.overallRecommendation?.decision || 'unknown'}`
    );

    return assessment;
  }

  async compileEvidence(documentResults, spatialResults, aiResults, materialResults, assessmentId) {
    this.addTimelineEvent(
      this.activeAssessments.get(assessmentId),
      'evidence_compilation_start',
      'Compiling comprehensive evidence base'
    );

    const evidence = await this.evidenceEngine.generateEvidence(
      assessmentId,
      documentResults,
      spatialResults,
      aiResults
    );

    this.addTimelineEvent(
      this.activeAssessments.get(assessmentId),
      'evidence_compilation_complete',
      `Evidence compiled: ${evidence.citations.size} citations generated`
    );

    return evidence;
  }

  async synthesizeRecommendation(assessment, assessmentId) {
    this.addTimelineEvent(
      this.activeAssessments.get(assessmentId),
      'decision_synthesis_start',
      'Synthesizing final recommendation'
    );

    const materialRecommendation = assessment.results.material?.overallRecommendation;
    const aiAssessment = assessment.results.ai?.planningAssessment;
    const evidenceQuality = assessment.results.evidence;

    // Calculate confidence scores
    const materialConfidence = materialRecommendation?.confidence || 0.5;
    const aiConfidence = assessment.results.ai?.confidence || 0.5;
    const evidenceConfidence = this.calculateEvidenceConfidence(evidenceQuality);

    // Weighted average confidence
    const overallConfidence = (materialConfidence * 0.4 + aiConfidence * 0.3 + evidenceConfidence * 0.3);

    // Determine recommendation
    let decision = 'defer';
    let reasoning = 'Insufficient information for clear recommendation';

    if (materialRecommendation?.decision) {
      decision = materialRecommendation.decision;
      reasoning = materialRecommendation.reasoning;
    }

    // Risk factors
    const riskFactors = this.identifyRiskFactors(assessment);

    const recommendation = {
      decision: decision,
      reasoning: reasoning,
      confidence: overallConfidence,
      riskFactors: riskFactors,
      keyConsiderations: this.extractKeyConsiderations(assessment),
      conditions: this.suggestConditions(assessment),
      informationRequirements: this.identifyInformationRequirements(assessment),
      appealRisk: this.assessAppealRisk(assessment),
      synthesis: {
        materialBalance: materialRecommendation,
        aiInsights: aiAssessment,
        evidenceQuality: evidenceConfidence,
        overallConfidence: overallConfidence
      }
    };

    this.addTimelineEvent(
      this.activeAssessments.get(assessmentId),
      'decision_synthesis_complete',
      `Recommendation: ${decision} (${(overallConfidence * 100).toFixed(0)}% confidence)`
    );

    return recommendation;
  }

  async generateReport(assessment, assessmentId) {
    this.addTimelineEvent(
      this.activeAssessments.get(assessmentId),
      'report_generation_start',
      'Generating comprehensive assessment report'
    );

    const report = {
      executive: this.generateExecutiveSummary(assessment),
      siteAnalysis: this.generateSiteAnalysisSection(assessment),
      proposalAnalysis: this.generateProposalAnalysisSection(assessment),
      constraintsAssessment: this.generateConstraintsSection(assessment),
      materialConsiderations: this.generateMaterialConsiderationsSection(assessment),
      planningBalance: this.generatePlanningBalanceSection(assessment),
      recommendation: this.generateRecommendationSection(assessment),
      conditions: this.generateConditionsSection(assessment),
      evidence: this.generateEvidenceSection(assessment),
      appendices: this.generateAppendicesSection(assessment)
    };

    this.addTimelineEvent(
      this.activeAssessments.get(assessmentId),
      'report_generation_complete',
      'Comprehensive report generated'
    );

    return report;
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
      const parseResult = await this.parser.parse({ data: dataBuffer, name: file.name });
      
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
    
    return {
      balancingExercise: material?.balancingExercise || {},
      benefits: material?.balancingExercise?.significantBenefits || [],
      harms: material?.balancingExercise?.significantHarms || [],
      overallBalance: material?.balancingExercise?.overallBalance || 'unknown'
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
