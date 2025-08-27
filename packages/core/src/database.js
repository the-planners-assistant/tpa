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
