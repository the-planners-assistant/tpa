/**
 * Lightweight Document Summarizer
 * Uses WebGPU-accelerated models when available, falls back to pattern-based analysis
 */

export class DocumentSummarizer {
  constructor() {
    this.isWebGPUAvailable = false;
    this.model = null;
    this.tokenizer = null;
    this.initPromise = this.initialize();
  }

  async initialize() {
    try {
      // Check for WebGPU availability
      if (navigator.gpu) {
        this.isWebGPUAvailable = true;
        console.log('WebGPU available - attempting to load model');
        await this.loadWebGPUModel();
      } else {
        console.log('WebGPU not available - using pattern-based analysis');
      }
    } catch (error) {
      console.warn('WebGPU model loading failed, falling back to patterns:', error);
      this.isWebGPUAvailable = false;
    }
  }

  async loadWebGPUModel() {
    try {
      // Try to load a lightweight transformer model optimized for WebGPU
      const { pipeline, env } = await import('@xenova/transformers');
      
      // Configure for WebGPU if available
      env.backends.onnx.wasm.wasmPaths = '/models/';
      
      // Load a small summarization model
      this.model = await pipeline('summarization', 'Xenova/distilbart-cnn-6-6', {
        device: 'webgpu',
        dtype: 'fp16'
      });
      
      console.log('WebGPU summarization model loaded successfully');
    } catch (error) {
      console.warn('Failed to load WebGPU model:', error);
      this.isWebGPUAvailable = false;
    }
  }

  async summarizeDocument(textContent, maxLength = 500) {
    await this.initPromise;
    
    if (!textContent || textContent.length < 100) {
      return {
        summary: textContent,
        method: 'passthrough',
        confidence: 1.0
      };
    }

    // Try WebGPU model first
    if (this.isWebGPUAvailable && this.model) {
      try {
        return await this.summarizeWithWebGPU(textContent, maxLength);
      } catch (error) {
        console.warn('WebGPU summarization failed, falling back:', error);
      }
    }

    // Fallback to pattern-based summarization
    return this.summarizeWithPatterns(textContent, maxLength);
  }

  async summarizeWithWebGPU(textContent, maxLength) {
    // Chunk text for processing (models have token limits)
    const chunks = this.chunkText(textContent, 1000);
    const summaries = [];

    for (const chunk of chunks.slice(0, 3)) { // Limit to first 3 chunks for performance
      try {
        const result = await this.model(chunk, {
          max_length: Math.floor(maxLength / chunks.length),
          min_length: 30,
          do_sample: false
        });
        
        if (result && result[0] && result[0].summary_text) {
          summaries.push(result[0].summary_text);
        }
      } catch (error) {
        console.warn('Chunk summarization failed:', error);
      }
    }

    const combinedSummary = summaries.join(' ');
    
    return {
      summary: combinedSummary.length > maxLength ? 
        combinedSummary.substring(0, maxLength) + '...' : 
        combinedSummary,
      method: 'webgpu',
      confidence: 0.8,
      chunksProcessed: summaries.length
    };
  }

  summarizeWithPatterns(textContent, maxLength) {
    // Extract key sentences using pattern-based analysis
    const sentences = textContent.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
    
    // Score sentences based on keywords and position
    const scoredSentences = sentences.map((sentence, index) => ({
      text: sentence,
      score: this.scoreSentence(sentence, index, sentences.length),
      index
    }));

    // Sort by score and take top sentences
    scoredSentences.sort((a, b) => b.score - a.score);
    
    let summary = '';
    let currentLength = 0;
    
    for (const sentence of scoredSentences) {
      if (currentLength + sentence.text.length <= maxLength) {
        summary += sentence.text + '. ';
        currentLength += sentence.text.length + 2;
      }
      
      if (currentLength >= maxLength * 0.8) break;
    }

    return {
      summary: summary.trim(),
      method: 'pattern-based',
      confidence: 0.6,
      sentencesAnalyzed: sentences.length
    };
  }

  scoreSentence(sentence, index, totalSentences) {
    let score = 0;
    const lowerSentence = sentence.toLowerCase();

    // Position-based scoring (first and last sentences often important)
    if (index < 3) score += 0.3;
    if (index > totalSentences - 3) score += 0.2;

    // Planning-specific keywords
    const planningKeywords = [
      'planning', 'application', 'development', 'site', 'proposal', 'policy',
      'heritage', 'conservation', 'design', 'transport', 'environment',
      'residential', 'commercial', 'industrial', 'retail', 'office',
      'housing', 'apartments', 'dwellings', 'units', 'storeys', 'height',
      'access', 'parking', 'sustainability', 'flood', 'ecology', 'trees',
      'noise', 'air quality', 'contamination', 'archaeology', 'listed',
      'conservation area', 'green belt', 'affordable housing'
    ];

    for (const keyword of planningKeywords) {
      if (lowerSentence.includes(keyword)) {
        score += 0.1;
      }
    }

    // Length-based scoring (prefer medium-length sentences)
    const wordCount = sentence.split(' ').length;
    if (wordCount >= 8 && wordCount <= 25) score += 0.2;
    if (wordCount > 30) score -= 0.1;

    // Numerical data often important
    if (/\d+/.test(sentence)) score += 0.1;

    // Uppercase words might be important (but could be acronyms)
    const uppercaseWords = sentence.match(/\b[A-Z]{2,}\b/g);
    if (uppercaseWords && uppercaseWords.length > 0) score += 0.1;

    return score;
  }

  chunkText(text, maxChunkSize) {
    const words = text.split(/\s+/);
    const chunks = [];
    let currentChunk = [];
    let currentSize = 0;

    for (const word of words) {
      if (currentSize + word.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
        currentChunk = [word];
        currentSize = word.length;
      } else {
        currentChunk.push(word);
        currentSize += word.length + 1;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
    }

    return chunks;
  }

  async analyzeDocumentType(textContent) {
    await this.initPromise;
    
    const text = textContent.toLowerCase();
    const typeKeywords = {
      'Design and Access Statement': ['design and access', 'design & access', 'das'],
      'Planning Statement': ['planning statement', 'planning application'],
      'Heritage Statement': ['heritage statement', 'heritage assessment', 'listed building'],
      'Transport Statement': ['transport statement', 'transport assessment', 'traffic'],
      'Environmental Statement': ['environmental statement', 'environmental impact', 'eia'],
      'Flood Risk Assessment': ['flood risk assessment', 'flood risk', 'fra'],
      'Arboricultural Report': ['arboricultural', 'tree survey', 'tree report'],
      'Ecological Assessment': ['ecological', 'biodiversity', 'ecology'],
      'Noise Assessment': ['noise assessment', 'acoustic', 'sound'],
      'Ground Conditions Report': ['contamination', 'ground conditions', 'geotechnical'],
      'Housing Statement': ['affordable housing', 'housing statement', 'housing mix'],
      'Retail Statement': ['retail statement', 'retail impact', 'commercial'],
      'Supporting Plans': ['site plan', 'floor plan', 'elevation', 'section', 'drawing'],
      'Application Form': ['application form', 'planning application form', 'local authority']
    };

    let bestMatch = 'Planning Document';
    let highestScore = 0;

    for (const [docType, keywords] of Object.entries(typeKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          score += keyword.split(' ').length; // Longer phrases get higher scores
        }
      }
      
      if (score > highestScore) {
        highestScore = score;
        bestMatch = docType;
      }
    }

    return {
      type: bestMatch,
      confidence: Math.min(highestScore / 5, 1.0), // Normalize confidence
      keywords: typeKeywords[bestMatch] || []
    };
  }

  extractKeyInformation(textContent, documentType) {
    const info = {
      addresses: [],
      applicationRef: null,
      applicant: null,
      agent: null,
      proposalDescription: null,
      siteArea: null,
      floorArea: null,
      height: null,
      units: null,
      parking: null,
      policies: [],
      constraints: []
    };

    // Application reference
    const appRefMatch = textContent.match(/(?:application\s+(?:ref|reference|no|number)[:]\s*|app\s+ref[:]\s*)([A-Z0-9\/\-]{6,20})/i);
    if (appRefMatch) {
      info.applicationRef = appRefMatch[1];
    }

    // Addresses and postcodes
    const addressMatches = textContent.match(/\b\d+[\w\s,.-]*(?:street|road|avenue|lane|drive|close|way|place|crescent|square|terrace|gardens|park|mews|court|row|hill|green|grove|rise|vale|view|walk|gate|field|end|side|yard|estate)\b[^.]*[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}/gi);
    if (addressMatches) {
      info.addresses = [...new Set(addressMatches)];
    }

    // Site area
    const areaMatch = textContent.match(/(?:site\s+area|plot\s+area)[:]\s*([0-9,]+(?:\.\d+)?)\s*(m²|m2|sqm|square\s+metres?|hectares?|ha)/i);
    if (areaMatch) {
      info.siteArea = areaMatch[1] + ' ' + areaMatch[2];
    }

    // Building height
    const heightMatch = textContent.match(/(?:height|storey|floor)[:]\s*([0-9,]+(?:\.\d+)?)\s*(m|metres?|feet|ft|storey|floor)/i);
    if (heightMatch) {
      info.height = heightMatch[1] + ' ' + heightMatch[2];
    }

    // Number of units
    const unitsMatch = textContent.match(/(\d+)\s*(?:dwelling|unit|apartment|flat|house)s?/i);
    if (unitsMatch) {
      info.units = unitsMatch[1];
    }

    // Policy references
    const policyMatches = textContent.match(/(?:policy|para|paragraph)\s+([A-Z0-9\.]{2,10})/gi);
    if (policyMatches) {
      info.policies = [...new Set(policyMatches.map(m => m.trim()))];
    }

    return info;
  }
}

export default DocumentSummarizer;
