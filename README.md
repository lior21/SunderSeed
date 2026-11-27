<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/branding/lockup-dark.svg">
    <img src="docs/branding/lockup-light.svg" alt="SunderSeed" width="280">
  </picture>
</p>

<p align="center"><em>Secure, client-side Shamir's Secret Sharing (SLIP-0039) for BIP-39 seed phrases.</em></p>

<p align="center">
  <img src="docs/branding/badge-slip39.svg" alt="SLIP-39" height="24">
  <img src="docs/branding/badge-bip39.svg" alt="BIP-39" height="24">
  <img src="docs/branding/badge-offline.svg" alt="100% offline" height="24">
  <img src="docs/branding/badge-telemetry.svg" alt="zero telemetry" height="24">
</p>

<p align="center">
  <a href="https://developer.mozilla.org/en-US/observatory/analyze?host=sunderseed.pages.dev">
    <img src="https://img.shields.io/mozilla-observatory/grade-score/sunderseed.pages.dev?publish" alt="Mozilla HTTP Observatory Grade">
  </a>
  <a href="https://github.com/lior21/SunderSeed/actions/workflows/github-code-scanning/codeql">
    <img src="https://github.com/lior21/SunderSeed/actions/workflows/github-code-scanning/codeql/badge.svg" alt="CodeQL">
  </a>
  <a href="https://scorecard.dev/viewer/?uri=github.com/lior21/SunderSeed">
    <img src="https://api.scorecard.dev/projects/github.com/lior21/SunderSeed/badge" alt="OpenSSF Scorecard">
  </a>
  <a href="https://github.com/lior21/SunderSeed/commits/main">
    <img src="https://img.shields.io/github/last-commit/lior21/SunderSeed" alt="GitHub last commit">
  </a>
</p>

SunderSeed is a browser-based, offline-capable cryptographic tool designed to split a standard **12-word BIP-39 mnemonic seed phrase** into multiple **20-word SLIP-39 shares** using Shamir's Secret Sharing scheme, and to recover the original seed phrase when a required threshold of shares is provided.

---

## 🌟 Key Features

- **🔐 BIP-39 ➔ SLIP-39 Share Generation**: Split 12-word recovery seeds into custom $N$-of-$M$ SLIP-39 shares.
- **🛡️ Simple & Advanced Multi-Group Schemes**:
  - **Simple Mode**: Single threshold group (e.g. any 2-of-3 shares).
  - **Advanced Multi-Group Mode**: Complex multi-group threshold structures (e.g. require shares from $K$-of-$L$ distinct groups).
- **🔄 SLIP-39 ➔ BIP-39 Recovery**: Reconstruct original master seeds with real-time metadata analysis (Group ID, Share Indices, Threshold progress).
- **🪄 Auto-Fix Single-Word Typos**: Automatically detects and offers interactive single-word error correction for damaged or mistyped shares using SLIP-39's 1024-word list & Reed-Solomon checksum distance.
- **🖨️ Printable A4 Share Cards**: Built-in, clean print templates for physical paper backups with grid alignment, metadata tags, versioning, and timestamps.
- **💻 100% Client-Side & Air-Gapped**: Zero network requests, no external tracking, no backend dependencies.
- **📄 Single-File Offline Executable**: Export the entire application as a single self-contained `.html` file (`Ctrl+S` or header download) to run safely on air-gapped, offline hardware.
- **🌓 Dark & Light Mode**: Modern, accessible UI built with React 19, TypeScript, and Tailwind CSS v4.

---

## 🔒 Security & Air-Gap Best Practices

For maximum security when handling cryptocurrency wallet seed phrases:

1. **Use an Air-Gapped Machine**: Download the standalone `.html` bundle (or build locally using `npm run build`), transfer it via a clean USB drive to a computer disconnected from the internet (Wi-Fi off, Bluetooth disabled), and run it locally in your browser.
2. **Physical Storage**: Print your SLIP-39 share cards or write them down manually on physical medium (waterproof paper, metal plates). Store shares in physically distinct, secure locations.
3. **Clipboard Caution**: Avoid using digital clipboards on connected operating systems with active clipboard managers.

---

## 🚀 Getting Started

### Local Development

Ensure you have [Node.js](https://nodejs.org/) (v18+) installed.

```bash
# Clone the repository
git clone https://github.com/lior21/SunderSeed.git
cd SunderSeed

# Install dependencies
npm install

# Start local development server
npm run dev
```

### Building Single-File Standalone HTML

To build the self-contained single-file offline application:

```bash
npm run build
```

The compiled standalone tool will be output to `dist/index.html`. You can open this file directly in any modern web browser without internet connection.

### Code Quality & Linting

```bash
npm run lint
```

---

## 🛠️ Technology Stack

- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vite.dev/) with [`vite-plugin-singlefile`](https://github.com/richard-rogers/vite-plugin-singlefile)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Cryptographic Libraries**:
  - [`@scure/bip39`](https://github.com/paulmillr/scure-bip39) by Paul Miller (noble/scure) for BIP-39 mnemonic verification & entropy conversion.
  - [`slip39`](https://github.com/ilap/slip39-js) (`ilap/slip39-js`) implementing the [SatoshiLabs SLIP-0039](https://github.com/satoshilabs/slips/blob/master/slip-0039.md) Shamir's Secret Sharing specification.
- **Icons**: [Lucide React](https://lucide.dev/)

---

## 📄 License

This project is licensed under the [PolyForm Strict License 1.0.0](LICENSE). Non-commercial use and personal security use are permitted under the terms of the license.

---

## ⚠️ Disclaimer

This tool is provided "as is", without warranty of any kind. Always test your recovery workflow with non-critical phrases before trusting high-value wallet seeds to any backup scheme.

