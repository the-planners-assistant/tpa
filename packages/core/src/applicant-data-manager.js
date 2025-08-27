import { getDatabase } from './database.js';
import PolicyEngine from './policy-engine.js';

/**
 * ApplicantDataManager
 * Handles application document processing, site-specific data extraction,
 * constraint overlay, and policy compliance checking
 */
export default class ApplicantDataManager {
  constructor(db = getDatabase()) {
    this.db = db;
    this.policyEngine = new PolicyEngine(db);
  }

  /**
   * Process uploaded application documents
   */
  async processApplicationDocuments(files, applicationData = {}) {
    const results = {
      processedDocuments: [],
      extractedData: {},
      siteInfo: null,
      constraints: [],
      errors: []
    };

    try {
      // Process each uploaded file
      for (const file of files) {
        const processed = await this._processApplicationFile(file, applicationData);
        results.processedDocuments.push(processed);
      }

      // Extract site information
      results.siteInfo = await this._extractSiteInformation(results.processedDocuments);
      
      // Identify relevant constraints
      if (results.siteInfo && results.siteInfo.coordinates) {
        results.constraints = await this._identifyConstraints(results.siteInfo.coordinates);
      }

      // Extract structured data from documents
      results.extractedData = await this._extractStructuredData(results.processedDocuments);

      return results;
    } catch (error) {
      console.error('Application processing failed:', error);
      results.errors.push(error.message);
      return results;
    }
  }

  /**
   * Process individual application file
   */
  async _processApplicationFile(file, applicationData) {
    const now = new Date().toISOString();
    
    // Store document in database
    const documentId = await this.db.documents.add({
      name: file.name,
      type: file.type,
      uploadDate: now,
      localAuthorityId: applicationData.localAuthorityId,
      applicationRef: applicationData.applicationRef || null,
      size: file.size,
      hash: await this._generateFileHash(file)
    });

    // Extract text content based on file type
    let content = '';
    try {
      if (file.type === 'application/pdf') {
        content = await this._extractPDFContent(file);
      } else if (file.type.includes('text')) {
        content = await this._extractTextContent(file);
      } else {
        console.warn(`Unsupported file type: ${file.type}`);
      }
    } catch (error) {
      console.error(`Failed to extract content from ${file.name}:`, error);
    }

    return {
      id: documentId,
      name: file.name,
      type: file.type,
      content,
      metadata: {
        uploadDate: now,
        applicationRef: applicationData.applicationRef,
        size: file.size
      }
    };
  }

  /**
   * Extract site information from processed documents
   */
  async _extractSiteInformation(documents) {
    const siteInfo = {
      address: null,
      coordinates: null,
      siteArea: null,
      proposedUse: null,
      proposedUnits: null,
      description: null
    };

    for (const doc of documents) {
      if (!doc.content) continue;

      // Extract address using existing address extractor
      try {
        const AddressExtractor = (await import('./address-extractor.js')).default;
        const extractor = new AddressExtractor();
        const extractedAddress = await extractor.extractAddress(doc.content);
        
        if (extractedAddress && !siteInfo.address) {
          siteInfo.address = extractedAddress.address;
          siteInfo.coordinates = extractedAddress.coordinates;
        }
      } catch (error) {
        console.warn('Address extraction failed:', error);
      }

      // Extract development description
      const descriptionPatterns = [
        /development description[:\s]*(.*?)(?:\n|$)/i,
        /proposed development[:\s]*(.*?)(?:\n|$)/i,
        /description of works[:\s]*(.*?)(?:\n|$)/i
      ];

      for (const pattern of descriptionPatterns) {
        const match = doc.content.match(pattern);
        if (match && !siteInfo.description) {
          siteInfo.description = match[1].trim();
          break;
        }
      }

      // Extract number of units
      const unitPatterns = [
        /(\d+)\s*(?:dwelling|unit|home|house)s?/i,
        /(?:dwelling|unit|home|house)s?\s*[:\-]\s*(\d+)/i
      ];

      for (const pattern of unitPatterns) {
        const match = doc.content.match(pattern);
        if (match && !siteInfo.proposedUnits) {
          siteInfo.proposedUnits = parseInt(match[1]);
          break;
        }
      }

      // Extract site area
      const areaPatterns = [
        /site area[:\s]*(\d+(?:\.\d+)?)\s*(hectare|ha|acre)/i,
        /(\d+(?:\.\d+)?)\s*(hectare|ha|acre)\s*site/i
      ];

      for (const pattern of areaPatterns) {
        const match = doc.content.match(pattern);
        if (match && !siteInfo.siteArea) {
          siteInfo.siteArea = {
            value: parseFloat(match[1]),
            unit: match[2].toLowerCase()
          };
          break;
        }
      }
    }

    return siteInfo;
  }

  /**
   * Identify planning constraints for the site
   */
  async _identifyConstraints(coordinates) {
    try {
      const SpatialAnalyzer = (await import('./spatial-analyzer.js')).default;
      const analyzer = new SpatialAnalyzer();
      
      const analysis = await analyzer.analyzeLocation(coordinates);
      return analysis.constraints || [];
    } catch (error) {
      console.warn('Constraint identification failed:', error);
      return [];
    }
  }

  /**
   * Extract structured data from documents
   */
  async _extractStructuredData(documents) {
    const data = {
      applicationDetails: {},
      planningHistory: [],
      technicalReports: [],
      statements: []
    };

    for (const doc of documents) {
      if (!doc.content) continue;

      // Extract application reference
      const refMatch = doc.content.match(/(?:application|ref|reference)[:\s#]*([A-Z0-9\/\-]+)/i);
      if (refMatch && !data.applicationDetails.reference) {
        data.applicationDetails.reference = refMatch[1];
      }

      // Extract applicant name
      const applicantMatch = doc.content.match(/applicant[:\s]*(.*?)(?:\n|$)/i);
      if (applicantMatch && !data.applicationDetails.applicant) {
        data.applicationDetails.applicant = applicantMatch[1].trim();
      }

      // Extract agent details
      const agentMatch = doc.content.match(/agent[:\s]*(.*?)(?:\n|$)/i);
      if (agentMatch && !data.applicationDetails.agent) {
        data.applicationDetails.agent = agentMatch[1].trim();
      }

      // Identify document type
      const docType = this._identifyDocumentType(doc.name, doc.content);
      if (docType === 'statement') {
        data.statements.push({
          name: doc.name,
          type: this._getStatementType(doc.name),
          content: doc.content.substring(0, 1000) // Preview
        });
      } else if (docType === 'technical') {
        data.technicalReports.push({
          name: doc.name,
          type: this._getTechnicalReportType(doc.name),
          content: doc.content.substring(0, 1000) // Preview
        });
      }
    }

    return data;
  }

  /**
   * Identify document type based on filename and content
   */
  _identifyDocumentType(filename, content) {
    const lowerName = filename.toLowerCase();
    
    if (lowerName.includes('statement') || lowerName.includes('access') || 
        lowerName.includes('heritage') || lowerName.includes('design')) {
      return 'statement';
    }
    
    if (lowerName.includes('report') || lowerName.includes('assessment') ||
        lowerName.includes('survey') || lowerName.includes('study')) {
      return 'technical';
    }
    
    if (lowerName.includes('plan') || lowerName.includes('drawing')) {
      return 'drawing';
    }
    
    return 'other';
  }

  /**
   * Get statement type from filename
   */
  _getStatementType(filename) {
    const lowerName = filename.toLowerCase();
    
    if (lowerName.includes('access')) return 'Design and Access Statement';
    if (lowerName.includes('heritage')) return 'Heritage Statement';
    if (lowerName.includes('design')) return 'Design Statement';
    if (lowerName.includes('planning')) return 'Planning Statement';
    if (lowerName.includes('supporting')) return 'Supporting Statement';
    
    return 'Statement';
  }

  /**
   * Get technical report type from filename
   */
  _getTechnicalReportType(filename) {
    const lowerName = filename.toLowerCase();
    
    if (lowerName.includes('transport')) return 'Transport Assessment';
    if (lowerName.includes('flood')) return 'Flood Risk Assessment';
    if (lowerName.includes('ecology')) return 'Ecological Assessment';
    if (lowerName.includes('noise')) return 'Noise Assessment';
    if (lowerName.includes('contamination')) return 'Contamination Assessment';
    if (lowerName.includes('arboricultural')) return 'Arboricultural Assessment';
    
    return 'Technical Report';
  }

  /**
   * Generate hash for file deduplication
   */
  async _generateFileHash(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.warn('Failed to generate file hash:', error);
      return Date.now().toString(); // Fallback
    }
  }

  /**
   * Extract text content from PDF
   */
  async _extractPDFContent(file) {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let content = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        content += pageText + '\n';
      }
      
      return content;
    } catch (error) {
      console.error('PDF extraction failed:', error);
      throw new Error('Failed to extract text from PDF');
    }
  }

  /**
   * Extract text content from text files
   */
  async _extractTextContent(file) {
    try {
      return await file.text();
    } catch (error) {
      console.error('Text extraction failed:', error);
      throw new Error('Failed to extract text content');
    }
  }

  /**
   * Get application summary for a set of documents
   */
  async getApplicationSummary(documentIds) {
    const documents = await this.db.documents.where('id').anyOf(documentIds).toArray();
    
    const summary = {
      documentCount: documents.length,
      totalSize: documents.reduce((sum, doc) => sum + (doc.size || 0), 0),
      applicationRef: null,
      uploadDate: null,
      documentTypes: {}
    };

    // Count document types
    documents.forEach(doc => {
      const type = this._identifyDocumentType(doc.name, '');
      summary.documentTypes[type] = (summary.documentTypes[type] || 0) + 1;
    });

    // Get earliest upload date
    const uploadDates = documents.map(doc => new Date(doc.uploadDate)).filter(date => !isNaN(date));
    if (uploadDates.length > 0) {
      summary.uploadDate = new Date(Math.min(...uploadDates)).toISOString();
    }

    // Get application reference
    summary.applicationRef = documents.find(doc => doc.applicationRef)?.applicationRef || null;

    return summary;
  }

  /**
   * Link application to relevant local plan policies
   */
  async linkToLocalPlanPolicies(applicationData, localPlanId) {
    try {
      // Get local plan policies
      const localPlanPolicies = await this.db.localPlanPolicies
        .where('planId')
        .equals(localPlanId)
        .toArray();

      const relevantPolicies = [];

      // Use policy engine to find relevant policies
      for (const policy of localPlanPolicies) {
        const relevance = await this._assessPolicyRelevance(applicationData, policy);
        if (relevance.score > 0.3) { // Threshold for relevance
          relevantPolicies.push({
            policy,
            relevance: relevance.score,
            reasons: relevance.reasons
          });
        }
      }

      // Sort by relevance
      relevantPolicies.sort((a, b) => b.relevance - a.relevance);

      return relevantPolicies;
    } catch (error) {
      console.error('Policy linking failed:', error);
      return [];
    }
  }

  /**
   * Assess relevance of a policy to application data
   */
  async _assessPolicyRelevance(applicationData, policy) {
    let score = 0;
    const reasons = [];

    // Check development type match
    if (applicationData.siteInfo?.proposedUse && policy.content) {
      const useWords = applicationData.siteInfo.proposedUse.toLowerCase();
      const policyWords = policy.content.toLowerCase();

      if (useWords.includes('residential') && policyWords.includes('housing')) {
        score += 0.5;
        reasons.push('Housing/residential development match');
      }
      if (useWords.includes('commercial') && policyWords.includes('employment')) {
        score += 0.5;
        reasons.push('Commercial/employment development match');
      }
    }

    // Check site size relevance
    if (applicationData.siteInfo?.siteArea && policy.content) {
      const area = applicationData.siteInfo.siteArea.value;
      if (area > 0.5 && policy.content.toLowerCase().includes('major')) {
        score += 0.2;
        reasons.push('Major development threshold');
      }
    }

    // Check constraint relevance
    if (applicationData.constraints?.length > 0 && policy.content) {
      applicationData.constraints.forEach(constraint => {
        if (policy.content.toLowerCase().includes(constraint.name.toLowerCase())) {
          score += 0.3;
          reasons.push(`Constraint match: ${constraint.name}`);
        }
      });
    }

    // Check category relevance
    if (policy.category === 'design' && 
        applicationData.extractedData?.statements?.some(s => s.type.includes('Design'))) {
      score += 0.2;
      reasons.push('Design-related policy and statement');
    }

    return { score: Math.min(score, 1.0), reasons };
  }
}
