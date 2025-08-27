/**
 * Test Enhanced Address Resolution System
 * Demonstrates the multi-tier fallback with LLM and free geocoding
 */

import { resolveAddressPhase } from '../packages/core/src/agent/phases/addressResolution.js';
import DocumentSummarizer from '../packages/core/src/document-summarizer.js';

// Mock agent for testing
const mockAgent = {
  config: {
    googleApiKey: process.env.GEMINI_API_KEY || null
  },
  addTimelineEvent: (assessment, type, message) => {
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
};

// Sample planning document text for testing
const sampleDocuments = {
  designStatement: `
DESIGN AND ACCESS STATEMENT

Site: 45 Victoria Street, Cambridge, CB1 1JP

This Design and Access Statement accompanies a planning application for the redevelopment of the site at 45 Victoria Street, Cambridge. The site is located within Cambridge City Council's administrative boundary and falls within the Central Conservation Area.

The proposal is for the demolition of the existing two-storey office building and the construction of a new four-storey mixed-use development comprising 12 residential apartments and commercial space at ground floor level.

Site Analysis:
The application site is located on the eastern side of Victoria Street, approximately 200m south of the railway station. The site has a total area of 0.15 hectares and currently accommodates a 1960s office building of limited architectural merit.

The site is bounded by:
- North: 43 Victoria Street (residential)
- South: 47 Victoria Street (retail)
- East: Rear gardens of Mill Road properties
- West: Victoria Street (B1050)

Local Planning Policy:
The development has been assessed against Cambridge Local Plan 2018 Policy H1 (Housing Development) and Policy CC1 (Climate Change).
  `,
  
  planningStatement: `
PLANNING STATEMENT
Application Reference: 23/04567/FUL

Development Proposal: Erection of 6 dwelling houses with associated parking and landscaping

Site Address: Land rear of The Swan Public House, High Street, Trumpington, Cambridge CB2 9LT

1. INTRODUCTION
This Planning Statement has been prepared by ABC Planning Consultants on behalf of Millennium Homes Ltd in support of a full planning application for residential development.

2. SITE DESCRIPTION
The application site comprises approximately 0.8 hectares of previously developed land located to the rear of The Swan Public House on High Street, Trumpington. The site is accessed via an existing vehicular access from High Street.

The site is located within the administrative boundary of South Cambridgeshire District Council and is designated as being within the Trumpington village envelope.

3. PROPOSAL
The development comprises:
- 6 detached dwelling houses (4 x 4-bed, 2 x 3-bed)
- 12 parking spaces (2 per dwelling)
- Private gardens for each dwelling
- Retention of existing mature trees along eastern boundary
- New landscaping and boundary treatments

Coordinates: 52.1756° N, 0.1278° E (approximate centre of site)
  `,
  
  noAddressDocument: `
ENVIRONMENTAL IMPACT ASSESSMENT

This report assesses the potential environmental impacts of the proposed development on air quality, noise, and ecology.

Chapter 1: Air Quality Assessment
The assessment has been undertaken in accordance with IAQM guidance and includes monitoring data from three locations within the study area.

Chapter 2: Noise Assessment  
A baseline noise survey was conducted over a 7-day period to establish existing ambient noise levels.

Chapter 3: Ecological Assessment
The site supports common urban wildlife including several bird species and small mammals.

Recommendations include mitigation measures for dust control during construction and ongoing monitoring of air quality.
  `
};

async function testAddressResolution() {
  console.log('🚀 Testing Enhanced Address Resolution System\n');

  // Test document summarizer first
  console.log('📄 Testing Document Summarizer...');
  const summarizer = new DocumentSummarizer();
  
  for (const [docName, content] of Object.entries(sampleDocuments)) {
    console.log(`\n--- Testing ${docName} ---`);
    
    // Test document type detection
    const typeAnalysis = await summarizer.analyzeDocumentType(content);
    console.log(`Document Type: ${typeAnalysis.type} (${(typeAnalysis.confidence * 100).toFixed(1)}% confidence)`);
    
    // Test key information extraction
    const keyInfo = summarizer.extractKeyInformation(content, typeAnalysis.type);
    console.log(`Extracted Addresses: ${keyInfo.addresses.length}`);
    if (keyInfo.addresses.length > 0) {
      keyInfo.addresses.forEach((addr, i) => console.log(`  ${i + 1}. ${addr}`));
    }
    
    if (keyInfo.applicationRef) {
      console.log(`Application Ref: ${keyInfo.applicationRef}`);
    }
    
    if (keyInfo.policies.length > 0) {
      console.log(`Policies Found: ${keyInfo.policies.slice(0, 3).join(', ')}`);
    }
    
    // Test summarization
    const summary = await summarizer.summarizeDocument(content, 200);
    console.log(`Summary (${summary.method}): ${summary.summary.substring(0, 150)}...`);
  }

  // Test full address resolution system
  console.log('\n\n🔍 Testing Full Address Resolution System...\n');
  
  for (const [docName, content] of Object.entries(sampleDocuments)) {
    console.log(`\n=== Testing ${docName} ===`);
    
    const mockDocumentResults = {
      addresses: [],
      extractedData: {
        fullText: content,
        addresses: []
      }
    };
    
    const mockAssessment = { id: `test-${docName}` };
    
    try {
      const result = await resolveAddressPhase(mockAgent, mockDocumentResults, mockAssessment);
      
      if (result && result.hasValidAddress) {
        console.log('✅ Address Resolution SUCCESSFUL');
        console.log(`Primary Address: ${result.primaryAddress.formattedAddress || result.primaryAddress.cleaned}`);
        if (result.primaryAddress.coordinates) {
          console.log(`Coordinates: ${result.primaryAddress.coordinates.lat}, ${result.primaryAddress.coordinates.lng}`);
        }
        console.log(`Method: ${result.primaryAddress.extractionMethod}`);
        console.log(`Confidence: ${(result.primaryAddress.confidence * 100).toFixed(1)}%`);
      } else {
        console.log('❌ Address Resolution FAILED');
        console.log('No valid addresses could be extracted or geocoded');
      }
    } catch (error) {
      console.log('💥 Address Resolution ERROR:', error.message);
    }
    
    console.log('\n' + '─'.repeat(50));
  }
}

// Test WebGPU availability
async function testWebGPUAvailability() {
  console.log('\n🖥️  Testing WebGPU Availability...');
  
  if (typeof navigator !== 'undefined' && navigator.gpu) {
    console.log('✅ WebGPU API available');
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        console.log('✅ WebGPU adapter found');
        const device = await adapter.requestDevice();
        console.log('✅ WebGPU device ready');
      } else {
        console.log('⚠️  No WebGPU adapter available');
      }
    } catch (error) {
      console.log('❌ WebGPU initialization failed:', error.message);
    }
  } else {
    console.log('❌ WebGPU not available (running in Node.js environment)');
    console.log('💡 WebGPU features will be available when running in a compatible browser');
  }
}

// Run tests
async function runTests() {
  await testWebGPUAvailability();
  await testAddressResolution();
  
  console.log('\n🎉 Testing Complete!');
  console.log('\nThe enhanced address resolution system now includes:');
  console.log('✅ WebGPU-accelerated document summarization (when available)');
  console.log('✅ LLM-based address analysis with Gemini API');
  console.log('✅ Free geocoding services (Nominatim & Photon)');
  console.log('✅ Advanced document type detection');
  console.log('✅ Multi-tier fallback strategies');
  console.log('✅ Comprehensive error diagnostics');
}

// Handle command line execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { testAddressResolution, testWebGPUAvailability, sampleDocuments };
