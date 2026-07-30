import { useState, useEffect } from "react";
import {
  ShieldAlert,
  Plus,
  Trash2,
  Key,
  Info,
  Check,
  Eye,
  EyeOff,
  Clipboard,
  AlertCircle,
  Wand2,
} from "lucide-react";
import MnemonicInput from "./MnemonicInput";
import {
  SLIP39_WORD_LIST,
  decodeShareMetadata,
  slip39ToBip39,
  validateSlip39Mnemonic,
  attemptCorrectSlip39Mnemonic,
} from "../slip39Service";
import type { ShareMetadata } from "../slip39Service";


interface ShareInput {
  id: string;
  words: string[];
  metadata: ShareMetadata | null;
  isValid: boolean;
}

export default function Recoverer() {
  const [shareInputs, setShareInputs] = useState<ShareInput[]>([
    { id: "1", words: Array(20).fill(""), metadata: null, isValid: false },
  ]);
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);

  // Recovery output
  const [recoveredMnemonic, setRecoveredMnemonic] = useState<string | null>(
    null,
  );
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [copiedMnemonic, setCopiedMnemonic] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Group analysis state
  const [identifier, setIdentifier] = useState<number | null>(null);
  const [mismatchedIdentifiers, setMismatchedIdentifiers] = useState(false);
  const [groupStatus, setGroupStatus] = useState<
    Record<
      number,
      {
        count: number;
        threshold: number;
        totalAvailable: number;
        enteredCount: number;
        shares: string[];
      }
    >
  >({});
  const [metGroupsThreshold, setMetGroupsThreshold] = useState(false);
  const [neededGroupsCount, setNeededGroupsCount] = useState<number>(0);
  const [enteredGroupsCount, setEnteredGroupsCount] = useState<number>(0);

  // Update share inputs list
  const addShareInput = () => {
    setShareInputs((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        words: Array(20).fill(""),
        metadata: null,
        isValid: false,
      },
    ]);
  };

  const removeShareInput = (id: string) => {
    if (shareInputs.length <= 1) return;
    setShareInputs((prev) => prev.filter((item) => item.id !== id));
  };

  const [correctedShares, setCorrectedShares] = useState<
    Record<
      string,
      {
        original: string[];
        corrected: string[];
        diffIndex: number;
      }
    >
  >({});

  const updateShareWords = (id: string, words: string[]) => {
    setShareInputs((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const phrase = words.join(" ");
        const meta = decodeShareMetadata(phrase);
        const isValid = meta !== null;
        return {
          ...item,
          words,
          metadata: meta,
          isValid,
        };
      }),
    );

    // If this share was marked as corrected, remove it from correctedShares if the user edits it.
    setCorrectedShares((prev) => {
      if (!prev[id]) return prev;
      const wasModifiedAfterCorrect = words.some((w, idx) => w !== prev[id].corrected[idx]);
      if (wasModifiedAfterCorrect) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return prev;
    });
  };

  const handleAutoFix = (id: string, originalWords: string[], correctedWords: string[]) => {
    const diffIndex = originalWords.findIndex((w, idx) => w !== correctedWords[idx]);
    
    // 1. Add to correctedShares
    setCorrectedShares((prev) => ({
      ...prev,
      [id]: {
        original: originalWords,
        corrected: correctedWords,
        diffIndex,
      },
    }));

    // 2. Update the words
    updateShareWords(id, correctedWords);
  };

  // Analyze shares to check validation & threshold completion
  useEffect(() => {
    const validShares = shareInputs.filter(
      (item) => item.isValid && item.metadata,
    );

    // Check backup identifiers matching
    if (validShares.length > 0) {
      const ids = validShares.map((s) => s.metadata!.identifier);
      const firstId = ids[0];
      const mismatch = ids.some((id) => id !== firstId);
      setIdentifier(firstId);
      setMismatchedIdentifiers(mismatch);
    } else {
      setIdentifier(null);
      setMismatchedIdentifiers(false);
    }

    // Analyze groups
    const analysis: Record<
      number,
      {
        count: number;
        threshold: number;
        totalAvailable: number;
        enteredCount: number;
        shares: string[];
      }
    > = {};

    validShares.forEach((s) => {
      const meta = s.metadata!;
      const gIdx = meta.groupIndex;
      if (!analysis[gIdx]) {
        analysis[gIdx] = {
          count: meta.memberThreshold,
          threshold: meta.memberThreshold,
          totalAvailable: 0,
          enteredCount: 0,
          shares: [],
        };
      }
      const sharePhrase = s.words.join(" ");
      // Avoid duplicate shares in the same slot
      if (!analysis[gIdx].shares.includes(sharePhrase)) {
        analysis[gIdx].shares.push(sharePhrase);
        analysis[gIdx].enteredCount++;
      }
    });

    setGroupStatus(analysis);

    // Calculate group completion
    if (validShares.length > 0) {
      const meta = validShares[0].metadata!;
      const groupThresh = meta.groupThreshold; // e.g. 1 (needed groups)
      setNeededGroupsCount(groupThresh);

      // A group is complete if enteredCount >= threshold
      const completedGroups = Object.values(analysis).filter(
        (g) => g.enteredCount >= g.threshold,
      );
      setEnteredGroupsCount(completedGroups.length);
      setMetGroupsThreshold(completedGroups.length >= groupThresh);
    } else {
      setNeededGroupsCount(0);
      setEnteredGroupsCount(0);
      setMetGroupsThreshold(false);
    }
  }, [shareInputs]);

  const handleRecover = () => {
    setError(null);
    setRecoveredMnemonic(null);
    setShowMnemonic(false);

    if (mismatchedIdentifiers) {
      setError(
        "You entered shares from different backups. Check the Backup Identifier tags.",
      );
      return;
    }

    const validSharesList = shareInputs
      .filter((item) => item.isValid)
      .map((item) => item.words.join(" "));

    if (validSharesList.length === 0) {
      setError("Please fill in at least one valid 20-word SLIP-39 share.");
      return;
    }

    try {
      const recovered = slip39ToBip39(validSharesList, passphrase);
      setRecoveredMnemonic(recovered);
      setShowMnemonic(true);
    } catch (err: any) {
      setError(
        err.message ||
          "Recovery failed. Verify that you have enough shares and the correct passphrase.",
      );
    }
  };

  const handleCopyMnemonic = () => {
    if (!recoveredMnemonic) return;
    navigator.clipboard.writeText(recoveredMnemonic);
    setCopiedMnemonic(true);
    setTimeout(() => setCopiedMnemonic(false), 2000);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Group Analysis Panel */}
      {shareInputs.some((s) => s.isValid) && (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl">
          <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <Info className="h-5 w-5 text-violet-400" />
            Backup Metadata Summary
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Backup ID Card */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-900">
              <span className="text-xs text-slate-400 font-medium block mb-1">
                Backup Identifier
              </span>
              {mismatchedIdentifiers ? (
                <div className="flex items-center gap-2 text-rose-400 font-medium text-sm">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  Mismatched Backups!
                </div>
              ) : (
                <span className="font-mono text-lg text-violet-300 font-semibold">
                  ID: {identifier !== null ? `#${identifier}` : "---"}
                </span>
              )}
            </div>

            {/* Threshold Progress */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-900">
              <span className="text-xs text-slate-400 font-medium block mb-1">
                Groups Threshold Progress
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`text-lg font-mono font-semibold ${metGroupsThreshold ? "text-emerald-400" : "text-slate-300"}`}
                >
                  {enteredGroupsCount} / {neededGroupsCount}
                </span>
                <span className="text-xs text-slate-400">groups completed</span>
              </div>
            </div>

            {/* Overall status */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 flex items-center">
              {metGroupsThreshold && !mismatchedIdentifiers ? (
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                  <Check className="h-5 w-5 animate-pulse" />
                  Ready for Recovery!
                </div>
              ) : (
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                  <AlertCircle className="h-4 w-4 text-slate-500 shrink-0" />
                  Need more shares to meet thresholds.
                </div>
              )}
            </div>
          </div>

          {/* Group details list */}
          {Object.keys(groupStatus).length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Active Group Details
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(groupStatus).map(([gIdx, status]) => {
                  const isGroupComplete =
                    status.enteredCount >= status.threshold;
                  return (
                    <div
                      key={gIdx}
                      className={`flex justify-between items-center p-3 rounded-lg border text-xs ${
                        isGroupComplete
                          ? "bg-emerald-950/20 border-emerald-900/50 text-emerald-300"
                          : "bg-slate-900 border-slate-800 text-slate-300"
                      }`}
                    >
                      <span className="font-medium">
                        Group {parseInt(gIdx) + 1} (Threshold:{" "}
                        {status.threshold}-of-Members)
                      </span>
                      <span className="font-mono">
                        {status.enteredCount} / {status.threshold} shares
                        entered
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Share inputs container */}
      <div className="space-y-6">
        {shareInputs.map((input, idx) => (
          <div
            key={input.id}
            className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl relative focus-within:z-20 z-10"
          >
            {/* Glow effect on valid share */}
            {input.isValid && (
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-xl -z-10"></div>
            )}

            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-200">
                  SLIP-39 Share #{idx + 1}
                </span>
                {input.isValid && input.metadata && (
                  <span className="text-xs px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-md">
                    Group {input.metadata.groupIndex + 1} | Share{" "}
                    {input.metadata.memberIndex + 1}
                  </span>
                )}
              </div>
              {shareInputs.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeShareInput(input.id)}
                  className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              )}
            </div>

            <MnemonicInput
              wordCount={20}
              wordlist={SLIP39_WORD_LIST}
              words={input.words}
              onChange={(words) => updateShareWords(input.id, words)}
              labelPrefix="Share Word"
              onValidatePhrase={validateSlip39Mnemonic}
            />

            {/* Auto-Fix Section */}
            {(() => {
              // Only check if all words are filled and are valid words in the wordlist
              const isFull = input.words.length === 20 && input.words.every((w) => w.trim() !== "");
              const areAllWordsValid = isFull && input.words.every((w) => SLIP39_WORD_LIST.includes(w.toLowerCase().trim()));
              const isChecksumInvalid = areAllWordsValid && !validateSlip39Mnemonic(input.words.join(" "));

              if (!isChecksumInvalid) {
                // If it was corrected, show the success and warning box
                const correctedInfo = correctedShares[input.id];
                if (correctedInfo) {
                  const originalWord = correctedInfo.original[correctedInfo.diffIndex];
                  const correctedWord = correctedInfo.corrected[correctedInfo.diffIndex];
                  return (
                    <div className="mt-4 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2.5 animate-fade-in text-xs">
                      <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                        <Check className="h-4 w-4 shrink-0" />
                        <span>
                          Word #{correctedInfo.diffIndex + 1} auto-corrected:{" "}
                          <span className="line-through text-slate-500">{originalWord}</span>{" "}
                          ➔ <span className="font-mono bg-emerald-500/10 px-1 py-0.5 rounded text-emerald-300 font-semibold">{correctedWord}</span>
                        </span>
                      </div>
                      <div className="bg-amber-500/5 border border-amber-500/20 text-amber-300 p-3 rounded-lg flex gap-2">
                        <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                        <div>
                          <p className="font-semibold mb-0.5 text-amber-400">Verification Required</p>
                          <p className="text-[11px] leading-relaxed text-slate-400">
                            The share has been corrected to satisfy the checksum. Please verify that its 
                            <strong className="text-amber-200"> Backup ID ({input.metadata?.identifier !== undefined ? `#${input.metadata.identifier}` : "---"})</strong> and 
                            <strong className="text-amber-200"> Group/Member index</strong> match your other shares. 
                            If they do not match, the correction may have targeted the wrong word due to multiple initial input errors.
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }

              // Otherwise, if checksum is invalid, compute if a correction is possible
              const correctedPhrase = attemptCorrectSlip39Mnemonic(input.words.join(" "));
              const isFixable = correctedPhrase !== null;

              return (
                <div className="mt-4 p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in text-xs">
                  <div className="space-y-1">
                    <span className="font-semibold block text-slate-300">
                      {isFixable ? "🔧 Correctable Error Detected" : "⚠️ Uncorrectable Error"}
                    </span>
                    <span className="text-slate-400 text-[11px] leading-relaxed block max-w-lg">
                      {isFixable 
                        ? "A single-word substitution error has been found. You can attempt to automatically correct this share."
                        : "Multiple word errors or an unsupported configuration detected. Auto-correction is not possible for this share."
                      }
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={!isFixable}
                    onClick={() => {
                      if (correctedPhrase) {
                        handleAutoFix(input.id, [...input.words], correctedPhrase.split(" "));
                      }
                    }}
                    className={`flex items-center justify-center gap-1.5 px-4 py-2 font-semibold rounded-lg shrink-0 transition-all duration-200 ${
                      isFixable
                        ? "bg-violet-600/20 hover:bg-violet-600 text-violet-300 hover:text-white border border-violet-500/30"
                        : "bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed"
                    }`}
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    Attempt Auto-Fix
                  </button>
                </div>
              );
            })()}
          </div>
        ))}
      </div>

      {/* Add Share and Submit Actions */}
      <div className="flex flex-col items-center justify-center gap-6">
        <button
          type="button"
          onClick={addShareInput}
          className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 hover:bg-slate-700/80 text-violet-300 font-semibold border border-slate-700 hover:border-slate-600 rounded-xl transition-all duration-200"
        >
          <Plus className="h-4 w-4" />
          Add Share Mnemonic
        </button>

        <div className="w-full max-w-lg bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-300 flex items-center gap-2 mb-2">
              <Key className="h-4 w-4 text-violet-400" />
              Decryption Passphrase
            </label>
            <div className="relative">
              <input
                type={showPassphrase ? "text" : "password"}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
                placeholder="Enter passphrase (if used)..."
              />
              <button
                type="button"
                onClick={() => setShowPassphrase((prev) => !prev)}
                className="absolute right-3 top-[50%] -translate-y-[50%] text-xs text-slate-400 hover:text-slate-200"
              >
                {showPassphrase ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-xl text-xs text-center">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleRecover}
            className="w-full py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-violet-600/20 hover:-translate-y-0.5 active:translate-y-0"
          >
            Reconstruct BIP-39 Seed
          </button>
        </div>
      </div>

      {/* Recovered Output Mnemonic */}
      {recoveredMnemonic && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl animate-fade-in">
          <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2 mb-2">
            <Check className="h-5 w-5 text-emerald-400" />
            Recovered BIP-39 Seed Mnemonic
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            Your master seed phrase was successfully reconstructed client-side.
            Keep it safe!
          </p>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-950 border border-slate-900 p-5 rounded-xl">
            <div className="font-mono text-sm leading-relaxed tracking-wider break-words select-all select-none pr-4 w-full">
              {showMnemonic ? (
                <span className="text-emerald-400 font-semibold">
                  {recoveredMnemonic}
                </span>
              ) : (
                <span className="text-slate-600 font-semibold select-none">
                  •••• •••• •••• •••• •••• •••• •••• •••• •••• •••• •••• ••••
                </span>
              )}
            </div>

            <div className="flex gap-2 shrink-0 self-end lg:self-center">
              <button
                type="button"
                onClick={() => setShowMnemonic((prev) => !prev)}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-medium rounded-xl text-xs transition-colors"
              >
                {showMnemonic ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" />
                    Hide Mnemonic
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" />
                    Show Mnemonic
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCopyMnemonic}
                className={`flex items-center gap-1.5 px-4 py-2 border rounded-xl font-medium text-xs transition-all duration-200 ${
                  copiedMnemonic
                    ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-300"
                    : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
                }`}
              >
                {copiedMnemonic ? (
                  <>
                    <Check className="h-3.5 w-3.5 animate-bounce" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Clipboard className="h-3.5 w-3.5" />
                    Copy Seed
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
