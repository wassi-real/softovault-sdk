# SoftoVault JavaScript SDK

Official JavaScript SDK for [SoftoVault](https://softovault.com) - Secure secrets management.

## Installation

```bash
npm install @softovault/client
```


## Get Specific Secret from Vault


```javascript
import { Vault } from '@softovault/client'

const vault = new Vault('your-vault-access-key')
const secret = await vault.get('API_KEY')
console.log(secret)
```

## Get All Secrets from Vault

```javascript
import { Vault } from '@softovault/client'

const vault = new Vault('your-vault-access-key')
const secrets = await vault.getAll()
console.log(secrets) // { "API_KEY": "value", "DB_URL": "value", ... }
```

## Features

- End-to-end encrypted secret storage
- Fast in-memory caching
- Works in Node.js and browsers
- TypeScript support

## Support

- Email: support@softovault.com
- Docs: https://softovault.com/sdk


