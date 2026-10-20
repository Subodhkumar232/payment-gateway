import React from 'react';

export default function TopBar() {
  return (
    <header className="sticky top-0 z-[99] bg-white/85 dark:bg-[#070a12]/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-2.5 flex items-center justify-between gap-4">
      {/* Sub-Navigation Pills (Dynamically populated by admin.js based on active section) */}
      <nav className="sub-nav-bar flex items-center gap-2 overflow-x-auto py-0.5" id="subNavBar">
        {/* Dynamic sub-view pills injected here */}
      </nav>
    </header>
  );
}
