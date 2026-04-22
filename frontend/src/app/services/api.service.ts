import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import {
  Game, AuthResponse, LoginRequest, RegisterRequest,
  UserProfile, OnlineStats, SteamAppDeepData, SteamTopGame, SteamTopSnapshot, AdminOverview, UserRole
} from '../interfaces/models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly API = this.resolveApiUrl();

  private _isLoggedIn$ = new BehaviorSubject<boolean>(!!localStorage.getItem('token'));
  private _username$ = new BehaviorSubject<string>(localStorage.getItem('username') || '');
  private _isAdmin$ = new BehaviorSubject<boolean>(localStorage.getItem('is_admin') === 'true');
  private _role$ = new BehaviorSubject<UserRole>(localStorage.getItem('user_role') === 'admin' ? 'admin' : 'user');

  isLoggedIn$ = this._isLoggedIn$.asObservable();
  username$ = this._username$.asObservable();
  isAdmin$ = this._isAdmin$.asObservable();
  role$ = this._role$.asObservable();

  constructor(private http: HttpClient) {}

  private resolveApiUrl(): string {
    const appWindow = window as Window & {
      __APP_CONFIG__?: { apiUrl?: string };
    };
    const configuredApiUrl = appWindow.__APP_CONFIG__?.apiUrl?.trim();
    const normalizedConfiguredApiUrl = configuredApiUrl?.replace(/\/+$/, '');

    if (normalizedConfiguredApiUrl) {
      return normalizedConfiguredApiUrl;
    }

    const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    return isLocalhost ? 'http://localhost:8000/api' : '/api';
  }

  // ── Auth ──────────────────────────────────────────────────────────

  login(data: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/auth/login/`, data).pipe(
      tap(res => this.storeAuth(res))
    );
  }

  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/auth/register/`, data).pipe(
      tap(res => this.storeAuth(res))
    );
  }

  logout(): Observable<any> {
    return this.http.post(`${this.API}/auth/logout/`, {}).pipe(
      tap(() => this.clearAuth())
    );
  }

  private storeAuth(res: AuthResponse): void {
    localStorage.setItem('token', res.token);
    localStorage.setItem('username', res.username);
    localStorage.setItem('is_admin', String(res.is_admin));
    localStorage.setItem('user_role', res.role);
    this._isLoggedIn$.next(true);
    this._username$.next(res.username);
    this._isAdmin$.next(res.is_admin);
    this._role$.next(res.role);
  }

  private syncProfileState(profile: Pick<UserProfile, 'username' | 'role' | 'is_admin'>): void {
    localStorage.setItem('username', profile.username);
    localStorage.setItem('is_admin', String(profile.is_admin));
    localStorage.setItem('user_role', profile.role);
    this._username$.next(profile.username);
    this._isAdmin$.next(profile.is_admin);
    this._role$.next(profile.role);
  }

  clearAuth(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('is_admin');
    localStorage.removeItem('user_role');
    this._isLoggedIn$.next(false);
    this._username$.next('');
    this._isAdmin$.next(false);
    this._role$.next('user');
  }

  hydrateSession(): void {
    if (!localStorage.getItem('token')) {
      return;
    }

    this.getProfile().subscribe({
      error: () => {}
    });
  }

  // ── Games ─────────────────────────────────────────────────────────

  getGames(): Observable<{ results?: Game[]; count?: number } | Game[]> {
    return this.http.get<any>(`${this.API}/games/`);
  }

  getGame(id: number): Observable<Game> {
    return this.http.get<Game>(`${this.API}/games/${id}/`);
  }

  createGame(data: Partial<Game>): Observable<Game> {
    return this.http.post<Game>(`${this.API}/games/`, data);
  }

  updateGame(id: number, data: Partial<Game>): Observable<Game> {
    return this.http.put<Game>(`${this.API}/games/${id}/`, data);
  }

  deleteGame(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/games/${id}/`);
  }

  // ── Steam API ─────────────────────────────────────────────────────

  getSteamPlayers(appid: number): Observable<{ appid: number; current_players: number; peak_players: number }> {
    return this.http.get<any>(`${this.API}/steam/players/${appid}/`);
  }

  getSteamAppInfo(appid: number): Observable<any> {
    return this.http.get<any>(`${this.API}/steam/appinfo/${appid}/`);
  }

  getSteamAppDeepData(appid: number) {
  return this.http.get(`${this.API}/steam/deep/${appid}/`);
  }

  importSteamGame(appid: number): Observable<{ created: boolean; game: Game }> {
    return this.http.post<any>(`${this.API}/steam/appinfo/${appid}/`, {});
  }

  getTopGames(): Observable<SteamTopGame[]> {
    return this.http.get<SteamTopGame[]>(`${this.API}/steam/top/`);
  }

  getSteamTopHistory(appid: number): Observable<SteamTopSnapshot[]> {
    return this.http.get<SteamTopSnapshot[]>(`${this.API}/steam/history/${appid}/`);
  }

  // ── Stats / Charts ────────────────────────────────────────────────

  getStatsHistory(gameId: number): Observable<OnlineStats[]> {
    return this.http.get<OnlineStats[]>(`${this.API}/games/${gameId}/stats/`);
  }

  // ── Profile & Wishlist ────────────────────────────────────────────

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.API}/profile/`).pipe(
      tap(profile => this.syncProfileState(profile))
    );
  }

  updateProfile(data: Partial<Pick<UserProfile, 'username' | 'email' | 'steam_id' | 'avatar_url'>>): Observable<UserProfile> {
    return this.http.patch<UserProfile>(`${this.API}/profile/`, data).pipe(
      tap(profile => this.syncProfileState(profile))
    );
  }

  addToWishlist(gameId: number): Observable<any> {
    return this.http.post(`${this.API}/profile/wishlist/${gameId}/`, {});
  }

  removeFromWishlist(gameId: number): Observable<any> {
    return this.http.delete(`${this.API}/profile/wishlist/${gameId}/`);
  }

  getAdminOverview(): Observable<AdminOverview> {
    return this.http.get<AdminOverview>(`${this.API}/admin/overview/`);
  }
}
