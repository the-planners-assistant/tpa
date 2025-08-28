import React from 'react';
import Link from 'next/link';

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 shadow-sm">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center space-x-3" aria-label="The Planner's Assistant home">
              <svg
                className="h-8 w-8"
                viewBox="0 0 100 85"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                focusable="false"
              >
                <title>TPA Logo</title>
                <path d="M 50 80 C 35 70, 15 55, 15 35 A 35 35 0 1 1 85 35 C 85 55, 65 70, 50 80 Z" fill="#1C2C4C" />
                <g transform="translate(0, -15)" stroke="#FFD100" strokeWidth="4" fill="none">
                  <path d="M 37.3 37.3 A 18 18 0 0 1 62.7 37.3" />
                  <path d="M 62.7 37.3 A 18 18 0 0 1 62.7 62.7" />
                  <path d="M 62.7 62.7 A 18 18 0 0 1 37.3 62.7" />
                  <path d="M 37.3 62.7 A 18 18 0 0 1 37.3 37.3" />
                </g>
                <g transform="translate(0,-15)" fill="#FFD100">
                  <polygon points="50,22 53,50 47,50" />
                  <polygon points="50,78 53,50 47,50" />
                  <polygon points="76,50 50,52.5 50,47.5" />
                  <polygon points="24,50 50,52.5 50,47.5" />
                  <polygon points="56.4,43.6 54,50 50,46" />
                  <polygon points="56.4,56.4 50,54 54,50" />
                  <polygon points="43.6,56.4 46,50 50,54" />
                  <polygon points="43.6,43.6 50,46 46,50" />
                  <circle cx="50" cy="50" r="3" fill="#1C2C4C"></circle>
                </g>
              </svg>
              <span className="text-xl font-semibold text-slate-900">
                The Planner's Assistant
              </span>
            </Link>
            
            <div className="flex items-center space-x-4">
              <Link 
                href="/tool/development-management" 
                className="text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-2 rounded-md hover:bg-slate-100 transition-colors"
              >
                Development Management
              </Link>
              <Link 
                href="/tool/local-plan" 
                className="text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-2 rounded-md hover:bg-slate-100 transition-colors"
              >
                Local Plan
              </Link>
              <Link 
                href="/settings" 
                className="text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-2 rounded-md hover:bg-slate-100 transition-colors"
              >
                Settings
              </Link>
            </div>
          </div>
        </nav>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      
      <footer className="bg-white/60 backdrop-blur-sm border-t border-slate-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-slate-500">
            <p>The Planner's Assistant - Supporting evidence-based planning decisions</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
