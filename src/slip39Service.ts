// @ts-ignore
import * as bip39 from '@scure/bip39';
import { wordlist as bip39Wordlist } from '@scure/bip39/wordlists/english.js';
// @ts-ignore
import Slip39 from 'slip39';
// @ts-ignore
import * as slipHelper from 'slip39/src/slip39_helper.js';

export const SLIP39_WORD_LIST: string[] = slipHelper.WORD_LIST;
export const BIP39_WORD_LIST: string[] = bip39Wordlist;

/**
 * Validates a 12-word BIP-39 mnemonic phrase.
 */
export function validateBip39Mnemonic(mnemonic: string): boolean {
  const cleanMnemonic = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
  const words = cleanMnemonic.split(' ');
  if (words.length !== 12) {
    return false;
  }
  return bip39.validateMnemonic(cleanMnemonic, bip39Wordlist);
}

/**
 * Generates a random 12-word BIP-39 mnemonic.
 */
export function generateBip39Mnemonic(): string {
  return bip39.generateMnemonic(bip39Wordlist);
}

/**
 * Converts a 12-word BIP-39 mnemonic to SLIP-39 shares.
 * Returns an array of share mnemonics (each 20 words).
 * 
 * @param mnemonic 12-word BIP-39 mnemonic
 * @param passphrase Optional passphrase to encrypt the secret
 * @param groupThreshold Minimum number of group shares required to recover the secret
 * @param groups Configuration of groups as array of [memberThreshold, memberCount, description]
 */
export function bip39ToSlip39(
  mnemonic: string,
  passphrase = '',
  groupThreshold = 1,
  groups: [number, number, string][] = [[1, 1, 'Default Group']]
): string[] {
  if (!validateBip39Mnemonic(mnemonic)) {
    throw new Error('Invalid BIP-39 mnemonic phrase.');
  }

  const cleanMnemonic = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
  
  // 1. Get raw entropy (16 bytes / 128 bits)
  const entropyUint8 = bip39.mnemonicToEntropy(cleanMnemonic, bip39Wordlist);
  
  // 2. Convert to standard Array of numbers to avoid the slip39 Buffer bug!
  const entropyArray = Array.from(entropyUint8);

  // 3. Create the SLIP-39 instance
  const slip = Slip39.fromArray(entropyArray, {
    passphrase,
    threshold: groupThreshold,
    groups: groups.map(g => [g[0], g[1], g[2]]), // map elements to pass to fromArray
    iterationExponent: 0
  });

  // 4. Return all leaf mnemonics
  return slip.root.mnemonics;
}

/**
 * Recovers the 12-word BIP-39 mnemonic from a set of SLIP-39 shares.
 * 
 * @param shares List of SLIP-39 shares (each 20 words)
 * @param passphrase Optional passphrase used when creating the shares
 */
export function slip39ToBip39(shares: string[], passphrase = ''): string {
  if (!shares || shares.length === 0) {
    throw new Error('No shares provided.');
  }

  const cleanShares = shares.map(s => s.trim().toLowerCase().replace(/\s+/g, ' '));

  // 1. Recover the raw entropy array from SLIP-39 shares
  const recoveredEntropyArray = Slip39.recoverSecret(cleanShares, passphrase);
  
  // 2. Convert to Uint8Array for BIP-39
  const recoveredEntropyUint8 = new Uint8Array(recoveredEntropyArray);

  // 3. Convert entropy back to 12-word BIP-39 mnemonic
  return bip39.entropyToMnemonic(recoveredEntropyUint8, bip39Wordlist);
}

/**
 * Decodes metadata from a single SLIP-39 share.
 */
export interface ShareMetadata {
  identifier: number;
  iterationExponent: number;
  groupIndex: number;
  groupThreshold: number;
  groupCount: number;
  memberIndex: number;
  memberThreshold: number;
}

export function decodeShareMetadata(share: string): ShareMetadata | null {
  const words = share.trim().toLowerCase().split(/\s+/);
  if (words.length < 20) return null;

  const indices: number[] = [];
  for (const word of words) {
    const idx = SLIP39_WORD_LIST.indexOf(word);
    if (idx === -1) return null; // Invalid word
    indices.push(idx);
  }

  try {
    // Reconstruct fields from the first 4 words of the share
    const idExpInt = BigInt(indices[0]) * 1024n + BigInt(indices[1]);
    const identifier = Number(idExpInt >> 5n);
    const iterationExponent = Number(idExpInt & 31n);

    const tmp = BigInt(indices[2]) * 1024n + BigInt(indices[3]);
    const groupIndex = Number((tmp >> 16n) & 15n);
    const groupThreshold = Number((tmp >> 12n) & 15n) + 1;
    const groupCount = Number((tmp >> 8n) & 15n) + 1;
    const memberIndex = Number((tmp >> 4n) & 15n);
    const memberThreshold = Number(tmp & 15n) + 1;

    return {
      identifier,
      iterationExponent,
      groupIndex,
      groupThreshold,
      groupCount,
      memberIndex,
      memberThreshold
    };
  } catch {
    return null;
  }
}

/**
 * Checks if a word is in the SLIP-39 wordlist.
 */
export function validateSlip39Word(word: string): boolean {
  return SLIP39_WORD_LIST.includes(word.toLowerCase().trim());
}

/**
 * Checks if a word is in the BIP-39 wordlist.
 */
export function validateBip39Word(word: string): boolean {
  return BIP39_WORD_LIST.includes(word.toLowerCase().trim());
}

/**
 * Validates a single SLIP-39 mnemonic share including its checksum.
 */
export function validateSlip39Mnemonic(share: string): boolean {
  try {
    return Slip39.validateMnemonic(share.trim().toLowerCase().replace(/\s+/g, ' '));
  } catch {
    return false;
  }
}

/**
 * Attempts to correct a single word error in a 20-word SLIP-39 mnemonic share.
 * Returns the corrected mnemonic phrase if a unique correction is found, or null otherwise.
 */
export function attemptCorrectSlip39Mnemonic(share: string): string | null {
  const cleanMnemonic = share.trim().toLowerCase().replace(/\s+/g, ' ');
  const words = cleanMnemonic.split(' ');
  if (words.length !== 20) {
    return null;
  }

  // If any word is not in the SLIP39 wordlist, return null (handled by word-level validation)
  const allValidWords = words.every(w => SLIP39_WORD_LIST.includes(w));
  if (!allValidWords) {
    return null;
  }

  const candidateWords = [...words];

  // Try substituting each of the 20 positions
  for (let i = 0; i < words.length; i++) {
    const originalWord = words[i];

    for (const validWord of SLIP39_WORD_LIST) {
      if (validWord === originalWord) continue;

      candidateWords[i] = validWord;
      const candidatePhrase = candidateWords.join(' ');

      if (validateSlip39Mnemonic(candidatePhrase)) {
        // Since Reed-Solomon distance is 4, there is at most one unique valid codeword at distance 1.
        // We can immediately return the correction!
        return candidatePhrase;
      }
    }
    // Restore the original word for this position before moving to the next
    candidateWords[i] = originalWord;
  }

  return null;
}

