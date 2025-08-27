import { getDatabase } from './database.js';

/**
 * ScenarioModeler
 * Interactive scenario planning and impact assessment for local plans
 * Enhanced with AI-powered scenario analysis and optimization
 */
export default class ScenarioModeler {
  constructor(db = getDatabase(), agent = null) {
    this.db = db;
    this.agent = agent;
    this.enableAI = !!agent;
    this.defaultParameters = {
      housing: {
        totalUnits: 1000,
        affordablePercentage: 30,
        densityRange: { min: 20, max: 40 }, // units per hectare
        phasing: 5 // years
      },
      employment: {
        totalJobs: 500,
        sectorMix: {
          office: 40,
          industrial: 30,
          retail: 20,
          other: 10
        }
      },
      infrastructure: {
        schools: { primary: 1, secondary: 0.5 },
        healthcare: { gp: 1, hospital: 0.1 },
        transport: { busRoutes: 2, parkingRatio: 1.5 }
      },
      environment: {
        greenSpacePercentage: 15,
        biodiversityNetGain: 10,
        renewableEnergyTarget: 20
      }
    };
  }

  /**
   * Create a new scenario
   */
  async createScenario(planId, scenarioData) {
    const {
      name,
      description,
      parameters = {},
      baselineYear = new Date().getFullYear()
    } = scenarioData;

    // Merge with default parameters
    const fullParameters = this._mergeParameters(this.defaultParameters, parameters);

    const scenario = {
      planId,
      name,
      description,
      parameters: fullParameters,
      baselineYear,
      results: null,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const id = await this.db.scenarios.add(scenario);
    return { ...scenario, id };
  }

  /**
   * Update scenario parameters
   */
  async updateScenario(scenarioId, updates) {
    const scenario = await this.db.scenarios.get(scenarioId);
    if (!scenario) {
      throw new Error('Scenario not found');
    }

    const updatedScenario = {
      ...scenario,
      ...updates,
      updatedAt: new Date().toISOString(),
      status: 'draft' // Reset to draft when parameters change
    };

    if (updates.parameters) {
      updatedScenario.parameters = this._mergeParameters(scenario.parameters, updates.parameters);
    }

    await this.db.scenarios.update(scenarioId, updatedScenario);
    return updatedScenario;
  }

  /**
   * Run scenario modeling and impact assessment
   */
  /**
   * Run scenario modeling with AI enhancement
   */
  async runScenarioModeling(scenarioId, options = {}) {
    const { enableAIAnalysis = this.enableAI, includeOptimization = true } = options;
    
    const scenario = await this.db.scenarios.get(scenarioId);
    if (!scenario) {
      throw new Error('Scenario not found');
    }

    try {
      // Get local plan context
      const localPlan = await this.db.localPlans.get(scenario.planId);
      const siteAllocations = await this.db.siteAllocations
        .where('planId')
        .equals(scenario.planId)
        .toArray();

      // AI-enhanced scenario analysis if enabled
      let aiAnalysis = null;
      if (enableAIAnalysis && this.agent) {
        aiAnalysis = await this._runAIScenarioAnalysis(scenario, localPlan, siteAllocations);
      }

      // Run impact assessments
      const results = {
        housing: await this._assessHousingImpacts(scenario.parameters, siteAllocations, aiAnalysis),
        employment: await this._assessEmploymentImpacts(scenario.parameters, siteAllocations, aiAnalysis),
        transport: await this._assessTransportImpacts(scenario.parameters, siteAllocations, aiAnalysis),
        environment: await this._assessEnvironmentalImpacts(scenario.parameters, siteAllocations, aiAnalysis),
        infrastructure: await this._assessInfrastructureNeeds(scenario.parameters, siteAllocations, aiAnalysis),
        viability: await this._assessViability(scenario.parameters, siteAllocations, aiAnalysis),
        risks: await this._identifyRisks(scenario.parameters, siteAllocations, aiAnalysis),
        timeline: this._generateTimeline(scenario.parameters),
        summary: {},
        aiAnalysis
      };

      // Generate summary metrics
      results.summary = this._generateSummary(results, aiAnalysis);

      // AI-powered optimization suggestions
      if (includeOptimization && aiAnalysis) {
        results.optimizationSuggestions = await this._generateOptimizationSuggestions(
          scenario, results, aiAnalysis
        );
      }

      // Update scenario with results
      await this.db.scenarios.update(scenarioId, {
        results,
        status: 'modeled',
        modeledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        aiEnhanced: enableAIAnalysis
      });

      return results;
    } catch (error) {
      console.error('Scenario modeling failed:', error);
      await this.db.scenarios.update(scenarioId, {
        status: 'error',
        error: error.message,
        updatedAt: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * AI-enhanced scenario analysis
   */
  async _runAIScenarioAnalysis(scenario, localPlan, siteAllocations) {
    if (!this.agent) {
      console.warn('AI agent not available for scenario analysis');
      return null;
    }

    try {
      // Use the LocalPlanAgent for intelligent scenario modeling
      const analysis = await this.agent.runIntelligentScenarioModeling({
        scenario: {
          parameters: scenario.parameters,
          description: scenario.description,
          name: scenario.name
        },
        localPlan,
        siteAllocations,
        analysisOptions: {
          includeViabilityAssessment: true,
          includeSustainabilityAnalysis: true,
          includeInfrastructureModeling: true,
          includeRiskAssessment: true,
          optimizationLevel: 'comprehensive'
        }
      });

      return {
        overallAssessment: analysis.overallAssessment,
        housingAnalysis: analysis.housingAnalysis,
        employmentAnalysis: analysis.employmentAnalysis,
        transportAnalysis: analysis.transportAnalysis,
        environmentalAnalysis: analysis.environmentalAnalysis,
        infrastructureAnalysis: analysis.infrastructureAnalysis,
        viabilityAnalysis: analysis.viabilityAnalysis,
        riskAssessment: analysis.riskAssessment,
        optimizationSuggestions: analysis.optimizationSuggestions,
        confidence: analysis.confidence || 0.8,
        reasoning: analysis.reasoning
      };
    } catch (error) {
      console.error('AI scenario analysis failed:', error);
      return null;
    }
  }

  /**
   * Generate AI-powered optimization suggestions
   */
  async _generateOptimizationSuggestions(scenario, modelingResults, aiAnalysis) {
    if (!aiAnalysis || !aiAnalysis.optimizationSuggestions) {
      return null;
    }

    return {
      housingOptimizations: aiAnalysis.optimizationSuggestions.housing || [],
      employmentOptimizations: aiAnalysis.optimizationSuggestions.employment || [],
      transportOptimizations: aiAnalysis.optimizationSuggestions.transport || [],
      environmentalOptimizations: aiAnalysis.optimizationSuggestions.environmental || [],
      infrastructureOptimizations: aiAnalysis.optimizationSuggestions.infrastructure || [],
      viabilityImprovements: aiAnalysis.optimizationSuggestions.viability || [],
      riskMitigations: aiAnalysis.optimizationSuggestions.riskMitigation || [],
      overallRecommendations: aiAnalysis.optimizationSuggestions.overall || [],
      confidence: aiAnalysis.confidence,
      implementationPriority: aiAnalysis.optimizationSuggestions.priority || 'medium'
    };
  }

  /**
   * Enable AI features for scenario modeling
   */
  enableAIFeatures(agent) {
    this.agent = agent;
    this.enableAI = true;
    console.log('AI features enabled for ScenarioModeler');
  }

  /**
   * Disable AI features (fall back to rule-based only)
   */
  disableAIFeatures() {
    this.enableAI = false;
    console.log('AI features disabled for ScenarioModeler');
  }

  /**
   * Assess housing impacts
   */
  async _assessHousingImpacts(parameters, siteAllocations, aiAnalysis = null) {
    const housing = parameters.housing;
    
    // Calculate total capacity from site allocations
    const allocatedCapacity = siteAllocations.reduce((sum, site) => 
      sum + (site.capacity || 0), 0);

    // Calculate housing delivery
    const annualDelivery = housing.totalUnits / housing.phasing;
    const affordableUnits = Math.round(housing.totalUnits * (housing.affordablePercentage / 100));

    // Assess land requirements
    const averageDensity = (housing.densityRange.min + housing.densityRange.max) / 2;
    const landRequired = housing.totalUnits / averageDensity; // hectares

    // Calculate shortfall/surplus
    const capacityShortfall = housing.totalUnits - allocatedCapacity;

    // Base assessment
    const baseAssessment = {
      totalUnits: housing.totalUnits,
      affordableUnits,
      marketUnits: housing.totalUnits - affordableUnits,
      annualDelivery,
      landRequired,
      allocatedCapacity,
      capacityShortfall,
      densityAchieved: allocatedCapacity > 0 ? housing.totalUnits / (allocatedCapacity / averageDensity) : 0,
      deliveryFeasibility: this._assessDeliveryFeasibility(annualDelivery, siteAllocations.length),
      risks: this._identifyHousingRisks(housing, capacityShortfall)
    };

    // Enhance with AI analysis if available
    if (aiAnalysis && aiAnalysis.housingAnalysis) {
      baseAssessment.aiEnhancement = {
        deliverabilityScore: aiAnalysis.housingAnalysis.deliverabilityScore,
        marketAbsorptionRate: aiAnalysis.housingAnalysis.marketAbsorptionRate,
        viabilityAssessment: aiAnalysis.housingAnalysis.viabilityAssessment,
        phaseOptimization: aiAnalysis.housingAnalysis.phaseOptimization,
        densityRecommendations: aiAnalysis.housingAnalysis.densityRecommendations,
        affordabilityStrategy: aiAnalysis.housingAnalysis.affordabilityStrategy,
        spatialDistributionAdvice: aiAnalysis.housingAnalysis.spatialDistribution,
        riskMitigation: aiAnalysis.housingAnalysis.riskMitigation,
        confidence: aiAnalysis.confidence
      };

      // Adjust base metrics based on AI insights
      if (aiAnalysis.housingAnalysis.adjustedAnnualDelivery) {
        baseAssessment.aiAdjustedDelivery = aiAnalysis.housingAnalysis.adjustedAnnualDelivery;
      }
    }

    return baseAssessment;
  }

  /**
   * Assess employment impacts
   */
  async _assessEmploymentImpacts(parameters, siteAllocations, aiAnalysis = null) {
    const employment = parameters.employment;
    
    // Calculate employment land needs by sector
    const landNeeds = {
      office: (employment.totalJobs * employment.sectorMix.office / 100) / 25, // 25 jobs per hectare
      industrial: (employment.totalJobs * employment.sectorMix.industrial / 100) / 15, // 15 jobs per hectare
      retail: (employment.totalJobs * employment.sectorMix.retail / 100) / 35, // 35 jobs per hectare
      other: (employment.totalJobs * employment.sectorMix.other / 100) / 20 // 20 jobs per hectare
    };

    const totalLandNeeded = Object.values(landNeeds).reduce((sum, need) => sum + need, 0);

    // Assess employment sites
    const employmentSites = siteAllocations.filter(site => 
      site.constraints?.some(c => c.includes('employment')) || 
      site.name?.toLowerCase().includes('employment')
    );

    const employmentLandAllocated = employmentSites.reduce((sum, site) => 
      sum + this._estimateSiteArea(site), 0);

    return {
      totalJobs: employment.totalJobs,
      sectorBreakdown: {
        office: Math.round(employment.totalJobs * employment.sectorMix.office / 100),
        industrial: Math.round(employment.totalJobs * employment.sectorMix.industrial / 100),
        retail: Math.round(employment.totalJobs * employment.sectorMix.retail / 100),
        other: Math.round(employment.totalJobs * employment.sectorMix.other / 100)
      },
      landNeeds,
      totalLandNeeded,
      employmentLandAllocated,
      landShortfall: totalLandNeeded - employmentLandAllocated,
      jobDensity: totalLandNeeded > 0 ? employment.totalJobs / totalLandNeeded : 0
    };
  }

  /**
   * Assess transport impacts
   */
  async _assessTransportImpacts(parameters, siteAllocations, aiAnalysis = null) {
    const housing = parameters.housing;
    const employment = parameters.employment;
    const infrastructure = parameters.infrastructure;

    // Calculate trip generation
    const housingTrips = housing.totalUnits * 8; // Average trips per household per day
    const employmentTrips = employment.totalJobs * 2; // Average trips per job per day
    const totalTrips = housingTrips + employmentTrips;

    // Assess parking needs
    const parkingSpaces = Math.round(housing.totalUnits * infrastructure.transport.parkingRatio);

    // Assess public transport capacity
    const busCapacityNeeded = Math.ceil(totalTrips * 0.2 / 50); // Assume 20% public transport mode share, 50 passengers per bus
    const busRoutes = infrastructure.transport.busRoutes;

    return {
      totalTrips,
      housingTrips,
      employmentTrips,
      parkingSpaces,
      busCapacityNeeded,
      busRoutesPlanned: busRoutes,
      busCapacityShortfall: Math.max(0, busCapacityNeeded - busRoutes),
      trafficImpact: this._assessTrafficImpact(totalTrips),
      sustainabilityScore: this._calculateTransportSustainability(parameters)
    };
  }

  /**
   * Assess environmental impacts
   */
  async _assessEnvironmentalImpacts(parameters, siteAllocations, aiAnalysis = null) {
    const environment = parameters.environment;
    const housing = parameters.housing;

    // Calculate total development area
    const totalDevArea = siteAllocations.reduce((sum, site) => 
      sum + this._estimateSiteArea(site), 0);

    // Calculate green space provision
    const greenSpaceRequired = totalDevArea * (environment.greenSpacePercentage / 100);
    const greenSpacePerResident = housing.totalUnits > 0 ? 
      (greenSpaceRequired * 10000) / (housing.totalUnits * 2.4) : 0; // m² per person (assume 2.4 people per household)

    // Biodiversity impact
    const biodiversityGain = environment.biodiversityNetGain;
    const biodiversityArea = totalDevArea * (biodiversityGain / 100);

    // Carbon impact
    const carbonEmissions = this._calculateCarbonEmissions(parameters);
    const renewableGeneration = this._calculateRenewableGeneration(parameters);

    return {
      totalDevelopmentArea: totalDevArea,
      greenSpaceRequired,
      greenSpacePerResident,
      biodiversityNetGain: biodiversityGain,
      biodiversityArea,
      carbonEmissions,
      renewableGeneration,
      netCarbonImpact: carbonEmissions - renewableGeneration,
      environmentalRisk: this._assessEnvironmentalRisk(parameters, siteAllocations),
      sustainabilityRating: this._calculateSustainabilityRating(environment)
    };
  }

  /**
   * Assess infrastructure needs
   */
  async _assessInfrastructureNeeds(parameters, siteAllocations, aiAnalysis = null) {
    const housing = parameters.housing;
    const infrastructure = parameters.infrastructure;
    const population = housing.totalUnits * 2.4; // Average household size

    // School places needed
    const primaryPlaces = Math.round(population * 0.12); // 12% primary age
    const secondaryPlaces = Math.round(population * 0.08); // 8% secondary age

    // Healthcare needs
    const gpPatients = population;
    const gpCapacity = infrastructure.healthcare.gp * 2000; // 2000 patients per GP

    // Utilities
    const electricityDemand = housing.totalUnits * 4.8; // kW per household
    const waterDemand = population * 150; // litres per person per day

    return {
      population,
      education: {
        primaryPlaces,
        secondaryPlaces,
        primarySchoolsNeeded: Math.ceil(primaryPlaces / 420), // 420 places per primary school
        secondarySchoolsNeeded: Math.ceil(secondaryPlaces / 900) // 900 places per secondary school
      },
      healthcare: {
        gpPatients,
        gpCapacity,
        additionalGPsNeeded: Math.max(0, Math.ceil((gpPatients - gpCapacity) / 2000))
      },
      utilities: {
        electricityDemand,
        waterDemand,
        wasteGeneration: population * 400 // kg per person per year
      },
      costs: this._estimateInfrastructureCosts(parameters)
    };
  }

  /**
   * Assess scenario viability
   */
  async _assessViability(parameters, siteAllocations, aiAnalysis = null) {
    const housing = parameters.housing;
    const employment = parameters.employment;

    // Revenue calculations
    const averageHousePrice = 250000; // £250k average
    const totalHousingRevenue = housing.totalUnits * averageHousePrice;
    
    const commercialRevenue = employment.totalJobs * 15000; // £15k per job revenue

    // Cost calculations
    const constructionCosts = housing.totalUnits * 120000; // £120k per unit
    const infrastructureCosts = this._estimateInfrastructureCosts(parameters);
    const landCosts = siteAllocations.length * 2000000; // £2m per site average

    const totalCosts = constructionCosts + infrastructureCosts + landCosts;
    const totalRevenue = totalHousingRevenue + commercialRevenue;

    const viabilityGap = totalCosts - totalRevenue;
    const viabilityRatio = totalRevenue / totalCosts;

    return {
      totalRevenue,
      totalCosts,
      viabilityGap,
      viabilityRatio,
      viabilityStatus: viabilityRatio >= 1.1 ? 'viable' : 
                       viabilityRatio >= 0.9 ? 'marginal' : 'unviable',
      keyRisks: this._identifyViabilityRisks(viabilityRatio, viabilityGap),
      mitigation: this._suggestViabilityMitigation(viabilityGap)
    };
  }

  /**
   * Identify scenario risks
   */
  async _identifyRisks(parameters, siteAllocations, aiAnalysis = null) {
    const risks = [];

    // Delivery risks
    if (parameters.housing.phasing < 5) {
      risks.push({
        category: 'delivery',
        level: 'high',
        description: 'Accelerated delivery timeline may be challenging',
        impact: 'Potential delays in housing delivery'
      });
    }

    // Market risks
    if (parameters.housing.totalUnits > 1500) {
      risks.push({
        category: 'market',
        level: 'medium',
        description: 'Large housing numbers may saturate local market',
        impact: 'Slower sales rates and extended delivery'
      });
    }

    // Infrastructure risks
    const infraCosts = this._estimateInfrastructureCosts(parameters);
    if (infraCosts > 50000000) { // £50m threshold
      risks.push({
        category: 'infrastructure',
        level: 'high',
        description: 'High infrastructure costs may affect viability',
        impact: 'Potential funding gaps for essential infrastructure'
      });
    }

    // Environmental risks
    if (parameters.environment.biodiversityNetGain < 10) {
      risks.push({
        category: 'environmental',
        level: 'medium',
        description: 'Biodiversity net gain target below best practice',
        impact: 'Potential regulatory challenges'
      });
    }

    return risks;
  }

  /**
   * Generate delivery timeline
   */
  _generateTimeline(parameters) {
    const phases = [];
    const totalYears = parameters.housing.phasing;
    const unitsPerYear = parameters.housing.totalUnits / totalYears;

    for (let year = 1; year <= totalYears; year++) {
      phases.push({
        year,
        phase: `Phase ${year}`,
        housingUnits: Math.round(unitsPerYear),
        milestones: this._generateMilestones(year, totalYears),
        cumulativeUnits: Math.round(unitsPerYear * year)
      });
    }

    return {
      totalDuration: totalYears,
      phases,
      criticalPath: this._identifyCriticalPath(phases)
    };
  }

  /**
   * Generate scenario summary
   */
  _generateSummary(results, aiAnalysis = null) {
    const baseSummary = {
      overallViability: results.viability.viabilityStatus,
      keyMetrics: {
        housingDelivery: results.housing.totalUnits,
        jobCreation: results.employment.totalJobs,
        infrastructureCost: results.infrastructure.costs.total,
        carbonImpact: results.environment.netCarbonImpact,
        viabilityGap: results.viability.viabilityGap
      },
      riskLevel: this._calculateOverallRisk(results.risks),
      recommendations: this._generateRecommendations(results),
      successProbability: this._calculateSuccessProbability(results)
    };

    // Enhance with AI insights if available
    if (aiAnalysis && aiAnalysis.overallAssessment) {
      baseSummary.aiEnhancement = {
        overallScore: aiAnalysis.overallAssessment.score,
        strategicRecommendations: aiAnalysis.overallAssessment.recommendations,
        criticalSuccessFactors: aiAnalysis.overallAssessment.successFactors,
        implementationPriorities: aiAnalysis.overallAssessment.priorities,
        riskAdjustedProbability: aiAnalysis.overallAssessment.adjustedSuccessProbability,
        optimizationPotential: aiAnalysis.overallAssessment.optimizationPotential,
        confidence: aiAnalysis.confidence,
        keyInsights: aiAnalysis.reasoning
      };

      // AI-adjusted success probability
      if (aiAnalysis.overallAssessment.adjustedSuccessProbability) {
        baseSummary.aiAdjustedSuccessProbability = aiAnalysis.overallAssessment.adjustedSuccessProbability;
      }
    }

    return baseSummary;
  }

  /**
   * Compare two scenarios
   */
  async compareScenarios(scenario1Id, scenario2Id) {
    const [scenario1, scenario2] = await Promise.all([
      this.db.scenarios.get(scenario1Id),
      this.db.scenarios.get(scenario2Id)
    ]);

    if (!scenario1 || !scenario2) {
      throw new Error('One or both scenarios not found');
    }

    if (!scenario1.results || !scenario2.results) {
      throw new Error('Both scenarios must be modeled before comparison');
    }

    return {
      scenarios: [
        { id: scenario1Id, name: scenario1.name, results: scenario1.results },
        { id: scenario2Id, name: scenario2.name, results: scenario2.results }
      ],
      comparison: {
        housing: this._compareHousing(scenario1.results.housing, scenario2.results.housing),
        employment: this._compareEmployment(scenario1.results.employment, scenario2.results.employment),
        viability: this._compareViability(scenario1.results.viability, scenario2.results.viability),
        environment: this._compareEnvironment(scenario1.results.environment, scenario2.results.environment),
        risks: this._compareRisks(scenario1.results.risks, scenario2.results.risks)
      },
      recommendation: this._generateComparisonRecommendation(scenario1.results, scenario2.results)
    };
  }

  /**
   * Utility methods
   */
  _mergeParameters(defaults, updates) {
    const merged = JSON.parse(JSON.stringify(defaults));
    
    function deepMerge(target, source) {
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) target[key] = {};
          deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }
    
    deepMerge(merged, updates);
    return merged;
  }

  _estimateSiteArea(site) {
    // Rough estimation from geometry or capacity
    if (site.geometry?.area) {
      return site.geometry.area / 10000; // Convert m² to hectares
    }
    if (site.capacity) {
      return site.capacity / 30; // Assume 30 units per hectare average
    }
    return 1; // Default 1 hectare
  }

  _estimateInfrastructureCosts(parameters) {
    const housing = parameters.housing;
    const employment = parameters.employment;
    
    const costs = {
      education: housing.totalUnits * 2000, // £2k per unit
      healthcare: housing.totalUnits * 500, // £500 per unit
      transport: housing.totalUnits * 3000, // £3k per unit
      utilities: housing.totalUnits * 1500, // £1.5k per unit
      greenInfrastructure: housing.totalUnits * 1000 // £1k per unit
    };
    
    costs.total = Object.values(costs).reduce((sum, cost) => sum + cost, 0);
    return costs;
  }

  _assessDeliveryFeasibility(annualDelivery, siteCount) {
    if (annualDelivery > 200 && siteCount < 3) return 'challenging';
    if (annualDelivery > 100 && siteCount < 2) return 'difficult';
    return 'feasible';
  }

  _identifyHousingRisks(housing, capacityShortfall) {
    const risks = [];
    
    if (capacityShortfall > 0) {
      risks.push('Insufficient allocated capacity');
    }
    if (housing.densityRange.max > 50) {
      risks.push('High density may face local opposition');
    }
    if (housing.affordablePercentage > 40) {
      risks.push('High affordable housing target may affect viability');
    }
    
    return risks;
  }

  _calculateOverallRisk(risks) {
    const highRisks = risks.filter(r => r.level === 'high').length;
    const mediumRisks = risks.filter(r => r.level === 'medium').length;
    
    if (highRisks > 2) return 'high';
    if (highRisks > 0 || mediumRisks > 3) return 'medium';
    return 'low';
  }

  _calculateSuccessProbability(results) {
    let score = 100;
    
    if (results.viability.viabilityStatus === 'unviable') score -= 40;
    if (results.viability.viabilityStatus === 'marginal') score -= 20;
    
    score -= results.risks.filter(r => r.level === 'high').length * 15;
    score -= results.risks.filter(r => r.level === 'medium').length * 8;
    
    if (results.housing.deliveryFeasibility === 'challenging') score -= 15;
    if (results.housing.deliveryFeasibility === 'difficult') score -= 25;
    
    return Math.max(0, Math.min(100, score));
  }

  // Additional utility methods for calculations...
  _assessTrafficImpact(totalTrips) {
    if (totalTrips > 10000) return 'high';
    if (totalTrips > 5000) return 'medium';
    return 'low';
  }

  _calculateTransportSustainability(parameters) {
    // Simplified calculation
    return Math.min(100, parameters.infrastructure.transport.busRoutes * 25);
  }

  _calculateCarbonEmissions(parameters) {
    return parameters.housing.totalUnits * 2.5; // tonnes CO2 per unit per year
  }

  _calculateRenewableGeneration(parameters) {
    return parameters.housing.totalUnits * parameters.environment.renewableEnergyTarget / 100;
  }

  _assessEnvironmentalRisk(parameters, siteAllocations) {
    // Simplified risk assessment
    const constrainedSites = siteAllocations.filter(site => 
      site.constraints && site.constraints.length > 0
    ).length;
    
    return constrainedSites / siteAllocations.length > 0.5 ? 'high' : 'medium';
  }

  _calculateSustainabilityRating(environment) {
    let score = 0;
    score += Math.min(25, environment.greenSpacePercentage);
    score += Math.min(25, environment.biodiversityNetGain * 2.5);
    score += Math.min(50, environment.renewableEnergyTarget * 2.5);
    return Math.round(score);
  }

  _identifyViabilityRisks(ratio, gap) {
    const risks = [];
    if (ratio < 0.9) risks.push('Significant viability deficit');
    if (gap > 10000000) risks.push('Large funding gap');
    return risks;
  }

  _suggestViabilityMitigation(gap) {
    const suggestions = [];
    if (gap > 0) {
      suggestions.push('Seek public funding support');
      suggestions.push('Consider phased delivery');
      suggestions.push('Review affordable housing requirements');
    }
    return suggestions;
  }

  _generateMilestones(year, totalYears) {
    const milestones = [];
    if (year === 1) milestones.push('Planning permission secured');
    if (year === Math.ceil(totalYears / 2)) milestones.push('50% completion');
    if (year === totalYears) milestones.push('Development complete');
    return milestones;
  }

  _identifyCriticalPath(phases) {
    return phases.map(phase => ({
      phase: phase.phase,
      dependencies: phase.year === 1 ? ['Planning permission'] : [`Phase ${phase.year - 1} complete`],
      duration: 12, // months
      criticalActivity: 'Housing construction'
    }));
  }

  _generateRecommendations(results) {
    const recommendations = [];
    
    if (results.viability.viabilityStatus === 'unviable') {
      recommendations.push('Review development parameters to improve viability');
    }
    
    if (results.transport.busCapacityShortfall > 0) {
      recommendations.push('Enhance public transport provision');
    }
    
    if (results.environment.netCarbonImpact > 0) {
      recommendations.push('Increase renewable energy provision');
    }
    
    return recommendations;
  }

  // Comparison methods
  _compareHousing(h1, h2) {
    return {
      totalUnits: { scenario1: h1.totalUnits, scenario2: h2.totalUnits, difference: h2.totalUnits - h1.totalUnits },
      affordableUnits: { scenario1: h1.affordableUnits, scenario2: h2.affordableUnits, difference: h2.affordableUnits - h1.affordableUnits },
      deliveryFeasibility: { scenario1: h1.deliveryFeasibility, scenario2: h2.deliveryFeasibility }
    };
  }

  _compareEmployment(e1, e2) {
    return {
      totalJobs: { scenario1: e1.totalJobs, scenario2: e2.totalJobs, difference: e2.totalJobs - e1.totalJobs },
      landNeeded: { scenario1: e1.totalLandNeeded, scenario2: e2.totalLandNeeded, difference: e2.totalLandNeeded - e1.totalLandNeeded }
    };
  }

  _compareViability(v1, v2) {
    return {
      viabilityRatio: { scenario1: v1.viabilityRatio, scenario2: v2.viabilityRatio, difference: v2.viabilityRatio - v1.viabilityRatio },
      viabilityGap: { scenario1: v1.viabilityGap, scenario2: v2.viabilityGap, difference: v2.viabilityGap - v1.viabilityGap },
      status: { scenario1: v1.viabilityStatus, scenario2: v2.viabilityStatus }
    };
  }

  _compareEnvironment(env1, env2) {
    return {
      carbonImpact: { scenario1: env1.netCarbonImpact, scenario2: env2.netCarbonImpact, difference: env2.netCarbonImpact - env1.netCarbonImpact },
      sustainabilityRating: { scenario1: env1.sustainabilityRating, scenario2: env2.sustainabilityRating, difference: env2.sustainabilityRating - env1.sustainabilityRating }
    };
  }

  _compareRisks(risks1, risks2) {
    return {
      riskCount: { scenario1: risks1.length, scenario2: risks2.length, difference: risks2.length - risks1.length },
      highRisks: { 
        scenario1: risks1.filter(r => r.level === 'high').length, 
        scenario2: risks2.filter(r => r.level === 'high').length 
      }
    };
  }

  _generateComparisonRecommendation(results1, results2) {
    const score1 = this._calculateSuccessProbability(results1);
    const score2 = this._calculateSuccessProbability(results2);
    
    if (score1 > score2 + 10) {
      return 'Scenario 1 is recommended based on higher success probability';
    } else if (score2 > score1 + 10) {
      return 'Scenario 2 is recommended based on higher success probability';
    } else {
      return 'Both scenarios have similar viability - consider hybrid approach';
    }
  }

  /**
   * Get scenarios for a local plan
   */
  async getScenarios(planId) {
    const scenarios = await this.db.scenarios
      .where('planId')
      .equals(planId)
      .toArray();
    
    // Sort by updatedAt in descending order (most recent first)
    return scenarios.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  /**
   * Delete scenario
   */
  async deleteScenario(scenarioId) {
    await this.db.scenarios.delete(scenarioId);
    return true;
  }
}
