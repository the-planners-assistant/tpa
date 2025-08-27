import Head from 'next/head';

export default function RunLocally() {
  return (
    <div>
      <Head>
        <title>Run Locally - TPA</title>
        <meta name="description" content="Clone and run The Planner's Assistant on your computer" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-h1 font-h1 mb-8">
            Run TPA Locally
          </h1>
          
          <div className="prose prose-zinc max-w-none">
            <p className="text-lg text-zinc-700 mb-8">
              Get The Planner's Assistant running on your computer for development or testing.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
              <h2 className="text-lg font-semibold text-zinc-900 mb-3">Prerequisites</h2>
              <ul className="list-disc pl-6 text-zinc-700 space-y-1">
                <li>Node.js 18 or later</li>
                <li>npm or yarn</li>
                <li>Git</li>
                <li>Google Gemini API key (optional, for AI features)</li>
              </ul>
            </div>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 mb-4">Quick Start</h2>
              <div className="bg-zinc-900 text-white p-4 rounded-lg font-mono text-sm mb-4">
                <div># Clone the repository</div>
                <div>git clone https://github.com/the-planners-assistant/tpa.git</div>
                <div>cd tpa</div>
                <div></div>
                <div># Install dependencies</div>
                <div>npm install</div>
                <div></div>
                <div># Start the development server</div>
                <div>npm run dev --workspace=web</div>
              </div>
              <p className="text-zinc-700">
                The application will be available at <code>http://localhost:3000</code>
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 mb-4">API Configuration</h2>
              <p className="text-zinc-700 mb-4">
                To use the AI features, you'll need to configure an API key:
              </p>
              <ol className="list-decimal pl-6 text-zinc-700 space-y-2">
                <li>Get a Google Gemini API key from the Google AI Studio</li>
                <li>Navigate to Settings in the local application</li>
                <li>Enter your API key and save</li>
                <li>The key is stored locally in your browser</li>
              </ol>
            </section>

            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-zinc-900 mb-3">Ready to contribute?</h2>
              <p className="text-zinc-700 mb-4">
                Once you have TPA running locally, check out our open tasks and development guides.
              </p>
              <div className="flex gap-3">
                <a 
                  href="/contribute/tasks"
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                >
                  View open tasks
                </a>
                <a 
                  href="/contribute/spec"
                  className="border border-green-300 text-green-800 px-4 py-2 rounded-md hover:bg-green-50"
                >
                  Read the full spec
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
