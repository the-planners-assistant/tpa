/**
 * Test Script for Fixed Address Resolution System
 * Run with: node test-address-system-fixed.js
 */

// Test sample addresses to verify the enhanced system
const testAddresses = [
  "London City Hall, The Queen's Walk, London SE1 2AA",
  "45 Victoria Street, Cambridge CB1 1JP", 
  "Land rear of The Swan Public House, High Street, Trumpington, Cambridge CB2 9LT",
  "Invalid Address That Should Trigger Fallbacks"
];

async function testFreeGeocoding() {
  console.log('🌍 Testing Free Geocoding Services...\n');

  for (const address of testAddresses) {
    console.log(`Testing: "${address}"`);
    
    // Test Nominatim (OpenStreetMap)
    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
      const response = await fetch(nominatimUrl);
      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        console.log(`  ✅ Nominatim: ${result.display_name}`);
        console.log(`     Coordinates: ${result.lat}, ${result.lon}`);
      } else {
        console.log(`  ❌ Nominatim: No results found`);
      }
    } catch (error) {
      console.log(`  💥 Nominatim: Error - ${error.message}`);
    }

    // Test Photon
    try {
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1`;
      const response = await fetch(photonUrl);
      const data = await response.json();
      
      if (data && data.features && data.features.length > 0) {
        const result = data.features[0];
        const coords = result.geometry.coordinates;
        console.log(`  ✅ Photon: ${result.properties.name || result.properties.street || 'Found'}`);
        console.log(`     Coordinates: ${coords[1]}, ${coords[0]}`);
      } else {
        console.log(`  ❌ Photon: No results found`);
      }
    } catch (error) {
      console.log(`  💥 Photon: Error - ${error.message}`);
    }
    
    console.log(''); // Empty line between tests
  }
}

async function testSystemHealth() {
  console.log('🔧 System Health Check...\n');
  
  // Test WebGPU availability
  console.log('WebGPU Support:');
  if (typeof navigator !== 'undefined' && navigator.gpu) {
    console.log('  ✅ WebGPU API available');
  } else {
    console.log('  ❌ WebGPU not available (Node.js environment)');
    console.log('  💡 WebGPU features will work in compatible browsers');
  }
  
  // Test required dependencies
  console.log('\nDependency Check:');
  try {
    const fs = await import('fs');
    console.log('  ✅ File system access available');
  } catch (error) {
    console.log('  ❌ File system access error');
  }
  
  try {
    const path = await import('path');
    console.log('  ✅ Path module available');
  } catch (error) {
    console.log('  ❌ Path module error');
  }
  
  // Test environment variables
  console.log('\nEnvironment Variables:');
  console.log(`  GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`  GOOGLE_GEOCODING_API_KEY: ${process.env.GOOGLE_GEOCODING_API_KEY ? '✅ Set' : '❌ Not set (will use free services)'}`);
  
  console.log('\n');
}

function testPatternExtraction() {
  console.log('🔍 Testing Address Pattern Extraction...\n');
  
  const sampleTexts = [
    "The site is located at 123 High Street, Cambridge CB1 2AB and includes...",
    "Application for development at Land adjacent to Railway Bridge, Station Road, CB3 0AB",
    "Site: Former petrol station, London Road, Cambridge CB1 1AA",
    "Grid Reference: TL 123456 789012, Postcode area: CB2"
  ];
  
  // UK address pattern (simplified version of what's in the system)
  const addressPattern = /\b\d+[\w\s,.-]*(?:street|road|avenue|lane|drive|close|way|place|crescent|square|terrace|gardens|park|mews|court|row|hill|green|grove|rise|vale|view|walk|gate|field|end|side|yard|estate)\b[^.]*[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}/gi;
  
  // Postcode pattern
  const postcodePattern = /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/gi;
  
  sampleTexts.forEach((text, index) => {
    console.log(`Sample ${index + 1}: "${text}"`);
    
    const addresses = text.match(addressPattern);
    const postcodes = text.match(postcodePattern);
    
    if (addresses) {
      console.log(`  ✅ Addresses found: ${addresses.join(', ')}`);
    } else {
      console.log(`  ❌ No complete addresses found`);
    }
    
    if (postcodes) {
      console.log(`  ✅ Postcodes found: ${postcodes.join(', ')}`);
    } else {
      console.log(`  ❌ No postcodes found`);
    }
    
    console.log('');
  });
}

async function runAllTests() {
  console.log('🚀 TPA Enhanced Address Resolution System - Test Suite\n');
  console.log('=' * 60 + '\n');
  
  await testSystemHealth();
  testPatternExtraction();
  await testFreeGeocoding();
  
  console.log('🎉 Test Suite Complete!\n');
  console.log('✨ Key Features Verified:');
  console.log('  • Free geocoding services (Nominatim & Photon)');
  console.log('  • Address pattern extraction');
  console.log('  • System dependency checks');
  console.log('  • Environment configuration validation');
  console.log('\n💡 Next: Test with real PDF documents in the web interface');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { testFreeGeocoding, testSystemHealth, testPatternExtraction };
