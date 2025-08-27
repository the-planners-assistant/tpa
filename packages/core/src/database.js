import Dexie from 'dexie';

class Database extends Dexie {
  constructor() {
    super('TPADatabase');
    
  this.version(1).stores({
      // Document storage
      documents: '++id, name, type, uploadDate, localAuthorityId, applicationRef, size, hash',
      chunks: '++id, documentId, content, embedding, metadata, chunkIndex, confidence',
      
      // Planning data
      policies: '++id, authority, reference, title, content, embedding, category, lastUpdated',
      constraints: '++id, name, type, geometry, authority, source, metadata',
      materialConsiderations: '++id, category, subcategory, description, weight, mandatory',
      
      // Assessment data
      assessments: '++id, documentIds, siteAddress, coordinates, status, recommendation, confidence, createdAt, updatedAt',
      evidence: '++id, assessmentId, type, source, content, confidence, spatial, visual, citation',
      spatialAnalysis: '++id, assessmentId, intersections, proximities, metrics, computedAt',
      
      // Context & Memory
      contextCache: 'key, value, embedding, createdAt, accessCount',
      assessmentHistory: '++id, query, response, confidence, feedback, timestamp',
      localAuthorityData: 'code, name, policies, constraints, contactInfo, lastSync',
      
      // Image and visual analysis
      extractedImages: '++id, documentId, imageData, analysis, type, coordinates, confidence',
      visualAnalysis: '++id, assessmentId, imageId, findings, confidence, aiModel'
    });

    // Version 2: PlanIt integration tables
    this.version(2).stores({
      planitApplications: '++id, applicationId, reference, authority, receivedDate, status',
      planitPolicies: '++id, policyId, authority, reference, category'
    });

    // Version 3: Separate persistent vector stores (government vs applicant)
    // We keep metadata lightweight for indexing; embeddings stored as JS arrays (not indexed)
    this.version(3).stores({
      govVectors: '++id, source, authority, reference',
      applicantVectors: '++id, source, applicationRef'
    });

    // Version 4: Local Plan Management tables
    this.version(4).stores({
      localPlans: '++id, name, authorityCode, adoptionDate, status, version, documentIds, createdAt, updatedAt',
      localPlanPolicies: '++id, planId, policyRef, title, category, content, evidenceIds, parentPolicy, [planId+policyRef]',
      siteAllocations: '++id, planId, siteRef, name, geometry, capacity, constraints, policyIds, status',
      evidenceBase: '++id, planId, category, title, documentPath, linkedPolicyIds, uploadDate, fileType',
      policyReferences: '++id, sourcePolicy, targetPolicy, relationship, strength, context, createdAt',
      scenarios: '++id, planId, name, description, parameters, results, createdAt, updatedAt',
      complianceChecks: '++id, applicationId, policyId, status, score, notes, checkedAt, assessorId'
    });

    this.documents = this.table('documents');
    this.chunks = this.table('chunks');
    this.policies = this.table('policies');
    this.constraints = this.table('constraints');
    this.materialConsiderations = this.table('materialConsiderations');
    this.assessments = this.table('assessments');
    this.evidence = this.table('evidence');
    this.spatialAnalysis = this.table('spatialAnalysis');
    this.contextCache = this.table('contextCache');
    this.assessmentHistory = this.table('assessmentHistory');
    this.localAuthorityData = this.table('localAuthorityData');
    this.extractedImages = this.table('extractedImages');
    this.visualAnalysis = this.table('visualAnalysis');
    
    // Local Plan Management tables (v4)
    if (this.tables.find(t => t.name === 'localPlans')) {
      this.localPlans = this.table('localPlans');
      this.localPlanPolicies = this.table('localPlanPolicies');
      this.siteAllocations = this.table('siteAllocations');
      this.evidenceBase = this.table('evidenceBase');
      this.policyReferences = this.table('policyReferences');
      this.scenarios = this.table('scenarios');
      this.complianceChecks = this.table('complianceChecks');
    }
    
    // Optional PlanIt tables (v2)
    if (this.tables.find(t => t.name === 'planitApplications')) {
      this.planitApplications = this.table('planitApplications');
    }
    if (this.tables.find(t => t.name === 'planitPolicies')) {
      this.planitPolicies = this.table('planitPolicies');
    }
    if (this.tables.find(t => t.name === 'govVectors')) {
      this.govVectors = this.table('govVectors');
    }
    if (this.tables.find(t => t.name === 'applicantVectors')) {
      this.applicantVectors = this.table('applicantVectors');
    }
  }

  async initialize() {
    await this.open();
    
    // Initialize material considerations if empty
    const count = await this.materialConsiderations.count();
    if (count === 0) {
      await this.seedMaterialConsiderations();
    }
    
    return this;
  }

  async upsertPlanItApplications(apps=[]) {
    if (!apps.length || !this.planitApplications) return 0;
    const mapped = apps.map(a => ({
  applicationId: a.name || a.id || a.uid || a.reference,
  reference: a.reference || a.name || a.uid,
  authority: a.area_name || a.authority || a.lpa || a.local_authority || '',
  receivedDate: a.start_date || a.received || a.received_date || null,
  status: a.app_state || a.status || a.stage || '',
      raw: a
    }));
    await this.planitApplications.bulkPut(mapped);
    return mapped.length;
  }

  async searchCachedApplications(query, limit=20) {
    if (!this.planitApplications) return [];
    const lower = query.toLowerCase();
    const all = await this.planitApplications.toArray();
    return all.filter(a => (
      (a.reference && a.reference.toLowerCase().includes(lower)) ||
      (a.authority && a.authority.toLowerCase().includes(lower))
    )).slice(0, limit);
  }

  async seedMaterialConsiderations() {
    const considerations = [
      // Statutory Framework
      { category: 'Statutory', subcategory: 'Development Plan', description: 'Compliance with adopted local plan policies', weight: 100, mandatory: true },
      { category: 'Statutory', subcategory: 'NPPF', description: 'National Planning Policy Framework compliance', weight: 100, mandatory: true },
      { category: 'Statutory', subcategory: 'Planning Practice Guidance', description: 'Government planning guidance compliance', weight: 80, mandatory: true },
      { category: 'Statutory', subcategory: 'Legal Obligations', description: 'S106 agreements and CIL requirements', weight: 90, mandatory: true },
      
      // Design and Character
      { category: 'Design', subcategory: 'Character and Appearance', description: 'Impact on character and appearance of area', weight: 85, mandatory: true },
      { category: 'Design', subcategory: 'Scale and Massing', description: 'Appropriateness of scale, height and massing', weight: 80, mandatory: false },
      { category: 'Design', subcategory: 'Materials and Details', description: 'Quality and appropriateness of materials', weight: 65, mandatory: false },
      { category: 'Design', subcategory: 'Architectural Quality', description: 'Architectural design quality and innovation', weight: 70, mandatory: false },
      { category: 'Design', subcategory: 'Public Realm', description: 'Contribution to public realm and streetscape', weight: 75, mandatory: false },
      
      // Transport and Access
      { category: 'Transport', subcategory: 'Highway Safety', description: 'Impact on highway and pedestrian safety', weight: 95, mandatory: true },
      { category: 'Transport', subcategory: 'Traffic Generation', description: 'Traffic generation and capacity impacts', weight: 85, mandatory: true },
      { category: 'Transport', subcategory: 'Parking Provision', description: 'Adequacy of parking provision', weight: 70, mandatory: false },
      { category: 'Transport', subcategory: 'Public Transport', description: 'Accessibility by public transport', weight: 80, mandatory: false },
      { category: 'Transport', subcategory: 'Cycling and Walking', description: 'Provision for cycling and walking', weight: 75, mandatory: false },
      { category: 'Transport', subcategory: 'Servicing and Delivery', description: 'Adequacy of servicing arrangements', weight: 60, mandatory: false },
      
      // Heritage and Conservation
      { category: 'Heritage', subcategory: 'Listed Buildings', description: 'Impact on listed buildings and their setting', weight: 100, mandatory: true },
      { category: 'Heritage', subcategory: 'Conservation Areas', description: 'Impact on conservation area character', weight: 95, mandatory: true },
      { category: 'Heritage', subcategory: 'Archaeological Heritage', description: 'Archaeological significance and impact', weight: 85, mandatory: false },
      { category: 'Heritage', subcategory: 'Non-designated Heritage', description: 'Impact on locally important heritage assets', weight: 70, mandatory: false },
      { category: 'Heritage', subcategory: 'Historic Landscape', description: 'Impact on historic landscape character', weight: 65, mandatory: false },
      
      // Environmental Factors
      { category: 'Environment', subcategory: 'Flood Risk', description: 'Flood risk assessment and mitigation', weight: 100, mandatory: true },
      { category: 'Environment', subcategory: 'Ecology and Biodiversity', description: 'Impact on ecology and biodiversity', weight: 90, mandatory: true },
      { category: 'Environment', subcategory: 'Trees and Landscaping', description: 'Impact on trees and landscape quality', weight: 75, mandatory: false },
      { category: 'Environment', subcategory: 'Contamination', description: 'Land contamination assessment', weight: 85, mandatory: false },
      { category: 'Environment', subcategory: 'Air Quality', description: 'Air quality impact assessment', weight: 70, mandatory: false },
      { category: 'Environment', subcategory: 'Noise and Vibration', description: 'Noise and vibration impact', weight: 65, mandatory: false },
      { category: 'Environment', subcategory: 'Sustainability', description: 'Environmental sustainability measures', weight: 80, mandatory: false },
      
      // Residential Amenity
      { category: 'Amenity', subcategory: 'Privacy and Overlooking', description: 'Impact on privacy and overlooking', weight: 85, mandatory: true },
      { category: 'Amenity', subcategory: 'Daylight and Sunlight', description: 'Daylight and sunlight impact assessment', weight: 80, mandatory: false },
      { category: 'Amenity', subcategory: 'Outlook and Enclosure', description: 'Impact on outlook and sense of enclosure', weight: 75, mandatory: false },
      { category: 'Amenity', subcategory: 'Noise and Disturbance', description: 'Noise and disturbance to neighbors', weight: 70, mandatory: false },
      { category: 'Amenity', subcategory: 'Garden and Amenity Space', description: 'Adequacy of private amenity space', weight: 65, mandatory: false },
      
      // Housing and Social
      { category: 'Housing', subcategory: 'Housing Need', description: 'Contribution to housing need and supply', weight: 90, mandatory: false },
      { category: 'Housing', subcategory: 'Affordable Housing', description: 'Affordable housing provision', weight: 95, mandatory: true },
      { category: 'Housing', subcategory: 'Housing Mix', description: 'Appropriateness of housing mix', weight: 75, mandatory: false },
      { category: 'Housing', subcategory: 'Housing Standards', description: 'Compliance with space and design standards', weight: 80, mandatory: true },
      { category: 'Housing', subcategory: 'Accessible Housing', description: 'Provision for accessible and adaptable housing', weight: 85, mandatory: true },
      
      // Economic Considerations
      { category: 'Economic', subcategory: 'Economic Benefits', description: 'Economic benefits and job creation', weight: 75, mandatory: false },
      { category: 'Economic', subcategory: 'Viability', description: 'Development viability and deliverability', weight: 80, mandatory: false },
      { category: 'Economic', subcategory: 'Town Centre Impact', description: 'Impact on town centre vitality', weight: 85, mandatory: false },
      { category: 'Economic', subcategory: 'Tourism Impact', description: 'Impact on tourism and local economy', weight: 60, mandatory: false },
      
      // Infrastructure and Services
      { category: 'Infrastructure', subcategory: 'Education Provision', description: 'Impact on school capacity and provision', weight: 80, mandatory: false },
      { category: 'Infrastructure', subcategory: 'Healthcare Provision', description: 'Impact on healthcare capacity', weight: 75, mandatory: false },
      { category: 'Infrastructure', subcategory: 'Utilities Capacity', description: 'Utilities infrastructure capacity', weight: 70, mandatory: false },
      { category: 'Infrastructure', subcategory: 'Waste Management', description: 'Waste management provision', weight: 65, mandatory: false },
      { category: 'Infrastructure', subcategory: 'Digital Infrastructure', description: 'Digital connectivity provision', weight: 55, mandatory: false },
      
      // Procedural and Legal
      { category: 'Procedural', subcategory: 'EIA Requirements', description: 'Environmental Impact Assessment requirements', weight: 100, mandatory: true },
      { category: 'Procedural', subcategory: 'Consultation Response', description: 'Statutory and public consultation responses', weight: 85, mandatory: true },
      { category: 'Procedural', subcategory: 'Planning History', description: 'Relevant planning history and precedents', weight: 70, mandatory: false },
      { category: 'Procedural', subcategory: 'Policy Compliance', description: 'Comprehensive policy compliance assessment', weight: 95, mandatory: true },
      
      // Climate and Resilience
      { category: 'Climate', subcategory: 'Climate Change Adaptation', description: 'Climate change adaptation measures', weight: 80, mandatory: false },
      { category: 'Climate', subcategory: 'Carbon Emissions', description: 'Carbon emissions and net zero contribution', weight: 75, mandatory: false },
      { category: 'Climate', subcategory: 'Renewable Energy', description: 'Renewable energy provision', weight: 70, mandatory: false },
      { category: 'Climate', subcategory: 'Water Management', description: 'Sustainable water management', weight: 75, mandatory: false },
      
      // Other Material Considerations
      { category: 'Other', subcategory: 'Human Rights', description: 'Human rights considerations', weight: 85, mandatory: true },
      { category: 'Other', subcategory: 'Equality and Diversity', description: 'Equality impact and accessibility', weight: 80, mandatory: true },
      { category: 'Other', subcategory: 'Crime Prevention', description: 'Crime prevention and community safety', weight: 65, mandatory: false },
      { category: 'Other', subcategory: 'Health and Wellbeing', description: 'Public health and wellbeing impacts', weight: 70, mandatory: false }
    ];

    await this.materialConsiderations.bulkAdd(considerations);
  }

  async storeDocument(file, metadata = {}) {
    const hash = await this.generateFileHash(file);
    
    // Check for duplicates
    const existing = await this.documents.where('hash').equals(hash).first();
    if (existing) {
      return existing.id;
    }

    const docData = {
      name: file.name,
      type: file.type,
      size: file.size,
      hash: hash,
      uploadDate: new Date(),
      ...metadata
    };

    return await this.documents.add(docData);
  }

  async storeChunks(documentId, chunks) {
    const chunkData = chunks.map((chunk, index) => ({
      documentId,
      content: chunk.content,
      embedding: chunk.embedding,
      metadata: chunk.metadata || {},
      chunkIndex: index,
      confidence: chunk.confidence || 1.0
    }));

    return await this.chunks.bulkAdd(chunkData);
  }

  async searchSimilarChunks(embedding, limit = 10, threshold = 0.5) {
    const allChunks = await this.chunks.toArray();
    
    const similarities = allChunks.map(chunk => ({
      ...chunk,
      similarity: this.cosineSimilarity(embedding, chunk.embedding)
    })).filter(chunk => chunk.similarity >= threshold);

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  // --- Dual Vector Store Methods ---
  async addGovernmentVectors(chunks=[]) {
    if (!this.govVectors || !chunks.length) return 0;
    const rows = chunks.map(c => ({
      source: c.metadata?.source || c.metadata?.file || 'unknown',
      authority: c.metadata?.authority || c.metadata?.localAuthority || c.metadata?.lpa || null,
      reference: c.metadata?.reference || c.metadata?.policyRef || null,
      content: c.content,
      embedding: c.embedding,
      metadata: c.metadata || {},
      role: 'government'
    }));
    await this.govVectors.bulkAdd(rows);
    return rows.length;
  }

  async addApplicantVectors(chunks=[]) {
    if (!this.applicantVectors || !chunks.length) return 0;
    const rows = chunks.map(c => ({
      source: c.metadata?.source || c.metadata?.file || 'unknown',
      applicationRef: c.metadata?.applicationRef || c.metadata?.reference || null,
      content: c.content,
      embedding: c.embedding,
      metadata: c.metadata || {},
      role: 'applicant'
    }));
    await this.applicantVectors.bulkAdd(rows);
    return rows.length;
  }

  async searchGovernmentVectors(queryEmbedding, { limit=12, threshold=0.5 }={}) {
    if (!this.govVectors) return [];
    const items = await this.govVectors.toArray();
    return items.map(it => ({
      content: it.content,
      similarity: this.cosineSimilarity(queryEmbedding, it.embedding||[]),
      metadata: it.metadata || {},
      role: 'government'
    })).filter(r => !Number.isNaN(r.similarity) && r.similarity >= threshold)
      .sort((a,b)=>b.similarity-a.similarity)
      .slice(0, limit);
  }

  async searchApplicantVectors(queryEmbedding, { limit=12, threshold=0.5 }={}) {
    if (!this.applicantVectors) return [];
    const items = await this.applicantVectors.toArray();
    return items.map(it => ({
      content: it.content,
      similarity: this.cosineSimilarity(queryEmbedding, it.embedding||[]),
      metadata: it.metadata || {},
      role: 'applicant'
    })).filter(r => !Number.isNaN(r.similarity) && r.similarity >= threshold)
      .sort((a,b)=>b.similarity-a.similarity)
      .slice(0, limit);
  }

  async storeEvidence(assessmentId, evidenceItems) {
    const evidenceData = evidenceItems.map(item => ({
      assessmentId,
      type: item.type,
      source: item.source,
      content: item.content,
      confidence: item.confidence,
      spatial: item.spatial || null,
      visual: item.visual || null,
      citation: item.citation || null
    }));

    return await this.evidence.bulkAdd(evidenceData);
  }

  async updateContextCache(key, value, embedding) {
    const existing = await this.contextCache.get(key);
    
    if (existing) {
      await this.contextCache.update(key, {
        value,
        embedding,
        accessCount: existing.accessCount + 1
      });
    } else {
      await this.contextCache.add({
        key,
        value,
        embedding,
        createdAt: new Date(),
        accessCount: 1
      });
    }
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

  async generateFileHash(file) {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

// Singleton instance for global access
let dbInstance = null;

export function getDatabase() {
  if (!dbInstance) {
    dbInstance = new Database();
  }
  return dbInstance;
}

export { Database };
