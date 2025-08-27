import Head from 'next/head';

export default function Tasks() {
  const tasks = [
    {
      title: "Add sample planning policies",
      description: "Help expand our policy database with examples from different local authorities",
      difficulty: "Beginner",
      type: "Data"
    },
    {
      title: "Improve spatial analysis accuracy",
      description: "Enhance the geospatial calculations for site constraints and proximities",
      difficulty: "Intermediate",
      type: "Code"
    },
    {
      title: "Design the export templates",
      description: "Create better PDF and Markdown templates for officer reports",
      difficulty: "Beginner",
      type: "Design"
    },
    {
      title: "Build precedent search functionality",
      description: "Implement search and filtering for planning appeal decisions",
      difficulty: "Advanced",
      type: "Code"
    }
  ];

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'Beginner': return 'bg-green-100 text-green-800';
      case 'Intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'Advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'Code': return 'bg-blue-100 text-blue-800';
      case 'Design': return 'bg-purple-100 text-purple-800';
      case 'Data': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div>
      <Head>
        <title>Open Tasks - TPA</title>
        <meta name="description" content="Small, well-defined tasks to contribute to The Planner's Assistant" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-h1 font-h1 mb-8">
            Open Tasks
          </h1>
          
          <p className="text-lg text-zinc-700 mb-8">
            Small, well-defined tasks you can pick up right now. Perfect for getting started 
            with contributing to The Planner's Assistant.
          </p>

          <div className="grid gap-6">
            {tasks.map((task, index) => (
              <div key={index} className="border border-zinc-200 rounded-lg p-6 hover:border-zinc-300 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-xl font-semibold text-zinc-900">{task.title}</h3>
                  <div className="flex gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(task.difficulty)}`}>
                      {task.difficulty}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(task.type)}`}>
                      {task.type}
                    </span>
                  </div>
                </div>
                <p className="text-zinc-700 mb-4">{task.description}</p>
                <button className="bg-amber-500 text-black px-4 py-2 rounded-md hover:bg-amber-400 font-medium">
                  Get Started
                </button>
              </div>
            ))}
          </div>

          <div className="mt-12 bg-zinc-50 border border-zinc-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-zinc-900 mb-3">Ready to contribute?</h2>
            <p className="text-zinc-700 mb-4">
              Join our community and help build planning tools that work for everyone.
            </p>
            <div className="flex gap-3">
              <a 
                href="mailto:hello@theplannersassistant.uk"
                className="bg-zinc-900 text-white px-4 py-2 rounded-md hover:bg-zinc-800"
              >
                Get in touch
              </a>
              <a 
                href="/contribute/spec"
                className="border border-zinc-300 text-zinc-900 px-4 py-2 rounded-md hover:bg-white"
              >
                Read the full spec
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
