import React from 'react';
import Link from 'next/link';

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 shadow-sm">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">TPA</span>
              </div>
              <span className="text-xl font-semibold text-slate-900">
                The Planner's Assistant
              </span>
            </Link>
            
            <div className="flex items-center space-x-4">
              <Link 
                href="/tool/development-management" 
                className="text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-2 rounded-md hover:bg-slate-100 transition-colors"
              >
                Development Tool
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
