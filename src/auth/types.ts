export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // UNIX timestamp in ms
  tokenType: string;
  scope: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
}
