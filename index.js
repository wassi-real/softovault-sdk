/**
 * SoftoVault SDK - A robust client for managing secrets in SoftoVault
 * @class Vault
 */
export class Vault {
  /**
   * Create a new Vault instance
   * @param {string} apiKey - Vault access key (can also be set via SOFTOVAULT_API_KEY env var)
   * @param {Object} config - Configuration options
   * @param {string} config.apiUrl - Base API URL (default: production URL)
   * @param {number} config.timeout - Request timeout in ms (default: 10000)
   * @param {number} config.retries - Number of retry attempts (default: 3)
   * @param {boolean} config.cache - Enable in-memory caching (default: true)
   * @param {number} config.cacheTTL - Cache TTL in ms (default: 300000 - 5 minutes)
   */
  constructor(apiKey, config = {}) {
    // Allow API key from environment variable
    this.apiKey = apiKey || process.env.SOFTOVAULT_API_KEY || process.env.VAULT_ACCESS_KEY
    
    if (!this.apiKey) {
      throw new Error("Vault Access key is required. Provide it as parameter or set SOFTOVAULT_API_KEY environment variable")
    }
    
    // Configuration with defaults
    this.config = {
      apiUrl: config.apiUrl || process.env.SOFTOVAULT_API_URL || "https://softovault.com/api/vault",
      timeout: config.timeout || 10000,
      retries: config.retries || 3,
      cache: config.cache !== false,
      cacheTTL: config.cacheTTL || 300000, // 5 minutes
      ...config
    }
    
    // Initialize cache if enabled
    if (this.config.cache) {
      this.cache = new Map()
      this.cacheTimestamps = new Map()
    }
  }

  /**
   * Make HTTP request with retry logic and timeout
   * @private
   */
  async _makeRequest(endpoint, options = {}) {
    const url = `${this.config.apiUrl}${endpoint}`
    const requestOptions = {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'SoftoVault-SDK/0.1.0',
        ...options.headers
      },
      timeout: this.config.timeout,
      ...options
    }

    let lastError
    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)
        
        const response = await fetch(url, {
          ...requestOptions,
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          const error = new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
          error.status = response.status
          error.statusText = response.statusText
          error.data = errorData
          throw error
        }
        
        return await response.json()
      } catch (error) {
        lastError = error
        
        // Don't retry on client errors (4xx) except 429 (rate limit)
        if (error.status >= 400 && error.status < 500 && error.status !== 429) {
          throw error
        }
        
        // Don't retry on the last attempt
        if (attempt === this.config.retries) {
          throw error
        }
        
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw lastError
  }

  /**
   * Check if cached value is still valid
   * @private
   */
  _isCacheValid(key) {
    if (!this.config.cache || !this.cache.has(key)) return false
    
    const timestamp = this.cacheTimestamps.get(key)
    return timestamp && (Date.now() - timestamp) < this.config.cacheTTL
  }

  /**
   * Set value in cache
   * @private
   */
  _setCache(key, value) {
    if (!this.config.cache) return
    
    this.cache.set(key, value)
    this.cacheTimestamps.set(key, Date.now())
  }

  /**
   * Get a specific secret by key
   * @param {string} key - The secret key to retrieve
   * @param {Object} options - Options
   * @param {boolean} options.useCache - Whether to use cache (default: true)
   * @returns {Promise<string>} The secret value
   */
  async get(key, options = {}) {
    if (!key || typeof key !== 'string') {
      throw new Error('Secret key must be a non-empty string')
    }
    
    const useCache = options.useCache !== false
    const cacheKey = `secret:${key}`
    
    // Check cache first
    if (useCache && this._isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey)
    }
    
    try {
      const data = await this._makeRequest(`/key/${encodeURIComponent(key)}`)
      const value = data.value
      
      // Cache the result
      if (useCache) {
        this._setCache(cacheKey, value)
      }
      
      return value
    } catch (error) {
      if (error.status === 404) {
        throw new Error(`Secret with key '${key}' not found`)
      }
      throw error
    }
  }

  /**
   * Get all secrets from the vault
   * @param {Object} options - Options
   * @param {boolean} options.useCache - Whether to use cache (default: true)
   * @returns {Promise<Object>} Object containing all secrets as key-value pairs
   */
  async getAll(options = {}) {
    const useCache = options.useCache !== false
    const cacheKey = 'secrets:all'
    
    // Check cache first
    if (useCache && this._isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey)
    }
    
    const data = await this._makeRequest('/all')
    const secrets = data.secrets || {}
    
    // Cache the result
    if (useCache) {
      this._setCache(cacheKey, secrets)
    }
    
    return secrets
  }

  /**
   * Get multiple secrets by keys
   * @param {string[]} keys - Array of secret keys to retrieve
   * @param {Object} options - Options
   * @param {boolean} options.useCache - Whether to use cache (default: true)
   * @param {boolean} options.failOnMissing - Throw error if any key is missing (default: false)
   * @returns {Promise<Object>} Object containing requested secrets
   */
  async getMany(keys, options = {}) {
    if (!Array.isArray(keys)) {
      throw new Error('Keys must be an array')
    }
    
    const results = {}
    const errors = []
    
    await Promise.allSettled(
      keys.map(async (key) => {
        try {
          results[key] = await this.get(key, options)
        } catch (error) {
          if (options.failOnMissing) {
            errors.push({ key, error: error.message })
          } else {
            results[key] = null
          }
        }
      })
    )
    
    if (errors.length > 0 && options.failOnMissing) {
      throw new Error(`Failed to retrieve secrets: ${errors.map(e => `${e.key}: ${e.error}`).join(', ')}`)
    }
    
    return results
  }

  /**
   * Check if a secret exists
   * @param {string} key - The secret key to check
   * @returns {Promise<boolean>} True if secret exists, false otherwise
   */
  async exists(key) {
    try {
      await this.get(key)
      return true
    } catch (error) {
      if (error.status === 404 || error.message.includes('not found')) {
        return false
      }
      throw error
    }
  }

  /**
   * Get vault information/metadata
   * @returns {Promise<Object>} Vault metadata
   */
  async getVaultInfo() {
    return await this._makeRequest('/info')
  }

  /**
   * Clear the cache
   */
  clearCache() {
    if (this.config.cache) {
      this.cache.clear()
      this.cacheTimestamps.clear()
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    if (!this.config.cache) {
      return { enabled: false }
    }
    
    return {
      enabled: true,
      size: this.cache.size,
      ttl: this.config.cacheTTL,
      keys: Array.from(this.cache.keys())
    }
  }

  /**
   * Create a new Vault instance with environment-based configuration
   * @static
   * @param {Object} config - Additional configuration options
   * @returns {Vault} New Vault instance
   */
  static fromEnv(config = {}) {
    return new Vault(null, config)
  }

  /**
   * Validate API key format
   * @static
   * @param {string} apiKey - API key to validate
   * @returns {boolean} True if valid format
   */
  static isValidApiKey(apiKey) {
    return typeof apiKey === 'string' && apiKey.length > 0
  }
}
  