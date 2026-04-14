export interface Developer {
  id: number;
  name: string;
  website?: string;
}

export interface OnlineStats {
  game_id: number;
  game_title: string;
  current_players: number;
  peak_players: number;
  timestamp: string;
}

export interface Game {
  id: number;
  title: string;
  description: string;
  steam_appid: number;
  header_image: string;
  genres: string[];
  tags: string[];
  price: number;
  is_free: boolean;
  created_by_username?: string;
  created_at?: string;
  updated_at?: string;
  developers?: Developer[];
  latest_players?: { current: number; peak: number } | null;
}

export interface SteamTopGame {
  rank: number;
  appid: number;
  concurrent_in_game: number;
  peak_in_game: number;
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  steam_id: string;
  avatar_url: string;
  wishlist: Game[];
  created_at: string;
}

export interface AuthResponse {
  token: string;
  username: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  password2: string;
}

export interface ApiError {
  detail?: string;
  [key: string]: any;
}
