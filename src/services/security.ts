import * as fs from 'fs/promises'
import * as path from 'path'

export class SecurityService {
  private sensitivePatterns = [
    /\.env$/i,
    /\.env\.local$/i,
    /\.env\.production$/i,
    /\.env\.development$/i,
    /\.env\.staging$/i,
    /_secret/i,
    /_key/i,
    /\.pem$/i,
    /\.key$/i,
    /credentials\.json$/i,
    /service-account.*\.json$/i,
    /\.keystore$/i,
    /id_rsa/i,
    /id_ed25519/i
  ]

  isSensitiveFile(filePath: string): boolean {
    const fileName = path.basename(filePath)
    return this.sensitivePatterns.some(pattern => pattern.test(fileName))
  }

  async requestAccess(filePath: string): Promise<boolean> {
    const fileName = path.basename(filePath)
    
    return new Promise((resolve) => {
      const prompt = [
        '',
        '┌─────────────────────────────────────┐',
        '│ ⚠ Sensitive File                    │',
        '├─────────────────────────────────────┤',
        '│                                     │',
        '│ You are attempting to access:       │',
        '│                                     │',
        `│   ${fileName}`,
        '│                                     │',
        '│ This file may contain secrets       │',
        '│ and API keys.                       │',
        '│                                     │',
        '│ Allow Access?                       │',
        '│                                     │',
        '│ [Y] Yes, read file                  │',
        '│ [N] No, cancel                      │',
        '│                                     │',
        '└─────────────────────────────────────┘',
        ''
      ].join('\n')
      
      process.stdout.write(prompt)
      
      const handler = (data: Buffer) => {
        const key = data.toString().toLowerCase().trim()
        process.stdin.removeListener('data', handler)
        resolve(key === 'y' || key === '')
      }
      
      process.stdin.once('data', handler)
    })
  }

  async readFileWithCheck(filePath: string): Promise<string | null> {
    if (this.isSensitiveFile(filePath)) {
      const allowed = await this.requestAccess(filePath)
      if (!allowed) {
        return null
      }
    }
    
    try {
      return await fs.readFile(filePath, 'utf-8')
    } catch {
      return null
    }
  }

  maskSecret(value: string): string {
    if (value.length <= 8) return '••••••••'
    return value.substring(0, 4) + '••••' + value.substring(value.length - 4)
  }

  validateApiKey(key: string, provider: string): boolean {
    switch (provider) {
      case 'openai':
        return key.startsWith('sk-') && key.length > 20
      case 'anthropic':
        return key.startsWith('sk-ant-') && key.length > 20
      case 'google':
        return key.length > 20
      default:
        return key.length > 10
    }
  }
}
