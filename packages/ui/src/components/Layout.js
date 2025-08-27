import React from 'react';
import Link from 'next/link';

const Layout = ({ children }) => {
  return (
    <div>
      <header className="bg-gray-800 text-white p-4">
        <nav className="flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            The Planner's Assistant
          </Link>
          <Link href="/settings" className="text-sm">
            Settings
          </Link>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
};

export default Layout;
