import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Game, SteamTopGame } from '../../interfaces/models';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">

      <!-- ── Hero ticker ── -->
      <div class="ticker">
        <div class="ticker-inner">
          @for (g of topGames; track g.appid) {
            <span class="tick-item">
              <span class="tick-appid">#{{g.rank}}</span>
              APP/{{g.appid}}
              <span class="tick-up">▲ {{g.concurrent_in_game | number}}</span>
            </span>
          }
          <!-- duplicate for seamless loop -->
          @for (g of topGames; track 'dup-'+g.appid) {
            <span class="tick-item">
              <span class="tick-appid">#{{g.rank}}</span>
              APP/{{g.appid}}
              <span class="tick-up">▲ {{g.concurrent_in_game | number}}</span>
            </span>
          }
        </div>
      </div>

      <!-- ── Page header ── -->
      <div class="content">
        <div class="page-head">
          <div>
            <div class="page-title">GAME DATABASE</div>
            <div class="page-sub">LIVE STEAM DATA · {{ games.length }} GAMES TRACKED</div>
          </div>
          @if (isLoggedIn) {
            <button class="btn-primary" (click)="showAddForm = !showAddForm">
              {{ showAddForm ? '✕ CANCEL' : '+ ADD GAME' }}
            </button>
          }
        </div>

        <!-- ── Error / Success banners ── -->
        @if (errorMsg) {
          <div class="banner error">⚠ {{ errorMsg }}</div>
        }
        @if (successMsg) {
          <div class="banner success">✓ {{ successMsg }}</div>
        }

        <!-- ── Import from Steam Form (click event #1) ── -->
        @if (showAddForm && isLoggedIn) {
          <div class="card form-card">
            <div class="card-title">IMPORT FROM STEAM</div>
            <div class="form-row">
              <div class="f-group">
                <label class="f-label">Steam App ID</label>
                <input class="f-input" type="number" placeholder="e.g. 730"
                  [(ngModel)]="importAppId" name="importAppId" />
              </div>
              <button class="btn-primary" (click)="importGame()" [disabled]="importing">
                {{ importing ? 'IMPORTING...' : 'IMPORT GAME' }}
              </button>
            </div>
            <p class="hint">Enter the Steam App ID (found in the store URL). The game metadata, developer info, and current player count will be fetched automatically.</p>
          </div>
        }

        <!-- ── Filters (click event #2) ── -->
        <div class="filters">
          <input class="search-input" type="text" placeholder="Search games..."
            [(ngModel)]="searchQuery" name="search" (ngModelChange)="applyFilter()" />
          <div class="genre-tabs">
            @for (genre of genres; track genre) {
              <button class="genre-tab" [class.active]="activeGenre === genre"
                (click)="setGenre(genre)">
                {{ genre === 'all' ? 'ALL' : genre.toUpperCase() }}
              </button>
            }
          </div>
        </div>

        <!-- ── Steam Live Top 20 (click event #3) ── -->
        <div class="section-header">
          <span class="section-title">⬡ STEAM LIVE TOP GAMES</span>
          <button class="btn-ghost" (click)="loadTopGames()" [disabled]="loadingTop">
            {{ loadingTop ? 'LOADING...' : '↻ REFRESH' }}
          </button>
        </div>

        @if (loadingTop) {
          <div class="loading-bar"><div class="loading-fill"></div></div>
        }

        <div class="top-grid">
          @for (g of topGames.slice(0, 10); track g.appid) {
            <div class="top-card" (click)="goToSteamGame(g.appid)">
              <div class="top-rank">#{{ g.rank }}</div>
              <div class="top-appid">APP {{ g.appid }}</div>
              <div class="top-players">
                <span class="players-live">{{ g.concurrent_in_game | number }}</span>
                <span class="players-label">LIVE</span>
              </div>
              <div class="top-peak">Peak: {{ g.peak_in_game | number }}</div>
            </div>
          }
        </div>

        <!-- ── Local DB Games ── -->
        <div class="section-header" style="margin-top:32px">
          <span class="section-title">⬡ LOCAL DATABASE</span>
          <span class="count-badge">{{ filteredGames.length }} games</span>
        </div>

        @if (loadingGames) {
          <div class="loading-bar"><div class="loading-fill"></div></div>
        }

        @if (!loadingGames && filteredGames.length === 0) {
          <div class="empty-state">
            <div class="empty-icon">📭</div>
            <div class="empty-text">No games found. Import some from Steam above!</div>
          </div>
        }

        <div class="games-grid">
          @for (game of filteredGames; track game.id) {
            <div class="game-card" (click)="goToGame(game.id)">
              @if (game.header_image) {
                <img [src]="game.header_image" [alt]="game.title" class="game-img" />
              } @else {
                <div class="game-img-placeholder">🎮</div>
              }
              <div class="game-body">
                <div class="game-title">{{ game.title }}</div>
                <div class="game-meta">
                  @for (genre of game.genres.slice(0,2); track genre) {
                    <span class="genre-tag">{{ genre }}</span>
                  }
                </div>
                <div class="game-stats">
                  @if (game.latest_players) {
                    <span class="stat-live">
                      ● {{ game.latest_players.current | number }} online
                    </span>
                  }
                  <span class="stat-price">
                    {{ game.is_free ? 'FREE' : ('$' + game.price) }}
                  </span>
                </div>
              </div>
            </div>
          }
        </div>

      </div>
    </div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Share+Tech+Mono&family=Exo+2:wght@300;400;500;600&display=swap');
    :host { display: block; background: #090d16; min-height: 100vh; font-family: 'Exo 2', sans-serif; color: #bfcfe8; }
    .ticker { background: #111826; border-bottom: 1px solid #1a2640; padding: 6px 0; overflow: hidden; }
    .ticker-inner { display: flex; gap: 32px; animation: tick 60s linear infinite; width: max-content; white-space: nowrap; }
    @keyframes tick { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
    .tick-item { font-family: 'Share Tech Mono', monospace; font-size: 10px; color: #6e80a0; display: flex; align-items: center; gap: 6px; }
    .tick-appid { color: #2e3e58; }
    .tick-up { color: #3ddc84; }

    .content { max-width: 1280px; margin: 0 auto; padding: 24px 20px; }
    .page-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    .page-title { font-family: 'Rajdhani', sans-serif; font-size: 24px; font-weight: 700; color: #fff; letter-spacing: 3px; }
    .page-sub { font-family: 'Share Tech Mono', monospace; font-size: 10px; color: #6e80a0; margin-top: 2px; }

    .banner { padding: 10px 16px; margin-bottom: 16px; font-family: 'Share Tech Mono', monospace; font-size: 12px; }
    .banner.error { background: rgba(255,95,46,.1); border: 1px solid #ff5f2e; color: #ff5f2e; }
    .banner.success { background: rgba(61,220,132,.1); border: 1px solid #3ddc84; color: #3ddc84; }

    .card { background: #141c2e; border: 1px solid #1a2640; padding: 20px; margin-bottom: 20px; }
    .card-title { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 2px; color: #00cfff; margin-bottom: 14px; }
    .form-row { display: flex; gap: 12px; align-items: flex-end; }
    .f-group { display: flex; flex-direction: column; gap: 6px; flex: 1; }
    .f-label { font-family: 'Share Tech Mono', monospace; font-size: 10px; color: #6e80a0; letter-spacing: 1px; }
    .f-input { background: #0d1220; border: 1px solid #1a2640; color: #bfcfe8; padding: 8px 12px; font-family: 'Share Tech Mono', monospace; font-size: 13px; outline: none; transition: border 0.2s; }
    .f-input:focus { border-color: #00cfff; }
    .hint { font-size: 11px; color: #2e3e58; margin-top: 10px; font-family: 'Share Tech Mono', monospace; }

    .filters { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; align-items: center; }
    .search-input { background: #141c2e; border: 1px solid #1a2640; color: #bfcfe8; padding: 8px 14px; font-family: 'Share Tech Mono', monospace; font-size: 12px; outline: none; min-width: 220px; }
    .search-input:focus { border-color: #00cfff; }
    .genre-tabs { display: flex; flex-wrap: wrap; gap: 6px; }
    .genre-tab { background: transparent; border: 1px solid #1a2640; color: #6e80a0; font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 1px; padding: 4px 10px; cursor: pointer; transition: all 0.15s; }
    .genre-tab:hover { border-color: #00cfff; color: #00cfff; }
    .genre-tab.active { background: #00cfff22; border-color: #00cfff; color: #00cfff; }

    .section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
    .section-title { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 2px; color: #6e80a0; }
    .count-badge { font-family: 'Share Tech Mono', monospace; font-size: 10px; color: #2e3e58; background: #141c2e; border: 1px solid #1a2640; padding: 2px 8px; }

    .loading-bar { height: 2px; background: #1a2640; margin-bottom: 16px; overflow: hidden; }
    .loading-fill { height: 100%; width: 40%; background: #00cfff; animation: load 1s ease-in-out infinite alternate; }
    @keyframes load { from{margin-left:0;width:40%} to{margin-left:60%;width:40%} }

    .top-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; margin-bottom: 8px; }
    .top-card { background: #141c2e; border: 1px solid #1a2640; padding: 12px; cursor: pointer; transition: border-color 0.15s; }
    .top-card:hover { border-color: #00cfff44; }
    .top-rank { font-family: 'Share Tech Mono', monospace; font-size: 9px; color: #2e3e58; }
    .top-appid { font-family: 'Share Tech Mono', monospace; font-size: 11px; color: #6e80a0; margin: 2px 0; }
    .top-players { display: flex; align-items: baseline; gap: 4px; margin-top: 6px; }
    .players-live { font-family: 'Rajdhani', sans-serif; font-size: 20px; font-weight: 700; color: #3ddc84; }
    .players-label { font-family: 'Share Tech Mono', monospace; font-size: 9px; color: #3ddc84; }
    .top-peak { font-family: 'Share Tech Mono', monospace; font-size: 9px; color: #2e3e58; margin-top: 2px; }

    .empty-state { text-align: center; padding: 60px 20px; }
    .empty-icon { font-size: 40px; margin-bottom: 12px; }
    .empty-text { font-family: 'Share Tech Mono', monospace; font-size: 12px; color: #2e3e58; }

    .games-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
    .game-card { background: #141c2e; border: 1px solid #1a2640; cursor: pointer; transition: border-color 0.15s, transform 0.15s; overflow: hidden; }
    .game-card:hover { border-color: #00cfff44; transform: translateY(-2px); }
    .game-img { width: 100%; height: 120px; object-fit: cover; display: block; }
    .game-img-placeholder { width: 100%; height: 120px; background: #0d1220; display: flex; align-items: center; justify-content: center; font-size: 36px; }
    .game-body { padding: 12px; }
    .game-title { font-family: 'Rajdhani', sans-serif; font-size: 15px; font-weight: 600; color: #fff; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .game-meta { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
    .genre-tag { font-family: 'Share Tech Mono', monospace; font-size: 9px; color: #6e80a0; background: #0d1220; border: 1px solid #1a2640; padding: 1px 6px; }
    .game-stats { display: flex; justify-content: space-between; align-items: center; }
    .stat-live { font-family: 'Share Tech Mono', monospace; font-size: 10px; color: #3ddc84; }
    .stat-price { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 600; color: #00cfff; }

    .btn-primary { background: #00cfff; color: #090d16; border: none; font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 1px; padding: 8px 20px; cursor: pointer; transition: opacity 0.2s; white-space: nowrap; }
    .btn-primary:hover { opacity: 0.85; }
    .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-ghost { background: transparent; border: 1px solid #1a2640; color: #6e80a0; font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 1px; padding: 5px 14px; cursor: pointer; transition: all 0.2s; }
    .btn-ghost:hover { border-color: #00cfff; color: #00cfff; }
    .btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }
  `]
})
export class HomeComponent implements OnInit {
  games: Game[] = [];
  filteredGames: Game[] = [];
  topGames: SteamTopGame[] = [];
  loadingGames = false;
  loadingTop = false;
  importing = false;
  showAddForm = false;
  isLoggedIn = false;
  searchQuery = '';
  activeGenre = 'all';
  importAppId: number | null = null;
  errorMsg = '';
  successMsg = '';
  genres = ['all', 'Action', 'RPG', 'FPS', 'Strategy', 'Simulation', 'Indie', 'Adventure'];

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.api.isLoggedIn$.subscribe(v => this.isLoggedIn = v);
    this.loadGames();
    this.loadTopGames();
  }

  loadGames(): void {
    this.loadingGames = true;
    this.api.getGames().subscribe({
      next: (res: any) => {
        this.games = res.results ?? res;
        this.applyFilter();
        this.loadingGames = false;
      },
      error: () => {
        this.errorMsg = 'Failed to load games from server.';
        this.loadingGames = false;
      }
    });
  }

  // click event #3
  loadTopGames(): void {
    this.loadingTop = true;
    this.api.getTopGames().subscribe({
      next: (data) => { this.topGames = data; this.loadingTop = false; },
      error: () => { this.loadingTop = false; }
    });
  }

  applyFilter(): void {
    let list = [...this.games];
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(g => g.title.toLowerCase().includes(q));
    }
    if (this.activeGenre !== 'all') {
      list = list.filter(g => g.genres.some(genre =>
        genre.toLowerCase().includes(this.activeGenre.toLowerCase())
      ));
    }
    this.filteredGames = list;
  }

  // click event #2
  setGenre(genre: string): void {
    this.activeGenre = genre;
    this.applyFilter();
  }

  // click event #1
  importGame(): void {
    if (!this.importAppId) {
      this.errorMsg = 'Please enter a valid Steam App ID.';
      return;
    }
    this.importing = true;
    this.errorMsg = '';
    this.api.importSteamGame(this.importAppId).subscribe({
      next: (res) => {
        this.successMsg = `"${res.game.title}" ${res.created ? 'imported' : 'updated'} successfully!`;
        this.importing = false;
        this.showAddForm = false;
        this.importAppId = null;
        this.loadGames();
        setTimeout(() => this.successMsg = '', 4000);
      },
      error: (err) => {
        this.errorMsg = err.error?.error ?? 'Import failed. Check the App ID.';
        this.importing = false;
      }
    });
  }

  // click event #4 — navigate to steam store
  goToSteamGame(appid: number): void {
    window.open(`https://store.steampowered.com/app/${appid}`, '_blank');
  }

  goToGame(id: number): void {
    this.router.navigate(['/games', id]);
  }
}
