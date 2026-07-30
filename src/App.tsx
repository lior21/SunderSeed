import { useState, useEffect } from 'react';
import { Shield, Sparkles, RefreshCw, Cpu, CheckCircle, Download } from 'lucide-react';
import Generator from './components/Generator';
import Recoverer from './components/Recoverer';

function downloadOfflineApp() {
  const htmlContent = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
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
        e.preventDefault();
        downloadOfflineApp();
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-violet-200 via-fuchsia-100 to-slate-200 bg-clip-text text-transparent">
                WordCrux <span className="text-sm font-semibold px-2 py-0.5 bg-violet-600/20 border border-violet-500/30 rounded text-violet-300 ml-1.5 font-mono">SLIP39</span>
              </h1>
              <p className="text-xs text-slate-400 font-medium">Shamir's Secret Sharing for Mnemonic Seeds</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckCircle className="h-3 w-3" />
              100% Client-Side
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Cpu className="h-3 w-3" />
              Secrets Stay Local
            </span>
            <button
              onClick={downloadOfflineApp}
              title="Save standalone HTML for offline use (Ctrl+S)"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 text-violet-300 transition-colors cursor-pointer"
            >
              <Download className="h-3 w-3" />
              Save Offline App {versionString}
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
      <footer className="border-t border-slate-950 bg-slate-950/40 py-8 text-center text-xs text-slate-500 font-medium print-hidden">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p>© 2026 WordCrux SLIP-39. Built using standard audited packages for local client-side execution.</p>
          <p className="text-slate-600">
            For maximum security, press <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-slate-400 font-mono">Ctrl+S</kbd> to download this page and open it on an air-gapped computer.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;

