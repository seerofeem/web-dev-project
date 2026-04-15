import { Component, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Developer, Game, OnlineStats } from '../../interfaces/models';

@Component({
  selector: 'app-game-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      @if (loading) {
        <div class="loading-screen">
          <div class="spinner"></div>
          <div class="loading-text">LOADING GAME DATA...</div>
        </div>
      }

      @if (!loading && game) {
        <!-- Hero banner -->
        <div class="hero" [style.backgroundImage]="game.header_image ? 'url('+game.header_image+')' : 'none'">
          <div class="hero-overlay">
            <div class="hero-content">
              <div class="hero-genres">
                @for (genre of game.genres; track genre) {
                  <span class="genre-pill">{{ genre }}</span>
                }
              </div>
              <h1 class="hero-title">{{ game.title }}</h1>
              <div class="hero-dev">
                @for (dev of (game.developers || []); track dev.id) {
                  <span class="dev-name">{{ dev.name }}</span>
                }
              </div>
              <div class="hero-actions">
                <!-- click event #1: refresh live players -->
                <button class="btn-primary" (click)="refreshPlayers()" [disabled]="refreshingPlayers">
                  {{ refreshingPlayers ? 'FETCHING...' : '↻ LIVE PLAYERS' }}
                </button>
                @if (isLoggedIn) {
                  <!-- click event #2: wishlist toggle -->
                  <button class="btn-ghost" (click)="toggleWishlist()">
                    {{ inWishlist ? '♥ IN WISHLIST' : '♡ ADD TO WISHLIST' }}
                  </button>
                  <!-- click event #3: delete game -->
                  @if (canDelete) {
                    <button class="btn-danger" (click)="deleteGame()">DELETE</button>
                  }
                }
              </div>
            </div>
          </div>
        </div>

        <!-- Main content -->
        <div class="content">

          @if (errorMsg) {
            <div class="banner error">⚠ {{ errorMsg }}</div>
          }
          @if (successMsg) {
            <div class="banner success">✓ {{ successMsg }}</div>
          }

          <div class="layout">
            <!-- Left column -->
            <div class="col-main">

              <!-- Live stats cards -->
              <div class="stats-row">
                <div class="stat-card">
                  <div class="stat-label">CURRENT PLAYERS</div>
                  <div class="stat-value green">{{ currentPlayers | number }}</div>
                  <div class="stat-hint">via Steam API</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">PEAK PLAYERS</div>
                  <div class="stat-value accent">{{ peakPlayers | number }}</div>
                  <div class="stat-hint">all time tracked</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">PRICE</div>
                  <div class="stat-value">{{ game.is_free ? 'FREE' : ('$' + game.price) }}</div>
                  <div class="stat-hint">Steam Store</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">STEAM APP ID</div>
                  <div class="stat-value mono">{{ game.steam_appid }}</div>
                  <div class="stat-hint">store identifier</div>
                </div>
              </div>

              <!-- Player chart -->
              <div class="card">
                <div class="card-head">
                  <span class="card-title">ONLINE HISTORY</span>
                  <span class="card-sub">{{ statsHistory.length }} snapshots</span>
                </div>
                <div class="chart-wrap">
                  <canvas #chartCanvas class="chart-canvas"></canvas>
                  @if (statsHistory.length === 0) {
                    <div class="chart-empty">No history yet. Click LIVE PLAYERS to record a snapshot.</div>
                  }
                </div>
              </div>

              <!-- Description -->
              <div class="card">
                <div class="card-title">ABOUT</div>
                <p class="description">{{ game.description || 'No description available.' }}</p>
              </div>

              <!-- Edit form (click event #4: save edit) -->
              @if (isLoggedIn) {
                <div class="card">
                  <div class="card-head">
                    <span class="card-title">EDIT GAME</span>
                    <button class="btn-ghost-sm" (click)="showEdit = !showEdit">
                      {{ showEdit ? 'CANCEL' : 'EDIT' }}
                    </button>
                  </div>
                  @if (showEdit) {
                    <div class="edit-form">
                      <div class="f-group">
                        <label class="f-label">Title</label>
                        <input class="f-input" [(ngModel)]="editTitle" name="editTitle" />
                      </div>
                      <div class="f-group">
                        <label class="f-label">Description</label>
                        <textarea class="f-input f-textarea" [(ngModel)]="editDescription" name="editDesc" rows="4"></textarea>
                      </div>
                      <div class="f-group">
                        <label class="f-label">Price ($)</label>
                        <input class="f-input" type="number" step="0.01" [(ngModel)]="editPrice" name="editPrice" />
                      </div>
                      <button class="btn-primary" (click)="saveEdit()" [disabled]="saving">
                        {{ saving ? 'SAVING...' : 'SAVE CHANGES' }}
                      </button>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Right column -->
            <div class="col-side">
              <div class="card">
                <div class="card-title">GAME INFO</div>
                <div class="info-rows">
                  <div class="info-row">
                    <span class="info-key">DEVELOPER</span>
                    <span class="info-val">
                      {{ formatDevelopers(game.developers) }}
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-key">GENRES</span>
                    <span class="info-val">{{ game.genres.join(', ') || '—' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-key">TAGS</span>
                    <span class="info-val">{{ game.tags.slice(0,4).join(', ') || '—' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-key">ADDED BY</span>
                    <span class="info-val">{{ game.created_by_username || '—' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-key">ADDED</span>
                    <span class="info-val">{{ game.created_at | date:'mediumDate' }}</span>
                  </div>
                </div>
                <a class="steam-link" [href]="'https://store.steampowered.com/app/' + game.steam_appid" target="_blank">
                  VIEW ON STEAM →
                </a>
              </div>

              <div class="card">
                <div class="card-title">TAGS</div>
                <div class="tags-wrap">
                  @for (tag of game.tags; track tag) {
                    <span class="tag">{{ tag }}</span>
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      }

      @if (!loading && !game) {
        <div class="not-found">
          <div class="nf-code">404</div>
          <div class="nf-text">Game not found</div>
          <button class="btn-primary" (click)="goBack()">← BACK TO LIST</button>
        </div>
      }
    </div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Share+Tech+Mono&family=Exo+2:wght@300;400;500;600&display=swap');
    :host { display: block; background: #090d16; min-height: 100vh; font-family: 'Exo 2', sans-serif; color: #bfcfe8; }

    .loading-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; gap: 16px; }
    .spinner { width: 32px; height: 32px; border: 2px solid #1a2640; border-top-color: #00cfff; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to{transform:rotate(360deg)} }
    .loading-text { font-family: 'Share Tech Mono', monospace; font-size: 11px; color: #2e3e58; letter-spacing: 2px; }

    .hero { min-height: 280px; background-size: cover; background-position: center; position: relative; }
    .hero-overlay { position: absolute; inset: 0; background: linear-gradient(to right, rgba(9,13,22,0.95) 40%, rgba(9,13,22,0.5)); display: flex; align-items: flex-end; }
    .hero-content { padding: 32px 24px; max-width: 700px; }
    .hero-genres { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
    .genre-pill { font-family: 'Share Tech Mono', monospace; font-size: 9px; color: #00cfff; background: rgba(0,207,255,.1); border: 1px solid rgba(0,207,255,.3); padding: 2px 8px; }
    .hero-title { font-family: 'Rajdhani', sans-serif; font-size: 36px; font-weight: 700; color: #fff; letter-spacing: 2px; line-height: 1.1; margin-bottom: 8px; }
    .hero-dev { font-family: 'Share Tech Mono', monospace; font-size: 11px; color: #6e80a0; margin-bottom: 18px; }
    .dev-name::after { content: ' · '; }
    .dev-name:last-child::after { content: ''; }
    .hero-actions { display: flex; gap: 10px; flex-wrap: wrap; }

    .content { max-width: 1280px; margin: 0 auto; padding: 24px 20px; }
    .layout { display: grid; grid-template-columns: 1fr 300px; gap: 20px; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }

    .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
    @media (max-width: 700px) { .stats-row { grid-template-columns: repeat(2, 1fr); } }
    .stat-card { background: #141c2e; border: 1px solid #1a2640; padding: 14px; }
    .stat-label { font-family: 'Share Tech Mono', monospace; font-size: 9px; color: #2e3e58; letter-spacing: 1px; margin-bottom: 6px; }
    .stat-value { font-family: 'Rajdhani', sans-serif; font-size: 26px; font-weight: 700; color: #fff; line-height: 1; }
    .stat-value.green { color: #3ddc84; }
    .stat-value.accent { color: #00cfff; }
    .stat-value.mono { font-family: 'Share Tech Mono', monospace; font-size: 18px; }
    .stat-hint { font-family: 'Share Tech Mono', monospace; font-size: 9px; color: #2e3e58; margin-top: 4px; }

    .card { background: #141c2e; border: 1px solid #1a2640; padding: 18px; margin-bottom: 14px; }
    .card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .card-title { font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 2px; color: #00cfff; margin-bottom: 14px; display: block; }
    .card-head .card-title { margin-bottom: 0; }
    .card-sub { font-family: 'Share Tech Mono', monospace; font-size: 10px; color: #2e3e58; }
    .chart-wrap { position: relative; height: 160px; }
    .chart-canvas { width: 100% !important; height: 160px !important; }
    .chart-empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: 'Share Tech Mono', monospace; font-size: 11px; color: #2e3e58; }

    .description { font-size: 14px; color: #6e80a0; line-height: 1.7; }

    .f-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
    .f-label { font-family: 'Share Tech Mono', monospace; font-size: 10px; color: #6e80a0; letter-spacing: 1px; }
    .f-input { background: #0d1220; border: 1px solid #1a2640; color: #bfcfe8; padding: 8px 12px; font-family: 'Share Tech Mono', monospace; font-size: 13px; outline: none; width: 100%; }
    .f-input:focus { border-color: #00cfff; }
    .f-textarea { resize: vertical; font-family: 'Exo 2', sans-serif; }
    .edit-form { margin-top: 4px; }

    .info-rows { display: flex; flex-direction: column; gap: 0; margin-bottom: 16px; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1a2640; }
    .info-key { font-family: 'Share Tech Mono', monospace; font-size: 10px; color: #2e3e58; }
    .info-val { font-family: 'Share Tech Mono', monospace; font-size: 10px; color: #6e80a0; text-align: right; max-width: 55%; }
    .steam-link { display: block; font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 1px; color: #00cfff; text-decoration: none; text-align: center; border: 1px solid rgba(0,207,255,.3); padding: 8px; transition: background 0.15s; }
    .steam-link:hover { background: rgba(0,207,255,.08); }
    .tags-wrap { display: flex; flex-wrap: wrap; gap: 6px; }
    .tag { font-family: 'Share Tech Mono', monospace; font-size: 9px; color: #6e80a0; background: #0d1220; border: 1px solid #1a2640; padding: 3px 8px; }

    .banner { padding: 10px 16px; margin-bottom: 14px; font-family: 'Share Tech Mono', monospace; font-size: 12px; }
    .banner.error { background: rgba(255,95,46,.1); border: 1px solid #ff5f2e; color: #ff5f2e; }
    .banner.success { background: rgba(61,220,132,.1); border: 1px solid #3ddc84; color: #3ddc84; }

    .btn-primary { background: #00cfff; color: #090d16; border: none; font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 1px; padding: 8px 20px; cursor: pointer; transition: opacity 0.2s; }
    .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-ghost { background: transparent; border: 1px solid #1a2640; color: #6e80a0; font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 1px; padding: 7px 16px; cursor: pointer; transition: all 0.15s; }
    .btn-ghost:hover { border-color: #00cfff; color: #00cfff; }
    .btn-ghost-sm { background: transparent; border: 1px solid #1a2640; color: #6e80a0; font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 1px; padding: 3px 10px; cursor: pointer; }
    .btn-ghost-sm:hover { border-color: #00cfff; color: #00cfff; }
    .btn-danger { background: transparent; border: 1px solid #ff5f2e44; color: #ff5f2e; font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 1px; padding: 7px 16px; cursor: pointer; transition: all 0.15s; }
    .btn-danger:hover { background: rgba(255,95,46,.1); }

    .not-found { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; gap: 12px; }
    .nf-code { font-family: 'Rajdhani', sans-serif; font-size: 80px; font-weight: 700; color: #1a2640; }
    .nf-text { font-family: 'Share Tech Mono', monospace; font-size: 14px; color: #2e3e58; margin-bottom: 8px; }
  `]
})
export class GameDetailComponent implements OnInit, AfterViewInit {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  game: Game | null = null;
  statsHistory: OnlineStats[] = [];
  loading = true;
  refreshingPlayers = false;
  saving = false;
  isLoggedIn = false;
  inWishlist = false;
  canDelete = false;
  showEdit = false;
  currentPlayers = 0;
  peakPlayers = 0;
  errorMsg = '';
  successMsg = '';
  editTitle = '';
  editDescription = '';
  editPrice = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService
  ) {}

  ngOnInit(): void {
    this.api.isLoggedIn$.subscribe(v => {
      this.isLoggedIn = v;
      if (v) this.checkWishlist();
    });
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loadGame(id);
  }

  ngAfterViewInit(): void {
    // Chart is drawn after data loads
  }

  loadGame(id: number): void {
    this.api.getGame(id).subscribe({
      next: (game) => {
        this.game = game;
        this.editTitle = game.title;
        this.editDescription = game.description;
        this.editPrice = game.price;
        if (game.latest_players) {
          this.currentPlayers = game.latest_players.current;
          this.peakPlayers = game.latest_players.peak;
        }
        const username = localStorage.getItem('username');
        this.canDelete = !!username && game.created_by_username === username;
        this.loading = false;
        this.loadStats(id);
      },
      error: () => { this.loading = false; }
    });
  }

  loadStats(gameId: number): void {
    this.api.getStatsHistory(gameId).subscribe({
      next: (stats) => {
        this.statsHistory = stats.reverse(); // oldest first
        setTimeout(() => this.drawChart(), 100);
      }
    });
  }

  // click event #1
  refreshPlayers(): void {
    if (!this.game) return;
    this.refreshingPlayers = true;
    this.api.getSteamPlayers(this.game.steam_appid).subscribe({
      next: (res) => {
        this.currentPlayers = res.current_players;
        this.peakPlayers = Math.max(this.peakPlayers, res.peak_players);
        this.refreshingPlayers = false;
        this.successMsg = `Updated: ${res.current_players.toLocaleString()} players online now.`;
        setTimeout(() => this.successMsg = '', 4000);
        this.loadStats(this.game!.id);
      },
      error: () => {
        this.errorMsg = 'Failed to fetch live player count.';
        this.refreshingPlayers = false;
      }
    });
  }

  // click event #2
  toggleWishlist(): void {
    if (!this.game) return;
    const obs = this.inWishlist
      ? this.api.removeFromWishlist(this.game.id)
      : this.api.addToWishlist(this.game.id);
    obs.subscribe({
      next: (res) => {
        this.inWishlist = !this.inWishlist;
        this.successMsg = res.detail;
        setTimeout(() => this.successMsg = '', 3000);
      },
      error: (err) => { this.errorMsg = err.error?.detail ?? 'Wishlist error.'; }
    });
  }

  // click event #3
  deleteGame(): void {
    if (!this.game || !confirm(`Delete "${this.game.title}"?`)) return;
    this.api.deleteGame(this.game.id).subscribe({
      next: () => this.router.navigate(['/']),
      error: () => { this.errorMsg = 'Delete failed.'; }
    });
  }

  // click event #4
  saveEdit(): void {
    if (!this.game) return;
    this.saving = true;
    this.api.updateGame(this.game.id, {
      title: this.editTitle,
      description: this.editDescription,
      price: this.editPrice
    }).subscribe({
      next: (updated) => {
        this.game = { ...this.game!, ...updated };
        this.successMsg = 'Game updated successfully!';
        this.saving = false;
        this.showEdit = false;
        setTimeout(() => this.successMsg = '', 3000);
      },
      error: () => { this.errorMsg = 'Update failed.'; this.saving = false; }
    });
  }

  checkWishlist(): void {
    if (!this.game) return;
    this.api.getProfile().subscribe({
      next: (profile) => {
        this.inWishlist = profile.wishlist.some(g => g.id === this.game!.id);
      }
    });
  }

  formatDevelopers(developers?: Developer[]): string {
    const names = developers?.map(dev => dev.name).filter(Boolean) ?? [];
    return names.length ? names.join(', ') : '—';
  }

  goBack(): void { this.router.navigate(['/']); }

  drawChart(): void {
    const canvas = this.chartCanvas?.nativeElement;
    if (!canvas || this.statsHistory.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.offsetWidth || 600;
    const H = 140;
    canvas.width = W;
    canvas.height = H;

    const values = this.statsHistory.map(s => s.current_players);
    const maxVal = Math.max(...values, 1);
    const minVal = Math.min(...values, 0);
    const range = maxVal - minVal || 1;
    const pad = { top: 16, right: 16, bottom: 28, left: 48 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = '#1a2640';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (chartH / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
      const label = Math.round(maxVal - (range / 4) * i).toLocaleString();
      ctx.fillStyle = '#2e3e58';
      ctx.font = '9px Share Tech Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(label, pad.left - 4, y + 3);
    }

    // Area fill
    const getX = (i: number) => pad.left + (i / (values.length - 1 || 1)) * chartW;
    const getY = (v: number) => pad.top + chartH - ((v - minVal) / range) * chartH;

    ctx.beginPath();
    ctx.moveTo(getX(0), H - pad.bottom);
    ctx.lineTo(getX(0), getY(values[0]));
    for (let i = 1; i < values.length; i++) {
      ctx.lineTo(getX(i), getY(values[i]));
    }
    ctx.lineTo(getX(values.length - 1), H - pad.bottom);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom);
    grad.addColorStop(0, 'rgba(0,207,255,0.25)');
    grad.addColorStop(1, 'rgba(0,207,255,0.02)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = '#00cfff';
    ctx.lineWidth = 2;
    ctx.moveTo(getX(0), getY(values[0]));
    for (let i = 1; i < values.length; i++) {
      ctx.lineTo(getX(i), getY(values[i]));
    }
    ctx.stroke();

    // Dots
    values.forEach((v, i) => {
      ctx.beginPath();
      ctx.arc(getX(i), getY(v), 3, 0, Math.PI * 2);
      ctx.fillStyle = '#00cfff';
      ctx.fill();
    });

    // X-axis timestamps
    ctx.fillStyle = '#2e3e58';
    ctx.font = '8px Share Tech Mono, monospace';
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(values.length / 6));
    for (let i = 0; i < values.length; i += step) {
      const t = new Date(this.statsHistory[i].timestamp);
      const label = `${t.getHours()}:${String(t.getMinutes()).padStart(2,'0')}`;
      ctx.fillText(label, getX(i), H - pad.bottom + 12);
    }
  }
}
