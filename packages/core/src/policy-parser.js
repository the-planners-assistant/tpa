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
      const text = await this._extractText(fileBuffer, mimeType);
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
  async _extractText(fileBuffer, mimeType) {
    const text = new TextDecoder().decode(fileBuffer);
    
    // For now, handle plain text - could be extended for PDF/Word parsing
    if (mimeType === 'text/plain' || mimeType === 'text/html') {
      return this._cleanText(text);
    }
    
    // For other formats, attempt basic text extraction
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

    // Pattern 3: All caps titles
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

    // Look for explicit policy statements
    const policyMatches = [...content.matchAll(this.policyPatterns.policy)];
    
    for (const match of policyMatches) {
      const [fullMatch, reference, title] = match;
      const startIndex = match.index;
      
      // Extract policy content (next paragraph or until next policy)
      const policyContent = this._extractPolicyContent(content, startIndex, fullMatch.length);
      
      if (policyContent && policyContent.length > 50) {
        policies.push({
          reference: reference.trim(),
          title: title?.trim() || `Policy ${reference}`,
          content: policyContent,
          section: section.reference,
          sectionTitle: section.title,
          category: this._categorizePolicy(title + ' ' + policyContent),
          requirements: this._extractRequirements(policyContent),
          crossReferences: this._extractCrossReferences(policyContent),
          extractedAt: new Date().toISOString()
        });
      }
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
