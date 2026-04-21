import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { SteamTopGame } from '../../interfaces/models';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page">

      <!-- scrolling ticker -->
      <div class="ticker market-strip">
        <div class="ticker-inner">
          @for (g of topGames; track g.appid) {
            <button class="tick-item" (click)="goToSteamGame(g.appid)">
              <span class="tick-rank">#{{ g.rank }}</span>
              <span>{{ gameTitleForApp(g.appid) }}</span>
              <span class="tick-up">{{ g.concurrent_in_game | number }} online</span>
            </button>
          }
          @for (g of topGames; track 'dup-' + g.appid) {
            <button class="tick-item" (click)="goToSteamGame(g.appid)">
              <span class="tick-rank">#{{ g.rank }}</span>
              <span>{{ gameTitleForApp(g.appid) }}</span>
              <span class="tick-up">{{ g.concurrent_in_game | number }} online</span>
            </button>
          }
        </div>
      </div>

      <!-- top games table -->
      <main class="top-games-wrap">
        <div class="table-header">
          <div>
            <h1 class="table-title">Most Played Games</h1>
            <p class="table-sub">Live Steam charts ·</p>
          </div>
          <div class="table-meta">
            <span class="live-dot" [class.active]="!loadingTop"></span>
            <span class="live-label">{{ loadingTop ? 'Updating…' : 'Live' }}</span>
          </div>
        </div>

        @if (loadingTop && !topGames.length) {
          <div class="loading-bar"><div class="loading-fill"></div></div>
        }

        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th class="col-rank">#</th>
                <th>Game</th>
                <th class="num">Players Now</th>
                <th class="num">24h Peak</th>
              </tr>
            </thead>
            <tbody>
              @for (g of topGames; track g.appid) {
                <tr (click)="goToSteamGame(g.appid)">
                  <td class="rank-cell">#{{ $index + 1 }}</td>
                  <td>
                    <div class="app-cell">
                      <img
                        [src]="steamHeaderUrl(g.appid)"
                        [alt]="gameTitleForApp(g.appid)"
                        (error)="onImageError($event)" />
                      <span>
                        <strong>{{ gameTitleForApp(g.appid) }}</strong>
                        <small>Steam ID {{ g.appid }}</small>
                      </span>
                    </div>
                  </td>
                  <td class="num green-text">{{ g.concurrent_in_game | number }}</td>
                  <td class="num muted-text">{{ g.peak_in_game | number }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </main>
    </div>
  `,
  styles: [`:host { display: block; }
  .data-table thead th { position: sticky; top: 0; z-index: 2; background: var(--surface, #131a22); }
`]
})
export class HomeComponent implements OnInit, OnDestroy {
  topGames: SteamTopGame[] = [];
  loadingTop = false;

  private topGamesTimer: ReturnType<typeof setInterval> | null = null;
  private readonly refreshMs = 5000;

  private steamNameCache: Record<number, string> = {
    730: 'Counter-Strike 2',
    570: 'Dota 2',
    578080: 'PUBG: BATTLEGROUNDS',
    1172470: 'Apex Legends',
    252490: 'Rust',
    105600: 'Terraria',
    413150: 'Stardew Valley',
    1245620: 'ELDEN RING',
    271590: 'Grand Theft Auto V Legacy',
    1085660: 'Destiny 2',
    359550: 'Tom Clancy Rainbow Six Siege',
    381210: 'Dead by Daylight',
    236390: 'War Thunder',
    431960: 'Wallpaper Engine',
    440: 'Team Fortress 2'
  };

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.loadTopGames();
    this.topGamesTimer = setInterval(() => this.loadTopGames(), this.refreshMs);
  }

  ngOnDestroy(): void {
    if (this.topGamesTimer) {
      clearInterval(this.topGamesTimer);
    }
  }

  loadTopGames(): void {
    this.loadingTop = true;
    this.api.getTopGames().subscribe({
      next: (data) => {
        this.topGames = [...data].sort((a, b) => Number(b.concurrent_in_game ?? 0) - Number(a.concurrent_in_game ?? 0));
        this.hydrateNames(data);
        this.loadingTop = false;
      },
      error: () => {
        this.loadingTop = false;
      }
    });
  }

  gameTitleForApp(appid: number): string {
    return this.steamNameCache[appid] ?? `App ${appid}`;
  }

  steamHeaderUrl(appid: number): string {
    return `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`;
  }

  goToSteamGame(appid: number): void {
    this.router.navigate(['/games', appid]);
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  private hydrateNames(rows: SteamTopGame[]): void {
    rows.forEach(row => {
      if (this.steamNameCache[row.appid]) return;
      this.api.getSteamAppInfo(row.appid).subscribe({
        next: (data) => {
          if (data?.name) this.steamNameCache[row.appid] = data.name;
        }
      });
    });
  }
}