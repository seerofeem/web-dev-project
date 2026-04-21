import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Game, OnlineStats, SteamTopGame, SteamTopSnapshot } from '../../interfaces/models';

type HomePanel = 'overview' | 'charts' | 'prices' | 'updates' | 'database';
type SortMode = 'players' | 'peak' | 'name' | 'price' | 'updated' | 'appid';
type PriceFilter = 'all' | 'free' | 'paid' | 'budget' | 'premium';
type StatusFilter = 'all' | 'online' | 'offline' | 'tracked';
type ViewMode = 'table' | 'grid';

interface CountItem {
  label: string;
  count: number;
}

interface DashboardStat {
  label: string;
  value: string;
  hint: string;
  tone: 'accent' | 'green' | 'orange' | 'plain';
}

interface LivePlayerSample {
  value: number;
  timestamp: number;
}

type BroadcastRange = 'short' | 'medium' | 'full';

interface BroadcastChartTick {
  x: number;
  y: number;
  label: string;
  anchor?: 'start' | 'middle' | 'end';
}

interface BroadcastChartPoint {
  x: number;
  y: number;
}

interface BroadcastChartModel {
  game: Game;
  current: number;
  peak: number;
  diff: number;
  diffLabel: string;
  percentLabel: string;
  sampleCount: number;
  rangeLabel: string;
  timeframeLabel: string;
  linePath: string;
  areaPath: string;
  dots: BroadcastChartPoint[];
  yTicks: BroadcastChartTick[];
  xTicks: BroadcastChartTick[];
}

interface BroadcastWindow {
  start: number;
  end: number;
  label: string;
  tickHours: number;
}

interface LivePlayerState {
  current: number;
  peak: number;
  history: LivePlayerSample[];
  loading: boolean;
  error: boolean;
  lastUpdated?: Date;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page steamdb-page" [class.scan-mode]="scanMode">
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

      <main class="content db-shell">
        <section class="command-center">
          <div class="command-copy">
            <div class="eyebrow">SteamDB Mini</div>
            <div class="command-heading">
              <div>
                <h1>Steam app database</h1>
                <p>Live charts, price watch, update history, and fast local lookup for your tracked library.</p>
              </div>
              <button class="btn-primary command-primary" (click)="setPanel('database')">Open database</button>
            </div>

            <div class="command-summary">
              <div class="command-summary-item">
                <span class="command-summary-label">Tracked apps</span>
                <strong>{{ games.length | number }}</strong>
              </div>
              <div class="command-summary-item">
                <span class="command-summary-label">Visible rows</span>
                <strong>{{ filteredGames.length | number }}</strong>
              </div>
              <div class="command-summary-item">
                <span class="command-summary-label">Steam top feed</span>
                <strong>{{ topGames.length | number }}</strong>
              </div>
              <div class="command-summary-item">
                <span class="command-summary-label">Live refresh</span>
                <strong>{{ liveEnabled ? 'On' : 'Off' }}</strong>
              </div>
            </div>

            <div class="command-actions">
              <button class="btn-ghost" (click)="setPanel('charts')">Charts</button>
              <button class="btn-ghost" (click)="setPanel('prices')">Prices</button>
              <button class="btn-ghost" (click)="setPanel('updates')">Updates</button>
              <button class="btn-ghost" (click)="refreshLivePlayers()" [disabled]="liveRefreshInProgress">
                {{ liveRefreshInProgress ? 'Refreshing' : 'Refresh live' }}
              </button>
              <button class="btn-ghost" (click)="toggleScanMode()">
                {{ scanMode ? 'Scanner on' : 'Scanner off' }}
              </button>
              @if (isLoggedIn) {
                <button class="btn-ghost" (click)="showAddForm = !showAddForm">
                  {{ showAddForm ? 'Close import' : 'Import app' }}
                </button>
              }
            </div>
          </div>

          <div class="search-console">
            <div class="search-console-head">
              <div>
                <label class="console-label" for="globalSearch">Quick search</label>
                <div class="console-subline">Search by title, tag, developer, genre, or app id. Press / to focus.</div>
              </div>
              <button class="btn-ghost-sm" (click)="surpriseMe()">Surprise me</button>
            </div>
            <div class="search-line">
              <input
                #globalSearch
                id="globalSearch"
                class="search-input console-search"
                type="text"
                placeholder="Search title, tag, genre, developer, app id..."
                [(ngModel)]="searchQuery"
                name="search"
                (ngModelChange)="applyFilter()" />
              <span class="slash-key">/</span>
            </div>

            <div class="tool-grid">
              <div class="mini-tool">
                <span class="tool-label">Steam Game ID</span>
                <div class="inline-form">
                  <input class="f-input" type="number" placeholder="730" [(ngModel)]="importAppId" name="importAppId" />
                  <button class="btn-primary" (click)="importGame()" [disabled]="importing || !isLoggedIn">
                    {{ importing ? 'Importing' : 'Import' }}
                  </button>
                </div>
                @if (!isLoggedIn) {
                  <span class="tool-note">Sign in to import games.</span>
                }
              </div>

              <div class="mini-tool">
                <span class="tool-label">Live player lookup</span>
                <div class="inline-form">
                  <input class="f-input" type="number" placeholder="appid" [(ngModel)]="lookupAppId" name="lookupAppId" />
                  <button class="btn-ghost" (click)="checkPlayers()" [disabled]="loadingLookup">
                    {{ loadingLookup ? 'Checking' : 'Check' }}
                  </button>
                </div>
                @if (lookupResult) {
                  <span class="tool-note">{{ lookupResult.current_players | number }} online now</span>
                }
              </div>

              <div class="mini-tool">
                <span class="tool-label">Store metadata</span>
                <div class="inline-form">
                  <input class="f-input" type="number" placeholder="appid" [(ngModel)]="previewAppId" name="previewAppId" />
                  <button class="btn-ghost" (click)="previewSteamApp()" [disabled]="loadingPreview">
                    {{ loadingPreview ? 'Loading' : 'Preview' }}
                  </button>
                </div>
                @if (previewData) {
                  <span class="tool-note">{{ previewData.name }} · {{ previewPriceLabel() }}</span>
                }
              </div>
            </div>
          </div>
        </section>

        @if (errorMsg) {
          <div class="banner error">{{ errorMsg }}</div>
        }
        @if (successMsg) {
          <div class="banner success">{{ successMsg }}</div>
        }

        @if (showAddForm && isLoggedIn) {
          <section class="db-panel import-panel">
            <div class="panel-head">
              <div>
                <div class="panel-title">Import from Steam</div>
                <div class="panel-sub">Game metadata, developers, tags, price, and header image.</div>
              </div>
              <button class="btn-ghost-sm" (click)="showAddForm = false">Close</button>
            </div>
            <div class="quick-import-row">
              @for (appid of quickAppIds; track appid) {
                <button class="quick-app" (click)="quickImport(appid)">{{ quickGameName(appid) }}</button>
              }
            </div>
          </section>
        }

        @if (previewData) {
          <section class="preview-row">
            @if (previewData.header_image) {
              <img class="preview-img" [src]="previewData.header_image" [alt]="previewData.name" (error)="onImageError($event)" />
            }
            <div class="preview-body">
              <div class="preview-title">{{ previewData.name }}</div>
              <div class="preview-meta">
                <span>{{ previewData.type || 'game' }}</span>
                <span>{{ previewPriceLabel() }}</span>
                <span>{{ previewData.developers?.join(', ') || 'Unknown developer' }}</span>
              </div>
              <p>{{ previewData.short_description || 'No store description available.' }}</p>
            </div>
            <button class="btn-primary" (click)="importPreview()" [disabled]="!isLoggedIn || importing">Import</button>
          </section>
        }

        <section class="metrics-grid">
          @for (stat of dashboardStats; track stat.label) {
            <div class="metric-tile" [class.accent]="stat.tone === 'accent'" [class.green]="stat.tone === 'green'" [class.orange]="stat.tone === 'orange'">
              <span class="metric-label">{{ stat.label }}</span>
              <strong>{{ stat.value }}</strong>
              <span class="metric-hint">{{ stat.hint }}</span>
            </div>
          }
        </section>

        <nav class="db-tabs" aria-label="Dashboard sections">
          @for (panel of panels; track panel.id) {
            <button [class.active]="activePanel === panel.id" (click)="setPanel(panel.id)">
              {{ panel.label }}
            </button>
          }
        </nav>

        @if (activePanel === 'overview') {
          <section class="dashboard-grid two-col">
            <div class="db-panel">
              <div class="panel-head">
                <div>
                  <div class="panel-title">Most Played Games</div>
                  <div class="panel-sub">Live Steam charts from the public Steam API.</div>
                </div>
                <button class="btn-ghost-sm" (click)="loadTopGames()" [disabled]="loadingTop">
                  {{ loadingTop ? 'Loading' : 'Refresh' }}
                </button>
              </div>
              @if (loadingTop) {
                <div class="loading-bar"><div class="loading-fill"></div></div>
              }
              <div class="data-table-wrap compact-table">
                <table class="data-table tight-table sticky-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Game</th>
                      <th class="num">Players Now</th>
                      <th class="num">24h Peak</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (g of topGames.slice(0, 15); track g.appid) {
                      <tr (click)="goToSteamGame(g.appid)">
                        <td class="rank-cell">#{{ g.rank }}</td>
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
                        <td class="num">{{ g.peak_in_game | number }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

            <div class="db-panel">
              <div class="panel-head">
                <div>
                  <div class="panel-title">Trending Signals</div>
                  <div class="panel-sub">Current players compared with each app peak.</div>
                </div>
              </div>
              <div class="data-table-wrap compact-table">
                <table class="data-table tight-table sticky-table">
                  <thead>
                    <tr>
                      <th>Game</th>
                      <th class="num">Now</th>
                      <th class="num">Peak</th>
                      <th>Load</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (g of topGames.slice(0, 10); track g.appid) {
                      <tr (click)="goToSteamGame(g.appid)">
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
                        <td class="num">{{ g.peak_in_game | number }}</td>
                        <td>
                          <div class="table-progress-cell">
                            <span class="table-bar"><span [style.width.%]="peakRatio(g)"></span></span>
                            <small>{{ peakRatio(g) }}%</small>
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section class="dashboard-grid three-col">
            <div class="db-panel">
              <div class="panel-head">
                <div>
                  <div class="panel-title">Price Buckets</div>
                  <div class="panel-sub">Quick jump into filtered price bands.</div>
                </div>
              </div>
              <div class="data-table-wrap compact-table">
                <table class="data-table tight-table sticky-table">
                  <thead>
                    <tr>
                      <th>Bucket</th>
                      <th class="num">Games</th>
                      <th>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (bucket of priceBuckets; track bucket.label) {
                      <tr (click)="setPriceFilter(bucket.label)">
                        <td>{{ bucket.label }}</td>
                        <td class="num">{{ bucket.count }}</td>
                        <td>
                          <div class="table-progress-cell">
                            <span class="table-bar"><span [style.width.%]="bucketPercent(bucket.count)"></span></span>
                            <small>{{ bucketPercent(bucket.count) }}%</small>
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

            <div class="db-panel">
              <div class="panel-head">
                <div>
                  <div class="panel-title">Hot Tags</div>
                  <div class="panel-sub">Top catalog tags ranked by tracked games.</div>
                </div>
              </div>
              <div class="data-table-wrap compact-table">
                <table class="data-table tight-table sticky-table">
                  <thead>
                    <tr>
                      <th>Tag</th>
                      <th class="num">Games</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (tag of tagCloud.slice(0, 12); track tag.label) {
                      <tr (click)="selectTag(tag.label)">
                        <td>{{ tag.label }}</td>
                        <td class="num">{{ tag.count }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

            <div class="db-panel">
              <div class="panel-head">
                <div>
                  <div class="panel-title">Quick Import Queue</div>
                  <div class="panel-sub">Popular apps ready to import or refresh.</div>
                </div>
              </div>
              <div class="data-table-wrap compact-table">
                <table class="data-table tight-table sticky-table">
                  <thead>
                    <tr>
                      <th>App</th>
                      <th class="num">Players</th>
                      <th class="num">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (appid of quickAppIds; track appid) {
                      <tr class="static-row">
                        <td>
                          <span class="table-app-stack">
                            <strong>{{ quickGameName(appid) }}</strong>
                            <small>Steam ID {{ appid }} · {{ quickAppTracked(appid) ? 'Tracked' : 'Steam only' }}</small>
                          </span>
                        </td>
                        <td class="num green-text">{{ quickAppPlayers(appid) | number }}</td>
                        <td class="num">
                          <button class="btn-ghost-sm" (click)="quickImport(appid)" [disabled]="!isLoggedIn">
                            {{ quickAppActionLabel(appid) }}
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <div class="panel-sub queue-note">Counter-Strike, Dota, PUBG, Apex, Rust, Terraria, Stardew, Elden Ring.</div>
            </div>
          </section>
        }

        @if (activePanel === 'charts') {
          <section class="db-panel">
            <div class="panel-head">
              <div>
                <div class="panel-title">Steam Charts</div>
                <div class="panel-sub">Top 20 games, live players, peaks, and occupancy bars.</div>
              </div>
              <button class="btn-ghost-sm" (click)="loadTopGames()" [disabled]="loadingTop">Refresh</button>
            </div>
            <div class="data-table-wrap">
              <table class="data-table sticky-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Game</th>
                    <th class="num">Players</th>
                    <th class="num">24h Peak</th>
                    <th>Market Share</th>
                  </tr>
                </thead>
                <tbody>
                  @for (g of topGames; track g.appid) {
                    <tr (click)="goToSteamGame(g.appid)">
                      <td class="rank-cell">#{{ g.rank }}</td>
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
                      <td class="num">{{ g.peak_in_game | number }}</td>
                      <td>
                        <div class="table-progress-cell">
                          <span class="table-bar"><span [style.width.%]="topChartPercent(g)"></span></span>
                          <small>{{ topChartPercent(g) }}%</small>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }

        @if (activePanel === 'prices') {
          <section class="dashboard-grid two-col">
            <div class="db-panel">
              <div class="panel-head">
                <div>
                  <div class="panel-title">Catalog Calculator</div>
                  <div class="panel-sub">Compact value summary for the tracked catalog.</div>
                </div>
              </div>
              <div class="data-table-wrap compact-table">
                <table class="data-table tight-table sticky-table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th class="num">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr class="static-row">
                      <td>Total value</td>
                      <td class="num price-cell">{{ catalogValue }}</td>
                    </tr>
                    <tr class="static-row">
                      <td>Average paid price</td>
                      <td class="num">{{ averagePaidPrice }}</td>
                    </tr>
                    <tr class="static-row">
                      <td>Free games</td>
                      <td class="num green-text">{{ freeGamesCount | number }}</td>
                    </tr>
                    <tr class="static-row">
                      <td>Paid games</td>
                      <td class="num">{{ paidGamesCount | number }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div class="db-panel">
              <div class="panel-head">
                <div>
                  <div class="panel-title">Price Buckets</div>
                  <div class="panel-sub">Direct filter shortcuts for free, budget, and premium ranges.</div>
                </div>
              </div>
              <div class="data-table-wrap compact-table">
                <table class="data-table tight-table sticky-table">
                  <thead>
                    <tr>
                      <th>Bucket</th>
                      <th class="num">Games</th>
                      <th>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (bucket of priceBuckets; track bucket.label) {
                      <tr (click)="setPriceFilter(bucket.label)">
                        <td>{{ bucket.label }}</td>
                        <td class="num">{{ bucket.count }}</td>
                        <td>
                          <div class="table-progress-cell">
                            <span class="table-bar"><span [style.width.%]="bucketPercent(bucket.count)"></span></span>
                            <small>{{ bucketPercent(bucket.count) }}%</small>
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section class="db-panel">
            <div class="panel-head">
              <div>
                <div class="panel-title">Deals And Price Watch</div>
                <div class="panel-sub">Local catalog grouped by current Steam price data.</div>
              </div>
              <button class="btn-ghost-sm" (click)="setPanel('database')">Open explorer</button>
            </div>
            <div class="data-table-wrap">
              <table class="data-table sticky-table">
                <thead>
                  <tr>
                    <th>Game</th>
                    <th class="num">Players</th>
                    <th class="num">Peak</th>
                    <th class="num">Price</th>
                    <th>Signal</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  @for (game of priceWatch; track game.id) {
                    <tr (click)="goToGame(game.id)">
                      <td>
                        <div class="app-cell wide">
                          @if (game.header_image) {
                            <img [src]="game.header_image" [alt]="game.title" (error)="onImageError($event)" />
                          }
                          <span>
                            <strong>{{ game.title }}</strong>
                            <small>Steam ID {{ game.steam_appid }}</small>
                          </span>
                        </div>
                      </td>
                      <td class="num green-text">{{ playersFor(game) | number }}</td>
                      <td class="num">{{ peakFor(game) | number }}</td>
                      <td class="num price-cell">{{ priceLabel(game) }}</td>
                      <td><span class="table-pill" [class.hot]="hypeClass(game) === 'hot'" [class.warm]="hypeClass(game) === 'warm'">{{ hypeLabel(game) }}</span></td>
                      <td>{{ game.updated_at | date:'mediumDate' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }

        @if (activePanel === 'updates') {
          <section class="db-panel">
            <div class="panel-head">
              <div>
                <div class="panel-title">Patch Notes And Record Updates</div>
                <div class="panel-sub">Recently updated local records, inspired by SteamDB change history.</div>
              </div>
            </div>
            <div class="data-table-wrap">
              <table class="data-table sticky-table">
                <thead>
                  <tr>
                    <th>Game</th>
                    <th class="num">Players</th>
                    <th class="num">Peak</th>
                    <th>Updated</th>
                    <th>Signal</th>
                  </tr>
                </thead>
                <tbody>
                  @for (game of recentUpdates; track game.id) {
                    <tr (click)="goToGame(game.id)">
                      <td>
                        <div class="app-cell wide">
                          @if (game.header_image) {
                            <img [src]="game.header_image" [alt]="game.title" (error)="onImageError($event)" />
                          }
                          <span>
                            <strong>{{ game.title }}</strong>
                            <small>Steam ID {{ game.steam_appid }}</small>
                          </span>
                        </div>
                      </td>
                      <td class="num green-text">{{ playersFor(game) | number }}</td>
                      <td class="num">{{ peakFor(game) | number }}</td>
                      <td>{{ game.updated_at | date:'medium' }}</td>
                      <td><span class="table-pill" [class.hot]="hypeClass(game) === 'hot'" [class.warm]="hypeClass(game) === 'warm'">{{ hypeLabel(game) }}</span></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }

        @if (activePanel === 'database') {
          <section class="db-panel explorer-panel">
            <div class="panel-head explorer-head">
              <div>
                <div class="panel-title">Database Explorer</div>
                <div class="panel-sub">{{ filteredGames.length }} games after filters · {{ games.length }} total tracked</div>
              </div>
              <div class="view-toggle">
                <button [class.active]="viewMode === 'table'" (click)="viewMode = 'table'">Table</button>
                <button [class.active]="viewMode === 'grid'" (click)="viewMode = 'grid'">Grid</button>
              </div>
            </div>

            <div class="filters advanced-filters">
              <input class="search-input" type="text" placeholder="Search games..." [(ngModel)]="searchQuery" name="search2" (ngModelChange)="applyFilter()" />
              <select class="f-input select-input" [(ngModel)]="activeGenre" name="genre" (ngModelChange)="applyFilter()">
                @for (genre of genres; track genre) {
                  <option [value]="genre">{{ genre === 'all' ? 'All genres' : genre }}</option>
                }
              </select>
              <select class="f-input select-input" [(ngModel)]="activeTag" name="tag" (ngModelChange)="applyFilter()">
                <option value="all">All tags</option>
                @for (tag of tagCloud; track tag.label) {
                  <option [value]="tag.label">{{ tag.label }}</option>
                }
              </select>
              <select class="f-input select-input" [(ngModel)]="priceFilter" name="priceFilter" (ngModelChange)="applyFilter()">
                <option value="all">All prices</option>
                <option value="free">Free</option>
                <option value="paid">Paid</option>
                <option value="budget">Under $10</option>
                <option value="premium">$30+</option>
              </select>
              <select class="f-input select-input" [(ngModel)]="statusFilter" name="statusFilter" (ngModelChange)="applyFilter()">
                <option value="all">Any status</option>
                <option value="online">Online now</option>
                <option value="offline">Zero players</option>
                <option value="tracked">Live tracked</option>
              </select>
              <select class="f-input select-input" [(ngModel)]="activeDeveloper" name="developer" (ngModelChange)="applyFilter()">
                <option value="all">All developers</option>
                @for (dev of developerCloud; track dev.label) {
                  <option [value]="dev.label">{{ dev.label }}</option>
                }
              </select>
              <select class="f-input select-input" [(ngModel)]="sortMode" name="sortMode" (ngModelChange)="applyFilter()">
                <option value="players">Sort: players</option>
                <option value="peak">Sort: peak</option>
                <option value="name">Sort: name</option>
                <option value="price">Sort: price</option>
                <option value="updated">Sort: updated</option>
                <option value="appid">Sort: app id</option>
              </select>
              <input class="f-input min-input" type="number" placeholder="Min players" [(ngModel)]="minPlayers" name="minPlayers" (ngModelChange)="applyFilter()" />
              <input class="f-input min-input" type="number" placeholder="Max $" [(ngModel)]="maxPrice" name="maxPrice" (ngModelChange)="applyFilter()" />
              <button class="btn-ghost" (click)="clearFilters()">Clear</button>
            </div>

            @if (loadingGames) {
              <div class="loading-bar"><div class="loading-fill"></div></div>
            }

            @if (!loadingGames && filteredGames.length === 0) {
              <div class="empty-state">
                <div class="empty-icon">GAME</div>
                <div class="empty-text">
                  {{ games.length ? 'Filters are too strict for the current database.' : 'No games loaded from the server yet.' }}
                </div>
                @if (games.length) {
                  <button class="btn-primary" (click)="clearFilters()">Show all games</button>
                }
              </div>
            }

            @if (viewMode === 'table' && filteredGames.length > 0) {
              <div class="data-table-wrap">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Game</th>
                      <th>Genres</th>
                      <th class="num">Players</th>
                      <th>Live graph</th>
                      <th class="num">Peak</th>
                      <th class="num">Price</th>
                      <th>Signal</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (game of filteredGames; track game.id) {
                      <tr (click)="goToGame(game.id)">
                        <td>
                          <div class="app-cell wide">
                            @if (game.header_image) {
                              <img [src]="game.header_image" [alt]="game.title" (error)="onImageError($event)" />
                            }
                            <span>
                              <strong>{{ game.title }}</strong>
                              <small>Steam ID {{ game.steam_appid }}</small>
                            </span>
                          </div>
                        </td>
                        <td>
                          <div class="inline-tags">
                            @for (genre of game.genres.slice(0, 2); track genre) {
                              <span class="genre-tag">{{ genre }}</span>
                            }
                          </div>
                        </td>
                        <td class="num green-text live-number">
                          <span class="live-dot" [class.loading]="isLiveLoading(game)"></span>
                          {{ playersFor(game) | number }}
                        </td>
                        <td>
                          <svg class="table-sparkline" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
                            <polyline [attr.points]="sparkPoints(game)" />
                          </svg>
                        </td>
                        <td class="num">{{ peakFor(game) | number }}</td>
                        <td class="num price-cell">{{ priceLabel(game) }}</td>
                        <td>
                          <span class="hype-chip" [class.hot]="hypeClass(game) === 'hot'" [class.warm]="hypeClass(game) === 'warm'">{{ hypeLabel(game) }}</span>
                        </td>
                        <td>{{ game.updated_at | date:'mediumDate' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }

            @if (viewMode === 'grid' && filteredGames.length > 0) {
              <div class="games-grid">
                @for (game of filteredGames; track game.id) {
                  <div class="game-card" (click)="goToGame(game.id)">
                    @if (game.header_image) {
                      <img [src]="game.header_image" [alt]="game.title" class="game-img" (error)="onImageError($event)" />
                    } @else {
                      <div class="game-img-placeholder">GAME</div>
                    }
                    <div class="game-body">
                      <div class="game-title">{{ game.title }}</div>
                      <div class="game-meta">
                        @for (genre of game.genres.slice(0, 2); track genre) {
                          <span class="genre-tag">{{ genre }}</span>
                        }
                      </div>
                      <div class="game-stats">
                        <span class="stat-live">{{ playersFor(game) | number }} online</span>
                        <span class="hype-chip" [class.hot]="hypeClass(game) === 'hot'" [class.warm]="hypeClass(game) === 'warm'">{{ hypeLabel(game) }}</span>
                        <span class="stat-price">{{ priceLabel(game) }}</span>
                      </div>
                      <svg class="card-sparkline" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
                        <polyline [attr.points]="sparkPoints(game)" />
                      </svg>
                    </div>
                  </div>
                }
              </div>
            }
          </section>
        }

        <section class="db-panel live-broadcast-panel">
          <div class="panel-head">
            <div>
              <div class="panel-title">Live Player Tracker</div>
              <div class="panel-sub">
                {{ liveEnabled ? 'Auto refresh every ' + liveRefreshMs / 1000 + ' seconds' : 'Auto refresh paused' }}
                · {{ liveUpdatedLabel() }}
              </div>
            </div>
            <div class="broadcast-actions">
              <span class="live-status" [class.on]="liveEnabled">
                <span></span>{{ liveEnabled ? 'LIVE' : 'PAUSED' }}
              </span>
              <button class="btn-ghost-sm" (click)="toggleLiveBroadcast()">
                {{ liveEnabled ? 'Pause' : 'Resume' }}
              </button>
              <button class="btn-ghost-sm" (click)="refreshLivePlayers()" [disabled]="liveRefreshInProgress">
                {{ liveRefreshInProgress ? 'Scanning' : 'Refresh now' }}
              </button>
            </div>
          </div>

          @if (broadcastChart) {
            <div class="broadcast-stage">
              <div class="broadcast-stage-copy">
                <div class="broadcast-kicker">
                  <span class="broadcast-pill">Selected app</span>
                  <span class="broadcast-pill">{{ broadcastChart.sampleCount }} samples</span>
                </div>

                <button class="broadcast-game-link" (click)="openBroadcastGame(broadcastChart.game)">
                  <span class="broadcast-focus-name">{{ broadcastChart.game.title }}</span>
                  <span class="broadcast-focus-meta">Steam ID {{ broadcastChart.game.steam_appid }} · {{ hypeLabel(broadcastChart.game) }}</span>
                </button>

                <div class="broadcast-value-row">
                  <span class="broadcast-value">{{ broadcastChart.current | number }}</span>
                  <span class="broadcast-value-unit">players now</span>
                </div>

                <div class="broadcast-delta" [class.up]="broadcastChart.diff >= 0" [class.down]="broadcastChart.diff < 0">
                  {{ broadcastChart.diffLabel }} · {{ broadcastChart.percentLabel }} over {{ broadcastChart.rangeLabel }}
                </div>

                <div class="broadcast-meta-row">
                  <span>Peak {{ broadcastChart.peak | number }}</span>
                  <span>{{ broadcastChart.timeframeLabel }}</span>
                  <span>{{ liveUpdatedLabel() }}</span>
                </div>
              </div>

              <div class="broadcast-chart-panel">
                <div class="broadcast-stage-controls">
                  @for (range of broadcastRanges; track range.id) {
                    <button [class.active]="broadcastRange === range.id" (click)="setBroadcastRange(range.id)">
                      {{ range.label }}
                    </button>
                  }
                </div>

                <div class="broadcast-chart-shell">
                  <svg class="broadcast-chart" viewBox="0 0 640 240" preserveAspectRatio="none" aria-hidden="true">
                    @for (tick of broadcastChart.yTicks; track tick.label + '-' + tick.y) {
                      <line class="broadcast-grid-line" x1="56" [attr.y1]="tick.y" x2="618" [attr.y2]="tick.y" />
                      <text class="broadcast-y-label" x="46" [attr.y]="tick.y + 4">{{ tick.label }}</text>
                    }
                    <path class="broadcast-area" [attr.d]="broadcastChart.areaPath" />
                    <path class="broadcast-line" [attr.d]="broadcastChart.linePath" />
                    @for (dot of broadcastChart.dots; track dot.x + '-' + dot.y) {
                      <circle class="broadcast-dot" [attr.cx]="dot.x" [attr.cy]="dot.y" r="4" />
                    }
                    @for (tick of broadcastChart.xTicks; track tick.label + '-' + tick.x) {
                      <text class="broadcast-x-label" [attr.x]="tick.x" y="224" [attr.text-anchor]="tick.anchor || 'middle'">{{ tick.label }}</text>
                    }
                  </svg>
                </div>
              </div>
            </div>
          }

          <div class="live-ledger">
            @for (game of liveBoard; track game.id) {
              <button
                class="live-tile"
                [class.active]="broadcastFocusId === game.id"
                [class.hot]="hypeClass(game) === 'hot'"
                [class.warm]="hypeClass(game) === 'warm'"
                (click)="selectBroadcastGame(game)">
                <span class="live-game-name">{{ game.title }}</span>
                <span class="live-game-count">{{ playersFor(game) | number }}</span>
                <span class="live-game-meta">
                  <span>{{ liveDelta(game) }}</span>
                  <span>{{ hypeLabel(game) }}</span>
                </span>
                <svg class="sparkline" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
                  <polyline [attr.points]="sparkPoints(game)" />
                </svg>
              </button>
            }
          </div>

          <div class="heatmap-row" aria-label="Live heat map">
            @for (game of filteredGames; track game.id) {
              <button class="heat-cell" [style.opacity]="heatOpacity(game)" [title]="game.title + ': ' + playersFor(game).toLocaleString() + ' online'" (click)="goToGame(game.id)">
                <span></span>
              </button>
            }
          </div>
        </section>
      </main>
    </div>
  `,
  styles: [':host { display: block; }']
})
export class HomeComponent implements OnInit, OnDestroy {
  @ViewChild('globalSearch') globalSearch?: ElementRef<HTMLInputElement>;

  games: Game[] = [];
  filteredGames: Game[] = [];
  topGames: SteamTopGame[] = [];
  loadingGames = false;
  loadingTop = false;
  loadingLookup = false;
  loadingPreview = false;
  importing = false;
  showAddForm = false;
  isLoggedIn = false;
  searchQuery = '';
  activeGenre = 'all';
  activeTag = 'all';
  activeDeveloper = 'all';
  priceFilter: PriceFilter = 'all';
  statusFilter: StatusFilter = 'all';
  sortMode: SortMode = 'players';
  viewMode: ViewMode = 'table';
  scanMode = false;
  activePanel: HomePanel = 'overview';
  importAppId: number | null = null;
  lookupAppId: number | null = null;
  previewAppId: number | null = null;
  lookupResult: { appid: number; current_players: number; peak_players: number } | null = null;
  previewData: any | null = null;
  minPlayers: number | string | null = null;
  maxPrice: number | string | null = null;
  errorMsg = '';
  successMsg = '';
  genres = ['all', 'Action', 'RPG', 'FPS', 'Strategy', 'Simulation', 'Indie', 'Adventure', 'Sports', 'Racing'];
  panels: { id: HomePanel; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'charts', label: 'Charts' },
    { id: 'prices', label: 'Prices' },
    { id: 'updates', label: 'Updates' },
    { id: 'database', label: 'Database' }
  ];
  quickAppIds = [730, 570, 578080, 1172470, 252490, 105600, 413150, 1245620];
  dashboardStats: DashboardStat[] = [];
  tagCloud: CountItem[] = [];
  genreCloud: CountItem[] = [];
  developerCloud: CountItem[] = [];
  priceBuckets: CountItem[] = [];
  recentUpdates: Game[] = [];
  priceWatch: Game[] = [];
  liveBoard: Game[] = [];
  topBroadcastGames: Game[] = [];
  broadcastChart: BroadcastChartModel | null = null;
  catalogValue = '$0.00';
  averagePaidPrice = '$0.00';
  freeGamesCount = 0;
  paidGamesCount = 0;
  liveStates: Record<number, LivePlayerState> = {};
  liveEnabled = true;
  liveRefreshInProgress = false;
  liveRefreshMs = 45000;
  liveLastUpdated: Date | null = null;
  broadcastFocusId: number | null = null;
  broadcastRange: BroadcastRange = 'full';
  broadcastRanges: { id: BroadcastRange; label: string }[] = [
    { id: 'short', label: '6 hours' },
    { id: 'medium', label: '12 hours' },
    { id: 'full', label: 'Today' }
  ];
  private liveTimer: ReturnType<typeof setInterval> | null = null;
  private liveTimeouts: number[] = [];
  private broadcastHistoryLoadedAt: Record<string, number> = {};
  private readonly broadcastHistoryRefreshMs = 5 * 60 * 1000;
  private readonly liveHistoryLimit = 288;
  private readonly sparklineHistoryLimit = 24;
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

  constructor(
    private api: ApiService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.api.isLoggedIn$.subscribe(v => this.isLoggedIn = v);
    this.route.queryParamMap.subscribe(params => {
      const panel = params.get('panel') as HomePanel | null;
      const query = params.get('q')?.trim() ?? '';
      if (panel && this.panels.some(item => item.id === panel)) {
        this.activePanel = panel;
      } else if (query) {
        this.activePanel = 'database';
      }
      this.searchQuery = query;
      this.applyFilter();
    });
    this.loadGames();
    this.loadTopGames();
  }

  ngOnDestroy(): void {
    if (this.liveTimer) {
      clearInterval(this.liveTimer);
    }
    this.clearLiveTimeouts();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    if (event.defaultPrevented) return;
    if (event.key === '/' && !this.isTyping(event.target)) {
      event.preventDefault();
      this.globalSearch?.nativeElement.focus();
    }
    if (event.key === 'Escape') {
      (document.activeElement as HTMLElement | null)?.blur();
    }
  }

  loadGames(): void {
    this.loadingGames = true;
    this.api.getGames().subscribe({
      next: (res: any) => {
        this.games = res.results ?? res;
        this.errorMsg = '';
        this.seedLiveStates();
        this.rebuildDashboard();
        this.applyFilter();
        this.loadingGames = false;
        this.refreshLivePlayers();
        this.startLiveBroadcast();
      },
      error: () => {
        this.errorMsg = 'Failed to load games from server.';
        this.loadingGames = false;
      }
    });
  }

  loadTopGames(): void {
    this.loadingTop = true;
    this.api.getTopGames().subscribe({
      next: (data) => {
        this.topGames = data;
        this.errorMsg = '';
        this.syncTopBroadcastGames(data);
        this.hydrateTopGameNames(data);
        this.rebuildDashboard();
        this.refreshLiveBoard();
        if (!this.games.length) {
          this.liveLastUpdated = new Date();
        }
        this.startLiveBroadcast();
        this.loadingTop = false;
      },
      error: () => {
        this.loadingTop = false;
        this.errorMsg = 'Steam charts are not available right now.';
      }
    });
  }

  applyFilter(): void {
    const query = this.searchQuery.trim().toLowerCase();
    const minPlayers = this.numericFilterValue(this.minPlayers);
    const maxPrice = this.numericFilterValue(this.maxPrice);
    let list = [...this.games];

    if (query) {
      list = list.filter(g => {
        const developerText = (g.developers ?? []).map(dev => dev.name).join(' ').toLowerCase();
        const haystack = [
          g.title,
          String(g.steam_appid),
          g.genres.join(' '),
          g.tags.join(' '),
          developerText
        ].join(' ').toLowerCase();
        return haystack.includes(query);
      });
    }

    if (this.activeGenre !== 'all') {
      list = list.filter(g => g.genres.some(genre =>
        genre.toLowerCase().includes(this.activeGenre.toLowerCase())
      ));
    }

    if (this.activeTag !== 'all') {
      list = list.filter(g => g.tags.some(tag => tag.toLowerCase() === this.activeTag.toLowerCase()));
    }

    if (this.activeDeveloper !== 'all') {
      list = list.filter(g => (g.developers ?? []).some(dev => dev.name.toLowerCase() === this.activeDeveloper.toLowerCase()));
    }

    list = list.filter(g => this.matchesPriceFilter(g));

    if (minPlayers !== null && minPlayers > 0) {
      list = list.filter(g => this.playersFor(g) >= minPlayers);
    }

    if (maxPrice !== null && maxPrice >= 0) {
      list = list.filter(g => g.is_free || this.priceOf(g) <= maxPrice);
    }

    list = list.filter(g => this.matchesStatusFilter(g));

    list.sort((a, b) => this.compareGames(a, b));
    this.filteredGames = list;
    this.refreshLiveBoard();
  }

  setPanel(panel: HomePanel): void {
    this.activePanel = panel;
  }

  surpriseMe(): void {
    const pool = this.filteredGames.length ? this.filteredGames : this.games;
    if (!pool.length) {
      this.errorMsg = 'Import a few games first, then roulette can pick one.';
      return;
    }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this.successMsg = `Roulette picked "${pick.title}".`;
    setTimeout(() => this.goToGame(pick.id), 450);
  }

  toggleScanMode(): void {
    this.scanMode = !this.scanMode;
  }

  toggleLiveBroadcast(): void {
    this.liveEnabled = !this.liveEnabled;
    if (this.liveEnabled) {
      this.refreshLivePlayers();
      this.startLiveBroadcast();
      return;
    }
    if (this.liveTimer) {
      clearInterval(this.liveTimer);
      this.liveTimer = null;
    }
    this.clearLiveTimeouts();
    this.liveRefreshInProgress = false;
  }

  setGenre(genre: string): void {
    this.activeGenre = genre;
    this.applyFilter();
  }

  selectTag(tag: string): void {
    this.activeTag = this.activeTag === tag ? 'all' : tag;
    this.activePanel = 'database';
    this.applyFilter();
  }

  setPriceFilter(label: string): void {
    const normalized = label.toLowerCase();
    if (normalized.includes('free')) this.priceFilter = 'free';
    else if (normalized.includes('under')) this.priceFilter = 'budget';
    else if (normalized.includes('premium')) this.priceFilter = 'premium';
    else if (normalized.includes('paid')) this.priceFilter = 'paid';
    else this.priceFilter = 'all';
    this.activePanel = 'database';
    this.applyFilter();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.activeGenre = 'all';
    this.activeTag = 'all';
    this.activeDeveloper = 'all';
    this.priceFilter = 'all';
    this.statusFilter = 'all';
    this.minPlayers = null;
    this.maxPrice = null;
    this.sortMode = 'players';
    this.applyFilter();
  }

  importGame(): void {
    if (!this.isLoggedIn) {
      this.errorMsg = 'Sign in to import games from Steam.';
      return;
    }
    if (!this.importAppId) {
      this.errorMsg = 'Enter a valid Steam Game ID.';
      return;
    }
    this.importing = true;
    this.errorMsg = '';
    this.api.importSteamGame(this.importAppId).subscribe({
      next: (res) => {
        this.successMsg = `"${res.game.title}" ${res.created ? 'imported' : 'updated'} successfully.`;
        this.importing = false;
        this.showAddForm = false;
        this.importAppId = null;
        this.loadGames();
        setTimeout(() => this.successMsg = '', 4000);
      },
      error: (err) => {
        this.errorMsg = err.error?.error ?? err.error?.detail ?? 'Import failed. Check the Steam Game ID.';
        this.importing = false;
      }
    });
  }

  quickImport(appid: number): void {
    this.importAppId = appid;
    this.importGame();
  }

  quickGameName(appid: number): string {
    return this.gameTitleForApp(appid);
  }

  quickAppPlayers(appid: number): number {
    const tracked = this.games.find(game => game.steam_appid === appid);
    if (tracked) {
      return this.playersFor(tracked);
    }
    const steamTop = this.topGames.find(game => game.appid === appid);
    return Number(steamTop?.concurrent_in_game ?? 0);
  }

  quickAppTracked(appid: number): boolean {
    return this.games.some(game => game.steam_appid === appid);
  }

  quickAppActionLabel(appid: number): string {
    return this.quickAppTracked(appid) ? 'Update' : 'Import';
  }

  checkPlayers(): void {
    if (!this.lookupAppId) {
      this.errorMsg = 'Enter a Steam Game ID to check live players.';
      return;
    }
    this.loadingLookup = true;
    this.errorMsg = '';
    this.api.getSteamPlayers(this.lookupAppId).subscribe({
      next: (res) => {
        this.lookupResult = res;
        this.loadingLookup = false;
      },
      error: () => {
        this.loadingLookup = false;
        this.errorMsg = 'Could not fetch player count for that Steam Game ID.';
      }
    });
  }

  previewSteamApp(): void {
    if (!this.previewAppId) {
      this.errorMsg = 'Enter a Steam Game ID to preview store metadata.';
      return;
    }
    this.loadingPreview = true;
    this.errorMsg = '';
    this.api.getSteamAppInfo(this.previewAppId).subscribe({
      next: (data) => {
        this.previewData = data;
        this.importAppId = this.previewAppId;
        this.loadingPreview = false;
      },
      error: () => {
        this.loadingPreview = false;
        this.errorMsg = 'Could not load Steam store metadata.';
      }
    });
  }

  importPreview(): void {
    if (this.previewAppId) {
      this.importAppId = this.previewAppId;
      this.importGame();
    }
  }

  goToSteamGame(appid: number): void {
    window.open(`https://store.steampowered.com/app/${appid}`, '_blank');
  }

  goToGame(id: number): void {
    this.router.navigate(['/games', id]);
  }

  openBroadcastGame(game: Game): void {
    if (game.id > 0) {
      this.goToGame(game.id);
      return;
    }
    this.goToSteamGame(game.steam_appid);
  }

  gameTitleForApp(appid: number): string {
    return this.games.find(game => game.steam_appid === appid)?.title
      ?? this.steamNameCache[appid]
      ?? `Steam game ${appid}`;
  }

  steamHeaderUrl(appid: number): string {
    return this.games.find(game => game.steam_appid === appid)?.header_image
      || `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
  }

  playersFor(game: Game): number {
    return Number(this.liveStates[game.id]?.current ?? game.latest_players?.current ?? 0);
  }

  peakFor(game: Game): number {
    return Number(this.liveStates[game.id]?.peak ?? game.latest_players?.peak ?? this.playersFor(game));
  }

  priceLabel(game: Game): string {
    if (game.is_free) return 'Free';
    return `$${this.priceOf(game).toFixed(2)}`;
  }

  peakRatio(game: SteamTopGame): number {
    const peak = Math.max(Number(game.peak_in_game ?? 0), 1);
    return Math.min(100, Math.round((Number(game.concurrent_in_game ?? 0) / peak) * 100));
  }

  topChartPercent(game: SteamTopGame): number {
    const max = Math.max(...this.topGames.map(g => Number(g.concurrent_in_game ?? 0)), 1);
    return Math.max(4, Math.round((Number(game.concurrent_in_game ?? 0) / max) * 100));
  }

  bucketPercent(count: number): number {
    const max = Math.max(...this.priceBuckets.map(bucket => bucket.count), 1);
    return Math.max(6, Math.round((count / max) * 100));
  }

  selectBroadcastGame(game: Game): void {
    this.broadcastFocusId = game.id;
    this.rebuildBroadcastChart();
    this.loadBroadcastHistory(game, true);
  }

  setBroadcastRange(range: BroadcastRange): void {
    if (this.broadcastRange === range) return;
    this.broadcastRange = range;
    this.rebuildBroadcastChart();
  }

  liveUpdatedLabel(): string {
    if (!this.liveLastUpdated) return 'waiting for first scan';
    return `updated ${this.liveLastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  }

  liveDelta(game: Game): string {
    const history = this.liveStates[game.id]?.history ?? [];
    if (history.length < 2) return 'no movement yet';
    const diff = history[history.length - 1].value - history[history.length - 2].value;
    if (diff === 0) return 'no change';
    return `${diff > 0 ? '+' : ''}${diff.toLocaleString()} now`;
  }

  sparkPoints(game: Game): string {
    const values = (this.liveStates[game.id]?.history ?? [])
      .slice(-this.sparklineHistoryLimit)
      .map(sample => sample.value);
    const fallback = this.playersFor(game);
    const points = values.length > 1 ? values : [values[0] ?? fallback, values[0] ?? fallback];
    const baseMin = Math.min(...points);
    const baseMax = Math.max(...points, 1);
    const flatPadding = baseMax === baseMin ? Math.max(1, Math.round(baseMax * 0.04)) : 0;
    const min = Math.max(0, baseMin - flatPadding);
    const max = baseMax + flatPadding;
    const range = max - min || 1;
    return points.map((value, index) => {
      const x = points.length === 1 ? 100 : (index / (points.length - 1)) * 100;
      const y = 29 - ((value - min) / range) * 26;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  hypeScore(game: Game): number {
    const players = this.playersFor(game);
    const peak = Math.max(this.peakFor(game), players, 1);
    const ratio = players / peak;
    const scale = Math.min(1, Math.log10(players + 1) / 6);
    return Math.round((ratio * 65 + scale * 35));
  }

  hypeClass(game: Game): 'hot' | 'warm' | 'quiet' {
    const score = this.hypeScore(game);
    if (score >= 70) return 'hot';
    if (score >= 38) return 'warm';
    return 'quiet';
  }

  hypeLabel(game: Game): string {
    const state = this.hypeClass(game);
    if (state === 'hot') return 'HOT';
    if (state === 'warm') return 'RISING';
    return 'QUIET';
  }

  heatOpacity(game: Game): number {
    return Math.min(1, Math.max(0.22, this.hypeScore(game) / 100));
  }

  isLiveLoading(game: Game): boolean {
    return !!this.liveStates[game.id]?.loading;
  }

  previewPriceLabel(): string {
    if (!this.previewData) return 'Unknown price';
    if (this.previewData.is_free) return 'Free';
    return this.previewData.price_overview?.final_formatted ?? 'No price';
  }

  onImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.style.display = 'none';
  }

  refreshLivePlayers(): void {
    if (this.liveRefreshInProgress) return;
    if (!this.games.length) {
      this.refreshTopBroadcast();
      return;
    }
    this.clearLiveTimeouts();
    this.liveRefreshInProgress = true;
    let completed = 0;
    const targets = [...this.games];

    targets.forEach((game, index) => {
      this.ensureLiveState(game);
      this.liveStates[game.id].loading = true;

      const timeoutId = window.setTimeout(() => {
        this.api.getSteamPlayers(game.steam_appid).subscribe({
          next: (res) => {
            const state = this.ensureLiveState(game);
            const current = Number(res.current_players ?? 0);
            const peak = Math.max(Number(res.peak_players ?? 0), current, state.peak);
            state.current = current;
            state.peak = peak;
            state.history = this.pushLiveSample(state.history, current, Date.now());
            state.loading = false;
            state.error = false;
            state.lastUpdated = new Date();
            game.latest_players = { current, peak };
            completed++;
            this.finishLiveScanIfReady(completed, targets.length);
          },
          error: () => {
            const state = this.ensureLiveState(game);
            state.loading = false;
            state.error = true;
            completed++;
            this.finishLiveScanIfReady(completed, targets.length);
          }
        });
      }, index * 220);
      this.liveTimeouts.push(timeoutId);
    });
  }

  private startLiveBroadcast(): void {
    if (!this.liveEnabled || this.liveTimer) return;
    this.liveTimer = setInterval(() => this.refreshLivePlayers(), this.liveRefreshMs);
  }

  private finishLiveScanIfReady(completed: number, total: number): void {
    this.rebuildDashboard();
    this.applyFilter();
    if (completed < total) return;
    this.liveRefreshInProgress = false;
    this.liveLastUpdated = new Date();
  }

  private clearLiveTimeouts(): void {
    this.liveTimeouts.forEach(id => window.clearTimeout(id));
    this.liveTimeouts = [];
  }

  private seedLiveStates(): void {
    this.games.forEach(game => this.ensureLiveState(game));
  }

  private ensureLiveState(game: Game): LivePlayerState {
    if (!this.liveStates[game.id]) {
      const current = Number(game.latest_players?.current ?? 0);
      const peak = Number(game.latest_players?.peak ?? current);
      this.liveStates[game.id] = {
        current,
        peak,
        history: [{ value: current > 0 ? current : 0, timestamp: Date.now() }],
        loading: false,
        error: false
      };
    }
    return this.liveStates[game.id];
  }

  private hydrateTopGameNames(rows: SteamTopGame[]): void {
    rows.slice(0, 20).forEach(row => {
      const alreadyKnown = this.steamNameCache[row.appid] || this.games.some(game => game.steam_appid === row.appid);
      if (alreadyKnown) return;
      this.api.getSteamAppInfo(row.appid).subscribe({
        next: (data) => {
          if (data?.name) {
            this.steamNameCache[row.appid] = data.name;
            this.syncTopBroadcastGames(this.topGames, false);
            this.rebuildDashboard();
            this.refreshLiveBoard();
          }
        }
      });
    });
  }

  private rebuildDashboard(): void {
    const livePlayers = this.games.reduce((sum, game) => sum + this.playersFor(game), 0);
    const peakPlayers = this.games.reduce((sum, game) => sum + this.peakFor(game), 0);
    const paidGames = this.games.filter(game => !game.is_free);
    const totalValue = paidGames.reduce((sum, game) => sum + this.priceOf(game), 0);
    const topRows = [...this.topGames].sort(
      (a, b) => Number(b.concurrent_in_game ?? 0) - Number(a.concurrent_in_game ?? 0)
    );
    const topLivePlayers = topRows.reduce((sum, game) => sum + Number(game.concurrent_in_game ?? 0), 0);
    const topPeakLeader = topRows.reduce<SteamTopGame | null>((leader, game) => {
      if (!leader) return game;
      return Number(game.peak_in_game ?? 0) > Number(leader.peak_in_game ?? 0) ? game : leader;
    }, null);
    const topLeader = topRows[0] ?? null;
    const topAveragePlayers = topRows.length ? Math.round(topLivePlayers / topRows.length) : 0;
    const topFiveShare = topLivePlayers
      ? (topRows.slice(0, 5).reduce((sum, game) => sum + Number(game.concurrent_in_game ?? 0), 0) / topLivePlayers) * 100
      : 0;

    this.freeGamesCount = this.games.filter(game => game.is_free).length;
    this.paidGamesCount = paidGames.length;
    this.catalogValue = `$${totalValue.toFixed(2)}`;
    this.averagePaidPrice = `$${(paidGames.length ? totalValue / paidGames.length : 0).toFixed(2)}`;

    if (this.games.length) {
      this.dashboardStats = [
        { label: 'Games Tracked', value: this.games.length.toLocaleString(), hint: 'local database', tone: 'accent' },
        { label: 'Players Now', value: livePlayers.toLocaleString(), hint: 'tracked snapshots', tone: 'green' },
        { label: 'Peak Tracked', value: peakPlayers.toLocaleString(), hint: 'highest saved values', tone: 'plain' },
        { label: 'Catalog Value', value: this.catalogValue, hint: `${this.paidGamesCount} paid games`, tone: 'orange' },
        { label: 'Free Games', value: this.freeGamesCount.toLocaleString(), hint: 'free-to-play and promos', tone: 'green' },
        { label: 'Steam Top 20', value: this.topGames.length.toLocaleString(), hint: 'live chart rows', tone: 'accent' }
      ];
    } else if (topRows.length) {
      this.dashboardStats = [
        { label: 'Top Games Loaded', value: topRows.length.toLocaleString(), hint: 'live Steam chart rows', tone: 'accent' },
        { label: 'Players Now', value: topLivePlayers.toLocaleString(), hint: 'sum across the current top feed', tone: 'green' },
        {
          label: 'Highest Peak',
          value: Number(topPeakLeader?.peak_in_game ?? 0).toLocaleString(),
          hint: topPeakLeader ? `${this.gameTitleForApp(topPeakLeader.appid)} reached the biggest peak` : 'chart peak tracker',
          tone: 'plain'
        },
        { label: 'Average Lobby', value: topAveragePlayers.toLocaleString(), hint: 'mean live players per ranked title', tone: 'orange' },
        { label: 'Top 5 Share', value: `${topFiveShare.toFixed(1)}%`, hint: 'how much of the feed is owned by the first five games', tone: 'green' },
        {
          label: 'Leader Now',
          value: Number(topLeader?.concurrent_in_game ?? 0).toLocaleString(),
          hint: topLeader ? this.gameTitleForApp(topLeader.appid) : 'top live title',
          tone: 'accent'
        }
      ];
    } else {
      this.dashboardStats = [
        { label: 'Games Tracked', value: this.games.length.toLocaleString(), hint: 'local database', tone: 'accent' },
        { label: 'Players Now', value: livePlayers.toLocaleString(), hint: 'tracked snapshots', tone: 'green' },
        { label: 'Peak Tracked', value: peakPlayers.toLocaleString(), hint: 'highest saved values', tone: 'plain' },
        { label: 'Catalog Value', value: this.catalogValue, hint: `${this.paidGamesCount} paid games`, tone: 'orange' },
        { label: 'Free Games', value: this.freeGamesCount.toLocaleString(), hint: 'free-to-play and promos', tone: 'green' },
        { label: 'Steam Top 20', value: this.topGames.length.toLocaleString(), hint: 'live chart rows', tone: 'accent' }
      ];
    }

    this.tagCloud = this.countItems(this.games.flatMap(game => game.tags));
    this.genreCloud = this.countItems(this.games.flatMap(game => game.genres));
    this.developerCloud = this.countItems(this.games.flatMap(game => (game.developers ?? []).map(dev => dev.name)));
    this.genres = ['all', ...this.genreCloud.map(genre => genre.label)];
    this.sanitizeFilterSelections();
    this.priceBuckets = [
      { label: 'All prices', count: this.games.length },
      { label: 'Free', count: this.freeGamesCount },
      { label: 'Paid', count: this.paidGamesCount },
      { label: 'Under $10', count: this.games.filter(game => !game.is_free && this.priceOf(game) < 10).length },
      { label: 'Premium $30+', count: this.games.filter(game => !game.is_free && this.priceOf(game) >= 30).length }
    ];
    this.recentUpdates = [...this.games]
      .sort((a, b) => this.dateValue(b.updated_at) - this.dateValue(a.updated_at))
      .slice(0, 12);
    this.priceWatch = [...this.games]
      .sort((a, b) => {
        if (a.is_free !== b.is_free) return a.is_free ? -1 : 1;
        return this.priceOf(a) - this.priceOf(b);
      })
      .slice(0, 8);
  }

  private countItems(items: string[]): CountItem[] {
    const counts = new Map<string, number>();
    items.filter(Boolean).forEach(item => counts.set(item, (counts.get(item) ?? 0) + 1));
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }

  private numericFilterValue(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private sanitizeFilterSelections(): void {
    if (this.activeGenre !== 'all' && !this.genres.includes(this.activeGenre)) {
      this.activeGenre = 'all';
    }
    if (this.activeTag !== 'all' && !this.tagCloud.some(tag => tag.label === this.activeTag)) {
      this.activeTag = 'all';
    }
    if (this.activeDeveloper !== 'all' && !this.developerCloud.some(dev => dev.label === this.activeDeveloper)) {
      this.activeDeveloper = 'all';
    }
  }

  private compareGames(a: Game, b: Game): number {
    switch (this.sortMode) {
      case 'players':
        return this.playersFor(b) - this.playersFor(a);
      case 'peak':
        return this.peakFor(b) - this.peakFor(a);
      case 'name':
        return a.title.localeCompare(b.title);
      case 'price':
        return this.priceOf(b) - this.priceOf(a);
      case 'updated':
        return this.dateValue(b.updated_at) - this.dateValue(a.updated_at);
      case 'appid':
        return a.steam_appid - b.steam_appid;
    }
  }

  private matchesPriceFilter(game: Game): boolean {
    const price = this.priceOf(game);
    switch (this.priceFilter) {
      case 'free':
        return game.is_free;
      case 'paid':
        return !game.is_free;
      case 'budget':
        return !game.is_free && price < 10;
      case 'premium':
        return !game.is_free && price >= 30;
      case 'all':
        return true;
    }
  }

  private matchesStatusFilter(game: Game): boolean {
    switch (this.statusFilter) {
      case 'online':
        return this.playersFor(game) > 0;
      case 'offline':
        return this.playersFor(game) === 0;
      case 'tracked':
        return !!this.liveStates[game.id]?.lastUpdated || (this.liveStates[game.id]?.history.length ?? 0) > 1;
      case 'all':
        return true;
    }
  }

  private refreshLiveBoard(): void {
    const previousFocusId = this.broadcastFocusId;
    const source = this.filteredGames.length
      ? [...this.filteredGames]
      : (!this.games.length ? [...this.topBroadcastGames] : []);

    this.liveBoard = source
      .sort((a, b) => this.playersFor(b) - this.playersFor(a))
      .slice(0, 24);

    if (!this.liveBoard.length) {
      this.broadcastFocusId = null;
      this.broadcastChart = null;
      return;
    }

    if (!this.broadcastFocusId || !this.liveBoard.some(game => game.id === this.broadcastFocusId)) {
      this.broadcastFocusId = this.liveBoard[0].id;
    }

    this.rebuildBroadcastChart();
    const focusGame = this.liveBoard.find(game => game.id === this.broadcastFocusId);
    if (!focusGame) return;
    if (previousFocusId !== this.broadcastFocusId || this.shouldRefreshBroadcastHistory(focusGame)) {
      this.loadBroadcastHistory(focusGame);
    }
  }

  private rebuildBroadcastChart(): void {
    const focusGame = this.liveBoard.find(game => game.id === this.broadcastFocusId);
    if (!focusGame) {
      this.broadcastChart = null;
      return;
    }

    const window = this.broadcastWindow();
    const samples = this.broadcastSamplesFor(focusGame, window);
    if (!samples.length) {
      this.broadcastChart = null;
      return;
    }

    const width = 640;
    const height = 240;
    const pad = { top: 18, right: 22, bottom: 40, left: 56 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const values = samples.map(sample => sample.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values, 1);
    const spread = rawMax - rawMin;
    const padding = spread === 0 ? Math.max(1, Math.round(rawMax * 0.06)) : Math.max(1, Math.round(spread * 0.18));
    const minVal = Math.max(0, rawMin - padding);
    const maxVal = rawMax + padding;
    const range = maxVal - minVal || 1;
    const valueToY = (value: number) => pad.top + innerH - ((value - minVal) / range) * innerH;
    const timeRange = Math.max(window.end - window.start, 1);
    const xForTime = (timestamp: number) => {
      const clamped = Math.min(window.end, Math.max(window.start, timestamp));
      return pad.left + ((clamped - window.start) / timeRange) * innerW;
    };

    let linePath = '';
    let areaPath = '';
    let dots: BroadcastChartPoint[] = [];
    if (samples.length === 1) {
      const centerX = xForTime(samples[0].timestamp);
      const startX = Math.max(pad.left, centerX - 18);
      const endX = Math.min(width - pad.right, centerX + 18);
      const y = valueToY(samples[0].value);
      linePath = `M ${startX} ${y} L ${endX} ${y}`;
      areaPath = `M ${startX} ${height - pad.bottom} L ${startX} ${y} L ${endX} ${y} L ${endX} ${height - pad.bottom} Z`;
      dots = [{ x: centerX, y }];
    } else {
      const points = samples.map(sample => ({
        x: xForTime(sample.timestamp),
        y: valueToY(sample.value)
      }));
      linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
      areaPath = `${linePath} L ${points[points.length - 1].x} ${height - pad.bottom} L ${points[0].x} ${height - pad.bottom} Z`;
      dots = points;
    }

    const yTicks = Array.from({ length: 4 }, (_, index) => {
      const ratio = index / 3;
      const value = Math.round(maxVal - ratio * (maxVal - minVal));
      return {
        x: pad.left,
        y: pad.top + innerH * ratio,
        label: value.toLocaleString()
      };
    });

    const xTicks = this.broadcastTickTimes(window).map((timestamp, index, all) => ({
      x: xForTime(timestamp),
      y: height - 12,
      label: this.formatBroadcastTick(timestamp, window),
      anchor: index === 0 ? 'start' as const : index === all.length - 1 ? 'end' as const : 'middle' as const
    }));

    const first = samples[0];
    const last = samples[samples.length - 1];
    const diff = last.value - first.value;
    const diffLabel = `${diff > 0 ? '+' : ''}${diff.toLocaleString()} players`;
    const percent = first.value > 0 ? (diff / first.value) * 100 : diff > 0 ? 100 : 0;
    const percentLabel = `${percent > 0 ? '+' : ''}${percent.toFixed(Math.abs(percent) >= 10 ? 1 : 2)}%`;
    const timeframeLabel = samples.length > 1
      ? `${this.formatBroadcastTime(first.timestamp)} to ${this.formatBroadcastTime(last.timestamp)}`
      : `Only scan ${this.formatBroadcastTime(last.timestamp)}`;

    this.broadcastChart = {
      game: focusGame,
      current: this.playersFor(focusGame),
      peak: this.peakFor(focusGame),
      diff,
      diffLabel,
      percentLabel,
      sampleCount: samples.length,
      rangeLabel: window.label,
      timeframeLabel: `${window.label} · ${timeframeLabel}`,
      linePath,
      areaPath,
      dots,
      yTicks,
      xTicks
    };
  }

  private broadcastSamplesFor(game: Game, window: BroadcastWindow): LivePlayerSample[] {
    const history = (this.liveStates[game.id]?.history ?? [])
      .slice()
      .sort((a, b) => a.timestamp - b.timestamp);
    const inWindow = history.filter(sample => sample.timestamp >= window.start && sample.timestamp <= window.end);
    if (inWindow.length) {
      return inWindow;
    }
    const fallback = history[history.length - 1];
    return fallback ? [fallback] : [];
  }

  private broadcastWindow(reference = new Date()): BroadcastWindow {
    const end = reference.getTime();
    switch (this.broadcastRange) {
      case 'short':
        return {
          start: end - 6 * 60 * 60 * 1000,
          end,
          label: 'last 6 hours',
          tickHours: 1
        };
      case 'medium':
        return {
          start: end - 12 * 60 * 60 * 1000,
          end,
          label: 'last 12 hours',
          tickHours: 2
        };
      case 'full': {
        const startOfDay = new Date(reference);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(startOfDay);
        endOfDay.setHours(24, 0, 0, 0);
        return {
          start: startOfDay.getTime(),
          end: endOfDay.getTime(),
          label: 'today',
          tickHours: 2
        };
      }
    }
  }

  private broadcastTickTimes(window: BroadcastWindow): number[] {
    const ticks: number[] = [];
    const tickMs = window.tickHours * 60 * 60 * 1000;
    for (let timestamp = window.start; timestamp <= window.end; timestamp += tickMs) {
      ticks.push(timestamp);
    }
    if (ticks[ticks.length - 1] !== window.end) {
      ticks.push(window.end);
    }
    return ticks;
  }

  private formatBroadcastTick(timestamp: number, window: BroadcastWindow): string {
    if (window.label === 'today') {
      return new Date(timestamp).toLocaleTimeString([], {
        hour: 'numeric'
      });
    }
    return new Date(timestamp).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  private formatBroadcastTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private broadcastHistoryKey(game: Game): string {
    return game.id > 0 ? `game:${game.id}` : `steam:${game.steam_appid}`;
  }

  private shouldRefreshBroadcastHistory(game: Game): boolean {
    const loadedAt = this.broadcastHistoryLoadedAt[this.broadcastHistoryKey(game)];
    if (!loadedAt) return true;
    return Date.now() - loadedAt > this.broadcastHistoryRefreshMs;
  }

  private loadBroadcastHistory(game: Game, force = false): void {
    if (!force && !this.shouldRefreshBroadcastHistory(game)) return;

    const applySamples = (samples: LivePlayerSample[]) => {
      const state = this.ensureLiveState(game);
      const merged = [...samples, ...state.history]
        .sort((a, b) => a.timestamp - b.timestamp)
        .reduce((acc, sample) => this.pushLiveSample(acc, sample.value, sample.timestamp), [] as LivePlayerSample[]);

      state.history = merged.slice(-this.liveHistoryLimit);
      if (state.history.length) {
        state.current = state.history[state.history.length - 1].value;
        state.peak = Math.max(state.peak, ...state.history.map(sample => sample.value));
      }
      this.broadcastHistoryLoadedAt[this.broadcastHistoryKey(game)] = Date.now();
      this.rebuildBroadcastChart();
    };

    if (game.id > 0) {
      this.api.getStatsHistory(game.id).subscribe({
        next: (stats: OnlineStats[]) => applySamples(
          stats.map(stat => ({
            value: Number(stat.current_players ?? 0),
            timestamp: new Date(stat.timestamp).getTime()
          }))
        ),
        error: () => undefined
      });
      return;
    }

    this.api.getSteamTopHistory(game.steam_appid).subscribe({
      next: (stats: SteamTopSnapshot[]) => applySamples(
        stats.map(stat => ({
          value: Number(stat.current_players ?? 0),
          timestamp: new Date(stat.timestamp).getTime()
        }))
      ),
      error: () => undefined
    });
  }

  private refreshTopBroadcast(): void {
    this.liveRefreshInProgress = true;
    this.api.getTopGames().subscribe({
      next: (data) => {
        this.topGames = data;
        this.syncTopBroadcastGames(data);
        this.hydrateTopGameNames(data);
        this.rebuildDashboard();
        this.refreshLiveBoard();
        this.liveRefreshInProgress = false;
        this.liveLastUpdated = new Date();
      },
      error: () => {
        this.liveRefreshInProgress = false;
        this.errorMsg = 'Steam charts are not available right now.';
      }
    });
  }

  private syncTopBroadcastGames(rows: SteamTopGame[], recordSample = true): void {
    const existing = new Map(this.topBroadcastGames.map(game => [game.steam_appid, game]));
    const timestamp = Date.now();

    this.topBroadcastGames = rows.slice(0, 20).map(row => {
      const current = Number(row.concurrent_in_game ?? 0);
      const peak = Math.max(Number(row.peak_in_game ?? 0), current);
      const game = existing.get(row.appid) ?? {
        id: -row.appid,
        title: this.gameTitleForApp(row.appid),
        description: '',
        steam_appid: row.appid,
        header_image: this.steamHeaderUrl(row.appid),
        genres: [],
        tags: [],
        price: 0,
        is_free: false,
        latest_players: { current, peak }
      };

      game.title = this.gameTitleForApp(row.appid);
      game.header_image = this.steamHeaderUrl(row.appid);
      game.latest_players = { current, peak };

      const state = this.ensureLiveState(game);
      state.current = current;
      state.peak = Math.max(state.peak, peak);
      if (recordSample) {
        state.history = this.pushLiveSample(state.history, current, timestamp);
      }
      state.loading = false;
      state.error = false;
      state.lastUpdated = new Date(timestamp);

      return game;
    });
  }

  private priceOf(game: Game): number {
    return Number(game.price ?? 0);
  }

  private pushLiveSample(history: LivePlayerSample[], value: number, timestamp: number): LivePlayerSample[] {
    const last = history[history.length - 1];
    if (last && last.value === value && Math.abs(timestamp - last.timestamp) < 3000) {
      return history;
    }
    return [...history, { value, timestamp }].slice(-this.liveHistoryLimit);
  }

  private dateValue(value?: string): number {
    return value ? new Date(value).getTime() : 0;
  }

  private isTyping(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    if (!element) return false;
    const tag = element.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable;
  }
}
