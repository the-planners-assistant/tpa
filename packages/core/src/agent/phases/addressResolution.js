import { GoogleGenerativeAI } from '@google/generative-ai';
import DocumentSummarizer from '../../document-summarizer.js';

/**
 * Enhanced Address Resolution Phase
 * Multi-tier fallback strategy for robust address/coordinate extraction
 */
export async function resolveAddressPhase(agent, documentResults, assessment) {
  agent.addTimelineEvent(assessment, 'address_resolution_start', 'Beginning comprehensive address resolution');
  
  // Collect all potential addresses from multiple sources
  const allAddresses = [...(documentResults.addresses || [])];
  if (documentResults.extractedData?.addresses) {
    allAddresses.push(...documentResults.extractedData.addresses);
  }
  
  // Extract addresses from document text content using improved patterns
  const textContent = documentResults.extractedData?.fullText || '';
  const extractedFromText = await extractAddressesFromText(agent, textContent, assessment);
  allAddresses.push(...extractedFromText);
  
  // Log what we found
  if (allAddresses.length === 0) {
    agent.addTimelineEvent(assessment, 'address_extraction_failed', 'No address-like strings found in documents');
    console.warn('Address Resolution: No addresses found in documents');
    return { 
      addresses: [], 
      primaryAddress: null, 
      hasValidAddress: false,
      resolutionStrategy: 'none',
      diagnostics: {
        textLength: textContent.length,
        addressCount: 0,
        reason: 'No addresses detected in document content'
      }
    };
  }
  
  agent.addTimelineEvent(assessment, 'address_extraction', `Found ${allAddresses.length} potential addresses from documents`);
  console.log('Address Resolution: Found addresses:', allAddresses);
  
  // Try to resolve addresses with Google geocoding first
  const addressResult = await agent.addressExtractor.extractAddresses(allAddresses.join(' '));
  
  if (!addressResult.hasValidAddress) {
    // Enhanced fallback 1: Try LLM-based address analysis
    const llmResult = await attemptLLMAddressResolution(agent, textContent, documentResults, assessment);
    if (llmResult && llmResult.hasValidAddress) {
      agent.addTimelineEvent(assessment, 'address_resolved_llm', `Resolved via LLM analysis: ${llmResult.primaryAddress.cleaned}`);
      console.log('Address Resolution: LLM analysis successful:', llmResult.primaryAddress);
      return { ...llmResult, resolutionStrategy: 'llm' };
    }
    
    // Enhanced fallback 2: Try free geocoding services
    const freeGeoResult = await attemptFreeGeocoding(agent, allAddresses, assessment);
    if (freeGeoResult && freeGeoResult.hasValidAddress) {
      agent.addTimelineEvent(assessment, 'address_resolved_free', `Resolved via free geocoding: ${freeGeoResult.primaryAddress.cleaned}`);
      console.log('Address Resolution: Free geocoding successful:', freeGeoResult.primaryAddress);
      return { ...freeGeoResult, resolutionStrategy: 'free_geocoding' };
    }
    
    // Enhanced fallback 3: Try alternative extraction strategies
    const fallbackResult = await attemptFallbackAddressResolution(agent, textContent, assessment);
    if (fallbackResult && fallbackResult.hasValidAddress) {
      agent.addTimelineEvent(assessment, 'address_resolved_fallback', `Resolved via fallback: ${fallbackResult.primaryAddress.cleaned}`);
      console.log('Address Resolution: Fallback successful:', fallbackResult.primaryAddress);
      return { ...fallbackResult, resolutionStrategy: 'fallback' };
    }
    
    // Log detailed diagnostics for debugging
    const diagnostics = {
      addressesFound: allAddresses,
      processedAddresses: addressResult.addresses,
      highestConfidence: addressResult.addresses[0]?.confidence || 0,
      googleApiConfigured: !!agent.addressExtractor.googleApiKey,
      geminiApiConfigured: !!agent.config.googleApiKey,
      textLength: textContent.length,
      llmAttempted: !!llmResult,
      freeGeoAttempted: !!freeGeoResult,
      reason: 'All address resolution strategies failed'
    };
    
    agent.addTimelineEvent(assessment, 'address_resolution_warning', 
      `No high-confidence address resolved (highest: ${(diagnostics.highestConfidence * 100).toFixed(1)}%); downstream spatial analysis may be limited`);
    
    console.warn('Address Resolution: No valid address found. Diagnostics:', diagnostics);
    
    return {
      ...addressResult,
      resolutionStrategy: 'failed',
      diagnostics
    };
  }
  
  agent.addTimelineEvent(assessment, 'address_resolved', 
    `Resolved address: ${addressResult.primaryAddress.formattedAddress || addressResult.primaryAddress.cleaned} (${(addressResult.primaryAddress.confidence * 100).toFixed(1)}% confidence)`);
  
  console.log('Address Resolution: Successfully resolved:', {
    address: addressResult.primaryAddress.cleaned,
    coordinates: addressResult.primaryAddress.coordinates,
    confidence: addressResult.primaryAddress.confidence
  });
  
  return {
    ...addressResult,
    resolutionStrategy: 'standard'
  };
}

async function extractAddressesFromText(agent, textContent, assessment) {
  if (!textContent) return [];
  
  const addresses = [];
  
  // Enhanced UK address patterns
  const patterns = [
    // Planning application specific patterns
    /(?:site|property|land)\s+(?:at|address|location)[:]\s*([^,\n]{10,80})/gi,
    /(?:address|location|site)[:]\s*([^,\n]{10,80})/gi,
    
    // Standard UK address patterns
    /(\d+(?:\-\d+)?)\s+([A-Za-z\s]+(?:Road|Street|Lane|Avenue|Drive|Close|Way|Place|Gardens|Park|Square|Terrace|Crescent|Grove|Rise|View|Court|Mews|Hill|Green|Common|Walk|Row|End|Side|Vale|Heights|Fields|Meadow|House|Building|Centre|Estate))[,\s]*([A-Za-z\s,]*[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][ABD-HJLNP-UW-Z]{2})?/gi,
    
    // Property names with postcodes
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:House|Building|Court|Lodge|Manor|Hall|Cottage|Farm|Mill|Works|Centre|Complex)[,\s]*([A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][ABD-HJLNP-UW-Z]{2})/gi,
    
    // Just postcodes (for area-based resolution)
    /\b([A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][ABD-HJLNP-UW-Z]{2})\b/gi
  ];
  
  for (const pattern of patterns) {
    const matches = [...textContent.matchAll(pattern)];
    for (const match of matches) {
      const address = match[1] || match[0];
      if (address && address.length > 5) {
        addresses.push(address.trim());
      }
    }
  }
  
  agent.addTimelineEvent(assessment, 'address_pattern_extraction', `Extracted ${addresses.length} addresses using enhanced patterns`);
  return [...new Set(addresses)]; // Remove duplicates
}

async function attemptLLMAddressResolution(agent, textContent, documentResults, assessment) {
  if (!agent.config.googleApiKey || !textContent) {
    agent.addTimelineEvent(assessment, 'llm_address_skipped', 'LLM address analysis skipped (no API key or text)');
    return null;
  }
  
  agent.addTimelineEvent(assessment, 'llm_address_start', 'Attempting LLM-based address analysis with document summarization');
  
  try {
    // Initialize document summarizer for efficient processing
    const summarizer = new DocumentSummarizer();
    
    // Analyze document type using advanced patterns
    const documentTypeAnalysis = await summarizer.analyzeDocumentType(textContent);
    agent.addTimelineEvent(assessment, 'document_type_detected', 
      `Document type: ${documentTypeAnalysis.type} (confidence: ${(documentTypeAnalysis.confidence * 100).toFixed(1)}%)`);
    
    // Extract key information using pattern-based analysis first
    const keyInfo = summarizer.extractKeyInformation(textContent, documentTypeAnalysis.type);
    
    // If we found addresses through pattern analysis, use them with parallel geocoding
    if (keyInfo.addresses && keyInfo.addresses.length > 0) {
      agent.addTimelineEvent(assessment, 'pattern_addresses_found', 
        `Found ${keyInfo.addresses.length} addresses via pattern analysis`);
      
      // Parallel geocoding of all found addresses
      const geocodePromises = keyInfo.addresses.map(async (address) => {
        const geocodeResult = await tryFreeGeocoding(address);
        if (geocodeResult) {
          return {
            address,
            result: geocodeResult
          };
        }
        return null;
      });
      
      const geocodeResults = await Promise.all(geocodePromises);
      const validResults = geocodeResults.filter(result => result !== null);
      
      if (validResults.length > 0) {
        // Use the first valid geocoded address
        const bestResult = validResults[0];
        return {
          addresses: validResults.map(r => ({
            rawText: r.address,
            cleaned: r.address,
            confidence: 0.8,
            coordinates: r.result.coordinates,
            formattedAddress: r.result.formattedAddress,
            extractionMethod: 'pattern_analysis',
            patternInfo: keyInfo
          })),
          primaryAddress: {
            rawText: bestResult.address,
            cleaned: bestResult.address,
            confidence: 0.8,
            coordinates: bestResult.result.coordinates,
            formattedAddress: bestResult.result.formattedAddress,
            extractionMethod: 'pattern_analysis',
            patternInfo: keyInfo
          },
          hasValidAddress: true
        };
      }
    }
    
    // If pattern analysis didn't work, use parallel LLM approaches with summarized content
    const summaryResult = await summarizer.summarizeDocument(textContent, 2000);
    agent.addTimelineEvent(assessment, 'document_summarized', 
      `Document summarized using ${summaryResult.method} (${summaryResult.summary.length} chars)`);

    // Try multiple LLM approaches in parallel for better accuracy
    const llmPromises = [];
    
    // Approach 1: Standard address extraction
    const standardPrompt = buildAddressExtractionPrompt(summaryResult.summary, documentTypeAnalysis);
    llmPromises.push(callLLMForAddressExtraction(agent, standardPrompt, 'standard'));
    
    // Approach 2: Location-focused extraction if document is long enough
    if (summaryResult.summary.length > 500) {
      const locationPrompt = buildLocationFocusedPrompt(summaryResult.summary, documentTypeAnalysis);
      llmPromises.push(callLLMForAddressExtraction(agent, locationPrompt, 'location_focused'));
    }
    
    // Approach 3: If we have key sections, analyze them separately
    if (keyInfo.sections && keyInfo.sections.length > 0) {
      const sectionPrompt = buildSectionBasedPrompt(keyInfo.sections, documentTypeAnalysis);
      llmPromises.push(callLLMForAddressExtraction(agent, sectionPrompt, 'section_based'));
    }
    
    // Execute all LLM approaches in parallel
    const llmResults = await Promise.allSettled(llmPromises);
    
    // Process results and find the best one
    for (const result of llmResults) {
      if (result.status === 'fulfilled' && result.value) {
        const processedResult = await processLLMExtraction(result.value, agent);
        if (processedResult && processedResult.hasValidAddress) {
          return processedResult;
        }
      }
    }
    
    return null;
    
  } catch (error) {
    console.warn('LLM address analysis failed:', error);
    agent.addTimelineEvent(assessment, 'llm_address_failed', `LLM analysis failed: ${error.message}`);
  }
  
  return null;
}

async function detectDocumentType(agent, textContent, documentResults) {
  // Lightweight document type detection
  const text = textContent.toLowerCase();
  
  if (text.includes('design and access statement') || text.includes('design & access')) {
    return 'Design and Access Statement';
  } else if (text.includes('planning statement') || text.includes('planning application')) {
    return 'Planning Statement';
  } else if (text.includes('heritage statement') || text.includes('heritage assessment')) {
    return 'Heritage Statement';
  } else if (text.includes('transport statement') || text.includes('transport assessment')) {
    return 'Transport Statement';
  } else if (text.includes('environmental statement') || text.includes('environmental impact')) {
    return 'Environmental Statement';
  } else if (text.includes('flood risk assessment') || text.includes('flood risk')) {
    return 'Flood Risk Assessment';
  } else if (text.includes('arboricultural') || text.includes('tree survey')) {
    return 'Arboricultural Report';
  } else if (text.includes('ecological') || text.includes('biodiversity')) {
    return 'Ecological Assessment';
  } else if (text.includes('noise assessment') || text.includes('acoustic')) {
    return 'Noise Assessment';
  } else if (text.includes('contamination') || text.includes('ground conditions')) {
    return 'Ground Conditions Report';
  } else if (text.includes('affordable housing') || text.includes('housing statement')) {
    return 'Housing Statement';
  } else if (text.includes('retail statement') || text.includes('retail impact')) {
    return 'Retail Statement';
  } else {
    return 'Planning Document';
  }
}

async function attemptFreeGeocoding(agent, addresses, assessment) {
  agent.addTimelineEvent(assessment, 'free_geocoding_start', 'Attempting free geocoding services');
  
  for (const address of addresses) {
    const result = await tryFreeGeocoding(address);
    if (result) {
      return {
        addresses: [{
          rawText: address,
          cleaned: address,
          confidence: 0.6,
          coordinates: result.coordinates,
          formattedAddress: result.formattedAddress,
          extractionMethod: 'free_geocoding'
        }],
        primaryAddress: {
          rawText: address,
          cleaned: address,
          confidence: 0.6,
          coordinates: result.coordinates,
          formattedAddress: result.formattedAddress,
          extractionMethod: 'free_geocoding'
        },
        hasValidAddress: true
      };
    }
  }
  
  return null;
}

async function tryFreeGeocoding(address) {
  // Free geocoding services (no API key required)
  const services = [
    {
      name: 'Nominatim (OpenStreetMap)',
      url: `https://nominatim.openstreetmap.org/search?format=json&countrycodes=gb&limit=1&q=${encodeURIComponent(address + ', UK')}`,
      parseResponse: (data) => {
        if (data && data.length > 0) {
          const result = data[0];
          return {
            coordinates: [parseFloat(result.lon), parseFloat(result.lat)],
            formattedAddress: result.display_name
          };
        }
        return null;
      }
    },
    {
      name: 'Photon (OpenStreetMap)',
      url: `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&lat=54.5&lon=-2&zoom=6&limit=1`,
      parseResponse: (data) => {
        if (data && data.features && data.features.length > 0) {
          const result = data.features[0];
          return {
            coordinates: result.geometry.coordinates,
            formattedAddress: result.properties.name || result.properties.street
          };
        }
        return null;
      }
    }
  ];
  
  for (const service of services) {
    try {
      console.log(`Trying ${service.name} for address: ${address}`);
      
      const response = await fetch(service.url, {
        headers: {
          'User-Agent': 'TPA-Planning-Assistant/1.0'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const result = service.parseResponse(data);
        
        if (result && result.coordinates) {
          console.log(`${service.name} success:`, result);
          return result;
        }
      }
      
      // Rate limiting - wait between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.warn(`${service.name} geocoding failed:`, error);
    }
  }
  
  return null;
}

async function attemptFallbackAddressResolution(agent, textContent, assessment) {
  agent.addTimelineEvent(assessment, 'address_fallback_start', 'Attempting fallback address resolution strategies');
  
  // Strategy 1: Look for postcodes only and use those for area-based resolution
  const postcodes = textContent.match(/\b[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][ABD-HJLNP-UW-Z]{2}\b/gi);
  if (postcodes && postcodes.length > 0) {
    const uniquePostcodes = [...new Set(postcodes)];
    agent.addTimelineEvent(assessment, 'postcode_fallback', `Found ${uniquePostcodes.length} postcodes for area-based resolution`);
    
    for (const postcode of uniquePostcodes) {
      try {
        // Try free geocoding for postcode
        const result = await tryFreeGeocoding(postcode + ', UK');
        if (result && result.coordinates) {
          agent.addTimelineEvent(assessment, 'postcode_resolved', `Resolved using postcode: ${postcode}`);
          return {
            addresses: [{
              rawText: postcode,
              cleaned: postcode + ', UK',
              confidence: 0.6,
              coordinates: result.coordinates,
              formattedAddress: result.formattedAddress,
              fallbackMethod: 'postcode'
            }],
            primaryAddress: {
              rawText: postcode,
              cleaned: postcode + ', UK',
              confidence: 0.6,
              coordinates: result.coordinates,
              formattedAddress: result.formattedAddress,
              fallbackMethod: 'postcode'
            },
            hasValidAddress: true
          };
        }
      } catch (error) {
        console.warn(`Postcode resolution failed for ${postcode}:`, error);
      }
    }
  }
  
  // Strategy 2: Look for area/town names and try to resolve those
  const areaPatterns = [
    /(?:in|near|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),?\s+(?:Council|Borough|District)/gi
  ];
  
  for (const pattern of areaPatterns) {
    const matches = [...textContent.matchAll(pattern)];
    for (const match of matches) {
      const area = match[1];
      if (area && area.length > 3) {
        try {
          const result = await tryFreeGeocoding(area + ', UK');
          if (result && result.coordinates) {
            agent.addTimelineEvent(assessment, 'area_resolved', `Resolved using area name: ${area}`);
            return {
              addresses: [{
                rawText: area,
                cleaned: area + ', UK',
                confidence: 0.4,
                coordinates: result.coordinates,
                formattedAddress: result.formattedAddress,
                fallbackMethod: 'area'
              }],
              primaryAddress: {
                rawText: area,
                cleaned: area + ', UK',
                confidence: 0.4,
                coordinates: result.coordinates,
                formattedAddress: result.formattedAddress,
                fallbackMethod: 'area'
              },
              hasValidAddress: true
            };
          }
        } catch (error) {
          console.warn(`Area resolution failed for ${area}:`, error);
        }
      }
    }
  }
  
  agent.addTimelineEvent(assessment, 'address_fallback_failed', 'All fallback address resolution strategies failed');
  return null;
}

// Parallel LLM processing helper functions
function buildAddressExtractionPrompt(summary, documentTypeAnalysis) {
  return `Analyze this ${documentTypeAnalysis.type} planning document and extract the site address and location information.

Document summary: ${summary}

Document type: ${documentTypeAnalysis.type}
Confidence: ${(documentTypeAnalysis.confidence * 100).toFixed(1)}%

Please extract:
1. The complete site address including postcode
2. Alternative address formats mentioned
3. Nearby landmarks or references that could help with location
4. Any coordinates or grid references mentioned
5. Local authority or borough name
6. Ward or district mentioned

Format your response as JSON:
{
  "primaryAddress": "full address with postcode",
  "alternativeAddresses": ["alternative 1", "alternative 2"],
  "landmarks": ["landmark 1", "landmark 2"],
  "coordinates": "if found",
  "localAuthority": "council name",
  "ward": "ward name",
  "confidence": 0.8
}`;
}

function buildLocationFocusedPrompt(summary, documentTypeAnalysis) {
  return `Focus specifically on location and geographical references in this ${documentTypeAnalysis.type} document.

Document summary: ${summary}

Extract all location information including:
1. Primary site address
2. Street names and numbers
3. Postcode or postal areas
4. Geographic coordinates
5. Nearby roads, landmarks, or areas

Return as JSON:
{
  "primaryAddress": "main address",
  "coordinates": "lat,lng or grid ref",
  "nearbyLandmarks": ["landmark1", "landmark2"],
  "streetReferences": ["street1", "street2"],
  "confidence": 0.8
}`;
}

function buildSectionBasedPrompt(sections, documentTypeAnalysis) {
  return `Analyze specific sections of this ${documentTypeAnalysis.type} document for address information.

Key sections: ${sections.join(', ')}

Focus on extracting the development site address from these sections.

Return as JSON:
{
  "primaryAddress": "extracted address",
  "sectionsAnalyzed": ["section1", "section2"],
  "confidence": 0.8
}`;
}

async function callLLMForAddressExtraction(agent, prompt, approach) {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${agent.config.googleApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024
        }
      })
    });

    const result = await response.json();
    
    if (result.candidates && result.candidates[0]) {
      const analysisText = result.candidates[0].content.parts[0].text;
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0]);
        return { extracted, approach };
      }
    }
    return null;
  } catch (error) {
    console.warn(`LLM address extraction failed for approach ${approach}:`, error);
    return null;
  }
}

async function processLLMExtraction(llmResult, agent) {
  if (!llmResult || !llmResult.extracted || !llmResult.extracted.primaryAddress) {
    return null;
  }

  const { extracted, approach } = llmResult;
  
  // Try to geocode the LLM-extracted address
  const geocodeResult = await tryFreeGeocoding(extracted.primaryAddress);
  
  if (geocodeResult) {
    return {
      addresses: [{
        rawText: extracted.primaryAddress,
        cleaned: extracted.primaryAddress,
        confidence: extracted.confidence || 0.7,
        coordinates: geocodeResult.coordinates,
        formattedAddress: geocodeResult.formattedAddress,
        extractionMethod: `llm_${approach}`,
        llmAnalysis: extracted
      }],
      primaryAddress: {
        rawText: extracted.primaryAddress,
        cleaned: extracted.primaryAddress,
        confidence: extracted.confidence || 0.7,
        coordinates: geocodeResult.coordinates,
        formattedAddress: geocodeResult.formattedAddress,
        extractionMethod: `llm_${approach}`,
        llmAnalysis: extracted
      },
      hasValidAddress: true
    };
  }
  
  return null;
}
