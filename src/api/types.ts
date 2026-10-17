export interface SpotifyUser {
  id: string;
  display_name: string;
  email?: string;
  uri: string;
  country?: string;
  product?: string;
  followers?: {
    total: number;
  };
}

export interface SpotifyTrackArtist {
  id: string;
  name: string;
  uri: string;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  release_date: string;
  release_date_precision: 'year' | 'month' | 'day';
  total_tracks: number;
  images: { url: string; height: number; width: number }[];
}

export interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  explicit: boolean;
  popularity: number;
  artists: SpotifyTrackArtist[];
  album: SpotifyAlbum;
}

export interface SpotifySavedTrackItem {
  added_at: string;
  track: SpotifyTrack;
}

export interface SpotifyPaginatedResponse<T> {
  href: string;
  items: T[];
  limit: number;
  next: string | null;
  offset: number;
  previous: string | null;
  total: number;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  popularity: number;
  followers?: { total: number };
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string | null;
  public: boolean;
  collaborative: boolean;
  uri: string;
  tracks: {
    total: number;
    href: string;
  };
  owner: {
    id: string;
    display_name: string;
  };
}

// Clean internal domain representation for tracks
export interface Track {
  id: string;
  name: string;
  uri: string;
  artists: { id: string; name: string }[];
  primaryArtist: string;
  album: string;
  releaseDate: string;
  year: number;
  decade: string; // e.g. "2010s", "1990s"
  durationMs: number;
  addedAt: string;
  genres: string[];
  matchedGenres?: string[];
}

export interface SortingRule {
  id: string;
  name: string;
  description?: string;
  genres?: string[];
  artists?: string[];
  keywords?: string[];
  decade?: [number, number]; // e.g. [1990, 1999]
}

export interface TargetPlaylist {
  id?: string;
  name: string;
  description: string;
  tracks: Track[];
  trackUris: string[];
}
