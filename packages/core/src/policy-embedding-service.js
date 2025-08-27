/**
 * Policy Embedding Service
 * Generates semantic embeddings for local plan policies to enable AI-powered retrieval
 */

export class PolicyEmbeddingService {
  constructor() {
    this.embedder = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the embedding pipeline
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      const { pipeline, env } = await import('@xenova/transformers');
      
      // Configure for browser environment
      env.allowRemoteModels = true;
      env.allowLocalModels = false;
      
      // Use a smaller, efficient model for embeddings
      this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      this.isInitialized = true;
      
      console.log('✅ Policy embedding service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize policy embedding service:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for policy content
   * Splits large policies into chunks for better retrieval
   */
  async generatePolicyEmbeddings(policyData) {
    await this.initialize();

    const { policyRef, title, content, category, requirements = [], crossReferences = [] } = policyData;
    
    // Create chunks of the policy content for better retrieval
    const chunks = this._createPolicyChunks(policyData);
    const embeddings = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        // Generate embedding for this chunk
        const embedding = await this.embedder(chunk.text, { pooling: 'mean', normalize: true });
        
        embeddings.push({
          chunk: chunk.text,
          embedding: Array.from(embedding.data),
          chunkIndex: i,
          chunkType: chunk.type,
          metadata: {
            policyRef,
            title,
            category,
            chunkLength: chunk.text.length,
            keywords: chunk.keywords || []
          }
        });
      } catch (error) {
        console.warn(`Failed to generate embedding for chunk ${i} of policy ${policyRef}:`, error);
      }
    }

    return embeddings;
  }

  /**
   * Create semantic chunks from policy content
   */
  _createPolicyChunks(policyData) {
    const { policyRef, title, content, category, requirements = [], crossReferences = [] } = policyData;
    const chunks = [];

    // Chunk 1: Policy header (title + category + reference)
    const headerText = `Policy ${policyRef}: ${title}. Category: ${category}.`;
    chunks.push({
      type: 'header',
      text: headerText,
      keywords: [category, policyRef]
    });

    // Chunk 2: Main content (split if very long)
    const maxChunkSize = 512; // tokens approximately
    if (content.length <= maxChunkSize * 4) { // rough char to token conversion
      chunks.push({
        type: 'content',
        text: `${title}. ${content}`,
        keywords: this._extractKeywords(content)
      });
    } else {
      // Split long content into smaller chunks
      const sentences = content.split(/[.!?]+\s+/);
      let currentChunk = title + '. ';
      let chunkIndex = 0;

      for (const sentence of sentences) {
        if ((currentChunk + sentence).length > maxChunkSize * 4) {
          if (currentChunk.trim().length > title.length + 2) {
            chunks.push({
              type: 'content',
              text: currentChunk.trim(),
              keywords: this._extractKeywords(currentChunk),
              subChunkIndex: chunkIndex++
            });
          }
          currentChunk = title + '. ' + sentence + '. ';
        } else {
          currentChunk += sentence + '. ';
        }
      }

      // Add final chunk
      if (currentChunk.trim().length > title.length + 2) {
        chunks.push({
          type: 'content',
          text: currentChunk.trim(),
          keywords: this._extractKeywords(currentChunk),
          subChunkIndex: chunkIndex
        });
      }
    }

    // Chunk 3: Requirements (if any)
    if (requirements.length > 0) {
      const requirementsText = `${title} requirements: ${requirements.join('; ')}.`;
      chunks.push({
        type: 'requirements',
        text: requirementsText,
        keywords: ['requirements', 'criteria', 'standards']
      });
    }

    // Chunk 4: Cross-references (if any)
    if (crossReferences.length > 0) {
      const referencesText = `${title} relates to: ${crossReferences.join(', ')}.`;
      chunks.push({
        type: 'references',
        text: referencesText,
        keywords: ['policy', 'cross-reference', ...crossReferences]
      });
    }

    return chunks;
  }

  /**
   * Extract keywords from text for enhanced retrieval
   */
  _extractKeywords(text) {
    const keywords = [];
    
    // Planning-specific terms
    const planningTerms = [
      'development', 'planning', 'application', 'permission', 'consent',
      'housing', 'residential', 'commercial', 'industrial', 'retail',
      'transport', 'highway', 'parking', 'accessibility', 'sustainable',
      'design', 'character', 'conservation', 'heritage', 'listed',
      'environment', 'green', 'biodiversity', 'flooding', 'drainage',
      'infrastructure', 'utilities', 'services', 'community', 'facilities'
    ];

    for (const term of planningTerms) {
      if (new RegExp(`\\b${term}\\b`, 'i').test(text)) {
        keywords.push(term);
      }
    }

    return keywords;
  }

  /**
   * Search for similar policies using semantic similarity
   */
  async searchPolicies(queryText, policies, topK = 5) {
    await this.initialize();

    try {
      // Generate embedding for the query
      const queryEmbedding = await this.embedder(queryText, { pooling: 'mean', normalize: true });
      const queryVector = Array.from(queryEmbedding.data);

      // Calculate similarity with all policy embeddings
      const similarities = [];

      for (const policy of policies) {
        if (policy.embeddings && policy.embeddings.length > 0) {
          // Find the best matching chunk for this policy
          let bestSimilarity = -1;
          let bestChunk = null;

          for (const embedding of policy.embeddings) {
            const similarity = this._cosineSimilarity(queryVector, embedding.embedding);
            if (similarity > bestSimilarity) {
              bestSimilarity = similarity;
              bestChunk = embedding;
            }
          }

          if (bestChunk) {
            similarities.push({
              policy,
              similarity: bestSimilarity,
              matchingChunk: bestChunk
            });
          }
        }
      }

      // Sort by similarity and return top K
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);

    } catch (error) {
      console.error('Policy search failed:', error);
      return [];
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  _cosineSimilarity(a, b) {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

// Export singleton instance
export const policyEmbeddingService = new PolicyEmbeddingService();
