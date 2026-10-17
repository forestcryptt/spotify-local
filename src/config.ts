import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

dotenv.config();

export interface AppConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  port: number;
  dataDir: string;
  cacheDir: string;
  tokensFile: string;
  libraryFile: string;
  artistsFile: string;
  rulesFile: string;
  defaultPrefix: string;
}

const rootDir = process.cwd();
const dataDir = path.resolve(rootDir, process.env.DATA_DIR || './data');
const cacheDir = path.resolve(rootDir, process.env.CACHE_DIR || './.cache');

// Ensure essential directories exist
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

export const config: AppConfig = {
  clientId: process.env.SPOTIFY_CLIENT_ID || '',
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
  redirectUri: process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:8888/callback',
  port: Number(process.env.PORT) || 8888,
  dataDir,
  cacheDir,
  tokensFile: path.join(cacheDir, 'tokens.json'),
  libraryFile: path.join(dataDir, 'library.json'),
  artistsFile: path.join(dataDir, 'artists.json'),
  rulesFile: path.resolve(rootDir, 'config/default-rules.json'),
  defaultPrefix: process.env.PLAYLIST_PREFIX || '[Auto] ',
};

export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!config.clientId || config.clientId === 'your_spotify_client_id_here') {
    errors.push('SPOTIFY_CLIENT_ID is not configured in .env');
  }
  if (!config.clientSecret || config.clientSecret === 'your_spotify_client_secret_here') {
    errors.push('SPOTIFY_CLIENT_SECRET is not configured in .env');
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}
