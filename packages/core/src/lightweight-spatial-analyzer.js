import * as turf from '@turf/turf';

/**
 * Lightweight spatial analyzer for basic operations
 * Used as fallback when main analyzer fails or for simple analyses
 */
export class LightweightSpatialAnalyzer {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Basic site analysis with minimal dependencies
   */
  async analyzeBasic(siteGeometry, siteAddress = null) {
    const analysisId = this.generateId(siteGeometry);
    
    if (this.cache.has(analysisId)) {
      return this.cache.get(analysisId);
    }

    try {
      const siteCenter = turf.centroid(siteGeometry);
      const [longitude, latitude] = siteCenter.geometry.coordinates;
      
      const metrics = this.calculateBasicMetrics(siteGeometry);
      
      const analysis = {
        id: analysisId,
        siteAddress,
        coordinates: { latitude, longitude },
        geometry: siteGeometry,
        metrics,
        basicAssessment: this.generateBasicAssessment(metrics),
        timestamp: new Date(),
        confidence: 100,
        type: 'lightweight'
      };

      this.cache.set(analysisId, analysis);
      return analysis;
    } catch (error) {
      console.error('Lightweight analysis failed:', error);
      return {
        id: analysisId,
        siteAddress,
        geometry: siteGeometry,
        error: error.message,
        type: 'lightweight',
        timestamp: new Date()
      };
    }
  }

  calculateBasicMetrics(geometry) {
    try {
      const area = turf.area(geometry);
      const bbox = turf.bbox(geometry);
      const centroid = turf.centroid(geometry);
      
      let perimeter = 0;
      try {
        perimeter = turf.length(turf.polygonToLine(geometry), { units: 'meters' });
      } catch (e) {
        // Fallback perimeter calculation
        perimeter = Math.sqrt(area) * 4; // Rough approximation
      }

      return {
        area: Math.round(area),
        perimeter: Math.round(perimeter),
        centroid: centroid.geometry.coordinates,
        boundingBox: bbox,
        approximateWidth: Math.round(turf.distance([bbox[0], bbox[1]], [bbox[2], bbox[1]], { units: 'meters' })),
        approximateHeight: Math.round(turf.distance([bbox[0], bbox[1]], [bbox[0], bbox[3]], { units: 'meters' }))
      };
    } catch (error) {
      return {
        area: 0,
        perimeter: 0,
        centroid: [0, 0],
        boundingBox: [0, 0, 0, 0],
        error: error.message
      };
    }
  }

  generateBasicAssessment(metrics) {
    const area = metrics.area || 0;
    
    let sizeCategory = 'unknown';
    if (area > 0) {
      if (area < 1000) sizeCategory = 'small';
      else if (area < 5000) sizeCategory = 'medium';
      else if (area < 20000) sizeCategory = 'large';
      else sizeCategory = 'very large';
    }

    return {
      sizeCategory,
      developmentPotential: area > 500 ? 'possible' : 'limited',
      basicRecommendations: [
        'Full spatial analysis recommended',
        'Check local planning constraints',
        'Verify site boundaries'
      ]
    };
  }

  generateId(geometry) {
    const coords = turf.centroid(geometry).geometry.coordinates;
    return `lightweight_${coords[0].toFixed(6)}_${coords[1].toFixed(6)}_${Date.now()}`;
  }
}

export default LightweightSpatialAnalyzer;
