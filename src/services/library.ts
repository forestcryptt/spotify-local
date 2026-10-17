import { config } from '../config.js';
import { spotifyClient } from '../api/client.js';
import { Track, SpotifyArtist } from '../api/types.js';
import { FileCache } from '../utils/cache.js';
import { logger } from '../utils/logger.js';
import pc from 'picocolors';

export function getDecadeString(year: number): string {
  if (!year || isNaN(year) || year < 1920) return 'Classic & Vintage';
  const decadeStart = Math.floor(year / 10) * 10;
  return `${decadeStart}s`;
}

export class LibraryService {
  async fetchAndCache(onProgress?: (step: string, percent: number) => void): Promise<{
    tracks: Track[];
    artists: SpotifyArtist[];
  }> {
    logger.info('Fetching saved tracks ("Liked Songs") from Spotify...');

    const savedItems = await spotifyClient.getAllSavedTracks((loaded, total) => {
      const pct = Math.round((loaded / total) * 100);
      process.stdout.write(`\r  ${pc.cyan('⏳')} Loading tracks: ${loaded}/${total} (${pct}%)`);
      if (onProgress) onProgress('tracks', pct);
    });
    process.stdout.write('\n');
    logger.success(`Fetched ${pc.bold(savedItems.length)} saved tracks!`);

    // Extract unique artist IDs
    const artistIdSet = new Set<string>();
    for (const item of savedItems) {
      if (item.track && item.track.artists) {
        for (const artist of item.track.artists) {
          if (artist.id) {
            artistIdSet.add(artist.id);
          }
        }
      }
    }

    const uniqueArtistIds = Array.from(artistIdSet);
    logger.info(`Fetching genre metadata for ${pc.bold(uniqueArtistIds.length)} unique artists...`);

    const artists = await spotifyClient.getArtists(uniqueArtistIds);
    logger.success(`Fetched metadata for ${pc.bold(artists.length)} artists!`);

    // Build artist genre lookup map
    const artistMap = new Map<string, SpotifyArtist>();
    for (const artist of artists) {
      artistMap.set(artist.id, artist);
    }

    // Build normalized Track objects
    logger.info('Processing and enriching tracks with genre data...');
    const tracks: Track[] = [];

    for (const item of savedItems) {
      const t = item.track;
      if (!t || !t.id) continue;

      const trackArtistNames = t.artists.map((a) => a.name);
      const trackArtistObjs = t.artists.map((a) => ({ id: a.id, name: a.name }));
      const primaryArtist = trackArtistNames[0] || 'Unknown Artist';

      // Aggregate genres from all artists of this track
      const genreSet = new Set<string>();
      for (const a of t.artists) {
        const found = artistMap.get(a.id);
        if (found && found.genres) {
          for (const g of found.genres) {
            genreSet.add(g.toLowerCase());
          }
        }
      }

      // Parse release year
      let year = 0;
      if (t.album && t.album.release_date) {
        const parsedYear = parseInt(t.album.release_date.substring(0, 4), 10);
        if (!isNaN(parsedYear)) {
          year = parsedYear;
        }
      }

      const decade = getDecadeString(year);

      tracks.push({
        id: t.id,
        name: t.name,
        uri: t.uri,
        artists: trackArtistObjs,
        primaryArtist,
        album: t.album?.name || 'Unknown Album',
        releaseDate: t.album?.release_date || '',
        year,
        decade,
        durationMs: t.duration_ms,
        addedAt: item.added_at,
        genres: Array.from(genreSet),
      });
    }

    // Save to cache
    logger.info(`Saving library cache to ${pc.cyan(config.libraryFile)}...`);
    FileCache.saveJson(config.libraryFile, tracks);
    FileCache.saveJson(config.artistsFile, artists);
    logger.success(`Library cached successfully (${tracks.length} tracks).`);

    return { tracks, artists };
  }

  loadCached(): { tracks: Track[] | null; artists: SpotifyArtist[] | null } {
    const tracks = FileCache.loadJson<Track[]>(config.libraryFile);
    const artists = FileCache.loadJson<SpotifyArtist[]>(config.artistsFile);
    return { tracks, artists };
  }

  async getLibrary(forceRefresh = false): Promise<Track[]> {
    if (!forceRefresh) {
      const cached = this.loadCached();
      if (cached.tracks && cached.tracks.length > 0) {
        logger.info(`Loaded ${pc.bold(cached.tracks.length)} tracks from local cache (${config.libraryFile}).`);
        return cached.tracks;
      }
    }

    const { tracks } = await this.fetchAndCache();
    return tracks;
  }
}

export const libraryService = new LibraryService();
