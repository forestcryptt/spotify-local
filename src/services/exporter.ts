import fs from 'node:fs';
import path from 'node:path';
import { Track, TargetPlaylist } from '../api/types.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import pc from 'picocolors';

export class ExporterService {
  exportToCsv(tracks: Track[], filename = 'library.csv'): string {
    const filePath = path.join(config.dataDir, filename);

    const headers = [
      'ID',
      'Name',
      'Primary Artist',
      'All Artists',
      'Album',
      'Release Date',
      'Year',
      'Decade',
      'Genres',
      'Added At',
      'Spotify URI',
    ];

    const escapeCsv = (val: string | number) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = tracks.map((t) => [
      escapeCsv(t.id),
      escapeCsv(t.name),
      escapeCsv(t.primaryArtist),
      escapeCsv(t.artists.map((a) => a.name).join('; ')),
      escapeCsv(t.album),
      escapeCsv(t.releaseDate),
      escapeCsv(t.year),
      escapeCsv(t.decade),
      escapeCsv(t.genres.join('; ')),
      escapeCsv(t.addedAt),
      escapeCsv(t.uri),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    fs.writeFileSync(filePath, csvContent, 'utf-8');
    logger.success(`Exported ${tracks.length} tracks to CSV: ${pc.cyan(filePath)}`);
    return filePath;
  }

  exportSortedToJson(playlists: TargetPlaylist[], filename = 'sorted_playlists.json'): string {
    const filePath = path.join(config.dataDir, filename);
    const simplified = playlists.map((p) => ({
      name: p.name,
      description: p.description,
      trackCount: p.tracks.length,
      tracks: p.tracks.map((t) => ({
        id: t.id,
        name: t.name,
        artist: t.primaryArtist,
        album: t.album,
        year: t.year,
        genres: t.genres,
        uri: t.uri,
      })),
    }));

    fs.writeFileSync(filePath, JSON.stringify(simplified, null, 2), 'utf-8');
    logger.success(`Exported sorted playlists to JSON: ${pc.cyan(filePath)}`);
    return filePath;
  }
}

export const exporterService = new ExporterService();
