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

function renameOutputPlugin() {
  return {
    name: 'rename-single-file-output',
    closeBundle() {
      const pkgPath = path.resolve(__dirname, 'package.json')
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      const oldPath = path.resolve(__dirname, 'dist/index.html')
      const prefix = getRepoPrefix(pkg.name)
      const newFilename = `${prefix}-v${pkg.version}.html`
      const newPath = path.resolve(__dirname, `dist/${newFilename}`)

      if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath)
        console.log(`\n Output file renamed to: dist/${newFilename}\n`)
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
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
    renameOutputPlugin(),
  ],
  build: {
    assetsInlineLimit: 100000,
  },
})

