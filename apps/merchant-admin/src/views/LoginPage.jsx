import React, { useState, useEffect } from 'react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // 1. Initialize theme from localStorage / system preference
    try {
      const storedTheme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark = storedTheme === 'dark' || (!storedTheme && prefersDark);
      setIsDark(shouldBeDark);
      if (shouldBeDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {}

    // 2. Pre-fill remembered username if available
    try {
      const savedUser = localStorage.getItem('youpi_admin_user') || sessionStorage.getItem('youpi_admin_user');
      if (savedUser) {
        setUsername(savedUser);
      }
    } catch (e) {}
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    try {
      if (nextDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    } catch (e) {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedUser = username.trim();
    const trimmedPass = password.trim();

    if (!trimmedUser || !trimmedPass) {
      setError('Please enter both your Admin ID and password.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: trimmedUser, password: trimmedPass })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success && data.token) {
        try {
          localStorage.setItem('youpi_admin_token', data.token);
          sessionStorage.setItem('youpi_admin_token', data.token);
          if (data.expiresAt) {
            localStorage.setItem('youpi_admin_token_expiry', data.expiresAt);
            sessionStorage.setItem('youpi_admin_token_expiry', data.expiresAt);
          }
          if (data.user?.username) {
            localStorage.setItem('youpi_admin_user', data.user.username);
            sessionStorage.setItem('youpi_admin_user', data.user.username);
          }
        } catch (e) {}

        const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const redirectUrl = (urlParams && urlParams.get('redirect')) || '/';
        window.location.href = redirectUrl;
      } else {
        setError(data.error || 'Invalid credentials. Please verify your Admin ID and password.');
        setLoading(false);
      }
    } catch (err) {
      setError('Connection error: ' + (err.message || 'Unable to reach authentication server'));
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 min-h-screen flex flex-col justify-between items-center p-4 sm:p-6 antialiased selection:bg-blue-500 selection:text-white">
      {/* Header Branding */}
      <header className="w-full max-w-md flex items-center justify-between pt-4 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-black text-lg shadow-md shadow-blue-500/20">
            Y
          </div>
          <div>
            <span className="font-black text-base tracking-wider bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 dark:from-blue-400 dark:via-indigo-400 dark:to-cyan-300 bg-clip-text text-transparent">
              YOUPI PG
            </span>
            <span className="text-[0.65rem] block font-mono text-slate-600 dark:text-slate-300 font-semibold tracking-widest uppercase">
              Admin Operations
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="themeToggleBtn"
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer"
            title="Toggle Theme"
          >
            <span>{isDark ? '☀️' : '🌙'}</span>
          </button>
          <span className="px-2 py-0.5 rounded text-[0.65rem] font-mono font-bold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            v2.4 Live
          </span>
        </div>
      </header>

      {/* Login Card Container */}
      <main className="w-full max-w-md my-auto">
        <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-black/40 backdrop-blur-sm p-6 sm:p-8">
          
          {/* Card Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-800/60 text-blue-600 dark:text-blue-400 text-2xl mb-3 shadow-inner">
              🛡️
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Merchant Admin Sign In
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
              Enter your database credentials to access the operations hub and payment monitors.
            </p>
          </div>

          {/* Alert Box */}
          {error && (
            <div
              id="loginError"
              className="mb-5 p-3 rounded-xl text-xs font-medium border bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 flex items-start gap-2.5 animate-in fade-in duration-200"
              role="alert"
            >
              <span className="text-sm shrink-0">⚠️</span>
              <span id="loginErrorText" className="flex-1 leading-relaxed">
                {error}
              </span>
            </div>
          )}

          {/* Login Form */}
          <form id="loginForm" onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Username / Email */}
            <div>
              <label
                htmlFor="loginUsername"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Admin Login ID or Email
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-sm">
                  👤
                </span>
                <input
                  type="text"
                  id="loginUsername"
                  name="username"
                  required
                  autoComplete="username"
                  autoFocus
                  placeholder="e.g. admin or admin@youpi.local"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="loginPassword"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                >
                  Password
                </label>
                <span className="text-[0.7rem] text-slate-600 dark:text-slate-300 font-mono">SQLite Vault</span>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-sm">
                  🔑
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="loginPassword"
                  name="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
                <button
                  type="button"
                  id="togglePasswordBtn"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer text-sm"
                  title="Show/Hide Password"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              id="loginSubmitBtn"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading && <span id="submitSpinner" className="animate-spin">⏳</span>}
              <span id="submitBtnText">
                {loading ? 'Verifying credentials...' : 'Sign In to Merchant Hub'}
              </span>
            </button>
          </form>

          {/* Security / Info Footnote */}
          <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[0.7rem] text-slate-600 dark:text-slate-300 font-mono">
            <span className="flex items-center gap-1">
              <span className="text-emerald-500">●</span> PBKDF2 SHA-512
            </span>
            <span className="truncate">Time-Limited Sessions</span>
          </div>

        </div>
      </main>

      {/* Page Footer */}
      <footer className="w-full max-w-md text-center py-4 text-xs text-slate-600 dark:text-slate-300">
        <p>© 2026 YOUPI PG Payment Gateway. Internal Operations Hub.</p>
      </footer>
    </div>
  );
}
