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
    <div className="p-4 border rounded-lg space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Planning Balance</h3>
        {showTransparencyToggle && (
          <button
            type="button"
            onClick={() => setTransparencyOpen(o => !o)}
            className="text-xs text-zinc-600 hover:text-zinc-800 underline"
          >
            {transparencyOpen ? 'Hide numeric' : 'Show numeric'}
          </button>
        )}
      </div>
  <div className={layout === 'grid' ? 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>
        {items.map((item, index) => {
          const cat = CATEGORY_DEFS.find(c => c.id === item.category) || scoreToCategory(item.score);
          const relatedCats = CATEGORY_DEFS.filter(c => c.polarity === cat.polarity && c.id !== 'neutral');
          return (
    <div key={item.name} className="border rounded-md p-2 bg-white/50 flex flex-col">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-zinc-800">{item.name}</div>
                  <button
                    type="button"
                    onClick={() => setOpenEditor(openEditor === index ? null : index)}
                    className="mt-1 inline-flex items-center gap-2 text-left"
                  >
                    <span className="text-lg" aria-hidden>{cat.traffic}</span>
                    <span className="text-sm font-semibold text-zinc-700">
                      {item.phrase}
                      {item.overridden && <span className="ml-1 text-[10px] uppercase tracking-wide text-amber-600">(edited)</span>}
                    </span>
                    <span className="text-[10px] text-zinc-500 uppercase">edit</span>
                  </button>
                  {item.details && (
                    <div className="mt-1 text-xs text-zinc-600 line-clamp-3">{item.details}</div>
                  )}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => cyclePhrase(index)}
                    className="text-[10px] px-2 py-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
                    title="Cycle phrase variant"
                  >Phrase ↺</button>
                </div>
              </div>
              {openEditor === index && (
                <div className="mt-2 border-t pt-2">
                  <div className="text-[10px] font-semibold text-zinc-500 mb-1">Adjust weighting</div>
                  <div className="flex flex-wrap gap-1">
                    {relatedCats.map(rc => (
                      <button
                        key={rc.id}
                        type="button"
                        onClick={() => handleCategoryChange(index, rc.id)}
                        className={`text-xs px-2 py-1 rounded border ${rc.id === cat.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white hover:bg-zinc-100 text-zinc-700'}`}
                      >
                        {rc.traffic} {rc.label.replace(/ .*/, '')}
                      </button>
                    ))}
                    {cat.polarity !== 'neutral' && (
                      <button
                        type="button"
                        onClick={() => handleCategoryChange(index, 'neutral')}
                        className={`text-xs px-2 py-1 rounded border ${cat.id === 'neutral' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white hover:bg-zinc-100 text-zinc-700'}`}
                      >⚪ Neutral</button>
                    )}
                  </div>
                </div>
              )}
              {transparencyOpen && (
                <div className="mt-2 text-[11px] text-zinc-500 flex items-center justify-between">
                  <span>Internal score: {item.score.toFixed(2)}</span>
                  <span>Category: {cat.label}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BalanceWidget;