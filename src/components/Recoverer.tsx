import { useState, useEffect, useRef, useMemo } from "react";
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
  ChevronDown,
  ChevronUp,
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

export type ShareValidationStatus =
  | { type: "valid" }
  | { type: "conflict_identifier"; expectedId: number; actualId: number }
  | { type: "conflict_iteration"; expectedExp: number; actualExp: number }
  | { type: "conflict_group_count"; expectedCount: number; actualCount: number }
  | { type: "conflict_group_threshold"; expectedThreshold: number; actualThreshold: number }
  | { type: "duplicate"; originalCardIdx: number }
  | { type: "incomplete" };

interface AnalyzedShare {
  cardIdx: number;
  input: ShareInput;
  status: ShareValidationStatus;
}

interface GroupShareItem {
  cardIdx: number;
  memberIndex: number;
  phrase: string;
}

interface GroupAnalysis {
  groupIndex: number;
  threshold: number;
  enteredCount: number;
  shares: GroupShareItem[];
}

export default function Recoverer() {
  const [shareInputs, setShareInputs] = useState<ShareInput[]>([
    { id: "1", words: Array(20).fill(""), metadata: null, isValid: false },
  ]);
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [isStuck, setIsStuck] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);

  // Recovery output
  const [recoveredMnemonic, setRecoveredMnemonic] = useState<string | null>(null);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [copiedMnemonic, setCopiedMnemonic] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track auto-corrected shares
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

  // Detect when the dock is actually sticking to the viewport bottom
  useEffect(() => {
    const handleCheck = () => {
      if (!dockRef.current) return;
      const rect = dockRef.current.getBoundingClientRect();
      const stuck = Math.abs(rect.bottom - window.innerHeight) <= 3;
      setIsStuck(stuck);
    };

    handleCheck();
    window.addEventListener("scroll", handleCheck, { passive: true });
    window.addEventListener("resize", handleCheck, { passive: true });

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && dockRef.current) {
      ro = new ResizeObserver(handleCheck);
      ro.observe(dockRef.current);
    }

    return () => {
      window.removeEventListener("scroll", handleCheck);
      window.removeEventListener("resize", handleCheck);
      ro?.disconnect();
    };
  }, [isDockCollapsed, shareInputs.length]);

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
    setCorrectedShares((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });

    setShareInputs((prev) => {
      if (prev.length <= 1) {
        return [
          {
            id: Date.now().toString(),
            words: Array(20).fill(""),
            metadata: null,
            isValid: false,
          },
        ];
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const updateShareWords = (id: string, words: string[]) => {
    setShareInputs((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const phrase = words.join(" ");
        const meta = decodeShareMetadata(phrase);
        const isChecksumValid = validateSlip39Mnemonic(phrase);
        const isValid = meta !== null && isChecksumValid;
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

    setCorrectedShares((prev) => ({
      ...prev,
      [id]: {
        original: originalWords,
        corrected: correctedWords,
        diffIndex,
      },
    }));

    updateShareWords(id, correctedWords);
  };

  // --- Schema Locking & Structural Analysis Engine ---
  const {
    sessionMeta,
    analyzedShares,
    validShares,
    conflictingShares,
    duplicateShares,
    isSingleGroup,
    groups,
    singleGroupThreshold,
    singleGroupEnteredCount,
    neededGroupsCount,
    enteredGroupsCount,
    metGroupsThreshold,
    hasInvalidEnteredShares,
    hasConflicts,
    hasDuplicates,
    isReadyForRecovery,
  } = useMemo(() => {
    // 1. First valid share locks the Session Schema
    const firstValid = shareInputs.find((s) => s.isValid && s.metadata);
    const session = firstValid?.metadata ?? null;

    // 2. Classify each share input
    const analyzed: AnalyzedShare[] = [];
    const seenShareKeys = new Map<string, number>(); // "groupIndex-memberIndex" -> cardIdx

    shareInputs.forEach((input, cardIdx) => {
      if (!input.isValid || !input.metadata) {
        analyzed.push({ cardIdx, input, status: { type: "incomplete" } });
        return;
      }

      const meta = input.metadata;

      if (!session) {
        analyzed.push({ cardIdx, input, status: { type: "incomplete" } });
        return;
      }

      // Check conflict against the locked session schema
      if (meta.identifier !== session.identifier) {
        analyzed.push({
          cardIdx,
          input,
          status: {
            type: "conflict_identifier",
            expectedId: session.identifier,
            actualId: meta.identifier,
          },
        });
        return;
      }

      if (meta.iterationExponent !== session.iterationExponent) {
        analyzed.push({
          cardIdx,
          input,
          status: {
            type: "conflict_iteration",
            expectedExp: session.iterationExponent,
            actualExp: meta.iterationExponent,
          },
        });
        return;
      }

      if (meta.groupCount !== session.groupCount) {
        analyzed.push({
          cardIdx,
          input,
          status: {
            type: "conflict_group_count",
            expectedCount: session.groupCount,
            actualCount: meta.groupCount,
          },
        });
        return;
      }

      if (meta.groupThreshold !== session.groupThreshold) {
        analyzed.push({
          cardIdx,
          input,
          status: {
            type: "conflict_group_threshold",
            expectedThreshold: session.groupThreshold,
            actualThreshold: meta.groupThreshold,
          },
        });
        return;
      }

      // Check duplicate share
      const shareKey = `${meta.groupIndex}-${meta.memberIndex}`;
      if (seenShareKeys.has(shareKey)) {
        const originalCardIdx = seenShareKeys.get(shareKey)!;
        analyzed.push({
          cardIdx,
          input,
          status: {
            type: "duplicate",
            originalCardIdx,
          },
        });
        return;
      }

      // Valid contributing share
      seenShareKeys.set(shareKey, cardIdx);
      analyzed.push({ cardIdx, input, status: { type: "valid" } });
    });

    const valids = analyzed.filter((s) => s.status.type === "valid");
    const conflicts = analyzed.filter((s) => s.status.type.startsWith("conflict"));
    const duplicates = analyzed.filter((s) => s.status.type === "duplicate");

    const singleGroup = session !== null && session.groupCount === 1;

    // 3. Build group analysis exclusively from valid shares
    const groupMap: Record<number, GroupAnalysis> = {};

    if (session) {
      if (singleGroup) {
        groupMap[0] = {
          groupIndex: 0,
          threshold: session.memberThreshold,
          enteredCount: 0,
          shares: [],
        };
      }

      valids.forEach(({ cardIdx, input }) => {
        const meta = input.metadata!;
        const gIdx = meta.groupIndex;
        if (!groupMap[gIdx]) {
          groupMap[gIdx] = {
            groupIndex: gIdx,
            threshold: meta.memberThreshold,
            enteredCount: 0,
            shares: [],
          };
        }
        groupMap[gIdx].shares.push({
          cardIdx,
          memberIndex: meta.memberIndex,
          phrase: input.words.join(" "),
        });
        groupMap[gIdx].enteredCount++;
      });

      // Sort shares by memberIndex for scannable ordering
      Object.values(groupMap).forEach((g) => {
        g.shares.sort((a, b) => a.memberIndex - b.memberIndex);
      });
    }

    const neededGroups = session?.groupThreshold ?? 0;
    const completedGroups = Object.values(groupMap).filter(
      (g) => g.enteredCount >= g.threshold,
    );
    const enteredGroups = completedGroups.length;
    const metGroups = session !== null && enteredGroups >= neededGroups;

    const singleThreshold = singleGroup ? (session?.memberThreshold ?? 0) : 0;
    const singleEntered = singleGroup ? (groupMap[0]?.enteredCount ?? 0) : 0;

    const invalidEntered = shareInputs.some(
      (s) => s.words.some((w) => w.trim() !== "") && !s.isValid,
    );

    const ready =
      session !== null &&
      metGroups &&
      conflicts.length === 0 &&
      duplicates.length === 0 &&
      !invalidEntered;

    return {
      sessionMeta: session,
      analyzedShares: analyzed,
      validShares: valids,
      conflictingShares: conflicts,
      duplicateShares: duplicates,
      isSingleGroup: singleGroup,
      groups: groupMap,
      singleGroupThreshold: singleThreshold,
      singleGroupEnteredCount: singleEntered,
      neededGroupsCount: neededGroups,
      enteredGroupsCount: enteredGroups,
      metGroupsThreshold: metGroups,
      hasInvalidEnteredShares: invalidEntered,
      hasConflicts: conflicts.length > 0,
      hasDuplicates: duplicates.length > 0,
      isReadyForRecovery: ready,
    };
  }, [shareInputs]);

  const handleRecover = () => {
    if (!isReadyForRecovery) return;
    setError(null);
    setRecoveredMnemonic(null);
    setShowMnemonic(false);

    if (hasConflicts) {
      setError("Please resolve or remove conflicting shares before recovering.");
      setIsDockCollapsed(false);
      return;
    }

    if (hasDuplicates) {
      setError("Please remove duplicate shares before recovering.");
      setIsDockCollapsed(false);
      return;
    }

    const validSharesList = validShares.map((s) => s.input.words.join(" "));

    if (validSharesList.length === 0) {
      setError("Please fill in at least one valid 20-word SLIP-39 share.");
      setIsDockCollapsed(false);
      return;
    }

    try {
      const recovered = slip39ToBip39(validSharesList, passphrase);
      setRecoveredMnemonic(recovered);
      setShowMnemonic(true);
      setIsDockCollapsed(false);
    } catch (err: any) {
      setError(
        err.message ||
          "Recovery failed. Verify that you have enough shares and the correct passphrase.",
      );
      setIsDockCollapsed(false);
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
      {/* Share inputs container */}
      <div className="space-y-6">
        {shareInputs.map((input, idx) => {
          const analysis = analyzedShares[idx];
          const isShareValid = input.isValid && input.metadata !== null;
          const isConflict = analysis?.status.type.startsWith("conflict");
          const isDuplicate = analysis?.status.type === "duplicate";

          return (
            <div
              key={input.id}
              className={`bg-white/80 dark:bg-slate-900/40 border rounded-2xl p-6 backdrop-blur-xl relative focus-within:z-20 z-10 shadow-sm dark:shadow-none transition-colors duration-200 ${
                isConflict
                  ? "border-rose-500/40 dark:border-rose-500/30"
                  : isDuplicate
                  ? "border-amber-500/40 dark:border-amber-500/30"
                  : "border-slate-200 dark:border-slate-800/80"
              }`}
            >
              {/* Contextual Glow */}
              {isShareValid && analysis?.status.type === "valid" && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-xl -z-10 pointer-events-none"></div>
              )}
              {isConflict && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-xl -z-10 pointer-events-none"></div>
              )}

              <div className="flex items-center justify-between mb-4 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                    SLIP-39 Share #{idx + 1}
                  </span>

                  {/* Contextual Share Header Badges */}
                  {isShareValid && analysis && (() => {
                    if (analysis.status.type === "conflict_identifier") {
                      return (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-400 rounded-md font-medium">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          Wrong Backup (ID #{analysis.status.actualId} vs #{analysis.status.expectedId})
                        </span>
                      );
                    }

                    if (analysis.status.type.startsWith("conflict")) {
                      return (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-400 rounded-md font-medium">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          Configuration Mismatch
                        </span>
                      );
                    }

                    if (analysis.status.type === "duplicate") {
                      return (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-400 rounded-md font-medium">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          Duplicate of Share #{analysis.status.originalCardIdx + 1}
                        </span>
                      );
                    }

                    // Valid share matching session
                    return (
                      <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-md font-medium">
                        {isSingleGroup
                          ? `Backup #${input.metadata!.identifier} · Share ${input.metadata!.memberIndex + 1}`
                          : `Backup #${input.metadata!.identifier} · Group ${input.metadata!.groupIndex + 1} · Share ${input.metadata!.memberIndex + 1}`}
                      </span>
                    );
                  })()}
                </div>
                <button
                  type="button"
                  onClick={() => removeShareInput(input.id)}
                  className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
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
              const isFull = input.words.length === 20 && input.words.every((w) => w.trim() !== "");
              const areAllWordsValid = isFull && input.words.every((w) => SLIP39_WORD_LIST.includes(w.toLowerCase().trim()));
              const isChecksumInvalid = areAllWordsValid && !validateSlip39Mnemonic(input.words.join(" "));

              if (!isChecksumInvalid) {
                const correctedInfo = correctedShares[input.id];
                if (correctedInfo) {
                  const originalWord = correctedInfo.original[correctedInfo.diffIndex];
                  const correctedWord = correctedInfo.corrected[correctedInfo.diffIndex];
                  return (
                    <div className="mt-4 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2.5 animate-fade-in text-xs">
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
                        <Check className="h-4 w-4 shrink-0" />
                        <span>
                          Word #{correctedInfo.diffIndex + 1} auto-corrected:{" "}
                          <span className="line-through text-slate-400 dark:text-slate-500">{originalWord}</span>{" "}
                          ➔ <span className="font-mono bg-emerald-500/10 px-1 py-0.5 rounded text-emerald-800 dark:text-emerald-300 font-semibold">{correctedWord}</span>
                        </span>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 p-3 rounded-lg flex gap-2">
                        <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                        <div>
                          <p className="font-semibold mb-0.5 text-amber-800 dark:text-amber-400">Verification Required</p>
                          <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                            The share has been corrected to satisfy the checksum. Please verify that its 
                            <strong className="text-amber-900 dark:text-amber-200"> Backup ID ({input.metadata?.identifier !== undefined ? `#${input.metadata.identifier}` : "---"})</strong> and 
                            <strong className="text-amber-900 dark:text-amber-200"> Group/Member index</strong> match your other shares. 
                            If they do not match, the correction may have targeted the wrong word due to multiple initial input errors.
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }

              const correctedPhrase = attemptCorrectSlip39Mnemonic(input.words.join(" "));
              const isFixable = correctedPhrase !== null;

              return (
                <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in text-xs">
                  <div className="space-y-1">
                    <span className="font-semibold block text-slate-900 dark:text-slate-300">
                      {isFixable ? "🔧 Correctable Error Detected" : "⚠️ Uncorrectable Error"}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed block max-w-lg">
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
                    className={`flex items-center justify-center gap-1.5 px-4 py-2 font-semibold rounded-lg shrink-0 transition-all duration-200 cursor-pointer ${
                      isFixable
                        ? "bg-violet-500/10 hover:bg-violet-600 dark:bg-violet-600/20 text-violet-700 dark:text-violet-300 hover:text-white border border-violet-500/30"
                        : "bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                    }`}
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    Attempt Auto-Fix
                  </button>
                </div>
              );
            })()}
          </div>
        );
      })}
      </div>

      {/* Add Share Action */}
      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={addShareInput}
          className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-violet-700 dark:text-violet-300 font-semibold border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 rounded-xl transition-all duration-200 cursor-pointer shadow-sm hover:shadow"
        >
          <Plus className="h-4 w-4" />
          Add Share Mnemonic
        </button>
      </div>

      {/* Sticky Docked Bottom Panel */}
      <div className="sticky bottom-0 z-40 print-hidden">
        <div
          ref={dockRef}
          className={`bg-white/95 dark:bg-slate-900/95 p-4 sm:p-5 backdrop-blur-xl ring-1 ring-slate-900/5 dark:ring-white/10 transition-all duration-300 ${
            isStuck
              ? "border-t border-x border-b-0 border-slate-200 dark:border-slate-800/90 rounded-t-2xl rounded-b-none shadow-[0_-12px_35px_rgba(0,0,0,0.14)] dark:shadow-[0_-14px_45px_rgba(0,0,0,0.7)]"
              : "border border-slate-200 dark:border-slate-800/90 rounded-2xl shadow-sm dark:shadow-none"
          }`}
        >
            {/* Header Row: Title, Quick Badges & Minimize/Expand toggle */}
          <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5 font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                <Info className="h-4 w-4 sm:h-5 sm:w-5 text-violet-600 dark:text-violet-400 shrink-0" />
                <span>Backup Metadata & Recovery</span>
              </div>

              {/* Status & Metadata Badges */}
              <div className="flex items-center gap-1.5 text-xs font-mono flex-wrap">
                {/* 1. Session Backup Identifier */}
                {sessionMeta ? (
                  <span className="px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-700 dark:text-violet-300 font-semibold border border-violet-500/20 font-mono">
                    ID: #{sessionMeta.identifier}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-sans">
                    Awaiting shares
                  </span>
                )}

                {/* 2. Structural Progress Counter */}
                {sessionMeta && (
                  <span
                    className={`px-2 py-0.5 rounded-md font-sans text-[11px] font-medium border ${
                      metGroupsThreshold
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {isSingleGroup
                      ? `${singleGroupEnteredCount} / ${singleGroupThreshold} shares`
                      : `${enteredGroupsCount} / ${neededGroupsCount} groups`}
                  </span>
                )}

                {/* 3. Single Actionable Status Badge */}
                {recoveredMnemonic ? (
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-sans font-medium text-[11px]">
                    <Check className="h-3 w-3 shrink-0" />
                    Seed Recovered
                  </span>
                ) : isReadyForRecovery ? (
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-sans font-semibold text-[11px] animate-pulse">
                    <Check className="h-3 w-3 shrink-0" />
                    Ready for Recovery!
                  </span>
                ) : hasConflicts ? (
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-sans font-medium text-[11px]">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {conflictingShares.length === 1
                      ? `Conflict in Share #${conflictingShares[0].cardIdx + 1}`
                      : `${conflictingShares.length} Conflicting Shares`}
                  </span>
                ) : hasDuplicates ? (
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-sans font-medium text-[11px]">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {duplicateShares.length === 1
                      ? `Duplicate in Share #${duplicateShares[0].cardIdx + 1}`
                      : `${duplicateShares.length} Duplicate Shares`}
                  </span>
                ) : hasInvalidEnteredShares ? (
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-sans font-medium text-[11px]">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    Invalid share detected
                  </span>
                ) : sessionMeta ? (
                  isSingleGroup ? (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-sans font-medium text-[11px]">
                      <Info className="h-3 w-3 shrink-0 text-violet-500" />
                      {singleGroupThreshold - singleGroupEnteredCount === 1
                        ? "Need 1 more share"
                        : `Need ${singleGroupThreshold - singleGroupEnteredCount} more shares`}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-sans font-medium text-[11px]">
                      <Info className="h-3 w-3 shrink-0 text-violet-500" />
                      {neededGroupsCount - enteredGroupsCount === 1
                        ? "Need 1 more group"
                        : `Need ${neededGroupsCount - enteredGroupsCount} more groups`}
                    </span>
                  )
                ) : (
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-sans font-medium text-[11px]">
                    <Info className="h-3 w-3 shrink-0" />
                    Enter shares to begin
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsDockCollapsed((prev) => !prev)}
              aria-label={isDockCollapsed ? "Expand panel" : "Minimize panel"}
              className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              {isDockCollapsed ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  <span className="hidden sm:inline">Expand</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  <span className="hidden sm:inline">Minimize</span>
                </>
              )}
            </button>
          </div>

          {/* Expanded Content Area */}
          {!isDockCollapsed && (
            <div className="pt-2.5 space-y-2.5 max-h-[70vh] overflow-y-auto pr-0.5 animate-fade-in">
              {/* Single-Group Shares Presentation */}
              {sessionMeta && isSingleGroup && (
                <div
                  className={`p-3 rounded-xl border text-xs transition-all ${
                    metGroupsThreshold
                      ? "bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-500/30"
                      : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800/80"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
                      <span>Recovery Shares</span>
                      <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                        ({singleGroupThreshold} required)
                      </span>
                    </span>
                    <span
                      className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                        metGroupsThreshold
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25"
                          : "bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {singleGroupEnteredCount} / {singleGroupThreshold} shares entered
                    </span>
                  </div>

                  {/* Share Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {groups[0]?.shares.map((share) => (
                      <span
                        key={share.cardIdx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-md font-medium text-[11px]"
                      >
                        Share {share.memberIndex + 1}{" "}
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                          (from Share #{share.cardIdx + 1})
                        </span>
                      </span>
                    ))}

                    {Array.from({
                      length: Math.max(0, singleGroupThreshold - singleGroupEnteredCount),
                    }).map((_, i) => (
                      <span
                        key={`missing-${i}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500 rounded-md text-[11px]"
                      >
                        + 1 share needed
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Multi-Group Breakdown */}
              {sessionMeta && !isSingleGroup && Object.keys(groups).length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(groups).map(([gIdx, status]) => {
                    const isGroupComplete = status.enteredCount >= status.threshold;
                    const missingCount = Math.max(0, status.threshold - status.enteredCount);

                    return (
                      <div
                        key={gIdx}
                        className={`p-2.5 rounded-xl border text-xs transition-all ${
                          isGroupComplete
                            ? "bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-500/30"
                            : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800/80"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
                            <span>Group {parseInt(gIdx) + 1}</span>
                            <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                              ({status.threshold} shares required)
                            </span>
                          </span>
                          <span
                            className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                              isGroupComplete
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25"
                                : "bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {status.enteredCount} / {status.threshold} shares
                          </span>
                        </div>

                        {/* Share Chips */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {status.shares.map((share) => (
                            <span
                              key={share.cardIdx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-md font-medium text-[11px]"
                            >
                              Share {share.memberIndex + 1}{" "}
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                                (from Share #{share.cardIdx + 1})
                              </span>
                            </span>
                          ))}

                          {Array.from({ length: missingCount }).map((_, i) => (
                            <span
                              key={`missing-${i}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500 rounded-md text-[10.5px]"
                            >
                              + 1 share needed
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Conflicting / Excluded Shares Banner */}
              {(hasConflicts || hasDuplicates) && (
                <div className="space-y-1.5">
                  {conflictingShares.map(({ cardIdx, status }) => (
                    <div
                      key={`conflict-${cardIdx}`}
                      className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2 animate-fade-in"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                      <span>
                        <strong>Share #{cardIdx + 1} excluded:</strong>{" "}
                        {status.type === "conflict_identifier"
                          ? `Belongs to Backup ID #${status.actualId} (Session is locked to ID #${status.expectedId}).`
                          : "Backup configuration does not match the active session."}
                      </span>
                    </div>
                  ))}

                  {duplicateShares.map(({ cardIdx, status }) => (
                    <div
                      key={`duplicate-${cardIdx}`}
                      className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-400 rounded-xl text-xs flex items-center gap-2 animate-fade-in"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>
                        <strong>Share #{cardIdx + 1} excluded:</strong> Duplicate of Share #
                        {(status as any).originalCardIdx + 1}.
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Error Banner */}
              {error && (
                <div className="p-2.5 bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 rounded-xl text-xs text-center animate-fade-in font-medium">
                  {error}
                </div>
              )}

              {/* Action Controls: Passphrase & Submit Button */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-0.5">
                <div className="relative flex-grow">
                  <div className="absolute left-3 top-[50%] -translate-y-[50%] pointer-events-none text-slate-400 dark:text-slate-500">
                    <Key className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <input
                    type={showPassphrase ? "text" : "password"}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    className="w-full pl-9 pr-14 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-200 font-mono text-xs sm:text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 transition-colors"
                    placeholder="Decryption passphrase (optional)..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassphrase((prev) => !prev)}
                    className="absolute right-3 top-[50%] -translate-y-[50%] text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer select-none"
                  >
                    {showPassphrase ? "Hide" : "Show"}
                  </button>
                </div>

                <button
                  type="button"
                  disabled={!isReadyForRecovery}
                  onClick={handleRecover}
                  title={
                    isReadyForRecovery
                      ? "Reconstruct BIP-39 Seed"
                      : "Enter all required valid shares to enable recovery"
                  }
                  className={`sm:w-auto px-6 py-2.5 font-semibold rounded-xl text-xs sm:text-sm transition-all duration-200 shrink-0 ${
                    isReadyForRecovery
                      ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-md hover:shadow-violet-600/20 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                      : "bg-slate-200 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700/60 cursor-not-allowed shadow-none"
                  }`}
                >
                  Reconstruct BIP-39 Seed
                </button>
              </div>

              {/* Recovered Secret Mnemonic Display */}
              {recoveredMnemonic && (
                <div className="mt-2 bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3.5 sm:p-4 backdrop-blur-xl animate-fade-in space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      <Check className="h-4 w-4 shrink-0" />
                      <span>Recovered BIP-39 Seed Mnemonic</span>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      Reconstructed client-side
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-950 border border-emerald-500/20 p-3 rounded-lg">
                    <div className="font-mono text-xs sm:text-sm leading-relaxed tracking-wider break-words select-all pr-2 w-full">
                      {showMnemonic ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                          {recoveredMnemonic}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600 font-semibold select-none">
                          •••• •••• •••• •••• •••• •••• •••• •••• •••• •••• •••• ••••
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => setShowMnemonic((prev) => !prev)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-lg text-xs transition-colors cursor-pointer"
                      >
                        {showMnemonic ? (
                          <>
                            <EyeOff className="h-3 w-3" />
                            Hide
                          </>
                        ) : (
                          <>
                            <Eye className="h-3 w-3" />
                            Show
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleCopyMnemonic}
                        className={`flex items-center gap-1 px-3 py-1.5 border rounded-lg font-medium text-xs transition-all duration-200 cursor-pointer ${
                          copiedMnemonic
                            ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                            : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {copiedMnemonic ? (
                          <>
                            <Check className="h-3 w-3 animate-bounce" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Clipboard className="h-3 w-3" />
                            Copy Seed
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
