import { useState, useRef, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

interface MnemonicInputProps {
  wordCount: number;
  wordlist: string[];
  words: string[];
  onChange: (words: string[]) => void;
  labelPrefix?: string;
  onValidatePhrase?: (phrase: string) => boolean;
  autoFocus?: boolean | number;
}

export default function MnemonicInput({
  wordCount,
  wordlist,
  words,
  onChange,
  labelPrefix = 'Word',
  onValidatePhrase,
  autoFocus = false
}: MnemonicInputProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionIdx, setSuggestionIdx] = useState<number>(0);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const areAllWordsValid = words.length === wordCount && words.every(w => wordlist.includes(w.trim().toLowerCase()));
  const isPhraseValid = areAllWordsValid && onValidatePhrase ? onValidatePhrase(words.join(' ')) : true;

  // Auto-focus first word cell on mount if requested
  useEffect(() => {
    if (autoFocus) {
      const firstInput = inputsRef.current[0];
      if (firstInput) {
        firstInput.focus();
        firstInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [autoFocus]);

  // Initialize words array if not matching wordCount
  useEffect(() => {
    if (words.length !== wordCount) {
      const newWords = [...words];
      while (newWords.length < wordCount) newWords.push('');
      if (newWords.length > wordCount) newWords.length = wordCount;
      onChange(newWords);
    }
  }, [wordCount, words, onChange]);

  // Show/update autocomplete suggestions for a given input value
  const showSuggestionsForValue = (val: string) => {
    const cleanVal = val.trim().toLowerCase();
    if (cleanVal.length >= 2) {
      const filtered = wordlist
        .filter(w => w.startsWith(cleanVal))
        .slice(0, 5);
      setSuggestions(filtered);
      setSuggestionIdx(0);
    } else {
      setSuggestions([]);
    }
  };

  // Handle word input change
  const handleInputChange = (index: number, val: string) => {
    const cleanVal = val.trim().toLowerCase().replace(/[^a-z]/g, '');
    const updated = [...words];
    updated[index] = cleanVal;
    onChange(updated);

    const isValid = wordlist.includes(cleanVal);
    const hasExtensions = isValid && wordlist.some(w => w !== cleanVal && w.startsWith(cleanVal));

    if (isValid && !hasExtensions) {
      // Unique perfect match: select it and auto-advance!
      selectSuggestion(index, cleanVal);
    } else {
      showSuggestionsForValue(cleanVal);
    }
  };

  // Handle paste full mnemonic
  const handlePaste = (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const parsedWords = pastedText
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map(w => w.replace(/[^a-z]/g, ''))
      .filter(w => w.length > 0);

    if (parsedWords.length > 0) {
      const updated = [...words];
      for (let i = 0; i < parsedWords.length; i++) {
        if (index + i < wordCount) {
          updated[index + i] = parsedWords[i];
        }
      }
      onChange(updated);
      setSuggestions([]);
      
      // Focus on the next empty field or the last filled field
      const nextFocus = Math.min(index + parsedWords.length, wordCount - 1);
      inputsRef.current[nextFocus]?.focus();
    }
  };

  // Keyboard navigation for suggestions
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      // If there are suggestions, select the active one
      if (suggestions.length > 0) {
        e.preventDefault();
        selectSuggestion(index, suggestions[suggestionIdx]);
      } else if (words[index].length > 0 && index < wordCount - 1) {
        // Go to next input
        e.preventDefault();
        inputsRef.current[index + 1]?.focus();
      }
    } else if (e.key === 'Tab') {
      // If there are suggestions, select the active one
      if (suggestions.length > 0) {
        e.preventDefault();
        selectSuggestion(index, suggestions[suggestionIdx]);
      }
    } else if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault();
      setSuggestionIdx(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
      e.preventDefault();
      setSuggestionIdx(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Backspace' && words[index] === '' && index > 0) {
      // Go to previous input on backspace
      e.preventDefault();
      inputsRef.current[index - 1]?.focus();
    }
  };

  const selectSuggestion = (index: number, val: string) => {
    const updated = [...words];
    updated[index] = val;
    onChange(updated);
    setSuggestions([]);
    
    // Auto-focus next input
    if (index < wordCount - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  return (
    <div className="relative">
      <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-6 p-4 rounded-xl border transition-all duration-200 ${
        areAllWordsValid && !isPhraseValid
          ? 'bg-rose-500/5 border-rose-500/25 shadow-lg shadow-rose-500/5'
          : 'bg-transparent border-transparent'
      }`}>
        {Array.from({ length: wordCount }).map((_, idx) => {
          const word = words[idx] || '';
          const isValid = wordlist.includes(word);
          const isNotEmpty = word.length > 0;
          const isInputActive = activeIdx === idx;
          const activeSuggestion = isInputActive ? (suggestions[suggestionIdx] || '') : '';
          const suggestionSuffix = (activeSuggestion.startsWith(word) && word.length > 0)
            ? activeSuggestion.slice(word.length)
            : '';

          return (
            <div key={idx} className={`relative flex flex-col ${isInputActive ? 'z-30' : 'z-10'}`}>
              <label className="text-xs text-slate-600 dark:text-slate-500 mb-2 font-medium select-none">
                {labelPrefix} {idx + 1}
              </label>
              <div className="relative flex items-center">
                {/* Inline suggestion placeholder */}
                {isInputActive && suggestionSuffix && (
                  <div className="absolute left-0 top-0 bottom-0 flex items-center pl-1.5 pointer-events-none select-none font-mono text-sm leading-none">
                    <span className="opacity-0">{word}</span>
                    <span className="text-slate-400 dark:text-slate-500">{suggestionSuffix}</span>
                  </div>
                )}
                <input
                  ref={el => { inputsRef.current[idx] = el; }}
                  type="text"
                  value={word}
                  onChange={e => handleInputChange(idx, e.target.value)}
                  onPaste={e => handlePaste(idx, e)}
                  onKeyDown={e => handleKeyDown(idx, e)}
                  onFocus={() => {
                    setActiveIdx(idx);
                    showSuggestionsForValue(word);
                  }}
                  onBlur={() => {
                    // Set active index to null only if it hasn't changed to another input
                    setTimeout(() => {
                      setActiveIdx(current => current === idx ? null : current);
                    }, 150);
                  }}
                  className={`w-full pl-1.5 pr-6 py-2 bg-transparent border-x-0 border-t-0 border-b font-mono text-sm leading-none text-slate-900 dark:text-slate-100 focus:outline-none transition-all duration-200 ${
                    isNotEmpty
                      ? isValid
                        ? 'border-b-emerald-500/50 focus:border-b-emerald-400'
                        : 'border-b-rose-500/50 focus:border-b-rose-400'
                      : 'border-b-slate-300 dark:border-b-slate-700 focus:border-b-violet-500'
                  }`}
                  placeholder="---"
                  autoComplete="off"
                  spellCheck="false"
                />
                
                {/* Visual Status Indicator */}
                {isNotEmpty && (
                  <span className={`absolute right-1 top-[50%] -translate-y-[50%] rounded-full h-1.5 w-1.5 ${isValid ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                )}
              </div>

              {/* Suggestions Dropdown */}
              {activeIdx === idx && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-[100%] mt-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden font-mono text-xs">
                  {suggestions.map((sug, sIdx) => (
                    <button
                      key={sug}
                      type="button"
                      onMouseDown={() => selectSuggestion(idx, sug)}
                      className={`w-full text-left px-3 py-2 transition-colors ${
                        sIdx === suggestionIdx
                          ? 'bg-violet-600 text-white font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {areAllWordsValid && !isPhraseValid && (
        <div className="mt-5 p-3.5 bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2.5 animate-fade-in">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 dark:text-rose-400" />
          <span>Checksum Verification Failed: The combination or order of these words is invalid.</span>
        </div>
      )}
    </div>
  );
}
