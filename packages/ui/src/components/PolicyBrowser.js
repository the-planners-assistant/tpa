import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, ChevronDown, ChevronRight, FileText, Link, Tag, AlertCircle } from 'lucide-react';

const PolicyBrowser = ({ 
  planId, 
  onPolicySelect, 
  onPolicyEdit,
  showReferences = true,
  showHierarchy = true 
}) => {
  const [policies, setPolicies] = useState([]);
  const [references, setReferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedPolicies, setExpandedPolicies] = useState(new Set());
  const [viewMode, setViewMode] = useState('list'); // 'list', 'hierarchy', 'category'
  const [selectedPolicy, setSelectedPolicy] = useState(null);

  // Load policies and references
  useEffect(() => {
    if (!planId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        
        const LocalPlanManager = (await import('@tpa/core/src/local-plan-manager.js')).default;
        const PolicyEngine = (await import('@tpa/core/src/policy-engine.js')).default;
        
        const planManager = new LocalPlanManager();
        const policyEngine = new PolicyEngine();

        const [policiesData, hierarchy] = await Promise.all([
          planManager.getPolicies(planId),
          planManager.getPolicyHierarchy(planId)
        ]);

        setPolicies(policiesData);

        // Load references if enabled
        if (showReferences) {
          const allReferences = [];
          for (const policy of policiesData) {
            try {
              const refs = await policyEngine.getPolicyReferences(policy.id);
              allReferences.push(...refs.outgoing, ...refs.incoming);
            } catch (error) {
              console.warn(`Failed to load references for policy ${policy.id}:`, error);
            }
          }
          setReferences(allReferences);
        }

      } catch (error) {
        console.error('Failed to load policies:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [planId, showReferences]);

  // Filter and search policies
  const filteredPolicies = useMemo(() => {
    let filtered = policies;

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(policy => policy.category === selectedCategory);
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(policy =>
        policy.title.toLowerCase().includes(searchLower) ||
        policy.policyRef.toLowerCase().includes(searchLower) ||
        policy.content.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [policies, selectedCategory, searchTerm]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = [...new Set(policies.map(p => p.category))].sort();
    return [{ value: 'all', label: 'All Categories', count: policies.length }]
      .concat(cats.map(cat => ({
        value: cat,
        label: cat.charAt(0).toUpperCase() + cat.slice(1),
        count: policies.filter(p => p.category === cat).length
      })));
  }, [policies]);

  // Group policies by category for category view
  const policiesByCategory = useMemo(() => {
    const grouped = {};
    filteredPolicies.forEach(policy => {
      if (!grouped[policy.category]) {
        grouped[policy.category] = [];
      }
      grouped[policy.category].push(policy);
    });
    return grouped;
  }, [filteredPolicies]);

  // Build hierarchy tree
  const hierarchyTree = useMemo(() => {
    if (!showHierarchy) return [];
    
    const policyMap = new Map(filteredPolicies.map(p => [p.id, { ...p, children: [] }]));
    const rootPolicies = [];

    filteredPolicies.forEach(policy => {
      const policyNode = policyMap.get(policy.id);
      if (policy.parentPolicy && policyMap.has(policy.parentPolicy)) {
        policyMap.get(policy.parentPolicy).children.push(policyNode);
      } else {
        rootPolicies.push(policyNode);
      }
    });

    return rootPolicies;
  }, [filteredPolicies, showHierarchy]);

  // Get policy references
  const getPolicyReferences = (policyId) => {
    return references.filter(ref => 
      ref.sourcePolicy === policyId || ref.targetPolicy === policyId
    );
  };

  // Toggle policy expansion
  const toggleExpanded = (policyId) => {
    setExpandedPolicies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(policyId)) {
        newSet.delete(policyId);
      } else {
        newSet.add(policyId);
      }
      return newSet;
    });
  };

  // Handle policy selection
  const handlePolicySelect = (policy) => {
    setSelectedPolicy(policy);
    onPolicySelect?.(policy);
  };

  // Render policy item
  const renderPolicyItem = (policy, level = 0) => {
    const isExpanded = expandedPolicies.has(policy.id);
    const policyRefs = getPolicyReferences(policy.id);
    const hasChildren = policy.children && policy.children.length > 0;
    const isSelected = selectedPolicy?.id === policy.id;

    return (
      <div key={policy.id} className="policy-item" style={{ marginLeft: `${level * 20}px` }}>
        <div
          className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
            isSelected 
              ? 'bg-blue-50 border-blue-200' 
              : 'bg-white border-gray-200 hover:bg-gray-50'
          }`}
          onClick={() => handlePolicySelect(policy)}
        >
          <div className="flex items-center space-x-3 flex-1">
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpanded(policy.id);
                }}
                className="p-1 hover:bg-gray-200 rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            )}
            
            <FileText className="h-5 w-5 text-gray-400" />
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-gray-900">{policy.policyRef}</span>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                  {policy.category}
                </span>
              </div>
              <p className="text-sm text-gray-600 truncate">{policy.title}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {policyRefs.length > 0 && (
              <span className="inline-flex items-center text-xs text-gray-500">
                <Link className="h-3 w-3 mr-1" />
                {policyRefs.length}
              </span>
            )}
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPolicyEdit?.(policy);
              }}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
              title="Edit policy"
            >
              <Tag className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Policy details when expanded */}
        {isExpanded && (
          <div className="mt-2 ml-8 p-3 bg-gray-50 rounded-lg">
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-gray-700">Content:</span>
                <p className="text-gray-600 mt-1 line-clamp-3">{policy.content}</p>
              </div>
              
              {policyRefs.length > 0 && (
                <div>
                  <span className="font-medium text-gray-700">References:</span>
                  <div className="mt-1 space-y-1">
                    {policyRefs.slice(0, 3).map(ref => (
                      <div key={ref.id} className="flex items-center text-xs text-gray-500">
                        <Link className="h-3 w-3 mr-1" />
                        <span>{ref.relationship}</span>
                        <span className="mx-1">•</span>
                        <span>{ref.context || 'No context'}</span>
                      </div>
                    ))}
                    {policyRefs.length > 3 && (
                      <span className="text-xs text-gray-400">
                        +{policyRefs.length - 3} more references
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Child policies */}
        {hasChildren && isExpanded && (
          <div className="mt-2">
            {policy.children.map(child => renderPolicyItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // Render policies by view mode
  const renderPolicies = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (filteredPolicies.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No policies found</p>
          {searchTerm && (
            <p className="text-sm">Try adjusting your search or filters</p>
          )}
        </div>
      );
    }

    switch (viewMode) {
      case 'hierarchy':
        return (
          <div className="space-y-2">
            {hierarchyTree.map(policy => renderPolicyItem(policy))}
          </div>
        );

      case 'category':
        return (
          <div className="space-y-6">
            {Object.entries(policiesByCategory).map(([category, categoryPolicies]) => (
              <div key={category}>
                <h4 className="text-lg font-medium text-gray-900 mb-3 capitalize">
                  {category} ({categoryPolicies.length})
                </h4>
                <div className="space-y-2">
                  {categoryPolicies.map(policy => renderPolicyItem(policy))}
                </div>
              </div>
            ))}
          </div>
        );

      default: // list
        return (
          <div className="space-y-2">
            {filteredPolicies.map(policy => renderPolicyItem(policy))}
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          Policy Browser
        </h3>
        
        <div className="flex items-center space-x-2">
          {/* View mode selector */}
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="list">List View</option>
            {showHierarchy && <option value="hierarchy">Hierarchy</option>}
            <option value="category">By Category</option>
          </select>
        </div>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search policies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Category filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
          >
            {categories.map(cat => (
              <option key={cat.value} value={cat.value}>
                {cat.label} ({cat.count})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results summary */}
      <div className="text-sm text-gray-600">
        Showing {filteredPolicies.length} of {policies.length} policies
        {searchTerm && ` matching "${searchTerm}"`}
        {selectedCategory !== 'all' && ` in ${selectedCategory}`}
      </div>

      {/* Policy list */}
      <div className="max-h-96 overflow-y-auto">
        {renderPolicies()}
      </div>
    </div>
  );
};

export default PolicyBrowser;
