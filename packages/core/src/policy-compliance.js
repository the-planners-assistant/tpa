import { getDatabase } from './database.js';
import ApplicantDataManager from './applicant-data-manager.js';
import Agent from './agent.js';

/**
 * PolicyComplianceEngine
 * AI-enhanced policy matching, compliance scoring, gap analysis, and recommendation generation
 */
export default class PolicyComplianceEngine {
  constructor(db = getDatabase(), agentConfig = {}) {
    this.db = db;
    this.applicantDataManager = new ApplicantDataManager(db, agentConfig);
    this.agent = new Agent(agentConfig);
    this.enableAI = agentConfig.googleApiKey ? true : false;
    
    // Compliance scoring weights
    this.scoringWeights = {
      direct_match: 1.0,      // Policy directly addresses the proposal
      constraint_compliance: 0.8,  // Meets constraint requirements
      design_compliance: 0.7,      // Meets design requirements
      technical_compliance: 0.6,   // Meets technical standards
      procedural_compliance: 0.5   // Meets procedural requirements
    };
  }

  /**
   * Run comprehensive policy compliance check with AI enhancement
   */
  async runComplianceCheck(applicationId, localPlanId, options = {}) {
    const {
      generateRecommendations = true,
      detailedAnalysis = true,
      includeGapAnalysis = true,
      enableAIAnalysis = this.enableAI,
      confidenceThreshold = 0.7
    } = options;

    try {
      // Get application data
      const application = await this._getApplicationData(applicationId);
      if (!application) {
        throw new Error('Application not found');
      }

      // AI-enhanced application assessment if enabled
      let aiAssessment = null;
      if (enableAIAnalysis && this.enableAI) {
        aiAssessment = await this._runAIComplianceAssessment(application, localPlanId);
      }

      // Get relevant local plan policies
      const relevantPolicies = await this.applicantDataManager
        .linkToLocalPlanPolicies(application, localPlanId);

      // Check compliance against each relevant policy
      const complianceResults = [];
      for (const { policy, relevance } of relevantPolicies) {
        const compliance = await this._checkPolicyCompliance(
          application, 
          policy, 
          detailedAnalysis,
          aiAssessment
        );
        complianceResults.push({
          policy,
          relevance,
          compliance,
          complianceScore: compliance.overallScore,
          status: this._getComplianceStatus(compliance.overallScore)
        });
      }

      // Calculate overall compliance score
      const overallScore = this._calculateOverallScore(complianceResults, aiAssessment);

      // Generate enhanced gap analysis
      let gapAnalysis = null;
      if (includeGapAnalysis) {
        gapAnalysis = await this._generateGapAnalysis(complianceResults, application, aiAssessment);
      }

      // Generate AI-enhanced recommendations
      let recommendations = null;
      if (generateRecommendations) {
        recommendations = await this._generateRecommendations(
          complianceResults, 
          gapAnalysis, 
          aiAssessment
        );
      }

      // Store compliance check in database
      const complianceCheckId = await this.db.complianceChecks.add({
        applicationId,
        policyId: localPlanId,
        status: this._getComplianceStatus(overallScore),
        score: overallScore,
        notes: `Checked against ${complianceResults.length} relevant policies${enableAIAnalysis ? ' (AI-enhanced)' : ''}`,
        checkedAt: new Date().toISOString(),
        assessorId: 'system',
        aiEnhanced: enableAIAnalysis
      });

      return {
        id: complianceCheckId,
        applicationId,
        localPlanId,
        overallScore,
        status: this._getComplianceStatus(overallScore),
        policyResults: complianceResults,
        gapAnalysis,
        recommendations,
        aiAssessment,
        confidence: this._calculateConfidence(complianceResults, aiAssessment),
        metadata: {
          checkedAt: new Date().toISOString(),
          policiesEvaluated: complianceResults.length,
          averageRelevance: relevantPolicies.reduce((sum, p) => sum + p.relevance, 0) / relevantPolicies.length,
          aiEnhanced: enableAIAnalysis
        }
      };
    } catch (error) {
      console.error('Policy compliance check failed:', error);
      throw new Error(`Failed to run compliance check: ${error.message}`);
    }
  }

  /**
   * AI-enhanced policy compliance assessment
   */
  async _runAIComplianceAssessment(application, localPlanId) {
    if (!this.agent) {
      console.warn('AI agent not available for compliance assessment');
      return null;
    }

    try {
      const localPlan = await this.db.localPlans.get(localPlanId);
      if (!localPlan) {
        throw new Error('Local plan not found');
      }

      // Use the LocalPlanAgent for intelligent assessment
      const assessment = await this.agent.assessApplicationCompliance({
        application,
        localPlan,
        analysisOptions: {
          includeSpacialAnalysis: true,
          includePolicyMatching: true,
          includeDesignGuidanceAssessment: true,
          includeConstraintAnalysis: true
        }
      });

      return {
        overallAssessment: assessment.overallAssessment,
        policyAlignment: assessment.policyAlignment,
        spatialCompliance: assessment.spatialCompliance,
        designCompliance: assessment.designCompliance,
        constraintCompliance: assessment.constraintCompliance,
        recommendations: assessment.recommendations,
        confidence: assessment.confidence || 0.8,
        reasoning: assessment.reasoning
      };
    } catch (error) {
      console.error('AI compliance assessment failed:', error);
      return null;
    }
  }

  /**
   * Check compliance against a specific policy with AI enhancement
   */
  async _checkPolicyCompliance(application, policy, detailed = true, aiAssessment = null) {
    const compliance = {
      overallScore: 0,
      criteria: [],
      strengths: [],
      weaknesses: [],
      requirements: [],
      evidence: []
    };

    // Extract policy requirements
    const requirements = this._extractPolicyRequirements(policy);
    compliance.requirements = requirements;

    // Check each requirement
    for (const requirement of requirements) {
      const criterionResult = await this._checkRequirement(application, requirement);
      compliance.criteria.push(criterionResult);

      if (criterionResult.score >= 0.7) {
        compliance.strengths.push(criterionResult.description);
      } else if (criterionResult.score < 0.4) {
        compliance.weaknesses.push(criterionResult.description);
      }
    }

    // Calculate overall score
    if (compliance.criteria.length > 0) {
      const weightedScore = compliance.criteria.reduce((sum, criterion) => {
        const weight = this.scoringWeights[criterion.type] || 0.5;
        return sum + (criterion.score * weight);
      }, 0);
      
      const totalWeight = compliance.criteria.reduce((sum, criterion) => {
        return sum + (this.scoringWeights[criterion.type] || 0.5);
      }, 0);
      
      compliance.overallScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    }

    // Find supporting evidence
    if (detailed) {
      compliance.evidence = this._findSupportingEvidence(application, requirements);
    }

    return compliance;
  }

  /**
   * Extract requirements from policy content
   */
  _extractPolicyRequirements(policy) {
    const requirements = [];
    const content = policy.content.toLowerCase();

    // Common requirement patterns
    const patterns = [
      {
        type: 'design_compliance',
        patterns: [
          /must be designed to/g,
          /should incorporate/g,
          /design should/g,
          /shall provide/g
        ]
      },
      {
        type: 'technical_compliance',
        patterns: [
          /minimum of (\d+)/g,
          /at least (\d+)/g,
          /no more than (\d+)/g,
          /maximum of (\d+)/g
        ]
      },
      {
        type: 'constraint_compliance',
        patterns: [
          /protected area/g,
          /conservation area/g,
          /listed building/g,
          /green belt/g
        ]
      },
      {
        type: 'procedural_compliance',
        patterns: [
          /consultation with/g,
          /agreement with/g,
          /approved by/g,
          /submission of/g
        ]
      }
    ];

    patterns.forEach(({ type, patterns: typePatterns }) => {
      typePatterns.forEach(pattern => {
        const matches = [...content.matchAll(pattern)];
        matches.forEach(match => {
          const context = this._extractContext(content, match.index, 100);
          requirements.push({
            type,
            text: match[0],
            context,
            numeric: match[1] ? parseInt(match[1]) : null
          });
        });
      });
    });

    // Add general requirements based on policy category
    switch (policy.category) {
      case 'housing':
        requirements.push({
          type: 'direct_match',
          text: 'housing provision',
          context: 'Policy addresses housing development'
        });
        break;
      case 'design':
        requirements.push({
          type: 'design_compliance',
          text: 'design quality',
          context: 'Policy addresses design standards'
        });
        break;
      case 'transport':
        requirements.push({
          type: 'technical_compliance',
          text: 'transport assessment',
          context: 'Policy addresses transport impacts'
        });
        break;
    }

    return requirements;
  }

  /**
   * Check compliance with a specific requirement
   */
  async _checkRequirement(application, requirement) {
    let score = 0;
    let evidence = '';
    let reasoning = '';

    switch (requirement.type) {
      case 'direct_match':
        score = this._checkDirectMatch(application, requirement);
        reasoning = 'Direct policy relevance assessment';
        break;

      case 'design_compliance':
        score = this._checkDesignCompliance(application, requirement);
        reasoning = 'Design statement and proposal assessment';
        break;

      case 'technical_compliance':
        score = this._checkTechnicalCompliance(application, requirement);
        reasoning = 'Technical requirements verification';
        break;

      case 'constraint_compliance':
        score = this._checkConstraintCompliance(application, requirement);
        reasoning = 'Constraint impact assessment';
        break;

      case 'procedural_compliance':
        score = this._checkProceduralCompliance(application, requirement);
        reasoning = 'Procedural requirements check';
        break;

      default:
        score = 0.5;
        reasoning = 'General policy relevance';
    }

    return {
      type: requirement.type,
      description: requirement.text,
      context: requirement.context,
      score: Math.max(0, Math.min(1, score)),
      evidence,
      reasoning
    };
  }

  /**
   * Check direct policy match
   */
  _checkDirectMatch(application, requirement) {
    const proposedUse = application.siteInfo?.proposedUse || '';
    const description = application.siteInfo?.description || '';
    
    const searchText = (proposedUse + ' ' + description).toLowerCase();
    const requirementText = requirement.text.toLowerCase();

    if (searchText.includes(requirementText)) {
      return 0.9;
    }

    // Check for semantic matches
    const semanticMatches = {
      'housing': ['residential', 'dwelling', 'home', 'apartment'],
      'employment': ['commercial', 'office', 'industrial', 'business'],
      'retail': ['shop', 'store', 'commercial'],
      'community': ['community', 'public', 'social']
    };

    for (const [key, synonyms] of Object.entries(semanticMatches)) {
      if (requirementText.includes(key) && 
          synonyms.some(syn => searchText.includes(syn))) {
        return 0.7;
      }
    }

    return 0.3;
  }

  /**
   * Check design compliance
   */
  _checkDesignCompliance(application, requirement) {
    const designStatements = application.extractedData?.statements
      ?.filter(s => s.type.toLowerCase().includes('design')) || [];

    if (designStatements.length === 0) {
      return 0.2; // No design statement provided
    }

    // Check if design statements address the requirement
    const designContent = designStatements.map(s => s.content.toLowerCase()).join(' ');
    const requirementWords = requirement.text.toLowerCase().split(' ');

    let matchCount = 0;
    requirementWords.forEach(word => {
      if (designContent.includes(word)) {
        matchCount++;
      }
    });

    return Math.min(0.9, matchCount / requirementWords.length + 0.3);
  }

  /**
   * Check technical compliance
   */
  _checkTechnicalCompliance(application, requirement) {
    const technicalReports = application.extractedData?.technicalReports || [];
    
    if (requirement.numeric) {
      // Check numeric requirements (e.g., minimum parking spaces)
      const proposedUnits = application.siteInfo?.proposedUnits || 0;
      const ratio = requirement.numeric / Math.max(1, proposedUnits);
      
      if (ratio <= 1) {
        return 0.8; // Requirement appears achievable
      } else {
        return 0.3; // May struggle to meet requirement
      }
    }

    // Check if relevant technical reports exist
    const relevantReports = technicalReports.filter(report => 
      report.content.toLowerCase().includes(requirement.text.toLowerCase())
    );

    return relevantReports.length > 0 ? 0.7 : 0.4;
  }

  /**
   * Check constraint compliance
   */
  _checkConstraintCompliance(application, requirement) {
    const constraints = application.constraints || [];
    const requirementText = requirement.text.toLowerCase();

    // Check if constrained area mentioned in requirement
    const relevantConstraints = constraints.filter(constraint =>
      requirementText.includes(constraint.name.toLowerCase())
    );

    if (relevantConstraints.length > 0) {
      // Site is affected by constraint - needs careful assessment
      return 0.4;
    }

    // No relevant constraints found - likely compliant
    return 0.8;
  }

  /**
   * Check procedural compliance
   */
  _checkProceduralCompliance(application, requirement) {
    const statements = application.extractedData?.statements || [];
    const technicalReports = application.extractedData?.technicalReports || [];
    
    const allDocuments = [...statements, ...technicalReports];
    const requirementText = requirement.text.toLowerCase();

    // Check if procedural requirements are addressed in submissions
    const addressedInDocuments = allDocuments.some(doc =>
      doc.content.toLowerCase().includes(requirementText)
    );

    return addressedInDocuments ? 0.7 : 0.3;
  }

  /**
   * Extract context around a match
   */
  _extractContext(text, index, length = 100) {
    const start = Math.max(0, index - length);
    const end = Math.min(text.length, index + length);
    return text.slice(start, end).trim();
  }

  /**
   * Find supporting evidence in application
   */
  _findSupportingEvidence(application, requirements) {
    const evidence = [];
    const allContent = [
      application.siteInfo?.description || '',
      ...(application.extractedData?.statements?.map(s => s.content) || []),
      ...(application.extractedData?.technicalReports?.map(r => r.content) || [])
    ].join(' ').toLowerCase();

    requirements.forEach(req => {
      const words = req.text.toLowerCase().split(' ');
      const matches = words.filter(word => allContent.includes(word));
      
      if (matches.length > 0) {
        evidence.push({
          requirement: req.text,
          matchedWords: matches,
          confidence: matches.length / words.length
        });
      }
    });

    return evidence;
  }

  /**
   * Calculate overall compliance score with AI enhancement
   */
  _calculateOverallScore(complianceResults, aiAssessment = null) {
    if (complianceResults.length === 0) return 0;

    const weightedSum = complianceResults.reduce((sum, result) => {
      return sum + (result.complianceScore * result.relevance);
    }, 0);

    const totalWeight = complianceResults.reduce((sum, result) => {
      return sum + result.relevance;
    }, 0);

    let baseScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // Incorporate AI assessment if available
    if (aiAssessment && aiAssessment.overallAssessment) {
      const aiScore = aiAssessment.overallAssessment.complianceScore || 0;
      const aiConfidence = aiAssessment.confidence || 0.5;
      
      // Weighted combination of rule-based and AI scores
      baseScore = (baseScore * (1 - aiConfidence * 0.3)) + (aiScore * aiConfidence * 0.3);
    }

    return Math.min(1.0, Math.max(0.0, baseScore));
  }

  /**
   * Calculate confidence score for the assessment
   */
  _calculateConfidence(complianceResults, aiAssessment = null) {
    let confidence = 0.7; // Base confidence for rule-based assessment

    // Adjust based on number of policies evaluated
    const policyCount = complianceResults.length;
    if (policyCount >= 5) confidence += 0.1;
    if (policyCount >= 10) confidence += 0.1;

    // Adjust based on average relevance
    const avgRelevance = complianceResults.reduce((sum, r) => sum + r.relevance, 0) / policyCount;
    confidence += (avgRelevance - 0.5) * 0.2;

    // Incorporate AI confidence if available
    if (aiAssessment && aiAssessment.confidence) {
      confidence = (confidence + aiAssessment.confidence) / 2;
    }

    return Math.min(1.0, Math.max(0.3, confidence));
  }

  /**
   * Get compliance status from score
   */
  _getComplianceStatus(score) {
    if (score >= 0.8) return 'compliant';
    if (score >= 0.6) return 'mostly_compliant';
    if (score >= 0.4) return 'partially_compliant';
    return 'non_compliant';
  }

  /**
   * Generate enhanced gap analysis with AI insights
   */
  async _generateGapAnalysis(complianceResults, application, aiAssessment = null) {
    const gaps = {
      critical: [],
      moderate: [],
      minor: [],
      missing_documents: [],
      recommendations: [],
      aiInsights: null
    };

    // Process rule-based gaps
    complianceResults.forEach(result => {
      result.compliance.weaknesses.forEach(weakness => {
        const gap = {
          policy: result.policy.policyRef,
          issue: weakness,
          severity: result.complianceScore < 0.3 ? 'critical' : 
                   result.complianceScore < 0.6 ? 'moderate' : 'minor',
          source: 'rule-based'
        };

        gaps[gap.severity].push(gap);
      });
    });

    // Incorporate AI assessment gaps
    if (aiAssessment) {
      gaps.aiInsights = {
        spatialGaps: aiAssessment.spatialCompliance?.gaps || [],
        designGaps: aiAssessment.designCompliance?.gaps || [],
        policyGaps: aiAssessment.policyAlignment?.gaps || [],
        constraintGaps: aiAssessment.constraintCompliance?.gaps || []
      };

      // Add AI-identified critical gaps
      if (aiAssessment.recommendations) {
        aiAssessment.recommendations.forEach(rec => {
          if (rec.priority === 'critical' || rec.priority === 'high') {
            gaps.critical.push({
              policy: rec.policyRef || 'AI-identified',
              issue: rec.issue,
              severity: 'critical',
              source: 'AI-analysis',
              aiReasoning: rec.reasoning
            });
          }
        });
      }
    }

    return gaps;
  }

  /**
   * Generate enhanced recommendations with AI insights
   */
  async _generateRecommendations(complianceResults, gapAnalysis, aiAssessment = null) {
    const recommendations = {
      immediate_actions: [],
      improvements: [],
      additional_evidence: [],
      risk_mitigation: [],
      ai_insights: null
    };

    // Generate recommendations based on gaps
    if (gapAnalysis?.critical?.length > 0) {
      recommendations.immediate_actions.push({
        priority: 'high',
        action: 'Address critical policy compliance gaps',
        details: gapAnalysis.critical.map(gap => gap.issue),
        timeline: 'Before determination',
        source: 'rule-based'
      });
    }

    if (gapAnalysis?.missing_documents?.length > 0) {
      recommendations.additional_evidence.push({
        priority: 'high',
        action: 'Submit missing required documents',
        details: gapAnalysis.missing_documents.map(doc => doc.document),
        timeline: 'As soon as possible',
        source: 'rule-based'
      });
    }

    // Generate policy-specific recommendations
    complianceResults.forEach(result => {
      if (result.complianceScore < 0.6) {
        recommendations.improvements.push({
          priority: 'medium',
          action: `Improve compliance with ${result.policy.policyRef}`,
          details: result.compliance.weaknesses,
          policy: result.policy.title,
          source: 'rule-based'
        });
      }
    });

    // Incorporate AI recommendations
    if (aiAssessment && aiAssessment.recommendations) {
      recommendations.ai_insights = {
        recommendations: aiAssessment.recommendations,
        reasoning: aiAssessment.reasoning
      };

      // Add high-priority AI recommendations to immediate actions
      aiAssessment.recommendations
        .filter(rec => rec.priority === 'critical' || rec.priority === 'high')
        .forEach(rec => {
          recommendations.immediate_actions.push({
            priority: rec.priority,
            action: rec.action || rec.issue,
            details: [rec.description || rec.reasoning],
            timeline: rec.timeline || 'Before determination',
            source: 'AI-analysis',
            confidence: rec.confidence
          });
        });
    }

    return recommendations;
  }

  /**
   * Enable AI-enhanced compliance checking
   */
  enableAIFeatures(agent) {
    this.agent = agent;
    this.enableAI = true;
    console.log('AI features enabled for PolicyComplianceEngine');
  }

  /**
   * Disable AI features (fall back to rule-based only)
   */
  disableAIFeatures() {
    this.enableAI = false;
    console.log('AI features disabled for PolicyComplianceEngine');
  }

  /**
   * Get application data with all related information
   */
  async _getApplicationData(applicationId) {
    try {
      // This would typically fetch from assessments table
      // For now, we'll reconstruct from documents
      const assessment = await this.db.assessments.get(applicationId);
      if (!assessment) return null;

      const documents = await this.db.documents
        .where('id')
        .anyOf(assessment.documentIds)
        .toArray();

      // Process application data using ApplicantDataManager
      const processedData = await this.applicantDataManager
        .processApplicationDocuments(documents, {
          applicationRef: assessment.id.toString(),
          localAuthorityId: null
        });

      return {
        id: applicationId,
        ...processedData,
        coordinates: assessment.coordinates,
        siteAddress: assessment.siteAddress
      };
    } catch (error) {
      console.error('Failed to get application data:', error);
      return null;
    }
  }

  /**
   * Get compliance check history
   */
  async getComplianceHistory(applicationId) {
    return await this.db.complianceChecks
      .where('applicationId')
      .equals(applicationId)
      .orderBy('checkedAt')
      .reverse()
      .toArray();
  }

  /**
   * Update compliance check
   */
  async updateComplianceCheck(complianceCheckId, updates) {
    await this.db.complianceChecks.update(complianceCheckId, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
    
    return await this.db.complianceChecks.get(complianceCheckId);
  }
}
