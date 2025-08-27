/**
 * Planning Data API Client
 * Integrates with planning.data.gov.uk API for official UK planning constraints
 */
class PlanningDataAPI {
  constructor() {
    this.baseUrl = 'https://www.planning.data.gov.uk';
    this.cache = new Map();
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Get available datasets from planning.data.gov.uk
   */
  async getDatasets() {
    const cacheKey = 'datasets';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const response = await fetch(`${this.baseUrl}/dataset.json`);
      const datasets = await response.json();
      
      this.cache.set(cacheKey, {
        data: datasets,
        timestamp: Date.now()
      });
      
      return datasets;
    } catch (error) {
      console.error('Failed to fetch datasets:', error);
      return [];
    }
  }

  /**
   * Search entities by location (lat/lng)
   */
  async searchByLocation(latitude, longitude, datasets = null, limit = 100) {
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      limit: limit.toString()
    });

    if (datasets && datasets.length > 0) {
      datasets.forEach(dataset => params.append('dataset', dataset));
    }

    try {
      const response = await fetch(`${this.baseUrl}/entity.json?${params}`);
      const result = await response.json();
      return result.entities || [];
    } catch (error) {
      console.error('Failed to search by location:', error);
      return [];
    }
  }

  /**
   * Search entities by geometry (WKT format)
   */
  async searchByGeometry(geometry, datasets = null, relation = 'intersects', limit = 100) {
    const params = new URLSearchParams({
      geometry: geometry,
      geometry_relation: relation,
      limit: limit.toString()
    });

    if (datasets && datasets.length > 0) {
      datasets.forEach(dataset => params.append('dataset', dataset));
    }

    try {
      const response = await fetch(`${this.baseUrl}/entity.json?${params}`);
      const result = await response.json();
      return result.entities || [];
    } catch (error) {
      console.error('Failed to search by geometry:', error);
      return [];
    }
  }

  /**
   * Get specific entity by ID
   */
  async getEntity(entityId) {
    try {
      const response = await fetch(`${this.baseUrl}/entity/${entityId}.json`);
      return await response.json();
    } catch (error) {
      console.error(`Failed to get entity ${entityId}:`, error);
      return null;
    }
  }

  /**
   * Get entities for specific datasets
   */
  async getDatasetEntities(dataset, limit = 500, offset = 0) {
    const params = new URLSearchParams({
      dataset: dataset,
      limit: limit.toString(),
      offset: offset.toString()
    });

    try {
      const response = await fetch(`${this.baseUrl}/entity.json?${params}`);
      const result = await response.json();
      return result.entities || [];
    } catch (error) {
      console.error(`Failed to get entities for dataset ${dataset}:`, error);
      return [];
    }
  }

  /**
   * Get constraint data for a site
   */
  async getConstraintsForSite(latitude, longitude, buffer = 1000) {
    const constraintDatasets = [
      'conservation-area',
      'listed-building',
      'article-4-direction',
      'tree-preservation-order',
      'flood-risk-zone',
      'ancient-woodland',
      'green-belt',
      'scheduled-monument',
      'world-heritage-site',
      'special-protection-area',
      'special-area-of-conservation',
      'site-of-special-scientific-interest',
      'national-park',
      'area-of-outstanding-natural-beauty'
    ];

    try {
      const constraints = await this.searchByLocation(
        latitude, 
        longitude, 
        constraintDatasets,
        200
      );

      // Process and categorize constraints
      return this.processConstraints(constraints, latitude, longitude);
    } catch (error) {
      console.error('Failed to get constraints:', error);
      return [];
    }
  }

  /**
   * Process and categorize constraint data
   */
  processConstraints(constraints, siteLat, siteLng) {
    return constraints.map(constraint => {
      const category = this.categorizeConstraint(constraint.dataset);
      const severity = this.assessConstraintSeverity(constraint.dataset);
      
      // Calculate distance if not intersecting
      let distance = 0;
      if (constraint.geometry && constraint.geometry.type) {
        distance = this.calculateDistance(siteLat, siteLng, constraint);
      }

      return {
        id: constraint.entity,
        name: constraint.name || constraint.reference || `${constraint.dataset} ${constraint.entity}`,
        type: constraint.dataset,
        category,
        severity,
        distance,
        geometry: constraint.geometry,
        properties: constraint,
        source: 'planning.data.gov.uk',
        relevantPolicies: this.getRelevantPolicies(constraint.dataset)
      };
    });
  }

  /**
   * Categorize constraints by planning significance
   */
  categorizeConstraint(dataset) {
    const categories = {
      'heritage': [
        'conservation-area', 'listed-building', 'scheduled-monument', 
        'world-heritage-site', 'historic-park-garden'
      ],
      'environmental': [
        'special-protection-area', 'special-area-of-conservation',
        'site-of-special-scientific-interest', 'ancient-woodland',
        'flood-risk-zone'
      ],
      'landscape': [
        'national-park', 'area-of-outstanding-natural-beauty', 'green-belt'
      ],
      'regulatory': [
        'article-4-direction', 'tree-preservation-order'
      ]
    };

    for (const [category, datasets] of Object.entries(categories)) {
      if (datasets.includes(dataset)) return category;
    }
    return 'other';
  }

  /**
   * Assess constraint severity for planning purposes
   */
  assessConstraintSeverity(dataset) {
    const severityMap = {
      'world-heritage-site': 'critical',
      'scheduled-monument': 'critical',
      'listed-building': 'high',
      'conservation-area': 'high',
      'green-belt': 'high',
      'flood-risk-zone': 'high',
      'special-protection-area': 'medium',
      'special-area-of-conservation': 'medium',
      'site-of-special-scientific-interest': 'medium',
      'national-park': 'medium',
      'area-of-outstanding-natural-beauty': 'medium',
      'ancient-woodland': 'medium',
      'article-4-direction': 'medium',
      'tree-preservation-order': 'low'
    };

    return severityMap[dataset] || 'low';
  }

  /**
   * Get relevant NPPF policies for constraint type
   */
  getRelevantPolicies(dataset) {
    const policyMap = {
      'conservation-area': ['NPPF 199', 'NPPF 200', 'NPPF 202'],
      'listed-building': ['NPPF 199', 'NPPF 200', 'NPPF 201'],
      'green-belt': ['NPPF 147', 'NPPF 148', 'NPPF 149'],
      'flood-risk-zone': ['NPPF 159', 'NPPF 160', 'NPPF 161'],
      'special-protection-area': ['NPPF 180', 'NPPF 181'],
      'site-of-special-scientific-interest': ['NPPF 180', 'NPPF 181']
    };

    return policyMap[dataset] || [];
  }

  /**
   * Simple distance calculation (haversine formula)
   */
  calculateDistance(lat1, lon1, constraint) {
    // Simplified - would use proper geospatial calculation in production
    if (!constraint.geometry || !constraint.geometry.coordinates) return 0;
    
    // For now, return 0 for intersecting features
    return 0;
  }

  /**
   * Get comprehensive site analysis
   */
  async analyzeSite(address, latitude, longitude, geometry = null) {
    try {
      const [constraints, datasets] = await Promise.all([
        this.getConstraintsForSite(latitude, longitude),
        this.getDatasets()
      ]);

      // Get additional context data
      const additionalData = await this.getAdditionalSiteData(latitude, longitude);

      return {
        address,
        coordinates: { latitude, longitude },
        constraints,
        datasets: datasets.filter(d => d.dataset),
        analysis: {
          totalConstraints: constraints.length,
          criticalConstraints: constraints.filter(c => c.severity === 'critical').length,
          highRiskConstraints: constraints.filter(c => c.severity === 'high').length,
          categories: this.summarizeConstraintCategories(constraints),
          policyImplications: this.derivePolicyImplications(constraints)
        },
        additionalData,
        analysisDate: new Date().toISOString()
      };
    } catch (error) {
      console.error('Site analysis failed:', error);
      throw error;
    }
  }

  /**
   * Get additional site context data
   */
  async getAdditionalSiteData(latitude, longitude) {
    // Could be extended to include:
    // - Transport accessibility
    // - Local plan allocations
    // - Development plan boundaries
    return {
      transport: null,
      allocations: null,
      boundaries: null
    };
  }

  /**
   * Summarize constraint categories
   */
  summarizeConstraintCategories(constraints) {
    const summary = {};
    constraints.forEach(constraint => {
      const category = constraint.category;
      if (!summary[category]) {
        summary[category] = {
          count: 0,
          severity: 'low',
          types: new Set()
        };
      }
      summary[category].count++;
      summary[category].types.add(constraint.type);
      
      // Upgrade severity if needed
      if (constraint.severity === 'critical') summary[category].severity = 'critical';
      else if (constraint.severity === 'high' && summary[category].severity !== 'critical') {
        summary[category].severity = 'high';
      }
      else if (constraint.severity === 'medium' && 
               !['critical', 'high'].includes(summary[category].severity)) {
        summary[category].severity = 'medium';
      }
    });

    // Convert Sets to Arrays for JSON serialization
    Object.values(summary).forEach(cat => {
      cat.types = Array.from(cat.types);
    });

    return summary;
  }

  /**
   * Derive policy implications from constraints
   */
  derivePolicyImplications(constraints) {
    const implications = new Set();
    
    constraints.forEach(constraint => {
      const policies = constraint.relevantPolicies;
      policies.forEach(policy => implications.add(policy));
      
      // Add general implications
      switch (constraint.category) {
        case 'heritage':
          implications.add('Heritage impact assessment required');
          implications.add('Consultation with conservation officer needed');
          break;
        case 'environmental':
          implications.add('Environmental impact assessment may be required');
          implications.add('Ecological survey needed');
          break;
        case 'landscape':
          implications.add('Landscape impact assessment required');
          implications.add('Design must respect character');
          break;
      }
    });

    return Array.from(implications);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

export default PlanningDataAPI;
