import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Save, 
  Copy, 
  BarChart3, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Loader,
  Settings,
  Plus,
  Minus
} from 'lucide-react';

export default function ScenarioBuilder({ 
  planId, 
  scenarioId = null, 
  onScenarioSaved,
  onScenarioRun,
  onError 
}) {
  const [scenario, setScenario] = useState(null);
  const [parameters, setParameters] = useState({
    housing: {
      totalUnits: 1000,
      affordablePercentage: 30,
      densityRange: { min: 20, max: 40 },
      phasing: 5
    },
    employment: {
      totalJobs: 500,
      sectorMix: {
        office: 40,
        industrial: 30,
        retail: 20,
        other: 10
      }
    },
    infrastructure: {
      schools: { primary: 1, secondary: 0.5 },
      healthcare: { gp: 1, hospital: 0.1 },
      transport: { busRoutes: 2, parkingRatio: 1.5 }
    },
    environment: {
      greenSpacePercentage: 15,
      biodiversityNetGain: 10,
      renewableEnergyTarget: 20
    }
  });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState('housing');
  const [hasChanges, setHasChanges] = useState(false);

  // Load existing scenario if editing
  useEffect(() => {
    const loadScenario = async () => {
      if (!scenarioId) return;

      try {
        const ScenarioModeler = (await import('@tpa/core/src/scenario-modeler.js')).default;
        const modeler = new ScenarioModeler();
        const db = (await import('@tpa/core/src/database.js')).getDatabase();
        
        const loadedScenario = await db.scenarios.get(scenarioId);
        if (loadedScenario) {
          setScenario(loadedScenario);
          setName(loadedScenario.name);
          setDescription(loadedScenario.description);
          setParameters(loadedScenario.parameters);
          setResults(loadedScenario.results);
        }
      } catch (error) {
        console.error('Failed to load scenario:', error);
        onError?.('Failed to load scenario');
      }
    };

    loadScenario();
  }, [scenarioId]);

  // Update parameters and mark as changed
  const updateParameters = (section, updates) => {
    setParameters(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        ...updates
      }
    }));
    setHasChanges(true);
  };

  // Save scenario
  const handleSave = async () => {
    if (!name.trim()) {
      onError?.('Please enter a scenario name');
      return;
    }

    try {
      const ScenarioModeler = (await import('@tpa/core/src/scenario-modeler.js')).default;
      const modeler = new ScenarioModeler();

      let savedScenario;
      if (scenarioId) {
        savedScenario = await modeler.updateScenario(scenarioId, {
          name,
          description,
          parameters
        });
      } else {
        savedScenario = await modeler.createScenario(planId, {
          name,
          description,
          parameters
        });
      }

      setScenario(savedScenario);
      setHasChanges(false);
      onScenarioSaved?.(savedScenario);
    } catch (error) {
      console.error('Failed to save scenario:', error);
      onError?.('Failed to save scenario');
    }
  };

  // Run scenario modeling
  const handleRun = async () => {
    if (!scenario?.id) {
      onError?.('Please save the scenario before running');
      return;
    }

    setIsRunning(true);
    try {
      const ScenarioModeler = (await import('@tpa/core/src/scenario-modeler.js')).default;
      const modeler = new ScenarioModeler();
      
      const modelResults = await modeler.runScenarioModeling(scenario.id);
      setResults(modelResults);
      onScenarioRun?.(modelResults);
    } catch (error) {
      console.error('Failed to run scenario:', error);
      onError?.('Failed to run scenario modeling');
    } finally {
      setIsRunning(false);
    }
  };

  // Copy scenario
  const handleCopy = async () => {
    try {
      const ScenarioModeler = (await import('@tpa/core/src/scenario-modeler.js')).default;
      const modeler = new ScenarioModeler();
      
      const copiedScenario = await modeler.createScenario(planId, {
        name: `${name} (Copy)`,
        description: `Copy of: ${description}`,
        parameters
      });

      onScenarioSaved?.(copiedScenario);
    } catch (error) {
      console.error('Failed to copy scenario:', error);
      onError?.('Failed to copy scenario');
    }
  };

  const TabButton = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
        activeTab === id
          ? 'bg-blue-100 text-blue-700 border border-blue-200'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );

  const NumberInput = ({ value, onChange, min = 0, max = 1000000, step = 1, suffix = '' }) => (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
      />
      {suffix && <span className="text-sm text-gray-500">{suffix}</span>}
    </div>
  );

  const SliderInput = ({ value, onChange, min = 0, max = 100, step = 1, suffix = '%' }) => (
    <div className="space-y-2">
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
      />
      <div className="text-sm text-gray-600 text-center">
        {value}{suffix}
      </div>
    </div>
  );

  const HousingTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Total Housing Units
          </label>
          <NumberInput
            value={parameters.housing.totalUnits}
            onChange={(value) => updateParameters('housing', { totalUnits: value })}
            min={1}
            max={10000}
            suffix="units"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Delivery Timeline
          </label>
          <NumberInput
            value={parameters.housing.phasing}
            onChange={(value) => updateParameters('housing', { phasing: value })}
            min={1}
            max={20}
            suffix="years"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Affordable Housing Percentage
          </label>
          <SliderInput
            value={parameters.housing.affordablePercentage}
            onChange={(value) => updateParameters('housing', { affordablePercentage: value })}
            min={0}
            max={50}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Density Range (units/hectare)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Min</label>
              <NumberInput
                value={parameters.housing.densityRange.min}
                onChange={(value) => updateParameters('housing', { 
                  densityRange: { ...parameters.housing.densityRange, min: value }
                })}
                min={5}
                max={100}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Max</label>
              <NumberInput
                value={parameters.housing.densityRange.max}
                onChange={(value) => updateParameters('housing', { 
                  densityRange: { ...parameters.housing.densityRange, max: value }
                })}
                min={5}
                max={100}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const EmploymentTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Total Jobs
          </label>
          <NumberInput
            value={parameters.employment.totalJobs}
            onChange={(value) => updateParameters('employment', { totalJobs: value })}
            min={0}
            max={10000}
            suffix="jobs"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-4">
            Employment Sector Mix
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(parameters.employment.sectorMix).map(([sector, percentage]) => (
              <div key={sector}>
                <label className="block text-sm text-gray-600 mb-2 capitalize">
                  {sector}
                </label>
                <SliderInput
                  value={percentage}
                  onChange={(value) => updateParameters('employment', {
                    sectorMix: { ...parameters.employment.sectorMix, [sector]: value }
                  })}
                  min={0}
                  max={100}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 text-sm text-gray-500">
            Total: {Object.values(parameters.employment.sectorMix).reduce((sum, val) => sum + val, 0)}%
          </div>
        </div>
      </div>
    </div>
  );

  const InfrastructureTab = () => (
    <div className="space-y-6">
      <div>
        <h4 className="text-lg font-medium text-gray-900 mb-4">Education</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Primary Schools
            </label>
            <NumberInput
              value={parameters.infrastructure.schools.primary}
              onChange={(value) => updateParameters('infrastructure', {
                schools: { ...parameters.infrastructure.schools, primary: value }
              })}
              min={0}
              max={10}
              step={0.5}
              suffix="schools"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Secondary Schools
            </label>
            <NumberInput
              value={parameters.infrastructure.schools.secondary}
              onChange={(value) => updateParameters('infrastructure', {
                schools: { ...parameters.infrastructure.schools, secondary: value }
              })}
              min={0}
              max={5}
              step={0.1}
              suffix="schools"
            />
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-lg font-medium text-gray-900 mb-4">Healthcare</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              GP Surgeries
            </label>
            <NumberInput
              value={parameters.infrastructure.healthcare.gp}
              onChange={(value) => updateParameters('infrastructure', {
                healthcare: { ...parameters.infrastructure.healthcare, gp: value }
              })}
              min={0}
              max={10}
              step={0.1}
              suffix="surgeries"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hospital Provision
            </label>
            <NumberInput
              value={parameters.infrastructure.healthcare.hospital}
              onChange={(value) => updateParameters('infrastructure', {
                healthcare: { ...parameters.infrastructure.healthcare, hospital: value }
              })}
              min={0}
              max={2}
              step={0.1}
              suffix="hospitals"
            />
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-lg font-medium text-gray-900 mb-4">Transport</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bus Routes
            </label>
            <NumberInput
              value={parameters.infrastructure.transport.busRoutes}
              onChange={(value) => updateParameters('infrastructure', {
                transport: { ...parameters.infrastructure.transport, busRoutes: value }
              })}
              min={0}
              max={20}
              suffix="routes"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Parking Ratio (spaces per unit)
            </label>
            <NumberInput
              value={parameters.infrastructure.transport.parkingRatio}
              onChange={(value) => updateParameters('infrastructure', {
                transport: { ...parameters.infrastructure.transport, parkingRatio: value }
              })}
              min={0}
              max={3}
              step={0.1}
              suffix="spaces/unit"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const EnvironmentTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Green Space Percentage
          </label>
          <SliderInput
            value={parameters.environment.greenSpacePercentage}
            onChange={(value) => updateParameters('environment', { greenSpacePercentage: value })}
            min={0}
            max={50}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Biodiversity Net Gain
          </label>
          <SliderInput
            value={parameters.environment.biodiversityNetGain}
            onChange={(value) => updateParameters('environment', { biodiversityNetGain: value })}
            min={0}
            max={50}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Renewable Energy Target
          </label>
          <SliderInput
            value={parameters.environment.renewableEnergyTarget}
            onChange={(value) => updateParameters('environment', { renewableEnergyTarget: value })}
            min={0}
            max={100}
          />
        </div>
      </div>
    </div>
  );

  const ResultsPanel = () => {
    if (!results) return null;

    return (
      <div className="border-t border-gray-200 pt-6 mt-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-green-600" />
          <h3 className="text-lg font-medium text-gray-900">Scenario Results</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-blue-600">Overall Score</div>
            <div className="text-2xl font-bold text-blue-900">
              {results.summary.successProbability}%
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-green-600">Viability</div>
            <div className="text-lg font-semibold text-green-900 capitalize">
              {results.viability.viabilityStatus}
            </div>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-yellow-600">Risk Level</div>
            <div className="text-lg font-semibold text-yellow-900 capitalize">
              {results.summary.riskLevel}
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-purple-600">Timeline</div>
            <div className="text-lg font-semibold text-purple-900">
              {results.timeline.totalDuration} years
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Key Metrics</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Housing Units:</span>
                <span className="font-medium">{results.housing.totalUnits.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Jobs Created:</span>
                <span className="font-medium">{results.employment.totalJobs.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Infrastructure Cost:</span>
                <span className="font-medium">£{(results.infrastructure.costs.total / 1000000).toFixed(1)}M</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Viability Gap:</span>
                <span className={`font-medium ${results.viability.viabilityGap > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  £{Math.abs(results.viability.viabilityGap / 1000000).toFixed(1)}M
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-3">Key Risks</h4>
            <div className="space-y-2">
              {results.risks.slice(0, 3).map((risk, index) => (
                <div key={index} className="flex items-start gap-2">
                  <AlertTriangle className={`h-4 w-4 mt-0.5 ${
                    risk.level === 'high' ? 'text-red-500' : 
                    risk.level === 'medium' ? 'text-yellow-500' : 'text-green-500'
                  }`} />
                  <div className="text-sm">
                    <div className="font-medium">{risk.description}</div>
                    <div className="text-gray-600">{risk.impact}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {results.summary.recommendations && results.summary.recommendations.length > 0 && (
          <div className="mt-6">
            <h4 className="font-medium text-gray-900 mb-3">Recommendations</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
              {results.summary.recommendations.map((rec, index) => (
                <li key={index}>{rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setHasChanges(true);
              }}
              placeholder="Enter scenario name..."
              className="block w-full max-w-md px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-lg font-medium"
            />
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setHasChanges(true);
              }}
              placeholder="Enter scenario description..."
              rows={2}
              className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          <div className="flex items-center gap-2 ml-4">
            {hasChanges && (
              <span className="text-sm text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                Unsaved changes
              </span>
            )}

            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              Save
            </button>

            {scenario && (
              <>
                <button
                  onClick={handleRun}
                  disabled={isRunning || hasChanges}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {isRunning ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Run Model
                </button>

                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Parameter Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-1">
          <TabButton id="housing" label="Housing" icon={Settings} />
          <TabButton id="employment" label="Employment" icon={TrendingUp} />
          <TabButton id="infrastructure" label="Infrastructure" icon={Settings} />
          <TabButton id="environment" label="Environment" icon={Settings} />
        </nav>
      </div>

      {/* Parameter Content */}
      <div className="mb-6">
        {activeTab === 'housing' && <HousingTab />}
        {activeTab === 'employment' && <EmploymentTab />}
        {activeTab === 'infrastructure' && <InfrastructureTab />}
        {activeTab === 'environment' && <EnvironmentTab />}
      </div>

      {/* Results */}
      <ResultsPanel />

      {/* Loading Overlay */}
      {isRunning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="flex items-center gap-3">
              <Loader className="h-6 w-6 animate-spin text-blue-600" />
              <div>
                <div className="font-medium">Running Scenario Model</div>
                <div className="text-sm text-gray-600">This may take a few moments...</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
