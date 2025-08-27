import { getDatabase } from './database.js';

/**
 * PolicyEngine
 * Handles policy parsing, categorization, relationships, and conflict detection
 */
export default class PolicyEngine {
  constructor(db = getDatabase()) {
    this.db = db;
    this.policyCategories = [
      'housing',
      'employment',
      'retail',
      'transport',
      'environment',
      'heritage',
      'design',
      'infrastructure',
      'community',
      'general'
    ];
  }

  /**
   * Parse policy document and extract structured policies
   */
  async parsePolicyDocument(planId, documentContent, fileName) {
    const policies = [];
    
    try {
      // Split content into sections - basic parsing logic
      const sections = this._extractPolicySections(documentContent);
      
      for (const section of sections) {
        const policy = await this._parsePolicy(section, fileName);
        if (policy) {
          policies.push({
            planId,
            ...policy,
            sourceDocument: fileName
          });
        }
      }

      return policies;
    } catch (error) {
      console.error('Policy parsing failed:', error);
      throw new Error(`Failed to parse policy document: ${error.message}`);
    }
  }

  /**
   * Extract policy sections from document content
   */
  _extractPolicySections(content) {
    const sections = [];
    
    // Look for policy patterns (e.g., "Policy H1:", "H1.", "1.1", etc.)
    const policyRegex = /(?:Policy\s+)?([A-Z]+\d+(?:\.\d+)*)[:\.]?\s*([^\n]+)\n((?:[^\n]*\n)*?)(?=(?:Policy\s+)?[A-Z]+\d+(?:\.\d+)*[:\.]|$)/gi;
    
    let match;
    while ((match = policyRegex.exec(content)) !== null) {
      const [, reference, title, text] = match;
      
      sections.push({
        reference: reference.trim(),
        title: title.trim(),
        content: text.trim(),
        fullMatch: match[0]
      });
    }

    // If no structured policies found, try paragraph-based splitting
    if (sections.length === 0) {
      const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 50);
      paragraphs.forEach((paragraph, index) => {
        sections.push({
          reference: `PARA_${index + 1}`,
          title: this._extractTitle(paragraph),
          content: paragraph.trim(),
          fullMatch: paragraph
        });
      });
    }

    return sections;
  }

  /**
   * Parse individual policy section
   */
  async _parsePolicy(section, sourceDocument) {
    const { reference, title, content } = section;
    
    if (!reference || !content || content.length < 20) {
      return null;
    }

    // Categorize policy
    const category = this._categorizePolicy(title, content);
    
    // Extract cross-references
    const crossReferences = this._extractCrossReferences(content);
    
    // Extract evidence references
    const evidenceReferences = this._extractEvidenceReferences(content);

    return {
      policyRef: reference,
      title: title || `Policy ${reference}`,
      category,
      content,
      crossReferences,
      evidenceReferences,
      sourceDocument,
      extractedAt: new Date().toISOString()
    };
  }

  /**
   * Categorize policy based on content
   */
  _categorizePolicy(title, content) {
    const text = (title + ' ' + content).toLowerCase();
    
    const categoryPatterns = {
      housing: /\b(housing|residential|dwelling|affordable|homes?)\b/,
      employment: /\b(employment|office|industrial|business|economic|jobs?)\b/,
      retail: /\b(retail|shopping|commercial|town centre|high street)\b/,
      transport: /\b(transport|traffic|parking|highway|accessibility|sustainable travel)\b/,
      environment: /\b(environment|green|sustainable|climate|biodiversity|ecology)\b/,
      heritage: /\b(heritage|historic|conservation|listed|character)\b/,
      design: /\b(design|layout|scale|massing|appearance|architecture)\b/,
      infrastructure: /\b(infrastructure|utilities|drainage|flood|water|energy)\b/,
      community: /\b(community|social|education|health|recreation|open space)\b/
    };

    for (const [category, pattern] of Object.entries(categoryPatterns)) {
      if (pattern.test(text)) {
        return category;
      }
    }

    return 'general';
  }

  /**
   * Extract cross-references to other policies
   */
  _extractCrossReferences(content) {
    const references = [];
    
    // Look for policy references (e.g., "Policy H1", "H1", "1.1", etc.)
    const refRegex = /(?:Policy\s+)?([A-Z]+\d+(?:\.\d+)*)\b/gi;
    
    let match;
    while ((match = refRegex.exec(content)) !== null) {
      const ref = match[1].trim();
      if (!references.includes(ref)) {
        references.push(ref);
      }
    }

    return references;
  }

  /**
   * Extract evidence document references
   */
  _extractEvidenceReferences(content) {
    const references = [];
    
    // Look for document references
    const patterns = [
      /\b([A-Z][a-z]+\s+(?:Study|Assessment|Strategy|Plan|Report|Evidence))\b/g,
      /\b(SHMA|SHLAA|HELAA|SA|SEA|HRA|SFRA)\b/g,
      /\b([A-Z]{2,}\s+\d{4})\b/g
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const ref = match[1] || match[0];
        if (!references.includes(ref)) {
          references.push(ref);
        }
      }
    });

    return references;
  }

  /**
   * Extract title from paragraph
   */
  _extractTitle(paragraph) {
    const firstLine = paragraph.split('\n')[0];
    
    // If first line is short and likely a title
    if (firstLine.length < 100 && firstLine.length > 5) {
      return firstLine.trim();
    }
    
    // Extract first sentence as title
    const firstSentence = paragraph.split(/[.!?]/)[0];
    if (firstSentence.length < 150) {
      return firstSentence.trim();
    }
    
    // Fallback to first 50 characters
    return paragraph.substring(0, 50).trim() + '...';
  }

  /**
   * Create policy relationships
   */
  async createPolicyReference(sourcePolicy, targetPolicy, relationship, strength = 1.0, context = '') {
    const reference = {
      sourcePolicy,
      targetPolicy,
      relationship, // 'supports', 'conflicts', 'references', 'supersedes', 'implements'
      strength, // 0.0 to 1.0
      context,
      createdAt: new Date().toISOString()
    };

    const id = await this.db.policyReferences.add(reference);
    return { ...reference, id };
  }

  /**
   * Get policy relationships
   */
  async getPolicyReferences(policyId) {
    const [outgoing, incoming] = await Promise.all([
      this.db.policyReferences.where('sourcePolicy').equals(policyId).toArray(),
      this.db.policyReferences.where('targetPolicy').equals(policyId).toArray()
    ]);

    return {
      outgoing,
      incoming,
      total: outgoing.length + incoming.length
    };
  }

  /**
   * Detect policy conflicts
   */
  async detectConflicts(planId) {
    const policies = await this.db.localPlanPolicies.where('planId').equals(planId).toArray();
    const conflicts = [];

    // Simple conflict detection based on content analysis
    for (let i = 0; i < policies.length; i++) {
      for (let j = i + 1; j < policies.length; j++) {
        const conflict = this._analyzeConflict(policies[i], policies[j]);
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * Analyze potential conflict between two policies
   */
  _analyzeConflict(policy1, policy2) {
    // Check for conflicting keywords
    const conflictPatterns = [
      { pattern1: /\bmust\s+not\b/, pattern2: /\bmust\b/, type: 'requirement_conflict' },
      { pattern1: /\bprohibited\b/, pattern2: /\brequired\b/, type: 'prohibition_conflict' },
      { pattern1: /\bmaximum\s+(\d+)/, pattern2: /\bminimum\s+(\d+)/, type: 'threshold_conflict' }
    ];

    for (const { pattern1, pattern2, type } of conflictPatterns) {
      const match1 = pattern1.test(policy1.content.toLowerCase());
      const match2 = pattern2.test(policy2.content.toLowerCase());
      
      if (match1 && match2) {
        return {
          type,
          policy1: policy1.id,
          policy2: policy2.id,
          severity: 'medium',
          description: `Potential ${type.replace('_', ' ')} between ${policy1.policyRef} and ${policy2.policyRef}`,
          detectedAt: new Date().toISOString()
        };
      }
    }

    return null;
  }

  /**
   * Auto-link policies based on cross-references
   */
  async autoLinkPolicies(planId) {
    const policies = await this.db.localPlanPolicies.where('planId').equals(planId).toArray();
    const policyMap = new Map(policies.map(p => [p.policyRef, p.id]));
    const links = [];

    for (const policy of policies) {
      if (policy.crossReferences) {
        for (const ref of policy.crossReferences) {
          const targetId = policyMap.get(ref);
          if (targetId && targetId !== policy.id) {
            try {
              const link = await this.createPolicyReference(
                policy.id,
                targetId,
                'references',
                0.8,
                `Auto-detected reference in ${policy.policyRef}`
              );
              links.push(link);
            } catch (error) {
              // Link might already exist, continue
            }
          }
        }
      }
    }

    return links;
  }

  /**
   * Get policy network for visualization
   */
  async getPolicyNetwork(planId) {
    const [policies, references] = await Promise.all([
      this.db.localPlanPolicies.where('planId').equals(planId).toArray(),
      this.db.policyReferences.toArray()
    ]);

    const policyIds = new Set(policies.map(p => p.id));
    const filteredRefs = references.filter(ref => 
      policyIds.has(ref.sourcePolicy) && policyIds.has(ref.targetPolicy)
    );

    return {
      nodes: policies.map(policy => ({
        id: policy.id,
        label: policy.policyRef,
        title: policy.title,
        category: policy.category,
        size: (policy.content?.length || 0) / 100
      })),
      edges: filteredRefs.map(ref => ({
        from: ref.sourcePolicy,
        to: ref.targetPolicy,
        label: ref.relationship,
        width: ref.strength * 3,
        color: this._getRelationshipColor(ref.relationship)
      }))
    };
  }

  /**
   * Get color for relationship type
   */
  _getRelationshipColor(relationship) {
    const colors = {
      supports: '#4ade80',
      conflicts: '#ef4444',
      references: '#3b82f6',
      supersedes: '#f59e0b',
      implements: '#8b5cf6'
    };
    return colors[relationship] || '#6b7280';
  }

  /**
   * Validate policy compliance
   */
  async validateCompliance(applicationData, planId) {
    const policies = await this.db.localPlanPolicies.where('planId').equals(planId).toArray();
    const compliance = [];

    for (const policy of policies) {
      const result = this._checkPolicyCompliance(policy, applicationData);
      compliance.push({
        policyId: policy.id,
        policyRef: policy.policyRef,
        status: result.status,
        score: result.score,
        notes: result.notes,
        category: policy.category
      });
    }

    return compliance;
  }

  /**
   * Check compliance of application against specific policy
   */
  _checkPolicyCompliance(policy, applicationData) {
    // Basic compliance checking - can be enhanced with AI
    const content = policy.content.toLowerCase();
    const appText = JSON.stringify(applicationData).toLowerCase();

    let score = 0.5; // Neutral by default
    let notes = [];
    let status = 'unknown';

    // Check for explicit requirements
    if (content.includes('must') || content.includes('required')) {
      // Look for compliance indicators in application
      if (appText.includes(policy.category)) {
        score += 0.2;
        notes.push(`Application addresses ${policy.category} requirements`);
      }
    }

    // Determine status
    if (score >= 0.8) status = 'compliant';
    else if (score >= 0.6) status = 'likely_compliant';
    else if (score >= 0.4) status = 'unclear';
    else if (score >= 0.2) status = 'likely_non_compliant';
    else status = 'non_compliant';

    return {
      status,
      score,
      notes: notes.join('; ') || 'No specific compliance indicators found'
    };
  }
}
