import * as turf from '@turf/turf';
import PlanningDataAPI from './planning-data-api.js';

export default class SpatialAnalyzer {
  constructor() {
    this.constraintLayers = new Map();
    this.analysisCache = new Map();
    this.googleMapsApiKey = null;
    this.planningDataAPI = new PlanningDataAPI();
    this.workers = new Map(); // Web Workers for heavy computation
  }

  setGoogleMapsApiKey(apiKey) {
    this.googleMapsApiKey = apiKey;
  }

  async initializeConstraintLayers() {
    // Initialize with standard UK planning constraint layers
    const standardLayers = {
      conservationAreas: { type: 'polygon', source: 'local_authority', priority: 'high' },
      listedBuildings: { type: 'point', source: 'historic_england', priority: 'high' },
      floodZones: { type: 'polygon', source: 'environment_agency', priority: 'high' },
      greenBelt: { type: 'polygon', source: 'local_authority', priority: 'high' },
      treePreservationOrders: { type: 'polygon', source: 'local_authority', priority: 'medium' },
      scheduledMonuments: { type: 'polygon', source: 'historic_england', priority: 'high' },
      localWildlifeSites: { type: 'polygon', source: 'local_authority', priority: 'medium' },
      airQualityManagementAreas: { type: 'polygon', source: 'local_authority', priority: 'medium' },
      noiseContours: { type: 'polygon', source: 'various', priority: 'low' },
      railwayStations: { type: 'point', source: 'transport_data', priority: 'medium' },
      busStops: { type: 'point', source: 'transport_data', priority: 'low' },
      schools: { type: 'point', source: 'education_data', priority: 'medium' },
      hospitals: { type: 'point', source: 'health_data', priority: 'medium' },
      townCentres: { type: 'polygon', source: 'local_authority', priority: 'medium' },
      employmentAreas: { type: 'polygon', source: 'local_authority', priority: 'medium' }
    };

    for (const [name, config] of Object.entries(standardLayers)) {
      this.constraintLayers.set(name, {
        ...config,
        features: [], // Will be populated from APIs/data sources
        lastUpdated: null
      });
    }
  }

  async analyzeSite(siteGeometry, siteAddress = null) {
    const analysisId = this.generateAnalysisId(siteGeometry);
    
    // Check cache first
    if (this.analysisCache.has(analysisId)) {
      return this.analysisCache.get(analysisId);
    }

    try {
      // Get site center point for API calls
      const siteCenter = turf.centroid(siteGeometry);
      const [longitude, latitude] = siteCenter.geometry.coordinates;

      // Parallel analysis of different aspects
      const [
        officialConstraints,
        proximityAnalysis,
        siteMetrics,
        streetViewData,
        transportAnalysis
      ] = await Promise.all([
        this.getOfficialConstraints(latitude, longitude, siteGeometry),
        this.analyzeProximities(siteCenter),
        this.calculateSiteMetrics(siteGeometry),
        this.getStreetViewData(latitude, longitude),
        this.analyzeTransportAccess(latitude, longitude)
      ]);

      const analysis = {
        id: analysisId,
        siteAddress,
        coordinates: { latitude, longitude },
        geometry: siteGeometry,
        constraints: officialConstraints,
        proximities: proximityAnalysis,
        metrics: siteMetrics,
        streetView: streetViewData,
        transport: transportAnalysis,
        evidence: this.generateSpatialEvidence(
          officialConstraints, 
          proximityAnalysis, 
          siteMetrics, 
          transportAnalysis
        ),
        timestamp: new Date(),
        confidence: this.calculateAnalysisConfidence(officialConstraints, proximityAnalysis)
      };

      // Cache the result
      this.analysisCache.set(analysisId, analysis);
      
      return analysis;
    } catch (error) {
      console.error('Site analysis failed:', error);
      throw new Error(`Spatial analysis failed: ${error.message}`);
    }
  }

  /**
   * Get official planning constraints from planning.data.gov.uk
   */
  async getOfficialConstraints(latitude, longitude, siteGeometry) {
    try {
      const constraints = await this.planningDataAPI.getConstraintsForSite(latitude, longitude);
      
      // Enhanced processing with spatial intersection analysis
      const processedConstraints = constraints.map(constraint => {
        const intersection = this.calculateIntersection(siteGeometry, constraint.geometry);
        const coverage = intersection ? this.calculateCoverage(siteGeometry, intersection) : 0;
        
        return {
          ...constraint,
          intersection,
          coverage,
          impactLevel: this.assessConstraintImpact(constraint, coverage),
          planningImplications: this.deriveConstraintImplications(constraint, coverage)
        };
      });

      return {
        total: processedConstraints.length,
        bySeverity: this.groupBySeverity(processedConstraints),
        byCategory: this.groupByCategory(processedConstraints),
        intersecting: processedConstraints.filter(c => c.coverage > 0),
        nearby: processedConstraints.filter(c => c.coverage === 0 && c.distance < 500),
        constraints: processedConstraints
      };
    } catch (error) {
      console.error('Failed to get official constraints:', error);
      return { total: 0, constraints: [], error: error.message };
    }
  }

  /**
   * Analyze proximities to key features
   */
  async analyzeProximities(siteCenter) {
    const proximityTargets = [
      { type: 'railway-station', radius: 2000, weight: 'high' },
      { type: 'town-centre', radius: 5000, weight: 'high' },
      { type: 'primary-school', radius: 1000, weight: 'medium' },
      { type: 'hospital', radius: 10000, weight: 'medium' },
      { type: 'employment-area', radius: 5000, weight: 'medium' }
    ];

    const proximities = [];

    for (const target of proximityTargets) {
      try {
        const nearbyFeatures = await this.planningDataAPI.searchByLocation(
          siteCenter.geometry.coordinates[1], // lat
          siteCenter.geometry.coordinates[0], // lng
          [target.type],
          20
        );

        const processed = nearbyFeatures.map(feature => {
          const distance = this.calculateDistanceToFeature(siteCenter, feature);
          return {
            type: target.type,
            name: feature.name || feature.reference,
            distance,
            within_radius: distance <= target.radius,
            weight: target.weight,
            accessibility_score: this.calculateAccessibilityScore(distance, target.radius)
          };
        }).filter(p => p.distance <= target.radius)
          .sort((a, b) => a.distance - b.distance);

        proximities.push({
          target_type: target.type,
          radius: target.radius,
          found: processed.length,
          features: processed.slice(0, 5), // Top 5 closest
          accessibility_summary: this.summarizeAccessibility(processed, target)
        });
      } catch (error) {
        console.warn(`Failed to analyze proximity to ${target.type}:`, error);
      }
    }

    return {
      summary: this.summarizeProximityAnalysis(proximities),
      details: proximities,
      transport_accessibility: this.calculateTransportAccessibility(proximities)
    };
  }

  /**
   * Calculate site metrics (area, perimeter, etc.)
   */
  async calculateSiteMetrics(geometry) {
    const area = turf.area(geometry);
    const bbox = turf.bbox(geometry);
    const centroid = turf.centroid(geometry);
    
    // Calculate perimeter
    const perimeter = this.calculatePerimeter(geometry);
    
    // Calculate frontage (simplified - actual implementation would need road data)
    const frontageLength = await this.estimateFrontageLength(geometry);
    
    // Estimate developable area (accounting for constraints)
    const developableArea = area * 0.8; // Simplified assumption

    return {
      area: Math.round(area),
      perimeter: Math.round(perimeter),
      frontageLength: Math.round(frontageLength || 0),
      developableArea: Math.round(developableArea),
      centroid: centroid.geometry.coordinates,
      boundingBox: bbox,
      aspectRatio: this.calculateAspectRatio(bbox),
      compactness: this.calculateCompactness(area, perimeter)
    };
  }

  /**
   * Get Street View data from Google API
   */
  async getStreetViewData(latitude, longitude) {
    if (!this.googleMapsApiKey) {
      return { available: false, reason: 'No API key provided' };
    }

    try {
      // Check if Street View is available
      const metadataUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${latitude},${longitude}&key=${this.googleMapsApiKey}`;
      
      const response = await fetch(metadataUrl);
      const metadata = await response.json();

      if (metadata.status === 'OK') {
        return {
          available: true,
          location: metadata.location,
          date: metadata.date,
          imageUrl: `https://maps.googleapis.com/maps/api/streetview?size=640x640&location=${latitude},${longitude}&key=${this.googleMapsApiKey}`,
          metadata
        };
      } else {
        return { available: false, reason: metadata.status };
      }
    } catch (error) {
      console.error('Street View API error:', error);
      return { available: false, reason: 'API error' };
    }
  }

  /**
   * Analyze transport accessibility
   */
  async analyzeTransportAccess(latitude, longitude) {
    try {
      // Get nearby transport infrastructure
      const [stations, busStops] = await Promise.all([
        this.planningDataAPI.searchByLocation(latitude, longitude, ['railway-station'], 10),
        this.planningDataAPI.searchByLocation(latitude, longitude, ['bus-stop'], 20)
      ]);

      const nearestStation = this.findNearestFeature([latitude, longitude], stations);
      const nearestBusStops = busStops
        .map(stop => ({
          ...stop,
          distance: this.calculateDistance([latitude, longitude], this.getFeatureCoordinates(stop))
        }))
        .filter(stop => stop.distance <= 400)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5);

      // Calculate PTAL-style accessibility score
      const ptalScore = this.calculatePTALScore(nearestStation, nearestBusStops);

      return {
        nearest_station: nearestStation ? {
          name: nearestStation.name,
          distance: nearestStation.distance,
          walking_time: Math.round(nearestStation.distance / 80) // 80m/min walking speed
        } : null,
        bus_stops: nearestBusStops.map(stop => ({
          name: stop.name || 'Bus Stop',
          distance: stop.distance,
          walking_time: Math.round(stop.distance / 80)
        })),
        ptal_score: ptalScore,
        accessibility_rating: this.getPTALRating(ptalScore),
        car_parking_standard: this.getCarParkingStandard(ptalScore)
      };
    } catch (error) {
      console.error('Transport analysis failed:', error);
      return { error: error.message };
    }
  }

  /**
   * Generate spatial evidence items
   */
  generateSpatialEvidence(constraints, proximities, metrics, transport) {
    const evidence = [];

    // Constraint evidence
    if (constraints.intersecting && constraints.intersecting.length > 0) {
      constraints.intersecting.forEach(constraint => {
        evidence.push({
          type: 'constraint_intersection',
          category: constraint.category,
          description: `Site ${constraint.coverage > 50 ? 'primarily within' : 'partially overlaps'} ${constraint.name}`,
          impact: constraint.impactLevel,
          coverage: constraint.coverage,
          policies: constraint.relevantPolicies,
          confidence: 'high'
        });
      });
    }

    // Proximity evidence
    if (proximities.details) {
      proximities.details.forEach(proximity => {
        if (proximity.found > 0) {
          const nearest = proximity.features[0];
          evidence.push({
            type: 'proximity',
            category: 'accessibility',
            description: `${nearest.distance}m to nearest ${proximity.target_type.replace('-', ' ')}`,
            distance: nearest.distance,
            accessibility_score: nearest.accessibility_score,
            confidence: 'high'
          });
        }
      });
    }

    // Site metrics evidence
    if (metrics) {
      evidence.push({
        type: 'site_metrics',
        category: 'development_capacity',
        description: `Site area: ${metrics.area}m² (${(metrics.area / 10000).toFixed(2)} hectares)`,
        area: metrics.area,
        developable_area: metrics.developableArea,
        confidence: 'high'
      });

      if (metrics.frontageLength > 0) {
        evidence.push({
          type: 'site_metrics',
          category: 'access',
          description: `Estimated frontage length: ${metrics.frontageLength}m`,
          frontage: metrics.frontageLength,
          confidence: 'medium'
        });
      }
    }

    // Transport evidence
    if (transport && transport.nearest_station) {
      evidence.push({
        type: 'transport',
        category: 'accessibility',
        description: `${transport.nearest_station.distance}m to ${transport.nearest_station.name} (${transport.nearest_station.walking_time} min walk)`,
        ptal_score: transport.ptal_score,
        accessibility_rating: transport.accessibility_rating,
        confidence: 'high'
      });
    }

    return evidence;
  }

  // Helper methods
  generateAnalysisId(geometry) {
    const coords = turf.centroid(geometry).geometry.coordinates;
    return `analysis_${coords[0].toFixed(6)}_${coords[1].toFixed(6)}_${Date.now()}`;
  }

  calculateIntersection(siteGeometry, constraintGeometry) {
    if (!constraintGeometry) return null;
    try {
      return turf.intersect(siteGeometry, constraintGeometry);
    } catch (error) {
      return null;
    }
  }

  calculateCoverage(siteGeometry, intersection) {
    if (!intersection) return 0;
    try {
      const siteArea = turf.area(siteGeometry);
      const intersectionArea = turf.area(intersection);
      return (intersectionArea / siteArea) * 100;
    } catch (error) {
      return 0;
    }
  }

  assessConstraintImpact(constraint, coverage) {
    if (coverage === 0) return 'none';
    if (constraint.severity === 'critical') return coverage > 10 ? 'critical' : 'high';
    if (constraint.severity === 'high') return coverage > 25 ? 'high' : 'medium';
    if (constraint.severity === 'medium') return coverage > 50 ? 'medium' : 'low';
    return 'low';
  }

  deriveConstraintImplications(constraint, coverage) {
    const implications = [];
    
    if (coverage > 0) {
      implications.push(`${constraint.category} assessment required`);
      
      if (constraint.category === 'heritage') {
        implications.push('Heritage statement required');
        if (coverage > 25) implications.push('Specialist heritage consultant recommended');
      }
      
      if (constraint.category === 'environmental') {
        implications.push('Environmental impact assessment may be required');
        if (coverage > 50) implications.push('Ecological survey essential');
      }
    }
    
    return implications;
  }

  groupBySeverity(constraints) {
    return constraints.reduce((groups, constraint) => {
      const severity = constraint.severity;
      if (!groups[severity]) groups[severity] = [];
      groups[severity].push(constraint);
      return groups;
    }, {});
  }

  groupByCategory(constraints) {
    return constraints.reduce((groups, constraint) => {
      const category = constraint.category;
      if (!groups[category]) groups[category] = [];
      groups[category].push(constraint);
      return groups;
    }, {});
  }

  calculatePerimeter(geometry) {
    try {
      return turf.length(turf.polygonToLine(geometry), { units: 'meters' });
    } catch (error) {
      return 0;
    }
  }

  async estimateFrontageLength(geometry) {
    // Simplified - would need actual road network data
    const bbox = turf.bbox(geometry);
    const width = turf.distance([bbox[0], bbox[1]], [bbox[2], bbox[1]], { units: 'meters' });
    const height = turf.distance([bbox[0], bbox[1]], [bbox[0], bbox[3]], { units: 'meters' });
    return Math.min(width, height); // Assume frontage is on shortest side
  }

  calculateAspectRatio(bbox) {
    const width = bbox[2] - bbox[0];
    const height = bbox[3] - bbox[1];
    return width / height;
  }

  calculateCompactness(area, perimeter) {
    // Isoperimetric quotient - measures how close to a circle the shape is
    return (4 * Math.PI * area) / (perimeter * perimeter);
  }

  calculateDistanceToFeature(point, feature) {
    const featureCoords = this.getFeatureCoordinates(feature);
    return this.calculateDistance(point.geometry.coordinates, featureCoords);
  }

  getFeatureCoordinates(feature) {
    if (feature.geometry.type === 'Point') {
      return feature.geometry.coordinates;
    } else {
      return turf.centroid(feature).geometry.coordinates;
    }
  }

  calculateDistance(coords1, coords2) {
    return turf.distance(coords1, coords2, { units: 'meters' });
  }

  findNearestFeature(point, features) {
    if (!features || features.length === 0) return null;
    
    let nearest = null;
    let minDistance = Infinity;
    
    features.forEach(feature => {
      const distance = this.calculateDistance(point, this.getFeatureCoordinates(feature));
      if (distance < minDistance) {
        minDistance = distance;
        nearest = { ...feature, distance };
      }
    });
    
    return nearest;
  }

  calculateAccessibilityScore(distance, maxRadius) {
    return Math.max(0, ((maxRadius - distance) / maxRadius) * 100);
  }

  summarizeAccessibility(features, target) {
    if (features.length === 0) return { rating: 'poor', score: 0 };
    
    const avgScore = features.reduce((sum, f) => sum + f.accessibility_score, 0) / features.length;
    
    let rating;
    if (avgScore >= 80) rating = 'excellent';
    else if (avgScore >= 60) rating = 'good';
    else if (avgScore >= 40) rating = 'fair';
    else rating = 'poor';
    
    return { rating, score: Math.round(avgScore), count: features.length };
  }

  summarizeProximityAnalysis(proximities) {
    const summary = {
      total_categories: proximities.length,
      accessible_categories: proximities.filter(p => p.found > 0).length,
      overall_rating: 'calculating...'
    };
    
    // Calculate overall accessibility rating
    const scores = proximities
      .filter(p => p.accessibility_summary.score > 0)
      .map(p => p.accessibility_summary.score);
    
    if (scores.length > 0) {
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (avgScore >= 70) summary.overall_rating = 'excellent';
      else if (avgScore >= 50) summary.overall_rating = 'good';
      else if (avgScore >= 30) summary.overall_rating = 'fair';
      else summary.overall_rating = 'poor';
    } else {
      summary.overall_rating = 'poor';
    }
    
    return summary;
  }

  calculateTransportAccessibility(proximities) {
    const stationProximity = proximities.find(p => p.target_type === 'railway-station');
    const hasNearbyStation = stationProximity && stationProximity.found > 0;
    
    return {
      has_rail_access: hasNearbyStation,
      station_distance: hasNearbyStation ? stationProximity.features[0].distance : null,
      transport_rating: hasNearbyStation ? 'good' : 'car-dependent'
    };
  }

  calculatePTALScore(nearestStation, busStops) {
    let score = 0;
    
    // Rail accessibility
    if (nearestStation && nearestStation.distance <= 960) {
      const railScore = Math.max(0, 10 - (nearestStation.distance / 96));
      score += railScore;
    }
    
    // Bus accessibility
    const accessibleBusStops = busStops.filter(stop => stop.distance <= 480);
    if (accessibleBusStops.length > 0) {
      const busScore = Math.min(accessibleBusStops.length * 2, 10);
      score += busScore;
    }
    
    return Math.min(score, 10);
  }

  getPTALRating(score) {
    if (score >= 8) return 'Excellent (6a/6b)';
    if (score >= 6) return 'Very Good (5/6a)';
    if (score >= 4) return 'Good (3/4)';
    if (score >= 2) return 'Moderate (2/3)';
    return 'Poor (0/1)';
  }

  getCarParkingStandard(ptalScore) {
    if (ptalScore >= 6) return 'Car-free development possible';
    if (ptalScore >= 4) return 'Reduced parking standards';
    if (ptalScore >= 2) return 'Standard parking requirements';
    return 'Higher parking provision may be needed';
  }

  calculateAnalysisConfidence(constraints, proximities) {
    let confidence = 100;
    
    // Reduce confidence if data sources failed
    if (constraints.error) confidence -= 30;
    if (proximities.error) confidence -= 20;
    
    // Reduce confidence if limited data available
    if (constraints.total === 0) confidence -= 15;
    if (proximities.summary.accessible_categories < 3) confidence -= 10;
    
    return Math.max(confidence, 0);
  }

  async calculateGeometricProperties(geometry) {
    const area = turf.area(geometry);
    const perimeter = turf.length(turf.polygonToLine(geometry), { units: 'meters' });
    const centroid = turf.centroid(geometry);
    const bbox = turf.bbox(geometry);
    
    // Calculate frontage (assume road frontage is shortest side)
    const frontageLength = Math.min(
      turf.distance([bbox[0], bbox[1]], [bbox[2], bbox[1]]),
      turf.distance([bbox[0], bbox[1]], [bbox[0], bbox[3]])
    ) * 1000;
    
    const plotRatio = await this.estimatePlotRatio(geometry);

    return {
      area: Math.round(area),
      perimeter: Math.round(perimeter),
      frontageLength: Math.round(frontageLength),
      plotRatio: plotRatio,
      centroid: centroid.geometry.coordinates,
      boundingBox: bbox,
      aspectRatio: this.calculateAspectRatio(bbox)
    };
  }

  async calculateIntersections(siteGeometry) {
    const intersections = {};
    
    for (const [layerName, layer] of this.constraintLayers) {
      if (layer.features.length === 0) continue;
      
      const layerIntersections = [];
      
      for (const feature of layer.features) {
        try {
          let intersectionResult = null;
          
          if (layer.type === 'polygon') {
            const intersection = turf.intersect(siteGeometry, feature.geometry);
            if (intersection) {
              const intersectionArea = turf.area(intersection);
              const coveragePercent = (intersectionArea / turf.area(siteGeometry)) * 100;
              
              intersectionResult = {
                featureId: feature.id || feature.properties?.id,
                name: feature.properties?.name || layerName,
                area: Math.round(intersectionArea),
                coveragePercent: Math.round(coveragePercent * 100) / 100,
                geometry: intersection
              };
            }
          } else if (layer.type === 'point') {
            const isInside = turf.booleanPointInPolygon(feature.geometry, siteGeometry);
            if (isInside) {
              intersectionResult = {
                featureId: feature.id || feature.properties?.id,
                name: feature.properties?.name || layerName,
                coordinates: feature.geometry.coordinates,
                withinSite: true
              };
            }
          }
          
          if (intersectionResult) {
            layerIntersections.push(intersectionResult);
          }
        } catch (error) {
          console.warn(`Error calculating intersection with ${layerName}:`, error);
        }
      }
      
      if (layerIntersections.length > 0) {
        intersections[layerName] = layerIntersections;
      }
    }
    
    return intersections;
  }

  async calculateProximities(siteGeometry) {
    const centroid = turf.centroid(siteGeometry);
    const proximities = {};
    
    // Define search radii for different feature types
    const searchRadii = {
      railwayStations: 2000, // 2km
      busStops: 500, // 500m
      schools: 1000, // 1km
      hospitals: 5000, // 5km
      townCentres: 10000, // 10km
      listedBuildings: 500, // 500m
      scheduledMonuments: 1000 // 1km
    };
    
    for (const [layerName, layer] of this.constraintLayers) {
      if (layer.type !== 'point' || layer.features.length === 0) continue;
      
      const searchRadius = searchRadii[layerName] || 1000; // Default 1km
      const nearbyFeatures = [];
      
      for (const feature of layer.features) {
        const distance = turf.distance(centroid, feature, { units: 'meters' });
        
        if (distance <= searchRadius) {
          nearbyFeatures.push({
            featureId: feature.id || feature.properties?.id,
            name: feature.properties?.name || layerName,
            distance: Math.round(distance),
            coordinates: feature.geometry.coordinates,
            bearing: this.calculateBearing(centroid.geometry.coordinates, feature.geometry.coordinates)
          });
        }
      }
      
      if (nearbyFeatures.length > 0) {
        // Sort by distance
        nearbyFeatures.sort((a, b) => a.distance - b.distance);
        proximities[layerName] = nearbyFeatures.slice(0, 5); // Top 5 closest
      }
    }
    
    return proximities;
  }

  async analyzeAccessibility(siteGeometry, siteAddress) {
    const centroid = turf.centroid(siteGeometry);
    const accessibility = {
      publicTransportAccessibilityLevel: null,
      walkingDistanceToStations: [],
      cyclingInfrastructure: null,
      roadNetworkAccess: null
    };

    // PTAL calculation (simplified)
    const ptal = await this.calculatePTAL(centroid);
    accessibility.publicTransportAccessibilityLevel = ptal;

    // Walking distances to transport
    const stations = this.constraintLayers.get('railwayStations')?.features || [];
    for (const station of stations.slice(0, 3)) { // Top 3 closest
      const walkingDistance = turf.distance(centroid, station, { units: 'meters' });
      if (walkingDistance <= 2000) { // Within 2km
        accessibility.walkingDistanceToStations.push({
          name: station.properties?.name,
          distance: Math.round(walkingDistance),
          walkingTime: Math.round(walkingDistance / 1.4 / 60) // Assume 1.4 m/s walking speed
        });
      }
    }

    return accessibility;
  }

  async analyzeContext(siteGeometry, siteAddress) {
    const context = {
      landUsePattern: null,
      buildingDensity: null,
      streetPattern: null,
      characterAssessment: null
    };

    // Use Google Street View API if available and address provided
    if (this.googleMapsApiKey && siteAddress) {
      try {
        context.streetViewAnalysis = await this.getStreetViewContext(siteAddress);
      } catch (error) {
        console.warn('Street View analysis failed:', error);
      }
    }

    return context;
  }

  generateSpatialEvidence(analysis) {
    const evidence = [];
    
    // Site metrics evidence
    if (analysis.siteMetrics.area) {
      evidence.push({
        type: 'spatial',
        category: 'site_metrics',
        description: `Site area: ${analysis.siteMetrics.area}m² (${(analysis.siteMetrics.area / 10000).toFixed(2)} hectares)`,
        confidence: 1.0,
        source: 'calculated'
      });
    }

    if (analysis.siteMetrics.frontageLength) {
      evidence.push({
        type: 'spatial',
        category: 'site_metrics',
        description: `Primary frontage length: ${analysis.siteMetrics.frontageLength}m`,
        confidence: 0.8,
        source: 'calculated'
      });
    }

    // Intersection evidence
    for (const [layerName, intersections] of Object.entries(analysis.intersections)) {
      for (const intersection of intersections) {
        if (intersection.coveragePercent) {
          evidence.push({
            type: 'spatial',
            category: 'constraints',
            description: `Site overlaps ${layerName.replace(/([A-Z])/g, ' $1').toLowerCase()} by ${intersection.coveragePercent}% (${intersection.area}m²)`,
            confidence: 0.95,
            source: 'spatial_analysis',
            constraint: layerName,
            impact: intersection.coveragePercent > 50 ? 'high' : intersection.coveragePercent > 20 ? 'medium' : 'low'
          });
        } else if (intersection.withinSite) {
          evidence.push({
            type: 'spatial',
            category: 'constraints',
            description: `${intersection.name} located within site boundary`,
            confidence: 1.0,
            source: 'spatial_analysis',
            constraint: layerName,
            impact: 'high'
          });
        }
      }
    }

    // Proximity evidence
    for (const [layerName, proximities] of Object.entries(analysis.proximities)) {
      const closest = proximities[0];
      if (closest) {
        let description = `${closest.distance}m to nearest ${layerName.replace(/([A-Z])/g, ' $1').toLowerCase()}`;
        if (closest.name) {
          description += ` (${closest.name})`;
        }
        
        evidence.push({
          type: 'spatial',
          category: 'accessibility',
          description: description,
          confidence: 0.9,
          source: 'spatial_analysis',
          distance: closest.distance,
          feature: layerName
        });
      }
    }

    // Accessibility evidence
    if (analysis.accessibilityAnalysis.publicTransportAccessibilityLevel) {
      evidence.push({
        type: 'spatial',
        category: 'accessibility',
        description: `Public Transport Accessibility Level: ${analysis.accessibilityAnalysis.publicTransportAccessibilityLevel}`,
        confidence: 0.8,
        source: 'calculated',
        ptal: analysis.accessibilityAnalysis.publicTransportAccessibilityLevel
      });
    }

    return evidence;
  }

  // Helper methods
  calculatePerimeter(geometry) {
    if (geometry.type === 'Polygon') {
      return turf.length(turf.polygonToLine(geometry), { units: 'meters' });
    }
    return 0;
  }

  async calculateFrontageLength(geometry) {
    // Simplified: assume longest edge is primary frontage
    if (geometry.type === 'Polygon') {
      const coordinates = geometry.coordinates[0];
      let maxDistance = 0;
      
      for (let i = 0; i < coordinates.length - 1; i++) {
        const distance = turf.distance(coordinates[i], coordinates[i + 1], { units: 'meters' });
        maxDistance = Math.max(maxDistance, distance);
      }
      
      return maxDistance;
    }
    return 0;
  }

  async estimatePlotRatio(geometry) {
    // Placeholder - would need building footprint data
    return null;
  }

  calculateAspectRatio(bbox) {
    const width = bbox[2] - bbox[0];
    const height = bbox[3] - bbox[1];
    return Math.round((width / height) * 100) / 100;
  }

  calculateBearing(from, to) {
    return Math.round(turf.bearing(from, to));
  }

  async calculatePTAL(centroid) {
    // Simplified PTAL calculation
    // In reality, this would need detailed transport timetable data
    const stations = this.constraintLayers.get('railwayStations')?.features || [];
    const busStops = this.constraintLayers.get('busStops')?.features || [];
    
    let score = 0;
    
    // Railway stations within walking distance
    for (const station of stations) {
      const distance = turf.distance(centroid, station, { units: 'meters' });
      if (distance <= 960) score += 4; // High frequency
      else if (distance <= 1280) score += 3; // Medium frequency
      else if (distance <= 1600) score += 2; // Low frequency
    }
    
    // Bus stops within walking distance
    let busScore = 0;
    for (const stop of busStops) {
      const distance = turf.distance(centroid, stop, { units: 'meters' });
      if (distance <= 320) busScore += 2;
      else if (distance <= 640) busScore += 1;
    }
    
    score += Math.min(busScore, 6); // Cap bus contribution
    
    // Convert to PTAL band
    if (score >= 25) return '6a';
    if (score >= 20) return '5';
    if (score >= 15) return '4';
    if (score >= 10) return '3';
    if (score >= 5) return '2';
    if (score >= 2.5) return '1b';
    if (score >= 0) return '1a';
    return '0';
  }

  async getStreetViewContext(address) {
    if (!this.googleMapsApiKey) return null;
    
    // This would call Google Street View Static API
    // For now, return placeholder
    return {
      available: false,
      reason: 'Implementation pending'
    };
  }
}
