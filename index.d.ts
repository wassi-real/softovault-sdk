/**
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
