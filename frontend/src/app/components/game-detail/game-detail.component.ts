import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import {
  Developer,
  Game,
  OnlineStats,
  SteamAppDeepData,
  SteamLaunchConfig
} from '../../interfaces/models';
import { ChangeDetectorRef } from '@angular/core';

type DetailTab = 'charts' | 'info' | 'prices' | 'updates' | 'admin';

interface ActivityFeedItem {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  timestamp: number;
  utc: string;
}

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
        <div class="content">
          <section class="detail-header">
            <div class="detail-header-bar">
              <button class="btn-ghost-sm" (click)="goBack()">← BACK</button>
              <div class="detail-header-flags">
                <span class="detail-flag">APP {{ game.steam_appid }}</span>
                <span class="detail-flag">{{ game.is_free ? 'FREE TO PLAY' : 'PAID APP' }}</span>
                <span class="detail-flag">{{ statsHistory.length }} SNAPSHOTS</span>
              </div>
            </div>

            <div class="detail-header-grid">
              <div class="detail-capsule">
                @if (game.header_image) {
                  <img [src]="game.header_image" [alt]="game.title" (error)="onImageError($event)" />
                } @else {
                  <div class="detail-capsule-placeholder">APP {{ game.steam_appid }}</div>
                }
              </div>

              <div class="detail-header-copy">
                <h1 class="detail-title">{{ game.title }}</h1>
                <div class="detail-subtitle">
                  Steam app {{ game.steam_appid }} · {{ storeHeadlinePrice() }} · {{ currentPlayers | number }} players now
                </div>

                <div class="detail-meta-grid">
                  <div class="detail-meta-item">
                    <span>Developer</span>
                    <strong>{{ formatDevelopers(game.developers) }}</strong>
                  </div>
                  <div class="detail-meta-item">
                    <span>Change number</span>
                    <strong>{{ steamDetail?.changenumber || '—' }}</strong>
                  </div>
                  <div class="detail-meta-item">
                    <span>Supported systems</span>
                    <strong>{{ steamPlatformsLabel() }}</strong>
                  </div>
                  <div class="detail-meta-item">
                    <span>Last update UTC</span>
                    <strong>{{ formatUtc(game.updated_at) }}</strong>
                  </div>
                  <div class="detail-meta-item">
                    <span>Record owner</span>
                    <strong>{{ game.created_by_username || 'Public record' }}</strong>
                  </div>
                  <div class="detail-meta-item">
                    <span>Created UTC</span>
                    <strong>{{ formatUtc(game.created_at) }}</strong>
                  </div>
                </div>

                @if (game.description) {
                  <p class="detail-description">{{ game.description }}</p>
                }

                <div class="detail-chip-row">
                  @for (genre of game.genres.slice(0, 4); track genre) {
                    <span class="genre-tag">{{ genre }}</span>
                  }
                  @for (tag of game.tags.slice(0, 6); track tag) {
                    <span class="tag">{{ tag }}</span>
                  }
                </div>

                <div class="detail-actions">
                  <button class="btn-primary" (click)="refreshPlayers()" [disabled]="refreshingPlayers">
                    {{ refreshingPlayers ? 'FETCHING...' : 'REFRESH PLAYERS' }}
                  </button>
                  <button class="btn-ghost" (click)="openStore()">STEAM STORE</button>
                  <button class="btn-ghost" (click)="openSteamDb()">STEAMDB</button>
                  <button class="btn-ghost" (click)="copyAppId()">COPY APP ID</button>
                  @if (isLoggedIn) {
                    <button class="btn-ghost" (click)="toggleWishlist()">
                      {{ inWishlist ? 'IN WISHLIST' : 'ADD TO WISHLIST' }}
                    </button>
                    @if (isAdmin && canDelete) {
                      <button class="btn-danger" (click)="deleteGame()">DELETE</button>
                    }
                  }
                </div>
              </div>
            </div>
          </section>

          @if (errorMsg) {
            <div class="banner error">⚠ {{ errorMsg }}</div>
          }
          @if (successMsg) {
            <div class="banner success">✓ {{ successMsg }}</div>
          }
          @if (steamDetailError) {
            <div class="banner error">⚠ SteamDB proxy: {{ steamDetailError }}</div>
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
                  <div class="stat-label">STORE PRICE</div>
                  <div class="stat-value">{{ storeHeadlinePrice() }}</div>
                  <div class="stat-hint">{{ steamDetail?.pricing?.length || 0 }} currencies tracked</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">CHANGENUMBER</div>
                  <div class="stat-value mono">{{ steamDetail?.changenumber || game.steam_appid }}</div>
                  <div class="stat-hint">{{ steamDetail?.build_id ? 'build ' + steamDetail?.build_id : 'store identifier' }}</div>
                </div>
              </div>

              <nav class="detail-tabs" aria-label="Game details">
                @for (tab of detailTabs; track tab.id) {
                  <button [class.active]="activeTab === tab.id" (click)="setTab(tab.id)">
                    {{ tab.label }}
                  </button>
                }
                @if (isAdmin) {
                  <button [class.active]="activeTab === 'admin'" (click)="setTab('admin')">ADMIN</button>
                }
              </nav>

              @if (activeTab === 'charts') {
                <div class="card">
                  <div class="card-head">
                    <span class="card-title">ONLINE HISTORY</span>
                    <span class="card-sub">{{ statsHistory.length }} snapshots · {{ trendLabel() }}</span>
                  </div>
                  <div class="chart-wrap">
                    <canvas #chartCanvas class="chart-canvas"></canvas>
                    @if (statsHistory.length === 0) {
                      <div class="chart-empty">No history yet. Click LIVE PLAYERS to record a snapshot.</div>
                    }
                  </div>
                </div>

                <div class="detail-metrics">
                  <div>
                    <span>Average players</span>
                    <strong>{{ averagePlayers() | number }}</strong>
                  </div>
                  <div>
                    <span>Lowest snapshot</span>
                    <strong>{{ minSnapshot() | number }}</strong>
                  </div>
                  <div>
                    <span>Highest snapshot</span>
                    <strong>{{ maxSnapshot() | number }}</strong>
                  </div>
                  <div>
                    <span>Last update</span>
                    <strong>{{ latestSnapshotTime() }}</strong>
                  </div>
                </div>

                <div class="card">
                  <div class="card-title">SNAPSHOTS</div>
                  <div class="data-table-wrap">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th class="num">Players</th>
                          <th class="num">Peak</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (stat of statsHistory.slice().reverse(); track stat.timestamp) {
                          <tr>
                            <td>{{ formatUtc(stat.timestamp) }}</td>
                            <td class="num green-text">{{ stat.current_players | number }}</td>
                            <td class="num">{{ stat.peak_players | number }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              }

              @if (activeTab === 'info') {
                <div class="card">
                  <div class="card-title">ABOUT</div>
                  <p class="description">{{ game.description || 'No description available.' }}</p>
                </div>

                <div class="card">
                  <div class="card-head">
                    <span class="card-title">STEAM METADATA</span>
                    <span class="card-sub">{{ steamDetail?.build_id ? 'public build ' + steamDetail?.build_id : 'local + Steam store record' }}</span>
                  </div>
                  <div class="meta-grid">
                    <div><span>Steam Game ID</span><strong>{{ game.steam_appid }}</strong></div>
                    <div><span>Type</span><strong>{{ steamDetail?.store_type || 'Game' }}</strong></div>
                    <div><span>Developer</span><strong>{{ formatDevelopers(game.developers) }}</strong></div>
                    <div><span>Record owner</span><strong>{{ game.created_by_username || 'Public record' }}</strong></div>
                    <div><span>Change number</span><strong>{{ steamDetail?.changenumber || '—' }}</strong></div>
                    <div><span>Payload SHA</span><strong>{{ steamDetail?.sha || '—' }}</strong></div>
                    <div><span>Public build</span><strong>{{ steamDetail?.build_id || '—' }}</strong></div>
                    <div><span>Steam release UTC</span><strong>{{ formatUtc(steamDetail?.steam_release_at) }}</strong></div>
                    <div><span>Store asset UTC</span><strong>{{ formatUtc(steamDetail?.store_last_updated_at) }}</strong></div>
                    <div><span>Created UTC</span><strong>{{ formatUtc(game.created_at) }}</strong></div>
                    <div><span>Updated UTC</span><strong>{{ formatUtc(game.updated_at) }}</strong></div>
                    <div><span>Platforms</span><strong>{{ steamPlatformsLabel() }}</strong></div>
                    <div><span>Languages</span><strong>{{ steamDetail?.supported_languages?.length || 0 }}</strong></div>
                  </div>
                </div>

                <div class="card">
                  <div class="card-title">TAGS AND CATEGORIES</div>
                  <div class="tags-wrap">
                    @for (tag of game.tags; track tag) {
                      <span class="tag">{{ tag }}</span>
                    }
                    @for (genre of game.genres; track genre) {
                      <span class="genre-tag">{{ genre }}</span>
                    }
                    @for (category of steamDetail?.categories || []; track category) {
                      <span class="tag">{{ category }}</span>
                    }
                  </div>
                </div>

                <div class="card">
                  <div class="card-head">
                    <span class="card-title">DEPOTS</span>
                    <span class="card-sub">{{ steamDetail?.depots?.length || 0 }} depot rows · public manifests</span>
                  </div>
                  <div class="data-table-wrap">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Depot</th>
                          <th>OS</th>
                          <th class="num">Manifests</th>
                          <th class="num">Public size</th>
                          <th>Public GID</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (depot of steamDetail?.depots || []; track depot.depot_id) {
                          <tr>
                            <td>{{ depot.depot_id }}</td>
                            <td>{{ depot.oslist || 'all' }}{{ depot.osarch ? ' / ' + depot.osarch : '' }}</td>
                            <td class="num">{{ depot.manifest_count }}</td>
                            <td class="num">{{ formatBytes(depot.public_size) }}</td>
                            <td>{{ depot.public_gid || '—' }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>

                <div class="dashboard-grid two-col">
                  <div class="card">
                    <div class="card-head">
                      <span class="card-title">LAUNCH CONFIGS</span>
                      <span class="card-sub">{{ steamDetail?.launch_configs?.length || 0 }} launch entries</span>
                    </div>
                    <div class="data-table-wrap">
                      <table class="data-table compact-launch-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Executable</th>
                            <th>Profile</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (launch of steamDetail?.launch_configs || []; track launch.index) {
                            <tr>
                              <td>{{ launch.index }}</td>
                              <td>{{ launch.executable || '—' }}</td>
                              <td>{{ launchConfigLabel(launch) }}</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div class="card">
                    <div class="card-head">
                      <span class="card-title">CONFIG FLAGS</span>
                      <span class="card-sub">{{ steamDetail?.config_entries?.length || 0 }} selected runtime keys</span>
                    </div>
                    <div class="info-rows">
                      @for (entry of steamDetail?.config_entries || []; track entry.key) {
                        <div class="info-row">
                          <span class="info-key">{{ entry.key }}</span>
                          <span class="info-val config-value">{{ entry.value }}</span>
                        </div>
                      }
                    </div>
                  </div>
                </div>
              }

              @if (activeTab === 'prices') {
                <div class="price-summary">
                  <div>
                    <span>Current price</span>
                    <strong>{{ storeHeadlinePrice() }}</strong>
                  </div>
                  <div>
                    <span>Currencies tracked</span>
                    <strong>{{ steamDetail?.pricing?.length || 0 }}</strong>
                  </div>
                  <div>
                    <span>Package groups</span>
                    <strong>{{ steamDetail?.package_groups?.length || 0 }}</strong>
                  </div>
                </div>

                <div class="card">
                  <div class="card-head">
                    <span class="card-title">MULTI-CURRENCY PRICE TABLE</span>
                    <span class="card-sub">Steam store pricing matrix by selected country storefronts</span>
                  </div>
                  <div class="data-table-wrap">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Region</th>
                          <th>Price</th>
                          <th>Base</th>
                          <th class="num">Discount</th>
                          <th>Currency</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (price of steamDetail?.pricing || []; track price.country_code) {
                          <tr>
                            <td>{{ price.country_name }} ({{ price.country_code }})</td>
                            <td class="green-text">{{ price.final_formatted }}</td>
                            <td>{{ price.initial_formatted }}</td>
                            <td class="num">{{ price.discount_percent }}%</td>
                            <td>{{ price.currency || 'FREE' }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>

                <div class="card">
                  <div class="card-head">
                    <span class="card-title">PACKAGES</span>
                    <span class="card-sub">{{ steamDetail?.package_ids?.length || 0 }} package ids surfaced by the store</span>
                  </div>
                  <div class="package-list">
                    @for (group of steamDetail?.package_groups || []; track group.name + group.title) {
                      @for (sub of group.subs; track sub.packageid) {
                        <div class="package-row">
                          <span>#{{ sub.packageid }}</span>
                          <strong>{{ sub.option_text }}</strong>
                          <em>{{ sub.is_free_license ? 'Free' : (sub.percent_savings ? '-' + sub.percent_savings + '%' : 'Store') }}</em>
                        </div>
                      }
                    }
                    @if (!(steamDetail?.package_groups?.length)) {
                      <div class="package-row">
                        <span>Store hub</span>
                        <strong>steam://store/{{ game.steam_appid }}</strong>
                        <em>External</em>
                      </div>
                    }
                  </div>
                </div>
              }

              @if (activeTab === 'updates') {
                <div class="detail-metrics">
                  <div>
                    <span>Change number</span>
                    <strong>{{ steamDetail?.changenumber || '—' }}</strong>
                  </div>
                  <div>
                    <span>Public build</span>
                    <strong>{{ steamDetail?.build_id || '—' }}</strong>
                  </div>
                  <div>
                    <span>Steam news items</span>
                    <strong>{{ steamDetail?.news_feed?.length || 0 }}</strong>
                  </div>
                  <div>
                    <span>Last branch UTC</span>
                    <strong>{{ latestBranchUpdate() }}</strong>
                  </div>
                </div>

                <div class="card">
                  <div class="card-head">
                    <span class="card-title">BUILD AND BRANCH HISTORY</span>
                    <span class="card-sub">Public branch updates from Steam app metadata</span>
                  </div>
                  <div class="data-table-wrap">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Branch</th>
                          <th class="num">Build</th>
                          <th>Built UTC</th>
                          <th>Updated UTC</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (branch of steamDetail?.branches || []; track branch.name) {
                          <tr>
                            <td>{{ branch.name }}</td>
                            <td class="num">{{ branch.buildid || '—' }}</td>
                            <td>{{ formatUtc(branch.built_at) }}</td>
                            <td>{{ formatUtc(branch.updated_at) }}</td>
                            <td>{{ branch.description || '—' }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>

                <div class="card">
                  <div class="card-head">
                    <span class="card-title">PATCH / FEED HISTORY</span>
                    <span class="card-sub">Steam news, branch flips, local metadata changes, and tracked player snapshots</span>
                  </div>
                  <div class="timeline">
                    @for (item of activityFeed; track item.id) {
                      <div class="timeline-row static-row">
                        <span class="timeline-dot"></span>
                        <span class="timeline-main">
                          <strong>{{ item.title }}</strong>
                          <small>{{ item.subtitle }} · {{ item.utc }}</small>
                        </span>
                        <span class="timeline-meta">{{ item.meta }}</span>
                      </div>
                    }
                  </div>
                </div>
              }

              @if (activeTab === 'admin' && isAdmin) {
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
                <div class="card-title">EXTERNAL LINKS</div>
                <div class="info-rows">
                  <div class="info-row">
                    <span class="info-key">APP ID</span>
                    <span class="info-val">{{ game.steam_appid }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-key">PRICE</span>
                    <span class="info-val">{{ storeHeadlinePrice() }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-key">BUILD</span>
                    <span class="info-val">{{ steamDetail?.build_id || '—' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-key">CHANGE</span>
                    <span class="info-val">{{ steamDetail?.changenumber || '—' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-key">UPDATED UTC</span>
                    <span class="info-val">{{ formatUtc(game.updated_at) }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-key">SNAPSHOTS</span>
                    <span class="info-val">{{ statsHistory.length }}</span>
                  </div>
                </div>
                <a class="steam-link" [href]="'https://store.steampowered.com/app/' + game.steam_appid" target="_blank">
                  OPEN STEAM STORE →
                </a>
                <a class="steam-link secondary-link" [href]="'https://steamdb.info/app/' + game.steam_appid + '/'" target="_blank">
                  OPEN STEAMDB →
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

              <div class="card">
                <div class="card-title">RECORD HEALTH</div>
                <div class="info-rows">
                  <div class="info-row">
                    <span class="info-key">SNAPSHOTS</span>
                    <span class="info-val">{{ statsHistory.length }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-key">TAGS</span>
                    <span class="info-val">{{ game.tags.length }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-key">GENRES</span>
                    <span class="info-val">{{ game.genres.length }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-key">NEWS ITEMS</span>
                    <span class="info-val">{{ steamDetail?.news_feed?.length || 0 }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-key">DEPOTS</span>
                    <span class="info-val">{{ steamDetail?.depots?.length || 0 }}</span>
                  </div>
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
    :host { display: block; background: var(--background); min-height: 100vh; font-family: 'Exo 2', sans-serif; color: var(--primary-text); }

    .loading-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; gap: 16px; }
    .spinner { width: 32px; height: 32px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to{transform:rotate(360deg)} }
    .loading-text { font-family: 'Share Tech Mono', monospace; font-size: 11px; color: var(--muted-text); letter-spacing: 2px; }

    .content { max-width: 1280px; margin: 0 auto; padding: 24px 20px; }
    .detail-header { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 16px; padding: 14px; }
    .detail-header-bar { align-items: center; display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; margin-bottom: 12px; }
    .detail-header-flags { display: flex; flex-wrap: wrap; gap: 6px; }
    .detail-flag {
      background: var(--surface-sunken);
      border: 1px solid var(--border);
      border-radius: 4px;
      color: var(--muted-text);
      font-family: 'Share Tech Mono', monospace;
      font-size: 9px;
      letter-spacing: 0.8px;
      padding: 4px 7px;
      text-transform: uppercase;
    }
    .detail-header-grid { display: grid; gap: 14px; grid-template-columns: 300px minmax(0, 1fr); }
    .detail-capsule {
      background: var(--surface-sunken);
      border: 1px solid var(--border);
      border-radius: 4px;
      min-height: 140px;
      overflow: hidden;
    }
    .detail-capsule img { display: block; height: 100%; object-fit: cover; width: 100%; }
    .detail-capsule-placeholder {
      align-items: center;
      color: var(--muted-text);
      display: flex;
      font-family: 'Share Tech Mono', monospace;
      font-size: 12px;
      height: 100%;
      justify-content: center;
      min-height: 140px;
    }
    .detail-header-copy { min-width: 0; }
    .detail-title {
      color: var(--heading-text);
      font-family: 'Rajdhani', sans-serif;
      font-size: 34px;
      font-weight: 700;
      letter-spacing: 1px;
      line-height: 1;
      margin-bottom: 6px;
    }
    .detail-subtitle {
      color: var(--secondary-text);
      font-family: 'Share Tech Mono', monospace;
      font-size: 10px;
      line-height: 1.5;
      margin-bottom: 12px;
    }
    .detail-meta-grid { display: grid; gap: 8px; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-bottom: 12px; }
    .detail-meta-item {
      background: var(--surface-sunken);
      border: 1px solid var(--border);
      border-radius: 4px;
      min-width: 0;
      padding: 9px 10px;
    }
    .detail-meta-item span {
      color: var(--muted-text);
      display: block;
      font-family: 'Share Tech Mono', monospace;
      font-size: 9px;
      letter-spacing: 0.7px;
      margin-bottom: 5px;
      text-transform: uppercase;
    }
    .detail-meta-item strong {
      color: var(--heading-text);
      display: block;
      font-family: 'Rajdhani', sans-serif;
      font-size: 18px;
      line-height: 1.1;
      overflow-wrap: anywhere;
    }
    .detail-description {
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
      color: var(--secondary-text);
      display: -webkit-box;
      font-size: 13px;
      line-height: 1.55;
      margin-bottom: 12px;
      overflow: hidden;
    }
    .detail-chip-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .detail-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .layout { display: grid; grid-template-columns: 1fr 300px; gap: 20px; }
    @media (max-width: 980px) {
      .detail-header-grid,
      .layout {
        grid-template-columns: 1fr;
      }
    }
    .data-table-wrap { overflow: auto; max-height: 400px; }
    .data-table thead th { position: sticky; top: 0; z-index: 2; background: var(--surface, #1b2228); }
    .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
    @media (max-width: 700px) {
      .stats-row { grid-template-columns: repeat(2, 1fr); }
      .detail-header { padding: 12px; }
      .detail-title { font-size: 28px; }
      .detail-meta-grid { grid-template-columns: 1fr; }
      .detail-actions,
      .detail-header-bar { align-items: stretch; flex-direction: column; }
    }
    .stat-card { background: var(--surface); border: 1px solid var(--border); padding: 14px; }
    .stat-label { font-family: 'Share Tech Mono', monospace; font-size: 9px; color: var(--muted-text); letter-spacing: 1px; margin-bottom: 6px; }
    .stat-value { font-family: 'Rajdhani', sans-serif; font-size: 26px; font-weight: 700; color: var(--heading-text); line-height: 1; }
    .stat-value.green { color: var(--success); }
    .stat-value.accent { color: var(--accent); }
    .stat-value.mono { font-family: 'Share Tech Mono', monospace; font-size: 18px; }
    .stat-hint { font-family: 'Share Tech Mono', monospace; font-size: 9px; color: var(--muted-text); margin-top: 4px; }

    .card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .card-head .card-title { margin-bottom: 0; }
    .card-sub { font-family: 'Share Tech Mono', monospace; font-size: 10px; color: var(--muted-text); }
    .chart-wrap { position: relative; height: 160px; }
    .chart-canvas { width: 100% !important; height: 160px !important; }
    .chart-empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: 'Share Tech Mono', monospace; font-size: 11px; color: var(--muted-text); }

    .description { font-size: 14px; color: var(--secondary-text); line-height: 1.7; }

    .f-textarea { resize: vertical; font-family: 'Exo 2', sans-serif; }
    .edit-form { margin-top: 4px; }

    .info-rows { margin-bottom: 16px; }
    .info-val { text-align: right; max-width: 55%; }
    .config-value { max-width: 64%; overflow-wrap: anywhere; }
    .compact-launch-table { min-width: 100%; }
    .steam-link { display: block; font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 1px; color: var(--accent-hover); text-decoration: none; text-align: center; border: 1px solid var(--accent-border); padding: 8px; transition: background 0.15s, border-color 0.15s; }
    .steam-link:hover { background: var(--accent-soft); border-color: var(--accent); }
    .tags-wrap { display: flex; flex-wrap: wrap; gap: 6px; }

    .not-found { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; gap: 12px; }
    .nf-code { font-family: 'Rajdhani', sans-serif; font-size: 80px; font-weight: 700; color: var(--border-strong); }
    .nf-text { font-family: 'Share Tech Mono', monospace; font-size: 14px; color: var(--muted-text); margin-bottom: 8px; }
  `]
})
export class GameDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  private playersTimer: any = null
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  game: Game | null = null;
  statsHistory: OnlineStats[] = [];
  steamDetail: SteamAppDeepData | null = null;
  activityFeed: ActivityFeedItem[] = [];
  loading = true;
  loadingSteamDetail = false;
  refreshingPlayers = false;
  saving = false;
  isLoggedIn = false;
  isAdmin = false;
  inWishlist = false;
  canDelete = false;
  showEdit = false;
  activeTab: DetailTab = 'charts';
  detailTabs: { id: DetailTab; label: string }[] = [
    { id: 'charts', label: 'CHARTS' },
    { id: 'info', label: 'INFO' },
    { id: 'prices', label: 'PRICES' },
    { id: 'updates', label: 'UPDATES' }
  ];
  currentPlayers = 0;
  peakPlayers = 0;
  errorMsg = '';
  successMsg = '';
  steamDetailError = '';
  editTitle = '';
  editDescription = '';
  editPrice = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
  this.api.isLoggedIn$.subscribe(v => {
    this.isLoggedIn = v;
    if (v) this.checkWishlist();
  });
  this.api.isAdmin$.subscribe(v => {
    this.isAdmin = v;
    this.canDelete = v;
    if (!v && this.activeTab === 'admin') {
      this.activeTab = 'charts';
    }
  });
  const id = Number(this.route.snapshot.paramMap.get('id'));
  const appid = Number(this.route.snapshot.paramMap.get('appid'));
  if (appid) {
    this.loadGameByAppid(appid);
  } else {
    this.loadGame(id);
  }
  }
  ngOnDestroy(): void {
  if (this.playersTimer) clearInterval(this.playersTimer);
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
        this.canDelete = this.isAdmin;
        this.loading = false;
        if (this.isLoggedIn) this.checkWishlist();
        this.loadStats(id);
        this.loadSteamDetail(game.steam_appid);
        this.rebuildActivityFeed();
      },
      error: () => { this.loading = false; }
    });
  }

  loadStats(gameId: number): void {
    this.api.getStatsHistory(gameId).subscribe({
      next: (stats) => {
        this.statsHistory = stats.reverse(); // oldest first
        this.rebuildActivityFeed();
        setTimeout(() => this.drawChart(), 100);
      }
    });
  }
loadGameByAppid(appid: number): void {
  this.loading = true;

  const infoPromise = this.api.getSteamAppInfo(appid).toPromise().catch(() => null);
  const deepPromise = this.api.getSteamAppDeepData(appid).toPromise().catch(() => null);

  Promise.all([infoPromise, deepPromise]).then(([info, deep]: [any, any]) => {
    if (!info && !deep) {
      this.errorMsg = 'Could not load data for this app.';
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }

    this.steamDetail = deep as any;

    this.game = {
      id: -appid,
      title: info?.name || `App ${appid}`,
      description: info?.short_description || '',
      steam_appid: appid,
      header_image: info?.header_image || '',
      genres: (info?.genres || []).map((g: any) => g.description || g),
      tags: (info?.categories || []).map((c: any) => c.description || c),
      price: info?.price_overview?.final / 100 || 0,
      is_free: info?.is_free || false,
      developers: (info?.developers || []).map((name: string) => ({ name })),
      created_at: deep?.steam_release_at || null,
      updated_at: deep?.store_last_updated_at || null,
      latest_players: { current: 0, peak: 0 },
    } as any;

    this.currentPlayers = 0;
    this.peakPlayers = Number(deep?.peak_players ?? 0);

    this.api.getSteamPlayers(appid).subscribe({
      next: (res) => {
        this.currentPlayers = res.current_players ?? 0;
        this.peakPlayers = Math.max(this.peakPlayers, this.currentPlayers);
        this.cdr.detectChanges();
      }
    });

    this.playersTimer = setInterval(() => {
      this.api.getSteamPlayers(appid).subscribe({
        next: (res) => {
          this.currentPlayers = res.current_players ?? 0;
          this.peakPlayers = Math.max(this.peakPlayers, this.currentPlayers);
          this.cdr.detectChanges();
        }
      });
    }, 1000);

    this.canDelete = false;
    this.loading = false;
    this.loadingSteamDetail = false;
    this.rebuildActivityFeed();
    this.cdr.detectChanges();
  });
}
  loadSteamDetail(appid: number): void {
    this.loadingSteamDetail = true;
    this.steamDetailError = '';
    this.api.getSteamAppDeepData(appid).subscribe({
      next: (data) => {
        this.steamDetail = data as any;
        this.loadingSteamDetail = false;
        this.rebuildActivityFeed();
      },
      error: (err) => {
        this.loadingSteamDetail = false;
        this.steamDetailError = err.error?.error ?? 'Could not load Steam app metadata.';
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

  if (this.inWishlist) {
    this.api.removeFromWishlist(this.game.id).subscribe({
      next: () => {
        this.inWishlist = false;
        this.successMsg = 'Removed from wishlist.';
        setTimeout(() => this.successMsg = '', 3000);
      },
      error: () => { this.errorMsg = 'Failed to remove from wishlist.'; }
    });
    return;
  }

  if (this.game.id < 0) {
    // auto-import then add to wishlist
    this.successMsg = 'Importing game...';
    this.api.importSteamGame(this.game.steam_appid).subscribe({
      next: (res) => {
        this.game!.id = res.game.id;
        this.api.addToWishlist(res.game.id).subscribe({
          next: () => {
            this.inWishlist = true;
            this.successMsg = 'Added to wishlist!';
            setTimeout(() => this.successMsg = '', 3000);
          },
          error: () => { this.errorMsg = 'Failed to add to wishlist.'; }
        });
      },
      error: () => {
        this.errorMsg = 'Failed to import game. Try again.';
        this.successMsg = '';
      }
    });
    return;
  }

  this.api.addToWishlist(this.game.id).subscribe({
    next: () => {
      this.inWishlist = true;
      this.successMsg = 'Added to wishlist!';
      setTimeout(() => this.successMsg = '', 3000);
    },
    error: () => { this.errorMsg = 'Failed to add to wishlist.'; }
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
        this.rebuildActivityFeed();
        this.successMsg = 'Game updated successfully!';
        this.saving = false;
        this.showEdit = false;
        setTimeout(() => this.successMsg = '', 3000);
      },
      error: () => { this.errorMsg = 'Update failed.'; this.saving = false; }
    });
  }

  setTab(tab: DetailTab): void {
    this.activeTab = tab;
    if (tab === 'charts') {
      setTimeout(() => this.drawChart(), 50);
    }
  }

  openStore(): void {
    if (!this.game) return;
    window.open(`https://store.steampowered.com/app/${this.game.steam_appid}`, '_blank');
  }

  openSteamDb(): void {
    if (!this.game) return;
    window.open(`https://steamdb.info/app/${this.game.steam_appid}/`, '_blank');
  }

  copyAppId(): void {
    if (!this.game) return;
    const appid = String(this.game.steam_appid);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(appid).then(() => {
        this.successMsg = `Steam Game ID ${appid} copied.`;
        setTimeout(() => this.successMsg = '', 2500);
      }).catch(() => {
        this.successMsg = `Steam Game ID: ${appid}`;
        setTimeout(() => this.successMsg = '', 2500);
      });
      return;
    }
    this.successMsg = `Steam Game ID: ${appid}`;
    setTimeout(() => this.successMsg = '', 2500);
  }

  priceLabel(): string {
    if (!this.game) return '—';
    if (this.game.is_free) return 'Free';
    return `$${Number(this.game.price ?? 0).toFixed(2)}`;
  }

  storeHeadlinePrice(): string {
    const preferred = this.steamDetail?.pricing?.find(price => price.country_code === 'US')
      ?? this.steamDetail?.pricing?.[0];
    if (preferred?.final_formatted) {
      return preferred.final_formatted;
    }
    return this.priceLabel();
  }

  playersPerDollar(): string {
    if (!this.game) return '—';
    const price = Number(this.game.price ?? 0);
    if (this.game.is_free || price <= 0) return 'Free app';
    return Math.round(this.currentPlayers / price).toLocaleString();
  }

  averagePlayers(): number {
    if (!this.statsHistory.length) return this.currentPlayers;
    const total = this.statsHistory.reduce((sum, stat) => sum + stat.current_players, 0);
    return Math.round(total / this.statsHistory.length);
  }

  minSnapshot(): number {
    if (!this.statsHistory.length) return this.currentPlayers;
    return Math.min(...this.statsHistory.map(stat => stat.current_players));
  }

  maxSnapshot(): number {
    if (!this.statsHistory.length) return this.currentPlayers;
    return Math.max(...this.statsHistory.map(stat => stat.current_players));
  }

  latestSnapshotTime(): string {
    if (!this.statsHistory.length) return 'No snapshots';
    const latest = this.statsHistory[this.statsHistory.length - 1];
    return this.formatUtc(latest.timestamp);
  }

  trendLabel(): string {
    if (this.statsHistory.length < 2) return 'no trend yet';
    const first = this.statsHistory[0].current_players;
    const last = this.statsHistory[this.statsHistory.length - 1].current_players;
    const diff = last - first;
    const prefix = diff > 0 ? '+' : '';
    return `${prefix}${diff.toLocaleString()} since first snapshot`;
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

  steamPlatformsLabel(): string {
    if (!this.steamDetail?.platforms?.length) return 'Not tracked';
    return this.steamDetail.platforms.map(item => item.toUpperCase()).join(', ');
  }

  launchConfigLabel(launch: SteamLaunchConfig): string {
    const parts = [
      launch.description || 'Default launch',
      launch.oslist || '',
      launch.osarch || '',
      launch.betakey ? `beta:${launch.betakey}` : ''
    ].filter(Boolean);
    return parts.join(' · ') || '—';
  }

  latestBranchUpdate(): string {
    const branch = this.steamDetail?.branches?.[0];
    if (!branch) return 'No branch data';
    return this.formatUtc(branch.updated_at || branch.built_at);
  }

  formatUtc(value?: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
  }

  formatBytes(value?: number | null): string {
    const bytes = Number(value ?? 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return '—';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    let size = bytes;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    const precision = size >= 100 || unitIndex === 0 ? 0 : size >= 10 ? 1 : 2;
    return `${size.toFixed(precision)} ${units[unitIndex]}`;
  }

  rebuildActivityFeed(): void {
    const items: ActivityFeedItem[] = [];
    const pushItem = (item: Omit<ActivityFeedItem, 'timestamp' | 'utc'> & { value?: string | null }) => {
      const date = item.value ? new Date(item.value) : null;
      if (!date || Number.isNaN(date.getTime())) return;
      items.push({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        meta: item.meta,
        timestamp: date.getTime(),
        utc: this.formatUtc(item.value)
      });
    };

    if (this.game?.updated_at) {
      pushItem({
        id: `record-updated:${this.game.id}`,
        title: 'Local record updated',
        subtitle: 'Metadata or store fields changed in the tracked database',
        meta: 'metadata',
        value: this.game.updated_at
      });
    }

    if (this.game?.created_at) {
      pushItem({
        id: `record-created:${this.game.id}`,
        title: 'Local record created',
        subtitle: 'Game was added to the local catalog',
        meta: 'catalog',
        value: this.game.created_at
      });
    }

    (this.steamDetail?.news_feed || []).forEach(news => {
      pushItem({
        id: `news:${news.gid}`,
        title: news.title,
        subtitle: news.contents || news.feedlabel,
        meta: news.tags?.length ? news.tags.join(', ') : news.feedlabel,
        value: news.date
      });
    });

    (this.steamDetail?.branches || []).slice(0, 8).forEach(branch => {
      pushItem({
        id: `branch:${branch.name}`,
        title: `Branch ${branch.name} -> build ${branch.buildid || '—'}`,
        subtitle: branch.description || 'Steam branch metadata changed',
        meta: 'branch',
        value: branch.updated_at || branch.built_at
      });
    });

    this.statsHistory.slice(-10).forEach((stat, index) => {
      pushItem({
        id: `snapshot:${stat.timestamp}:${index}`,
        title: `${stat.current_players.toLocaleString()} players online`,
        subtitle: `Peak ${stat.peak_players.toLocaleString()} in tracked history`,
        meta: 'snapshot',
        value: stat.timestamp
      });
    });

    this.activityFeed = items
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 18);
  }

  onImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.style.display = 'none';
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
    const rootStyles = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string) => rootStyles.getPropertyValue(name).trim() || fallback;
    const chartBorder = token('--border', '#25354b');
    const chartMuted = token('--muted-text', '#697f99');
    const chartAccent = token('--accent', '#57b8c7');
    const chartFill = token('--accent-chart-fill', 'rgba(87, 184, 199, 0.24)');
    const chartFade = token('--accent-chart-fade', 'rgba(87, 184, 199, 0.03)');

    const values = this.statsHistory.map(s => s.current_players);
    const maxVal = Math.max(...values, 1);
    const minVal = Math.min(...values, 0);
    const range = maxVal - minVal || 1;
    const pad = { top: 16, right: 16, bottom: 28, left: 48 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = chartBorder;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (chartH / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
      const label = Math.round(maxVal - (range / 4) * i).toLocaleString();
      ctx.fillStyle = chartMuted;
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
    grad.addColorStop(0, chartFill);
    grad.addColorStop(1, chartFade);
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = chartAccent;
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
      ctx.fillStyle = chartAccent;
      ctx.fill();
    });

    // X-axis timestamps
    ctx.fillStyle = chartMuted;
    ctx.font = '8px Share Tech Mono, monospace';
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(values.length / 6));
    for (let i = 0; i < values.length; i += step) {
      const t = new Date(this.statsHistory[i].timestamp);
      const label = `${String(t.getUTCHours()).padStart(2,'0')}:${String(t.getUTCMinutes()).padStart(2,'0')}Z`;
      ctx.fillText(label, getX(i), H - pad.bottom + 12);
    }
  }
}
