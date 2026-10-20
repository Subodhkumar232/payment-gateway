import React from 'react';

export default function Sidebar() {
  return (
    <aside className="w-64 shrink-0 bg-white dark:bg-[#070a12] border-r border-slate-200 dark:border-slate-800 flex flex-col h-screen sticky top-0 z-[1000] select-none transition-colors">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
        <span className="text-2xl drop-shadow-sm">🛡️</span>
        <div className="min-w-0">
          <div className="text-lg font-black tracking-tight text-slate-900 dark:text-white leading-none">
            YOUPI PG
          </div>
          <div className="text-[0.68rem] font-bold text-blue-600 dark:text-blue-400 mt-1 uppercase tracking-wider truncate">
            Merchant &amp; Supervisor
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="p-3 flex flex-col gap-1.5 flex-1 overflow-y-auto">
        <div className="text-[0.68rem] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 py-1.5">
          Navigation
        </div>

        <button
          className="main-nav-btn active w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all text-left [&.active]:bg-blue-600 [&.active]:text-white [&.active]:shadow-md [&.active]:shadow-blue-600/20"
          id="mainNavOperations"
          onClick={(e) => { try { if (typeof window !== 'undefined' && typeof window.switchSection === 'function') { window.switchSection('operations'); } else if (typeof switchSection === 'function') { switchSection('operations'); } } catch (err) { console.error(err); } }}
        >
          <span className="text-base">🏪</span>
          <span className="truncate">Daily Operations</span>
        </button>

        <button
          className="main-nav-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all text-left [&.active]:bg-blue-600 [&.active]:text-white [&.active]:shadow-md [&.active]:shadow-blue-600/20"
          id="mainNavStoreSettings"
          onClick={(e) => { try { if (typeof window !== 'undefined' && typeof window.switchSection === 'function') { window.switchSection('storeSettings'); } else if (typeof switchSection === 'function') { switchSection('storeSettings'); } } catch (err) { console.error(err); } }}
        >
          <span className="text-base">⚙️</span>
          <span className="truncate">Store Settings</span>
        </button>

        <button
          className="main-nav-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all text-left [&.active]:bg-blue-600 [&.active]:text-white [&.active]:shadow-md [&.active]:shadow-blue-600/20"
          id="mainNavDeveloperHub"
          onClick={(e) => { try { if (typeof window !== 'undefined' && typeof window.switchSection === 'function') { window.switchSection('developerHub'); } else if (typeof switchSection === 'function') { switchSection('developerHub'); } } catch (err) { console.error(err); } }}
        >
          <span className="text-base">🛠️</span>
          <span className="truncate">Developer Hub</span>
        </button>

        <button
          className="main-nav-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all text-left [&.active]:bg-blue-600 [&.active]:text-white [&.active]:shadow-md [&.active]:shadow-blue-600/20"
          id="mainNavSecurity"
          onClick={(e) => { try { if (typeof window !== 'undefined' && typeof window.switchSection === 'function') { window.switchSection('security'); } else if (typeof switchSection === 'function') { switchSection('security'); } } catch (err) { console.error(err); } }}
        >
          <span className="text-base">🛡️</span>
          <span className="truncate">Security &amp; Bans</span>
        </button>
      </nav>

      {/* Sidebar Footer Controls & Status Badges */}
      <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2 bg-slate-50/50 dark:bg-slate-950/40">
        {/* Active VPA Display */}
        <div
          className="w-full flex items-center justify-between p-2 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-blue-400 transition-all"
          id="accountVpaDisplay"
          onClick={(e) => { try { if (typeof window !== 'undefined' && typeof window.switchSection === 'function') { window.switchSection('storeSettings', 'subTabVpa'); } else if (typeof switchSection === 'function') { switchSection('storeSettings', 'subTabVpa'); } } catch (err) { console.error(err); } }}
          title="Click to manage VPAs"
        >
          <span className="text-slate-400 text-[0.7rem] uppercase font-extrabold">VPA:</span>
          <span className="text-blue-600 dark:text-blue-400 font-mono text-[0.75rem] truncate max-w-[150px]">Loading...</span>
        </div>

        {/* Store Port 5000 Switch Badge */}
        <div
          className="store-switch-badge is-offline w-full flex items-center justify-between p-2 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer select-none transition-all hover:brightness-105 [&.is-online]:bg-emerald-500/10 [&.is-online]:text-emerald-500 [&.is-online]:border-emerald-500/30 [&.is-offline]:bg-rose-500/10 [&.is-offline]:text-rose-500 [&.is-offline]:border-rose-500/30"
          id="headerStoreBadge"
          onClick={(e) => { try { if (typeof window !== 'undefined' && typeof window.toggleYoupiStore === 'function') { window.toggleYoupiStore(); } else if (typeof toggleYoupiStore === 'function') { toggleYoupiStore(); } } catch (err) { console.error(err); } }}
          title="Click to toggle YOUPI Showcase Store on Port 5000"
        >
          <div className="flex items-center gap-1.5 truncate">
            <span id="headerStoreDot">●</span>
            <span id="headerStoreText" className="truncate">Store: Checking...</span>
          </div>
          <span className="text-[0.68rem] opacity-70">5000</span>
        </div>

        {/* Environment & Theme Row */}
        <div className="flex items-center gap-2">
          {/* Environment Mode */}
          <div
            className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[0.7rem] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer truncate"
            onClick={(e) => { try { if (typeof window !== 'undefined' && typeof window.switchSection === 'function') { window.switchSection('developerHub', 'subViewDevCloudflare'); } else if (typeof switchSection === 'function') { switchSection('developerHub', 'subViewDevCloudflare'); } } catch (err) { console.error(err); } }}
          >
            <span className="text-slate-400 font-bold">ENV:</span>
            <span id="headerEnvBadge" className="text-blue-600 dark:text-blue-400 truncate">💻 LOCALHOST</span>
          </div>

          {/* Theme Toggle Pill */}
          <div
            className="theme-mode-pill flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-[0.72rem] font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer select-none transition-all hover:border-slate-400 shadow-sm shrink-0"
            id="headerThemeBadge"
            onClick={(e) => { try { if (typeof window !== 'undefined' && typeof window.toggleThemeManual === 'function') { window.toggleThemeManual(); } else if (typeof toggleThemeManual === 'function') { toggleThemeManual(); } } catch (err) { console.error(err); } }}
            title="Toggle Light / Dark Mode"
          >
            <span id="headerThemeIcon">☀️</span>
            <span id="headerThemeText">White</span>
          </div>
        </div>

        {/* Live Polling Indicator */}
        <div className="live-pulse-badge flex items-center justify-center gap-2 py-1.5 px-2 rounded-lg text-[0.72rem] font-bold border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <div className="pulse-dot w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]"></div>
          <span>Live Syncing</span>
        </div>

        {/* Session Security & User Info */}
        <div className="flex items-center justify-between p-2 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-[0.65rem] text-slate-400 font-extrabold uppercase">User:</span>
            <span id="adminUserBadge" className="font-mono text-slate-700 dark:text-slate-300 font-bold truncate max-w-[90px]">Admin</span>
          </div>
          <button
            id="adminAuthActionBtn"
            className="text-[0.7rem] text-red-500 hover:text-red-600 font-bold hover:underline cursor-pointer flex items-center gap-1 shrink-0"
            onClick={(e) => {
              try {
                if (typeof window !== 'undefined' && typeof window.lockAdminSession === 'function') {
                  window.lockAdminSession();
                } else {
                  window.location.href = '/logout';
                }
              } catch(err) {
                window.location.href = '/logout';
              }
            }}
            title="Sign Out of Session"
          >
            <span id="adminAuthActionIcon">🔒</span>
            <span id="adminAuthActionText">Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
