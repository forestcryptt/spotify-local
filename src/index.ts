#!/usr/bin/env node
import { Command } from 'commander';
import Table from 'cli-table3';
import pc from 'picocolors';
import { oauthManager } from './auth/oauth.js';
import { tokenStorage } from './auth/token-storage.js';
import { spotifyClient } from './api/client.js';
import { libraryService } from './services/library.js';
import { musicSorter, SortMode } from './services/sorter.js';
import { playlistSyncService } from './services/playlist-sync.js';
import { exporterService } from './services/exporter.js';
import { FileCache } from './utils/cache.js';
import { config, validateConfig } from './config.js';
import { logger } from './utils/logger.js';

const program = new Command();

program
  .name('spotify-local')
  .description('🎵 CLI tool for parsing Spotify library and sorting music into playlists')
  .version('1.0.0');

/**
 * Command: login
 */
program
  .command('login')
  .description('Authorize with Spotify via browser OAuth2 flow')
  .action(async () => {
    try {
      logger.title('Spotify Local - Authentication');
      const tokens = await oauthManager.authenticate();
      logger.success('Successfully authenticated with Spotify!');

      const user = await spotifyClient.getCurrentUser();
      logger.success(`Logged in as: ${pc.bold(user.display_name)} (${user.email || user.id})`);
    } catch (err: any) {
      logger.error(`Login failed: ${err.message}`);
      process.exit(1);
    }
  });

/**
 * Command: status
 */
program
  .command('status')
  .description('Check authentication status and local library cache')
  .action(async () => {
    try {
      logger.title('Spotify Local - Status');

      const validation = validateConfig();
      if (!validation.valid) {
        logger.warn('Configuration warnings:');
        validation.errors.forEach((e) => console.log(`  - ${pc.yellow(e)}`));
      } else {
        logger.success('Environment variables (.env) are properly configured.');
      }

      const tokens = tokenStorage.load();
      if (!tokens) {
        logger.warn('Not logged in. Run `npm run login` to authenticate.');
      } else {
        const isExp = tokenStorage.isExpired(tokens);
        logger.success(`Token status: ${isExp ? pc.yellow('Expired (will auto-refresh)') : pc.green('Valid')}`);

        try {
          const user = await spotifyClient.getCurrentUser();
          logger.highlight('User Name', user.display_name);
          logger.highlight('User ID', user.id);
          if (user.product) logger.highlight('Subscription', user.product);
          if (user.followers) logger.highlight('Followers', user.followers.total);
        } catch (err: any) {
          logger.warn(`Could not fetch profile: ${err.message}`);
        }
      }

      console.log();
      logger.info('Local Data Cache:');
      const libStats = FileCache.getStats(config.libraryFile);
      if (libStats.exists) {
        const cached = libraryService.loadCached();
        const count = cached.tracks?.length || 0;
        logger.highlight('Cached Liked Tracks', `${count} tracks`);
        if (libStats.mtime) {
          logger.highlight('Last Updated', libStats.mtime.toLocaleString());
        }
        logger.highlight('Library File', config.libraryFile);
      } else {
        logger.warn('No cached library found. Run `npm run fetch` to download your library.');
      }
    } catch (err: any) {
      logger.error(`Status check failed: ${err.message}`);
      process.exit(1);
    }
  });

/**
 * Command: fetch
 */
program
  .command('fetch')
  .description('Download and cache all liked songs and artist genres from Spotify')
  .option('-f, --force', 'Force refresh even if cache exists', false)
  .action(async () => {
    try {
      logger.title('Spotify Local - Fetch Library');
      await libraryService.fetchAndCache();
      logger.success('Fetch completed! You can now sort your tracks using `npm run sort`.');
    } catch (err: any) {
      logger.error(`Fetch failed: ${err.message}`);
      process.exit(1);
    }
  });

/**
 * Command: sort
 */
program
  .command('sort')
  .description('Sort cached library into playlists by genre, decade, artist, or rules')
  .option('-b, --by <mode>', 'Sorting mode: genre, decade, artist, rules', 'genre')
  .option('-p, --prefix <string>', 'Prefix for generated playlist names', config.defaultPrefix)
  .option('-m, --min-tracks <number>', 'Minimum tracks required per playlist', '5')
  .option('-r, --rules <path>', 'Custom rules JSON file path', config.rulesFile)
  .option('-s, --sync', 'Immediately sync created playlists to Spotify account', false)
  .option('-e, --export', 'Export sorted result to data/sorted_playlists.json', false)
  .action(async (opts) => {
    try {
      const mode = opts.by as SortMode;
      const minTracks = parseInt(opts.minTracks, 10) || 5;

      logger.title(`Spotify Local - Sort Tracks [Mode: ${mode}]`);

      const tracks = await libraryService.getLibrary(false);
      if (tracks.length === 0) {
        logger.warn('No tracks found in library. Run `npm run fetch` first.');
        return;
      }

      logger.info(`Sorting ${pc.bold(tracks.length)} tracks using mode: ${pc.cyan(mode)}...`);
      const result = musicSorter.sort(tracks, {
        mode,
        prefix: opts.prefix,
        minTracks,
        rulesFilePath: opts.rules,
      });

      // Display results in a table
      const table = new Table({
        head: [
          pc.bold(pc.white('#')),
          pc.bold(pc.white('Playlist Name')),
          pc.bold(pc.white('Tracks')),
          pc.bold(pc.white('Sample Artists')),
        ],
        colWidths: [5, 32, 10, 40],
      });

      result.playlists.forEach((pl, idx) => {
        const topArtists = Array.from(new Set(pl.tracks.map((t) => t.primaryArtist)))
          .slice(0, 3)
          .join(', ');
        table.push([idx + 1, pl.name, pl.tracks.length, pc.dim(topArtists)]);
      });

      console.log(table.toString());

      console.log();
      logger.highlight('Total Tracks In Library', result.totalTracks);
      logger.highlight('Generated Playlists', result.playlists.length);
      logger.highlight('Assigned Tracks Count', result.assignedTracksCount);
      logger.highlight('Unassigned Tracks Count', result.unassignedTracks.length);

      if (opts.export) {
        exporterService.exportSortedToJson(result.playlists);
      }

      if (opts.sync) {
        console.log();
        logger.info('Syncing generated playlists directly to Spotify...');
        const stats = await playlistSyncService.syncPlaylists(result.playlists);
        console.log();
        logger.success('Synchronization complete!');
        logger.highlight('Playlists Created', stats.playlistsCreated);
        logger.highlight('Playlists Updated', stats.playlistsUpdated);
        logger.highlight('Tracks Added', stats.tracksAdded);
      } else {
        console.log();
        logger.info(
          `💡 This was a preview (dry-run). To push these playlists to Spotify, run:\n   ${pc.cyan(`npm run sort -- --by ${mode} --sync`)}`
        );
      }
    } catch (err: any) {
      logger.error(`Sort failed: ${err.message}`);
      process.exit(1);
    }
  });

/**
 * Command: sync
 */
program
  .command('sync')
  .description('Directly sort and push playlists to Spotify')
  .option('-b, --by <mode>', 'Sorting mode: genre, decade, artist, rules', 'genre')
  .option('-p, --prefix <string>', 'Prefix for generated playlist names', config.defaultPrefix)
  .option('-m, --min-tracks <number>', 'Minimum tracks required per playlist', '5')
  .action(async (opts) => {
    try {
      const mode = opts.by as SortMode;
      const minTracks = parseInt(opts.minTracks, 10) || 5;

      logger.title(`Spotify Local - Sync to Spotify [Mode: ${mode}]`);

      const tracks = await libraryService.getLibrary(false);
      if (tracks.length === 0) {
        logger.warn('No tracks found in library. Run `npm run fetch` first.');
        return;
      }

      const result = musicSorter.sort(tracks, {
        mode,
        prefix: opts.prefix,
        minTracks,
      });

      const stats = await playlistSyncService.syncPlaylists(result.playlists);
      console.log();
      logger.success('Synchronization complete!');
      logger.highlight('Playlists Created', stats.playlistsCreated);
      logger.highlight('Playlists Updated', stats.playlistsUpdated);
      logger.highlight('Tracks Added', stats.tracksAdded);
    } catch (err: any) {
      logger.error(`Sync failed: ${err.message}`);
      process.exit(1);
    }
  });

/**
 * Command: export
 */
program
  .command('export')
  .description('Export cached library to CSV or JSON')
  .option('-f, --format <format>', 'Export format: csv or json', 'csv')
  .action(async (opts) => {
    try {
      logger.title('Spotify Local - Export Library');
      const tracks = await libraryService.getLibrary(false);
      if (tracks.length === 0) {
        logger.warn('No tracks found in library. Run `npm run fetch` first.');
        return;
      }

      if (opts.format.toLowerCase() === 'json') {
        const filePath = `${config.dataDir}/library_export.json`;
        FileCache.saveJson(filePath, tracks);
        logger.success(`Exported ${tracks.length} tracks to JSON: ${pc.cyan(filePath)}`);
      } else {
        exporterService.exportToCsv(tracks);
      }
    } catch (err: any) {
      logger.error(`Export failed: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
