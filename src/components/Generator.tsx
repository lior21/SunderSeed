import { useState, useEffect } from "react";
import {
  Shield,
  Shuffle,
  Copy,
  Check,
  Info,
  Settings,
  Plus,
  Trash2,
  Key,
  Printer,
} from "lucide-react";
import MnemonicInput from "./MnemonicInput";
import { GithubIcon } from "./GithubIcon";
import {
  BIP39_WORD_LIST,
  generateBip39Mnemonic,
  bip39ToSlip39,
  validateBip39Mnemonic,
  decodeShareMetadata,
} from "../slip39Service";

interface GroupConfig {
  id: string;
  threshold: number;
  count: number;
}

export default function Generator() {
  const [bip39Words, setBip39Words] = useState<string[]>(Array(12).fill(""));
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [isAdvanced, setIsAdvanced] = useState(false);

  // Simple Mode settings
  const [simpleThreshold, setSimpleThreshold] = useState(2);
  const [simpleCount, setSimpleCount] = useState(3);

  // Advanced Mode settings
  const [groupThreshold, setGroupThreshold] = useState(1);
  const [groups, setGroups] = useState<GroupConfig[]>([
    { id: "1", threshold: 1, count: 1 },
  ]);

  // Sync groupThreshold when groups change to prevent state out-of-sync bugs
  useEffect(() => {
    if (groupThreshold > groups.length) {
      setGroupThreshold(groups.length);
    }
  }, [groups.length, groupThreshold]);

  // Results
  const [shares, setShares] = useState<string[]>([]);
  const [copiedShareIdx, setCopiedShareIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Generate random BIP-39 mnemonic
  const handleRandomSeed = () => {
    const seed = generateBip39Mnemonic();
    setBip39Words(seed.split(" "));
    setError(null);
  };

  // Copy share to clipboard
  const handleCopyShare = (share: string, idx: number) => {
    navigator.clipboard.writeText(share);
    setCopiedShareIdx(idx);
    setTimeout(() => setCopiedShareIdx(null), 2000);
  };

  // Add group in advanced mode
  const addGroup = () => {
    const id = Date.now().toString();
    setGroups((prev) => [...prev, { id, threshold: 2, count: 3 }]);
  };

  // Remove group in advanced mode
  const removeGroup = (id: string) => {
    if (groups.length <= 1) return;
    setGroups((prev) => prev.filter((g) => g.id !== id));
  };

  // Update group property
  const updateGroup = (id: string, field: keyof GroupConfig, val: any) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        const updated = { ...g, [field]: val };

        // Validation rules according to SLIP-39:
        // 1. Threshold cannot exceed Count
        if (field === "count" && updated.threshold > val) {
          updated.threshold = val;
        }
        if (field === "threshold" && val > updated.count) {
          updated.count = val;
        }

        // 2. SLIP-39 Rule: If Count > 1, Member Threshold cannot be 1 (Must be >= 2)
        if (field === "count" && val > 1 && updated.threshold < 2) {
          updated.threshold = 2;
        }
        if (field === "threshold" && val === 1 && updated.count > 1) {
          updated.count = 1;
        }
        return updated;
      }),
    );
  };

  const isSeedValid = validateBip39Mnemonic(bip39Words.join(" "));

  const handleGenerate = () => {
    setError(null);
    setShares([]);

    const seedPhrase = bip39Words.join(" ");
    if (!validateBip39Mnemonic(seedPhrase)) {
      setError("Please fill in a valid 12-word BIP-39 mnemonic seed phrase.");
      return;
    }

    try {
      let resultShares: string[] = [];
      if (!isAdvanced) {
        // Simple mode: split into 1 group with simpleThreshold-of-simpleCount
        const groupConfigs: [number, number, string][] = [
          [simpleThreshold, simpleCount, "Main Shares"],
        ];
        resultShares = bip39ToSlip39(seedPhrase, passphrase, 1, groupConfigs);
      } else {
        // Advanced mode
        if (groupThreshold > groups.length) {
          setError(
            `Group threshold (${groupThreshold}) cannot exceed the number of groups (${groups.length}).`,
          );
          return;
        }

        const groupConfigs: [number, number, string][] = groups.map(
          (g, idx) => [g.threshold, g.count, `Group ${idx + 1}`],
        );

        resultShares = bip39ToSlip39(
          seedPhrase,
          passphrase,
          groupThreshold,
          groupConfigs,
        );
      }
      setShares(resultShares);
    } catch (err: any) {
      let msg = err.message || "An error occurred during generation.";
      if (msg.includes("Creating multiple member shares with member threshold 1 is not allowed")) {
        msg = "Creating multiple member shares with member threshold 1 is not allowed by SLIP-39. If total shares > 1 for a group, required shares must be at least 2.";
      }
      setError(msg);
    }
  };

  const handlePrintShares = () => {
    window.print();
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-white/80 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl relative focus-within:z-20 z-10 print-hidden shadow-sm dark:shadow-none transition-colors duration-200">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl -z-10 animate-pulse-glow"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Shield className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              1. Input 12-Word BIP-39 Seed Phrase
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Enter your existing recovery seed or generate a new secure one.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRandomSeed}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 dark:hover:bg-slate-700/80 text-violet-700 dark:text-violet-300 font-medium rounded-xl text-sm transition-all duration-200 cursor-pointer"
          >
            <Shuffle className="h-4 w-4" />
            Generate Random Seed
          </button>
        </div>

        <MnemonicInput
          wordCount={12}
          wordlist={BIP39_WORD_LIST}
          words={bip39Words}
          onChange={setBip39Words}
          labelPrefix="Seed Word"
          onValidatePhrase={validateBip39Mnemonic}
        />
      </div>

      <div
        className={`bg-white/80 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl relative transition-all duration-300 print-hidden shadow-sm dark:shadow-none ${
          !isSeedValid ? "border-slate-300 dark:border-slate-850 opacity-60" : ""
        }`}
      >
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-6">
          <Settings className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          2. Sharing & Security Configuration
        </h2>

        <fieldset
          disabled={!isSeedValid}
          className="space-y-8 disabled:opacity-40 disabled:pointer-events-none transition-all duration-250"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Mode Selector */}
            <div className="space-y-6">
              <div className="flex bg-slate-200/80 dark:bg-slate-900/90 p-1.5 rounded-xl border border-slate-300/80 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAdvanced(false)}
                  className={`flex-1 py-2 text-center rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    !isAdvanced
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-300/40 dark:hover:bg-slate-800/40"
                  }`}
                >
                  Simple Split (Single Group)
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdvanced(true)}
                  className={`flex-1 py-2 text-center rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    isAdvanced
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-300/40 dark:hover:bg-slate-800/40"
                  }`}
                >
                  Advanced Split (Multi-Group)
                </button>
              </div>

              {/* Simple Split Settings */}
              {!isAdvanced ? (
                <div className="space-y-4 bg-slate-100/70 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-900 p-5 rounded-xl">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Total Shares (M)
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={2}
                        max={16}
                        value={simpleCount}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setSimpleCount(val);
                          if (simpleThreshold > val) setSimpleThreshold(val);
                        }}
                        className="w-32 accent-violet-500"
                      />
                      <span className="text-slate-900 dark:text-slate-100 font-mono text-sm w-6 text-right">
                        {simpleCount}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Required to Recover (N)
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={2}
                        max={simpleCount}
                        value={simpleThreshold}
                        onChange={(e) =>
                          setSimpleThreshold(parseInt(e.target.value))
                        }
                        className="w-32 accent-violet-500"
                      />
                      <span className="text-slate-900 dark:text-slate-100 font-mono text-sm w-6 text-right">
                        {simpleThreshold}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 items-start text-xs text-slate-600 dark:text-slate-400 bg-slate-200/50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-300/60 dark:border-slate-800">
                    <Info className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
                    <p>
                      This will split your seed phrase into {simpleCount}{" "}
                      shares. You will need any {simpleThreshold} of them to
                      recover your original seed phrase.
                    </p>
                  </div>
                </div>
              ) : (
                /* Advanced Split Settings */
                <div className="space-y-5 bg-slate-100/70 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-900 p-5 rounded-xl">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Group Shares Setup
                      </span>
                      <button
                        type="button"
                        onClick={addGroup}
                        className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:text-violet-500 dark:hover:text-violet-300 font-medium cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                        Add Group
                      </button>
                    </div>

                    <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                      {groups.map((group, idx) => (
                        <div
                          key={group.id}
                          className="flex flex-col gap-3 p-4 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs dark:shadow-none"
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-2">
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                              Group {idx + 1}
                            </span>
                            {groups.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeGroup(group.id)}
                                className="text-rose-500 hover:text-rose-600 dark:text-rose-450 dark:hover:text-rose-400 transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="space-y-3.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-700 dark:text-slate-350 font-medium">
                                Total Shares (M)
                              </span>
                              <div className="flex items-center gap-2">
                                <input
                                  type="range"
                                  min={1}
                                  max={16}
                                  value={group.count}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    updateGroup(group.id, "count", val);
                                  }}
                                  className="w-32 accent-violet-500"
                                />
                                <span className="text-slate-900 dark:text-slate-100 font-mono text-sm w-6 text-right">
                                  {group.count}
                                </span>
                              </div>
                            </div>

                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-700 dark:text-slate-350 font-medium">
                                Required to Recover (N)
                              </span>
                              <div className="flex items-center gap-2">
                                <input
                                  type="range"
                                  min={group.count > 1 ? 2 : 1}
                                  max={group.count}
                                  value={group.threshold}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    updateGroup(group.id, "threshold", val);
                                  }}
                                  className="w-32 accent-violet-500"
                                />
                                <span className="text-slate-900 dark:text-slate-100 font-mono text-sm w-6 text-right">
                                  {group.threshold}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Group Threshold */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-850">
                    <div className="flex justify-between items-center text-xs mb-3">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        Required Groups (Group Threshold)
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={1}
                          max={groups.length}
                          value={groupThreshold}
                          onChange={(e) =>
                            setGroupThreshold(parseInt(e.target.value))
                          }
                          disabled={groups.length <= 1}
                          className="w-24 accent-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <span className="text-slate-900 dark:text-slate-100 font-mono text-sm w-6 text-right">
                          {groupThreshold}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2.5 items-start text-xs text-slate-600 dark:text-slate-400 bg-slate-200/50 dark:bg-slate-900/60 p-3.5 rounded-lg border border-slate-300/60 dark:border-slate-800">
                      <Info className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p>
                          This will split your seed phrase into {groups.length}{" "}
                          {groups.length === 1 ? "group" : "groups"} of shares. To
                          recover, you will need to satisfy the requirements of
                          any{" "}
                          <strong className="text-violet-700 dark:text-violet-300">
                            {groupThreshold}{" "}
                            {groupThreshold === 1 ? "group" : "groups"}
                          </strong>
                          .
                        </p>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600 dark:text-slate-400 pl-1 mt-1">
                          {groups.map((group, idx) => (
                            <li key={group.id}>
                              <strong className="text-slate-800 dark:text-slate-350">
                                Group {idx + 1}
                              </strong>
                              : Need any{" "}
                              <strong className="text-slate-900 dark:text-slate-300">
                                {group.threshold}
                              </strong>{" "}
                              of {group.count}{" "}
                              {group.count === 1 ? "share" : "shares"}.
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Passphrase field */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-2">
                  <Key className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  Optional Custom Passphrase
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Adds an extra layer of encryption. You MUST remember this
                  passphrase to recover your seed later.
                </p>
                <div className="relative">
                  <input
                    type={showPassphrase ? "text" : "password"}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-200 font-mono text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
                    placeholder="Enter custom encryption passphrase..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassphrase((prev) => !prev)}
                    className="absolute right-3 top-[50%] -translate-y-[50%] text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showPassphrase ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-violet-500/10 dark:bg-violet-600/10 border border-violet-500/20 rounded-xl">
                <h3 className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide mb-1">
                  How SLIP-39 works
                </h3>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  Your 12-word BIP-39 mnemonic seed phrase contains 128 bits of
                  entropy. SLIP-39 splits this entropy mathematically. Each
                  generated share consists of 20 words. No individual share
                  reveals anything about your master key.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center justify-center">
            {error && (
              <div className="mb-4 p-3 bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 rounded-xl text-xs text-center w-full max-w-lg">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleGenerate}
              disabled={!isSeedValid}
              className="w-full max-w-xs py-3 px-6 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-violet-600/20 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:shadow-none"
            >
              Split into SLIP-39 Shares
            </button>
          </div>
        </fieldset>
      </div>

      {/* Output Shares */}
      {shares.length > 0 && (
        <>
          <div className="bg-white/80 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl animate-fade-in print-hidden shadow-sm dark:shadow-none">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-2">
            <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            3. Generated SLIP-39 Shares
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Keep these shares in physically separate, secure locations. Do not
            store them digitally!
          </p>

          <div className="space-y-4">
            {shares.map((share, idx) => {
              const metadata = decodeShareMetadata(share);

              return (
                <div
                  key={idx}
                  className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-900 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 bg-violet-500/10 dark:bg-violet-600/20 border border-violet-500/30 text-violet-700 dark:text-violet-300 rounded">
                        Share #{idx + 1}
                      </span>
                      {metadata && isAdvanced && (
                        <span className="text-xs px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 rounded">
                          Group {metadata.groupIndex + 1} | Share{" "}
                          {metadata.memberIndex + 1}
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-sm text-slate-900 dark:text-slate-200 leading-relaxed bg-white dark:bg-slate-900/30 p-3 rounded-lg border border-slate-200 dark:border-slate-900 select-all">
                      {share}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyShare(share, idx)}
                    className={`flex items-center justify-center gap-1.5 px-4 py-2 border rounded-xl font-medium text-xs transition-all duration-200 shrink-0 self-end lg:self-center cursor-pointer ${
                      copiedShareIdx === idx
                        ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {copiedShareIdx === idx ? (
                      <>
                        <Check className="h-3.5 w-3.5 animate-bounce" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy Share
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-center">
            <button
              type="button"
              onClick={handlePrintShares}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold rounded-xl text-sm transition-all duration-200 shadow-lg hover:shadow-violet-600/20 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              <Printer className="h-4.5 w-4.5" />
              Print Share Cards (A4)
            </button>
          </div>
        </div>

        {/* Print Template (Hidden on screen, active in print mode) */}
        <div className="print-only">
          {(() => {
            const groupMemberCounts: { [groupIndex: number]: number } = {};
            shares.forEach((share) => {
              const meta = decodeShareMetadata(share);
              if (meta) {
                groupMemberCounts[meta.groupIndex] = (groupMemberCounts[meta.groupIndex] || 0) + 1;
              }
            });

            const cardsPerPage = 6;
            const pages: string[][] = [];
            for (let i = 0; i < shares.length; i += cardsPerPage) {
              pages.push(shares.slice(i, i + cardsPerPage));
            }

            const now = new Date();
            const timestampStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
            const versionString = typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__ ? __APP_VERSION__ : undefined;

            return pages.map((pageShares, pageIdx) => (
              <div key={pageIdx} className="print-page">
                {/* Print Header */}
                <div className="print-header font-sans">
                  <div className="header-logo">
                    <Shield className="h-5 w-5 text-white" />
                  </div>
                  <div className="header-text-container">
                    <div className="header-title">
                      WordCrux <span className="badge">SLIP39</span>
                    </div>
                    <div className="header-subtitle">
                      Shamir's Secret Sharing for Mnemonic Seeds
                    </div>
                  </div>
                </div>

                <div className="cards-grid-2col">
                  {pageShares.map((share, relativeIdx) => {
                    const idx = pageIdx * cardsPerPage + relativeIdx;
                    const words = share.split(/\s+/).filter(Boolean);
                    const metadata = decodeShareMetadata(share);

                    let metadataLeftStr = `Share #${idx + 1}`;
                    let metadataRightStr = "";

                    if (metadata && isAdvanced) {
                      metadataRightStr = `Group ${metadata.groupIndex + 1} | Share ${metadata.memberIndex + 1}`;
                    }

                    return (
                      <div key={idx} className="share-block">
                        <div className="metadata-container font-sans">
                          <span className="metadata-title">{metadataLeftStr}</span>
                          {metadataRightStr && (
                            <span className="metadata-details">{metadataRightStr}</span>
                          )}
                        </div>
                        <div className="card">
                          <div className="words-grid">
                            {words.map((word, wordIdx) => {
                              const numStr = (wordIdx + 1).toString().padStart(2, "0");
                              return (
                                <div key={wordIdx} className="word-cell">
                                  <span className="word-index">{numStr}</span>
                                  <span className="word-text">{word}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Print Footer */}
                <div className="print-footer font-sans">
                  <div className="print-footer-row">
                    <div className="print-footer-repo">
                      <GithubIcon className="h-3.5 w-3.5 text-slate-700" />
                      <span className="font-mono text-slate-700 font-semibold text-[11px]">lior21/wordcrux-slip39</span>
                      {versionString && (
                        <>
                          <span className="text-slate-400 font-mono text-[10px] select-none">•</span>
                          <span className="print-footer-badge font-mono">
                            v{versionString}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="print-footer-row print-footer-subrow">
                    <span className="print-footer-timestamp font-mono">
                      Generated: {timestampStr}
                    </span>
                    <span className="print-footer-page font-mono">
                      Page {pageIdx + 1} of {pages.length}
                    </span>
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>
      </>
    )}
    </div>
  );
}
