import { getDatabase } from './database.js';

/**
 * KnowledgeGraph
 * Manages cross-references, evidence linkage, and regulatory framework mapping
 */
export default class KnowledgeGraph {
  constructor(db = getDatabase()) {
    this.db = db;
    this.relationshipTypes = [
      'supports',
      'conflicts',
      'references',
      'supersedes',
      'implements',
      'requires',
      'informs',
      'contradicts'
    ];
  }

  /**
   * Build comprehensive knowledge graph for a local plan
   */
  async buildGraph(planId) {
    const [policies, evidence, allocations, references] = await Promise.all([
      this.db.localPlanPolicies.where('planId').equals(planId).toArray(),
      this.db.evidenceBase.where('planId').equals(planId).toArray(),
      this.db.siteAllocations.where('planId').equals(planId).toArray(),
      this.db.policyReferences.toArray()
    ]);

    const graph = {
      nodes: [],
      edges: [],
      clusters: {},
      metadata: {
        planId,
        nodeCount: 0,
        edgeCount: 0,
        generated: new Date().toISOString()
      }
    };

    // Add policy nodes
    policies.forEach(policy => {
      graph.nodes.push({
        id: `policy_${policy.id}`,
        type: 'policy',
        label: policy.policyRef,
        title: policy.title,
        category: policy.category,
        content: policy.content,
        size: Math.min(Math.max(policy.content?.length || 0, 100), 1000) / 50,
        color: this._getCategoryColor(policy.category)
      });
    });

    // Add evidence nodes
    evidence.forEach(doc => {
      graph.nodes.push({
        id: `evidence_${doc.id}`,
        type: 'evidence',
        label: doc.title,
        category: doc.category,
        fileType: doc.fileType,
        size: 20,
        color: '#f59e0b'
      });
    });

    // Add site allocation nodes
    allocations.forEach(site => {
      graph.nodes.push({
        id: `site_${site.id}`,
        type: 'site',
        label: site.siteRef,
        title: site.name,
        capacity: site.capacity,
        size: Math.max(site.capacity || 0, 10) / 10,
        color: '#10b981'
      });
    });

    // Add policy reference edges
    const policyIds = new Set(policies.map(p => p.id));
    references
      .filter(ref => policyIds.has(ref.sourcePolicy) && policyIds.has(ref.targetPolicy))
      .forEach(ref => {
        graph.edges.push({
          id: `ref_${ref.id}`,
          from: `policy_${ref.sourcePolicy}`,
          to: `policy_${ref.targetPolicy}`,
          type: 'policy_reference',
          relationship: ref.relationship,
          strength: ref.strength,
          context: ref.context,
          width: ref.strength * 3,
          color: this._getRelationshipColor(ref.relationship)
        });
      });

    // Add evidence-policy links
    evidence.forEach(doc => {
      if (doc.linkedPolicyIds && doc.linkedPolicyIds.length > 0) {
        doc.linkedPolicyIds.forEach(policyId => {
          if (policyIds.has(policyId)) {
            graph.edges.push({
              id: `evidence_${doc.id}_policy_${policyId}`,
              from: `evidence_${doc.id}`,
              to: `policy_${policyId}`,
              type: 'evidence_link',
              relationship: 'supports',
              width: 2,
              color: '#94a3b8'
            });
          }
        });
      }
    });

    // Add site-policy links
    allocations.forEach(site => {
      if (site.policyIds && site.policyIds.length > 0) {
        site.policyIds.forEach(policyId => {
          if (policyIds.has(policyId)) {
            graph.edges.push({
              id: `site_${site.id}_policy_${policyId}`,
              from: `site_${site.id}`,
              to: `policy_${policyId}`,
              type: 'allocation_link',
              relationship: 'implements',
              width: 2,
              color: '#16a34a'
            });
          }
        });
      }
    });

    // Create category clusters
    const categories = [...new Set(policies.map(p => p.category))];
    categories.forEach(category => {
      graph.clusters[category] = {
        label: category,
        color: this._getCategoryColor(category),
        nodes: policies
          .filter(p => p.category === category)
          .map(p => `policy_${p.id}`)
      };
    });

    graph.metadata.nodeCount = graph.nodes.length;
    graph.metadata.edgeCount = graph.edges.length;

    return graph;
  }

  /**
   * Find policy conflicts in the knowledge graph
   */
  async findConflicts(planId) {
    const graph = await this.buildGraph(planId);
    const conflicts = [];

    // Look for conflict relationships
    const conflictEdges = graph.edges.filter(edge => 
      edge.relationship === 'conflicts' || edge.relationship === 'contradicts'
    );

    for (const edge of conflictEdges) {
      const sourceNode = graph.nodes.find(n => n.id === edge.from);
      const targetNode = graph.nodes.find(n => n.id === edge.to);

      if (sourceNode && targetNode) {
        conflicts.push({
          type: 'explicit_conflict',
          source: sourceNode,
          target: targetNode,
          relationship: edge.relationship,
          severity: edge.strength || 0.5,
          context: edge.context || ''
        });
      }
    }

    // Detect implicit conflicts through content analysis
    const policyNodes = graph.nodes.filter(n => n.type === 'policy');
    for (let i = 0; i < policyNodes.length; i++) {
      for (let j = i + 1; j < policyNodes.length; j++) {
        const conflict = this._detectImplicitConflict(policyNodes[i], policyNodes[j]);
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * Detect implicit conflicts between policies
   */
  _detectImplicitConflict(policy1, policy2) {
    if (!policy1.content || !policy2.content) return null;

    const content1 = policy1.content.toLowerCase();
    const content2 = policy2.content.toLowerCase();

    // Look for contradictory statements
    const conflictPatterns = [
      {
        pattern1: /\b(must|shall|required|mandatory)\s+(\w+)/g,
        pattern2: /\b(must\s+not|shall\s+not|prohibited|forbidden)\s+(\w+)/g,
        type: 'requirement_prohibition'
      },
      {
        pattern1: /\bmaximum\s+(\d+)/g,
        pattern2: /\bminimum\s+(\d+)/g,
        type: 'threshold_conflict'
      }
    ];

    for (const { pattern1, pattern2, type } of conflictPatterns) {
      const matches1 = [...content1.matchAll(pattern1)];
      const matches2 = [...content2.matchAll(pattern2)];

      if (matches1.length > 0 && matches2.length > 0) {
        // Check if they're talking about the same thing
        const keywords1 = matches1.map(m => m[2] || m[1]).filter(Boolean);
        const keywords2 = matches2.map(m => m[2] || m[1]).filter(Boolean);

        const commonKeywords = keywords1.filter(k1 => 
          keywords2.some(k2 => this._similarWords(k1, k2))
        );

        if (commonKeywords.length > 0) {
          return {
            type: 'implicit_conflict',
            source: policy1,
            target: policy2,
            conflictType: type,
            commonKeywords,
            severity: 0.7,
            context: `Potential conflict detected around: ${commonKeywords.join(', ')}`
          };
        }
      }
    }

    return null;
  }

  /**
   * Check if two words are similar (simple similarity check)
   */
  _similarWords(word1, word2) {
    if (word1 === word2) return true;
    if (word1.includes(word2) || word2.includes(word1)) return true;
    
    // Simple Levenshtein distance check
    const distance = this._levenshteinDistance(word1, word2);
    return distance <= Math.min(word1.length, word2.length) * 0.3;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  _levenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill().map(() => Array(str1.length + 1).fill(0));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Get policy pathway for application assessment
   */
  async getPolicyPathway(planId, applicationCategory) {
    const policies = await this.db.localPlanPolicies.where('planId').equals(planId).toArray();
    const relevantPolicies = policies.filter(policy => 
      policy.category === applicationCategory ||
      policy.category === 'general' ||
      policy.content.toLowerCase().includes(applicationCategory)
    );

    // Build pathway based on policy hierarchy and references
    const pathway = {
      primary: relevantPolicies.filter(p => p.category === applicationCategory),
      supporting: relevantPolicies.filter(p => p.category !== applicationCategory),
      order: []
    };

    // Simple ordering based on policy references
    const ordered = this._topologicalSort(relevantPolicies);
    pathway.order = ordered.map(p => p.id);

    return pathway;
  }

  /**
   * Simple topological sort for policy ordering
   */
  _topologicalSort(policies) {
    // For now, just order by policy reference
    return policies.sort((a, b) => a.policyRef.localeCompare(b.policyRef));
  }

  /**
   * Get category color for visualization
   */
  _getCategoryColor(category) {
    const colors = {
      housing: '#ef4444',
      employment: '#3b82f6',
      retail: '#f59e0b',
      transport: '#8b5cf6',
      environment: '#10b981',
      heritage: '#f97316',
      design: '#ec4899',
      infrastructure: '#6b7280',
      community: '#14b8a6',
      general: '#64748b'
    };
    return colors[category] || '#9ca3af';
  }

  /**
   * Get relationship color
   */
  _getRelationshipColor(relationship) {
    const colors = {
      supports: '#22c55e',
      conflicts: '#ef4444',
      references: '#3b82f6',
      supersedes: '#f59e0b',
      implements: '#8b5cf6',
      requires: '#dc2626',
      informs: '#06b6d4',
      contradicts: '#b91c1c'
    };
    return colors[relationship] || '#6b7280';
  }

  /**
   * Export graph for external visualization tools
   */
  async exportGraph(planId, format = 'json') {
    const graph = await this.buildGraph(planId);

    switch (format) {
      case 'json':
        return JSON.stringify(graph, null, 2);
      
      case 'graphml':
        return this._exportGraphML(graph);
      
      case 'dot':
        return this._exportDOT(graph);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export to GraphML format
   */
  _exportGraphML(graph) {
    let graphml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    graphml += '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">\n';
    graphml += '  <graph id="G" edgedefault="directed">\n';

    // Add nodes
    graph.nodes.forEach(node => {
      graphml += `    <node id="${node.id}">\n`;
      graphml += `      <data key="label">${node.label}</data>\n`;
      graphml += `      <data key="type">${node.type}</data>\n`;
      graphml += `    </node>\n`;
    });

    // Add edges
    graph.edges.forEach(edge => {
      graphml += `    <edge source="${edge.from}" target="${edge.to}">\n`;
      graphml += `      <data key="relationship">${edge.relationship}</data>\n`;
      graphml += `    </edge>\n`;
    });

    graphml += '  </graph>\n';
    graphml += '</graphml>';

    return graphml;
  }

  /**
   * Export to DOT format (Graphviz)
   */
  _exportDOT(graph) {
    let dot = 'digraph LocalPlan {\n';
    dot += '  rankdir=TB;\n';
    dot += '  node [shape=box];\n';

    // Add nodes
    graph.nodes.forEach(node => {
      dot += `  "${node.id}" [label="${node.label}", color="${node.color}"];\n`;
    });

    // Add edges
    graph.edges.forEach(edge => {
      dot += `  "${edge.from}" -> "${edge.to}" [label="${edge.relationship}"];\n`;
    });

    dot += '}';
    return dot;
  }
}
