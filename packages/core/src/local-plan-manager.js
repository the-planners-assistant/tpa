import { getDatabase } from './database.js';
import { policyEmbeddingService } from './policy-embedding-service.js';

/**
/**
 * LocalPlanManager
 * Manages local plan documents, policies, site allocations, and evidence base
 */
export default class LocalPlanManager {
  constructor(db = getDatabase()) {
    this.db = db;
  }

  /**
   * Create a new local plan
   */
  async createLocalPlan({ name, authorityCode, adoptionDate, status = 'draft', version = '1.0' }) {
    const now = new Date().toISOString();
    
    const localPlan = {
      name,
      authorityCode,
      adoptionDate,
      status, // draft, consultation, examination, adopted
      version,
      documentIds: [],
      createdAt: now,
      updatedAt: now
    };

    const id = await this.db.localPlans.add(localPlan);
    return { ...localPlan, id };
  }

  /**
   * Get local plan by ID
   */
  async getLocalPlan(planId) {
    const plan = await this.db.localPlans.get(planId);
    if (!plan) return null;

    // Get associated policies, allocations, and evidence
    const [policies, allocations, evidence] = await Promise.all([
      this.db.localPlanPolicies.where('planId').equals(planId).toArray(),
      this.db.siteAllocations.where('planId').equals(planId).toArray(),
      this.db.evidenceBase.where('planId').equals(planId).toArray()
    ]);

    return {
      ...plan,
      policies,
      siteAllocations: allocations,
      evidenceBase: evidence
    };
  }

  /**
   * List all local plans
   */
  async listLocalPlans() {
    return await this.db.localPlans.orderBy('updatedAt').reverse().toArray();
  }

  /**
   * Update local plan
   */
  async updateLocalPlan(planId, updates) {
    const now = new Date().toISOString();
    await this.db.localPlans.update(planId, {
      ...updates,
      updatedAt: now
    });
    return await this.getLocalPlan(planId);
  }

  /**
   * Delete local plan and all associated data
   */
  async deleteLocalPlan(planId) {
    const [policies, allocations, evidence, scenarios] = await Promise.all([
      this.db.localPlanPolicies.where('planId').equals(planId).toArray(),
      this.db.siteAllocations.where('planId').equals(planId).toArray(),
      this.db.evidenceBase.where('planId').equals(planId).toArray(),
      this.db.scenarios.where('planId').equals(planId).toArray()
    ]);

    // Delete policy references involving these policies
    const policyIds = policies.map(p => p.id);
    await this.db.policyReferences
      .where('sourcePolicy').anyOf(policyIds)
      .or('targetPolicy').anyOf(policyIds)
      .delete();

    // Delete all associated data
    await Promise.all([
      this.db.localPlanPolicies.where('planId').equals(planId).delete(),
      this.db.siteAllocations.where('planId').equals(planId).delete(),
      this.db.evidenceBase.where('planId').equals(planId).delete(),
      this.db.scenarios.where('planId').equals(planId).delete(),
      this.db.localPlans.delete(planId)
    ]);

    return true;
  }

  /**
   * Add policy to local plan with semantic embeddings
   */
  async addPolicy(planId, policyData) {
    const {
      policyRef,
      title,
      category,
      content,
      requirements = [],
      crossReferences = [],
      evidenceIds = [],
      parentPolicy = null
    } = policyData;

    const policy = {
      planId,
      policyRef,
      title,
      category,
      content,
      requirements,
      crossReferences,
      evidenceIds,
      parentPolicy,
      createdAt: new Date().toISOString()
    };

    // Generate embeddings for semantic search
    try {
      console.log(`Generating embeddings for policy ${policyRef}...`);
      const embeddings = await policyEmbeddingService.generatePolicyEmbeddings(policyData);
      policy.embeddings = embeddings;
      
      // Add policy to database
      const policyId = await this.db.localPlanPolicies.add(policy);
      
      // Store individual embedding chunks for advanced search
      for (const embedding of embeddings) {
        await this.db.policyEmbeddings.add({
          policyId,
          ...embedding,
          createdAt: new Date().toISOString()
        });
      }
      
      console.log(`✅ Policy ${policyRef} added with ${embeddings.length} embedding chunks`);
      return { ...policy, id: policyId };
      
    } catch (error) {
      console.warn(`Failed to generate embeddings for policy ${policyRef}:`, error);
      
      // Still add the policy without embeddings
      const policyId = await this.db.localPlanPolicies.add(policy);
      return { ...policy, id: policyId };
    }
  }

  /**
   * Update policy
   */
  async updatePolicy(policyId, updates) {
    await this.db.localPlanPolicies.update(policyId, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
    return await this.db.localPlanPolicies.get(policyId);
  }

  /**
   * Delete policy and its references
   */
  async deletePolicy(policyId) {
    // Delete policy references
    await this.db.policyReferences
      .where('sourcePolicy').equals(policyId)
      .or('targetPolicy').equals(policyId)
      .delete();

    // Delete the policy
    await this.db.localPlanPolicies.delete(policyId);
    return true;
  }

  /**
   * Get policies for a local plan
   */
  async getPolicies(planId, category = null) {
    let query = this.db.localPlanPolicies.where('planId').equals(planId);
    
    if (category) {
      const policies = await query.toArray();
      return policies.filter(p => p.category === category);
    }
    
    return await query.toArray();
  }

  /**
   * Search policies by text
   */
  async searchPolicies(planId, searchText) {
    const policies = await this.db.localPlanPolicies.where('planId').equals(planId).toArray();
    const searchLower = searchText.toLowerCase();
    
    return policies.filter(policy => 
      policy.title.toLowerCase().includes(searchLower) ||
      policy.policyRef.toLowerCase().includes(searchLower) ||
      policy.content.toLowerCase().includes(searchLower)
    );
  }

  /**
   * Add site allocation
   */
  async addSiteAllocation(planId, allocationData) {
    const {
      siteRef,
      name,
      geometry,
      capacity,
      constraints = [],
      policyIds = [],
      status = 'proposed'
    } = allocationData;

    const allocation = {
      planId,
      siteRef,
      name,
      geometry,
      capacity,
      constraints,
      policyIds,
      status,
      createdAt: new Date().toISOString()
    };

    const id = await this.db.siteAllocations.add(allocation);
    return { ...allocation, id };
  }

  /**
   * Get site allocations for a local plan
   */
  async getSiteAllocations(planId) {
    return await this.db.siteAllocations.where('planId').equals(planId).toArray();
  }

  /**
   * Add evidence document
   */
  async addEvidence(planId, evidenceData) {
    const {
      category,
      title,
      documentPath,
      linkedPolicyIds = [],
      fileType
    } = evidenceData;

    const evidence = {
      planId,
      category,
      title,
      documentPath,
      linkedPolicyIds,
      fileType,
      uploadDate: new Date().toISOString()
    };

    const id = await this.db.evidenceBase.add(evidence);
    return { ...evidence, id };
  }

  /**
   * Get evidence base for a local plan
   */
  async getEvidenceBase(planId, category = null) {
    let query = this.db.evidenceBase.where('planId').equals(planId);
    
    if (category) {
      const evidence = await query.toArray();
      return evidence.filter(e => e.category === category);
    }
    
    return await query.toArray();
  }

  /**
   * Get policy hierarchy (parent-child relationships)
   */
  async getPolicyHierarchy(planId) {
    const policies = await this.getPolicies(planId);
    
    // Build hierarchy tree
    const policyMap = new Map(policies.map(p => [p.id, { ...p, children: [] }]));
    const rootPolicies = [];

    policies.forEach(policy => {
      const policyNode = policyMap.get(policy.id);
      if (policy.parentPolicy && policyMap.has(policy.parentPolicy)) {
        policyMap.get(policy.parentPolicy).children.push(policyNode);
      } else {
        rootPolicies.push(policyNode);
      }
    });

    return rootPolicies;
  }

  /**
   * Get policy statistics
   */
  async getPolicyStats(planId) {
    const [policies, allocations, evidence] = await Promise.all([
      this.getPolicies(planId),
      this.getSiteAllocations(planId),
      this.getEvidenceBase(planId)
    ]);

    const categories = {};
    policies.forEach(policy => {
      categories[policy.category] = (categories[policy.category] || 0) + 1;
    });

    return {
      totalPolicies: policies.length,
      totalAllocations: allocations.length,
      totalEvidence: evidence.length,
      categories,
      totalCapacity: allocations.reduce((sum, alloc) => sum + (alloc.capacity || 0), 0)
    };
  }

  /**
   * Search policies semantically using embeddings
   */
  async searchPoliciesSemantics(planId, queryText, options = {}) {
    const { topK = 5, categories = null, includeContent = true } = options;
    
    try {
      // Get all policies for the plan
      let policies = await this.db.localPlanPolicies.where('planId').equals(planId).toArray();
      
      // Filter by categories if specified
      if (categories && categories.length > 0) {
        policies = policies.filter(policy => categories.includes(policy.category));
      }
      
      // Use semantic search if embeddings available
      if (policies.some(p => p.embeddings && p.embeddings.length > 0)) {
        const results = await policyEmbeddingService.searchPolicies(queryText, policies, topK);
        
        return results.map(result => ({
          policy: includeContent ? result.policy : {
            id: result.policy.id,
            policyRef: result.policy.policyRef,
            title: result.policy.title,
            category: result.policy.category
          },
          similarity: result.similarity,
          matchingChunk: result.matchingChunk.chunk,
          chunkType: result.matchingChunk.chunkType
        }));
      } else {
        // Fallback to text search
        const lowercaseQuery = queryText.toLowerCase();
        const textResults = policies
          .filter(policy => 
            policy.title.toLowerCase().includes(lowercaseQuery) ||
            policy.content.toLowerCase().includes(lowercaseQuery) ||
            policy.policyRef.toLowerCase().includes(lowercaseQuery)
          )
          .slice(0, topK)
          .map(policy => ({
            policy: includeContent ? policy : {
              id: policy.id,
              policyRef: policy.policyRef,
              title: policy.title,
              category: policy.category
            },
            similarity: 0.5, // Default similarity for text search
            matchingChunk: policy.title,
            chunkType: 'text_search'
          }));
          
        return textResults;
      }
    } catch (error) {
      console.error('Policy search failed:', error);
      return [];
    }
  }

  /**
   * Get policy recommendations based on content similarity
   */
  async getRelatedPolicies(policyId, topK = 3) {
    try {
      const policy = await this.db.localPlanPolicies.get(policyId);
      if (!policy) return [];
      
      // Use the policy content as search query
      const searchQuery = `${policy.title} ${policy.content}`.substring(0, 500);
      const results = await this.searchPoliciesSemantics(policy.planId, searchQuery, { topK: topK + 1 });
      
      // Filter out the original policy and return related ones
      return results
        .filter(result => result.policy.id !== policyId)
        .slice(0, topK);
    } catch (error) {
      console.error('Failed to get related policies:', error);
      return [];
    }
  }
}
