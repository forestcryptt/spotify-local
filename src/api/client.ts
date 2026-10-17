import { oauthManager } from '../auth/oauth.js';
import {
  SpotifyUser,
  SpotifySavedTrackItem,
  SpotifyPaginatedResponse,
  SpotifyArtist,
  SpotifyPlaylist,
} from './types.js';
import { logger } from '../utils/logger.js';

export class SpotifyApiClient {
  private baseUrl = 'https://api.spotify.com/v1';

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<T> {
    const tokens = await oauthManager.getValidToken();
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${tokens.accessToken}`,
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle Rate Limiting (HTTP 429)
    if (response.status === 429) {
      const retryAfterSec = Number(response.headers.get('Retry-After')) || 2;
      logger.warn(`Spotify API rate limit hit. Waiting ${retryAfterSec} seconds before retrying...`);
      await this.sleep(retryAfterSec * 1000);
      return this.request<T>(endpoint, options, retryCount + 1);
    }

    // Handle Expired Token / Unauthorized (HTTP 401)
    if (response.status === 401 && retryCount === 0) {
      logger.info('Access token expired. Refreshing token...');
      await oauthManager.refreshToken(tokens);
      return this.request<T>(endpoint, options, retryCount + 1);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Spotify API error [${response.status}] on ${endpoint}: ${errorText}`);
    }

    // Some endpoints (like 204 No Content) don't return a body
    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }

  async getCurrentUser(): Promise<SpotifyUser> {
    return this.request<SpotifyUser>('/me');
  }

  async getUserPlaylists(limit = 50, offset = 0): Promise<SpotifyPaginatedResponse<SpotifyPlaylist>> {
    return this.request<SpotifyPaginatedResponse<SpotifyPlaylist>>(
      `/me/playlists?limit=${limit}&offset=${offset}`
    );
  }

  async getAllUserPlaylists(): Promise<SpotifyPlaylist[]> {
    const playlists: SpotifyPlaylist[] = [];
    let offset = 0;
    const limit = 50;

    while (true) {
      const page = await this.getUserPlaylists(limit, offset);
      playlists.push(...page.items);
      if (!page.next || playlists.length >= page.total) {
        break;
      }
      offset += limit;
    }

    return playlists;
  }

  async getSavedTracks(limit = 50, offset = 0): Promise<SpotifyPaginatedResponse<SpotifySavedTrackItem>> {
    return this.request<SpotifyPaginatedResponse<SpotifySavedTrackItem>>(
      `/me/tracks?limit=${limit}&offset=${offset}`
    );
  }

  async getAllSavedTracks(
    onProgress?: (loaded: number, total: number) => void
  ): Promise<SpotifySavedTrackItem[]> {
    const items: SpotifySavedTrackItem[] = [];
    let offset = 0;
    const limit = 50;

    // Fetch initial page to discover total count
    const initialPage = await this.getSavedTracks(limit, offset);
    items.push(...initialPage.items);
    const total = initialPage.total;

    if (onProgress) {
      onProgress(items.length, total);
    }

    offset += limit;

    while (offset < total) {
      const page = await this.getSavedTracks(limit, offset);
      items.push(...page.items);
      offset += limit;

      if (onProgress) {
        onProgress(items.length, total);
      }

      // Small delay to be polite to Spotify API
      if (offset < total) {
        await this.sleep(100);
      }
    }

    return items;
  }

  /**
   * Fetches artists in batches of 50 (Spotify API limit)
   */
  async getArtists(artistIds: string[]): Promise<SpotifyArtist[]> {
    if (artistIds.length === 0) return [];

    const uniqueIds = Array.from(new Set(artistIds));
    const artists: SpotifyArtist[] = [];
    const batchSize = 50;

    for (let i = 0; i < uniqueIds.length; i += batchSize) {
      const chunk = uniqueIds.slice(i, i + batchSize);
      const query = `ids=${chunk.join(',')}`;
      const response = await this.request<{ artists: SpotifyArtist[] }>(`/artists?${query}`);
      artists.push(...(response.artists.filter(Boolean) || []));

      if (i + batchSize < uniqueIds.length) {
        await this.sleep(80);
      }
    }

    return artists;
  }

  async createPlaylist(
    userId: string,
    name: string,
    description: string,
    isPublic: boolean = false
  ): Promise<SpotifyPlaylist> {
    return this.request<SpotifyPlaylist>(`/users/${userId}/playlists`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        description,
        public: isPublic,
      }),
    });
  }

  async getPlaylistTracks(playlistId: string): Promise<string[]> {
    const trackUris: string[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const response = await this.request<SpotifyPaginatedResponse<{ track: { uri: string } }>>(
        `/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}&fields=items(track(uri)),total,next`
      );

      for (const item of response.items) {
        if (item.track && item.track.uri) {
          trackUris.push(item.track.uri);
        }
      }

      if (!response.next || trackUris.length >= response.total) {
        break;
      }
      offset += limit;
    }

    return trackUris;
  }

  /**
   * Adds tracks to a playlist in batches of 100 (Spotify API limit)
   */
  async addTracksToPlaylist(playlistId: string, trackUris: string[]): Promise<void> {
    if (trackUris.length === 0) return;

    const batchSize = 100;
    for (let i = 0; i < trackUris.length; i += batchSize) {
      const chunk = trackUris.slice(i, i + batchSize);
      await this.request(`/playlists/${playlistId}/tracks`, {
        method: 'POST',
        body: JSON.stringify({
          uris: chunk,
        }),
      });

      if (i + batchSize < trackUris.length) {
        await this.sleep(150);
      }
    }
  }
}

export const spotifyClient = new SpotifyApiClient();
