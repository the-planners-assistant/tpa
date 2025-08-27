/**
 * PolicyParser
 * Intelligent policy document parsing and extraction
 */
export default class PolicyParser {
  constructor() {
    this.supportedFormats = ['pdf', 'docx', 'txt', 'html'];
    this.policyPatterns = {
      // Common policy reference patterns
      policy: /(?:Policy\s+)?([A-Z]+\d+(?:\.\d+)*)[:\.]?\s*([^\n]+)/gi,
      section: /(?:^|\n)\s*(\d+(?:\.\d+)*)\s+([^\n]+)/gm,
      title: /^([A-Z\s]+)$/gm,
      objective: /(?:Objective|Aim|Purpose)[:\s]*([^\n]+)/gi,
      requirement: /(?:must|shall|will|should|required|mandatory)[^.!?]*[.!?]/gi
    };
  }

  /**
   * Parse policy document from file buffer
   */
  async parseDocument(fileBuffer, fileName, mimeType) {
    try {
      const text = await this._extractText(fileBuffer, mimeType, fileName);
      const structure = await this._analyzeStructure(text, fileName);
      const policies = await this._extractPolicies(structure);
      
      return {
        fileName,
        mimeType,
        extractedAt: new Date().toISOString(),
        structure,
        policies,
        metadata: {
          totalPolicies: policies.length,
          categories: [...new Set(policies.map(p => p.category))],
          wordCount: text.split(/\s+/).length
        }
      };
    } catch (error) {
      console.error('Policy parsing failed:', error);
      throw new Error(`Failed to parse ${fileName}: ${error.message}`);
    }
  }

  /**
   * Extract text from various file formats
   */
  async _extractText(fileBuffer, mimeType, fileName) {
    const fileExtension = fileName.split('.').pop().toLowerCase();
    
    try {
      // Handle PDF files
      if (mimeType === 'application/pdf' || fileExtension === 'pdf') {
        return await this._extractTextFromPDF(fileBuffer);
      }
      
      // Handle Word documents
      if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileExtension === 'docx') {
        return await this._extractTextFromWord(fileBuffer);
      }
      
      // Handle HTML files
      if (mimeType === 'text/html' || fileExtension === 'html') {
        const text = new TextDecoder().decode(fileBuffer);
        return this._stripHTML(text);
      }
      
      // Handle plain text files
      if (mimeType === 'text/plain' || fileExtension === 'txt') {
        const text = new TextDecoder().decode(fileBuffer);
        return this._cleanText(text);
      }
      
      // Fallback: try to decode as text
      const text = new TextDecoder().decode(fileBuffer);
      return this._cleanText(text);
      
    } catch (error) {
      console.error(`Text extraction failed for ${fileName}:`, error);
      throw new Error(`Could not extract text from ${fileName}. Please ensure the file is not corrupted and is in a supported format.`);
    }
  }

  /**
   * Extract text from PDF using PDF.js
   */
  async _extractTextFromPDF(fileBuffer) {
    try {
      // Dynamic import of PDF.js to avoid bundling issues
      const pdfjsLib = await import('pdfjs-dist/build/pdf.min.mjs');
      
      // Configure PDF.js worker
      if (typeof window !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      }
      
      const uint8Array = new Uint8Array(fileBuffer);
      const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      
      // Extract text from each page
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Combine text items from the page
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ');
        
        fullText += pageText + '\n\n';
      }
      
      return this._cleanText(fullText);
      
    } catch (error) {
      console.error('PDF text extraction failed:', error);
      throw new Error(`PDF parsing failed: ${error.message}. The PDF may be corrupted, password-protected, or contain only images.`);
    }
  }

  /**
   * Extract text from Word documents
   * Note: This is a placeholder - for full Word support, you'd need mammoth.js or similar
   */
  async _extractTextFromWord(fileBuffer) {
    try {
      // For now, we'll try to extract any readable text
      // In a full implementation, you'd use mammoth.js or similar
      const text = new TextDecoder().decode(fileBuffer);
      
      // Basic Word document text extraction (very limited)
      // This will only work for simple Word documents
      const cleanedText = text
        .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ') // Remove control characters
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      if (cleanedText.length < 100) {
        throw new Error('Could not extract meaningful text from Word document');
      }
      
      return this._cleanText(cleanedText);
      
    } catch (error) {
      console.error('Word document extraction failed:', error);
      throw new Error(`Word document parsing failed: ${error.message}. Please convert to PDF or plain text for better results.`);
    }
  }

  /**
   * Strip HTML tags from text
   */
  _stripHTML(html) {
    // Remove scripts and styles more thoroughly
    let text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove styles
      .replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, '') // Remove head section
      .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
      .replace(/<[^>]*>/g, ' ') // Remove all remaining tags
      .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
      .replace(/&[a-zA-Z0-9#]+;/g, ' ') // Remove HTML entities
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    return this._cleanText(text);
  }

  /**
   * Clean and normalize extracted text
   */
  _cleanText(text) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s{2,}/g, ' ')
      .trim();
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
      } else {
        // If no section started yet, create a default section
        if (!currentSection) {
          currentSection = {
            reference: 'DEFAULT',
            title: 'Main Content',
            level: 1,
            type: 'default',
            startPosition: 0,
            content: [],
            policies: []
          };
        }
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
    // Pattern 1: Numbered sections (e.g., "1. Introduction", "2.1 Housing")
    const numberedMatch = line.match(/^(\d+(?:\.\d+)*)\s+(.+)$/);
    if (numberedMatch) {
      return {
        reference: numberedMatch[1],
        title: numberedMatch[2],
        level: (numberedMatch[1].match(/\./g) || []).length + 1,
        type: 'numbered'
      };
    }

    // Pattern 2: Lettered sections (e.g., "A. Strategic Policies")
    const letteredMatch = line.match(/^([A-Z](?:\.\d+)*)\s+(.+)$/);
    if (letteredMatch) {
      return {
        reference: letteredMatch[1],
        title: letteredMatch[2],
        level: (letteredMatch[1].match(/\./g) || []).length + 1,
        type: 'lettered'
      };
    }

    // Pattern 3: Chapter headers (e.g., "CHAPTER 5: HOUSING POLICIES")
    const chapterMatch = line.match(/^CHAPTER\s+(\d+):\s*(.+)$/i);
    if (chapterMatch) {
      return {
        reference: `CHAPTER_${chapterMatch[1]}`,
        title: chapterMatch[2],
        level: 1,
        type: 'chapter'
      };
    }

    // Pattern 4: All caps titles
    if (/^[A-Z\s]{5,50}$/.test(line) && line.length > 5) {
      return {
        reference: `SECTION_${lineIndex}`,
        title: line,
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
    let policies = [];

    // First try extracting from individual sections
    for (const section of structure.sections) {
      const sectionPolicies = this._extractPoliciesFromSection(section);
      policies.push(...sectionPolicies);
    }

    // If no policies found or only one section with everything, 
    // extract directly from full text with enhanced patterns
    if (policies.length === 0 || 
        (structure.sections.length === 1 && structure.sections[0].reference === 'DEFAULT')) {
      const fullText = structure.sections.map(s => s.content).join('\n');
      const directPolicies = this._extractPoliciesFromText(fullText);
      
      // If we found policies in full text, use those instead
      if (directPolicies.length > 0) {
        policies = directPolicies;
      }
    }

    return policies;
  }

  /**
   * Extract policies directly from text using improved patterns
   */
  _extractPoliciesFromText(text) {
    const policies = [];
    
    // Enhanced policy patterns that look for the actual policy statements
    const policyPatterns = [
      // Pattern 1: "Policy H1:" or "Policy H1 " followed by content until next policy
      /Policy\s+([A-Z]+\d+(?:\.\d+)*)[:\s]+(.*?)(?=(?:Policy\s+[A-Z]+\d+)|(?:\n\s*\d+\.)|$)/gis,
      
      // Pattern 2: Standalone policy reference at start of line "H1:" or "H1 "
      /(?:^|\n)\s*([A-Z]+\d+(?:\.\d+)*)[:\s]+([^\n]{10,}.*?)(?=(?:\n\s*[A-Z]+\d+)|(?:\n\s*\d+\.)|$)/gims,
      
      // Pattern 3: Section numbers with policy keywords "5.1 Housing Policy"
      /(?:^|\n)\s*(\d+\.\d+)\s+([^\n]*(?:Policy|policy)[^\n]*)(.*?)(?=(?:\n\s*\d+\.\d+)|(?:\n\s*Policy)|$)/gis
    ];

    for (const pattern of policyPatterns) {
      const matches = [...text.matchAll(pattern)];
      
      for (const match of matches) {
        const [fullMatch, reference, titleAndContent, additionalContent = ''] = match;
        
        if (!reference || !titleAndContent) continue;
        
        // Combine all content parts
        const fullContent = (titleAndContent + ' ' + additionalContent)
          .replace(/\s+/g, ' ')
          .trim();
        
        // Extract title (first line/sentence) and content
        const lines = fullContent.split(/[.\n]/);
        const title = lines[0]?.trim() || `Policy ${reference}`;
        
        // Skip if too short or doesn't look like policy content
        if (fullContent.length < 50 || !this._isPolicyContent(fullContent)) {
          continue;
        }
        
        policies.push({
          reference: reference.trim(),
          title: title,
          content: fullContent,
          section: 'EXTRACTED',
          sectionTitle: 'Direct Extraction',
          category: this._categorizePolicy(fullContent),
          requirements: this._extractRequirements(fullContent),
          crossReferences: this._extractCrossReferences(fullContent),
          extractedAt: new Date().toISOString()
        });
      }
      
      // If we found policies with this pattern, break to avoid duplicates
      if (policies.length > 0) break;
    }

    return policies;
  }

  /**
   * Check if content looks like actual policy content
   */
  _isPolicyContent(content) {
    const policyIndicators = [
      /development/i,
      /planning/i, 
      /proposal/i,
      /application/i,
      /requirement/i,
      /provision/i,
      /shall/i,
      /must/i,
      /should/i,
      /will be/i,
      /criteria/i,
      /standards/i,
      /housing/i,
      /employment/i,
      /transport/i
    ];
    
    const indicatorCount = policyIndicators.filter(pattern => 
      pattern.test(content)).length;
    
    // Must have at least 2 policy indicators and reasonable length
    return indicatorCount >= 2 && content.length > 50;
  }

  /**
   * Extract policies from a single section
   */
  _extractPoliciesFromSection(section) {
    const policies = [];
    const content = section.content;

    // Look for explicit policy statements with more flexible patterns
    const policyPatterns = [
      // Pattern 1: "Policy H1:" or "Policy H1."
      /(?:^|\n)\s*Policy\s+([A-Z]+\d+(?:\.\d+)*)[:\.]?\s*([^\n]*)\n?((?:[^\n]*\n)*?)(?=(?:\n\s*Policy\s+[A-Z]+\d+)|$)/gi,
      // Pattern 2: "H1:" or "H1."
      /(?:^|\n)\s*([A-Z]+\d+(?:\.\d+)*)[:\.]?\s*([^\n]*)\n?((?:[^\n]*\n)*?)(?=(?:\n\s*[A-Z]+\d+)|$)/gi,
      // Pattern 3: Section-based policies like "5.1 Policy Name"
      /(?:^|\n)\s*(\d+\.\d+)\s+([^\n]*(?:Policy|policy)[^\n]*)\n?((?:[^\n]*\n)*?)(?=(?:\n\s*\d+\.\d+)|$)/gi
    ];
    
    let foundPolicies = false;
    
    for (const pattern of policyPatterns) {
      const matches = [...content.matchAll(pattern)];
      
      for (const match of matches) {
        const [fullMatch, reference, title, policyContent] = match;
        
        // Skip if we don't have minimum content
        if (!reference || !title) continue;
        
        // Get the full policy content
        const fullPolicyContent = title + ' ' + (policyContent || '');
        
        if (fullPolicyContent.trim().length > 20) {
          policies.push({
            reference: reference.trim(),
            title: title?.trim() || `Policy ${reference}`,
            content: fullPolicyContent.trim(),
            section: section.reference,
            sectionTitle: section.title,
            category: this._categorizePolicy(title + ' ' + fullPolicyContent),
            requirements: this._extractRequirements(fullPolicyContent),
            crossReferences: this._extractCrossReferences(fullPolicyContent),
            extractedAt: new Date().toISOString()
          });
          foundPolicies = true;
        }
      }
      
      // If we found policies with this pattern, don't try others
      if (foundPolicies) break;
    }

    // If no explicit policies found, look for implicit policies in section
    if (policies.length === 0 && section.content.length > 200) {
      const implicitPolicy = this._extractImplicitPolicy(section);
      if (implicitPolicy) {
        policies.push(implicitPolicy);
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

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Stop at next policy or major section
      if (this.policyPatterns.policy.test(trimmed) && contentLines.length > 0) {
        break;
      }
      
      if (trimmed.length > 0) {
        contentLines.push(trimmed);
      }
      
      // Stop if we have enough content
      if (contentLines.join(' ').length > 1000) {
        break;
      }
    }

    return contentLines.join(' ').trim();
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
    const matches = [...text.matchAll(this.policyPatterns.requirement)];
    
    for (const match of matches) {
      const requirement = match[0].trim();
      if (requirement.length > 10 && requirement.length < 300) {
        requirements.push({
          text: requirement,
          type: this._classifyRequirement(requirement),
          mandatory: /\b(must|shall|required|mandatory)\b/i.test(requirement)
        });
      }
    }

    return requirements;
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
    const policyRefs = [...text.matchAll(/(?:Policy\s+)?([A-Z]+\d+(?:\.\d+)*)\b/gi)];
    policyRefs.forEach(match => references.add(match[1]));
    
    // Pattern 2: Section references (e.g., "Section 2.1", "paragraph 3.4")
    const sectionRefs = [...text.matchAll(/(?:Section|paragraph)\s+(\d+(?:\.\d+)*)/gi)];
    sectionRefs.forEach(match => references.add(match[1]));

    return Array.from(references);
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

    policies.forEach(policy => {
      const issues = [];

      // Check for required fields
      if (!policy.reference) issues.push('Missing policy reference');
      if (!policy.title) issues.push('Missing policy title');
      if (!policy.content || policy.content.length < 20) issues.push('Content too short');

      // Check for duplicate references
      const duplicates = policies.filter(p => p.reference === policy.reference);
      if (duplicates.length > 1) issues.push('Duplicate policy reference');

      if (issues.length === 0) {
        validation.valid.push(policy);
      } else {
        validation.invalid.push({ policy, issues });
      }

      // Add warnings for potential issues
      if (policy.content.length > 2000) {
        validation.warnings.push({ policy, warning: 'Policy content is very long' });
      }
      
      if (policy.requirements.length === 0) {
        validation.warnings.push({ policy, warning: 'No requirements detected' });
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
        withCrossRefs: policies.filter(p => p.crossReferences.length > 0).length
      },
      quality: {
        averageContentLength: Math.round(
          policies.reduce((sum, p) => sum + p.content.length, 0) / policies.length
        ),
        referenceCoverage: policies.filter(p => p.crossReferences.length > 0).length / policies.length,
        requirementCoverage: policies.filter(p => p.requirements.length > 0).length / policies.length
      }
    };
  }
}

export { PolicyParser };
