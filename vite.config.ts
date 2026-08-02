import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { viteSingleFile } from 'vite-plugin-singlefile'
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

function getRepoPrefix(fallbackName: string): string {
  if (process.env.GITHUB_REPOSITORY) {
    return process.env.GITHUB_REPOSITORY.replace(/[^a-zA-Z0-9-_]/g, '-')
  }
  try {
    const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf-8' }).trim()
    const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/)
    if (match) {
      return `${match[1]}-${match[2]}`
    }
  } catch {
    // fallback if git CLI is unavailable
  }
  return fallbackName.replace(/[^a-zA-Z0-9-_]/g, '-')
}

const pkgPath = path.resolve(__dirname, 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
const repoPrefix = getRepoPrefix(pkg.name)
const appVersion = process.env.APP_VERSION || pkg.version

function inlineFaviconPlugin() {
  return {
    name: 'inline-favicon-base64',
    transformIndexHtml(html: string) {
      const faviconPath = path.resolve(__dirname, 'public/favicon.svg')
      if (fs.existsSync(faviconPath)) {
        const svgContent = fs.readFileSync(faviconPath, 'utf-8')
        const base64 = Buffer.from(svgContent).toString('base64')
        const dataUri = `data:image/svg+xml;base64,${base64}`
        return html.replace(/<link\s+rel="icon"[^>]*>/i, `<link rel="icon" type="image/svg+xml" href="${dataUri}" />`)
      }
      return html
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __REPO_PREFIX__: JSON.stringify(repoPrefix),
  },

  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
    viteSingleFile({ removeViteModuleLoader: true }),
    inlineFaviconPlugin(),
  ],
  build: {
    assetsInlineLimit: 100000,
  },
})


