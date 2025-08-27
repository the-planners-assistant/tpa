import Head from 'next/head';

export default function LocalPlan() {
  return (
    <div>
      <Head>
        <title>Local Plan Tool - TPA</title>
        <meta name="description" content="Explore and model local plan scenarios" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-h1 font-h1 mb-8">
            Local Plan Explorer
          </h1>
          
          <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-8 text-center">
            <h2 className="text-2xl font-semibold text-zinc-900 mb-4">Coming Soon</h2>
            <p className="text-zinc-700 mb-6">
              The Local Plan tool will allow you to import policies, evidence base, and site allocations, 
              map capacity and constraints, and generate summaries for topic papers.
            </p>
            <a 
              href="/"
              className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-amber-400"
            >
              Back to Home
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
