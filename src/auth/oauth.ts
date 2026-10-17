import http from 'node:http';
import url from 'node:url';
import crypto from 'node:crypto';
import open from 'open';
import pc from 'picocolors';
import { config, validateConfig } from '../config.js';
import { tokenStorage } from './token-storage.js';
import { SpotifyTokens, TokenResponse } from './types.js';
import { logger } from '../utils/logger.js';

export const SPOTIFY_SCOPES = [
  'user-library-read',
  'user-library-modify',
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-read-private',
  'user-read-email',
].join(' ');

export class OAuthManager {
  private getBasicAuthHeader(): string {
    return 'Basic ' + Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      scope: SPOTIFY_SCOPES,
      redirect_uri: config.redirectUri,
      state: state,
      show_dialog: 'true',
    });
    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  async authenticate(): Promise<SpotifyTokens> {
    const validation = validateConfig();
    if (!validation.valid) {
      throw new Error(
        `Spotify configuration missing or incomplete:\n${validation.errors.map((e) => `  - ${e}`).join('\n')}\nPlease check your .env file.`
      );
    }

    const state = crypto.randomBytes(16).toString('hex');
    const authUrl = this.getAuthorizationUrl(state);

    return new Promise<SpotifyTokens>((resolve, reject) => {
      let server: http.Server;

      const shutdown = () => {
        setTimeout(() => {
          server.close();
        }, 1000);
      };

      server = http.createServer(async (req, res) => {
        try {
          if (!req.url) return;
          const parsedUrl = url.parse(req.url, true);

          if (parsedUrl.pathname !== '/callback') {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
            return;
          }

          const { code, error, state: returnedState } = parsedUrl.query;

          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<h1>Authentication Failed</h1><p>${error}</p>`);
            shutdown();
            reject(new Error(`Spotify authorization failed: ${error}`));
            return;
          }

          if (returnedState !== state) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>Security verification failed</h1><p>State parameter mismatch.</p>');
            shutdown();
            reject(new Error('State mismatch. Possible CSRF attack.'));
            return;
          }

          if (!code || typeof code !== 'string') {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>Authorization code missing</h1>');
            shutdown();
            reject(new Error('No authorization code returned from Spotify.'));
            return;
          }

          // Exchange authorization code for access and refresh tokens
          const tokens = await this.exchangeCode(code);
          tokenStorage.save(tokens);

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Spotify Local - Authorization Successful</title>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #121212; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                  .card { background: #181818; padding: 40px; border-radius: 12px; text-align: center; border: 1px solid #282828; max-width: 450px; }
                  h1 { color: #1DB954; font-size: 28px; margin-bottom: 12px; }
                  p { color: #b3b3b3; line-height: 1.6; }
                </style>
              </head>
              <body>
                <div class="card">
                  <h1>✔ Авторизація успішна!</h1>
                  <p>Ваш Spotify акаунт успішно підключено до <b>spotify-local</b>.</p>
                  <p>Тепер ви можете закрити цю вкладку та повернутися до терміналу.</p>
                </div>
              </body>
            </html>
          `);

          shutdown();
          resolve(tokens);
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<h1>Error</h1><p>${err.message}</p>`);
          shutdown();
          reject(err);
        }
      });

      server.listen(config.port, async () => {
        logger.info(`Starting local auth server on ${pc.underline(`http://127.0.0.1:${config.port}`)}`);
        logger.info(`Opening Spotify authorization in your browser...`);
        logger.info(`If the browser did not open automatically, copy this URL into your browser:\n  ${pc.cyan(authUrl)}`);

        try {
          await open(authUrl);
        } catch {
          // If browser fails to open automatically, user can still open the URL manually
        }
      });

      server.on('error', (err) => {
        reject(new Error(`Failed to start local auth callback server: ${err.message}`));
      });
    });
  }

  private async exchangeCode(code: string): Promise<SpotifyTokens> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: config.redirectUri,
    });

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': this.getBasicAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Failed to exchange authorization code: ${response.status} ${errBody}`);
    }

    const data = (await response.json()) as TokenResponse;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || '',
      expiresAt: Date.now() + data.expires_in * 1000,
      tokenType: data.token_type,
      scope: data.scope,
    };
  }

  async refreshToken(currentToken: SpotifyTokens): Promise<SpotifyTokens> {
    if (!currentToken.refreshToken) {
      throw new Error('No refresh token available. Please login again using: npm run login');
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: currentToken.refreshToken,
    });

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': this.getBasicAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Failed to refresh Spotify access token: ${response.status} ${errBody}`);
    }

    const data = (await response.json()) as TokenResponse;

    const refreshed: SpotifyTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || currentToken.refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
      tokenType: data.token_type,
      scope: data.scope || currentToken.scope,
    };

    tokenStorage.save(refreshed);
    return refreshed;
  }

  async getValidToken(): Promise<SpotifyTokens> {
    let tokens = tokenStorage.load();
    if (!tokens) {
      logger.warn('No saved credentials found. Initiating Spotify login...');
      tokens = await this.authenticate();
      return tokens;
    }

    if (tokenStorage.isExpired(tokens)) {
      tokens = await this.refreshToken(tokens);
    }

    return tokens;
  }
}

export const oauthManager = new OAuthManager();
