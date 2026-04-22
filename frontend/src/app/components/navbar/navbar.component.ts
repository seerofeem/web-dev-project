import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { Game, SteamTopGame } from '../../interfaces/models';
import { ApiService } from '../../services/api.service';

type HomePanel = 'overview' | 'charts' | 'prices' | 'updates' | 'database';
type SearchResultKind = 'panel' | 'game' | 'steam' | 'route' | 'query';

interface ServiceLink {
  id: string;
  label: string;
  hint: string;
  panel?: HomePanel;
  route?: string;
}

interface ServiceCategory {
  id: string;
  code: string;
  title: string;
  note: string;
  panel?: HomePanel;
  route?: string;
}

interface SearchResult {
  id: string;
  kind: SearchResultKind;
  title: string;
  subtitle: string;
  meta: string;
  panel?: HomePanel;
  route?: string;
  gameId?: number;
  appid?: number;
  query?: string;
  score: number;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
  <header class="nav-shell">
    <div class="status-strip">
      <div class="status-cluster">
        <span class="status-tag">service</span>
        <span class="status-pill" [class.online]="topGames.length > 0">
          <span></span>{{ topGames.length ? 'live feed online' : 'waiting for charts' }}
        </span>
        <span class="status-item">local {{ games.length | number }}</span>
        <span class="status-item">players {{ totalTopPlayers | number }}</span>
        <span class="status-item">leader {{ leaderTitle() }}</span>
      </div>
      <div class="status-cluster right">
        <span class="status-item">route {{ routeLabel() }}</span>
        <span class="status-item">session {{ isLoggedIn ? username : 'guest' }}</span>
        <button class="status-shortcut" type="button" (click)="focusSearch()">/ instant search</button>
      </div>
    </div>

    <div class="toolbar-row">
      <button class="hamburger" type="button" (click)="toggleSidebar.emit()">☰</button>

      <a class="nav-brand" routerLink="/">
        <span class="brand-icon">⬡</span>
        <span class="brand-copy">
          <span class="brand-title">STEAM<span class="accent">DB</span> MINI</span>
          <span class="brand-sub">catalog desk · charts · pricing · metadata</span>
        </span>
      </a>

      <div class="nav-auth">
        @if (isLoggedIn) {
          <button class="session-card" type="button" (click)="goToProfile()">
            <span class="session-eyebrow">profile desk</span>
            <strong>{{ username }}</strong>
            <small>wishlist + account tools</small>
          </button>
          <button class="btn-logout" type="button" (click)="onLogout()">log out</button>
        } @else {
          <button class="session-card guest" type="button" (click)="goToLogin()">
            <span class="session-eyebrow">guest session</span>
            <strong>Sign in</strong>
            <small>import apps + sync profile</small>
          </button>
        }
      </div>

      <div class="search-shell" #searchShell [class.open]="searchOpen">
        <div class="search-box">
          <span class="search-prefix">cmd</span>
          <input
            #navSearch
            class="search-input"
            type="text"
            name="navSearch"
            autocomplete="off"
            spellcheck="false"
            placeholder="Search panel, local game, Steam appid..."
            [(ngModel)]="searchQuery"
            (focus)="openSearch()"
            (input)="onSearchInput()" />
          @if (searchQuery) {
            <button class="search-clear" type="button" (click)="clearSearch()">clear</button>
          } @else {
            <button class="search-slash" type="button" (click)="focusSearch()">/</button>
          }
        </div>

        @if (searchOpen) {
        <div class="search-overlay" (click)="closeSearch()"></div>
          <div class="search-popover">
            <div class="search-head">
              <div>
                <div class="search-title">Instant Search</div>
                <div class="search-sub">
                  {{ searchQuery.trim() ? 'Live results for navigation, local catalog, and Steam shortcuts.' : 'Type a title or app id, or jump straight into any section.' }}
                </div>
              </div>
              <div class="search-meta">{{ searchResults.length }} results</div>
            </div>
            <div class="search-results">
              @for (result of searchResults; track result.id; let i = $index) {
                <button
                  class="result-row"
                  type="button"
                  [class.active]="i === activeSearchIndex"
                  (mouseenter)="activeSearchIndex = i"
                  (mousedown)="activateSearchResult(result)">
                  <span class="result-kind">{{ result.kind }}</span>
                  <span class="result-copy">
                    <strong>{{ result.title }}</strong>
                    <small>{{ result.subtitle }}</small>
                  </span>
                  <span class="result-meta">{{ result.meta }}</span>
                </button>
              }
            </div>
            <div class="search-foot">
              <span>Enter to open</span>
              <span>Arrow keys to switch</span>
              <span>Esc to close</span>
            </div>
          </div>
        }
      </div>
    </div>
  </header>
`,
  styles: [`
    .nav-shell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 18px;
  backdrop-filter: blur(18px);
  background: linear-gradient(180deg, rgba(19,24,30,0.98), rgba(15,19,24,0.94));
  border-bottom: 1px solid rgba(64,81,95,0.78);
  position: static;
}

    .status-strip,
    .toolbar-row,
    .category-row,
    .status-cluster,
    .service-links,
    .search-box,
    .nav-auth {
      align-items: center;
      display: flex;
      gap: 10px;
    }
    .hamburger {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--secondary-text);
  cursor: pointer;
  font-size: 18px;
  padding: 8px 12px;
  transition: background 0.15s, color 0.15s;
}
.hamburger:hover { background: var(--accent-soft); color: var(--accent-hover); }
    .status-strip {
      justify-content: space-between;
      min-height: 24px;
    }

    .status-cluster {
      color: var(--secondary-text);
      flex-wrap: wrap;
      min-width: 0;
    }

    .status-cluster.right {
      justify-content: flex-end;
    }

    .status-tag,
    .status-item,
    .status-pill,
    .status-shortcut,
    .search-prefix,
    .search-slash,
    .search-clear,
    .search-sub,
    .search-meta,
    .result-kind,
    .result-meta,
    .result-copy small,
    .search-foot,
    .brand-sub,
    .session-eyebrow,
    .session-card small,
    .category-code,
    .category-stat {
      font-family: 'Share Tech Mono', monospace;
      font-size: 10px;
    }

    .status-tag,
    .status-item,
    .search-sub,
    .search-meta,
    .result-meta,
    .search-foot,
    .brand-sub,
    .session-eyebrow,
    .session-card small,
    .category-code,
    .category-stat {
      color: var(--muted-text);
    }

    .status-tag {
      color: var(--accent-hover);
      letter-spacing: 1.2px;
      text-transform: uppercase;
    }

    .status-item,
    .status-pill,
    .status-shortcut {
      background: rgba(16, 21, 27, 0.88);
      border: 1px solid rgba(64, 81, 95, 0.6);
      border-radius: 999px;
      padding: 4px 8px;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .status-pill {
      align-items: center;
      display: inline-flex;
      gap: 7px;
    }

    .status-pill span {
      background: var(--warning);
      border-radius: 50%;
      box-shadow: 0 0 0 4px rgba(216, 155, 67, 0.12);
      display: inline-block;
      height: 7px;
      width: 7px;
    }

    .status-pill.online {
      border-color: var(--success-border);
      color: var(--success);
    }

    .status-pill.online span {
      animation: statusPulse 1.5s ease-in-out infinite;
      background: var(--success);
      box-shadow: 0 0 0 4px var(--success-soft);
    }

    .status-shortcut {
      color: var(--accent-hover);
      cursor: pointer;
    }

    .status-shortcut:hover {
      background: var(--accent-soft);
      border-color: var(--accent-border);
    }

    .toolbar-row {
  align-items: center;
  display: flex;
  flex-wrap: nowrap;
  gap: 12px;
}
.nav-auth { flex: 0 0 auto; }
.search-shell { flex: 1 1 340px; min-width: 280px; position: relative; }

    .nav-brand {
      align-items: center;
      background:
        radial-gradient(circle at top left, rgba(102, 192, 244, 0.18), transparent 55%),
        linear-gradient(180deg, rgba(25, 31, 38, 0.96), rgba(15, 19, 24, 0.98));
      border: 1px solid rgba(64, 81, 95, 0.7);
      border-radius: 12px;
      display: flex;
      flex: 0 0 auto;
      gap: 12px;
      min-width: 0;
      padding: 12px 14px;
      transition: border-color 0.18s, transform 0.18s;
    }

    .nav-brand:hover {
      border-color: var(--accent-border);
      transform: translateY(-1px);
    }

    .brand-icon {
      color: var(--accent);
      font-size: 22px;
      line-height: 1;
    }

    .brand-copy {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .brand-title {
      color: var(--heading-text);
      font-family: 'Rajdhani', sans-serif;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 1.8px;
      line-height: 1;
      white-space: nowrap;
    }

    .accent {
      color: var(--accent);
    }

    .service-links {
      flex: 1 1 auto;
      flex-wrap: wrap;
      min-width: 0;
    }

    .service-link,
    .category-card,
    .session-card,
    .btn-logout,
    .result-row {
      transition: background 0.18s, border-color 0.18s, color 0.18s, transform 0.18s;
    }

    .service-link {
      align-items: flex-start;
      background: rgba(14, 18, 22, 0.78);
      border: 1px solid rgba(64, 81, 95, 0.56);
      border-radius: 10px;
      color: var(--secondary-text);
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 118px;
      padding: 10px 12px;
      text-align: left;
    }

    .service-link span,
    .search-title,
    .result-copy strong,
    .session-card strong,
    .category-copy strong {
      color: var(--heading-text);
      font-family: 'Rajdhani', sans-serif;
      font-weight: 700;
    }

    .service-link span {
      font-size: 15px;
      line-height: 1;
      letter-spacing: 0.8px;
    }

    .service-link small {
      color: var(--muted-text);
      font-family: 'Share Tech Mono', monospace;
      font-size: 9px;
      text-transform: uppercase;
    }

    .service-link:hover,
    .service-link.active {
      background: rgba(102, 192, 244, 0.1);
      border-color: var(--accent-border);
    }

    .service-link.active small {
      color: var(--accent-hover);
    }

    .search-shell {
  flex: 1 1 340px;
  min-width: 280px;
  position: static;
}
    .search-box {
      background: linear-gradient(180deg, rgba(18, 24, 30, 0.98), rgba(12, 17, 21, 0.98));
      border: 1px solid rgba(64, 81, 95, 0.7);
      border-radius: 12px;
      padding: 8px 10px;
    }

    .search-shell.open .search-box,
    .search-box:focus-within {
      border-color: var(--accent-border);
      box-shadow: 0 0 0 4px rgba(102, 192, 244, 0.12);
    }

    .search-prefix {
      color: var(--accent-hover);
      text-transform: uppercase;
    }

    .search-input {
      background: transparent;
      border: 0;
      color: var(--primary-text);
      flex: 1;
      font-family: 'Share Tech Mono', monospace;
      font-size: 12px;
      min-width: 0;
      outline: none;
      padding: 4px 0;
    }

    .search-input::placeholder {
      color: var(--muted-text);
    }

    .search-slash,
    .search-clear {
      background: rgba(21, 28, 35, 0.88);
      border: 1px solid rgba(64, 81, 95, 0.7);
      border-radius: 8px;
      color: var(--secondary-text);
      cursor: pointer;
      padding: 4px 8px;
      text-transform: uppercase;
    }

    .search-slash:hover,
    .search-clear:hover {
      border-color: var(--accent-border);
      color: var(--accent-hover);
    }

    .search-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.85);
  z-index: 9998;
}

.search-popover {
  position: fixed;
  top: 70px;
  left: 50%;
  transform: translateX(-50%);
  width: 680px;
  max-width: 95vw;
  background: linear-gradient(180deg, rgba(21,26,31,0.99), rgba(12,16,21,0.99));
  border: 1px solid rgba(64,81,95,0.76);
  border-radius: 14px;
  box-shadow: 0 22px 48px rgba(0,0,0,0.9);
  overflow: hidden;
  z-index: 9999;
}

    .search-head,
    .search-foot {
      align-items: center;
      display: flex;
      gap: 10px;
      justify-content: space-between;
      padding: 12px 14px;
    }

    .search-head {
      border-bottom: 1px solid rgba(64, 81, 95, 0.45);
    }

    .search-title {
      font-size: 18px;
      line-height: 1;
    }

    .search-sub {
      margin-top: 4px;
      max-width: 520px;
    }

    .search-results {
      display: flex;
      flex-direction: column;
      max-height: 360px;
      overflow-y: auto;
      padding: 8px;
    }
    .result-row {
      align-items: center;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 10px;
      color: inherit;
      display: grid;
      gap: 10px;
      grid-template-columns: 58px minmax(0, 1fr) auto;
      padding: 10px 12px;
      text-align: left;
      width: 100%;
    }

    .result-row:hover,
    .result-row.active {
      background: rgba(102, 192, 244, 0.08);
      border-color: rgba(102, 192, 244, 0.22);
    }

    .result-kind {
      color: var(--accent-hover);
      text-transform: uppercase;
    }

    .result-copy {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .result-copy strong {
      font-size: 16px;
      line-height: 1;
    }

    .result-copy small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .search-foot {
      border-top: 1px solid rgba(64, 81, 95, 0.45);
      color: var(--muted-text);
      flex-wrap: wrap;
      justify-content: flex-start;
      text-transform: uppercase;
    }

    .nav-auth {
      flex: 0 0 auto;
    }

    .session-card {
      align-items: flex-start;
      background: linear-gradient(180deg, rgba(24, 30, 37, 0.98), rgba(15, 19, 24, 0.98));
      border: 1px solid rgba(64, 81, 95, 0.72);
      border-radius: 12px;
      color: inherit;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 160px;
      padding: 10px 12px;
      text-align: left;
    }

    .session-card.guest {
      border-color: var(--accent-border);
    }

    .session-card strong {
      font-size: 16px;
      line-height: 1;
    }

    .session-card:hover {
      border-color: var(--accent-border);
      transform: translateY(-1px);
    }

    .btn-logout {
      background: transparent;
      border: 1px solid var(--error-border);
      border-radius: 10px;
      color: var(--error-hover);
      font-family: 'Rajdhani', sans-serif;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 1px;
      padding: 0 14px;
      text-transform: uppercase;
    }

    .btn-logout:hover {
      background: var(--error-soft);
      border-color: var(--error);
    }

    .category-row {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }

    .category-card {
      align-items: center;
      background: linear-gradient(180deg, rgba(18, 23, 29, 0.94), rgba(12, 16, 21, 0.98));
      border: 1px solid rgba(64, 81, 95, 0.58);
      border-radius: 12px;
      color: inherit;
      display: grid;
      gap: 10px;
      grid-template-columns: auto minmax(0, 1fr) auto;
      padding: 10px 12px;
      text-align: left;
      width: 100%;
    }

    .category-card:hover,
    .category-card.active {
      background: rgba(102, 192, 244, 0.08);
      border-color: var(--accent-border);
      transform: translateY(-1px);
    }

    .category-copy {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .category-copy strong {
      font-size: 16px;
      line-height: 1;
    }

    .category-copy small {
      color: var(--secondary-text);
      font-size: 12px;
      line-height: 1.3;
    }

    .category-stat {
      color: var(--accent-hover);
      text-transform: uppercase;
      white-space: nowrap;
    }

    @keyframes statusPulse {
      0%, 100% { opacity: 0.58; transform: scale(0.85); }
      50% { opacity: 1; transform: scale(1); }
    }

    @media (max-width: 1320px) {
      .toolbar-row {
        flex-wrap: wrap;
      }

      .search-shell { flex: 1 1 340px; min-width: 280px; position: static; }

      .category-row {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    @media (max-width: 920px) {
      .nav-shell {
        padding: 8px 12px 12px;
      }

      .status-strip {
        align-items: flex-start;
        flex-direction: column;
      }

      .service-links,
      .nav-auth {
        width: 100%;
      }

      .nav-auth {
        justify-content: flex-end;
      }

      .category-row {
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (max-width: 680px) {
      .brand-sub,
      .service-link small,
      .session-card small,
      .category-stat,
      .result-meta {
        display: none;
      }

      .service-links,
      .category-row {
        grid-template-columns: 1fr;
      }

      .category-row {
        display: flex;
        flex-direction: column;
      }

      .category-card {
        grid-template-columns: auto minmax(0, 1fr);
      }

      .nav-auth,
      .toolbar-row {
        flex-direction: column;
        align-items: stretch;
      }

      .btn-logout {
        min-height: 42px;
      }

      .result-row {
        grid-template-columns: 50px minmax(0, 1fr);
      }
    }
  `]
})
export class NavbarComponent implements OnInit, OnDestroy {
  @ViewChild('navSearch') navSearch?: ElementRef<HTMLInputElement>;
  @ViewChild('searchShell') searchShell?: ElementRef<HTMLElement>;
  @Output() toggleSidebar = new EventEmitter<void>();

  isLoggedIn = false;
  username = '';
  games: Game[] = [];
  topGames: SteamTopGame[] = [];
  searchQuery = '';
  searchOpen = false;
  searchResults: SearchResult[] = [];
  activeSearchIndex = 0;

  readonly primaryLinks: ServiceLink[] = [
    { id: 'overview', label: 'Overview', hint: 'home + scanner', panel: 'overview' },
    { id: 'charts', label: 'Charts', hint: 'top 20 + live', panel: 'charts' },
    { id: 'prices', label: 'Prices', hint: 'catalog math', panel: 'prices' },
    { id: 'updates', label: 'Updates', hint: 'history + patches', panel: 'updates' },
    { id: 'database', label: 'Database', hint: 'filters + explorer', panel: 'database' },
    { id: 'profile', label: 'Profile', hint: 'wishlist desk', route: '/profile' }
  ];

  readonly categories: ServiceCategory[] = [
    { id: 'pulse', code: '01', title: 'Player Pulse', note: 'Live concurrency, rank flow, broadcast view.', panel: 'charts' },
    { id: 'catalog', code: '02', title: 'Catalog Desk', note: 'Search local collection, genres, tags, app ids.', panel: 'database' },
    { id: 'pricing', code: '03', title: 'Pricing Board', note: 'Free vs paid mix, buckets, and catalog value.', panel: 'prices' },
    { id: 'updates', code: '04', title: 'Release Watch', note: 'Recent changes, update timestamps, patch feed.', panel: 'updates' },
    { id: 'account', code: '05', title: 'Account Desk', note: 'Profile tools, wishlist, auth session status.', route: '/profile' }
  ];

  private readonly subscriptions = new Subscription();
  private readonly steamNameCache: Record<number, string> = {
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
  private currentPath = '/';
  private currentPanel: HomePanel = 'overview';

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.subscriptions.add(this.api.isLoggedIn$.subscribe(v => this.isLoggedIn = v));
    this.subscriptions.add(this.api.username$.subscribe(v => this.username = v));
    this.subscriptions.add(
      this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(event => {
        this.syncRoute((event as NavigationEnd).urlAfterRedirects);
        this.searchOpen = false;
      })
    );

    this.syncRoute(this.router.url);
    this.loadSearchSources();
    this.buildSearchResults();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    if (event.defaultPrevented) return;

    if (event.key === '/' && !this.isTyping(event.target)) {
      event.preventDefault();
      this.focusSearch();
      return;
    }

    if (!this.searchOpen) return;

    if (event.key === 'Escape') {
      this.closeSearch();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.moveActiveResult(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.moveActiveResult(-1);
      return;
    }

    if (event.key === 'Enter') {
      const result = this.searchResults[this.activeSearchIndex];
      if (result) {
        event.preventDefault();
        this.activateSearchResult(result);
      }
    }
  }

  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (!target || !this.searchShell?.nativeElement) return;
    if (!this.searchShell.nativeElement.contains(target)) {
      this.searchOpen = false;
    }
  }

  get totalTopPlayers(): number {
    return this.topGames.reduce((sum, game) => sum + Number(game.concurrent_in_game ?? 0), 0);
  }

  get freeGamesCount(): number {
    return this.games.filter(game => game.is_free).length;
  }

  get paidGamesCount(): number {
    return this.games.filter(game => !game.is_free).length;
  }

  openLink(link: ServiceLink): void {
    if (link.route) {
      if (link.route === '/profile' && !this.isLoggedIn) {
        this.router.navigate(['/login']);
        return;
      }
      this.router.navigate([link.route]);
      return;
    }
    this.navigateHome(link.panel);
  }

  openCategory(category: ServiceCategory): void {
    if (category.route) {
      if (category.route === '/profile') {
        this.isLoggedIn ? this.goToProfile() : this.goToLogin();
        return;
      }
      this.router.navigate([category.route]);
      return;
    }
    this.navigateHome(category.panel);
  }

  isLinkActive(link: ServiceLink): boolean {
    if (link.route) {
      return link.route === '/profile'
        ? this.currentPath === '/profile'
        : this.currentPath === link.route;
    }
    return this.currentPath === '/' && this.currentPanel === (link.panel ?? 'overview');
  }

  isCategoryActive(category: ServiceCategory): boolean {
    if (category.route) {
      return category.route === '/profile'
        ? this.currentPath === '/profile' || this.currentPath === '/login'
        : this.currentPath === category.route;
    }
    return this.currentPath === '/' && this.currentPanel === category.panel;
  }

  categoryStat(category: ServiceCategory): string {
    switch (category.id) {
      case 'pulse':
        return `${this.topGames.length || 0} live`;
      case 'catalog':
        return `${this.games.length || 0} titles`;
      case 'pricing':
        return `${this.freeGamesCount}/${this.paidGamesCount}`;
      case 'updates':
        return `${Math.min(this.games.length, 12)} tracked`;
      case 'account':
        return this.isLoggedIn ? 'online' : 'guest';
      default:
        return 'ready';
    }
  }

  routeLabel(): string {
    if (this.currentPath === '/profile') return 'profile';
    if (this.currentPath === '/login') return 'login';
    if (this.currentPath.startsWith('/games/')) return 'game detail';
    return this.currentPanel;
  }

  leaderTitle(): string {
    const leader = this.topGames[0];
    if (!leader) return 'n/a';
    return this.gameTitleForApp(leader.appid);
  }

  focusSearch(): void {
    this.searchOpen = true;
    this.buildSearchResults();
    setTimeout(() => this.navSearch?.nativeElement.focus(), 0);
  }

  openSearch(): void {
    this.searchOpen = true;
    this.buildSearchResults();
  }

  closeSearch(): void {
    this.searchOpen = false;
    this.activeSearchIndex = 0;
    this.navSearch?.nativeElement.blur();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.activeSearchIndex = 0;
    this.buildSearchResults();
    this.navSearch?.nativeElement.focus();
  }

  onSearchInput(): void {
    this.searchOpen = true;
    this.activeSearchIndex = 0;
    this.buildSearchResults();
  }

  activateSearchResult(result: SearchResult): void {
    switch (result.kind) {
      case 'panel':
        this.navigateHome(result.panel);
        break;
      case 'route':
        if (result.route === '/profile') {
          this.goToProfile();
          break;
        }
        this.router.navigate([result.route ?? '/']);
        break;
      case 'game':
        this.router.navigate(['/games', result.gameId]);
        break;
      case 'steam':
        window.open(`https://store.steampowered.com/app/${result.appid}`, '_blank');
        break;
      case 'query':
        this.navigateHome('database', result.query);
        break;
    }

    this.searchQuery = '';
    this.searchOpen = false;
    this.activeSearchIndex = 0;
  }

  goToProfile(): void {
    this.router.navigate([this.isLoggedIn ? '/profile' : '/login']);
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  onLogout(): void {
    this.api.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => {
        this.api.clearAuth();
        this.router.navigate(['/login']);
      }
    });
  }

  private loadSearchSources(): void {
    this.api.getGames().subscribe({
      next: (res: { results?: Game[] } | Game[]) => {
        this.games = Array.isArray(res) ? res : (res.results ?? []);
        this.buildSearchResults();
      },
      error: () => {
        this.games = [];
        this.buildSearchResults();
      }
    });

    this.api.getTopGames().subscribe({
      next: (rows: SteamTopGame[]) => {
        this.topGames = [...rows].sort((a, b) => Number(b.concurrent_in_game ?? 0) - Number(a.concurrent_in_game ?? 0));
        this.buildSearchResults();
      },
      error: () => {
        this.topGames = [];
        this.buildSearchResults();
      }
    });
  }

  private buildSearchResults(): void {
    const query = this.searchQuery.trim().toLowerCase();
    const results = new Map<string, SearchResult>();
    const push = (result: SearchResult): void => {
      const existing = results.get(result.id);
      if (!existing || existing.score < result.score) {
        results.set(result.id, result);
      }
    };

    const navResults = this.primaryLinks.map(link => ({
      id: `nav:${link.id}`,
      kind: link.route ? 'route' as const : 'panel' as const,
      title: link.label,
      subtitle: link.hint,
      meta: link.route ? 'route' : (link.panel ?? 'overview'),
      route: link.route === '/profile' && !this.isLoggedIn ? '/login' : link.route,
      panel: link.panel,
      score: query ? this.matchScore(query, `${link.label} ${link.hint} ${link.panel ?? ''}`) : 76
    }));

    navResults
      .filter(result => result.score >= 0)
      .forEach(result => push(result));

    this.categories
      .map(category => ({
        id: `cat:${category.id}`,
        kind: category.route ? 'route' as const : 'panel' as const,
        title: category.title,
        subtitle: category.note,
        meta: category.code,
        route: category.route === '/profile' && !this.isLoggedIn ? '/login' : category.route,
        panel: category.panel,
        score: query ? this.matchScore(query, `${category.title} ${category.note} ${category.code}`) : 64
      }))
      .filter(result => result.score >= 0)
      .forEach(result => push(result));

    if (query) {
      push({
        id: `query:${query}`,
        kind: 'query',
        title: `Search database for "${this.searchQuery.trim()}"`,
        subtitle: 'Open the explorer with filters pre-filled from the header search.',
        meta: 'database',
        panel: 'database',
        query: this.searchQuery.trim(),
        score: 160
      });
    }

    const localGames = this.games
      .map(game => {
        const score = query
          ? this.matchScore(query, [
            game.title,
            String(game.steam_appid),
            game.genres.join(' '),
            game.tags.join(' '),
            (game.developers ?? []).map(dev => dev.name).join(' ')
          ].join(' '))
          : -1;

        return {
          id: `game:${game.id}`,
          kind: 'game' as const,
          title: game.title,
          subtitle: `Local title · App ${game.steam_appid}${game.is_free ? ' · Free' : ''}`,
          meta: game.latest_players?.current ? `${Number(game.latest_players.current).toLocaleString()} live` : 'local',
          gameId: game.id,
          score: score + (String(game.steam_appid) === query ? 65 : 0)
        };
      })
      .filter(result => result.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    localGames.forEach(result => push(result));

    const topMatches = this.topGames
      .map(game => {
        const title = this.gameTitleForApp(game.appid);
        const score = query
          ? this.matchScore(query, `${title} ${game.appid} steam top players peak`)
          : this.topGames[0]?.appid === game.appid ? 54 : 42;

        return {
          id: `steam:${game.appid}`,
          kind: 'steam' as const,
          title,
          subtitle: `Steam app ${game.appid} · peak ${Number(game.peak_in_game ?? 0).toLocaleString()}`,
          meta: `${Number(game.concurrent_in_game ?? 0).toLocaleString()} live`,
          appid: game.appid,
          score: score + (String(game.appid) === query ? 58 : 0)
        };
      })
      .filter(result => result.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, query ? 4 : 3);

    topMatches.forEach(result => push(result));

    if (/^\d+$/.test(query)) {
      const appid = Number(query);
      push({
        id: `appid:${appid}`,
        kind: 'steam',
        title: `Open Steam app ${appid}`,
        subtitle: 'Jump straight to the public Steam store page for this app id.',
        meta: 'store',
        appid,
        score: 140
      });
    }

    this.searchResults = Array.from(results.values())
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
      .slice(0, 9);

    if (!this.searchResults.length) {
      this.searchResults = [{
        id: 'fallback:database',
        kind: 'panel',
        title: 'Open database',
        subtitle: 'Browse the local catalog and start filtering from there.',
        meta: 'database',
        panel: 'database',
        score: 1
      }];
    }

    if (this.activeSearchIndex >= this.searchResults.length) {
      this.activeSearchIndex = 0;
    }
  }

  private moveActiveResult(direction: number): void {
    if (!this.searchResults.length) return;
    const next = this.activeSearchIndex + direction;
    if (next < 0) {
      this.activeSearchIndex = this.searchResults.length - 1;
      return;
    }
    this.activeSearchIndex = next % this.searchResults.length;
  }

  private navigateHome(panel: HomePanel = 'overview', query = ''): void {
    const queryParams: Record<string, string> = {};
    if (panel !== 'overview') {
      queryParams['panel'] = panel;
    }
    if (query.trim()) {
      queryParams['q'] = query.trim();
    }
    this.router.navigate(['/'], { queryParams });
  }

  private syncRoute(url: string): void {
    const tree = this.router.parseUrl(url);
    const primary = tree.root.children['primary'];
    const segments = primary?.segments.map(segment => segment.path) ?? [];
    this.currentPath = segments.length ? `/${segments.join('/')}` : '/';
    const panel = tree.queryParams['panel'];
    this.currentPanel = this.isHomePanel(panel) ? panel : 'overview';
  }

  private gameTitleForApp(appid: number): string {
    return this.games.find(game => game.steam_appid === appid)?.title
      ?? this.steamNameCache[appid]
      ?? `Steam app ${appid}`;
  }

  private matchScore(query: string, source: string): number {
    const haystack = source.toLowerCase();
    if (!query) return 0;
    if (haystack === query) return 180;
    if (haystack.startsWith(query)) return 120;
    if (haystack.includes(` ${query}`)) return 95;
    if (haystack.includes(query)) return 70;
    return -1;
  }

  private isHomePanel(value: string | null | undefined): value is HomePanel {
    return value === 'overview'
      || value === 'charts'
      || value === 'prices'
      || value === 'updates'
      || value === 'database';
  }

  private isTyping(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    if (!element) return false;
    const tag = element.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable;
  }
}
