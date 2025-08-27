/**
 * PolicyParser
 * Intelligent policy document parsing and extraction with proper PDF support
 */
export default class PolicyParser {
  constructor() {
    this.supportedFormats = ['pdf', 'docx', 'txt', 'html'];
    this.policyPatterns = {
      // More precise policy reference patterns
      policy: /(?:^|\n)\s*(?:Policy\s+)?([A-Z]+\d+(?:\.\d+)*)[:\.]?\s*[-–—]?\s*([^\n]+)/gm,
      section: /(?:^|\n)\s*(\d+(?:\.\d+)*)\s+([^\n]{10,100})\s*(?:\n|$)/gm,
      title: /^([A-Z][A-Z\s]{5,50})$/gm,
      objective: /(?:Objective|Aim|Purpose)[:\s]*([^\n]+)/gi,
      requirement: /(?:(?:must|shall|will|should|required|mandatory)[^.!?]*[.!?])/gi,
      // Planning-specific patterns
      planningPolicy: /(?:^|\n)\s*(?:Policy\s+)?([A-Z]{1,3}\d{1,3}(?:\.\d+)*)\s*[-–—]?\s*([^\n]+)/gm,
      developmentPolicy: /(?:development|applications?)\s+(?:must|shall|will|should)[^.!?]*[.!?]/gi
    };
    
    // Initialize PDF.js
    this.initializePdfJs();
  }

  /**
   * Initialize PDF.js for browser environment
   */
  async initializePdfJs() {
    try {
      // Check if we're in browser environment
      if (typeof window !== 'undefined') {
        // Dynamic import for PDF.js in browser environment
        const pdfjsLib = await import('pdfjs-dist');
        // Set worker source for browser
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        this.pdfjsLib = pdfjsLib;
        console.log('PDF.js initialized for browser');
      } else {
        // For Node.js environment, try to use pdfjs-dist directly
        try {
          const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');
          this.pdfjsLib = pdfjsLib;
          console.log('PDF.js initialized for Node.js');
        } catch (nodeError) {
          console.warn('PDF.js not available in Node.js environment:', nodeError.message);
          this.pdfjsLib = null;
        }
      }
    } catch (error) {
      console.warn('PDF.js initialization failed:', error.message);
      this.pdfjsLib = null;
    }
  }

  /**
   * Parse policy document from file buffer
   */
  async parseDocument(fileBuffer, fileName, mimeType) {
    try {
      console.log(`Parsing document: ${fileName} (${mimeType})`);
      
      const text = await this._extractText(fileBuffer, fileName, mimeType);
      
      if (!text || text.length < 100) {
        throw new Error('Document appears to be empty or too short');
      }

      console.log(`Extracted text length: ${text.length} characters`);

      const structure = await this._analyzeStructure(text, fileName);
      const policies = await this._extractPolicies(structure, text);
      
      // Validate and score policies
      const validatedPolicies = policies.map(policy => ({
        ...policy,
        confidence: this._calculatePolicyConfidence(policy),
        quality: this._assessPolicyQuality(policy)
      })).filter(policy => policy.confidence > 0.3); // Filter out low-confidence policies

      console.log(`Extracted ${validatedPolicies.length} policies`);

      return {
        fileName,
        mimeType,
        extractedAt: new Date().toISOString(),
        structure,
        policies: validatedPolicies,
        metadata: {
          totalPolicies: validatedPolicies.length,
          categories: [...new Set(validatedPolicies.map(p => p.category))],
          wordCount: text.split(/\s+/).length,
          textLength: text.length,
          averageConfidence: validatedPolicies.length > 0 ? 
            validatedPolicies.reduce((sum, p) => sum + p.confidence, 0) / validatedPolicies.length : 0
        }
      };
    } catch (error) {
      console.error('Policy parsing failed:', error);
      throw new Error(`Failed to parse ${fileName}: ${error.message}`);
    }
  }

  /**
   * Extract text from various file formats with proper PDF support
   */
  async _extractText(fileBuffer, fileName, mimeType) {
    const fileExtension = fileName.toLowerCase().split('.').pop();
    
    try {
      // PDF parsing
      if (mimeType === 'application/pdf' || fileExtension === 'pdf') {
        return await this._extractPdfText(fileBuffer);
      }
      
      // Plain text
      if (mimeType === 'text/plain' || fileExtension === 'txt') {
        const text = new TextDecoder('utf-8').decode(fileBuffer);
        return this._cleanText(text);
      }
      
      // HTML
      if (mimeType === 'text/html' || fileExtension === 'html') {
        const html = new TextDecoder('utf-8').decode(fileBuffer);
        return this._extractTextFromHtml(html);
      }
      
      // Word documents (basic text extraction)
      if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
          fileExtension === 'docx') {
        console.warn('Word document parsing not fully implemented, attempting basic extraction');
        const text = new TextDecoder('utf-8').decode(fileBuffer);
        return this._cleanText(text);
      }
      
      // Fallback: attempt text extraction
      console.warn(`Unknown file type ${mimeType}, attempting text extraction`);
      const text = new TextDecoder('utf-8').decode(fileBuffer);
      return this._cleanText(text);
      
    } catch (error) {
      console.error('Text extraction failed:', error);
      throw new Error(`Failed to extract text from ${fileName}: ${error.message}`);
    }
  }

  /**
   * Extract text from PDF using PDF.js
   */
  async _extractPdfText(fileBuffer) {
    if (!this.pdfjsLib) {
      throw new Error('PDF parsing not available - PDF.js not initialized. Please ensure PDF.js is loaded.');
    }

    try {
      console.log('Starting PDF text extraction...');
      
      const uint8Array = new Uint8Array(fileBuffer);
      const loadingTask = this.pdfjsLib.getDocument({ data: uint8Array });
      const pdf = await loadingTask.promise;
      
      console.log(`PDF loaded: ${pdf.numPages} pages`);
      
      let fullText = '';
      
      // Extract text from each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // Combine text items with proper spacing and positioning
          let pageText = '';
          let lastY = null;
          
          textContent.items.forEach(item => {
            // Add line breaks based on Y position changes
            if (lastY !== null && Math.abs(lastY - item.transform[5]) > 5) {
              pageText += '\n';
            }
            
            pageText += item.str + ' ';
            lastY = item.transform[5];
          });
          
          fullText += pageText.trim() + '\n\n';
          console.log(`Extracted text from page ${pageNum}: ${pageText.length} characters`);
          
        } catch (pageError) {
          console.warn(`Failed to extract text from page ${pageNum}:`, pageError.message);
        }
      }
      
      console.log(`Total extracted text: ${fullText.length} characters`);
      return this._cleanText(fullText);
      
    } catch (error) {
      console.error('PDF text extraction failed:', error);
      throw new Error(`PDF parsing failed: ${error.message}`);
    }
  }

  /**
   * Clean and normalize extracted text
   */
    /**
   * Extract text from HTML content
   */
  _extractTextFromHtml(html) {
    // Basic HTML stripping - preserves line structure
    let text = html
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(p|div|h[1-6]|li)[^>]*>/gi, '\n')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"');
    
    return this._cleanText(text);
  }

  /**
   * Clean and normalize text
   */
  _cleanText(text) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\u00A0/g, ' ') // Replace non-breaking spaces
      .replace(/[\u2000-\u200B]/g, ' ') // Replace various unicode spaces
      .trim();
  }

  /**
   * Analyze document structure to identify sections and content blocks
   */
  async _analyzeStructure(text, fileName) {
    const lines = text.split('
').map(line => line.trim()).filter(Boolean);
    
    const structure = {
      title: fileName.replace(/\.[^.]+$/, ''),
      sections: [],
      chapters: [],
      policies: [],
      totalLines: lines.length,
      text: text // Keep reference to full text
    };

    // Detect document title from first substantial line
    if (lines.length > 0) {
      const firstLine = lines[0];
      if (firstLine.length > 10 && firstLine.length < 100) {
        structure.title = firstLine;
      }
    }

    // Find section headers and structure
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for numbered sections (e.g., "1.1 Introduction")
      const sectionMatch = line.match(this.policyPatterns.section);
      if (sectionMatch) {
        structure.sections.push({
          number: sectionMatch[1],
          title: sectionMatch[2],
          lineNumber: i + 1
        });
      }
      
      // Check for title-style headers (ALL CAPS or Title Case)
      if (this.policyPatterns.title.test(line)) {
        structure.chapters.push({
          title: line,
          lineNumber: i + 1
        });
      }
    }

    return structure;
  }

  /**
   * Extract policies from analyzed structure with improved detection
   */
  async _extractPolicies(structure, text) {
    const policies = [];
    
    // Multiple pattern matching for better coverage
    const policyMatches = [
      ...Array.from(text.matchAll(this.policyPatterns.policy)),
      ...Array.from(text.matchAll(this.policyPatterns.planningPolicy))
    ];
    
    // Process policy matches with overlap detection
    const processedPositions = new Set();
    
    for (const match of policyMatches) {
      const [fullMatch, policyId, description] = match;
      const position = match.index;
      
      // Skip if we've already processed a policy at this position
      if (processedPositions.has(position)) continue;
      
      if (policyId && description && description.length >= 10) {
        const content = this._extractPolicyContent(text, position, policyId);
        
        if (content && content.length >= 50) { // Lowered minimum for better detection
          const policy = {
            id: policyId.trim(),
            title: description.trim(),
            content: content,
            category: this._categorizePolicy(description, content),
            requirements: this._extractRequirements(content),
            references: this._extractReferences(content),
            objectives: this._extractObjectives(content),
            position: position,
            length: content.length
          };
          
          policies.push(policy);
          processedPositions.add(position);
        }
      }
    }
    
    // Sort by position in document
    return policies.sort((a, b) => a.position - b.position).slice(0, 100);
  }

  /**
   * Extract policy content following a policy header with improved logic
   */
  _extractPolicyContent(text, startIndex, policyId) {
    const afterPolicy = text.substring(startIndex);
    const lines = afterPolicy.split('
');
    
    let content = '';
    let contentLines = 0;
    
    for (let i = 1; i < lines.length && contentLines < 50; i++) {
      const line = lines[i].trim();
      
      // Stop at next policy
      if (line.match(/^(?:Policy\s+)?[A-Z]{1,3}\d+(?:\.\d+)*[:\.]?\s*[-–—]?/)) {
        // But don't stop if it's just a reference within content
        if (content.length < 100) break;
        if (line.toLowerCase().includes('policy') && !line.match(/[.!?]$/)) break;
      }
      
      // Stop at major section headers
      if (line.match(/^\d+\.\s*[A-Z][A-Z\s]{5,}$/) && content.length > 100) break;
      
      // Stop at chapter-like headers
      if (line.match(/^[A-Z][A-Z\s]{10,}$/) && content.length > 100) break;
      
      // Include meaningful content
      if (line.length >= 3) {
        content += line + '
';
        contentLines++;
      } else if (content.length > 0) {
        content += '
'; // Preserve paragraph breaks
      }
      
      // Stop if we have substantial content and reach a natural break
      if (content.length > 200 && line.match(/[.!]$/) && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine.length === 0 || nextLine.match(/^[A-Z]/) || nextLine.match(/^\d+\./)) {
          break;
        }
      }
    }
    
    return content.trim();
  }

  /**
   * Enhanced policy categorization with planning-specific categories
   */
  _categorizePolicy(title, content) {
    const text = (title + ' ' + content).toLowerCase();
    
    // Planning-specific categories with better pattern matching
    const categories = {
      'Housing': /housing|residential|homes?|dwellings?|affordable|tenure|density/,
      'Transport': /transport|traffic|parking|highway|road|cycling|walking|accessibility|mobility/,
      'Environment': /environment|green|ecology|biodiversity|tree|landscape|open space|recreation/,
      'Economy': /employment|business|economic|commercial|retail|industrial|office|jobs/,
      'Heritage': /heritage|historic|conservation|character|listed|archaeology|cultural/,
      'Design': /design|appearance|visual|aesthetic|height|scale|materials|architectural/,
      'Infrastructure': /infrastructure|utilities|services|facilities|capacity|provision/,
      'Community': /community|social|health|education|schools?|hospitals?|services/,
      'Flood Risk': /flood|drainage|water|sewage|sustainable drainage|suds|surface water/,
      'Climate': /renewable|energy|climate|carbon|sustainability|emissions|solar|wind/,
      'Development Management': /applications?|development|proposals?|permission|consent|approve/,
      'Site Allocation': /allocated|site|development area|strategic|location/
    };
    
    for (const [category, pattern] of Object.entries(categories)) {
      if (pattern.test(text)) return category;
    }
    
    return 'General';
  }

  /**
   * Extract requirements from policy content with better patterns
   */
  _extractRequirements(content) {
    const requirements = [];
    
    // Enhanced requirement patterns
    const patterns = [
      /(?:must|shall|will|should|required|mandatory|need to|have to)[^.!?]{10,150}[.!?]/gi,
      /applications?\s+(?:must|shall|will|should)[^.!?]{10,150}[.!?]/gi,
      /development\s+(?:must|shall|will|should)[^.!?]{10,150}[.!?]/gi
    ];
    
    for (const pattern of patterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const requirement = match[0].trim();
        if (requirement.length > 20) {
          requirements.push(requirement);
        }
      }
    }
    
    return [...new Set(requirements)].slice(0, 15); // Remove duplicates, limit count
  }

  /**
   * Extract policy objectives and purposes
   */
  _extractObjectives(content) {
    const objectives = [];
    const matches = content.matchAll(this.policyPatterns.objective);
    
    for (const match of matches) {
      const objective = match[1].trim();
      if (objective.length > 10) {
        objectives.push(objective);
      }
    }
    
    return objectives.slice(0, 10);
  }

  /**
   * Extract policy references with improved detection
   */
  _extractReferences(content) {
    const references = [];
    
    // Multiple reference patterns
    const patterns = [
      /Policy\s+([A-Z]{1,3}\d+(?:\.\d+)*)/g,
      /([A-Z]{1,3}\d+(?:\.\d+)*)/g // Standalone policy IDs
    ];
    
    for (const pattern of patterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const ref = match[1] || match[0];
        if (ref.match(/^[A-Z]{1,3}\d+/)) {
          references.push(ref.replace('Policy ', ''));
        }
      }
    }
    
    return [...new Set(references)]; // Remove duplicates
  }

  /**
   * Calculate confidence score for policy detection
   */
  _calculatePolicyConfidence(policy) {
    let confidence = 0.5; // Base confidence
    
    // Policy ID format confidence
    if (policy.id.match(/^[A-Z]{1,3}\d{1,3}$/)) confidence += 0.2;
    if (policy.id.match(/^[A-Z]{1,3}\d{1,3}\.\d+$/)) confidence += 0.1;
    
    // Content quality indicators
    if (policy.content.length > 200) confidence += 0.1;
    if (policy.content.length > 500) confidence += 0.1;
    if (policy.requirements.length > 0) confidence += 0.1;
    if (policy.objectives.length > 0) confidence += 0.05;
    
    // Title quality
    if (policy.title.length > 20 && policy.title.length < 100) confidence += 0.1;
    
    // Planning terminology
    const planningTerms = /development|planning|policy|application|proposal|permission/i;
    if (planningTerms.test(policy.content)) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Assess overall policy quality
   */
  _assessPolicyQuality(policy) {
    const checks = {
      hasId: !!policy.id,
      hasTitle: policy.title && policy.title.length > 10,
      hasContent: policy.content && policy.content.length > 100,
      hasRequirements: policy.requirements && policy.requirements.length > 0,
      hasCategory: policy.category !== 'General',
      goodLength: policy.content && policy.content.length >= 200 && policy.content.length <= 2000
    };
    
    const score = Object.values(checks).filter(Boolean).length / Object.keys(checks).length;
    
    if (score >= 0.8) return 'High';
    if (score >= 0.6) return 'Medium';
    return 'Low';
  }

  /**
   * Validate parsed policies for quality and completeness
   */
  validatePolicies(policies) {
    return policies.map(policy => ({
      ...policy,
      validation: {
        hasRequiredFields: !!(policy.id && policy.title && policy.content),
        contentLength: policy.content ? policy.content.length : 0,
        hasRequirements: policy.requirements && policy.requirements.length > 0,
        confidence: this._calculatePolicyConfidence(policy),
        quality: this._assessPolicyQuality(policy)
      }
    }));
  }
}

  /**
   * Analyze document structure
   */
  async _analyzeStructure(text, fileName) {
    const structure = {
      title: this._extractDocumentTitle(text, fileName),
      sections: [],
      toc: [],
      metadata: {}
    };

    // Extract sections based on common patterns
    const sections = this._extractSections(text);
    structure.sections = sections;

    // Generate table of contents
    structure.toc = sections.map((section, index) => ({
      index,
      title: section.title,
      reference: section.reference,
      level: section.level,
      startPosition: section.startPosition
    }));

    return structure;
  }

  /**
   * Extract document title
   */
  _extractDocumentTitle(text, fileName) {
    const lines = text.split('\n').slice(0, 10);
    
    // Look for title-like patterns
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 10 && trimmed.length < 100) {
        // Check if it's likely a title (all caps, title case, etc.)
        if (/^[A-Z\s]+$/.test(trimmed) || /^[A-Z][a-z\s]+Plan$/i.test(trimmed)) {
          return trimmed;
        }
      }
    }

    // Fallback to filename
    return fileName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
  }

  /**
   * Extract sections from document
   */
  _extractSections(text) {
    const sections = [];
    const lines = text.split('\n');
    let currentSection = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for section headers
      const sectionHeader = this._identifySection(line, i);
      if (sectionHeader) {
        // Save previous section
        if (currentSection) {
          sections.push(currentSection);
        }

        // Start new section
        currentSection = {
          ...sectionHeader,
          startPosition: i,
          content: [],
          policies: []
        };
      } else if (currentSection) {
        currentSection.content.push(line);
      }
    }

    // Add final section
    if (currentSection) {
      sections.push(currentSection);
    }

    // Process section content
    sections.forEach(section => {
      section.content = section.content.join('\n').trim();
      section.wordCount = section.content.split(/\s+/).length;
    });

    return sections;
  }

  /**
   * Identify if a line is a section header
   */
  _identifySection(line, lineIndex) {
    // Skip very short or very long lines
    if (line.length < 5 || line.length > 100) return null;
    
    // Pattern 1: Numbered sections (e.g., "1. Introduction", "2.1 Housing")
    // Must start at beginning of line and have reasonable title
    const numberedMatch = line.match(/^(\d+(?:\.\d+){0,2})\s+([A-Z][A-Za-z\s]{4,60})$/);
    if (numberedMatch) {
      return {
        reference: numberedMatch[1],
        title: numberedMatch[2].trim(),
        level: (numberedMatch[1].match(/\./g) || []).length + 1,
        type: 'numbered'
      };
    }

    // Pattern 2: Lettered sections (e.g., "A. Strategic Policies")
    const letteredMatch = line.match(/^([A-Z])\.\s+([A-Z][A-Za-z\s]{4,60})$/);
    if (letteredMatch) {
      return {
        reference: letteredMatch[1],
        title: letteredMatch[2].trim(),
        level: 1,
        type: 'lettered'
      };
    }

    // Pattern 3: All caps titles (but only if they look like proper section headers)
    if (/^[A-Z][A-Z\s]{4,40}$/.test(line.trim()) && 
        !line.includes('POLICY') && 
        line.split(' ').length >= 2 && 
        line.split(' ').length <= 8) {
      return {
        reference: `SECTION_${lineIndex}`,
        title: line.trim(),
        level: 1,
        type: 'title'
      };
    }

    return null;
  }

  /**
   * Extract policies from structured content
   */
  async _extractPolicies(structure) {
    const policies = [];

    for (const section of structure.sections) {
      const sectionPolicies = this._extractPoliciesFromSection(section);
      policies.push(...sectionPolicies);
    }

    return policies;
  }

  /**
   * Extract policies from a single section
   */
  _extractPoliciesFromSection(section) {
    const policies = [];
    const content = section.content;
    
    if (!content || content.length < 50) return policies;

    // Look for explicit policy statements using more specific patterns
    const explicitMatches = [...content.matchAll(this.policyPatterns.explicitPolicy)];
    
    for (const match of explicitMatches) {
      const [fullMatch, reference, title] = match;
      const startIndex = match.index;
      
      // Extract policy content more carefully
      const policyContent = this._extractPolicyContent(content, startIndex, fullMatch.length);
      
      if (this._validatePolicyContent(policyContent, reference)) {
        policies.push({
          reference: reference.trim(),
          title: title?.trim() || `Policy ${reference}`,
          content: policyContent,
          section: section.reference,
          sectionTitle: section.title,
          category: this._categorizePolicy(title + ' ' + policyContent),
          requirements: this._extractRequirements(policyContent),
          crossReferences: this._extractCrossReferences(policyContent),
          extractedAt: new Date().toISOString(),
          confidence: this._calculateConfidence(policyContent, reference)
        });
      }
    }

    // If no explicit policies found, try the broader pattern but with validation
    if (policies.length === 0) {
      const broadMatches = [...content.matchAll(this.policyPatterns.policy)];
      
      for (const match of broadMatches) {
        const [fullMatch, reference, title] = match;
        const startIndex = match.index;
        
        const policyContent = this._extractPolicyContent(content, startIndex, fullMatch.length);
        
        if (this._validatePolicyContent(policyContent, reference) && 
            this._calculateConfidence(policyContent, reference) > 0.6) {
          policies.push({
            reference: reference.trim(),
            title: title?.trim() || `Policy ${reference}`,
            content: policyContent,
            section: section.reference,
            sectionTitle: section.title,
            category: this._categorizePolicy(title + ' ' + policyContent),
            requirements: this._extractRequirements(policyContent),
            crossReferences: this._extractCrossReferences(policyContent),
            extractedAt: new Date().toISOString(),
            confidence: this._calculateConfidence(policyContent, reference)
          });
        }
      }
    }

    return policies;
  }

  /**
   * Extract policy content following a policy header
   */
  _extractPolicyContent(text, startIndex, headerLength) {
    const remainingText = text.substring(startIndex + headerLength);
    const lines = remainingText.split('\n');
    const contentLines = [];
    let foundContent = false;

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines at the start
      if (!foundContent && trimmed.length === 0) continue;
      
      // Stop at next explicit policy
      if (this.policyPatterns.explicitPolicy.test(trimmed) && contentLines.length > 0) {
        break;
      }
      
      // Stop at another numbered policy reference  
      if (trimmed.match(/^Policy\s+[A-Z]{1,3}\d+/) && contentLines.length > 0) {
        break;
      }
      
      // Stop at section headers
      if (trimmed.match(/^\d+\.\s+[A-Z]/) && contentLines.length > 0) {
        break;
      }
      
      if (trimmed.length > 0) {
        contentLines.push(trimmed);
        foundContent = true;
      } else if (foundContent) {
        // Allow some empty lines within content, but stop at multiple empty lines
        if (contentLines.length > 0 && 
            lines.slice(lines.indexOf(line), lines.indexOf(line) + 3)
                 .every(l => l.trim().length === 0)) {
          break;
        }
        contentLines.push(''); // Preserve paragraph breaks
      }
      
      // Stop if we have substantial content
      const currentContent = contentLines.join(' ').trim();
      if (currentContent.length > this.maxPolicyLength) {
        break;
      }
    }

    return contentLines.join(' ').trim().replace(/\s+/g, ' ');
  }

  /**
   * Extract implicit policy from section without explicit policy markers
   */
  _extractImplicitPolicy(section) {
    if (section.content.length < 100) return null;

    // Check if section contains policy-like language
    const policyIndicators = [
      'development will',
      'proposals should',
      'applications must',
      'permission will be',
      'will be supported',
      'will be refused'
    ];

    const hasIndicators = policyIndicators.some(indicator => 
      section.content.toLowerCase().includes(indicator)
    );

    if (hasIndicators) {
      return {
        reference: section.reference || `IMPLICIT_${Date.now()}`,
        title: section.title,
        content: section.content,
        section: section.reference,
        sectionTitle: section.title,
        category: this._categorizePolicy(section.title + ' ' + section.content),
        requirements: this._extractRequirements(section.content),
        crossReferences: this._extractCrossReferences(section.content),
        isImplicit: true,
        extractedAt: new Date().toISOString()
      };
    }

    return null;
  }

  /**
   * Categorize policy based on content
   */
  _categorizePolicy(text) {
    const lowerText = text.toLowerCase();
    
    const categories = {
      housing: ['housing', 'residential', 'dwelling', 'affordable', 'homes'],
      employment: ['employment', 'office', 'industrial', 'business', 'economic'],
      retail: ['retail', 'shopping', 'commercial', 'town centre', 'high street'],
      transport: ['transport', 'traffic', 'parking', 'highway', 'accessibility'],
      environment: ['environment', 'green', 'sustainable', 'climate', 'biodiversity'],
      heritage: ['heritage', 'historic', 'conservation', 'listed', 'character'],
      design: ['design', 'layout', 'scale', 'massing', 'appearance'],
      infrastructure: ['infrastructure', 'utilities', 'drainage', 'flood', 'water'],
      community: ['community', 'social', 'education', 'health', 'recreation']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return category;
      }
    }

    return 'general';
  }

  /**
   * Extract requirements from policy text
   */
  _extractRequirements(text) {
    const requirements = [];
    
    // More specific requirement pattern
    const requirementPattern = /\b(must|shall|will|should|required|mandatory)\s+[^.!?]{10,200}[.!?]/gi;
    const matches = [...text.matchAll(requirementPattern)];
    
    for (const match of matches) {
      const requirement = match[0].trim();
      
      // Additional validation
      if (requirement.length > 15 && 
          requirement.length < 300 && 
          !requirement.toLowerCase().includes('example') &&
          !requirement.toLowerCase().includes('note:')) {
        
        requirements.push({
          text: requirement,
          type: this._classifyRequirement(requirement),
          mandatory: /\b(must|shall|required|mandatory)\b/i.test(requirement),
          confidence: this._calculateRequirementConfidence(requirement)
        });
      }
    }

    // Remove duplicates and sort by confidence
    const uniqueReqs = requirements.filter((req, index, arr) => 
      arr.findIndex(r => r.text === req.text) === index
    );

    return uniqueReqs
      .filter(req => req.confidence > 0.5)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10); // Limit to top 10 requirements
  }

  /**
   * Calculate confidence for a requirement
   */
  _calculateRequirementConfidence(text) {
    let confidence = 0.5;
    
    // Boost for strong mandatory language
    if (/\b(must|shall|mandatory)\b/i.test(text)) confidence += 0.2;
    if (/\b(will|should|required)\b/i.test(text)) confidence += 0.1;
    
    // Boost for planning-specific terms
    const planningTerms = ['development', 'planning', 'application', 'proposal', 'design', 'layout'];
    const termMatches = planningTerms.filter(term => text.toLowerCase().includes(term)).length;
    confidence += Math.min(termMatches * 0.05, 0.15);
    
    // Penalize if too short or contains meta-language
    if (text.length < 20) confidence -= 0.2;
    if (/\b(example|note|see|refer)\b/i.test(text)) confidence -= 0.1;
    
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Classify requirement type
   */
  _classifyRequirement(text) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('design') || lowerText.includes('layout')) return 'design';
    if (lowerText.includes('size') || lowerText.includes('scale')) return 'scale';
    if (lowerText.includes('access') || lowerText.includes('parking')) return 'access';
    if (lowerText.includes('landscape') || lowerText.includes('green')) return 'landscape';
    if (lowerText.includes('heritage') || lowerText.includes('conservation')) return 'heritage';
    
    return 'general';
  }

  /**
   * Extract cross-references to other policies
   */
  _extractCrossReferences(text) {
    const references = new Set();
    
    // Pattern 1: Policy references (e.g., "Policy H1", "H1", etc.)
    const policyRefs = [...text.matchAll(/(?:Policy\s+)?([A-Z]{1,3}\d+(?:\.\d+)*)\b/gi)];
    policyRefs.forEach(match => {
      const ref = match[1].trim();
      // Only add if it looks like a real policy reference
      if (ref.length >= 2 && ref.length <= 8) {
        references.add(ref);
      }
    });
    
    // Pattern 2: Section references (e.g., "Section 2.1", "paragraph 3.4")
    const sectionRefs = [...text.matchAll(/(?:Section|paragraph)\s+(\d+(?:\.\d+){0,2})/gi)];
    sectionRefs.forEach(match => references.add(match[1]));

    return Array.from(references);
  }

  /**
   * Validate policy content quality
   */
  _validatePolicyContent(content, reference) {
    if (!content || typeof content !== 'string') return false;
    
    // Check length constraints
    if (content.length < this.minPolicyLength || content.length > this.maxPolicyLength) {
      return false;
    }
    
    // Must contain policy-like language
    const policyKeywords = [
      'development', 'proposal', 'application', 'permission', 'planning',
      'will be', 'should be', 'must be', 'shall be', 'required', 'permitted'
    ];
    
    const hasKeywords = policyKeywords.some(keyword => 
      content.toLowerCase().includes(keyword)
    );
    
    if (!hasKeywords) return false;
    
    // Check for reasonable sentence structure
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length < 2) return false;
    
    // Reference should be reasonable
    if (!reference || reference.length < 1 || reference.length > 10) return false;
    
    return true;
  }

  /**
   * Calculate confidence score for extracted policy
   */
  _calculateConfidence(content, reference) {
    let confidence = 0.5; // Base confidence
    
    // Boost for explicit policy markers
    if (content.toLowerCase().includes('policy')) confidence += 0.2;
    if (reference.match(/^[A-Z]{1,3}\d+$/)) confidence += 0.1;
    
    // Boost for policy language
    const policyTerms = ['development', 'planning', 'proposal', 'application'];
    const termCount = policyTerms.filter(term => 
      content.toLowerCase().includes(term)
    ).length;
    confidence += Math.min(termCount * 0.05, 0.2);
    
    // Boost for requirements
    const requirementTerms = ['must', 'shall', 'will', 'should', 'required'];
    const reqCount = requirementTerms.filter(term => 
      content.toLowerCase().includes(term)
    ).length;
    confidence += Math.min(reqCount * 0.03, 0.15);
    
    // Penalize very short or very long content
    if (content.length < 200) confidence -= 0.1;
    if (content.length > 3000) confidence -= 0.1;
    
    // Boost for good structure (multiple sentences)
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length >= 3) confidence += 0.1;
    
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Validate parsed policies
   */
  validatePolicies(policies) {
    const validation = {
      valid: [],
      invalid: [],
      warnings: []
    };

    const seenReferences = new Set();

    policies.forEach((policy, index) => {
      const issues = [];

      // Check for required fields
      if (!policy.reference) {
        issues.push('Missing policy reference');
      } else {
        // Check for valid reference format
        if (!policy.reference.match(/^[A-Z]{1,3}\d+(?:\.\d+)*$/)) {
          issues.push('Invalid policy reference format');
        }
        
        // Check for duplicates
        if (seenReferences.has(policy.reference)) {
          issues.push('Duplicate policy reference');
        } else {
          seenReferences.add(policy.reference);
        }
      }

      if (!policy.title) {
        issues.push('Missing policy title');
      } else if (policy.title.length < 5) {
        issues.push('Policy title too short');
      }

      if (!policy.content || policy.content.length < this.minPolicyLength) {
        issues.push(`Content too short (minimum ${this.minPolicyLength} characters)`);
      } else if (policy.content.length > this.maxPolicyLength) {
        issues.push(`Content too long (maximum ${this.maxPolicyLength} characters)`);
      }

      // Check confidence score
      if (policy.confidence && policy.confidence < 0.5) {
        issues.push('Low confidence score - may not be a real policy');
      }

      if (issues.length === 0) {
        validation.valid.push(policy);
      } else {
        validation.invalid.push({ policy, issues });
      }

      // Add warnings for potential issues
      if (policy.content && policy.content.length > 2000) {
        validation.warnings.push({ policy, warning: 'Policy content is very long' });
      }
      
      if (!policy.requirements || policy.requirements.length === 0) {
        validation.warnings.push({ policy, warning: 'No requirements detected' });
      }

      if (policy.confidence && policy.confidence < 0.7) {
        validation.warnings.push({ policy, warning: 'Medium confidence - please review' });
      }
    });

    return validation;
  }

  /**
   * Generate parsing summary
   */
  generateSummary(parseResult) {
    const { structure, policies, metadata } = parseResult;
    
    return {
      document: {
        title: structure.title,
        sections: structure.sections.length,
        wordCount: metadata.wordCount
      },
      policies: {
        total: policies.length,
        categories: metadata.categories,
        byCategory: metadata.categories.reduce((acc, cat) => {
          acc[cat] = policies.filter(p => p.category === cat).length;
          return acc;
        }, {}),
        withRequirements: policies.filter(p => p.requirements.length > 0).length,
        withCrossRefs: policies.filter(p => p.crossReferences.length > 0).length,
        averageConfidence: policies.length > 0 
          ? (policies.reduce((sum, p) => sum + (p.confidence || 0), 0) / policies.length).toFixed(2)
          : 0
      },
      quality: {
        averageContentLength: Math.round(
          policies.reduce((sum, p) => sum + p.content.length, 0) / (policies.length || 1)
        ),
        referenceCoverage: policies.length > 0 
          ? policies.filter(p => p.crossReferences.length > 0).length / policies.length 
          : 0,
        requirementCoverage: policies.length > 0 
          ? policies.filter(p => p.requirements.length > 0).length / policies.length 
          : 0,
        highConfidence: policies.filter(p => (p.confidence || 0) > 0.7).length
      }
    };
  }

  /**
   * Create a sample policy document for testing
   */
  static createSampleDocument() {
    return `Cambridge Local Plan 2018

1. INTRODUCTION

This Local Plan sets out the planning framework for Cambridge for the period 2011-2031.

2. HOUSING POLICIES

Policy H1: Housing Development
New housing development will be supported where it contributes to meeting identified housing needs. Development must be well-designed and respect the character of the surrounding area. All proposals shall provide appropriate parking and access arrangements.

Policy H2: Affordable Housing
Development of 10 or more dwellings will be required to provide 40% affordable housing on-site. The affordable housing must be pepper-potted throughout the development and shall remain affordable in perpetuity.

3. EMPLOYMENT POLICIES

Policy E1: Employment Development
New employment development will be supported in designated employment areas. Proposals must demonstrate that they will not result in unacceptable impacts on residential amenity or highway safety.

4. TRANSPORT POLICIES

Policy T1: Sustainable Transport
All development proposals should promote sustainable transport choices. Development that generates significant traffic must provide a Transport Assessment and Travel Plan as required by Policy T2.

Policy T2: Transport Assessments
Development proposals that are likely to generate significant traffic movements must be supported by a Transport Assessment. The assessment shall demonstrate that the development will not result in severe impacts on the highway network.

5. ENVIRONMENT POLICIES

Policy EN1: Green Belt
Development in the Green Belt will only be permitted in very special circumstances. Inappropriate development in the Green Belt will be refused unless very special circumstances clearly outweigh the harm to the Green Belt.`;
  }
}
