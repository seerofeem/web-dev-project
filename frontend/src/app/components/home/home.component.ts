import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { SteamTopGame, SteamTopSnapshot } from '../../interfaces/models';
import { ChangeDetectorRef } from '@angular/core';

type View = 'overview' | 'charts' | 'prices' | 'upcoming' | 'feed';

interface ChartPoint { x: number; y: number; value: number; timestamp: number; }

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page">

      <!-- ticker -->
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

      <!-- view tabs -->
      <nav class="view-tabs">
        <button [class.active]="activeView === 'overview'" (click)="activeView = 'overview'">Overview</button>
        <button [class.active]="activeView === 'charts'" (click)="activeView = 'charts'">Charts</button>
        <button [class.active]="activeView === 'prices'" (click)="activeView = 'prices'; loadPrices()">Prices</button>
        <button [class.active]="activeView === 'upcoming'" (click)="activeView = 'upcoming'; loadUpcoming()">Upcoming</button>
        <button [class.active]="activeView === 'feed'" (click)="activeView = 'feed'; loadFeed()">Feed</button>
      </nav>

      <!-- OVERVIEW -->
      @if (activeView === 'overview') {
        <main class="top-games-wrap">
          <div class="table-header">
            <div>
              <h1 class="table-title">Most Played Games</h1>
              <p class="table-sub">Live Steam charts</p>
            </div>
            <div class="table-meta">
              <span class="live-dot" [class.active]="!loadingTop"></span>
              <span class="live-label">{{ loadingTop ? 'Updating...' : 'Live' }}</span>
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
                @for (g of topGames; track g.appid; let i = $index) {
                  <tr (click)="goToSteamGame(g.appid)">
                    <td class="rank-cell">#{{ i + 1 }}</td>
                    <td>
                      <div class="app-cell">
                        <img [src]="steamHeaderUrl(g.appid)" [alt]="gameTitleForApp(g.appid)" (error)="onImageError($event)" />
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
      }

      <!-- CHARTS -->
      @if (activeView === 'charts') {
        <main class="charts-wrap">
          <div class="charts-layout">

            <!-- sidebar -->
            <div class="charts-sidebar">
              <div class="sidebar-title">Select a game</div>
              @for (g of topGames; track g.appid) {
                <button
                  class="chart-game-btn"
                  [class.active]="selectedAppid === g.appid"
                  (click)="selectGame(g.appid)">
                  <img [src]="steamHeaderUrl(g.appid)" (error)="onImageError($event)" />
                  <span class="chart-game-info">
                    <strong>{{ gameTitleForApp(g.appid) }}</strong>
                    <span class="chart-game-count">{{ g.concurrent_in_game | number }} online</span>
                  </span>
                </button>
              }
            </div>

            <!-- chart panel -->
            <div class="chart-panel">
              @if (!selectedAppid) {
                <div class="chart-empty">Select a game to see its player history</div>
              }

              @if (selectedAppid && chartLoading) {
                <div class="chart-loading">
                  <div class="loading-bar"><div class="loading-fill"></div></div>
                  <span>Loading history...</span>
                </div>
              }

              @if (selectedAppid && !chartLoading && chartSnapshots.length === 0) {
                <div class="chart-empty">
                  No history data yet for this game.<br>
                  Data is collected every 10 minutes while the server runs.
                </div>
              }

              @if (selectedAppid && !chartLoading && chartSnapshots.length > 0) {
                <div class="chart-header">
                  <div>
                    <h2 class="chart-game-title">{{ gameTitleForApp(selectedAppid) }}</h2>
                    <p class="chart-game-sub">Player count history · last 24 hours</p>
                  </div>
                  <div class="chart-stats-row">
                    <div class="chart-stat">
                      <span class="chart-stat-label">Current</span>
                      <strong class="green-text">{{ chartCurrent | number }}</strong>
                    </div>
                    <div class="chart-stat">
                      <span class="chart-stat-label">Peak</span>
                      <strong>{{ chartPeak | number }}</strong>
                    </div>
                    <div class="chart-stat">
                      <span class="chart-stat-label">Gain</span>
                      <strong [class.green-text]="chartGain >= 0" [class.red-text]="chartGain < 0">
                        {{ chartGain >= 0 ? '+' : '' }}{{ chartGain | number }}
                        ({{ chartGainPct >= 0 ? '+' : '' }}{{ chartGainPct.toFixed(1) }}%)
                      </strong>
                    </div>
                    <div class="chart-stat">
                      <span class="chart-stat-label">Samples</span>
                      <strong>{{ chartSnapshots.length }}</strong>
                    </div>
                  </div>
                </div>

                <div class="chart-svg-wrap">
                  <svg class="chart-svg" [attr.viewBox]="'0 0 ' + svgW + ' ' + svgH" preserveAspectRatio="none">
                    @for (tick of yTicks; track tick.y) {
                      <line class="grid-line"
                        [attr.x1]="pad.left" [attr.y1]="tick.y"
                        [attr.x2]="svgW - pad.right" [attr.y2]="tick.y" />
                      <text class="y-label" [attr.x]="pad.left - 6" [attr.y]="tick.y + 4">{{ tick.label }}</text>
                    }
                    <path class="chart-area" [attr.d]="areaPath" />
                    <path class="chart-line" [attr.d]="linePath" />
                    @for (pt of chartPoints; track pt.timestamp) {
                      <circle class="chart-dot" [attr.cx]="pt.x" [attr.cy]="pt.y" r="4">
                        <title>{{ pt.value | number }} · {{ formatTime(pt.timestamp) }}</title>
                      </circle>
                    }
                    @for (tick of xTicks; track tick.x) {
                      <text class="x-label" [attr.x]="tick.x" [attr.y]="svgH - 4" text-anchor="middle">{{ tick.label }}</text>
                    }
                  </svg>
                </div>
              }
            </div>
          </div>
        </main>
      }
    </div>

    @if (activeView === 'prices') {
  <main class="top-games-wrap">
    <div class="table-header">
      <div>
        <h1 class="table-title">Game Prices</h1>
        <p class="table-sub">Steam store prices · {{ 50 }} games</p>
      </div>
      <div class="price-sort-btns">
        <button [class.active]="priceSort === 'high'" (click)="priceSort = 'high'">Highest first</button>
        <button [class.active]="priceSort === 'low'" (click)="priceSort = 'low'">Lowest first</button>
      </div>
    </div>
    <div class="price-grid">
      @for (g of sortedByPrice; track g.appid) {
        <button class="price-block" (click)="goToSteamGame(g.appid)">
          <img [src]="steamHeaderUrl(g.appid)" (error)="onImageError($event)" />
          <div class="price-block-body">
            <div class="price-block-name">{{ priceCache[g.appid]?.name || gameTitleForApp(g.appid) }}</div>
            <div class="price-block-players">{{ g.concurrent_in_game | number }} online</div>
          </div>
          <div class="price-tag" [class.free]="priceCache[g.appid]?.is_free">
            {{ priceCache[g.appid]?.loading ? '...' : (priceCache[g.appid]?.price || '—') }}
          </div>
        </button>
      }
    </div>
  </main>
}
  @if (activeView === 'upcoming') {
  <main class="top-games-wrap">
    <div class="table-header">
      <div>
        <h1 class="table-title">Upcoming Releases</h1>
        <p class="table-sub">Steam coming soon · {{ upcomingGames.length }} games</p>
      </div>
    </div>
    @if (upcomingLoading) {
      <div class="loading-bar"><div class="loading-fill"></div></div>
    }
    <div class="price-grid">
      @for (g of upcomingGames; track g.appid) {
        <button class="price-block" (click)="goToSteamGame(g.appid)">
          <img [src]="g.header_image" (error)="onImageError($event)" /> />
          <div class="price-block-body">
            <div class="price-block-name">{{ g.name }}</div>
            <div class="price-block-players">{{ g.release_date || 'TBA' }}</div>
          </div>
          <div class="price-tag" [class.free]="g.is_free">
            {{ formatPrice(g) }}
            @if (g.discount_percent > 0) {
              <span class="discount-badge">-{{ g.discount_percent }}%</span>
            }
          </div>
        </button>
      }
    </div>
  </main>
}
  @if (activeView === 'feed') {
  <main class="top-games-wrap">
    <div class="table-header">
      <div>
        <h1 class="table-title">Steam News Feed</h1>
        <p class="table-sub">Latest updates from top 10 most played games</p>
      </div>
    </div>
    @if (feedLoading) {
      <div class="loading-bar"><div class="loading-fill"></div></div>
    }
    <div class="feed-list">
      @for (item of feedItems; track item.gid) {
        <a class="feed-item" [href]="item.url" target="_blank">
          <img [src]="steamHeaderUrl(item.appid)" (error)="onImageError($event)" class="feed-thumb" />
          <div class="feed-body">
            <div class="feed-game">{{ gameTitleForApp(item.appid) }}</div>
            <div class="feed-title">{{ item.title }}</div>
            <div class="feed-content">{{ item.contents }}</div>
            <div class="feed-meta">
              <span>{{ item.author }}</span>
              <span>{{ item.feedlabel }}</span>
              <span>{{ item.date | date:'dd MMM yyyy' }}</span>
            </div>
          </div>
        </a>
      }
    </div>
  </main>
}
  `,  
                
  styles: [`
    :host { display: block; }

    .view-tabs {
      display: flex;
      gap: 4px;
      padding: 12px 20px 0;
      border-bottom: 1px solid var(--border, #25354b);
    }
      .price-sort-btns { display: flex; gap: 8px; }
.price-sort-btns button { background: transparent; border: 1px solid var(--border, #25354b); border-radius: 4px; color: var(--secondary-text, #8ca0b3); cursor: pointer; font-family: 'Share Tech Mono', monospace; font-size: 10px; padding: 6px 12px; transition: all 0.15s; }
.price-sort-btns button.active { border-color: var(--accent, #57b8c7); color: var(--accent-hover, #66c0f4); }

.price-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.price-block { background: var(--surface, #1b2838); border: 1px solid var(--border, #25354b); border-radius: 6px; cursor: pointer; display: flex; flex-direction: column; overflow: hidden; text-align: left; transition: border-color 0.15s, transform 0.15s; }
.price-block:hover { border-color: var(--accent, #57b8c7); transform: translateY(-2px); }
.price-block img { width: 100%; height: 90px; object-fit: cover; display: block; }
.price-block-body { padding: 8px 10px 4px; flex: 1; }
.price-block-name { color: var(--heading-text, #fff); font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.price-block-players { color: var(--success, #5ba85a); font-family: 'Share Tech Mono', monospace; font-size: 10px; margin-top: 2px; }
.price-tag { background: var(--surface-sunken, #131a22); border-top: 1px solid var(--border, #25354b); color: var(--accent, #57b8c7); font-family: 'Rajdhani', sans-serif; font-size: 16px; font-weight: 700; padding: 6px 10px; text-align: right; }
    .price-tag.free { color: var(--success, #5ba85a); }
    .view-tabs button {
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--secondary-text, #8ca0b3);
      cursor: pointer;
      font-family: 'Rajdhani', sans-serif;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 1px;
      padding: 8px 16px 10px;
      text-transform: uppercase;
      transition: color 0.15s, border-color 0.15s;
      margin-bottom: -1px;
    }
    .view-tabs button.active {
      border-bottom-color: var(--accent, #57b8c7);
      color: var(--accent-hover, #66c0f4);
    }
    .view-tabs button:hover:not(.active) { color: var(--primary-text, #c6d4df); }
    .discount-badge { background: var(--success, #5ba85a); border-radius: 3px; color: #000; font-size: 10px; margin-left: 4px; padding: 1px 4px; }
    .top-games-wrap { padding: 20px; }
    .table-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
    .table-title { font-family: 'Rajdhani', sans-serif; font-size: 28px; font-weight: 700; color: var(--heading-text, #fff); margin: 0; }
    .table-sub { font-family: 'Share Tech Mono', monospace; font-size: 11px; color: var(--muted-text, #697f99); margin: 4px 0 0; }
    .table-meta { display: flex; align-items: center; gap: 8px; }
    .live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--warning, #d89b43); flex-shrink: 0; }
    .live-dot.active { background: var(--success, #5ba85a); animation: pulse 1.5s ease-in-out infinite; }
    .live-label { font-family: 'Share Tech Mono', monospace; font-size: 11px; color: var(--muted-text, #697f99); }
    @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }

    .charts-wrap { padding: 20px; }
    .charts-layout { display: grid; grid-template-columns: 260px 1fr; gap: 16px; align-items: start; }

    .charts-sidebar {
      background: var(--surface, #1b2838);
      border: 1px solid var(--border, #25354b);
      border-radius: 8px;
      overflow-y: auto;
      max-height: calc(100vh - 180px);
    }
    .sidebar-title {
      font-family: 'Share Tech Mono', monospace;
      font-size: 10px;
      color: var(--muted-text, #697f99);
      letter-spacing: 1.5px;
      text-transform: uppercase;
      padding: 10px 14px 8px;
      border-bottom: 1px solid var(--border, #25354b);
    }
    .feed-list { display: flex; flex-direction: column; gap: 10px; }
.feed-item { display: flex; gap: 14px; background: var(--surface, #1b2838); border: 1px solid var(--border, #25354b); border-radius: 8px; cursor: pointer; padding: 14px; text-decoration: none; transition: border-color 0.15s; }
.feed-item:hover { border-color: var(--accent, #57b8c7); }
.feed-thumb { width: 120px; height: 68px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }
.feed-body { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.feed-game { color: var(--accent-hover, #66c0f4); font-family: 'Share Tech Mono', monospace; font-size: 10px; text-transform: uppercase; }
.feed-title { color: var(--heading-text, #fff); font-family: 'Rajdhani', sans-serif; font-size: 18px; font-weight: 700; }
.feed-content { color: var(--secondary-text, #aab6c0); font-size: 13px; line-height: 1.5; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.feed-meta { color: var(--muted-text, #75838f); display: flex; font-family: 'Share Tech Mono', monospace; font-size: 10px; gap: 12px; margin-top: 2px; }
    .chart-game-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      background: transparent;
      border: none;
      border-bottom: 1px solid rgba(37,53,75,0.5);
      color: var(--secondary-text, #8ca0b3);
      cursor: pointer;
      padding: 9px 14px;
      text-align: left;
      transition: background 0.15s;
    }
    .chart-game-btn:hover, .chart-game-btn.active {
      background: rgba(102,192,244,0.08);
    }
    .chart-game-btn img { width: 48px; height: 27px; object-fit: cover; border-radius: 3px; flex-shrink: 0; }
    .chart-game-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; overflow: hidden; }
    .chart-game-info strong { font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 700; color: var(--heading-text, #fff); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
    .chart-game-count { font-family: 'Share Tech Mono', monospace; font-size: 10px; color: var(--success, #5ba85a); }
    .loading-screen { padding: 40px 20px; display: flex; flex-direction: column; gap: 12px; align-items: center; }
    .loading-hint { font-family: 'Share Tech Mono', monospace; font-size: 12px; color: var(--muted-text, #697f99); }
    .chart-panel {
      background: var(--surface, #1b2838);
      border: 1px solid var(--border, #25354b);
      border-radius: 8px;
      padding: 20px;
      min-height: 420px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .chart-empty {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Share Tech Mono', monospace;
      font-size: 13px;
      color: var(--muted-text, #697f99);
      text-align: center;
      line-height: 1.8;
    }
    .chart-loading { display: flex; flex-direction: column; gap: 12px; font-family: 'Share Tech Mono', monospace; font-size: 12px; color: var(--muted-text, #697f99); }

    .chart-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
    .chart-game-title { font-family: 'Rajdhani', sans-serif; font-size: 24px; font-weight: 700; color: var(--heading-text, #fff); margin: 0; }
    .chart-game-sub { font-family: 'Share Tech Mono', monospace; font-size: 11px; color: var(--muted-text, #697f99); margin: 4px 0 0; }

    .chart-stats-row { display: flex; gap: 24px; flex-wrap: wrap; }
    .chart-stat { display: flex; flex-direction: column; gap: 3px; }
    .chart-stat-label { font-family: 'Share Tech Mono', monospace; font-size: 10px; color: var(--muted-text, #697f99); text-transform: uppercase; letter-spacing: 1px; }
    .chart-stat strong { font-family: 'Rajdhani', sans-serif; font-size: 20px; font-weight: 700; color: var(--heading-text, #fff); }

    .chart-svg-wrap { flex: 1; }
    .chart-svg { width: 100%; height: 300px; display: block; overflow: visible; }
    .grid-line { stroke: var(--border, #25354b); stroke-width: 1; }
    .y-label { font-family: 'Share Tech Mono', monospace; font-size: 10px; fill: var(--muted-text, #697f99); text-anchor: end; }
    .x-label { font-family: 'Share Tech Mono', monospace; font-size: 10px; fill: var(--muted-text, #697f99); }
    .chart-area { fill: rgba(87,184,199,0.12); }
    .chart-line { fill: none; stroke: var(--accent, #57b8c7); stroke-width: 2; }
    .chart-dot { fill: var(--accent, #57b8c7); cursor: pointer; }

    .green-text { color: var(--success, #5ba85a); }
    .red-text { color: #c94f4f; }
    .muted-text { color: var(--muted-text, #697f99); }

    .loading-bar { height: 2px; background: var(--surface-sunken, #131a22); border-radius: 2px; overflow: hidden; }
    .loading-fill { height: 100%; width: 40%; background: var(--accent, #57b8c7); animation: slide 1.2s ease-in-out infinite; }
    @keyframes slide { 0%{transform:translateX(-100%)}100%{transform:translateX(350%)} }

    .data-table-wrap { overflow-x: auto; }
    .data-table { width: 100%; border-collapse: collapse; font-family: 'Exo 2', sans-serif; font-size: 13px; }
    .data-table thead th { background: var(--surface, #1b2838); color: var(--muted-text, #697f99); font-family: 'Share Tech Mono', monospace; font-size: 10px; letter-spacing: 1px; padding: 10px 12px; text-align: left; text-transform: uppercase; position: sticky; top: 0; z-index: 2; border-bottom: 1px solid var(--border, #25354b); }
    .data-table thead th.num { text-align: right; }
    .data-table tbody tr { border-bottom: 1px solid rgba(37,53,75,0.5); cursor: pointer; transition: background 0.12s; }
    .data-table tbody tr:hover { background: rgba(102,192,244,0.06); }
    .data-table tbody td { padding: 10px 12px; color: var(--secondary-text, #8ca0b3); }
    .data-table tbody td.num { text-align: right; font-family: 'Share Tech Mono', monospace; }
    .rank-cell { color: var(--muted-text, #697f99); font-family: 'Share Tech Mono', monospace; font-size: 12px; width: 48px; }
    .app-cell { display: flex; align-items: center; gap: 10px; }
    .app-cell img { width: 60px; height: 34px; object-fit: cover; border-radius: 3px; flex-shrink: 0; }
    .app-cell strong { display: block; color: var(--primary-text, #c6d4df); font-size: 14px; }
    .app-cell small { color: var(--muted-text, #697f99); font-family: 'Share Tech Mono', monospace; font-size: 10px; }
  `]
})
export class HomeComponent implements OnInit, OnDestroy {
  topGames: SteamTopGame[] = [];
  loadingTop = false;
  activeView: View = 'overview';

  selectedAppid: number | null = null;
  chartLoading = false;
  chartSnapshots: SteamTopSnapshot[] = [];
  chartPoints: ChartPoint[] = [];
  linePath = '';
  areaPath = '';
  yTicks: { y: number; label: string }[] = [];
  xTicks: { x: number; label: string }[] = [];
  chartCurrent = 0;
  chartPeak = 0;
  chartGain = 0;
  chartGainPct = 0;
  readonly svgW = 800;
  readonly svgH = 300;
  readonly pad = { top: 20, right: 20, bottom: 28, left: 60 };
  feedItems: any[] = [];
  feedLoading = false;
  upcomingGames: any[] = [];
  upcomingLoading = false;
  priceSort: 'high' | 'low' = 'high';
  priceCache: Record<number, { name: string; price: string; is_free: boolean; loading: boolean }> = {};
  private topGamesTimer: any = null;
  private readonly refreshMs = 5000;

  private steamNameCache: Record<number, string> = {
    730: 'Counter-Strike 2', 570: 'Dota 2', 578080: 'PUBG: BATTLEGROUNDS',
    1172470: 'Apex Legends', 252490: 'Rust', 105600: 'Terraria',
    413150: 'Stardew Valley', 1245620: 'ELDEN RING', 271590: 'Grand Theft Auto V Legacy',
    1085660: 'Destiny 2', 359550: 'Tom Clancy Rainbow Six Siege',
    381210: 'Dead by Daylight', 236390: 'War Thunder', 431960: 'Wallpaper Engine',
    440: 'Team Fortress 2'
  };

  constructor(private api: ApiService, private router: Router, private cdr: ChangeDetectorRef, private route: ActivatedRoute) {}

 ngOnInit(): void {
  this.activeView = 'overview';
  this.cdr.detectChanges();
  this.loadTopGames();
  this.topGamesTimer = setInterval(() => this.loadTopGames(), this.refreshMs);
}

  ngOnDestroy(): void {
    if (this.topGamesTimer) clearInterval(this.topGamesTimer);
  }
  loadFeed(): void {
  if (this.feedItems.length) return;
  this.feedLoading = true;
  this.api.getTopNewsFeed().subscribe({
    next: (data) => {
      this.feedItems = data;
      this.feedLoading = false;
      this.cdr.detectChanges();
    },
    error: () => { this.feedLoading = false; this.cdr.detectChanges(); }
  });
}
  loadTopGames(): void {
    this.loadingTop = true;
    this.api.getTopGames().subscribe({
      next: (data) => {
        this.topGames = [...data].sort((a, b) =>
          Number(b.concurrent_in_game ?? 0) - Number(a.concurrent_in_game ?? 0)
        ).map((g, i) => ({ ...g, rank: i + 1 }));
        this.hydrateNames(data);
        this.loadingTop = false;
        this.cdr.detectChanges();
      },
error: () => { this.loadingTop = false; this.cdr.detectChanges(); }
    });
  }
get sortedByPrice() {
  return Object.entries(this.priceCache)
    .filter(([_, v]) => !v.loading)
    .map(([appid, data]) => ({
      appid: Number(appid),
      ...data,
      concurrent_in_game: this.topGames.find(g => g.appid === Number(appid))?.concurrent_in_game ?? 0
    }))
    .sort((a, b) => {
      const pa = a.is_free ? 0 : parseFloat(a.price?.replace(/[^0-9.]/g, '') || '0');
      const pb = b.is_free ? 0 : parseFloat(b.price?.replace(/[^0-9.]/g, '') || '0');
      return this.priceSort === 'high' ? pb - pa : pa - pb;
    });
}
  loadUpcoming(): void {
  if (this.upcomingGames.length) return;
  this.upcomingLoading = true;
  this.api.getUpcomingGames().subscribe({
    next: (data) => {
      this.upcomingGames = data;
      this.upcomingLoading = false;
      this.cdr.detectChanges();
    },
    error: () => { this.upcomingLoading = false; this.cdr.detectChanges(); }
  });
}


formatPrice(item: any): string {
  if (item.is_free) return 'Free';
  if (!item.final_price) return 'TBA';
  return '$' + (item.final_price / 100).toFixed(2);
}
loadPrices(): void {
  if (Object.keys(this.priceCache).length) return;
  this.api.getTopGamesExtended(50).subscribe({
    next: (data) => {
      data.forEach((g, i) => {
        this.priceCache[g.appid] = { name: this.gameTitleForApp(g.appid), price: '...', is_free: false, loading: true };
        const tryFetch = () => {
          setTimeout(() => {
            this.api.getSteamAppInfo(g.appid).subscribe({
              next: (info: any) => {
                this.priceCache[g.appid] = {
                  name: info?.name || this.gameTitleForApp(g.appid),
                  price: info?.price_overview?.final_formatted || (info?.is_free ? 'Free' : '—'),
                  is_free: info?.is_free || false,
                  loading: false
                };
                this.cdr.detectChanges();
              },
              error: () => {
                setTimeout(() => {
                  this.api.getSteamAppInfo(g.appid).subscribe({
                    next: (info: any) => {
                      this.priceCache[g.appid] = {
                        name: info?.name || this.gameTitleForApp(g.appid),
                        price: info?.price_overview?.final_formatted || (info?.is_free ? 'Free' : '—'),
                        is_free: info?.is_free || false,
                        loading: false
                      };
                      this.cdr.detectChanges();
                    },
                    error: () => {
                      this.priceCache[g.appid] = { name: this.gameTitleForApp(g.appid), price: '—', is_free: false, loading: false };
                      this.cdr.detectChanges();
                    }
                  });
                }, 3000);
              }
            });
          }, i * 500);
        };
        tryFetch();
      });
    }
  });
}
  selectGame(appid: number): void {
    this.selectedAppid = appid;
    this.chartSnapshots = [];
    this.chartLoading = true;
    this.api.getSteamTopHistory(appid).subscribe({
      next: (data) => {
        this.chartSnapshots = [...data];
        this.buildChart();
        this.chartLoading = false;
        this.cdr.detectChanges();
      },
error: () => { this.chartLoading = false; this.cdr.detectChanges(); }
    });
  }

  private buildChart(): void {
    const snaps = this.chartSnapshots;
    if (!snaps.length) return;

    const values = snaps.map(s => Number(s.current_players));
    const times = snaps.map(s => new Date(s.timestamp).getTime());

    this.chartCurrent = values[values.length - 1];
    this.chartPeak = Math.max(...values);
    this.chartGain = this.chartCurrent - values[0];
    this.chartGainPct = values[0] > 0 ? (this.chartGain / values[0]) * 100 : 0;

    const minVal = Math.max(0, Math.min(...values) * 0.95);
    const maxVal = Math.max(...values) * 1.05 || 1;
    const range = maxVal - minVal || 1;
    const minTime = times[0];
    const maxTime = times[times.length - 1];
    const timeRange = maxTime - minTime || 1;

    const { top, right, bottom, left } = this.pad;
    const innerW = this.svgW - left - right;
    const innerH = this.svgH - top - bottom;

    const toX = (t: number) => left + ((t - minTime) / timeRange) * innerW;
    const toY = (v: number) => top + innerH - ((v - minVal) / range) * innerH;

    this.chartPoints = snaps.map((s, i) => ({
      x: toX(times[i]), y: toY(values[i]),
      value: values[i], timestamp: times[i]
    }));

    const pts = this.chartPoints;
    this.linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    this.areaPath = `${this.linePath} L ${pts[pts.length - 1].x} ${top + innerH} L ${pts[0].x} ${top + innerH} Z`;

    this.yTicks = Array.from({ length: 5 }, (_, i) => {
      const v = Math.round(maxVal - (i / 4) * (maxVal - minVal));
      return { y: toY(v), label: v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v) };
    });

    const step = Math.max(1, Math.floor(snaps.length / 6));
    this.xTicks = snaps
      .filter((_, i) => i % step === 0 || i === snaps.length - 1)
      .map(s => ({
        x: toX(new Date(s.timestamp).getTime()),
        label: this.formatTime(new Date(s.timestamp).getTime())
      }));
  }

  formatTime(ms: number): string {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  gameTitleForApp(appid: number): string {
    return this.steamNameCache[appid] ?? `App ${appid}`;
  }

  steamHeaderUrl(appid: number): string {
    return `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`;
  }

  goToSteamGame(appid: number): void {
  this.router.navigate(['/steam', appid]);
  }

  onImageError(event: Event): void {
  const img = event.target as HTMLImageElement;
  img.src = 'https://cdn.akamai.steamstatic.com/steam/apps/0/header.jpg';
  img.onerror = null;
}

  private hydrateNames(rows: SteamTopGame[]): void {
    rows.forEach(row => {
      if (this.steamNameCache[row.appid]) return;
      this.api.getSteamAppInfo(row.appid).subscribe({
        next: (data) => { if (data?.name) this.steamNameCache[row.appid] = data.name; }
      });
    });
  }
}