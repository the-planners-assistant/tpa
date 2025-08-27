import React from 'react';
import Link from 'next/link';

const Layout = ({ children }) => {
  return (
    <div>
      <header className="bg-gray-800 text-white p-4">
        <nav className="flex items-center justify-between">
          <Link href="/">
            <a className="text-xl font-bold">The Planner's Assistant</a>
          </Link>
          <Link href="/settings">
            <a className="text-sm">Settings</a>
          </Link>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
};

export default Layout;
