import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { UserProfile, Game } from '../../interfaces/models';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="content">
        @if (loading) {
          <div class="loading">Loading profile...</div>
        }

        @if (!loading && profile) {
          <div class="page-head">
            <div>
              <div class="page-title">{{ profile.username }}</div>
              <div class="page-sub">{{ profile.role | uppercase }} PROFILE · JOINED {{ profile.created_at | date:'longDate' }}</div>
            </div>
          </div>

          <div class="profile-summary">
            <div class="profile-avatar">
              @if (profile.avatar_url) {
                <img [src]="profile.avatar_url" [alt]="profile.username" />
              } @else {
                <span>{{ profile.username.slice(0, 1).toUpperCase() }}</span>
              }
            </div>
              <div class="profile-copy">
                <div class="profile-name">{{ profile.username }}</div>
                <div class="profile-line">Email {{ profile.email || 'not set' }}</div>
                <div class="profile-line">Steam ID {{ profile.steam_id || 'not linked' }}</div>
              </div>
            <div class="profile-metrics">
              <div><span>Wishlist</span><strong>{{ profile.wishlist.length }}</strong></div>
              <div><span>Free games</span><strong>{{ wishlistFreeCount() }}</strong></div>
              <div><span>Live players</span><strong>{{ wishlistPlayers() | number }}</strong></div>
              <div><span>Value</span><strong>{{ wishlistValue() }}</strong></div>
            </div>
          </div>

          @if (errorMsg) { <div class="banner error">⚠ {{ errorMsg }}</div> }
          @if (successMsg) { <div class="banner success">✓ {{ successMsg }}</div> }

          <div class="layout">
            <div class="col-main">
              <div class="card">
                <div class="card-title">WISHLIST ({{ profile.wishlist.length }})</div>
                @if (profile.wishlist.length === 0) {
                  <div class="empty">No games in wishlist yet. Browse and add some!</div>
                }
                <div class="wishlist-grid">
                  @for (game of profile.wishlist; track game.id) {
                    <div class="wish-card">
                      @if (game.header_image) {
                        <img [src]="game.header_image" class="wish-img" />
                      }
                      <div class="wish-body">
                        <div class="wish-title">{{ game.title }}</div>
                        <div class="wish-price">{{ game.is_free ? 'FREE' : ('$' + game.price) }}</div>
                      </div>
                      <div class="wish-actions">
                        <button class="btn-sm" (click)="goToGame(game.id)">VIEW</button>
                        <button class="btn-sm danger" (click)="removeFromWishlist(game)">REMOVE</button>
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>

            <div class="col-side">
              <div class="card">
                <div class="card-title">ACCOUNT INFO</div>
                <div class="info-rows">
                  <div class="info-row">
                    <span class="info-key">USERNAME</span>
                    <span class="info-val">{{ profile.username }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-key">EMAIL</span>
                    <span class="info-val">{{ profile.email }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-key">ROLE</span>
                    <span class="info-val">{{ profile.role }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-key">WISHLIST</span>
                    <span class="info-val">{{ profile.wishlist.length }} games</span>
                  </div>
                  <div class="info-row">
                    <span class="info-key">STEAM ID</span>
                    <span class="info-val">{{ profile.steam_id || '—' }}</span>
                  </div>
                </div>
              </div>

              <div class="card">
                <div class="card-title">UPDATE PROFILE</div>
                <div class="f-group">
                  <label class="f-label">Username</label>
                  <input class="f-input" [(ngModel)]="editUsername" name="username" placeholder="your_username" />
                </div>
                <div class="f-group">
                  <label class="f-label">Email</label>
                  <input class="f-input" [(ngModel)]="editEmail" name="email" placeholder="you@example.com" />
                </div>
                <div class="f-group">
                  <label class="f-label">Steam ID (optional)</label>
                  <input class="f-input" [(ngModel)]="editSteamId" name="steamId" placeholder="76561198..." />
                </div>
                <div class="f-group">
                  <label class="f-label">Avatar URL</label>
                  <input class="f-input" [(ngModel)]="editAvatarUrl" name="avatarUrl" placeholder="https://..." />
                </div>
                <button class="btn-primary" (click)="saveProfile()" [disabled]="savingProfile">
                  {{ savingProfile ? 'SAVING...' : 'SAVE' }}
                </button>
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; background: var(--background); min-height: 100vh; font-family: 'Exo 2', sans-serif; color: var(--primary-text); }
    .content { max-width: 1200px; margin: 0 auto; padding: 28px 20px; }
    .loading { font-family: 'Share Tech Mono', monospace; font-size: 12px; color: var(--muted-text); padding: 40px; text-align: center; }
    .page-head { margin-bottom: 24px; }
    .page-title { font-size: 28px; }
    .profile-summary { display: grid; grid-template-columns: 74px minmax(160px, 1fr) minmax(360px, 1.4fr); gap: 14px; align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; margin-bottom: 16px; }
    .profile-avatar { width: 64px; height: 64px; border-radius: var(--radius); background: var(--surface-sunken); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; overflow: hidden; color: var(--accent-hover); font-family: 'Rajdhani', sans-serif; font-size: 28px; font-weight: 700; }
    .profile-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .profile-name { font-family: 'Rajdhani', sans-serif; color: var(--heading-text); font-size: 24px; font-weight: 700; }
    .profile-line { font-family: 'Share Tech Mono', monospace; color: var(--muted-text); font-size: 10px; }
    .profile-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .profile-metrics div { background: var(--surface-sunken); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px; min-width: 0; }
    .profile-metrics span { display: block; font-family: 'Share Tech Mono', monospace; color: var(--muted-text); font-size: 9px; margin-bottom: 5px; }
    .profile-metrics strong { display: block; color: var(--heading-text); font-family: 'Rajdhani', sans-serif; font-size: 20px; overflow-wrap: anywhere; }
    .layout { display: grid; grid-template-columns: 1fr 280px; gap: 16px; }
    @media (max-width: 900px) { .layout, .profile-summary { grid-template-columns: 1fr; } .profile-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 520px) { .profile-metrics { grid-template-columns: 1fr; } }
    .empty { font-family: 'Share Tech Mono', monospace; font-size: 11px; color: var(--muted-text); padding: 20px 0; text-align: center; }
    .wishlist-grid { display: flex; flex-direction: column; gap: 8px; }
    .wish-card { display: flex; align-items: center; gap: 10px; background: var(--surface-sunken); border: 1px solid var(--border); padding: 8px; transition: background 0.15s, border-color 0.15s; }
    .wish-card:hover { background: var(--surface-hover); border-color: var(--accent-border); }
    .wish-img { width: 80px; height: 45px; object-fit: cover; flex-shrink: 0; }
    .wish-body { flex: 1; min-width: 0; }
    .wish-title { font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 700; color: var(--heading-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .wish-price { font-family: 'Share Tech Mono', monospace; font-size: 11px; color: var(--accent); }
    .wish-actions { display: flex; gap: 6px; flex-shrink: 0; }
    .btn-sm { padding: 4px 10px; }
    .info-key { font-size: 9px; }
    .f-input { font-size: 12px; }
    .btn-primary { width: 100%; }
  `]
})
export class ProfileComponent implements OnInit {
  profile: UserProfile | null = null;
  loading = true;
  errorMsg = '';
  successMsg = '';
  editUsername = '';
  editEmail = '';
  editSteamId = '';
  editAvatarUrl = '';
  savingProfile = false;

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.api.getProfile().subscribe({
      next: (p) => {
        this.profile = p;
        this.editUsername = p.username;
        this.editEmail = p.email;
        this.editSteamId = p.steam_id;
        this.editAvatarUrl = p.avatar_url;
        this.loading = false;
      },
      error: () => { this.loading = false; this.errorMsg = 'Failed to load profile.'; }
    });
  }

  removeFromWishlist(game: Game): void {
    this.api.removeFromWishlist(game.id).subscribe({
      next: () => {
        if (this.profile) {
          this.profile.wishlist = this.profile.wishlist.filter(g => g.id !== game.id);
        }
        this.successMsg = `${game.title} removed.`;
        setTimeout(() => this.successMsg = '', 3000);
      },
      error: () => { this.errorMsg = 'Failed to remove from wishlist.'; }
    });
  }

  saveProfile(): void {
    this.savingProfile = true;
    this.errorMsg = '';
    this.api.updateProfile({
      username: this.editUsername.trim(),
      email: this.editEmail.trim(),
      steam_id: this.editSteamId,
      avatar_url: this.editAvatarUrl
    }).subscribe({
      next: (profile) => {
        this.profile = profile;
        this.editUsername = profile.username;
        this.editEmail = profile.email;
        this.successMsg = 'Profile updated!';
        this.savingProfile = false;
        setTimeout(() => this.successMsg = '', 3000);
      },
      error: (err) => {
        const errors = err.error ?? {};
        this.errorMsg = errors.username?.[0] ?? errors.email?.[0] ?? errors.detail ?? 'Failed to update profile.';
        this.savingProfile = false;
      }
    });
  }

  wishlistFreeCount(): number {
    return this.profile?.wishlist.filter(game => game.is_free).length ?? 0;
  }

  wishlistPlayers(): number {
    return this.profile?.wishlist.reduce((sum, game) => sum + Number(game.latest_players?.current ?? 0), 0) ?? 0;
  }

  wishlistValue(): string {
    const total = this.profile?.wishlist.reduce((sum, game) => {
      return game.is_free ? sum : sum + Number(game.price ?? 0);
    }, 0) ?? 0;
    return `$${total.toFixed(2)}`;
  }

  goToGame(id: number): void { this.router.navigate(['/games', id]); }
}
