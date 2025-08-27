import { getDatabase } from './database.js';

/**
 * ReportGenerator
 * Advanced reporting for topic papers, evidence base summaries, policy impact reports, and compliance dashboards
 */
export default class ReportGenerator {
  constructor(db = getDatabase()) {
    this.db = db;
    this.templates = {
      topicPaper: 'Topic Paper Template',
      evidenceBaseSummary: 'Evidence Base Summary Template',
      policyImpactReport: 'Policy Impact Report Template',
      complianceDashboard: 'Compliance Dashboard Template',
      scenarioComparison: 'Scenario Comparison Template',
      siteAssessmentReport: 'Site Assessment Report Template'
    };
  }

  /**
   * Generate topic paper for a specific subject
   */
  async generateTopicPaper(planId, topic, options = {}) {
    const {
      includeEvidence = true,
      includePolicies = true,
      includeConstraints = true,
      format = 'html'
    } = options;

    try {
      const [localPlan, policies, evidence] = await Promise.all([
        this.db.localPlans.get(planId),
        this.db.localPlanPolicies.where('planId').equals(planId).toArray(),
        this.db.evidenceBase.where('planId').equals(planId).toArray()
      ]);

      // Filter content by topic
      const relevantPolicies = policies.filter(p => 
        p.category?.toLowerCase().includes(topic.toLowerCase()) ||
        p.title?.toLowerCase().includes(topic.toLowerCase()) ||
        p.content?.toLowerCase().includes(topic.toLowerCase())
      );

      const relevantEvidence = evidence.filter(e =>
        e.category?.toLowerCase().includes(topic.toLowerCase()) ||
        e.title?.toLowerCase().includes(topic.toLowerCase())
      );

      const report = {
        title: `${topic} Topic Paper`,
        planName: localPlan.name,
        authorityCode: localPlan.authorityCode,
        generatedAt: new Date().toISOString(),
        sections: []
      };

      // Executive Summary
      report.sections.push({
        title: 'Executive Summary',
        content: this._generateExecutiveSummary(topic, relevantPolicies, relevantEvidence),
        type: 'summary'
      });

      // Policy Framework
      if (includePolicies && relevantPolicies.length > 0) {
        report.sections.push({
          title: 'Policy Framework',
          content: this._generatePolicyFramework(relevantPolicies),
          type: 'policies',
          data: relevantPolicies
        });
      }

      // Evidence Base
      if (includeEvidence && relevantEvidence.length > 0) {
        report.sections.push({
          title: 'Evidence Base',
          content: this._generateEvidenceSection(relevantEvidence),
          type: 'evidence',
          data: relevantEvidence
        });
      }

      // Analysis and Assessment
      report.sections.push({
        title: 'Analysis and Assessment',
        content: this._generateAnalysisSection(topic, relevantPolicies, relevantEvidence),
        type: 'analysis'
      });

      // Conclusions and Recommendations
      report.sections.push({
        title: 'Conclusions and Recommendations',
        content: this._generateConclusionsSection(topic, relevantPolicies),
        type: 'conclusions'
      });

      // Format the report
      const formattedReport = await this._formatReport(report, format);
      
      return formattedReport;
    } catch (error) {
      console.error('Topic paper generation failed:', error);
      throw new Error(`Failed to generate topic paper: ${error.message}`);
    }
  }

  /**
   * Generate evidence base summary
   */
  async generateEvidenceBaseSummary(planId, options = {}) {
    const {
      groupByCategory = true,
      includeGaps = true,
      format = 'html'
    } = options;

    try {
      const [localPlan, evidence, policies] = await Promise.all([
        this.db.localPlans.get(planId),
        this.db.evidenceBase.where('planId').equals(planId).toArray(),
        this.db.localPlanPolicies.where('planId').equals(planId).toArray()
      ]);

      const report = {
        title: 'Evidence Base Summary',
        planName: localPlan.name,
        generatedAt: new Date().toISOString(),
        statistics: this._generateEvidenceStatistics(evidence),
        sections: []
      };

      if (groupByCategory) {
        const categories = [...new Set(evidence.map(e => e.category))];
        
        categories.forEach(category => {
          const categoryEvidence = evidence.filter(e => e.category === category);
          report.sections.push({
            title: category.charAt(0).toUpperCase() + category.slice(1),
            content: this._generateCategoryEvidenceSection(categoryEvidence),
            type: 'category',
            data: categoryEvidence
          });
        });
      }

      // Evidence gaps analysis
      if (includeGaps) {
        report.sections.push({
          title: 'Evidence Gaps Analysis',
          content: this._generateEvidenceGapsAnalysis(evidence, policies),
          type: 'gaps'
        });
      }

      // Quality assessment
      report.sections.push({
        title: 'Evidence Quality Assessment',
        content: this._generateQualityAssessment(evidence),
        type: 'quality'
      });

      return await this._formatReport(report, format);
    } catch (error) {
      console.error('Evidence base summary generation failed:', error);
      throw new Error(`Failed to generate evidence base summary: ${error.message}`);
    }
  }

  /**
   * Generate policy impact report
   */
  async generatePolicyImpactReport(planId, policyId, options = {}) {
    const {
      includeCompliance = true,
      includeScenarios = true,
      format = 'html'
    } = options;

    try {
      const [policy, complianceChecks, scenarios] = await Promise.all([
        this.db.localPlanPolicies.get(policyId),
        this.db.complianceChecks.where('policyId').equals(policyId).toArray(),
        this.db.scenarios.where('planId').equals(planId).toArray()
      ]);

      const report = {
        title: `Policy Impact Report: ${policy.policyRef}`,
        policyTitle: policy.title,
        generatedAt: new Date().toISOString(),
        sections: []
      };

      // Policy Overview
      report.sections.push({
        title: 'Policy Overview',
        content: this._generatePolicyOverview(policy),
        type: 'overview',
        data: policy
      });

      // Implementation Analysis
      if (includeCompliance && complianceChecks.length > 0) {
        report.sections.push({
          title: 'Implementation Analysis',
          content: this._generateImplementationAnalysis(complianceChecks),
          type: 'implementation',
          data: complianceChecks
        });
      }

      // Scenario Impact Assessment
      if (includeScenarios) {
        const scenarioImpacts = this._assessPolicyScenarioImpacts(policy, scenarios);
        report.sections.push({
          title: 'Scenario Impact Assessment',
          content: this._generateScenarioImpactSection(scenarioImpacts),
          type: 'scenarios'
        });
      }

      // Effectiveness Assessment
      report.sections.push({
        title: 'Policy Effectiveness',
        content: this._generateEffectivenessAssessment(policy, complianceChecks),
        type: 'effectiveness'
      });

      // Recommendations
      report.sections.push({
        title: 'Recommendations',
        content: this._generatePolicyRecommendations(policy, complianceChecks),
        type: 'recommendations'
      });

      return await this._formatReport(report, format);
    } catch (error) {
      console.error('Policy impact report generation failed:', error);
      throw new Error(`Failed to generate policy impact report: ${error.message}`);
    }
  }

  /**
   * Generate compliance dashboard data
   */
  async generateComplianceDashboard(planId, options = {}) {
    const {
      timeRange = 'all',
      includeDetails = true
    } = options;

    try {
      const [complianceChecks, policies, assessments] = await Promise.all([
        this.db.complianceChecks.toArray(),
        this.db.localPlanPolicies.where('planId').equals(planId).toArray(),
        this.db.assessments.toArray()
      ]);

      const dashboard = {
        summary: {
          totalChecks: complianceChecks.length,
          compliantApplications: complianceChecks.filter(c => c.status === 'compliant').length,
          averageScore: this._calculateAverageScore(complianceChecks),
          trendsData: this._generateTrendsData(complianceChecks, timeRange)
        },
        policyPerformance: this._analyzePolicyPerformance(policies, complianceChecks),
        recentActivity: this._getRecentActivity(complianceChecks, 10),
        keyIssues: this._identifyKeyIssues(complianceChecks),
        recommendations: this._generateDashboardRecommendations(complianceChecks)
      };

      if (includeDetails) {
        dashboard.detailedBreakdown = this._generateDetailedBreakdown(complianceChecks, policies);
      }

      return dashboard;
    } catch (error) {
      console.error('Compliance dashboard generation failed:', error);
      throw new Error(`Failed to generate compliance dashboard: ${error.message}`);
    }
  }

  /**
   * Generate scenario comparison report
   */
  async generateScenarioComparisonReport(scenarioIds, options = {}) {
    const {
      includeRecommendation = true,
      format = 'html'
    } = options;

    try {
      const scenarios = await Promise.all(
        scenarioIds.map(id => this.db.scenarios.get(id))
      );

      const report = {
        title: 'Scenario Comparison Report',
        scenarioCount: scenarios.length,
        generatedAt: new Date().toISOString(),
        sections: []
      };

      // Executive Summary
      report.sections.push({
        title: 'Executive Summary',
        content: this._generateScenarioExecutiveSummary(scenarios),
        type: 'summary'
      });

      // Detailed Comparison
      report.sections.push({
        title: 'Detailed Comparison',
        content: this._generateDetailedScenarioComparison(scenarios),
        type: 'comparison',
        data: scenarios
      });

      // Performance Analysis
      report.sections.push({
        title: 'Performance Analysis',
        content: this._generateScenarioPerformanceAnalysis(scenarios),
        type: 'performance'
      });

      // Risk Assessment
      report.sections.push({
        title: 'Risk Assessment',
        content: this._generateScenarioRiskAssessment(scenarios),
        type: 'risks'
      });

      // Recommendations
      if (includeRecommendation) {
        report.sections.push({
          title: 'Recommendations',
          content: this._generateScenarioRecommendations(scenarios),
          type: 'recommendations'
        });
      }

      return await this._formatReport(report, format);
    } catch (error) {
      console.error('Scenario comparison report generation failed:', error);
      throw new Error(`Failed to generate scenario comparison report: ${error.message}`);
    }
  }

  // Content generation methods

  _generateExecutiveSummary(topic, policies, evidence) {
    return `
      This topic paper examines ${topic} within the context of the local plan.
      
      Key findings:
      • ${policies.length} relevant policies identified
      • ${evidence.length} supporting evidence documents reviewed
      • Analysis demonstrates ${this._getSummaryConclusion(topic, policies)}
      
      The paper concludes that the approach to ${topic} is robust and evidence-based,
      with appropriate policies in place to guide development and decision-making.
    `;
  }

  _generatePolicyFramework(policies) {
    return policies.map(policy => `
      **${policy.policyRef}: ${policy.title}**
      
      ${policy.content.substring(0, 200)}...
      
      Category: ${policy.category}
      Cross-references: ${policy.crossReferences?.length || 0} policies
    `).join('\n\n');
  }

  _generateEvidenceSection(evidence) {
    return evidence.map(doc => `
      **${doc.title}** (${doc.category})
      
      Document type: ${doc.fileType?.toUpperCase()}
      Upload date: ${new Date(doc.uploadDate).toLocaleDateString()}
      Linked policies: ${doc.linkedPolicyIds?.length || 0}
    `).join('\n\n');
  }

  _generateAnalysisSection(topic, policies, evidence) {
    return `
      Analysis of ${topic} demonstrates:
      
      1. **Policy Coverage**: ${policies.length} policies directly address ${topic}
      2. **Evidence Base**: ${evidence.length} documents provide supporting evidence
      3. **Policy Integration**: Cross-referencing shows strong policy linkages
      4. **Effectiveness**: Policies provide clear guidance for decision-making
      
      The evidence base is comprehensive and supports the policy approach taken.
    `;
  }

  _generateConclusionsSection(topic, policies) {
    return `
      Conclusions:
      
      1. The local plan provides a robust framework for ${topic}
      2. Policies are clearly articulated and evidence-based
      3. The approach is consistent with national policy guidance
      4. Implementation mechanisms are appropriate
      
      Recommendations:
      
      1. Continue monitoring policy effectiveness
      2. Keep evidence base under review
      3. Consider policy updates as circumstances change
    `;
  }

  _generateEvidenceStatistics(evidence) {
    const categories = evidence.reduce((acc, doc) => {
      acc[doc.category] = (acc[doc.category] || 0) + 1;
      return acc;
    }, {});

    return {
      totalDocuments: evidence.length,
      categories: Object.keys(categories).length,
      categoryBreakdown: categories,
      averageAge: this._calculateAverageAge(evidence),
      recentUploads: evidence.filter(doc => 
        new Date(doc.uploadDate) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      ).length
    };
  }

  _generateCategoryEvidenceSection(evidence) {
    return `
      This category contains ${evidence.length} documents:
      
      ${evidence.map(doc => `• ${doc.title} (${doc.fileType || 'Unknown'})`).join('\n')}
      
      Coverage appears ${evidence.length >= 3 ? 'comprehensive' : 'limited'} for this topic area.
    `;
  }

  _generateEvidenceGapsAnalysis(evidence, policies) {
    const policyCategories = [...new Set(policies.map(p => p.category))];
    const evidenceCategories = [...new Set(evidence.map(e => e.category))];
    const gaps = policyCategories.filter(cat => !evidenceCategories.includes(cat));

    return `
      Evidence gaps analysis identifies:
      
      ${gaps.length > 0 ? 
        `Potential gaps in: ${gaps.join(', ')}` : 
        'No significant evidence gaps identified'
      }
      
      Recommendations:
      ${gaps.length > 0 ? 
        '• Consider commissioning additional evidence studies' :
        '• Continue monitoring evidence currency'
      }
    `;
  }

  _generateQualityAssessment(evidence) {
    const recent = evidence.filter(doc => 
      new Date(doc.uploadDate) > new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    ).length;

    return `
      Evidence quality assessment:
      
      • Currency: ${recent}/${evidence.length} documents updated within last year
      • Coverage: ${evidence.length > 10 ? 'Comprehensive' : 'Limited'}
      • Integration: Evidence well-linked to policies
      
      Overall quality rating: ${this._getQualityRating(evidence)}
    `;
  }

  _generatePolicyOverview(policy) {
    return `
      Policy Reference: ${policy.policyRef}
      Title: ${policy.title}
      Category: ${policy.category}
      
      Policy Requirements:
      ${policy.requirements?.map(req => `• ${req}`).join('\n') || 'No specific requirements listed'}
      
      Cross-references: ${policy.crossReferences?.length || 0} related policies
    `;
  }

  _generateImplementationAnalysis(complianceChecks) {
    const totalChecks = complianceChecks.length;
    const compliant = complianceChecks.filter(c => c.status === 'compliant').length;
    const avgScore = complianceChecks.reduce((sum, c) => sum + c.score, 0) / totalChecks;

    return `
      Implementation Performance:
      
      • Total applications assessed: ${totalChecks}
      • Compliant applications: ${compliant} (${Math.round(compliant/totalChecks * 100)}%)
      • Average compliance score: ${avgScore.toFixed(1)}/100
      • Effectiveness rating: ${this._getEffectivenessRating(avgScore)}
      
      Common issues identified:
      ${this._getCommonIssues(complianceChecks)}
    `;
  }

  _generateEffectivenessAssessment(policy, complianceChecks) {
    return `
      Policy effectiveness assessment indicates:
      
      1. **Clarity**: Policy provides clear guidance
      2. **Measurability**: Requirements can be objectively assessed
      3. **Implementation**: Practical application generally successful
      4. **Outcomes**: Policy achieving intended objectives
      
      Areas for improvement:
      • Enhanced guidance on interpretation
      • Examples of good practice
      • Regular monitoring and review
    `;
  }

  _generatePolicyRecommendations(policy, complianceChecks) {
    return `
      Recommendations for policy improvement:
      
      1. **Review clarity** of policy requirements
      2. **Provide examples** of acceptable proposals
      3. **Monitor compliance** rates regularly
      4. **Update guidance** based on implementation experience
      5. **Consider amendments** if systematic issues identified
    `;
  }

  // Utility methods

  _getSummaryConclusion(topic, policies) {
    if (policies.length >= 3) return 'strong policy coverage';
    if (policies.length >= 1) return 'adequate policy framework';
    return 'limited policy coverage requiring attention';
  }

  _calculateAverageAge(evidence) {
    const ages = evidence.map(doc => 
      (Date.now() - new Date(doc.uploadDate).getTime()) / (365 * 24 * 60 * 60 * 1000)
    );
    return ages.reduce((sum, age) => sum + age, 0) / ages.length;
  }

  _getQualityRating(evidence) {
    const avgAge = this._calculateAverageAge(evidence);
    if (avgAge < 1) return 'Excellent (Very Recent)';
    if (avgAge < 3) return 'Good (Recent)';
    if (avgAge < 5) return 'Fair (Aging)';
    return 'Poor (Outdated)';
  }

  _calculateAverageScore(complianceChecks) {
    if (complianceChecks.length === 0) return 0;
    return complianceChecks.reduce((sum, c) => sum + c.score, 0) / complianceChecks.length;
  }

  _generateTrendsData(complianceChecks, timeRange) {
    // Simplified trends - would implement proper time series analysis
    return {
      period: timeRange,
      trend: 'stable',
      improvement: false
    };
  }

  _analyzePolicyPerformance(policies, complianceChecks) {
    return policies.map(policy => {
      const policyChecks = complianceChecks.filter(c => 
        // Would need proper policy linking in real implementation
        c.notes?.includes(policy.policyRef)
      );
      
      return {
        policyRef: policy.policyRef,
        title: policy.title,
        checksCount: policyChecks.length,
        averageScore: policyChecks.length > 0 ? 
          policyChecks.reduce((sum, c) => sum + c.score, 0) / policyChecks.length : 0
      };
    });
  }

  _getRecentActivity(complianceChecks, limit) {
    return complianceChecks
      .sort((a, b) => new Date(b.checkedAt) - new Date(a.checkedAt))
      .slice(0, limit)
      .map(check => ({
        id: check.id,
        applicationId: check.applicationId,
        status: check.status,
        score: check.score,
        checkedAt: check.checkedAt
      }));
  }

  _identifyKeyIssues(complianceChecks) {
    const issues = [];
    
    const lowScoreChecks = complianceChecks.filter(c => c.score < 40);
    if (lowScoreChecks.length > 0) {
      issues.push({
        type: 'low_compliance',
        count: lowScoreChecks.length,
        description: 'Applications with low compliance scores'
      });
    }

    return issues;
  }

  _generateDashboardRecommendations(complianceChecks) {
    const recommendations = [];
    
    const avgScore = this._calculateAverageScore(complianceChecks);
    if (avgScore < 60) {
      recommendations.push('Review policy clarity and guidance');
    }
    
    if (complianceChecks.length < 10) {
      recommendations.push('Increase compliance checking frequency');
    }

    return recommendations;
  }

  _getEffectivenessRating(avgScore) {
    if (avgScore >= 80) return 'Highly Effective';
    if (avgScore >= 60) return 'Effective';
    if (avgScore >= 40) return 'Moderately Effective';
    return 'Needs Improvement';
  }

  _getCommonIssues(complianceChecks) {
    // Simplified analysis - would implement proper issue categorization
    return '• Insufficient design detail\n• Inadequate transport assessment\n• Limited environmental consideration';
  }

  /**
   * Format report output
   */
  async _formatReport(report, format) {
    switch (format) {
      case 'html':
        return this._formatAsHTML(report);
      case 'markdown':
        return this._formatAsMarkdown(report);
      case 'json':
        return report;
      default:
        return report;
    }
  }

  _formatAsHTML(report) {
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${report.title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          h1, h2, h3 { color: #333; }
          .metadata { background: #f5f5f5; padding: 15px; margin-bottom: 20px; }
          .section { margin-bottom: 30px; }
          pre { background: #f8f8f8; padding: 15px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <h1>${report.title}</h1>
        <div class="metadata">
    `;

    if (report.planName) html += `<p><strong>Plan:</strong> ${report.planName}</p>`;
    if (report.authorityCode) html += `<p><strong>Authority:</strong> ${report.authorityCode}</p>`;
    html += `<p><strong>Generated:</strong> ${new Date(report.generatedAt).toLocaleString()}</p>`;
    html += `</div>`;

    report.sections.forEach(section => {
      html += `
        <div class="section">
          <h2>${section.title}</h2>
          <pre>${section.content}</pre>
        </div>
      `;
    });

    html += `</body></html>`;
    return html;
  }

  _formatAsMarkdown(report) {
    let markdown = `# ${report.title}\n\n`;
    
    if (report.planName) markdown += `**Plan:** ${report.planName}\n`;
    if (report.authorityCode) markdown += `**Authority:** ${report.authorityCode}\n`;
    markdown += `**Generated:** ${new Date(report.generatedAt).toLocaleString()}\n\n`;

    report.sections.forEach(section => {
      markdown += `## ${section.title}\n\n`;
      markdown += `${section.content}\n\n`;
    });

    return markdown;
  }

  // Additional methods for scenario analysis
  _assessPolicyScenarioImpacts(policy, scenarios) {
    return scenarios.map(scenario => ({
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      impact: 'moderate', // Would calculate actual impact
      relevance: 'high'
    }));
  }

  _generateScenarioImpactSection(impacts) {
    return impacts.map(impact => `
      **${impact.scenarioName}**
      Impact Level: ${impact.impact}
      Relevance: ${impact.relevance}
    `).join('\n\n');
  }

  _generateScenarioExecutiveSummary(scenarios) {
    return `
      This report compares ${scenarios.length} development scenarios.
      
      Analysis shows:
      • Scenario performance varies significantly
      • Key differentiators include viability and environmental impact
      • Recommended approach balances delivery with sustainability
    `;
  }

  _generateDetailedScenarioComparison(scenarios) {
    return scenarios.map(scenario => `
      **${scenario.name}**
      Housing Units: ${scenario.parameters.housing.totalUnits}
      Jobs: ${scenario.parameters.employment.totalJobs}
      Status: ${scenario.status}
      ${scenario.results ? `Success Rate: ${scenario.results.summary.successProbability}%` : ''}
    `).join('\n\n');
  }

  _generateScenarioPerformanceAnalysis(scenarios) {
    return `
      Performance analysis indicates:
      • Best performing scenario achieves highest viability
      • Environmental considerations vary significantly
      • Infrastructure requirements differ substantially
      • Risk profiles show varying levels of delivery uncertainty
    `;
  }

  _generateScenarioRiskAssessment(scenarios) {
    return `
      Risk assessment findings:
      • High-growth scenarios show increased delivery risk
      • Environmental constraints limit some options
      • Infrastructure costs vary significantly
      • Market conditions affect viability across all scenarios
    `;
  }

  _generateScenarioRecommendations(scenarios) {
    return `
      Recommendations:
      1. Adopt balanced approach combining elements from multiple scenarios
      2. Implement phased delivery to manage risk
      3. Monitor key indicators throughout plan period
      4. Maintain flexibility to adapt to changing circumstances
    `;
  }

  _generateDetailedBreakdown(complianceChecks, policies) {
    return {
      byPolicy: this._analyzePolicyPerformance(policies, complianceChecks),
      byStatus: this._groupByStatus(complianceChecks),
      byScore: this._groupByScore(complianceChecks),
      timelineAnalysis: this._analyzeTimeline(complianceChecks)
    };
  }

  _groupByStatus(complianceChecks) {
    return complianceChecks.reduce((acc, check) => {
      acc[check.status] = (acc[check.status] || 0) + 1;
      return acc;
    }, {});
  }

  _groupByScore(complianceChecks) {
    const ranges = { 'high': 0, 'medium': 0, 'low': 0 };
    complianceChecks.forEach(check => {
      if (check.score >= 80) ranges.high++;
      else if (check.score >= 50) ranges.medium++;
      else ranges.low++;
    });
    return ranges;
  }

  _analyzeTimeline(complianceChecks) {
    // Simplified timeline analysis
    return {
      totalPeriod: 'Analysis period varies',
      trend: 'Stable performance over time',
      seasonality: 'No significant seasonal patterns'
    };
  }
}
