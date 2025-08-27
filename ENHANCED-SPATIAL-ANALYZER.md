# Enhanced Spatial Analyzer with Planning Data API Integration

## Overview

The enhanced Spatial Analyzer has been intelligently updated to integrate with the comprehensive planning.data.gov.uk datasets. This provides access to over 180 official planning datasets covering heritage, environmental, development, transport, and administrative constraints across England.

## Key Features

### 🗂️ Comprehensive Dataset Integration

The analyzer now includes **94 datasets** directly from planning.data.gov.uk API, organized into categories:

- **Heritage** (12 datasets): Conservation areas, listed buildings, scheduled monuments, world heritage sites, etc.
- **Environmental** (19 datasets): Flood zones, SSSIs, ancient woodland, green belt, AONBs, etc.
- **Development** (6 datasets): Article 4 directions, brownfield land, building preservation notices, etc.
- **Transport** (1 primary + derived): Public transport access nodes, railway stations, bus stops
- **Infrastructure** (2 + derived): Educational establishments, schools by type
- **Administrative** (5 datasets): Local planning authorities, parishes, wards, etc.

### 🎯 Intelligent Dataset Selection

```javascript
// Basic planning check (5 essential datasets)
const basicAnalysis = await analyzer.analyzeSite(geometry, address, {
  analysisType: 'basic'
});

// Heritage-focused analysis (12 heritage datasets)
const heritageAnalysis = await analyzer.analyzeSite(geometry, address, {
  analysisType: 'heritage-focused'
});

// Residential development (8 key datasets for housing)
const residentialAnalysis = await analyzer.analyzeSite(geometry, address, {
  analysisType: 'comprehensive',
  developmentType: 'residential'
});
```

### 🔄 Derived Datasets

Smart filtering creates specialized datasets from base data:
- **Railway Stations**: Filtered from transport-access-node dataset
- **Bus Stops**: Filtered public transport access points
- **Primary/Secondary Schools**: Filtered educational establishments
- **Best Agricultural Land**: Filtered from agricultural land classification (grades 1, 2, 3a)

### 📊 Enhanced Analysis Outputs

```javascript
{
  constraints: {
    total: 15,
    intersecting: 3,
    critical: 1,
    byCategory: {
      heritage: [...],
      environmental: [...],
      development: [...]
    },
    summary: {
      planningComplexity: 'medium',
      keyConstraints: [...],
      totalConstraints: 15
    }
  },
  planningAssessment: {
    developmentPotential: 'medium',
    riskLevel: 'medium',
    keyOpportunities: ['Excellent public transport accessibility'],
    keyConstraints: [...],
    planningStrategy: [...],
    recommendedStudies: ['Heritage Impact Assessment'],
    designConsiderations: [...]
  },
  proximities: {
    heritage_context: { context: 'high', assessment_required: true },
    environmental_context: { ecological_assessment_likely: false },
    education_accessibility: { rating: 'excellent', family_housing_suitability: true },
    transport_accessibility: { ptal_score: 6, accessibility_rating: 'Excellent' }
  }
}
```

## Available Datasets

### Heritage Assets (378k+ records)
- Conservation areas (11,388)
- Listed buildings (378,171)
- Listed building outlines (61,934)
- Scheduled monuments (20,015)
- Historic parks and gardens (1,718)
- World heritage sites (20)
- Archaeological priority areas (738)
- Heritage at risk (5,464)

### Environmental Constraints (850k+ records)
- Flood risk zones (780,636)
- Ancient woodland (44,373)
- Sites of Special Scientific Interest (4,129)
- Special Areas of Conservation (260)
- Tree preservation zones (44,473)
- Individual protected trees (115,299)
- Air quality management areas (498)
- National/local nature reserves (1,933)

### Transport & Accessibility (361k+ records)
- Public transport access nodes (361,132)
- Railway stations (derived)
- Bus stops (derived)
- Educational establishments (47,047)

### Development Context
- Brownfield land (37,228 sites)
- Article 4 direction areas (4,373)
- Central activities zones (London)
- Building preservation notices

## Usage Examples

### Basic Site Assessment
```javascript
import SpatialAnalyzer from './packages/core/src/spatial-analyzer.js';

const analyzer = new SpatialAnalyzer();
await analyzer.initializeConstraintLayers();

const analysis = await analyzer.analyzeSite(siteGeometry, siteAddress, {
  analysisType: 'basic'
});

console.log(`Development potential: ${analysis.planningAssessment.developmentPotential}`);
console.log(`Risk level: ${analysis.planningAssessment.riskLevel}`);
```

### Comprehensive Assessment
```javascript
const comprehensiveAnalysis = await analyzer.analyzeSite(siteGeometry, siteAddress, {
  analysisType: 'comprehensive',
  developmentType: 'residential',
  includeHeritage: true,
  includeEnvironmental: true,
  includeTransport: true
});
```

### Batch Analysis
```javascript
const sites = [
  { geometry: site1Geometry, address: 'Site 1' },
  { geometry: site2Geometry, address: 'Site 2' }
];

const results = await analyzer.analyzeSites(sites, {
  analysisType: 'basic',
  batchSize: 5
});
```

### Export Results
```javascript
// JSON summary
const summary = analyzer.exportAnalysis(analysis, 'summary');

// GeoJSON for mapping
const geoJson = analyzer.exportAnalysis(analysis, 'geojson');

// CSV for spreadsheets
const csv = analyzer.exportAnalysis(analysis, 'csv');
```

## Dataset Categories & Recommendations

### Recommended Combinations

| Use Case | Datasets | Query Time | Entity Count |
|----------|----------|------------|--------------|
| Basic Planning Check | 5 critical datasets | 2-5 seconds | ~1.2M records |
| Heritage Assessment | 12 heritage datasets | 5-10 seconds | ~480K records |
| Environmental Assessment | 19 environmental datasets | 5-10 seconds | ~850K records |
| Residential Development | 8 key datasets | 5-8 seconds | ~430K records |
| Comprehensive Analysis | All 94 datasets | 10-30 seconds | ~4M+ records |

### Priority Levels
- **High Priority**: Conservation areas, listed buildings, flood zones, green belt
- **Medium Priority**: TPOs, nature reserves, transport nodes, schools
- **Low Priority**: Administrative boundaries, parishes, statistical areas

## Implementation Notes

### Data Sources
All datasets marked as `source: 'planning_data_api'` are directly available from planning.data.gov.uk. Datasets marked as `source: 'derived'` are intelligently filtered from parent datasets.

### Performance Optimization
- Intelligent dataset selection reduces unnecessary API calls
- Caching prevents duplicate queries
- Batch processing for multiple sites
- Configurable analysis depth

### Dataset Availability
The analyzer includes entity counts for each dataset:
- Live API status checking
- Fallback strategies for unavailable datasets
- Dataset coverage information

## Future Enhancements

Potential improvements as more datasets become available:
- Integration with additional government APIs
- Real-time dataset updates
- Enhanced spatial analysis algorithms
- Machine learning-based constraint assessment
- Integration with local authority specific datasets

## Testing

Run the test script to verify functionality:
```bash
node test-enhanced-spatial-analyzer.js
```

This demonstrates:
- Dataset initialization and configuration
- Different analysis types
- Export format options
- Dataset status checking
- Sample analysis results
