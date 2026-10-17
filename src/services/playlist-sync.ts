import { spotifyClient } from '../api/client.js';
import { TargetPlaylist } from '../api/types.js';
import { logger } from '../utils/logger.js';
import pc from 'picocolors';

export interface SyncStats {
  playlistsCreated: number;
  playlistsUpdated: number;
  tracksAdded: number;
}

export class PlaylistSyncService {
  async syncPlaylists(targetPlaylists: TargetPlaylist[], isPublic: boolean = false): Promise<SyncStats> {
    const user = await spotifyClient.getCurrentUser();
    logger.info(`Authenticated as: ${pc.bold(pc.cyan(user.display_name))} (${user.id})`);

    logger.info('Fetching existing playlists from Spotify to avoid duplicates...');
    const existingPlaylists = await spotifyClient.getAllUserPlaylists();
    const existingMap = new Map<string, { id: string; name: string }>();

    for (const pl of existingPlaylists) {
      existingMap.set(pl.name.toLowerCase().trim(), { id: pl.id, name: pl.name });
    }

    const stats: SyncStats = {
      playlistsCreated: 0,
      playlistsUpdated: 0,
      tracksAdded: 0,
    };

    logger.info(`Starting synchronization of ${targetPlaylists.length} playlists...`);

    for (let i = 0; i < targetPlaylists.length; i++) {
      const target = targetPlaylists[i];
      const normalizedName = target.name.toLowerCase().trim();
      const existing = existingMap.get(normalizedName);

      let playlistId: string;
      let urisToAdd: string[] = [];

      if (existing) {
        playlistId = existing.id;
        // Fetch existing tracks in playlist to avoid duplicate adds
        const currentUris = await spotifyClient.getPlaylistTracks(playlistId);
        const currentUriSet = new Set(currentUris);
        urisToAdd = target.trackUris.filter((uri) => !currentUriSet.has(uri));

        if (urisToAdd.length > 0) {
          logger.step(
            i + 1,
            targetPlaylists.length,
            `Updating playlist "${target.name}" (+${urisToAdd.length} new tracks)...`
          );
          await spotifyClient.addTracksToPlaylist(playlistId, urisToAdd);
          stats.playlistsUpdated++;
          stats.tracksAdded += urisToAdd.length;
        } else {
          logger.step(
            i + 1,
            targetPlaylists.length,
            `Playlist "${target.name}" is already up to date (${target.tracks.length} tracks).`
          );
        }
      } else {
        logger.step(
          i + 1,
          targetPlaylists.length,
          `Creating new playlist "${target.name}" with ${target.tracks.length} tracks...`
        );
        const newPl = await spotifyClient.createPlaylist(user.id, target.name, target.description, isPublic);
        playlistId = newPl.id;
        urisToAdd = target.trackUris;

        await spotifyClient.addTracksToPlaylist(playlistId, urisToAdd);
        stats.playlistsCreated++;
        stats.tracksAdded += urisToAdd.length;
        existingMap.set(normalizedName, { id: newPl.id, name: newPl.name });
      }
    }

    return stats;
  }
}

export const playlistSyncService = new PlaylistSyncService();
