import { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, Download, Sun, Moon } from 'lucide-react';
import Generator from './components/Generator';
import Recoverer from './components/Recoverer';
import { GithubIcon } from './components/GithubIcon';
import { SunderSeedIcon } from './components/SunderSeedIcon';

const GITHUB_REPO_URL = 'https://github.com/lior21/SunderSeed';
const THEME_STORAGE_KEY = 'sunderseed-theme';

type Tab = 'generate' | 'recover';

function useHashRoute(): [Tab, (tab: Tab) => void] {
  const getTab = (): Tab => {
    if (typeof window === 'undefined') return 'generate';
    const hash = window.location.hash.toLowerCase().replace(/^#\/?/, '');
    if (hash === 'recover' || hash === 'recovery') return 'recover';
    return 'generate';
  };

  const [tab, setTab] = useState<Tab>(getTab);

  useEffect(() => {
    const handleHashChange = () => setTab(getTab());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTab = (newTab: Tab) => {
    if (window.location.hash.toLowerCase().replace(/^#\/?/, '') !== newTab) {
      window.location.hash = newTab;
    }
    setTab(newTab);
  };

  return [tab, navigateTab];
}

function getInitialTheme(): 'dark' | 'light' {
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'dark' || savedTheme === 'light') {
      return savedTheme;
    }
  } catch {
    // fallback if localStorage is restricted
  }
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

async function downloadOfflineApp() {
  let htmlContent = '';
  try {
    const cleanUrl = window.location.href.split('#')[0];
    const res = await fetch(cleanUrl);
    if (res.ok) {
      htmlContent = await res.text();
    }
  } catch {
    // fallback if fetch fails
  }

  if (!htmlContent) {
    htmlContent = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
  }

  // When downloaded for offline / air-gapped usage, inline the SVG favicon as base64
  // so the downloaded single-file HTML retains its favicon when opened via file:// protocol
  if (typeof __FAVICON_BASE64__ !== 'undefined' && __FAVICON_BASE64__) {
    const dataUri = `data:image/svg+xml;base64,${__FAVICON_BASE64__}`;
    htmlContent = htmlContent.replace(
      /<link rel="icon" type="image\/svg\+xml" href="[^"]*"/,
      `<link rel="icon" type="image/svg+xml" href="${dataUri}"`
    );
  }

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  const repoName = typeof __REPO_PREFIX__ !== 'undefined' ? __REPO_PREFIX__ : 'lior21-sunderseed';
  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
  link.download = `${repoName}-v${version}.html`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function App() {
  const [activeTab, setActiveTab] = useHashRoute();
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // fallback
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        const oldTitle = document.title;
        const repoName = typeof __REPO_PREFIX__ !== 'undefined' ? __REPO_PREFIX__ : 'lior21-sunderseed';
        const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

        document.title = `${repoName}-v${version}`;

        setTimeout(() => {
          document.title = oldTitle || 'SunderSeed';
        }, 1500);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const versionString = typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__ ? `v${__APP_VERSION__}` : undefined;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#060b13] text-slate-900 dark:text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-950 dark:selection:text-cyan-200 transition-colors duration-200">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/40 backdrop-blur-md sticky top-0 z-50 print-hidden transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 shrink-0">
              <SunderSeedIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight leading-none bg-gradient-to-r from-cyan-700 via-sky-600 to-blue-700 dark:from-cyan-200 dark:via-sky-200 dark:to-blue-200 bg-clip-text text-transparent">
                  SunderSeed
                </h1>
                <span className="text-[10px] font-semibold leading-none px-1.5 py-[1px] bg-cyan-500/10 dark:bg-cyan-500/20 border border-cyan-500/30 rounded text-cyan-700 dark:text-cyan-300 font-mono">
                  SLIP39
                </span>
              </div>
              <p className="text-xs leading-tight text-slate-500 dark:text-slate-400 font-medium hidden sm:block mt-1">
                Shamir's Secret Sharing for Mnemonic Seeds
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              title="View source code on GitHub (lior21/SunderSeed)"
              aria-label="GitHub Repository"
              className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-900/90 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-800 hover:border-cyan-500/40 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-sm hover:shadow-cyan-500/10"
            >
              <GithubIcon className="h-5 w-5" />
            </a>

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
              aria-label="Toggle theme"
              className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-900/90 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-800 hover:border-cyan-500/40 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-sm hover:shadow-cyan-500/10"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-slate-600" />
              )}
            </button>

            <button
              type="button"
              onClick={downloadOfflineApp}
              title="Download single-file HTML for air-gapped use (Ctrl+S / ⌘S)"
              className="hidden sm:inline-flex h-9 items-center gap-2 px-3.5 rounded-full text-xs font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300 transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 shrink-0" />
              <span className="leading-none">Download Standalone Tool</span>
              {versionString && (
                <span className="text-cyan-600/80 dark:text-cyan-400/80 font-mono text-[11px] leading-none hidden md:inline-flex items-center">
                  {versionString}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        {/* Intro Banner */}
        <section className="text-center space-y-3 max-w-2xl mx-auto mb-6 print-hidden">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-xs text-cyan-700 dark:text-cyan-300 font-medium animate-pulse">
            <Sparkles className="h-3 w-3" />
            Zero network requests, safe & offline-capable
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-100 dark:via-white dark:to-slate-200 bg-clip-text text-transparent">
            Securely split or recover your wallet seed phrase
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
            Convert a standard 12-word BIP-39 mnemonic into multiple robust 20-word SLIP-39 Shamir shares, or combine shares to restore access.
          </p>
        </section>

        {/* Navigation Tabs */}
        <div className="flex justify-center">
          <div className="bg-slate-200/80 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-300/80 dark:border-slate-800 shadow-sm dark:shadow-xl flex max-w-md w-full print-hidden">
            <button
              type="button"
              onClick={() => setActiveTab('generate')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'generate'
                  ? 'bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 text-white shadow-md shadow-cyan-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-300/50 dark:hover:bg-slate-800/50'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              Generate Shares
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('recover')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'recover'
                  ? 'bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 text-white shadow-md shadow-cyan-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-300/50 dark:hover:bg-slate-800/50'
              }`}
            >
              <RefreshCw className="h-4 w-4" />
              Recover Seed
            </button>
          </div>
        </div>

        {/* Tab views */}
        <div className="mt-8">
          {activeTab === 'generate' ? <Generator /> : <Recoverer />}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white/60 dark:bg-slate-950/40 py-8 text-center text-xs text-slate-500 font-medium print-hidden transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 space-y-3">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-slate-600 dark:text-slate-400">
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-mono hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
            >
              <GithubIcon className="h-3.5 w-3.5" />
              lior21/SunderSeed
            </a>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <a
              href={`${GITHUB_REPO_URL}/blob/main/LICENSE`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
            >
              License
            </a>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <a
              href="https://github.com/satoshilabs/slips/blob/master/slip-0039.md"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
            >
              SLIP-0039 Spec
            </a>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <a
              href={`${GITHUB_REPO_URL}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
            >
              Report Issue
            </a>
            {versionString && (
              <>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span className="font-mono text-cyan-700 dark:text-cyan-300/80 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 text-[11px]">
                  {versionString}
                </span>
              </>
            )}
          </div>
          <p>© 2026 SunderSeed. Built with open-source libraries, including audited BIP-39 primitives, for local client-side execution.</p>

          {/* Desktop Security Tip */}
          <p className="hidden sm:block text-slate-500 dark:text-slate-600">
            For maximum security, run this standalone tool on an air-gapped computer (press <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-600 dark:text-slate-400 font-mono">Ctrl+S</kbd> / <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-slate-600 dark:text-slate-400 font-mono">⌘S</kbd> to save).
          </p>

          {/* Mobile Security Tip */}
          <p className="sm:hidden text-slate-500 dark:text-slate-600">
            For maximum security, run this standalone tool on an air-gapped computer.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
