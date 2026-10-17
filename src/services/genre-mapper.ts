export interface GenreCategory {
  id: string;
  name: string;
  description: string;
  keywords: string[];
}

export const CANONICAL_GENRES: GenreCategory[] = [
  {
    id: 'ukrainian',
    name: 'Ukrainian Music',
    description: 'Ukrainian music across all styles and genres',
    keywords: ['ukrainian', 'ukrainian rock', 'ukrainian pop', 'ukrainian indie', 'ukrainian hip hop', 'ukrainian electronic', 'ukrainian folk'],
  },
  {
    id: 'metal',
    name: 'Metal & Heavy',
    description: 'Heavy metal, death metal, thrash, metalcore, nu metal',
    keywords: ['metal', 'death metal', 'black metal', 'thrash', 'metalcore', 'nu metal', 'heavy metal', 'power metal', 'sludge', 'doom metal', 'grindcore'],
  },
  {
    id: 'rock',
    name: 'Rock & Alternative',
    description: 'Rock, alternative, punk, grunge, hard rock, indie rock',
    keywords: ['rock', 'alternative', 'grunge', 'punk', 'post-punk', 'hard rock', 'classic rock', 'garage rock', 'psychedelic rock', 'indie rock'],
  },
  {
    id: 'hip-hop',
    name: 'Hip-Hop & Rap',
    description: 'Hip hop, rap, trap, drill, boom bap',
    keywords: ['hip hop', 'rap', 'trap', 'drill', 'boom bap', 'conscious hip hop', 'gangsta rap', 'southern hip hop'],
  },
  {
    id: 'electronic',
    name: 'Electronic & Dance',
    description: 'Techno, house, EDM, drum and bass, synthwave, trance, dubstep',
    keywords: ['electronic', 'techno', 'house', 'edm', 'drum and bass', 'dnb', 'trance', 'synthwave', 'dubstep', 'dance', 'club', 'idm', 'electro'],
  },
  {
    id: 'indie-folk',
    name: 'Indie & Folk',
    description: 'Indie, acoustic, folk, singer-songwriter',
    keywords: ['indie', 'folk', 'singer-songwriter', 'acoustic', 'bedroom pop', 'indie folk', 'americana', 'freak folk'],
  },
  {
    id: 'pop',
    name: 'Pop Hits',
    description: 'Pop, dance-pop, electropop, mainstream',
    keywords: ['pop', 'dance pop', 'electropop', 'synthpop', 'teen pop', 'post-teen pop'],
  },
  {
    id: 'rnb-soul',
    name: 'R&B & Soul',
    description: 'R&B, soul, neo-soul, funk, contemporary R&B',
    keywords: ['r&b', 'soul', 'neo-soul', 'funk', 'contemporary r&b', 'motown'],
  },
  {
    id: 'jazz-blues',
    name: 'Jazz & Blues',
    description: 'Jazz, blues, smooth jazz, bebop, big band',
    keywords: ['jazz', 'blues', 'bebop', 'bossa nova', 'fusion', 'swing'],
  },
  {
    id: 'ambient-chill',
    name: 'Ambient & Lo-Fi',
    description: 'Ambient, lo-fi, chillhop, drone, neoclassical, relaxation',
    keywords: ['ambient', 'lo-fi', 'chillhop', 'downtempo', 'neoclassical', 'drone', 'sleep', 'soundtrack', 'chill'],
  },
  {
    id: 'classical',
    name: 'Classical',
    description: 'Classical, orchestra, baroque, romantic, contemporary classical',
    keywords: ['classical', 'orchestra', 'symphony', 'baroque', 'romantic era', 'opera', 'piano'],
  },
];

export class GenreMapper {
  private categories: GenreCategory[];

  constructor(customCategories?: GenreCategory[]) {
    this.categories = customCategories || CANONICAL_GENRES;
  }

  /**
   * Given an array of Spotify artist micro-genres, returns all matching high-level categories.
   */
  classifyGenres(artistGenres: string[]): string[] {
    const matchedCategories = new Set<string>();
    const normalized = artistGenres.map((g) => g.toLowerCase().trim());

    for (const category of this.categories) {
      for (const keyword of category.keywords) {
        const hasMatch = normalized.some((genre) => {
          // Exact match or contains as word/boundary
          if (genre === keyword) return true;
          const regex = new RegExp(`\\b${keyword}\\b`, 'i');
          return regex.test(genre);
        });

        if (hasMatch) {
          matchedCategories.add(category.name);
          break; // category is matched, move to next category
        }
      }
    }

    return Array.from(matchedCategories);
  }

  /**
   * Returns top most specific genre category
   */
  getPrimaryGenre(artistGenres: string[]): string {
    const classified = this.classifyGenres(artistGenres);
    return classified[0] || 'Other';
  }
}

export const defaultGenreMapper = new GenreMapper();
