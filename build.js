#!/usr/bin/env node

/**
 * Build script for SoftoVault SDK
 * Generates CommonJS version from ES modules
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function buildCommonJS() {
  console.log('Building CommonJS version...')
  
  // Read the ES module version
  const esmContent = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8')
  
  // Convert ES modules to CommonJS
  let cjsContent = esmContent
    .replace(/export class Vault/g, 'class Vault')
    .replace(/export \{[^}]+\}/g, '') // Remove named exports
  
  // Add CommonJS exports at the end
  cjsContent += `

module.exports = { Vault }
module.exports.Vault = Vault
module.exports.default = Vault
`
  
  // Add fetch polyfill setup for Node.js
  const fetchSetup = `
  /**
   * Setup fetch for different environments
   * @private
   */
  _setupFetch() {
    if (typeof fetch === 'undefined') {
      try {
        // Try to use node-fetch if available
        const nodeFetch = require('node-fetch')
        global.fetch = nodeFetch.default || nodeFetch
        global.AbortController = require('abort-controller')
      } catch (error) {
        // Fallback for Node.js 18+ with built-in fetch
        if (typeof globalThis.fetch !== 'undefined') {
          global.fetch = globalThis.fetch
          global.AbortController = globalThis.AbortController
        } else {
          throw new Error('fetch is not available. Please install node-fetch or use Node.js 18+')
        }
      }
    }
  }
`
  
  // Add fetch setup call to constructor
  cjsContent = cjsContent.replace(
    /(this\.cacheTimestamps = new Map\(\)\s+}\s+})/,
    `$1
    
    // Import fetch for Node.js environments
    this._setupFetch()
  }`
  )
  
  // Insert the _setupFetch method
  cjsContent = cjsContent.replace(
    /(}\s*\/\*\*\s*\* Make HTTP request)/,
    `}${fetchSetup}

  /**
   * Make HTTP request`
  )
  
  // Update User-Agent version
  cjsContent = cjsContent.replace(
    /'User-Agent': 'SoftoVault-SDK\/0\.1\.0'/,
    "'User-Agent': 'SoftoVault-SDK/0.2.0'"
  )
  
  // Write the CommonJS version
  fs.writeFileSync(path.join(__dirname, 'index.cjs'), cjsContent)
  
  console.log('✅ CommonJS version built successfully!')
}

function generateTypes() {
  console.log('Generating TypeScript definitions...')
  
  const typesContent = `/**
 * SoftoVault SDK TypeScript Definitions
 */

export interface VaultConfig {
  apiUrl?: string
  timeout?: number
  retries?: number
  cache?: boolean
  cacheTTL?: number
}

export interface VaultOptions {
  useCache?: boolean
}

export interface VaultManyOptions extends VaultOptions {
  failOnMissing?: boolean
}

export interface VaultInfo {
  id: string
  name?: string
  created_at: string
  updated_at: string
  secrets_count: number
}

export interface CacheStats {
  enabled: boolean
  size?: number
  ttl?: number
  keys?: string[]
}

export class Vault {
  constructor(apiKey?: string, config?: VaultConfig)
  
  get(key: string, options?: VaultOptions): Promise<string>
  getAll(options?: VaultOptions): Promise<Record<string, string>>
  getMany(keys: string[], options?: VaultManyOptions): Promise<Record<string, string | null>>
  exists(key: string): Promise<boolean>
  getVaultInfo(): Promise<VaultInfo>
  clearCache(): void
  getCacheStats(): CacheStats
  
  static fromEnv(config?: VaultConfig): Vault
  static isValidApiKey(apiKey: string): boolean
}

export default Vault
`
  
  fs.writeFileSync(path.join(__dirname, 'index.d.ts'), typesContent)
  
  console.log('✅ TypeScript definitions generated!')
}

function createLicense() {
  console.log('Creating LICENSE file...')
  
  const licenseContent = `MIT License

Copyright (c) 2024 SoftoVault

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`
  
  fs.writeFileSync(path.join(__dirname, 'LICENSE'), licenseContent)
  
  console.log('✅ LICENSE file created!')
}

function main() {
  console.log('🚀 Building SoftoVault SDK...')
  
  try {
    buildCommonJS()
    generateTypes()
    createLicense()
    
    console.log('\n🎉 Build completed successfully!')
    console.log('\nFiles generated:')
    console.log('  - index.cjs (CommonJS version)')
    console.log('  - index.d.ts (TypeScript definitions)')
    console.log('  - LICENSE (MIT license)')
  } catch (error) {
    console.error('❌ Build failed:', error.message)
    process.exit(1)
  }
}

// Run main function when script is executed directly
main()

export { buildCommonJS, generateTypes, createLicense }