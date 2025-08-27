import { getDatabase } from '@tpa/core/src/database.js';

/**
 * Enhanced PDF Parser with Multimodal Capabilities
 * Extracts text, images, addresses, and metadata for comprehensive planning document analysis
 */
class Parser {
  constructor() {
    this.pdfjsLib = null;
    this.db = getDatabase();
    this.geminiApiKey = null;
    this.addressRegex = /\b\d+[\w\s,.-]*(?:street|road|avenue|lane|drive|close|way|place|crescent|square|terrace|gardens|park|mews|court|row|hill|green|grove|rise|vale|view|walk|gate|field|end|side|yard|estate)\b/gi;
    this.postcodeRegex = /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/gi;
  this.ocrEnabled = true; // can be toggled
  this._tesseract = null; // lazy load reference
  }

  setGeminiApiKey(apiKey) {
    this.geminiApiKey = apiKey;
  }

  async initPdfJs() {
    if (typeof window !== 'undefined' && !this.pdfjsLib) {
      try {
        // Import core build
        const pdfjsLib = await import('pdfjs-dist/build/pdf');
        this.pdfjsLib = pdfjsLib;

        // Attempt self-host or dynamic worker resolution strategies
        let workerSet = false;
        // 1. If bundler exposes an ESM worker via query (try/catch safe)
        try {
          // Some bundlers support ?worker or ?url; we attempt common pattern
          const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs');
          if (workerModule && workerModule.default) {
            // Not a URL string; cannot directly assign
          }
        } catch (_) {}

        if (!workerSet) {
          // 2. Try CDN (original approach) but guarded
          const cdnUrl = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
            pdfjsLib.GlobalWorkerOptions.workerSrc = cdnUrl;
            workerSet = true;
        }

        // 3. Test worker creation quickly; if it fails, disable worker fallback
        try {
          // Trigger a minimal worker init by creating a dummy loading task (won't resolve fully)
          const testTask = pdfjsLib.getDocument({ data: new Uint8Array([0x25,0x50,0x44,0x46,0x2d]) }); // %PDF- sentinel
          // Suppress promise rejection explicitly (some builds emit InvalidPDFException for this synthetic doc)
          if (testTask && testTask.promise) {
            testTask.promise.then(() => { try { testTask.destroy(); } catch(_) {} }).catch(() => { try { testTask.destroy(); } catch(_) {} });
          } else {
            // Fallback simple timeout cleanup
            setTimeout(() => { try { testTask.destroy(); } catch(_) {} }, 50);
          }
        } catch (err) {
          console.warn('PDF worker test failed, falling back to disableWorker mode:', err);
          pdfjsLib.GlobalWorkerOptions.workerSrc = undefined;
          pdfjsLib.disableWorker = true;
        }
      } catch (e) {
        console.error('Failed to initialize pdf.js build; falling back to disabled worker mode:', e);
        // Last resort: try legacy import
        try {
          const legacyLib = await import('pdfjs-dist/legacy/build/pdf');
          legacyLib.disableWorker = true;
          this.pdfjsLib = legacyLib;
        } catch (legacyErr) {
          console.error('Legacy pdf.js load also failed:', legacyErr);
        }
      }
    }
  }

  /**
   * Enhanced parse method with multimodal extraction
   */
  async parse(dataBuffer, options = {}) {
    await this.initPdfJs();
    
    if (!this.pdfjsLib) {
      throw new Error('PDF.js is not available in this environment');
    }
    // Normalise incoming data (caller may have passed an object with { data, name })
    let raw = dataBuffer;
    if (raw && raw.data instanceof ArrayBuffer) {
      raw = raw.data;
    } else if (raw && raw.data && raw.data.buffer instanceof ArrayBuffer) {
      // Some libraries wrap again
      raw = raw.data.buffer;
    } else if (raw && raw.buffer instanceof ArrayBuffer && !(raw instanceof ArrayBuffer)) {
      // Could be a view (e.g. Uint8Array)
      raw = raw.buffer;
    }

    if (!(raw instanceof ArrayBuffer)) {
      throw new Error('Unsupported PDF input: expected ArrayBuffer or { data: ArrayBuffer }');
    }

    // Ensure we give pdf.js a Uint8Array (more reliable for structure checks)
    let uint8 = new Uint8Array(raw);

    // Quick magic header verification (%PDF)
    if (!(uint8[0] === 0x25 && uint8[1] === 0x50 && uint8[2] === 0x44 && uint8[3] === 0x46)) {
      // Sometimes first bytes may include BOM or junk; attempt to locate '%PDF'
      const textSample = new TextDecoder().decode(uint8.slice(0, 1024));
      const idx = textSample.indexOf('%PDF');
      if (idx > 0) {
        // Realign by trimming leading junk
        uint8 = uint8.slice(idx);
      }
    }

    let pdf;
    try {
      // Try with standard settings first
      pdf = await this.pdfjsLib.getDocument({ 
        data: uint8,
        useSystemFonts: true,
        stopAtErrors: false
      }).promise;
    } catch (err) {
      const msg = String(err && err.message || err);
      console.warn('Initial PDF parse failed:', msg);
      
      // Try multiple recovery strategies
      if (/Invalid PDF structure|PDF header|corrupted|malformed/i.test(msg)) {
        // Strategy 1: Try with worker disabled
        if (!this.pdfjsLib.disableWorker) {
          try {
            this.pdfjsLib.disableWorker = true;
            pdf = await this.pdfjsLib.getDocument({ 
              data: uint8,
              useSystemFonts: true,
              stopAtErrors: false,
              verbosity: 0
            }).promise;
            console.log('PDF parsed successfully with worker disabled');
          } catch (err2) {
            // Strategy 2: Try with more permissive settings
            try {
              pdf = await this.pdfjsLib.getDocument({ 
                data: uint8,
                useSystemFonts: true,
                stopAtErrors: false,
                verbosity: 0,
                isEvalSupported: false,
                maxImageSize: -1
              }).promise;
              console.log('PDF parsed with permissive settings');
            } catch (err3) {
              // Strategy 3: Last resort - treat as text
              console.warn('All PDF parsing strategies failed, falling back to text extraction');
              const textContent = this.decodeAsText(uint8);
              return this.buildPlainTextResult(textContent, { pseudo: true, originalError: msg });
            }
          }
        } else {
          // Worker already disabled, try permissive settings
          try {
            pdf = await this.pdfjsLib.getDocument({ 
              data: uint8,
              useSystemFonts: true,
              stopAtErrors: false,
              verbosity: 0,
              isEvalSupported: false,
              maxImageSize: -1
            }).promise;
            console.log('PDF parsed with permissive settings (worker pre-disabled)');
          } catch (err2) {
            console.warn('Falling back to text extraction after permissive parse failed');
            const textContent = this.decodeAsText(uint8);
            return this.buildPlainTextResult(textContent, { pseudo: true, originalError: msg });
          }
        }
      } else {
        // Non-structure error: still try one fallback before giving up
        try {
          const textContent = this.decodeAsText(uint8);
          if (textContent && textContent.length > 100) {
            console.warn('PDF error but text extraction successful, using text mode');
            return this.buildPlainTextResult(textContent, { pseudo: true, originalError: msg });
          }
        } catch (textErr) {
          // If even text extraction fails, re-throw original error
          throw new Error(`PDF parsing failed: ${msg}. Text extraction also failed: ${textErr.message}`);
        }
        throw err;
      }
    }
    const numPages = pdf.numPages;
    
    const result = {
      text: '',
      pages: [],
      images: [],
      addresses: [],
      metadata: {
        numPages,
        title: pdf._pdfInfo?.info?.Title || null,
        author: pdf._pdfInfo?.info?.Author || null,
        subject: pdf._pdfInfo?.info?.Subject || null,
        creator: pdf._pdfInfo?.info?.Creator || null,
        producer: pdf._pdfInfo?.info?.Producer || null,
        creationDate: pdf._pdfInfo?.info?.CreationDate || null,
        modificationDate: pdf._pdfInfo?.info?.ModDate || null
      },
      analysis: {},
      processingTime: Date.now()
    };

    // Process each page
    for (let i = 1; i <= numPages; i++) {
      const pageData = await this.processPage(pdf, i, options);
      result.pages.push(pageData);
      result.text += pageData.text + '\n\n';
      result.images.push(...pageData.images);
    }

    // If text is suspiciously short and we have images, try OCR fallback
    if (this.ocrEnabled && (!result.text || result.text.trim().length < 120) && result.images.length > 0 && options.enableOCR !== false) {
      try {
        const ocrText = await this.runOcrOnImages(result.images, options);
        if (ocrText && ocrText.length > result.text.length) {
          console.log(`OCR fallback recovered ${(ocrText.length - result.text.length)} extra characters`);
          result.text = (result.text + '\n' + ocrText).trim();
        }
      } catch (ocrErr) {
        console.warn('OCR fallback failed:', ocrErr.message);
      }
    }

  // Extract addresses from all text using heuristic parser
  result.addresses = this.extractAddresses(result.text);

    // Analyze document type and content
    result.analysis = await this.analyzeDocument(result, options);

    result.processingTime = Date.now() - result.processingTime;

    return result;
  }

  /**
   * Process individual PDF page
   */
  async processPage(pdf, pageNumber, options = {}) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.0 });
    
    const pageData = {
      pageNumber,
      text: '',
      images: [],
      annotations: [],
      dimensions: {
        width: viewport.width,
        height: viewport.height
      }
    };

    // Extract text content
    const textContent = await page.getTextContent();
    const textItems = textContent.items.map(item => ({
      text: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
      height: item.height,
      fontName: item.fontName,
      fontSize: item.transform[0]
    }));
    
    pageData.text = textItems.map(item => item.text).join(' ');
    pageData.textItems = textItems;

    // Extract images if requested
    if (options.extractImages !== false) {
      pageData.images = await this.extractPageImages(page, pageNumber);
    }

    // Extract annotations (form fields, comments, etc.)
    const annotations = await page.getAnnotations();
    pageData.annotations = annotations.map(annotation => ({
      type: annotation.subtype,
      content: annotation.contents || annotation.buttonValue || '',
      rect: annotation.rect,
      page: pageNumber
    }));

    return pageData;
  }

  /**
   * Extract images from PDF page
   */
  async extractPageImages(page, pageNumber) {
    const images = [];
    
    try {
      const operatorList = await page.getOperatorList();
      
      for (let i = 0; i < operatorList.fnArray.length; i++) {
        if (operatorList.fnArray[i] === this.pdfjsLib.OPS.paintImageXObject) {
          const imageName = operatorList.argsArray[i][0];
          
          try {
            // Attempt synchronous retrieval first
            let image = page.objs.get(imageName);
            if (!image) {
              // Fallback: wait for object resolution via callback pattern pdf.js supports
              image = await new Promise((resolve, reject) => {
                let settled = false;
                const timeout = setTimeout(() => { if (!settled) { settled = true; reject(new Error('Image object resolution timeout')); } }, 1500);
                try {
                  page.objs.get(imageName, data => {
                    if (settled) return; settled = true; clearTimeout(timeout); resolve(data);
                  });
                } catch (cbErr) {
                  if (!settled) { settled = true; clearTimeout(timeout); reject(cbErr); }
                }
              }).catch(err => {
                // Swallow unresolved image gracefully
                return null;
              });
            }

            // Some builds may expose image as { data, width, height } OR an ImageData-like object
            if (image && image.data && image.width && image.height) {
              const imageData = {
                page: pageNumber,
                name: imageName,
                width: image.width,
                height: image.height,
                data: image.data,
                kind: image.kind,
                type: this.detectImageType(image),
                analysis: null
              };

              imageData.base64 = this.imageDataToBase64(image);
              if (this.geminiApiKey && imageData.base64) {
                try {
                  imageData.analysis = await this.analyzeImageWithGemini(imageData.base64, pageNumber);
                } catch (visionErr) {
                  imageData.analysis = { error: visionErr.message };
                }
              }
              images.push(imageData);
            }
          } catch (imageError) {
            // Many PDFs have unresolved image references - this is common and not critical
            if (this.options?.debug) {
              console.debug(`Image ${imageName} unavailable on page ${pageNumber + 1}: ${imageError.message}`);
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to extract images from page ${pageNumber + 1}:`, error);
    }

    // Log successful extraction summary
    if (images.length > 0 && this.options?.debug) {
      console.log(`Extracted ${images.length} images from page ${pageNumber + 1}`);
    }

    return images;
  }

  /**
   * Detect image type (plan, elevation, photo, etc.)
   */
  detectImageType(image) {
    const aspectRatio = image.width / image.height;
    
    if (aspectRatio > 2) return 'elevation'; // Wide images likely elevations
    if (aspectRatio > 1.4 && aspectRatio < 1.6) return 'plan'; // Square-ish likely plans
    if (aspectRatio < 0.8) return 'section'; // Tall images likely sections
    return 'photo'; // Default to photo/rendering
  }

  /**
   * Lazy-load Tesseract and perform OCR over extracted images (browser or Node with Canvas polyfill).
   * Returns concatenated text.
   */
  async runOcrOnImages(images, options = {}) {
    if (!images || images.length === 0) return '';
    // Only attempt a limited number to control performance
    const limit = options.ocrImageLimit || 5;
    const subset = images.slice(0, limit);
    if (!this._tesseract) {
      try {
        this._tesseract = await import('tesseract.js');
      } catch (e) {
        console.warn('Tesseract.js not available for OCR:', e.message);
        return '';
      }
    }
    const { createWorker } = this._tesseract; // v5 API compatibility
    const worker = await createWorker?.({ logger: m => { if (options.ocrDebug) console.log('OCR', m); } });
    if (!worker) return '';
    try {
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      let combined = '';
      for (const img of subset) {
        if (!img.base64) continue;
        try {
          const { data } = await worker.recognize(`data:image/png;base64,${img.base64}`);
            if (data && data.text) {
              combined += '\n' + data.text.trim();
            }
        } catch (err) {
          if (options.ocrDebug) console.warn('Image OCR failed:', err.message);
        }
      }
      return combined.trim();
    } finally {
      try { await worker.terminate(); } catch(_) {}
    }
  }

  /**
   * Convert image data to base64
   */
  imageDataToBase64(image) {
    try {
      // Create canvas to convert image data
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      
      // Create ImageData object
      const imageData = ctx.createImageData(image.width, image.height);
      imageData.data.set(image.data);
      ctx.putImageData(imageData, 0, 0);
      
      // Convert to base64
      return canvas.toDataURL('image/png').split(',')[1];
    } catch (error) {
      console.warn('Failed to convert image to base64:', error);
      return null;
    }
  }

  /**
   * Analyze image with Gemini Vision API
   */
  async analyzeImageWithGemini(base64Image, pageNumber) {
    if (!this.geminiApiKey) return null;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${this.geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `Analyze this planning document image from page ${pageNumber}. Identify:
1. Type of drawing (site plan, floor plan, elevation, section, location plan, block plan, etc.)
2. Key measurements and dimensions visible
3. Building heights, stories, or levels shown
4. Site boundaries, access points, parking areas
5. Neighboring buildings or context
6. Any annotations, labels, or text visible
7. Scale information if present
8. Planning-relevant details like materials, landscaping, utilities

Provide a structured analysis suitable for planning assessment.`
              },
              {
                inline_data: {
                  mime_type: 'image/png',
                  data: base64Image
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024
          }
        })
      });

      const result = await response.json();
      
      if (result.candidates && result.candidates[0]) {
        return {
          description: result.candidates[0].content.parts[0].text,
          confidence: 0.8,
          model: 'gemini-2.0-flash-exp',
          timestamp: new Date().toISOString()
        };
      }
      
      return null;
    } catch (error) {
      console.error('Gemini image analysis failed:', error);
      return { error: error.message };
    }
  }

  /**
   * Extract addresses from text
   */
  extractAddresses(text) {
    // Heuristic multi-pass approach (line + token scoring) avoids over‑greedy regex
    const candidates = [];
    const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
    const roadTypes = ['road','street','lane','close','way','avenue','place','crescent','square','terrace','gardens','park','mews','court','row','hill','green','grove','rise','vale','view','walk','gate','field','end','side','yard','estate'];
    const roadTypeSet = new Set(roadTypes);
    const postcodeRegex = this.postcodeRegex; // reuse compiled
    const postcodeHits = [];
    let m; postcodeRegex.lastIndex = 0;
    while ((m = postcodeRegex.exec(text)) !== null) {
      postcodeHits.push({ value: m[0], index: m.index });
    }
    // Score each line
    lines.forEach((line, idx) => {
      if (line.length < 6 || line.length > 160) return;
      const lower = line.toLowerCase();
      const tokens = lower.split(/[,\s]+/).filter(Boolean);
      const hasNumber = /\d/.test(tokens[0] || '') || /^\d+/.test(lower);
      const hasRoad = tokens.some(t => roadTypeSet.has(t.replace(/[^a-z]/g,'')));
      const postcode = (line.match(postcodeRegex) || [])[0] || null;
      let score = 0;
      if (hasNumber) score += 0.3;
      if (hasRoad) score += 0.4;
      if (postcode) score += 0.4;
      // proximity to any postcode within 120 chars in full text
      if (!postcode) {
        const globalIdx = text.indexOf(line);
        if (globalIdx !== -1) {
          const nearPc = postcodeHits.find(pc => Math.abs(pc.index - globalIdx) < 120);
          if (nearPc) { score += 0.25; }
        }
      }
      if (score >= 0.45) {
        candidates.push({ address: line.replace(/\s+/g,' ').trim(), postcode: postcode || null, line: idx, confidence: Math.min(1, score) });
      }
    });
    // Merge adjacent lines that look like multi-line addresses
    const merged = [];
    for (let i=0;i<candidates.length;i++) {
      const cur = candidates[i];
      const next = candidates[i+1];
      if (next && next.line === cur.line + 1 && next.address.split(' ').length <= 6 && cur.address.split(' ').length <= 6) {
        merged.push({ address: cur.address + ', ' + next.address, postcode: cur.postcode || next.postcode, confidence: (cur.confidence+next.confidence)/2 });
        i++; continue;
      }
      merged.push(cur);
    }
    // Deduplicate by normalized string
    const dedup = [];
    const seen = new Set();
    for (const c of merged) {
      const norm = c.address.toLowerCase();
      if (seen.has(norm)) continue;
      seen.add(norm);
      dedup.push(c);
    }
    return dedup.sort((a,b)=>b.confidence-a.confidence).slice(0,25);
  }

  /** Plain text fallback builder for non-PDF uploads */
  buildPlainTextResult(text, { pseudo = false } = {}) {
    const t0 = Date.now();
    const res = {
      text,
      pages: [{ pageNumber:1, text, images:[], annotations:[], dimensions:{ width:0, height:0 } }],
      images: [],
      addresses: this.extractAddresses(text),
      metadata: { numPages: 1, title: null, pseudo },
      analysis: {},
      processingTime: 0
    };
    res.analysis = { documentType: 'plain_text', confidence: 0.3, keyFindings: [], planningElements: {}, requiresDetailedAnalysis: false };
    res.processingTime = Date.now() - t0;
    return res;
  }

  /** Attempt to decode arbitrary binary as UTF-8 text */
  decodeAsText(uint8) {
    try { return new TextDecoder('utf-8', { fatal:false }).decode(uint8); } catch { return ''; }
  }

  /**
   * Analyze document content and type
   */
  async analyzeDocument(result, options = {}) {
    const analysis = {
      documentType: 'unknown',
      confidence: 0,
      keyFindings: [],
      planningElements: {},
      requiresDetailedAnalysis: false
    };

    const text = result.text.toLowerCase();
    
    // Detect document type
    if (text.includes('design and access statement') || text.includes('design & access statement')) {
      analysis.documentType = 'design_and_access_statement';
      analysis.confidence = 0.9;
    } else if (text.includes('planning statement') || text.includes('planning application')) {
      analysis.documentType = 'planning_statement';
      analysis.confidence = 0.8;
    } else if (text.includes('heritage statement') || text.includes('heritage impact')) {
      analysis.documentType = 'heritage_statement';
      analysis.confidence = 0.8;
    } else if (text.includes('transport statement') || text.includes('transport assessment')) {
      analysis.documentType = 'transport_assessment';
      analysis.confidence = 0.8;
    } else if (text.includes('flood risk assessment') || text.includes('drainage strategy')) {
      analysis.documentType = 'flood_risk_assessment';
      analysis.confidence = 0.8;
    } else if (text.includes('ecological') || text.includes('biodiversity')) {
      analysis.documentType = 'ecological_assessment';
      analysis.confidence = 0.7;
    }

    // Extract key planning elements
    analysis.planningElements = {
      applicationReference: this.extractApplicationReference(text),
      applicantName: this.extractApplicantName(text),
      proposalDescription: this.extractProposalDescription(text),
      siteArea: this.extractSiteArea(text),
      buildingHeight: this.extractBuildingHeight(text),
      numberOfUnits: this.extractNumberOfUnits(text),
      parkingSpaces: this.extractParkingSpaces(text),
      floorArea: this.extractFloorArea(text)
    };

    // Use Gemini for detailed analysis if available
    if (this.geminiApiKey && options.detailedAnalysis !== false) {
      analysis.geminiAnalysis = await this.analyzeWithGemini(result.text, analysis.documentType);
    }

    return analysis;
  }

  /**
   * Analyze document with Gemini for detailed planning insights
   */
  async analyzeWithGemini(text, documentType) {
    if (!this.geminiApiKey) return null;

    const prompt = `Analyze this ${documentType} planning document. Extract and summarize:

1. Key planning considerations and policy references
2. Proposed development details (height, scale, use, materials)
3. Site constraints and opportunities mentioned
4. Design principles and architectural approach
5. Transport and accessibility provisions
6. Environmental considerations (heritage, ecology, flood risk)
7. Community benefits or planning obligations
8. Any objections or concerns anticipated
9. Compliance with local plan policies (extract policy references)
10. Material planning considerations for assessment

Document text: ${text.substring(0, 8000)}...`; // Limit to ~8k chars for token efficiency

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${this.geminiApiKey}`, {
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
            maxOutputTokens: 2048
          }
        })
      });

      const result = await response.json();
      
      if (result.candidates && result.candidates[0]) {
        return {
          analysis: result.candidates[0].content.parts[0].text,
          model: 'gemini-2.0-flash-exp',
          timestamp: new Date().toISOString(),
          tokenUsage: result.usageMetadata
        };
      }
      
      return null;
    } catch (error) {
      console.error('Gemini document analysis failed:', error);
      return { error: error.message };
    }
  }

  // Helper extraction methods
  extractApplicationReference(text) {
    const refMatch = text.match(/(?:application\s+(?:ref|reference|no|number)[:.]?\s*)([a-z0-9\/\-]{6,20})/i);
    return refMatch ? refMatch[1] : null;
  }

  extractApplicantName(text) {
    const applicantMatch = text.match(/applicant[:.]?\s*([^.\n]{10,50})/i);
    return applicantMatch ? applicantMatch[1].trim() : null;
  }

  extractProposalDescription(text) {
    const proposalMatch = text.match(/(?:proposal|description|development)[:.]?\s*([^.\n]{20,200})/i);
    return proposalMatch ? proposalMatch[1].trim() : null;
  }

  extractSiteArea(text) {
    const areaMatch = text.match(/site\s+area[:.]?\s*([0-9,.]+)\s*(hectares?|ha|m²|sqm|square\s+metres?)/i);
    return areaMatch ? { value: parseFloat(areaMatch[1].replace(',', '')), unit: areaMatch[2] } : null;
  }

  extractBuildingHeight(text) {
    const heightMatch = text.match(/(?:building\s+)?height[:.]?\s*([0-9.]+)\s*(m|metres?|storeys?|floors?)/i);
    return heightMatch ? { value: parseFloat(heightMatch[1]), unit: heightMatch[2] } : null;
  }

  extractNumberOfUnits(text) {
    const unitsMatch = text.match(/([0-9]+)\s*(?:residential\s+)?units?/i);
    return unitsMatch ? parseInt(unitsMatch[1]) : null;
  }

  extractParkingSpaces(text) {
    const parkingMatch = text.match(/([0-9]+)\s*(?:car\s+)?parking\s+spaces?/i);
    return parkingMatch ? parseInt(parkingMatch[1]) : null;
  }

  extractFloorArea(text) {
    const floorMatch = text.match(/(?:floor\s+area|gfa|gross\s+floor\s+area)[:.]?\s*([0-9,.]+)\s*(m²|sqm|square\s+metres?)/i);
    return floorMatch ? { value: parseFloat(floorMatch[1].replace(',', '')), unit: floorMatch[2] } : null;
  }

  /**
   * Enhanced chunking with semantic boundaries
   */
  chunk(text, chunkSize = 1000, overlap = 200) {
    const chunks = [];
    
    // Try to split on paragraph boundaries first
    const paragraphs = text.split(/\n\s*\n/);
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length <= chunkSize) {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        
        // If paragraph is too long, split it
        if (paragraph.length > chunkSize) {
          const subChunks = this.splitLongText(paragraph, chunkSize, overlap);
          chunks.push(...subChunks);
          currentChunk = '';
        } else {
          currentChunk = paragraph;
        }
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks.filter(chunk => chunk.length > 0);
  }

  splitLongText(text, chunkSize, overlap) {
    const chunks = [];
    let i = 0;
    const maxIterations = Math.ceil(text.length / Math.max(chunkSize - overlap, 1)) + 10; // safety cap
    let iterations = 0;
    
    while (i < text.length) {
      if (iterations++ > maxIterations) {
        console.warn('splitLongText aborted due to excessive iterations', { textLength: text.length, chunkSize, overlap });
        break;
      }
      const end = i + chunkSize;
      let chunk = text.substring(i, end);
      
      // Try to end at sentence boundary
      if (end < text.length) {
        const lastSentence = chunk.lastIndexOf('.');
        if (lastSentence > chunkSize * 0.7) {
          chunk = chunk.substring(0, lastSentence + 1);
        }
      }
      
      chunks.push(chunk.trim());
      const advance = chunk.length - overlap;
      i += advance > 0 ? advance : chunk.length || 1; // ensure progress
    }
    
    return chunks;
  }

  /**
   * Store processed document in database
   */
  async storeDocument(file, parsedData) {
    try {
      const documentId = await this.db.addDocument(file, {
        parsedContent: parsedData,
        addresses: parsedData.addresses,
        documentType: parsedData.analysis.documentType,
        planningElements: parsedData.analysis.planningElements
      });

      // Store images separately
      for (const image of parsedData.images) {
        await this.db.extractedImages.add({
          documentId,
          imageData: image.base64,
          analysis: image.analysis,
          type: image.type,
          page: image.page,
          confidence: image.analysis ? 0.8 : 0.5
        });
      }

      return documentId;
    } catch (error) {
      console.error('Failed to store document:', error);
      throw error;
    }
  }
}

export default Parser;
