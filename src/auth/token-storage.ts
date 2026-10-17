import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { SpotifyTokens } from './types.js';

export class TokenStorage {
  private filePath: string;

  constructor(filePath: string = config.tokensFile) {
    this.filePath = filePath;
  }

  load(): SpotifyTokens | null {
    if (!fs.existsSync(this.filePath)) {
      return null;
    }
    try {
      const data = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(data) as SpotifyTokens;
    } catch {
      return null;
    }
  }

  save(tokens: SpotifyTokens): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.filePath, JSON.stringify(tokens, null, 2), 'utf-8');
  }

  clear(): void {
    if (fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
    }
  }

  isExpired(tokens: SpotifyTokens, bufferSeconds: number = 60): boolean {
    const now = Date.now();
    return now >= tokens.expiresAt - bufferSeconds * 1000;
  }
}

export const tokenStorage = new TokenStorage();
