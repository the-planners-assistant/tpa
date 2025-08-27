import React, { useState, useEffect } from 'react';

const SettingsPage = () => {
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    const storedApiKey = localStorage.getItem('tpa_google_api_key');
    if (storedApiKey) {
      setApiKey(storedApiKey);
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('tpa_google_api_key', apiKey.trim());
    // Optionally dispatch a custom event so other tabs/pages can react
    window.dispatchEvent(new CustomEvent('tpa_api_key_updated', { detail: { apiKey: apiKey.trim() } }));
  };

  return (
    <div className="p-8">
      <h1 className="text-h1 font-h1 mb-8">Settings</h1>
      <div className="mb-4">
  <label htmlFor="api-key" className="block text-sm font-medium text-gray-700">Google / Gemini API Key</label>
        <input
          type="text"
          id="api-key"
          name="api-key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
        />
      </div>
      <button onClick={handleSave} className="bg-accent text-white font-bold py-2 px-4 rounded">
        Save Key
      </button>
    </div>
  );
};

export default SettingsPage;