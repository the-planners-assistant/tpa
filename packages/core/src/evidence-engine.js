export default class EvidenceEngine {
  constructor(database, spatialAnalyzer) {
    this.database = database;
    this.spatialAnalyzer = spatialAnalyzer;
    this.evidenceCache = new Map();
    this.citationIndex = new Map();
    this.confidenceThresholds = {
      high: 0.8,
      medium: 0.6,
      low: 0.4
    };
  }

  async generateEvidence(assessmentId, documentData, spatialAnalysis, aiAnalysis) {
    const evidence = {
      assessmentId: assessmentId,
      spatial: [],
      textual: [],
      visual: [],
      policy: [],
      precedent: [],
      computed: [],
      citations: new Map()
    };

    // Generate spatial evidence
    evidence.spatial = await this.generateSpatialEvidence(spatialAnalysis);
    
    // Generate textual evidence from documents
    evidence.textual = await this.generateTextualEvidence(documentData);
    
    // Generate visual evidence from images
    evidence.visual = await this.generateVisualEvidence(documentData.images || []);
    
    // Generate policy evidence
    evidence.policy = await this.generatePolicyEvidence(documentData, spatialAnalysis);
    
    // Generate computed evidence (calculations, metrics)
    evidence.computed = await this.generateComputedEvidence(documentData, spatialAnalysis);
    
    // Create citation index
    evidence.citations = this.createCitationIndex(evidence);
    
    // Store evidence in database
    await this.storeEvidence(assessmentId, evidence);
    
    return evidence;
  }

  async generateSpatialEvidence(spatialAnalysis) {
    const evidence = [];
    
    // Site metrics evidence
    if (spatialAnalysis.siteMetrics) {
      const metrics = spatialAnalysis.siteMetrics;
      
      evidence.push({
        type: 'spatial_metric',
        category: 'site_characteristics',
        description: `Site area: ${metrics.area.toLocaleString()}m² (${(metrics.area / 10000).toFixed(2)} hectares)`,
        value: metrics.area,
        unit: 'm²',
        confidence: 1.0,
        source: 'calculated_from_boundary',
        citation: 'SITE_AREA_001'
      });
      
      if (metrics.frontageLength) {
        evidence.push({
          type: 'spatial_metric',
          category: 'site_characteristics',
          description: `Primary frontage length: ${metrics.frontageLength.toFixed(1)}m`,
          value: metrics.frontageLength,
          unit: 'm',
          confidence: 0.8,
          source: 'calculated_from_boundary',
          citation: 'FRONTAGE_001'
        });
      }
      
      if (metrics.aspectRatio) {
        let shapeDescription = 'regular';
        if (metrics.aspectRatio > 3) shapeDescription = 'elongated';
        else if (metrics.aspectRatio < 0.5) shapeDescription = 'narrow';
        
        evidence.push({
          type: 'spatial_metric',
          category: 'site_characteristics',
          description: `Site shape: ${shapeDescription} (aspect ratio ${metrics.aspectRatio})`,
          value: metrics.aspectRatio,
          unit: 'ratio',
          confidence: 0.9,
          source: 'calculated_from_boundary',
          citation: 'SHAPE_001'
        });
      }
    }
    
    // Constraint intersections
    if (spatialAnalysis.intersections) {
      for (const [constraintType, intersections] of Object.entries(spatialAnalysis.intersections)) {
        for (const intersection of intersections) {
          const severity = this.assessConstraintSeverity(constraintType, intersection);
          
          evidence.push({
            type: 'spatial_constraint',
            category: 'planning_constraints',
            constraintType: constraintType,
            description: this.formatConstraintDescription(constraintType, intersection),
            coverage: intersection.coveragePercent || null,
            area: intersection.area || null,
            severity: severity,
            confidence: 0.95,
            source: 'spatial_analysis',
            citation: `CONSTRAINT_${constraintType.toUpperCase()}_${intersection.featureId || '001'}`,
            policyImplications: this.getConstraintPolicyImplications(constraintType)
          });
        }
      }
    }
    
    // Proximity evidence
    if (spatialAnalysis.proximities) {
      for (const [featureType, proximities] of Object.entries(spatialAnalysis.proximities)) {
        for (let i = 0; i < Math.min(proximities.length, 3); i++) {
          const proximity = proximities[i];
          const accessibility = this.assessAccessibility(featureType, proximity.distance);
          
          evidence.push({
            type: 'spatial_proximity',
            category: 'accessibility',
            featureType: featureType,
            description: this.formatProximityDescription(featureType, proximity),
            distance: proximity.distance,
            accessibility: accessibility,
            confidence: 0.9,
            source: 'spatial_analysis',
            citation: `PROXIMITY_${featureType.toUpperCase()}_${String(i + 1).padStart(3, '0')}`,
            transportImplications: this.getTransportImplications(featureType, proximity.distance)
          });
        }
      }
    }
    
    // PTAL evidence
    if (spatialAnalysis.accessibilityAnalysis?.publicTransportAccessibilityLevel) {
      const ptal = spatialAnalysis.accessibilityAnalysis.publicTransportAccessibilityLevel;
      const ptalDescription = this.getPTALDescription(ptal);
      
      evidence.push({
        type: 'accessibility_rating',
        category: 'transport',
        description: `Public Transport Accessibility Level: ${ptal} (${ptalDescription})`,
        value: ptal,
        rating: ptalDescription,
        confidence: 0.7,
        source: 'calculated_ptal',
        citation: 'PTAL_001',
        policyImplications: this.getPTALPolicyImplications(ptal)
      });
    }
    
    return evidence;
  }

  async generateTextualEvidence(documentData) {
    const evidence = [];
    
    if (!documentData.chunks) return evidence;
    
    // Extract key planning information from text chunks
    for (let i = 0; i < documentData.chunks.length; i++) {
      const chunk = documentData.chunks[i];
      
      // Look for specific planning keywords and extract context
      const planningKeywords = [
        'affordable housing', 'parking', 'height', 'stories', 'storeys',
        'materials', 'access', 'transport', 'highway', 'heritage',
        'conservation', 'listed building', 'trees', 'landscape',
        'drainage', 'flood', 'ecology', 'biodiversity', 'noise',
        'air quality', 'contamination', 'viability', 'section 106',
        's106', 'community infrastructure levy', 'cil'
      ];
      
      for (const keyword of planningKeywords) {
        const regex = new RegExp(`\\b${keyword}\\b.*?[\\.!?]`, 'gi');
        const matches = chunk.content.match(regex);
        
        if (matches) {
          for (const match of matches) {
            evidence.push({
              type: 'textual_reference',
              category: this.categorizeKeyword(keyword),
              keyword: keyword,
              description: `Reference to ${keyword}: "${match.trim()}"`,
              context: match.trim(),
              confidence: 0.7,
              source: `document_chunk_${i}`,
              citation: `TEXT_${keyword.toUpperCase().replace(/\s+/g, '_')}_${String(evidence.length + 1).padStart(3, '0')}`,
              documentContext: {
                chunkIndex: i,
                documentName: documentData.name
              }
            });
          }
        }
      }
    }
    
    return evidence;
  }

  async generateVisualEvidence(images) {
    const evidence = [];
    
    if (!images || images.length === 0) return evidence;
    
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      
      // Classify image type
      const imageType = this.classifyImage(image);
      
      evidence.push({
        type: 'visual_evidence',
        category: 'visual_context',
        imageType: imageType,
        description: this.generateImageDescription(image, imageType),
        confidence: 0.6,
        source: `image_${i}`,
        citation: `IMAGE_${imageType.toUpperCase()}_${String(i + 1).padStart(3, '0')}`,
        analysisRequired: this.requiresDetailedAnalysis(imageType),
        imageData: {
          index: i,
          type: image.type,
          analysis: image.analysis || null
        }
      });
    }
    
    return evidence;
  }

  async generatePolicyEvidence(documentData, spatialAnalysis) {
    const evidence = [];
    
    // Load relevant policies based on spatial constraints and document content
    const relevantPolicies = await this.identifyRelevantPolicies(documentData, spatialAnalysis);
    
    for (const policy of relevantPolicies) {
      evidence.push({
        type: 'policy_reference',
        category: 'policy_compliance',
        policyType: policy.type,
        policyId: policy.id,
        description: `${policy.type} ${policy.id}: ${policy.title}`,
        content: policy.content,
        relevance: policy.relevance,
        compliance: policy.estimatedCompliance || 'unknown',
        confidence: policy.relevanceScore,
        source: policy.source,
        citation: `POLICY_${policy.type}_${policy.id}`.replace(/\s+/g, '_'),
        policyText: policy.content
      });
    }
    
    return evidence;
  }

  async generateComputedEvidence(documentData, spatialAnalysis) {
    const evidence = [];
    
    // Density calculations
    if (documentData.extractedData?.units && spatialAnalysis.siteMetrics?.area) {
      const density = (documentData.extractedData.units / spatialAnalysis.siteMetrics.area) * 10000; // per hectare
      
      evidence.push({
        type: 'computed_metric',
        category: 'development_density',
        description: `Proposed density: ${density.toFixed(0)} units per hectare`,
        value: density,
        unit: 'units/hectare',
        calculation: `${documentData.extractedData.units} units ÷ ${(spatialAnalysis.siteMetrics.area / 10000).toFixed(2)} hectares`,
        confidence: 0.8,
        source: 'calculated',
        citation: 'DENSITY_001'
      });
    }
    
    // Plot ratio calculations
    if (documentData.extractedData?.floorArea && spatialAnalysis.siteMetrics?.area) {
      const plotRatio = documentData.extractedData.floorArea / spatialAnalysis.siteMetrics.area;
      
      evidence.push({
        type: 'computed_metric',
        category: 'development_intensity',
        description: `Plot ratio: ${plotRatio.toFixed(2)}:1`,
        value: plotRatio,
        unit: 'ratio',
        calculation: `${documentData.extractedData.floorArea}m² GFA ÷ ${spatialAnalysis.siteMetrics.area}m² site area`,
        confidence: 0.7,
        source: 'calculated',
        citation: 'PLOT_RATIO_001'
      });
    }
    
    // Parking calculations
    if (documentData.extractedData?.parkingSpaces && documentData.extractedData?.units) {
      const parkingRatio = documentData.extractedData.parkingSpaces / documentData.extractedData.units;
      
      evidence.push({
        type: 'computed_metric',
        category: 'transport',
        description: `Parking provision: ${parkingRatio.toFixed(1)} spaces per unit`,
        value: parkingRatio,
        unit: 'spaces/unit',
        calculation: `${documentData.extractedData.parkingSpaces} spaces ÷ ${documentData.extractedData.units} units`,
        confidence: 0.8,
        source: 'calculated',
        citation: 'PARKING_RATIO_001'
      });
    }
    
    return evidence;
  }

  async identifyRelevantPolicies(documentData, spatialAnalysis) {
    const policies = [];
    
    // NPPF policies - always relevant
    policies.push({
      type: 'NPPF',
      id: 'Para 11',
      title: 'Presumption in favour of sustainable development',
      content: 'Plans and decisions should apply a presumption in favour of sustainable development.',
      relevance: 'high',
      relevanceScore: 1.0,
      source: 'nppf_2021'
    });
    
    // Add constraint-specific policies
    if (spatialAnalysis.intersections?.conservationAreas?.length > 0) {
      policies.push({
        type: 'NPPF',
        id: 'Para 199',
        title: 'Heritage significance and conservation',
        content: 'When considering the impact of a proposed development on the significance of a designated heritage asset...',
        relevance: 'high',
        relevanceScore: 0.95,
        source: 'nppf_2021'
      });
    }
    
    if (spatialAnalysis.intersections?.floodZones?.length > 0) {
      policies.push({
        type: 'NPPF',
        id: 'Para 159',
        title: 'Flood risk assessment',
        content: 'Inappropriate development in areas at risk of flooding should be avoided...',
        relevance: 'high',
        relevanceScore: 0.9,
        source: 'nppf_2021'
      });
    }
    
    return policies;
  }

  createCitationIndex(evidence) {
    const citations = new Map();
    
    const allEvidence = [
      ...evidence.spatial,
      ...evidence.textual,
      ...evidence.visual,
      ...evidence.policy,
      ...evidence.computed
    ];
    
    for (const item of allEvidence) {
      if (item.citation) {
        citations.set(item.citation, {
          type: item.type,
          category: item.category,
          description: item.description,
          confidence: item.confidence,
          source: item.source,
          fullItem: item
        });
      }
    }
    
    return citations;
  }

  async storeEvidence(assessmentId, evidence) {
    const evidenceItems = [];
    
    const allEvidence = [
      ...evidence.spatial,
      ...evidence.textual,
      ...evidence.visual,
      ...evidence.policy,
      ...evidence.computed
    ];
    
    for (const item of allEvidence) {
      evidenceItems.push({
        assessmentId: assessmentId,
        type: item.type,
        category: item.category,
        content: JSON.stringify(item),
        confidence: item.confidence,
        spatial: item.type.startsWith('spatial') ? item : null,
        visual: item.type === 'visual_evidence' ? item : null,
        citation: item.citation
      });
    }
    
    await this.database.storeEvidence(assessmentId, evidenceItems);
  }

  // Helper methods
  assessConstraintSeverity(constraintType, intersection) {
    const severityMap = {
      'listedBuildings': 'high',
      'conservationAreas': 'high',
      'floodZones': 'high',
      'scheduledMonuments': 'high',
      'greenBelt': 'high',
      'treePreservationOrders': 'medium',
      'localWildlifeSites': 'medium',
      'airQualityManagementAreas': 'medium',
      'noiseContours': 'low'
    };
    
    let baseSeverity = severityMap[constraintType] || 'medium';
    
    // Adjust based on coverage
    if (intersection.coveragePercent) {
      if (intersection.coveragePercent > 75) {
        return baseSeverity === 'low' ? 'medium' : 'high';
      } else if (intersection.coveragePercent < 25) {
        return baseSeverity === 'high' ? 'medium' : 'low';
      }
    }
    
    return baseSeverity;
  }

  formatConstraintDescription(constraintType, intersection) {
    const typeNames = {
      'conservationAreas': 'Conservation Area',
      'listedBuildings': 'Listed Building',
      'floodZones': 'Flood Zone',
      'greenBelt': 'Green Belt',
      'treePreservationOrders': 'Tree Preservation Order',
      'scheduledMonuments': 'Scheduled Ancient Monument',
      'localWildlifeSites': 'Local Wildlife Site',
      'airQualityManagementAreas': 'Air Quality Management Area'
    };
    
    const typeName = typeNames[constraintType] || constraintType;
    
    if (intersection.coveragePercent) {
      return `Site overlaps ${typeName} by ${intersection.coveragePercent}% (${intersection.area}m²)`;
    } else if (intersection.withinSite) {
      return `${intersection.name || typeName} located within site boundary`;
    }
    
    return `Site affected by ${typeName}`;
  }

  assessAccessibility(featureType, distance) {
    const accessibilityThresholds = {
      'railwayStations': { excellent: 400, good: 800, fair: 1200, poor: 2000 },
      'busStops': { excellent: 200, good: 400, fair: 600, poor: 800 },
      'schools': { excellent: 400, good: 800, fair: 1200, poor: 1600 },
      'hospitals': { excellent: 1000, good: 2000, fair: 5000, poor: 10000 }
    };
    
    const thresholds = accessibilityThresholds[featureType] || { excellent: 200, good: 500, fair: 1000, poor: 2000 };
    
    if (distance <= thresholds.excellent) return 'excellent';
    if (distance <= thresholds.good) return 'good';
    if (distance <= thresholds.fair) return 'fair';
    if (distance <= thresholds.poor) return 'poor';
    return 'very_poor';
  }

  formatProximityDescription(featureType, proximity) {
    const typeNames = {
      'railwayStations': 'railway station',
      'busStops': 'bus stop',
      'schools': 'school',
      'hospitals': 'hospital',
      'townCentres': 'town centre'
    };
    
    const typeName = typeNames[featureType] || featureType.replace(/([A-Z])/g, ' $1').toLowerCase();
    let description = `${proximity.distance}m to nearest ${typeName}`;
    
    if (proximity.name) {
      description += ` (${proximity.name})`;
    }
    
    return description;
  }

  getConstraintPolicyImplications(constraintType) {
    const implications = {
      'conservationAreas': ['NPPF Para 199-202', 'Planning (Listed Buildings and Conservation Areas) Act 1990 s.72'],
      'listedBuildings': ['NPPF Para 199-202', 'Planning (Listed Buildings and Conservation Areas) Act 1990'],
      'floodZones': ['NPPF Para 159-169', 'Flood and Water Management Act 2010'],
      'greenBelt': ['NPPF Para 137-151', 'Town and Country Planning Act 1990'],
      'scheduledMonuments': ['NPPF Para 194', 'Ancient Monuments and Archaeological Areas Act 1979']
    };
    
    return implications[constraintType] || [];
  }

  getTransportImplications(featureType, distance) {
    if (featureType === 'railwayStations' && distance <= 800) {
      return ['Reduced parking requirements may apply', 'Sustainable transport credentials'];
    }
    if (featureType === 'busStops' && distance <= 400) {
      return ['Good public transport accessibility'];
    }
    return [];
  }

  getPTALDescription(ptal) {
    const descriptions = {
      '0': 'Very poor',
      '1a': 'Poor',
      '1b': 'Poor',
      '2': 'Poor to moderate',
      '3': 'Moderate',
      '4': 'Good',
      '5': 'Very good',
      '6a': 'Excellent',
      '6b': 'Excellent'
    };
    
    return descriptions[ptal] || 'Unknown';
  }

  getPTALPolicyImplications(ptal) {
    const ptalNumber = parseInt(ptal.replace(/[^0-9]/g, '')) || 0;
    
    if (ptalNumber >= 4) {
      return ['Reduced parking standards may apply', 'Higher density development supported'];
    } else if (ptalNumber >= 2) {
      return ['Standard parking provision required'];
    } else {
      return ['Higher parking provision may be required', 'Transport assessment recommended'];
    }
  }

  categorizeKeyword(keyword) {
    const categories = {
      'affordable housing': 'housing',
      'parking': 'transport',
      'height': 'design',
      'stories': 'design',
      'storeys': 'design',
      'materials': 'design',
      'access': 'transport',
      'transport': 'transport',
      'highway': 'transport',
      'heritage': 'heritage',
      'conservation': 'heritage',
      'listed building': 'heritage',
      'trees': 'environment',
      'landscape': 'environment',
      'drainage': 'environment',
      'flood': 'environment',
      'ecology': 'environment',
      'biodiversity': 'environment',
      'noise': 'amenity',
      'air quality': 'environment',
      'contamination': 'environment',
      'viability': 'economic',
      'section 106': 'legal',
      's106': 'legal',
      'community infrastructure levy': 'legal',
      'cil': 'legal'
    };
    
    return categories[keyword.toLowerCase()] || 'other';
  }

  classifyImage(image) {
    // Basic image classification based on filename or analysis
    const filename = image.name?.toLowerCase() || '';
    
    if (filename.includes('site') || filename.includes('existing')) return 'site_photo';
    if (filename.includes('plan') || filename.includes('layout')) return 'site_plan';
    if (filename.includes('elevation') || filename.includes('facade')) return 'elevation';
    if (filename.includes('section')) return 'section';
    if (filename.includes('render') || filename.includes('cgi')) return 'render';
    if (filename.includes('context') || filename.includes('street')) return 'context_photo';
    
    return 'unknown';
  }

  generateImageDescription(image, imageType) {
    const descriptions = {
      'site_photo': 'Existing site photograph showing current conditions',
      'site_plan': 'Site plan showing proposed layout and arrangements',
      'elevation': 'Building elevation showing architectural design',
      'section': 'Building section showing internal arrangements',
      'render': 'Computer-generated visualization of proposal',
      'context_photo': 'Context photograph showing surrounding area',
      'unknown': 'Supporting visual documentation'
    };
    
    return descriptions[imageType] || 'Visual evidence';
  }

  requiresDetailedAnalysis(imageType) {
    return ['site_plan', 'elevation', 'section', 'render'].includes(imageType);
  }
}
