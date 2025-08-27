import Head from 'next/head';
import { useEffect, useState } from 'react';
import BalanceWidget from '@tpa/ui/src/components/BalanceWidget';
import ExportButton from '@tpa/ui/src/components/ExportButton';
import Agent from '@tpa/core/src/agent.js';

export default function DevelopmentManagement() {
  const [agent, setAgent] = useState(null);
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const apiKey = localStorage.getItem('gemini_api_key');
    setAgent(new Agent(apiKey));
  }, []);

  const considerations = [
    { name: 'Heritage', weight: 50 },
    { name: 'Housing Delivery', weight: 70 },
    { name: 'Economic Growth', weight: 60 },
    { name: 'Sustainability', weight: 80 },
  ];

  const handleWeightChange = (name, value) => {
    console.log(`Consideration '${name}' weight changed to: ${value}`);
  };

  const handleQuery = async () => {
    if (agent) {
      setLoading(true);
      const res = await agent.run(query);
      setResponse(res);
      setLoading(false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && agent) {
      agent.loadPdf(file);
    }
  };

  const draftReport = `
# Draft Officer Report

${response}
`;

  return (
    <div>
      <Head>
        <title>Development Management Tool - TPA</title>
        <meta name="description" content="Upload planning documents and generate draft officer reports" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-h1 font-h1">
            Development Management Assessment
          </h1>
          <ExportButton content={draftReport} fileName="draft-report" />
        </div>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <h2 className="text-h2 font-h2 mb-4">Upload PDF</h2>
            <input type="file" onChange={handleFileUpload} className="mb-4" />
            <h2 className="text-h2 font-h2 mb-4">Query</h2>
            <div className="flex items-center mb-4">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
                placeholder="Ask about the application..."
              />
              <button onClick={handleQuery} className="ml-4 bg-accent text-white font-bold py-2 px-4 rounded">
                {loading ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  'Run'
                )}
              </button>
            </div>
            <h2 className="text-h2 font-h2 mb-4">Response</h2>
            <div className="p-4 border rounded-lg bg-white shadow-sm prose">
              {response || "Upload documents and ask a question to get started."}
            </div>
          </div>
          <div>
            <BalanceWidget considerations={considerations} onWeightChange={handleWeightChange} />
          </div>
        </div>
      </main>
    </div>
  );
}
