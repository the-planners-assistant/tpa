import Head from 'next/head';

export default function Spec() {
  return (
    <div>
      <Head>
        <title>Design Brief - TPA</title>
        <meta name="description" content="The complete technical and design specification for The Planner's Assistant" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-h1 font-h1 mb-8">
            Design Brief
          </h1>
          
          <div className="prose prose-zinc max-w-none">
            <p className="text-lg text-zinc-700 mb-8">
              The complete technical and design specification for The Planner's Assistant.
              This document outlines the architecture, user experience, and implementation details.
            </p>

            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-6 mb-8">
              <h2 className="text-xl font-semibold text-zinc-900 mb-3">Quick Links</h2>
              <ul className="space-y-2">
                <li><a href="#architecture" className="text-amber-600 hover:text-amber-700">Technical Architecture</a></li>
                <li><a href="#ux-flows" className="text-amber-600 hover:text-amber-700">UX Flows</a></li>
                <li><a href="#visual-design" className="text-amber-600 hover:text-amber-700">Visual Design System</a></li>
                <li><a href="#roadmap" className="text-amber-600 hover:text-amber-700">Development Roadmap</a></li>
              </ul>
            </div>

            <section id="architecture" className="mb-12">
              <h2 className="text-2xl font-bold text-zinc-900 mb-4">Technical Architecture</h2>
              <p className="text-zinc-700 mb-4">
                TPA is built as a monorepo with multiple packages and applications:
              </p>
              <ul className="list-disc pl-6 text-zinc-700 space-y-2">
                <li><strong>apps/web:</strong> Next.js application for the public website and demo</li>
                <li><strong>apps/lab:</strong> Experimental playground for testing new features</li>
                <li><strong>packages/ui:</strong> Shared UI components built with shadcn/ui and Tailwind</li>
                <li><strong>packages/core:</strong> Domain models, database schema, and retrieval logic</li>
                <li><strong>packages/nlp:</strong> ONNX and transformers.js for embedding and reranking</li>
                <li><strong>packages/map:</strong> MapLibre components and spatial analysis</li>
              </ul>
            </section>

            <section id="ux-flows" className="mb-12">
              <h2 className="text-2xl font-bold text-zinc-900 mb-4">UX Flows</h2>
              <p className="text-zinc-700 mb-4">
                The application is designed around two primary workflows:
              </p>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="border border-zinc-200 rounded-lg p-4">
                  <h3 className="font-semibold text-zinc-900 mb-2">Development Management</h3>
                  <p className="text-zinc-700 text-sm">
                    Upload planning documents, run automated checks, and generate draft officer reports
                    with full evidence traceability.
                  </p>
                </div>
                <div className="border border-zinc-200 rounded-lg p-4">
                  <h3 className="font-semibold text-zinc-900 mb-2">Local Plan Explorer</h3>
                  <p className="text-zinc-700 text-sm">
                    Import policies and site allocations, visualize constraints and capacity,
                    identify policy gaps and conflicts.
                  </p>
                </div>
              </div>
            </section>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-zinc-900 mb-3">Implementation Status</h2>
              <p className="text-zinc-700 mb-4">
                This specification is currently being implemented. The homepage and basic structure
                are in place, with core functionality being developed according to the roadmap.
              </p>
              <a 
                href="/contribute/tasks"
                className="inline-flex items-center gap-2 bg-amber-500 text-black px-4 py-2 rounded-md hover:bg-amber-400 font-medium"
              >
                See what you can help with
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
