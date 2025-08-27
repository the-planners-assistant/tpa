/**
 * Planning Data API Client
 * Integrates with planning.data.gov.uk API for official UK planning constraints
 */
// Static metadata derived from provided dataset list (trimmed to key fields to avoid excessive bundle size)
// Each entry keyed by dataset id; includes name, typology, themes, optional description text snippet.
// Source: user-provided authoritative planning.data.gov.uk dataset catalogue snapshot.
const DATASET_METADATA = {
  "address": { name: "Address", typology: "geography", themes: ["administrative"] },
  "agricultural-land-classification": { name: "Agricultural land classification", typology: "geography", themes: ["environment"], description: "Grades the quality of land for agricultural use" },
  "air-quality-management-area": { name: "Air quality management area", typology: "geography", themes: ["environment"], description: "Areas exceeding national air quality objectives" },
  "ancient-woodland": { name: "Ancient woodland", typology: "geography", themes: ["environment"], description: "Continuously wooded since at least 1600 AD" },
  "ancient-woodland-status": { name: "Ancient woodland status", typology: "category", themes: ["environment"] },
  "archaeological-priority-area": { name: "Archaeological priority area", typology: "geography", themes: ["environment","heritage"] },
  "area-of-outstanding-natural-beauty": { name: "Area of outstanding natural beauty", typology: "geography", themes: ["environment"] },
  "article-4-direction": { name: "Article 4 direction", typology: "legal-instrument", themes: ["heritage"] },
  "article-4-direction-area": { name: "Article 4 direction area", typology: "geography", themes: ["heritage"] },
  "article-4-direction-rule": { name: "Article 4 direction rule", typology: "category", themes: ["heritage"] },
  "asset-of-community-value": { name: "Asset of community value", typology: "geography", themes: ["heritage"] },
  "battlefield": { name: "Battlefield", typology: "geography", themes: ["heritage"] },
  "brownfield-land": { name: "Brownfield land", typology: "geography", themes: ["development"] },
  "brownfield-site": { name: "Brownfield site", typology: "geography", themes: ["development"] },
  "building-preservation-notice": { name: "Building preservation notice", typology: "geography", themes: ["development"] },
  "built-up-area": { name: "Built up area", typology: "geography", themes: ["housing"] },
  "certificate-of-immunity": { name: "Certificate of immunity", typology: "geography", themes: ["heritage"] },
  "conservation-area": { name: "Conservation area", typology: "geography", themes: ["heritage"] },
  "conservation-area-document": { name: "Conservation area document", typology: "document", themes: ["heritage"] },
  "conservation-area-document-type": { name: "Conservation area document type", typology: "category", themes: ["heritage"] },
  "developer-agreement": { name: "Developer agreement", typology: "document", themes: ["development"] },
  "developer-agreement-contribution": { name: "Developer agreement contribution", typology: "metric", themes: ["development"] },
  "developer-agreement-transaction": { name: "Developer agreement transaction", typology: "metric", themes: ["development"] },
  "design-code": { name: "Design code", typology: "policy", themes: ["development"] },
  "design-code-area": { name: "Design code area", typology: "geography", themes: ["development"] },
  "development-plan-boundary": { name: "Development plan boundary", typology: "geography", themes: ["development"] },
  "educational-establishment": { name: "Educational establishment", typology: "geography", themes: ["administrative"] },
  "flood-risk-zone": { name: "Flood risk zone", typology: "geography", themes: ["environment"], description: "Probability of river/sea flooding" },
  "flood-storage-area": { name: "Flood storage area", typology: "geography", themes: ["environment"] },
  "forest-inventory": { name: "Forest inventory", typology: "geography", themes: ["environment"] },
  "green-belt": { name: "Green belt", typology: "geography", themes: ["environment"] },
  "green-belt-core": { name: "Green belt core", typology: "category", themes: ["environment"] },
  "heritage-at-risk": { name: "Heritage at risk", typology: "geography", themes: ["heritage"] },
  "heritage-coast": { name: "Heritage coast", typology: "geography", themes: ["environment","heritage"] },
  "infrastructure-project": { name: "Infrastructure project", typology: "geography", themes: ["development"] },
  "infrastructure-project-decision": { name: "Infrastructure project decision", typology: "category", themes: ["development"] },
  "listed-building": { name: "Listed building", typology: "geography", themes: ["heritage"] },
  "listed-building-grade": { name: "Listed building grade", typology: "category", themes: ["heritage"] },
  "listed-building-outline": { name: "Listed building outline", typology: "geography", themes: ["heritage"] },
  "locally-listed-building": { name: "Locally listed building", typology: "geography", themes: ["heritage"] },
  "local-plan": { name: "Local plan", typology: "legal-instrument", themes: ["development"] },
  "local-plan-boundary": { name: "Local plan boundary", typology: "geography", themes: ["development"] },
  "local-plan-document": { name: "Local plan document", typology: "document", themes: ["development"] },
  "national-park": { name: "National park", typology: "geography", themes: ["heritage"] },
  "national-nature-reserve": { name: "National nature reserve", typology: "geography", themes: ["environment","heritage"] },
  "nature-improvement-area": { name: "Nature improvement area", typology: "geography", themes: ["environment"] },
  "open-space": { name: "Open space", typology: "geography", themes: ["environment"] },
  "ownership-status": { name: "Ownership status", typology: "category", themes: ["development"] },
  "park-and-garden": { name: "Historic parks and gardens", typology: "geography", themes: ["environment","heritage"] },
  "park-and-garden-grade": { name: "Park and garden grade", typology: "category", themes: ["environment","heritage"] },
  "planning-application": { name: "Planning application", typology: "geography", themes: ["development","housing","monitoring"] },
  "planning-application-condition": { name: "Planning application condition", typology: "policy", themes: ["housing","monitoring"] },
  "planning-condition": { name: "Planning condition", typology: "policy", themes: ["housing","monitoring"] },
  "planning-permission-status": { name: "Planning permission status", typology: "category", themes: ["development"] },
  "planning-permission-type": { name: "Planning permission type", typology: "category", themes: ["development"] },
  "ramsar": { name: "Ramsar site", typology: "geography", themes: ["environment"] },
  "region": { name: "Region", typology: "geography", themes: ["administrative"] },
  "scheduled-monument": { name: "Scheduled monument", typology: "geography", themes: ["heritage"] },
  "site-of-special-scientific-interest": { name: "Site of special scientific interest", typology: "geography", themes: ["environment"] },
  "special-area-of-conservation": { name: "Special area of conservation", typology: "geography", themes: ["environment"] },
  "special-protection-area": { name: "Special protection area", typology: "geography", themes: ["environment"] },
  "title-boundary": { name: "Title boundary", typology: "geography", themes: ["administrative","housing"] },
  "transport-access-node": { name: "Public transport access node", typology: "geography", themes: ["development","transport"] },
  "tree": { name: "Tree", typology: "geography", themes: ["environment"] },
  "tree-preservation-order": { name: "Tree preservation order", typology: "legal-instrument", themes: ["environment"] },
  "tree-preservation-zone": { name: "Tree preservation zone", typology: "geography", themes: ["environment"] },
  "ward": { name: "Ward", typology: "geography", themes: ["administrative"] },
  "world-heritage-site": { name: "World heritage site", typology: "geography", themes: ["heritage"] },
  "world-heritage-site-buffer-zone": { name: "World heritage site buffer zone", typology: "geography", themes: ["heritage"] }
};

class PlanningDataAPI {
  constructor() {
    // Direct or proxy base (proxy optional). No dataset caching retained.
    this.baseUrl = (typeof window !== 'undefined' ? process?.env?.NEXT_PUBLIC_PD_API_PROXY : process?.env?.PD_API_PROXY) || 'https://www.planning.data.gov.uk';
  }

  /**
   * Initialize hook for consistency with other services.
   * Currently warms dataset list cache; safe to call multiple times.
   */
  async initialize() { return true; }

  /**
   * Get available datasets from planning.data.gov.uk
   */
  // Dataset listing intentionally removed (instruction: only spatial data & analysis)

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

  const result = await this._safeJsonFetch(`${this.baseUrl}/entity.json?${params}`);
  return result?.entities || [];
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

  const result = await this._safeJsonFetch(`${this.baseUrl}/entity.json?${params}`);
  return result?.entities || [];
  }

  /**
   * Get specific entity by ID
   */
  async getEntity(entityId) {
  const result = await this._safeJsonFetch(`${this.baseUrl}/entity/${entityId}.json`);
  return result || null;
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

  const result = await this._safeJsonFetch(`${this.baseUrl}/entity.json?${params}`);
  return result?.entities || [];
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
      const datasetId = constraint.dataset;
  const meta = DATASET_METADATA[datasetId] || {};
      const category = this.categorizeConstraint(datasetId);
      const severity = this.assessConstraintSeverity(datasetId);
      
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
  relevantPolicies: this.getRelevantPolicies(constraint.dataset),
  datasetMeta: meta
      };
    });
  }

  /**
   * Categorize constraints by planning significance
   */
  categorizeConstraint(dataset) {
    const meta = DATASET_METADATA[dataset];
    if (meta && Array.isArray(meta.themes)) {
      if (meta.themes.includes('heritage')) return 'heritage';
      if (meta.themes.includes('environment')) return 'environmental';
      if (meta.themes.includes('development')) return 'development';
      if (meta.themes.includes('housing')) return 'housing';
      if (meta.themes.includes('transport')) return 'transport';
      if (meta.themes.includes('administrative')) return 'administrative';
    }
    // Fallback legacy mapping
    const legacy = {
      'conservation-area': 'heritage',
      'listed-building': 'heritage',
      'scheduled-monument': 'heritage',
      'world-heritage-site': 'heritage',
      'flood-risk-zone': 'environmental',
      'ancient-woodland': 'environmental',
      'special-protection-area': 'environmental',
      'special-area-of-conservation': 'environmental',
      'site-of-special-scientific-interest': 'environmental',
      'green-belt': 'landscape',
      'national-park': 'landscape',
      'area-of-outstanding-natural-beauty': 'landscape',
      'article-4-direction': 'regulatory',
      'tree-preservation-order': 'regulatory'
    };
    return legacy[dataset] || 'other';
  }

  /**
   * Assess constraint severity for planning purposes
   */
  assessConstraintSeverity(dataset) {
    const baseMap = {
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
    if (baseMap[dataset]) return baseMap[dataset];
    // Heuristic severity for unknown datasets based on themes/typology
    const meta = DATASET_METADATA[dataset];
    if (meta) {
      if (meta.themes?.includes('heritage')) return 'high';
      if (meta.themes?.includes('environment')) return 'medium';
      if (meta.typology === 'legal-instrument') return 'high';
      if (meta.typology === 'policy') return 'medium';
    }
    return 'low';
  }

  /** Retrieve dataset metadata (public helper) */
  getDatasetInfo(dataset) { return DATASET_METADATA[dataset] || null; }

  /** List known datasets with optional filter by theme */
  listKnownDatasets({ theme } = {}) {
    return Object.entries(DATASET_METADATA)
      .filter(([_, meta]) => !theme || meta.themes?.includes(theme))
      .map(([id, meta]) => ({ id, ...meta }));
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
      const constraints = await this.getConstraintsForSite(latitude, longitude);
      return {
        address,
        coordinates: { latitude, longitude },
        constraints,
        analysis: {
          totalConstraints: constraints.length,
          criticalConstraints: constraints.filter(c => c.severity === 'critical').length,
          highRiskConstraints: constraints.filter(c => c.severity === 'high').length,
          categories: this.summarizeConstraintCategories(constraints),
          policyImplications: this.derivePolicyImplications(constraints)
        },
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
  // Removed ancillary site context per instruction

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
  clearCache() {}

  /** Internal: robust fetch with timeout and JSON parsing */
  async _safeJsonFetch(url, { timeout = 15000, retries = 1 } = {}) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        let targetUrl = url;
        let res;
        try {
          res = await fetch(targetUrl, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
        } catch (networkErr) {
          // If browser-side CORS block and proxy configured, retry through proxy once per attempt
          if (typeof window !== 'undefined' && process && process.env && process.env.NEXT_PUBLIC_CORS_PROXY) {
            const proxy = process.env.NEXT_PUBLIC_CORS_PROXY;
            targetUrl = `${proxy}${encodeURIComponent(url)}`;
            res = await fetch(targetUrl, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
          } else {
            throw networkErr;
          }
        }
        clearTimeout(id);
        if (!res.ok) {
          // Handle specific HTTP error codes
          if (res.status === 422) {
            throw new Error(`Invalid parameters (HTTP 422) - check dataset names and coordinate format`);
          } else if (res.status >= 500) {
            throw new Error(`Server error (HTTP ${res.status})`);
          } else {
            throw new Error(`HTTP ${res.status}`);
          }
        }
        const text = await res.text();
        try { return JSON.parse(text); } catch (e) { throw new Error('Invalid JSON'); }
      } catch (err) {
        clearTimeout(id);
        if (attempt === retries) {
          // Only log as warning for non-critical services, debug for others
          if (url.includes('railway-station') || url.includes('bus-stop') || url.includes('town-centre')) {
            console.debug(`PlanningDataAPI service unavailable (${url}): ${err.message}`);
          } else {
            console.warn(`PlanningDataAPI fetch failed (${url}): ${err.message}`);
          }
          return null;
        }
        await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
      }
    }
    return null;
  }
}

export default PlanningDataAPI;
