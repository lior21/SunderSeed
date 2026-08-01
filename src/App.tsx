import { useState, useEffect } from 'react';
import { Shield, Sparkles, RefreshCw, Download } from 'lucide-react';
import Generator from './components/Generator';
import Recoverer from './components/Recoverer';

const GITHUB_REPO_URL = 'https://github.com/lior21/wordcrux-slip39';

function GithubIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={`${className} fill-current`} viewBox="0 0 24 24" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

async function downloadOfflineApp() {

  let htmlContent = '';
  try {
    const res = await fetch(window.location.href);
    if (res.ok) {
      htmlContent = await res.text();
    }
  } catch {
    // fallback if fetch fails
  }

  if (!htmlContent) {
    htmlContent = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
  }

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  const repoName = typeof __REPO_PREFIX__ !== 'undefined' ? __REPO_PREFIX__ : 'lior21-wordcrux-slip39';
  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
  link.download = `${repoName}-v${version}.html`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function App() {
  const [activeTab, setActiveTab] = useState<'generate' | 'recover'>('generate');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        // Temporarily swap document title so native browser "Save As" modal pre-fills versioned filename
        const oldTitle = document.title;
        const repoName = typeof __REPO_PREFIX__ !== 'undefined' ? __REPO_PREFIX__ : 'lior21-wordcrux-slip39';
        const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

        document.title = `${repoName}-v${version}`;

        // Restore clean tab title shortly after native save dialog opens
        setTimeout(() => {
          document.title = oldTitle || 'Wordcrux';
        }, 1500);

        // Allow native browser Ctrl+S behavior (opens native OS Save As dialog)
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const versionString = typeof __APP_VERSION__ !== 'undefined' ? `v${__APP_VERSION__}` : '';


  return (
    <div className="min-h-screen bg-[#070a13] text-slate-100 flex flex-col selection:bg-violet-600/30 selection:text-violet-200">
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/40 backdrop-blur-md sticky top-0 z-50 print-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20 shrink-0">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-violet-200 via-fuchsia-100 to-slate-200 bg-clip-text text-transparent flex items-center gap-2">
                WordCrux <span className="text-xs font-semibold px-2 py-0.5 bg-violet-600/20 border border-violet-500/30 rounded text-violet-300 font-mono">SLIP39</span>
              </h1>
              <p className="text-xs text-slate-400 font-medium hidden sm:block">Shamir's Secret Sharing for Mnemonic Seeds</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              title="View source code on GitHub (lior21/wordcrux-slip39)"
              aria-label="GitHub Repository"
              className="h-9 w-9 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-violet-500/40 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-sm hover:shadow-violet-500/10"
            >
              <GithubIcon className="h-5 w-5" />
            </a>
            <button
              onClick={downloadOfflineApp}
              title="Download single-file HTML for air-gapped use (Ctrl+S / ⌘S)"
              className="hidden sm:inline-flex h-9 items-center gap-1.5 px-3.5 rounded-full text-xs font-semibold bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 text-violet-300 transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Standalone Tool</span>
              {versionString && <span className="text-violet-400/70 font-mono hidden md:inline">{versionString}</span>}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        {/* Intro Banner */}
        <section className="text-center space-y-3 max-w-2xl mx-auto mb-6 print-hidden">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-violet-500/10 border border-violet-500/20 rounded-full text-xs text-violet-300 font-medium animate-pulse">
            <Sparkles className="h-3 w-3" />
            Zero network requests, safe & offline-capable
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 via-white to-slate-200 bg-clip-text text-transparent">
            Securely split or recover your wallet seed phrase
          </h2>
          <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
            Convert a standard 12-word BIP-39 mnemonic into multiple robust 20-word SLIP-39 Shamir shares, or combine shares to restore access.
          </p>
        </section>

        {/* Navigation Tabs */}
        <div className="flex justify-center">
          <div className="bg-slate-905 p-1 rounded-2xl border border-slate-900/60 shadow-xl flex max-w-md w-full print-hidden">
            <button
              onClick={() => setActiveTab('generate')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl transition-all ${
                activeTab === 'generate'
                  ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-600/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              Generate Shares
            </button>
            <button
              onClick={() => setActiveTab('recover')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl transition-all ${
                activeTab === 'recover'
                  ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-600/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
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
      <footer className="border-t border-slate-900 bg-slate-950/40 py-8 text-center text-xs text-slate-500 font-medium print-hidden">
        <div className="max-w-7xl mx-auto px-4 space-y-3">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-slate-400">
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-slate-300 font-mono hover:text-violet-400 transition-colors"
            >
              <GithubIcon className="h-3.5 w-3.5" />
              lior21/wordcrux-slip39
            </a>
            <span className="text-slate-700">•</span>
            <a
              href={`${GITHUB_REPO_URL}/blob/main/LICENSE`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-violet-400 transition-colors"
            >
              License
            </a>
            <span className="text-slate-700">•</span>
            <a
              href="https://github.com/satoshilabs/slips/blob/master/slip-0039.md"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-violet-400 transition-colors"
            >
              SLIP-0039 Spec
            </a>
            <span className="text-slate-700">•</span>
            <a
              href={`${GITHUB_REPO_URL}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-violet-400 transition-colors"
            >
              Report Issue
            </a>
          </div>
          <p>© 2026 WordCrux SLIP-39. Built using standard audited packages for local client-side execution.</p>

          {/* Desktop Security Tip */}
          <p className="hidden sm:block text-slate-600">
            For maximum security, run this standalone tool on an air-gapped computer (press <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-slate-400 font-mono">Ctrl+S</kbd> / <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-slate-400 font-mono">⌘S</kbd> to save).
          </p>

          {/* Mobile Security Tip */}
          <p className="sm:hidden text-slate-600">
            For maximum security, run this standalone tool on an air-gapped computer.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;

