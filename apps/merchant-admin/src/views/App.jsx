import React from 'react';
import Sidebar from './partials/Sidebar.jsx';
import TopBar from './partials/TopBar.jsx';
import SectionOperations from './partials/SectionOperations.jsx';
import SectionStoreSettings from './partials/SectionStoreSettings.jsx';
import SectionDeveloperHub from './partials/SectionDeveloperHub.jsx';
import SectionSecurity from './partials/SectionSecurity.jsx';
import Modals from './partials/Modals.jsx';

export default function App() {
  return (
    <div className="flex min-h-screen w-full bg-[#f8fafc] dark:bg-[#090d16] text-[#0f172a] dark:text-[#f8fafc]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="p-6 max-w-[1480px] w-full mx-auto flex-1">
          <SectionOperations />
          <SectionStoreSettings />
          <SectionDeveloperHub />
          <SectionSecurity />
        </main>
      </div>
      <Modals />
    </div>
  );
}
