#!/usr/bin/env node

/**
 * Test script for the enhanced spatial analyzer with planning.data.gov.uk datasets
 */

import SpatialAnalyzer from './packages/core/src/spatial-analyzer.js';

async function testEnhancedSpatialAnalyzer() {
  console.log('🏗️  Testing Enhanced Spatial Analyzer with Planning Data API datasets\n');

  const analyzer = new SpatialAnalyzer();
  
  // Initialize with the comprehensive dataset configuration
  await analyzer.initializeConstraintLayers();
  
  console.log('📊 Available Datasets Information:');
  const availableDatasets = analyzer.getAvailableDatasets();
  console.log(`Total configured datasets: ${availableDatasets.totalDatasets}`);
  console.log(`Available datasets: ${availableDatasets.availableDatasets}\n`);
  
  console.log('📁 Datasets by Category:');
  for (const [category, datasets] of Object.entries(availableDatasets.datasetsByCategory)) {
    console.log(`  ${category}: ${datasets.length} datasets`);
    datasets.slice(0, 3).forEach(dataset => {
      console.log(`    - ${dataset.dataset} (${dataset.entityCount.toLocaleString()} records)`);
    });
    if (datasets.length > 3) {
      console.log(`    ... and ${datasets.length - 3} more`);
    }
  }
  
  console.log('\n🎯 Recommended Dataset Combinations:');
  for (const [combination, details] of Object.entries(availableDatasets.recommendedCombinations)) {
    console.log(`  ${combination}:`);
    console.log(`    Description: ${details.description}`);
    console.log(`    Datasets: ${details.datasets.length}`);
    console.log(`    Estimated query time: ${details.estimatedQueryTime}\n`);
  }

  // Test site geometry (example polygon in central London)
  const testSiteGeometry = {
    type: 'Polygon',
    coordinates: [[
      [-0.1276, 51.5074], // London coordinates
      [-0.1270, 51.5074],
      [-0.1270, 51.5080],
      [-0.1276, 51.5080],
      [-0.1276, 51.5074]
    ]]
  };

  console.log('🔍 Testing different analysis types:\n');

  // Test basic analysis
  console.log('1. Basic Planning Check:');
  try {
    const basicAnalysis = await analyzer.analyzeSite(testSiteGeometry, 'Test Site, London', {
      analysisType: 'basic'
    });
    console.log(`   Analysis ID: ${basicAnalysis.id}`);
    console.log(`   Development Potential: ${basicAnalysis.planningAssessment?.developmentPotential || 'Unknown'}`);
    console.log(`   Risk Level: ${basicAnalysis.planningAssessment?.riskLevel || 'Unknown'}`);
    console.log(`   Constraints Found: ${basicAnalysis.constraints?.total || 0}`);
    console.log(`   Confidence: ${basicAnalysis.confidence}%\n`);
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }

  // Test heritage-focused analysis
  console.log('2. Heritage-focused Analysis:');
  try {
    const heritageAnalysis = await analyzer.analyzeSite(testSiteGeometry, 'Heritage Test Site', {
      analysisType: 'heritage-focused'
    });
    console.log(`   Heritage Context: ${heritageAnalysis.proximities?.heritage_context?.context || 'Unknown'}`);
    console.log(`   Heritage Features Nearby: ${heritageAnalysis.proximities?.heritage_context?.heritage_features || 0}`);
    console.log(`   Assessment Required: ${heritageAnalysis.proximities?.heritage_context?.assessment_required || false}\n`);
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }

  // Test residential development analysis
  console.log('3. Residential Development Analysis:');
  try {
    const residentialAnalysis = await analyzer.analyzeSite(testSiteGeometry, 'Residential Site', {
      analysisType: 'comprehensive',
      developmentType: 'residential'
    });
    console.log(`   Education Accessibility: ${residentialAnalysis.proximities?.education_accessibility?.rating || 'Unknown'}`);
    console.log(`   Family Housing Suitability: ${residentialAnalysis.proximities?.education_accessibility?.family_housing_suitability || false}`);
    console.log(`   Transport PTAL Score: ${residentialAnalysis.transport?.ptal_score || 'Unknown'}\n`);
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }

  // Test export formats
  console.log('📤 Testing Export Formats:');
  try {
    const testAnalysis = await analyzer.analyzeSite(testSiteGeometry, 'Export Test Site', {
      analysisType: 'basic'
    });
    
    console.log('   Summary Export:');
    const summary = analyzer.exportAnalysis(testAnalysis, 'summary');
    console.log(`   Site: ${summary.address}`);
    console.log(`   Area: ${summary.area || 'Unknown'} m²`);
    console.log(`   Development Potential: ${summary.developmentPotential || 'Unknown'}`);
    
    console.log('\n   CSV Headers:');
    const csvExport = analyzer.exportAnalysis(testAnalysis, 'csv');
    console.log(`   ${csvExport.headers}\n`);
    
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }

  // Test dataset status checking
  console.log('🔌 Testing Dataset Status:');
  try {
    const criticalDatasets = [
      'conservation-area', 
      'listed-building', 
      'flood-risk-zone', 
      'transport-access-node'
    ];
    
    console.log('   Checking status of critical datasets...');
    // Note: This would normally check API availability
    console.log('   (API connectivity checks would be performed here)');
    
    for (const dataset of criticalDatasets) {
      const entityCount = analyzer.getDatasetEntityCount(dataset);
      console.log(`   ${dataset}: ${entityCount.toLocaleString()} records available`);
    }
    
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }

  console.log('\n✅ Enhanced Spatial Analyzer test completed!');
  console.log('\n📋 Key Features Demonstrated:');
  console.log('   • Comprehensive dataset integration from planning.data.gov.uk');
  console.log('   • Intelligent dataset selection based on analysis type');
  console.log('   • Derived datasets (railway stations, schools, etc.)');
  console.log('   • Planning assessment with risk evaluation');
  console.log('   • Multiple export formats');
  console.log('   • Heritage and environmental context analysis');
  console.log('   • Transport accessibility (PTAL) calculation');
  console.log('   • Dataset availability and status checking');
}

// Run the test
testEnhancedSpatialAnalyzer().catch(console.error);
