import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AdminOverview } from '../../interfaces/models';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page">
      <div class="content">
        <div class="page-head">
          <div>
            <div class="page-title">ADMIN CONTROL ROOM</div>
            <div class="page-sub">USER METRICS · SESSION OVERVIEW · PLATFORM SNAPSHOT</div>
          </div>
          <button class="btn-ghost" type="button" (click)="goHome()">BACK TO FRONT PAGE</button>
        </div>

        @if (loading) {
          <div class="card loading">Loading admin overview...</div>
        }

        @if (!loading && errorMsg) {
          <div class="banner error">⚠ {{ errorMsg }}</div>
        }

        @if (!loading && overview) {
          <div class="metric-grid">
            <div class="metric-card">
              <span>Users total</span>
              <strong>{{ overview.counts.users_total | number }}</strong>
            </div>
            <div class="metric-card">
              <span>Admins</span>
              <strong>{{ overview.counts.admins_total | number }}</strong>
            </div>
            <div class="metric-card">
              <span>Games tracked</span>
              <strong>{{ overview.counts.games_total | number }}</strong>
            </div>
            <div class="metric-card">
              <span>Wishlist items</span>
              <strong>{{ overview.counts.wishlist_items_total | number }}</strong>
            </div>
            <div class="metric-card">
              <span>Active sessions</span>
              <strong>{{ overview.counts.active_sessions_total | number }}</strong>
            </div>
          </div>

          <div class="card">
            <div class="card-head">
              <span class="card-title">RECENT USERS</span>
              <span class="card-sub">{{ overview.recent_users.length }} latest accounts</span>
            </div>

            @if (overview.recent_users.length === 0) {
              <div class="empty">No users found yet.</div>
            } @else {
              <div class="table-wrap">
                <table class="data-table recent-users-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Email</th>
                      <th>Steam ID</th>
                      <th>Joined</th>
                      <th>Last login</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (user of overview.recent_users; track user.id) {
                      <tr>
                        <td>
                          <div class="user-cell">
                            <div class="avatar">
                              @if (user.avatar_url) {
                                <img [src]="user.avatar_url" [alt]="user.username" />
                              } @else {
                                <span>{{ user.username.slice(0, 1).toUpperCase() }}</span>
                              }
                            </div>
                            <div>
                              <div class="user-name">{{ user.username }}</div>
                              <div class="user-id">#{{ user.id }}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span class="role-pill" [class.admin]="user.is_admin">
                            {{ user.role }}
                          </span>
                        </td>
                        <td>{{ user.email || '—' }}</td>
                        <td>{{ user.steam_id || '—' }}</td>
                        <td>{{ user.date_joined | date:'medium' }}</td>
                        <td>{{ user.last_login ? (user.last_login | date:'medium') : 'never' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: var(--background); color: var(--primary-text); font-family: 'Exo 2', sans-serif; }
    .content { max-width: 1200px; margin: 0 auto; padding: 28px 20px 40px; }
    .page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 20px; }
    .page-title { color: var(--heading-text); font-family: 'Rajdhani', sans-serif; font-size: 30px; font-weight: 700; }
    .page-sub { color: var(--muted-text); font-family: 'Share Tech Mono', monospace; font-size: 10px; letter-spacing: 1.4px; }
    .loading, .empty { color: var(--muted-text); font-family: 'Share Tech Mono', monospace; font-size: 12px; text-align: center; }
    .metric-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
    .metric-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; }
    .metric-card span { display: block; color: var(--muted-text); font-family: 'Share Tech Mono', monospace; font-size: 10px; margin-bottom: 6px; text-transform: uppercase; }
    .metric-card strong { color: var(--heading-text); font-family: 'Rajdhani', sans-serif; font-size: 28px; font-weight: 700; }
    .table-wrap { overflow-x: auto; }
    .recent-users-table th { position: static; top: auto; }
    .user-cell { display: flex; align-items: center; gap: 10px; }
    .avatar { width: 42px; height: 42px; border-radius: var(--radius); background: var(--surface-sunken); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; overflow: hidden; color: var(--accent-hover); font-family: 'Rajdhani', sans-serif; font-weight: 700; }
    .avatar img { width: 100%; height: 100%; object-fit: cover; }
    .user-name { color: var(--heading-text); font-weight: 700; }
    .user-id { color: var(--muted-text); font-family: 'Share Tech Mono', monospace; font-size: 10px; }
    .role-pill { display: inline-flex; align-items: center; justify-content: center; min-width: 72px; padding: 4px 8px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface-sunken); color: var(--secondary-text); font-family: 'Share Tech Mono', monospace; font-size: 10px; text-transform: uppercase; }
    .role-pill.admin { border-color: var(--warning-border); color: var(--warning); background: var(--warning-soft); }
    @media (max-width: 980px) { .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .page-head { flex-direction: column; } }
    @media (max-width: 560px) { .metric-grid { grid-template-columns: 1fr; } }
  `]
})
export class AdminComponent implements OnInit {
  overview: AdminOverview | null = null;
  loading = true;
  errorMsg = '';

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.api.getAdminOverview().subscribe({
      next: (overview) => {
        this.overview = overview;
        this.loading = false;
      },
      error: (err) => {
        this.errorMsg = err.error?.detail ?? 'Failed to load admin overview.';
        this.loading = false;
      }
    });
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
