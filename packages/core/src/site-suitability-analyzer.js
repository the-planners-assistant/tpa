import { getDatabase } from './database.js';

/**
 * SiteSuitabilityAnalyzer
 * Multi-criteria assessment, capacity modeling, accessibility analysis, and environmental impact scoring
 */
export default class SiteSuitabilityAnalyzer {
  constructor(db = getDatabase()) {
    this.db = db;
    
    // Scoring criteria weights
    this.criteria = {
      accessibility: { weight: 0.25, components: ['transport', 'services', 'employment'] },
      environmental: { weight: 0.20, components: ['landscape', 'ecology', 'flood_risk'] },
      technical: { weight: 0.20, components: ['infrastructure', 'ground_conditions', 'utilities'] },
      policy: { weight: 0.15, components: ['land_use', 'conservation', 'protection'] },
      market: { weight: 0.10, components: ['demand', 'viability', 'deliverability'] },
      constraints: { weight: 0.10, components: ['statutory', 'physical', 'ownership'] }
    };
  }

  /**
   * Assess site suitability with comprehensive multi-criteria analysis
   */
  async assessSiteSuitability(siteData, assessmentOptions = {}) {
    const {
      includeCapacityModeling = true,
      includeAccessibilityAnalysis = true,
      includeEnvironmentalImpact = true,
      detailedBreakdown = true
    } = assessmentOptions;

    try {
      const results = {
        siteId: siteData.id,
        overallScore: 0,
        suitabilityRating: '',
        criteriaScores: {},
        recommendations: [],
        constraints: [],
        opportunities: [],
        metadata: {
          assessedAt: new Date().toISOString(),
          methodology: 'Multi-Criteria Decision Analysis (MCDA)'
        }
      };

      // Run individual assessments
      const assessments = await Promise.all([
        this._assessAccessibility(siteData),
        this._assessEnvironmentalFactors(siteData),
        this._assessTechnicalFactors(siteData),
        this._assessPolicyConstraints(siteData),
        this._assessMarketFactors(siteData),
        this._assessConstraints(siteData)
      ]);

      // Compile criterion scores
      const criteriaKeys = Object.keys(this.criteria);
      assessments.forEach((assessment, index) => {
        const criterion = criteriaKeys[index];
        results.criteriaScores[criterion] = {
          score: assessment.score,
          details: assessment.details,
          confidence: assessment.confidence,
          components: assessment.components
        };
      });

      // Calculate weighted overall score
      results.overallScore = this._calculateWeightedScore(results.criteriaScores);
      results.suitabilityRating = this._getSuitabilityRating(results.overallScore);

      // Add capacity modeling if requested
      if (includeCapacityModeling) {
        results.capacityAnalysis = await this._assessDevelopmentCapacity(siteData);
      }

      // Add accessibility analysis if requested
      if (includeAccessibilityAnalysis) {
        results.accessibilityAnalysis = await this._detailedAccessibilityAnalysis(siteData);
      }

      // Add environmental impact if requested
      if (includeEnvironmentalImpact) {
        results.environmentalImpact = await this._environmentalImpactScoring(siteData);
      }

      // Generate recommendations and identify opportunities/constraints
      results.recommendations = this._generateRecommendations(results);
      results.opportunities = this._identifyOpportunities(results);
      results.constraints = this._identifyKeyConstraints(results);

      return results;
    } catch (error) {
      console.error('Site suitability assessment failed:', error);
      throw new Error(`Site assessment failed: ${error.message}`);
    }
  }

  /**
   * Assess accessibility factors
   */
  async _assessAccessibility(siteData) {
    const components = {
      transport: 0,
      services: 0,
      employment: 0
    };

    // Transport accessibility (40% of accessibility score)
    const transportScore = await this._assessTransportAccessibility(siteData);
    components.transport = transportScore;

    // Services accessibility (30% of accessibility score)
    const servicesScore = await this._assessServicesAccessibility(siteData);
    components.services = servicesScore;

    // Employment accessibility (30% of accessibility score)
    const employmentScore = await this._assessEmploymentAccessibility(siteData);
    components.employment = employmentScore;

    const overallScore = (components.transport * 0.4) + 
                        (components.services * 0.3) + 
                        (components.employment * 0.3);

    return {
      score: Math.round(overallScore),
      confidence: 0.8,
      components,
      details: {
        transport: this._getTransportDetails(transportScore),
        services: this._getServicesDetails(servicesScore),
        employment: this._getEmploymentDetails(employmentScore)
      }
    };
  }

  /**
   * Assess environmental factors
   */
  async _assessEnvironmentalFactors(siteData) {
    const components = {
      landscape: 0,
      ecology: 0,
      flood_risk: 0
    };

    // Landscape impact (40% of environmental score)
    components.landscape = this._assessLandscapeImpact(siteData);

    // Ecological value and impact (35% of environmental score)
    components.ecology = this._assessEcologicalValue(siteData);

    // Flood risk (25% of environmental score)
    components.flood_risk = this._assessFloodRisk(siteData);

    const overallScore = (components.landscape * 0.4) + 
                        (components.ecology * 0.35) + 
                        (components.flood_risk * 0.25);

    return {
      score: Math.round(overallScore),
      confidence: 0.7,
      components,
      details: {
        landscape: this._getLandscapeDetails(siteData),
        ecology: this._getEcologyDetails(siteData),
        flood_risk: this._getFloodRiskDetails(siteData)
      }
    };
  }

  /**
   * Assess technical factors
   */
  async _assessTechnicalFactors(siteData) {
    const components = {
      infrastructure: 0,
      ground_conditions: 0,
      utilities: 0
    };

    // Infrastructure capacity (50% of technical score)
    components.infrastructure = this._assessInfrastructureCapacity(siteData);

    // Ground conditions (30% of technical score)
    components.ground_conditions = this._assessGroundConditions(siteData);

    // Utilities availability (20% of technical score)
    components.utilities = this._assessUtilitiesAvailability(siteData);

    const overallScore = (components.infrastructure * 0.5) + 
                        (components.ground_conditions * 0.3) + 
                        (components.utilities * 0.2);

    return {
      score: Math.round(overallScore),
      confidence: 0.6,
      components,
      details: {
        infrastructure: 'Infrastructure capacity assessment',
        ground_conditions: 'Ground conditions evaluation',
        utilities: 'Utilities connection assessment'
      }
    };
  }

  /**
   * Assess policy constraints
   */
  async _assessPolicyConstraints(siteData) {
    const components = {
      land_use: 0,
      conservation: 0,
      protection: 0
    };

    // Land use policy compliance (50% of policy score)
    components.land_use = await this._assessLandUsePolicy(siteData);

    // Conservation designations (30% of policy score)
    components.conservation = this._assessConservationDesignations(siteData);

    // Protection areas (20% of policy score)
    components.protection = this._assessProtectionAreas(siteData);

    const overallScore = (components.land_use * 0.5) + 
                        (components.conservation * 0.3) + 
                        (components.protection * 0.2);

    return {
      score: Math.round(overallScore),
      confidence: 0.9,
      components,
      details: {
        land_use: 'Local plan policy alignment',
        conservation: 'Heritage and conservation constraints',
        protection: 'Environmental protection areas'
      }
    };
  }

  /**
   * Assess market factors
   */
  async _assessMarketFactors(siteData) {
    const components = {
      demand: 0,
      viability: 0,
      deliverability: 0
    };

    // Market demand (40% of market score)
    components.demand = this._assessMarketDemand(siteData);

    // Development viability (35% of market score)
    components.viability = this._assessDevelopmentViability(siteData);

    // Deliverability (25% of market score)
    components.deliverability = this._assessDeliverability(siteData);

    const overallScore = (components.demand * 0.4) + 
                        (components.viability * 0.35) + 
                        (components.deliverability * 0.25);

    return {
      score: Math.round(overallScore),
      confidence: 0.5,
      components,
      details: {
        demand: 'Housing market demand assessment',
        viability: 'Development viability analysis',
        deliverability: 'Site deliverability evaluation'
      }
    };
  }

  /**
   * Assess constraints
   */
  async _assessConstraints(siteData) {
    const components = {
      statutory: 0,
      physical: 0,
      ownership: 0
    };

    // Statutory constraints (50% of constraints score)
    components.statutory = this._assessStatutoryConstraints(siteData);

    // Physical constraints (35% of constraints score)
    components.physical = this._assessPhysicalConstraints(siteData);

    // Ownership constraints (15% of constraints score)
    components.ownership = this._assessOwnershipConstraints(siteData);

    const overallScore = (components.statutory * 0.5) + 
                        (components.physical * 0.35) + 
                        (components.ownership * 0.15);

    return {
      score: Math.round(overallScore),
      confidence: 0.7,
      components,
      details: {
        statutory: 'Legal and statutory constraints',
        physical: 'Topography, access, and physical constraints',
        ownership: 'Land ownership and availability'
      }
    };
  }

  /**
   * Calculate weighted overall score
   */
  _calculateWeightedScore(criteriaScores) {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const [criterion, data] of Object.entries(criteriaScores)) {
      const weight = this.criteria[criterion]?.weight || 0;
      weightedSum += data.score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  }

  /**
   * Get suitability rating from score
   */
  _getSuitabilityRating(score) {
    if (score >= 80) return 'Highly Suitable';
    if (score >= 60) return 'Suitable';
    if (score >= 40) return 'Moderately Suitable';
    if (score >= 20) return 'Less Suitable';
    return 'Not Suitable';
  }

  /**
   * Assess development capacity
   */
  async _assessDevelopmentCapacity(siteData) {
    const capacity = {
      grossArea: siteData.area || 1, // hectares
      netDevelopableArea: 0,
      estimatedUnits: 0,
      densityRange: { min: 25, max: 40 },
      constraints: [],
      assumptions: []
    };

    // Calculate net developable area (typically 70-85% of gross)
    let developablePercentage = 0.75; // Default 75%
    
    // Adjust based on constraints
    if (siteData.constraints) {
      siteData.constraints.forEach(constraint => {
        if (constraint.includes('flood')) developablePercentage -= 0.1;
        if (constraint.includes('heritage')) developablePercentage -= 0.05;
        if (constraint.includes('ecology')) developablePercentage -= 0.1;
        if (constraint.includes('access')) developablePercentage -= 0.05;
      });
    }

    developablePercentage = Math.max(0.4, Math.min(0.9, developablePercentage));
    capacity.netDevelopableArea = capacity.grossArea * developablePercentage;

    // Calculate estimated units based on density range
    const avgDensity = (capacity.densityRange.min + capacity.densityRange.max) / 2;
    capacity.estimatedUnits = Math.round(capacity.netDevelopableArea * avgDensity);

    // Add assumptions
    capacity.assumptions = [
      `${Math.round(developablePercentage * 100)}% of site assumed developable`,
      `Density range: ${capacity.densityRange.min}-${capacity.densityRange.max} units/ha`,
      `Average density applied: ${avgDensity} units/ha`
    ];

    return capacity;
  }

  /**
   * Detailed accessibility analysis
   */
  async _detailedAccessibilityAnalysis(siteData) {
    return {
      publicTransport: {
        busStops: this._calculateDistance(siteData, 'bus_stop'),
        railStations: this._calculateDistance(siteData, 'rail_station'),
        serviceFrequency: 'medium', // Would be calculated from real data
        score: 65
      },
      pedestrianAccess: {
        footpaths: 'good',
        cyclePaths: 'limited',
        streetLighting: 'adequate',
        score: 70
      },
      vehicularAccess: {
        roadHierarchy: this._assessRoadHierarchy(siteData),
        junctionCapacity: 'adequate',
        parkingProvision: 'required',
        score: 75
      },
      services: {
        schools: this._calculateServiceAccess(siteData, 'schools'),
        healthcare: this._calculateServiceAccess(siteData, 'healthcare'),
        retail: this._calculateServiceAccess(siteData, 'retail'),
        score: 60
      }
    };
  }

  /**
   * Environmental impact scoring
   */
  async _environmentalImpactScoring(siteData) {
    return {
      biodiversity: {
        habitatValue: this._assessHabitatValue(siteData),
        speciesImpact: 'medium',
        mitigationPotential: 'high',
        netGainAchievable: true,
        score: 65
      },
      landscape: {
        visualImpact: this._assessVisualImpact(siteData),
        characterImpact: 'medium',
        mitigationRequired: true,
        score: 55
      },
      airQuality: {
        currentQuality: 'good',
        trafficImpact: 'low',
        mitigationRequired: false,
        score: 80
      },
      noise: {
        currentLevels: 'acceptable',
        trafficNoise: 'low',
        mitigationRequired: false,
        score: 75
      },
      water: {
        drainageCapacity: 'adequate',
        surfaceWaterRisk: 'low',
        susdsRequired: true,
        score: 70
      }
    };
  }

  // Specific assessment methods

  async _assessTransportAccessibility(siteData) {
    // Simplified scoring based on distance to transport nodes
    let score = 50; // Base score
    
    // Would use real distance calculations in production
    if (siteData.nearTransport) score += 30;
    if (siteData.busRoute) score += 20;
    
    return Math.min(100, score);
  }

  async _assessServicesAccessibility(siteData) {
    let score = 50;
    
    if (siteData.nearSchools) score += 25;
    if (siteData.nearShops) score += 15;
    if (siteData.nearHealthcare) score += 10;
    
    return Math.min(100, score);
  }

  async _assessEmploymentAccessibility(siteData) {
    let score = 50;
    
    if (siteData.nearEmployment) score += 30;
    if (siteData.goodRoadAccess) score += 20;
    
    return Math.min(100, score);
  }

  _assessLandscapeImpact(siteData) {
    let score = 70; // Base score assuming moderate impact
    
    if (siteData.landscapeDesignation) score -= 30;
    if (siteData.visibleFromRoads) score -= 10;
    if (siteData.existingVegetation) score += 15;
    
    return Math.max(0, Math.min(100, score));
  }

  _assessEcologicalValue(siteData) {
    let score = 60; // Base score
    
    if (siteData.ecologyDesignation) score -= 40;
    if (siteData.oldGrowthTrees) score -= 20;
    if (siteData.agricultureGrade <= 2) score -= 15;
    
    return Math.max(0, Math.min(100, score));
  }

  _assessFloodRisk(siteData) {
    let score = 80; // Assume low risk by default
    
    if (siteData.floodZone === 3) score = 20;
    else if (siteData.floodZone === 2) score = 50;
    else if (siteData.floodZone === 1) score = 80;
    
    return score;
  }

  _assessInfrastructureCapacity(siteData) {
    let score = 60; // Base assumption
    
    if (siteData.waterCapacity === 'adequate') score += 15;
    if (siteData.sewerCapacity === 'adequate') score += 15;
    if (siteData.electricityCapacity === 'adequate') score += 10;
    
    return Math.min(100, score);
  }

  _assessGroundConditions(siteData) {
    let score = 70; // Assume reasonable conditions
    
    if (siteData.contamination) score -= 30;
    if (siteData.unstableGround) score -= 25;
    if (siteData.archaeology) score -= 15;
    
    return Math.max(20, score);
  }

  _assessUtilitiesAvailability(siteData) {
    let score = 50;
    
    if (siteData.gasAvailable) score += 15;
    if (siteData.broadbandAvailable) score += 10;
    if (siteData.electricityNearby) score += 25;
    
    return Math.min(100, score);
  }

  async _assessLandUsePolicy(siteData) {
    // Would check against actual local plan policies
    let score = 70; // Assume general compliance
    
    if (siteData.greenBelt) score = 20;
    if (siteData.housingAllocation) score = 90;
    if (siteData.mixedUseAllocation) score = 80;
    
    return score;
  }

  _assessConservationDesignations(siteData) {
    let score = 80; // Assume no major constraints
    
    if (siteData.conservationArea) score -= 20;
    if (siteData.listedBuildings) score -= 30;
    if (siteData.scheduledMonument) score -= 50;
    
    return Math.max(10, score);
  }

  _assessProtectionAreas(siteData) {
    let score = 80; // Assume no major constraints
    
    if (siteData.aonb) score -= 40;
    if (siteData.nationalPark) score -= 50;
    if (siteData.sssi) score -= 60;
    
    return Math.max(5, score);
  }

  _assessMarketDemand(siteData) {
    // Simplified market assessment
    return 65; // Assume moderate demand
  }

  _assessDevelopmentViability(siteData) {
    let score = 60; // Base viability
    
    if (siteData.highLandValues) score += 20;
    if (siteData.infrastructureCosts === 'high') score -= 25;
    
    return Math.max(20, Math.min(100, score));
  }

  _assessDeliverability(siteData) {
    let score = 70; // Base deliverability
    
    if (siteData.singleOwnership) score += 15;
    if (siteData.developmentInterest) score += 15;
    
    return Math.min(100, score);
  }

  _assessStatutoryConstraints(siteData) {
    let score = 80; // Assume minimal constraints
    
    if (siteData.tpo) score -= 15;
    if (siteData.footpaths) score -= 10;
    if (siteData.utilities) score -= 5;
    
    return Math.max(20, score);
  }

  _assessPhysicalConstraints(siteData) {
    let score = 75; // Base score
    
    if (siteData.steepSlopes) score -= 25;
    if (siteData.accessConstraints) score -= 20;
    if (siteData.poorDrainage) score -= 15;
    
    return Math.max(20, score);
  }

  _assessOwnershipConstraints(siteData) {
    let score = 80; // Assume willing ownership
    
    if (siteData.multipleOwners) score -= 20;
    if (siteData.unwillingOwner) score -= 40;
    
    return Math.max(20, score);
  }

  /**
   * Generate recommendations based on assessment
   */
  _generateRecommendations(results) {
    const recommendations = [];
    
    if (results.overallScore >= 80) {
      recommendations.push({
        priority: 'high',
        category: 'development',
        action: 'Prioritize for development allocation',
        reasoning: 'High suitability score indicates excellent development potential'
      });
    } else if (results.overallScore >= 60) {
      recommendations.push({
        priority: 'medium',
        category: 'development',
        action: 'Consider for development with conditions',
        reasoning: 'Good suitability but may require mitigation measures'
      });
    } else {
      recommendations.push({
        priority: 'low',
        category: 'development',
        action: 'Detailed feasibility study required',
        reasoning: 'Significant constraints identified that need addressing'
      });
    }

    // Add specific recommendations based on criterion scores
    Object.entries(results.criteriaScores).forEach(([criterion, data]) => {
      if (data.score < 40) {
        recommendations.push({
          priority: 'medium',
          category: criterion,
          action: `Address ${criterion} constraints`,
          reasoning: `Low score in ${criterion} (${data.score}/100) requires attention`
        });
      }
    });

    return recommendations;
  }

  /**
   * Identify opportunities
   */
  _identifyOpportunities(results) {
    const opportunities = [];
    
    Object.entries(results.criteriaScores).forEach(([criterion, data]) => {
      if (data.score >= 80) {
        opportunities.push({
          category: criterion,
          description: `Strong ${criterion} performance`,
          score: data.score,
          benefit: 'Can leverage this strength in development proposal'
        });
      }
    });

    return opportunities;
  }

  /**
   * Identify key constraints
   */
  _identifyKeyConstraints(results) {
    const constraints = [];
    
    Object.entries(results.criteriaScores).forEach(([criterion, data]) => {
      if (data.score < 40) {
        constraints.push({
          category: criterion,
          description: `Significant ${criterion} constraints`,
          score: data.score,
          severity: data.score < 20 ? 'critical' : 'major',
          mitigation: this._suggestMitigation(criterion, data.score)
        });
      }
    });

    return constraints;
  }

  /**
   * Suggest mitigation measures
   */
  _suggestMitigation(criterion, score) {
    const mitigations = {
      accessibility: 'Improve public transport links, provide shuttle service, enhance pedestrian/cycle access',
      environmental: 'Comprehensive ecological surveys, biodiversity enhancement, sustainable drainage',
      technical: 'Infrastructure upgrades, ground improvement works, utility connections',
      policy: 'Policy review, exceptional circumstances case, alternative policy approach',
      market: 'Phased development, affordable housing provision, mixed-use approach',
      constraints: 'Detailed constraint assessment, mitigation design, stakeholder engagement'
    };
    
    return mitigations[criterion] || 'Detailed assessment and mitigation strategy required';
  }

  // Utility methods for distance and service calculations
  _calculateDistance(siteData, facilityType) {
    // Simplified distance calculation - would use real GIS data
    return Math.random() * 1000; // meters
  }

  _calculateServiceAccess(siteData, serviceType) {
    // Simplified service access calculation
    return {
      distance: Math.random() * 2000, // meters
      quality: ['poor', 'fair', 'good', 'excellent'][Math.floor(Math.random() * 4)],
      score: Math.floor(Math.random() * 40) + 40 // 40-80
    };
  }

  _assessRoadHierarchy(siteData) {
    // Simplified road hierarchy assessment
    return siteData.nearMajorRoad ? 'A-road access' : 'Local road access';
  }

  _assessHabitatValue(siteData) {
    if (siteData.priority_habitat) return 'high';
    if (siteData.semi_natural) return 'medium';
    return 'low';
  }

  _assessVisualImpact(siteData) {
    if (siteData.prominent_location) return 'high';
    if (siteData.moderate_visibility) return 'medium';
    return 'low';
  }

  // Detail generation methods
  _getTransportDetails(score) {
    if (score >= 80) return 'Excellent public transport accessibility';
    if (score >= 60) return 'Good transport links available';
    if (score >= 40) return 'Moderate transport accessibility';
    return 'Limited transport options';
  }

  _getServicesDetails(score) {
    if (score >= 80) return 'Wide range of services within walking distance';
    if (score >= 60) return 'Key services accessible';
    if (score >= 40) return 'Some services available locally';
    return 'Limited local services';
  }

  _getEmploymentDetails(score) {
    if (score >= 80) return 'Major employment areas nearby';
    if (score >= 60) return 'Good access to employment opportunities';
    if (score >= 40) return 'Moderate employment accessibility';
    return 'Limited employment opportunities nearby';
  }

  _getLandscapeDetails(siteData) {
    return 'Landscape character and visual impact assessment';
  }

  _getEcologyDetails(siteData) {
    return 'Ecological value and biodiversity impact assessment';
  }

  _getFloodRiskDetails(siteData) {
    return `Flood Zone ${siteData.floodZone || 1} - detailed flood risk assessment`;
  }

  /**
   * Compare multiple sites
   */
  async compareSites(siteIds, comparisonCriteria = null) {
    const results = [];
    
    for (const siteId of siteIds) {
      // Get site data
      const siteData = await this.db.siteAllocations.get(siteId);
      if (siteData) {
        const assessment = await this.assessSiteSuitability(siteData);
        results.push(assessment);
      }
    }

    // Rank sites by overall score
    results.sort((a, b) => b.overallScore - a.overallScore);

    return {
      sites: results,
      comparison: this._generateComparison(results, comparisonCriteria),
      recommendations: this._generateComparisonRecommendations(results)
    };
  }

  /**
   * Generate comparison matrix
   */
  _generateComparison(results, criteria) {
    const comparison = {
      overall: results.map(r => ({ siteId: r.siteId, score: r.overallScore, rank: 1 })),
      byCriteria: {}
    };

    // Rank overall
    comparison.overall.forEach((item, index) => {
      item.rank = index + 1;
    });

    // Rank by individual criteria
    const criteriaKeys = criteria || Object.keys(this.criteria);
    criteriaKeys.forEach(criterion => {
      const criterionResults = results
        .map(r => ({ 
          siteId: r.siteId, 
          score: r.criteriaScores[criterion]?.score || 0 
        }))
        .sort((a, b) => b.score - a.score);
      
      criterionResults.forEach((item, index) => {
        item.rank = index + 1;
      });
      
      comparison.byCriteria[criterion] = criterionResults;
    });

    return comparison;
  }

  /**
   * Generate comparison recommendations
   */
  _generateComparisonRecommendations(results) {
    const recommendations = [];
    
    if (results.length > 0) {
      const best = results[0];
      recommendations.push({
        type: 'priority',
        message: `Site ${best.siteId} ranks highest with ${best.overallScore}% suitability`,
        siteId: best.siteId
      });

      const suitable = results.filter(r => r.overallScore >= 60);
      if (suitable.length > 1) {
        recommendations.push({
          type: 'consideration',
          message: `${suitable.length} sites show good development potential`,
          siteIds: suitable.map(s => s.siteId)
        });
      }

      const problematic = results.filter(r => r.overallScore < 40);
      if (problematic.length > 0) {
        recommendations.push({
          type: 'caution',
          message: `${problematic.length} sites have significant constraints requiring detailed assessment`,
          siteIds: problematic.map(s => s.siteId)
        });
      }
    }

    return recommendations;
  }
}
