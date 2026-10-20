import React from 'react';

export default function AdminAuthModal() {
  return (
    <div
      id="adminAuthModal"
      className="modal-overlay fixed inset-0 items-center justify-center p-4 backdrop-blur-md bg-slate-950/80 select-none"
      style={{
        display: 'none',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2147483647,
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div className="modal-box max-w-md w-full rounded-2xl p-7 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl transition-all">
        {/* Brand Header */}
        <div className="flex items-center justify-between gap-3 mb-5 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-2xl shrink-0">
              🛡️
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                Merchant Authentication
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Sign in with your Admin credentials to manage payments &amp; terminals.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-200 text-base p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer leading-none"
            onClick={() => {
              try {
                if (typeof window !== 'undefined' && typeof window.closeAdminAuthModal === 'function') {
                  window.closeAdminAuthModal();
                }
              } catch(e) {}
            }}
            title="Dismiss"
          >
            ✕
          </button>
        </div>

        {/* Error notification container */}
        <div
          id="adminAuthError"
          className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold leading-relaxed"
          style={{ display: 'none' }}
        >
          {/* Dynamic error message */}
        </div>

        <form onSubmit={(e) => {
          e.preventDefault();
          try {
            if (typeof window !== 'undefined' && typeof window.handleAdminAuthSubmit === 'function') {
              window.handleAdminAuthSubmit(e);
            }
          } catch(err) { console.error(err); }
        }}>
          {/* Login ID / Username Field */}
          <div className="mb-4">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Login ID / Username <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm opacity-60">👤</span>
              <input
                id="adminAuthUsername"
                type="text"
                required
                autoComplete="username"
                defaultValue="admin"
                placeholder="admin or admin@youpi.local"
                className="w-full rounded-xl text-sm py-2.5 pl-10 pr-3.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="mb-5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm opacity-60">🔒</span>
              <input
                id="adminAuthPassword"
                type="password"
                required
                autoComplete="current-password"
                placeholder="Enter password..."
                className="w-full rounded-xl text-sm py-2.5 pl-10 pr-10 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
              />
              <button
                type="button"
                onClick={(e) => {
                  try {
                    const input = document.getElementById('adminAuthPassword');
                    if (input) {
                      const isPwd = input.type === 'password';
                      input.type = isPwd ? 'text' : 'password';
                      e.currentTarget.textContent = isPwd ? '👁️' : '🙈';
                    }
                  } catch(err) { console.error(err); }
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm opacity-60 hover:opacity-100 cursor-pointer select-none"
                title="Toggle password visibility"
              >
                👁️
              </button>
            </div>
            <p className="text-[0.72rem] text-slate-400 dark:text-slate-500 mt-2 leading-relaxed">
              Default password: <code>AdminSecurePassword123!</code> (or configured in <code>.env</code> / <code>ADMIN_PASSWORD</code>).
            </p>
          </div>

          {/* Collapsible Direct Token Fallback for API / Token workflows */}
          <details className="mb-5 group">
            <summary className="text-[0.74rem] text-blue-600 dark:text-blue-400 font-semibold cursor-pointer hover:underline flex items-center gap-1 select-none">
              <span>🔑 Or sign in using Admin API Token</span>
            </summary>
            <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <label className="block text-[0.68rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Admin API Token / Secret
              </label>
              <input
                id="adminAuthTokenInput"
                type="password"
                autoComplete="off"
                placeholder="Paste ADMIN_API_TOKEN..."
                className="w-full rounded-lg text-xs py-2 px-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
              />
              <p className="text-[0.68rem] text-slate-400 mt-1.5">
                Found in <code>data/.secrets/admin_api_token</code>. Entering a token logs you in directly.
              </p>
            </div>
          </details>

          {/* Sign In Submit Button */}
          <button
            type="submit"
            id="adminAuthSubmitBtn"
            className="w-full py-2.5 px-4 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white shadow-md shadow-blue-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>🔐 Sign In to Merchant Portal</span>
          </button>
        </form>
      </div>
    </div>
  );
}
