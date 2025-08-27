/**
 * Web Worker for spatial analysis operations
 * This moves heavy spatial calculations off the main thread
 */

import * as turf from '@turf/turf';

// Store analysis functions that can be run in worker
const spatialWorkerFunctions = {
  calculateIntersection: (siteGeometry, constraintGeometry) => {
    if (!constraintGeometry) return null;
    try {
      return turf.intersect(siteGeometry, constraintGeometry);
    } catch (error) {
      return null;
    }
  },

  calculateCoverage: (siteGeometry, intersection) => {
    if (!intersection) return 0;
    try {
      const siteArea = turf.area(siteGeometry);
      const intersectionArea = turf.area(intersection);
      return (intersectionArea / siteArea) * 100;
    } catch (error) {
      return 0;
    }
  },

  calculateDistance: (coords1, coords2) => {
    return turf.distance(coords1, coords2, { units: 'meters' });
  },

  calculateSiteMetrics: (geometry) => {
    const area = turf.area(geometry);
    const bbox = turf.bbox(geometry);
    const centroid = turf.centroid(geometry);
    
    // Calculate perimeter
    let perimeter = 0;
    try {
      perimeter = turf.length(turf.polygonToLine(geometry), { units: 'meters' });
    } catch (error) {
      perimeter = 0;
    }
    
    // Calculate frontage (simplified)
    const width = turf.distance([bbox[0], bbox[1]], [bbox[2], bbox[1]], { units: 'meters' });
    const height = turf.distance([bbox[0], bbox[1]], [bbox[0], bbox[3]], { units: 'meters' });
    const frontageLength = Math.min(width, height);
    
    // Estimate developable area
    const developableArea = area * 0.8;

    return {
      area: Math.round(area),
      perimeter: Math.round(perimeter),
      frontageLength: Math.round(frontageLength || 0),
      developableArea: Math.round(developableArea),
      centroid: centroid.geometry.coordinates,
      boundingBox: bbox,
      aspectRatio: Math.round((width / height) * 100) / 100,
      compactness: (4 * Math.PI * area) / (perimeter * perimeter)
    };
  },

  batchIntersectionAnalysis: (siteGeometry, constraints) => {
    const results = [];
    
    for (const constraint of constraints) {
      const intersection = spatialWorkerFunctions.calculateIntersection(
        siteGeometry, 
        constraint.geometry
      );
      const coverage = spatialWorkerFunctions.calculateCoverage(siteGeometry, intersection);
      
      results.push({
        ...constraint,
        intersection,
        coverage,
        impactLevel: coverage === 0 ? 'none' : 
                    coverage > 50 ? 'high' : 
                    coverage > 25 ? 'medium' : 'low'
      });
    }
    
    return results;
  },

  batchProximityAnalysis: (siteCenter, features, maxDistance = 2000) => {
    const results = [];
    
    for (const feature of features) {
      const featureCoords = feature.geometry.type === 'Point' ? 
        feature.geometry.coordinates : 
        turf.centroid(feature).geometry.coordinates;
        
      const distance = spatialWorkerFunctions.calculateDistance(
        siteCenter.geometry.coordinates, 
        featureCoords
      );
      
      if (distance <= maxDistance) {
        results.push({
          ...feature,
          distance: Math.round(distance),
          accessibility_score: Math.max(0, ((maxDistance - distance) / maxDistance) * 100)
        });
      }
    }
    
    return results.sort((a, b) => a.distance - b.distance);
  }
};

// Worker message handler
self.onmessage = async function(e) {
  const { id, operation, data } = e.data;
  
  try {
    let result;
    
    switch (operation) {
      case 'calculateIntersection':
        result = spatialWorkerFunctions.calculateIntersection(data.siteGeometry, data.constraintGeometry);
        break;
        
      case 'calculateCoverage':
        result = spatialWorkerFunctions.calculateCoverage(data.siteGeometry, data.intersection);
        break;
        
      case 'calculateSiteMetrics':
        result = spatialWorkerFunctions.calculateSiteMetrics(data.geometry);
        break;
        
      case 'batchIntersectionAnalysis':
        result = spatialWorkerFunctions.batchIntersectionAnalysis(data.siteGeometry, data.constraints);
        break;
        
      case 'batchProximityAnalysis':
        result = spatialWorkerFunctions.batchProximityAnalysis(data.siteCenter, data.features, data.maxDistance);
        break;
        
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
    
    self.postMessage({
      id,
      success: true,
      result
    });
    
  } catch (error) {
    self.postMessage({
      id,
      success: false,
      error: error.message
    });
  }
};
