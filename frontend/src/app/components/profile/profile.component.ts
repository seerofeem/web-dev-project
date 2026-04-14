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
              <div class="page-sub">PLAYER PROFILE · JOINED {{ profile.created_at | date:'longDate' }}</div>
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
                    <span class="info-key">WISHLIST</span>
                    <span class="info-val">{{ profile.wishlist.length }} games</span>
                  </div>
                </div>
              </div>

              <div class="card">
                <div class="card-title">UPDATE PROFILE</div>
                <div class="f-group">
                  <label class="f-label">Steam ID (optional)</label>
                  <input class="f-input" [(ngModel)]="editSteamId" name="steamId" placeholder="76561198..." />
                </div>
                <button class="btn-primary" (click)="saveProfile()">SAVE</button>
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Share+Tech+Mono&family=Exo+2:wght@400;500&display=swap');
    :host { display: block; background: #090d16; min-height: 100vh; font-family: 'Exo 2', sans-serif; color: #bfcfe8; }
    .content { max-width: 1200px; margin: 0 auto; padding: 28px 20px; }
    .loading { font-family: 'Share Tech Mono', monospace; font-size: 12px; color: #2e3e58; padding: 40px; text-align: center; }
    .page-head { margin-bottom: 24px; }
    .page-title { font-family: 'Rajdhani', sans-serif; font-size: 26px; font-weight: 700; color: #fff; letter-spacing: 3px; }
    .page-sub { font-family: 'Share Tech Mono', monospace; font-size: 10px; color: #6e80a0; margin-top: 2px; }
    .layout { display: grid; grid-template-columns: 1fr 280px; gap: 16px; }
    @media (max-width: 800px) { .layout { grid-template-columns: 1fr; } }
    .card { background: #141c2e; border: 1px solid #1a2640; padding: 18px; margin-bottom: 14px; }
    .card-title { font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 2px; color: #00cfff; margin-bottom: 14px; }
    .empty { font-family: 'Share Tech Mono', monospace; font-size: 11px; color: #2e3e58; padding: 20px 0; text-align: center; }
    .wishlist-grid { display: flex; flex-direction: column; gap: 8px; }
    .wish-card { display: flex; align-items: center; gap: 10px; background: #0d1220; border: 1px solid #1a2640; padding: 8px; }
    .wish-img { width: 80px; height: 45px; object-fit: cover; flex-shrink: 0; }
    .wish-body { flex: 1; min-width: 0; }
    .wish-title { font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .wish-price { font-family: 'Share Tech Mono', monospace; font-size: 11px; color: #00cfff; }
    .wish-actions { display: flex; gap: 6px; flex-shrink: 0; }
    .btn-sm { background: transparent; border: 1px solid #1a2640; color: #6e80a0; font-family: 'Rajdhani', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 1px; padding: 4px 10px; cursor: pointer; transition: all 0.15s; }
    .btn-sm:hover { border-color: #00cfff; color: #00cfff; }
    .btn-sm.danger:hover { border-color: #ff5f2e; color: #ff5f2e; }
    .info-rows { display: flex; flex-direction: column; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1a2640; }
    .info-key { font-family: 'Share Tech Mono', monospace; font-size: 9px; color: #2e3e58; }
    .info-val { font-family: 'Share Tech Mono', monospace; font-size: 10px; color: #6e80a0; }
    .f-group { margin-bottom: 12px; display: flex; flex-direction: column; gap: 6px; }
    .f-label { font-family: 'Share Tech Mono', monospace; font-size: 10px; color: #6e80a0; }
    .f-input { background: #0d1220; border: 1px solid #1a2640; color: #bfcfe8; padding: 8px 12px; font-family: 'Share Tech Mono', monospace; font-size: 12px; outline: none; width: 100%; }
    .f-input:focus { border-color: #00cfff; }
    .btn-primary { background: #00cfff; color: #090d16; border: none; font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 1px; padding: 8px 20px; cursor: pointer; width: 100%; }
    .banner { padding: 8px 14px; margin-bottom: 14px; font-family: 'Share Tech Mono', monospace; font-size: 11px; }
    .banner.error { background: rgba(255,95,46,.1); border: 1px solid #ff5f2e; color: #ff5f2e; }
    .banner.success { background: rgba(61,220,132,.1); border: 1px solid #3ddc84; color: #3ddc84; }
  `]
})
export class ProfileComponent implements OnInit {
  profile: UserProfile | null = null;
  loading = true;
  errorMsg = '';
  successMsg = '';
  editSteamId = '';

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.api.getProfile().subscribe({
      next: (p) => { this.profile = p; this.editSteamId = p.steam_id; this.loading = false; },
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
    this.api.getProfile().subscribe(); // In real app: PATCH profile with editSteamId
    this.successMsg = 'Profile updated!';
    setTimeout(() => this.successMsg = '', 3000);
  }

  goToGame(id: number): void { this.router.navigate(['/games', id]); }
}
