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

export interface SteamTopSnapshot {
  appid: number;
  current_players: number;
  peak_players: number;
  timestamp: string;
}

export interface SteamCurrencyPrice {
  country_code: string;
  country_name: string;
  currency: string;
  final_formatted: string;
  initial_formatted: string;
  discount_percent: number;
  final_minor?: number | null;
  initial_minor?: number | null;
  is_free: boolean;
}

export interface SteamPackageOption {
  packageid: number;
  option_text: string;
  option_description: string;
  percent_savings: number;
  price_in_cents_with_discount: number;
  is_free_license: boolean;
}

export interface SteamPackageGroup {
  name: string;
  title: string;
  description: string;
  selection_text: string;
  save_text: string;
  subs: SteamPackageOption[];
}

export interface SteamDepotInfo {
  depot_id: number;
  oslist?: string;
  osarch?: string;
  dlcappid?: number | null;
  sharedinstall: boolean;
  manifest_count: number;
  public_gid?: string;
  public_size?: number;
  public_download?: number;
}

export interface SteamBranchInfo {
  name: string;
  buildid: string;
  description: string;
  updated_at?: string | null;
  built_at?: string | null;
}

export interface SteamLaunchConfig {
  index: string;
  executable: string;
  arguments: string;
  description: string;
  oslist?: string;
  osarch?: string;
  betakey?: string;
  ownsdlc?: string;
  type?: string;
}

export interface SteamConfigEntry {
  key: string;
  value: string;
}

export interface SteamNewsFeedItem {
  gid: string;
  title: string;
  url: string;
  author: string;
  feedlabel: string;
  feedname: string;
  date?: string | null;
  contents: string;
  tags: string[];
}

export interface SteamAppDeepData {
  appid: number;
  fetched_at: string;
  store_type: string;
  website: string;
  recommendation_total: number;
  screenshot_count: number;
  movie_count: number;
  dlc_count: number;
  content_notes: string;
  review_score: string;
  review_percentage: string;
  changenumber?: number | null;
  sha: string;
  payload_size?: number | null;
  build_id: string;
  store_last_updated_at?: string | null;
  steam_release_at?: string | null;
  platforms: string[];
  categories: string[];
  supported_languages: string[];
  package_ids: number[];
  pricing: SteamCurrencyPrice[];
  package_groups: SteamPackageGroup[];
  depots: SteamDepotInfo[];
  branches: SteamBranchInfo[];
  launch_configs: SteamLaunchConfig[];
  config_entries: SteamConfigEntry[];
  news_feed: SteamNewsFeedItem[];
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
