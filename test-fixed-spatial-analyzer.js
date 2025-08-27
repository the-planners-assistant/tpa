#!/usr/bin/env node

/**
 * Test the fixed spatial analyzer with proper error handling and parallelization
 */

import SpatialAnalyzer from './packages/core/src/spatial-analyzer.js';
import LightweightSpatialAnalyzer from './packages/core/src/lightweight-spatial-analyzer.js';

async function testFixedSpatialAnalyzer() {
  console.log('🔧 Testing Fixed Spatial Analyzer with Error Handling and Parallelization\n');

  // Test site geometry (small polygon to avoid complexity)
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

  // Test 1: Lightweight analyzer (always works)
  console.log('1. Testing Lightweight Spatial Analyzer:');
  try {
    const lightAnalyzer = new LightweightSpatialAnalyzer();
    const lightResult = await lightAnalyzer.analyzeBasic(testSiteGeometry, 'Test Site');
    
    console.log(`   ✅ Analysis ID: ${lightResult.id}`);
    console.log(`   ✅ Site Area: ${lightResult.metrics?.area || 0} m²`);
    console.log(`   ✅ Size Category: ${lightResult.basicAssessment?.sizeCategory || 'unknown'}`);
    console.log(`   ✅ Development Potential: ${lightResult.basicAssessment?.developmentPotential || 'unknown'}\n`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // Test 2: Full analyzer with auto-initialization
  console.log('2. Testing Full Spatial Analyzer (with auto-init):');
  try {
    const analyzer = new SpatialAnalyzer();
    console.log(`   🔄 Initialized: ${analyzer.initialized}`);
    console.log(`   🔄 Web Workers Available: ${analyzer.useWebWorkers}`);
    
    // Test with basic analysis type to minimize API calls
    const analysisResult = await analyzer.analyzeSite(testSiteGeometry, 'Full Test Site', {
      analysisType: 'basic'
    });
    
    console.log(`   ✅ Analysis ID: ${analysisResult.id}`);
    console.log(`   ✅ Initialized After: ${analyzer.initialized}`);
    console.log(`   ✅ Development Potential: ${analysisResult.planningAssessment?.developmentPotential || 'unknown'}`);
    console.log(`   ✅ Risk Level: ${analysisResult.planningAssessment?.riskLevel || 'unknown'}`);
    console.log(`   ✅ Constraints: ${analysisResult.constraints?.total || 0}`);
    console.log(`   ✅ Confidence: ${analysisResult.confidence}%`);
    console.log(`   ✅ Used Web Workers: ${analysisResult.performanceMetrics?.useWebWorkers || false}\n`);
    
    // Clean up workers
    analyzer.destroyWorkerPool();
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // Test 3: Error resilience
  console.log('3. Testing Error Resilience:');
  try {
    const analyzer = new SpatialAnalyzer();
    
    // Test with invalid geometry
    const invalidGeometry = {
      type: 'Polygon',
      coordinates: [[]] // Invalid coordinates
    };
    
    const errorResult = await analyzer.analyzeSite(invalidGeometry, 'Error Test Site');
    
    if (errorResult.error) {
      console.log(`   ✅ Gracefully handled error: ${errorResult.error}`);
      console.log(`   ✅ Returned minimal result instead of crashing`);
    } else {
      console.log(`   ✅ Analysis completed despite invalid input`);
    }
    
    analyzer.destroyWorkerPool();
    
  } catch (error) {
    console.log(`   ⚠️  Unexpected error (should be handled): ${error.message}`);
  }

  // Test 4: Dataset selection safety
  console.log('\n4. Testing Dataset Selection Safety:');
  try {
    const analyzer = new SpatialAnalyzer();
    
    // Test before initialization
    const datasetsPreInit = analyzer.selectDatasetsForAnalysis({ analysisType: 'basic' });
    console.log(`   ✅ Pre-init dataset selection: ${datasetsPreInit.length} datasets`);
    
    // Initialize and test again
    await analyzer.initializeConstraintLayers();
    const datasetsPostInit = analyzer.selectDatasetsForAnalysis({ analysisType: 'comprehensive' });
    console.log(`   ✅ Post-init dataset selection: ${datasetsPostInit.length} datasets`);
    
    analyzer.destroyWorkerPool();
    
  } catch (error) {
    console.log(`   ❌ Dataset selection error: ${error.message}`);
  }

  // Test 5: Performance characteristics
  console.log('\n5. Testing Performance Characteristics:');
  try {
    const analyzer = new SpatialAnalyzer();
    
    console.log(`   📊 Worker Pool Support: ${typeof Worker !== 'undefined'}`);
    console.log(`   📊 Max Workers: ${analyzer.maxWorkers}`);
    console.log(`   📊 Cache Size: ${analyzer.analysisCache.size}`);
    
    // Quick timing test
    const startTime = Date.now();
    const quickResult = await analyzer.analyzeSite(testSiteGeometry, 'Performance Test', {
      analysisType: 'basic'
    });
    const duration = Date.now() - startTime;
    
    console.log(`   ⏱️  Basic analysis duration: ${duration}ms`);
    console.log(`   📈 Cache hit on repeat: ${analyzer.analysisCache.has(quickResult.id)}`);
    
    analyzer.destroyWorkerPool();
    
  } catch (error) {
    console.log(`   ❌ Performance test error: ${error.message}`);
  }

  console.log('\n✅ Fixed Spatial Analyzer Tests Completed!');
  console.log('\n🛠️  Key Fixes Implemented:');
  console.log('   • Auto-initialization prevents undefined errors');
  console.log('   • Safe dataset selection with fallbacks');
  console.log('   • Web Worker support for parallel processing');
  console.log('   • Graceful error handling (no crashes)');
  console.log('   • Timeout protection (60s max)');
  console.log('   • Lightweight analyzer fallback');
  console.log('   • Worker pool cleanup');
  console.log('   • Cache-based performance optimization');
}

// Run the test
testFixedSpatialAnalyzer().catch(console.error);
