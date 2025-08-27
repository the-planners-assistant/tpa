import Head from 'next/head';

export default function About() {
  return (
    <div>
      <Head>
        <title>Why This Exists - TPA</title>
        <meta name="description" content="The academic story, open-source ethos, and guardrails behind The Planner's Assistant" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-h1 font-h1 mb-8">
            Why This Exists
          </h1>
          
          <div className="prose prose-zinc max-w-none">
            <p className="text-lg text-zinc-700 mb-8">
              The academic story, open-source ethos, and guardrails behind The Planner's Assistant.
            </p>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-zinc-900 mb-4">The Problem</h2>
              <p className="text-zinc-700 mb-4">
                Planning decisions affect everyone, but the process is often opaque and inaccessible. 
                Planning officers face mounting pressure with limited resources, while communities 
                struggle to understand how decisions are made.
              </p>
              <p className="text-zinc-700">
                Current planning software is expensive, closed-source, and doesn't help with the 
                reasoning and evidence-gathering that's central to good planning decisions.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-zinc-900 mb-4">Our Approach</h2>
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="border border-zinc-200 rounded-lg p-6">
                  <h3 className="font-semibold text-zinc-900 mb-2">Open by Default</h3>
                  <p className="text-zinc-700 text-sm">
                    All code, data, and methods are open source under AGPLv3. 
                    Anyone can inspect, modify, or run their own version.
                  </p>
                </div>
                <div className="border border-zinc-200 rounded-lg p-6">
                  <h3 className="font-semibold text-zinc-900 mb-2">Evidence-First</h3>
                  <p className="text-zinc-700 text-sm">
                    Every recommendation comes with full citations and sources. 
                    No black box decisions.
                  </p>
                </div>
                <div className="border border-zinc-200 rounded-lg p-6">
                  <h3 className="font-semibold text-zinc-900 mb-2">Academic Rigour</h3>
                  <p className="text-zinc-700 text-sm">
                    Built on research principles, not commercial incentives. 
                    Methods are documented and peer-reviewable.
                  </p>
                </div>
                <div className="border border-zinc-200 rounded-lg p-6">
                  <h3 className="font-semibold text-zinc-900 mb-2">Public Benefit</h3>
                  <p className="text-zinc-700 text-sm">
                    Free to use for public authorities, communities, and researchers. 
                    No vendor lock-in.
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-zinc-900 mb-4">Guardrails</h2>
              <p className="text-zinc-700 mb-4">
                We believe AI can assist planning decisions, but never replace professional judgement. 
                TPA is designed with important limitations:
              </p>
              <ul className="list-disc pl-6 text-zinc-700 space-y-2">
                <li>All outputs are clearly marked as "suggested" or "draft"</li>
                <li>Human oversight is required at every decision point</li>
                <li>Evidence sources are always visible and verifiable</li>
                <li>The tool explains its reasoning in plain English</li>
                <li>Users can adjust weightings and override recommendations</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-bold text-zinc-900 mb-4">Who We Are</h2>
              <p className="text-zinc-700 mb-4">
                TPA is developed by researchers and practitioners who care about making planning 
                more transparent and accessible. We're not a commercial company—we're academics 
                and public servants building tools we wish existed.
              </p>
              <p className="text-zinc-700">
                This project is supported by [University/Institution] and developed in partnership 
                with planning authorities and community groups.
              </p>
            </section>

            <div className="bg-zinc-900 text-white rounded-lg p-8 text-center">
              <h2 className="text-2xl font-bold mb-4">Want to help shape the future of planning?</h2>
              <p className="text-white/90 mb-6">
                Join our community of planners, researchers, and civic technologists.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <a 
                  href="/contribute/tasks"
                  className="bg-amber-500 text-black px-6 py-3 rounded-md hover:bg-amber-400 font-medium"
                >
                  Start contributing
                </a>
                <a 
                  href="mailto:hello@theplannersassistant.uk"
                  className="border border-white/30 text-white px-6 py-3 rounded-md hover:bg-white/10"
                >
                  Get in touch
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
