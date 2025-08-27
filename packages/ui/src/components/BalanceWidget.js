import React, { useState } from 'react';

/*
 * Planner-friendly weighting widget.
 * Props:
 *  considerations: [
 *    { name: 'Heritage', score: -0.55, details?: 'string', id?: 'heritage' }
 *    // score expected in [-1,1]; legacy 'weight' 0-100 also supported
 *  ]
 *  onOverride?: (override) => void  // {name, previousCategory, newCategory, previousScore, newScore, timestamp}
 *  onPhraseChange?: (change) => void // {name, category, previousPhrase, newPhrase}
 *  showTransparencyToggle?: boolean
 */

const CATEGORY_DEFS = [
  { id: 'strong-positive', polarity: 'positive', min: 0.7, max: 1.01, traffic: '🟢', label: 'Strong Positive', phrases: ['Very substantial benefits', 'Considerable weight attaches to…'] },
  { id: 'moderate-positive', polarity: 'positive', min: 0.3, max: 0.7, traffic: '🟢', label: 'Moderate Positive', phrases: ['Moderate benefits', 'Significant weight should be afforded'] },
  { id: 'slight-positive', polarity: 'positive', min: 0.0000001, max: 0.3, traffic: '🟡', label: 'Slight Positive', phrases: ['Limited benefits', 'Some weight in favour'] },
  { id: 'neutral', polarity: 'neutral', min: -0.0000001, max: 0.0000001, traffic: '⚪', label: 'Neutral', phrases: ['Neutral', 'Little weight either way'] },
  { id: 'slight-harm', polarity: 'negative', min: -0.3, max: -0.0000001, traffic: '🟡', label: 'Slight Harm', phrases: ['Limited adverse impacts', 'Some harm identified'] },
  { id: 'moderate-harm', polarity: 'negative', min: -0.7, max: -0.3, traffic: '🔴', label: 'Moderate Harm', phrases: ['Significant harm', 'Considerable weight against'] },
  { id: 'strong-harm', polarity: 'negative', min: -1.01, max: -0.7, traffic: '🔴', label: 'Strong Harm', phrases: ['Substantial harm', 'Great weight must be given'] }
];

function scoreToCategory(score) {
  const s = Math.max(-1, Math.min(1, typeof score === 'number' ? score : 0));
  return CATEGORY_DEFS.find(c => s >= c.min && s < c.max) || CATEGORY_DEFS[3]; // default neutral
}

function categoryMidScore(cat) {
  return (Math.max(cat.min, -1) + Math.min(cat.max, 1)) / 2;
}

const BalanceWidget = ({
  considerations,
  onOverride = () => {},
  onPhraseChange = () => {},
  showTransparencyToggle = true,
  layout = 'stack' // 'stack' | 'grid'
}) => {
  // Normalize incoming considerations to internal state objects
  const initial = considerations.map(c => {
    let score = c.score;
    if (score === undefined && typeof c.weight === 'number') {
      // Legacy conversion: 0-100 -> -1..1 with 50 as neutral
      score = (c.weight - 50) / 50;
    }
    if (typeof score !== 'number' || Number.isNaN(score)) score = 0;
    const cat = scoreToCategory(score);
    return {
      ...c,
      score,
      category: cat.id,
      phrase: cat.phrases[0],
      overridden: false
    };
  });
  const [items, setItems] = useState(initial);
  const [transparencyOpen, setTransparencyOpen] = useState(false);
  const [openEditor, setOpenEditor] = useState(null); // index of row being edited

  const handleCategoryChange = (index, newCategoryId) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== index) return it;
      const prevCat = CATEGORY_DEFS.find(c => c.id === it.category);
      const newCat = CATEGORY_DEFS.find(c => c.id === newCategoryId) || prevCat;
      if (!newCat) return it;
      const newScore = categoryMidScore(newCat);
      onOverride({
        name: it.name,
        previousCategory: prevCat.id,
        newCategory: newCat.id,
        previousScore: it.score,
        newScore,
        timestamp: Date.now()
      });
      return {
        ...it,
        category: newCat.id,
        score: newScore,
        phrase: newCat.phrases[0],
        overridden: true
      };
    }));
    setOpenEditor(null);
  };

  const cyclePhrase = (index) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== index) return it;
      const cat = CATEGORY_DEFS.find(c => c.id === it.category);
      if (!cat) return it;
      const phrases = cat.phrases;
      const currentIdx = phrases.indexOf(it.phrase);
      const nextPhrase = phrases[(currentIdx + 1) % phrases.length];
      onPhraseChange({ name: it.name, category: cat.id, previousPhrase: it.phrase, newPhrase: nextPhrase });
      return { ...it, phrase: nextPhrase, overridden: true };
    }));
  };

  return (
    <div className="space-y-6">
      {showTransparencyToggle && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900">Material Considerations</h3>
          <button
            type="button"
            onClick={() => setTransparencyOpen(o => !o)}
            className="text-sm text-zinc-600 hover:text-zinc-800 underline transition-colors"
          >
            {transparencyOpen ? 'Hide technical details' : 'Show technical details'}
          </button>
        </div>
      )}
      
      <div className={layout === 'grid' ? 'grid gap-4 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3' : 'space-y-4'}>
        {items.map((item, index) => {
          const cat = CATEGORY_DEFS.find(c => c.id === item.category) || scoreToCategory(item.score);
          const relatedCats = CATEGORY_DEFS.filter(c => Math.abs(cat.min - c.min) < 1.5); // Show nearby categories
          
          return (
            <div key={item.name} className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-base font-semibold text-zinc-900 mb-1">{item.name}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl" aria-hidden="true">{cat.traffic}</span>
                      <div>
                        <div className={`text-sm font-medium ${
                          cat.polarity === 'positive' ? 'text-emerald-700' :
                          cat.polarity === 'negative' ? 'text-red-700' : 'text-zinc-700'
                        }`}>
                          {cat.label}
                        </div>
                        {item.confidence && (
                          <div className="text-xs text-zinc-500">
                            {(item.confidence * 100).toFixed(0)}% confidence
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Quick Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setOpenEditor(openEditor === index ? null : index)}
                      className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
                      title="Adjust weighting"
                    >
                      ⚙️
                    </button>
                    <button
                      type="button"
                      onClick={() => cyclePhrase(index)}
                      className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
                      title="Change phrasing"
                    >
                      🔄
                    </button>
                  </div>
                </div>
                
                {/* Current Assessment */}
                <div className="bg-zinc-50 rounded-lg p-3">
                  <button
                    type="button"
                    onClick={() => cyclePhrase(index)}
                    className="text-left w-full hover:bg-zinc-100 rounded p-1 transition-colors"
                  >
                    <div className="text-sm font-medium text-zinc-800 mb-1">Current Assessment:</div>
                    <div className="text-sm text-zinc-700 leading-relaxed">
                      "{item.phrase}"
                      {item.overridden && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                          Modified
                        </span>
                      )}
                    </div>
                  </button>
                </div>
                
                {/* Evidence/Details */}
                {item.details && (
                  <div className="text-sm text-zinc-600 bg-blue-50 rounded-lg p-3">
                    <div className="font-medium text-blue-900 mb-1">Evidence:</div>
                    <div className="leading-relaxed">{item.details}</div>
                  </div>
                )}
                
                {/* Adjustment Panel */}
                {openEditor === index && (
                  <div className="border-t border-zinc-200 pt-4 mt-4 space-y-3">
                    <div className="text-sm font-medium text-zinc-700 mb-2">Adjust Planning Weight:</div>
                    <div className="grid grid-cols-2 gap-2">
                      {relatedCats.map(rc => (
                        <button
                          key={rc.id}
                          type="button"
                          onClick={() => handleCategoryChange(index, rc.id)}
                          className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
                            rc.id === cat.id 
                              ? 'bg-blue-600 text-white border-blue-600' 
                              : 'bg-white hover:bg-zinc-50 text-zinc-700 border-zinc-300'
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            <span>{rc.traffic}</span>
                            <span className="font-medium">{rc.label.split(' ')[0]}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpenEditor(null)}
                      className="w-full text-xs text-zinc-500 hover:text-zinc-700 py-2 transition-colors"
                    >
                      Done editing
                    </button>
                  </div>
                )}
                
                {/* Technical Details */}
                {transparencyOpen && (
                  <div className="border-t border-zinc-200 pt-3 mt-3">
                    <div className="text-xs text-zinc-500 space-y-1">
                      <div className="flex justify-between">
                        <span>Numeric score:</span>
                        <span className="font-mono">{item.score.toFixed(3)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Category ID:</span>
                        <span className="font-mono">{cat.id}</span>
                      </div>
                      {item.confidence && (
                        <div className="flex justify-between">
                          <span>AI confidence:</span>
                          <span className="font-mono">{(item.confidence * 100).toFixed(1)}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BalanceWidget;