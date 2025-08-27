export default class MaterialConsiderations {
  constructor(database) {
    this.database = database;
    this.considerationsCache = new Map();
    this.policyWeights = new Map();
    this.contextualFactors = new Map();
  }

  async initialize() {
    await this.loadConsiderations();
    await this.initializePolicyWeights();
  }

  async loadConsiderations() {
    if (!this.database) return;
    
    const considerations = await this.database.materialConsiderations.toArray();
    
    // Group by category for easier access
    for (const consideration of considerations) {
      const category = consideration.category;
      if (!this.considerationsCache.has(category)) {
        this.considerationsCache.set(category, []);
      }
      this.considerationsCache.get(category).push(consideration);
    }
  }

  async initializePolicyWeights() {
    // Default weights for different policy types
    const defaultWeights = {
      'NPPF': 100,
      'Local Plan Policy': 95,
      'Supplementary Planning Document': 75,
      'Planning Practice Guidance': 80,
      'Ministerial Statement': 85,
      'Appeal Decision': 70,
      'Court Judgment': 90,
      'Committee Resolution': 60
    };

    for (const [policy, weight] of Object.entries(defaultWeights)) {
      this.policyWeights.set(policy, weight);
    }
  }

  async assessApplication(applicationData, spatialAnalysis, documentAnalysis) {
    const assessment = {
      overallRecommendation: null,
      confidence: 0,
      keyConsiderations: [],
      policyCompliance: {},
      materialConsiderations: {},
      balancingExercise: {},
      evidenceBase: []
    };

    // Assess each category of material considerations
    for (const [category, considerations] of this.considerationsCache) {
      const categoryAssessment = await this.assessCategory(
        category, 
        considerations, 
        applicationData, 
        spatialAnalysis, 
        documentAnalysis
      );
      
      assessment.materialConsiderations[category] = categoryAssessment;
    }

    // Perform balancing exercise
    assessment.balancingExercise = await this.performBalancingExercise(assessment.materialConsiderations);
    
    // Generate overall recommendation
    assessment.overallRecommendation = this.generateRecommendation(assessment.balancingExercise);
    assessment.confidence = this.calculateConfidence(assessment);

    return assessment;
  }

  async assessCategory(category, considerations, applicationData, spatialAnalysis, documentAnalysis) {
    const assessment = {
      category: category,
      overallScore: 0,
      confidence: 0,
      considerations: [],
      keyIssues: [],
      supportingEvidence: [],
      recommendedConditions: []
    };

    for (const consideration of considerations) {
      const considerationAssessment = await this.assessIndividualConsideration(
        consideration,
        applicationData,
        spatialAnalysis,
        documentAnalysis
      );
      
      assessment.considerations.push(considerationAssessment);
      
      // Accumulate scores
      assessment.overallScore += considerationAssessment.score * (consideration.weight / 100);
      
      // Identify key issues
      if (considerationAssessment.significance === 'high' || considerationAssessment.score < 30) {
        assessment.keyIssues.push({
          consideration: consideration.description,
          issue: considerationAssessment.analysis,
          severity: considerationAssessment.score < 30 ? 'critical' : 'significant'
        });
      }
    }

    assessment.confidence = this.calculateCategoryConfidence(assessment.considerations);
    
    return assessment;
  }

  async assessIndividualConsideration(consideration, applicationData, spatialAnalysis, documentAnalysis) {
    let assessment = {
      id: consideration.id,
      description: consideration.description,
      category: consideration.category,
      subcategory: consideration.subcategory,
      score: 50, // Neutral starting point
      significance: 'low',
      analysis: '',
      evidence: [],
      confidence: 0.5,
      policyReferences: [],
      conditions: []
    };

    // Assess based on consideration type
    switch (consideration.subcategory) {
      case 'Character and Appearance':
        assessment = await this.assessCharacterAndAppearance(assessment, applicationData, spatialAnalysis, documentAnalysis);
        break;
        
      case 'Highway Safety':
        assessment = await this.assessHighwaySafety(assessment, applicationData, spatialAnalysis, documentAnalysis);
        break;
        
      case 'Listed Buildings':
        assessment = await this.assessListedBuildings(assessment, applicationData, spatialAnalysis, documentAnalysis);
        break;
        
      case 'Conservation Areas':
        assessment = await this.assessConservationAreas(assessment, applicationData, spatialAnalysis, documentAnalysis);
        break;
        
      case 'Flood Risk':
        assessment = await this.assessFloodRisk(assessment, applicationData, spatialAnalysis, documentAnalysis);
        break;
        
      case 'Privacy and Overlooking':
        assessment = await this.assessPrivacyOverlooking(assessment, applicationData, spatialAnalysis, documentAnalysis);
        break;
        
      case 'Affordable Housing':
        assessment = await this.assessAffordableHousing(assessment, applicationData, spatialAnalysis, documentAnalysis);
        break;
        
      case 'Parking Provision':
        assessment = await this.assessParkingProvision(assessment, applicationData, spatialAnalysis, documentAnalysis);
        break;
        
      default:
        assessment = await this.assessGenericConsideration(assessment, applicationData, spatialAnalysis, documentAnalysis);
    }

    return assessment;
  }

  async assessCharacterAndAppearance(assessment, applicationData, spatialAnalysis, documentAnalysis) {
    assessment.significance = 'high';
    
    // Check for conservation area
    const inConservationArea = spatialAnalysis.intersections?.conservationAreas?.length > 0;
    const nearListedBuildings = spatialAnalysis.proximities?.listedBuildings?.length > 0;
    
    if (inConservationArea) {
      assessment.score -= 20;
      assessment.analysis = 'Site located within Conservation Area - character and appearance considerations are critical. ';
      assessment.evidence.push({
        type: 'spatial',
        description: `Site overlaps ${spatialAnalysis.intersections.conservationAreas[0].name}`,
        impact: 'high'
      });
      assessment.policyReferences.push('NPPF paragraphs 199-202');
    }
    
    if (nearListedBuildings) {
      const closest = spatialAnalysis.proximities.listedBuildings[0];
      if (closest.distance < 100) {
        assessment.score -= 15;
        assessment.analysis += `Adjacent to listed building (${closest.distance}m away) - setting considerations apply. `;
        assessment.evidence.push({
          type: 'spatial',
          description: `${closest.distance}m from ${closest.name}`,
          impact: 'medium'
        });
      }
    }
    
    // Analyze scale and massing from documents
    if (documentAnalysis.heightExtracted) {
      const maxHeight = Math.max(...documentAnalysis.heightExtracted);
      if (maxHeight > 18) { // Over 6 stories
        assessment.score -= 10;
        assessment.analysis += `Proposed height of ${maxHeight}m may impact local character. `;
        assessment.conditions.push('Materials and design details to be agreed');
      }
    }
    
    assessment.confidence = 0.7;
    return assessment;
  }

  async assessHighwaySafety(assessment, applicationData, spatialAnalysis, documentAnalysis) {
    assessment.significance = 'high';
    assessment.analysis = 'Highway safety assessment based on access arrangements and traffic generation. ';
    
    // Check for access arrangements in documents
    if (documentAnalysis.accessMentioned) {
      assessment.score += 10;
      assessment.analysis += 'Access arrangements described in submitted documents. ';
    } else {
      assessment.score -= 20;
      assessment.analysis += 'No clear access arrangements provided - highway safety concerns. ';
      assessment.conditions.push('Access details to be agreed with Highway Authority');
    }
    
    // Check proximity to major roads
    const proximityToRoads = spatialAnalysis.contextualFactors?.roadNetworkAccess;
    if (proximityToRoads === 'major_road') {
      assessment.score -= 5;
      assessment.analysis += 'Direct access to major road may create safety concerns. ';
    }
    
    assessment.confidence = 0.6;
    return assessment;
  }

  async assessListedBuildings(assessment, applicationData, spatialAnalysis, documentAnalysis) {
    const listedBuildingsNearby = spatialAnalysis.proximities?.listedBuildings || [];
    
    if (listedBuildingsNearby.length === 0) {
      assessment.significance = 'not_applicable';
      assessment.analysis = 'No listed buildings in proximity - consideration not applicable.';
      assessment.score = 100; // No impact
      assessment.confidence = 1.0;
      return assessment;
    }
    
    assessment.significance = 'high';
    assessment.policyReferences.push('NPPF paragraphs 199-202', 'Planning (Listed Buildings and Conservation Areas) Act 1990');
    
    const closest = listedBuildingsNearby[0];
    
    if (closest.distance < 50) {
      assessment.score = 20; // Potentially severe impact
      assessment.analysis = `Development within ${closest.distance}m of Grade ${closest.grade || 'II'} listed ${closest.name}. Substantial harm to setting likely. `;
      assessment.evidence.push({
        type: 'spatial',
        description: `${closest.distance}m from ${closest.name}`,
        impact: 'high',
        statutory: true
      });
    } else if (closest.distance < 200) {
      assessment.score = 40;
      assessment.analysis = `Development ${closest.distance}m from listed building. Some impact on setting possible. `;
      assessment.conditions.push('Heritage Impact Assessment required');
    } else {
      assessment.score = 70;
      assessment.analysis = `Listed building ${closest.distance}m away. Minimal impact on setting expected. `;
    }
    
    assessment.confidence = 0.8;
    return assessment;
  }

  async assessConservationAreas(assessment, applicationData, spatialAnalysis, documentAnalysis) {
    const conservationAreaOverlap = spatialAnalysis.intersections?.conservationAreas || [];
    
    if (conservationAreaOverlap.length === 0) {
      assessment.significance = 'not_applicable';
      assessment.analysis = 'Site not within Conservation Area - consideration not applicable.';
      assessment.score = 100;
      assessment.confidence = 1.0;
      return assessment;
    }
    
    assessment.significance = 'high';
    assessment.policyReferences.push('NPPF paragraphs 199-202', 'Planning (Listed Buildings and Conservation Areas) Act 1990 s.72');
    
    const overlap = conservationAreaOverlap[0];
    assessment.analysis = `Site ${overlap.coveragePercent}% within ${overlap.name}. `;
    
    if (overlap.coveragePercent > 75) {
      assessment.score = 30; // Significant constraints
      assessment.analysis += 'Majority of site within Conservation Area - special attention to character required. ';
    } else if (overlap.coveragePercent > 25) {
      assessment.score = 50;
      assessment.analysis += 'Partial overlap with Conservation Area - character considerations apply. ';
    } else {
      assessment.score = 70;
      assessment.analysis += 'Minor overlap with Conservation Area - limited character impact. ';
    }
    
    assessment.conditions.push('Conservation Area Consent may be required for demolition');
    assessment.conditions.push('Materials and design to preserve or enhance character');
    
    assessment.confidence = 0.9;
    return assessment;
  }

  async assessFloodRisk(assessment, applicationData, spatialAnalysis, documentAnalysis) {
    const floodZoneOverlap = spatialAnalysis.intersections?.floodZones || [];
    
    if (floodZoneOverlap.length === 0) {
      assessment.score = 100;
      assessment.analysis = 'Site not within identified flood risk area.';
      assessment.significance = 'low';
      assessment.confidence = 0.8;
      return assessment;
    }
    
    assessment.significance = 'high';
    assessment.policyReferences.push('NPPF paragraphs 159-169');
    
    const overlap = floodZoneOverlap[0];
    const floodZone = overlap.name;
    
    if (floodZone.includes('Zone 3')) {
      assessment.score = 10; // High risk
      assessment.analysis = `${overlap.coveragePercent}% of site in Flood Zone 3 (high probability). Development generally inappropriate. `;
      assessment.conditions.push('Flood Risk Assessment required');
      assessment.conditions.push('Sequential Test required');
    } else if (floodZone.includes('Zone 2')) {
      assessment.score = 40;
      assessment.analysis = `${overlap.coveragePercent}% of site in Flood Zone 2 (medium probability). Flood Risk Assessment required. `;
      assessment.conditions.push('Flood Risk Assessment required');
    } else {
      assessment.score = 80;
      assessment.analysis = `Site in low flood risk area. Standard drainage considerations apply. `;
    }
    
    assessment.confidence = 0.9;
    return assessment;
  }

  async assessPrivacyOverlooking(assessment, applicationData, spatialAnalysis, documentAnalysis) {
    assessment.significance = 'medium';
    assessment.analysis = 'Privacy and overlooking assessment based on proximity to existing dwellings. ';
    
    // This would need detailed building analysis and window positions
    // For now, assess based on general principles
    
    if (documentAnalysis.heightExtracted) {
      const maxHeight = Math.max(...documentAnalysis.heightExtracted);
      if (maxHeight > 12) { // Over 4 stories
        assessment.score -= 15;
        assessment.analysis += `Height of ${maxHeight}m increases overlooking potential. `;
        assessment.conditions.push('Window positions and screening to prevent overlooking');
      }
    }
    
    // Check for residential properties nearby (would need land use data)
    assessment.score = 60; // Neutral assumption
    assessment.analysis += 'Standard separation distances should be maintained. ';
    
    assessment.confidence = 0.5; // Lower confidence without detailed neighbor analysis
    return assessment;
  }

  async assessAffordableHousing(assessment, applicationData, spatialAnalysis, documentAnalysis) {
    if (!documentAnalysis.housingUnitsExtracted || documentAnalysis.housingUnitsExtracted < 10) {
      assessment.significance = 'not_applicable';
      assessment.analysis = 'Development below affordable housing threshold.';
      assessment.score = 100;
      assessment.confidence = 0.8;
      return assessment;
    }
    
    assessment.significance = 'high';
    assessment.policyReferences.push('NPPF paragraph 64');
    
    const totalUnits = documentAnalysis.housingUnitsExtracted;
    const affordableUnits = documentAnalysis.affordableUnitsExtracted || 0;
    const affordablePercent = (affordableUnits / totalUnits) * 100;
    
    // Assume 30% affordable housing requirement (would be policy-specific)
    const requiredPercent = 30;
    
    if (affordablePercent >= requiredPercent) {
      assessment.score = 100;
      assessment.analysis = `${affordablePercent}% affordable housing provided (${affordableUnits}/${totalUnits} units). Meets policy requirement. `;
    } else if (affordablePercent > 0) {
      assessment.score = 50;
      assessment.analysis = `${affordablePercent}% affordable housing provided (${affordableUnits}/${totalUnits} units). Below ${requiredPercent}% requirement. `;
      assessment.conditions.push('Viability assessment required to justify shortfall');
    } else {
      assessment.score = 0;
      assessment.analysis = `No affordable housing provision identified. Policy requires ${requiredPercent}%. `;
      assessment.conditions.push('Affordable housing provision or financial contribution required');
    }
    
    assessment.confidence = 0.7;
    return assessment;
  }

  async assessParkingProvision(assessment, applicationData, spatialAnalysis, documentAnalysis) {
    assessment.significance = 'medium';
    
    const parkingSpaces = documentAnalysis.parkingSpacesExtracted || 0;
    const housingUnits = documentAnalysis.housingUnitsExtracted || 1;
    const parkingRatio = parkingSpaces / housingUnits;
    
    // PTAL-based parking requirements (London example)
    const ptal = spatialAnalysis.accessibilityAnalysis?.publicTransportAccessibilityLevel;
    let requiredRatio = 1.0; // Default
    
    if (ptal) {
      const ptalNumber = parseInt(ptal.replace(/[^0-9]/g, '')) || 0;
      if (ptalNumber >= 5) requiredRatio = 0.5;
      else if (ptalNumber >= 3) requiredRatio = 0.75;
      else if (ptalNumber >= 2) requiredRatio = 1.0;
      else requiredRatio = 1.5;
    }
    
    if (parkingRatio >= requiredRatio) {
      assessment.score = 80;
      assessment.analysis = `${parkingSpaces} parking spaces for ${housingUnits} units (${parkingRatio.toFixed(1)} per unit). Adequate provision. `;
    } else {
      const shortfall = Math.round((requiredRatio - parkingRatio) * housingUnits);
      assessment.score = 40;
      assessment.analysis = `${parkingSpaces} parking spaces for ${housingUnits} units. Shortfall of approximately ${shortfall} spaces. `;
      assessment.conditions.push('Car parking management plan required');
    }
    
    assessment.confidence = 0.6;
    return assessment;
  }

  async assessGenericConsideration(assessment, applicationData, spatialAnalysis, documentAnalysis) {
    // Default assessment for considerations without specific logic
    assessment.score = 60; // Neutral
    assessment.analysis = `${assessment.description} - detailed assessment required.`;
    assessment.confidence = 0.3;
    assessment.significance = 'medium';
    
    return assessment;
  }

  async performBalancingExercise(materialConsiderations) {
    const balancing = {
      weightsApplied: {},
      cumulativeScore: 0,
      significantBenefits: [],
      significantHarms: [],
      overallBalance: 'neutral',
      balancingNarrative: ''
    };

    let totalWeight = 0;
    let weightedScore = 0;

    // Apply weights to each category
    for (const [category, assessment] of Object.entries(materialConsiderations)) {
      const categoryWeight = this.getCategoryWeight(category);
      const weightedCategoryScore = assessment.overallScore * (categoryWeight / 100);
      
      balancing.weightsApplied[category] = {
        score: assessment.overallScore,
        weight: categoryWeight,
        weightedScore: weightedCategoryScore,
        significance: this.categorizeSignificance(assessment.overallScore)
      };
      
      totalWeight += categoryWeight;
      weightedScore += weightedCategoryScore;
      
      // Identify significant benefits and harms
      if (assessment.overallScore >= 80) {
        balancing.significantBenefits.push({
          category: category,
          score: assessment.overallScore,
          description: this.generateBenefitDescription(category, assessment)
        });
      } else if (assessment.overallScore <= 30) {
        balancing.significantHarms.push({
          category: category,
          score: assessment.overallScore,
          description: this.generateHarmDescription(category, assessment)
        });
      }
    }

    balancing.cumulativeScore = Math.round(weightedScore / totalWeight * 100) / 100;
    balancing.overallBalance = this.determineOverallBalance(balancing.cumulativeScore, balancing.significantBenefits, balancing.significantHarms);
    balancing.balancingNarrative = this.generateBalancingNarrative(balancing);

    return balancing;
  }

  getCategoryWeight(category) {
    // Category weights for planning balance
    const weights = {
      'Statutory': 100,
      'Heritage': 95,
      'Transport': 85,
      'Environment': 90,
      'Design': 80,
      'Amenity': 75,
      'Housing': 85,
      'Economic': 70,
      'Infrastructure': 65,
      'Climate': 70,
      'Procedural': 60,
      'Other': 50
    };
    
    return weights[category] || 50;
  }

  categorizeSignificance(score) {
    if (score >= 80) return 'significant_benefit';
    if (score >= 60) return 'minor_benefit';
    if (score >= 40) return 'neutral';
    if (score >= 20) return 'minor_harm';
    return 'significant_harm';
  }

  generateBenefitDescription(category, assessment) {
    return `${category} considerations strongly support the proposal (score: ${assessment.overallScore})`;
  }

  generateHarmDescription(category, assessment) {
    const keyIssues = assessment.keyIssues.map(issue => issue.consideration).join(', ');
    return `${category} considerations raise concerns: ${keyIssues} (score: ${assessment.overallScore})`;
  }

  determineOverallBalance(cumulativeScore, benefits, harms) {
    if (harms.length > 0 && harms.some(h => h.score < 20)) {
      return 'significant_harm_outweighs_benefits';
    }
    
    if (cumulativeScore >= 70) return 'benefits_outweigh_harms';
    if (cumulativeScore >= 50) return 'neutral_balance';
    if (cumulativeScore >= 30) return 'harms_outweigh_benefits';
    return 'significant_harm_outweighs_benefits';
  }

  generateBalancingNarrative(balancing) {
    let narrative = 'Planning Balance Assessment:\n\n';
    
    if (balancing.significantBenefits.length > 0) {
      narrative += 'Significant Benefits:\n';
      for (const benefit of balancing.significantBenefits) {
        narrative += `• ${benefit.description}\n`;
      }
      narrative += '\n';
    }
    
    if (balancing.significantHarms.length > 0) {
      narrative += 'Significant Harms/Concerns:\n';
      for (const harm of balancing.significantHarms) {
        narrative += `• ${harm.description}\n`;
      }
      narrative += '\n';
    }
    
    narrative += `Overall Assessment: ${balancing.overallBalance.replace(/_/g, ' ')} (Cumulative Score: ${balancing.cumulativeScore})\n\n`;
    
    switch (balancing.overallBalance) {
      case 'benefits_outweigh_harms':
        narrative += 'The identified benefits of the proposal are considered to outweigh any harms identified.';
        break;
      case 'neutral_balance':
        narrative += 'The proposal presents a balanced case with benefits and harms broadly offsetting each other.';
        break;
      case 'harms_outweigh_benefits':
        narrative += 'The identified harms outweigh the benefits of the proposal.';
        break;
      case 'significant_harm_outweighs_benefits':
        narrative += 'Significant harm has been identified that substantially outweighs any benefits.';
        break;
    }
    
    return narrative;
  }

  generateRecommendation(balancingExercise) {
    switch (balancingExercise.overallBalance) {
      case 'benefits_outweigh_harms':
        return {
          decision: 'approve',
          reasoning: 'Benefits outweigh any identified harms',
          confidence: 0.8
        };
      case 'neutral_balance':
        return {
          decision: 'approve',
          reasoning: 'Balanced proposal with acceptable impacts',
          confidence: 0.6
        };
      case 'harms_outweigh_benefits':
        return {
          decision: 'refuse',
          reasoning: 'Harms outweigh benefits',
          confidence: 0.7
        };
      case 'significant_harm_outweighs_benefits':
        return {
          decision: 'refuse',
          reasoning: 'Significant harm identified',
          confidence: 0.9
        };
      default:
        return {
          decision: 'defer',
          reasoning: 'Further information required',
          confidence: 0.3
        };
    }
  }

  calculateConfidence(assessment) {
    const considerations = Object.values(assessment.materialConsiderations);
    const totalConfidence = considerations.reduce((sum, cat) => sum + cat.confidence, 0);
    return Math.round((totalConfidence / considerations.length) * 100) / 100;
  }

  calculateCategoryConfidence(considerations) {
    if (considerations.length === 0) return 0;
    const totalConfidence = considerations.reduce((sum, cons) => sum + cons.confidence, 0);
    return Math.round((totalConfidence / considerations.length) * 100) / 100;
  }
}
