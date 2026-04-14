import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="navbar">
      <div class="nav-brand" routerLink="/">
        <span class="logo-icon">⬡</span>
        <span class="logo-text">STEAM<span class="accent">DB</span> MINI</span>
      </div>

      <div class="nav-links">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}" class="nav-link">
          HOME
        </a>
        @if (isLoggedIn) {
          <a routerLink="/profile" routerLinkActive="active" class="nav-link">
            PROFILE
          </a>
        }
      </div>

      <div class="nav-auth">
        @if (isLoggedIn) {
          <span class="user-chip">
            <span class="user-dot"></span>{{ username }}
          </span>
          <button class="btn-logout" (click)="onLogout()">LOGOUT</button>
        } @else {
          <a routerLink="/login" class="btn-login">SIGN IN</a>
        }
      </div>
    </nav>
  `,
  styles: [`
    .navbar {
      display: flex;
      align-items: center;
      padding: 0 24px;
      height: 56px;
      background: #0d1220;
      border-bottom: 1px solid #1a2640;
      position: sticky;
      top: 0;
      z-index: 100;
      gap: 32px;
    }
    .nav-brand {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-family: 'Rajdhani', sans-serif;
      font-size: 18px;
      font-weight: 700;
      color: #fff;
      letter-spacing: 2px;
      text-decoration: none;
      white-space: nowrap;
    }
    .logo-icon { color: #00cfff; font-size: 20px; }
    .accent { color: #00cfff; }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 4px;
      flex: 1;
    }
    .nav-link {
      font-family: 'Rajdhani', sans-serif;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 1.5px;
      color: #6e80a0;
      text-decoration: none;
      padding: 0 14px;
      height: 56px;
      display: flex;
      align-items: center;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
    }
    .nav-link:hover { color: #bfcfe8; }
    .nav-link.active { color: #00cfff; border-bottom-color: #00cfff; }
    .nav-auth {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-left: auto;
    }
    .user-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: 'Share Tech Mono', monospace;
      font-size: 12px;
      color: #bfcfe8;
      background: #141c2e;
      border: 1px solid #1a2640;
      padding: 4px 12px;
    }
    .user-dot {
      width: 6px;
      height: 6px;
      background: #3ddc84;
      border-radius: 50%;
    }
    .btn-logout {
      background: transparent;
      border: 1px solid #1a2640;
      color: #6e80a0;
      font-family: 'Rajdhani', sans-serif;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 1px;
      padding: 5px 14px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-logout:hover { border-color: #ff5f2e; color: #ff5f2e; }
    .btn-login {
      background: #00cfff;
      color: #090d16;
      font-family: 'Rajdhani', sans-serif;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 1px;
      padding: 6px 18px;
      text-decoration: none;
      transition: opacity 0.2s;
    }
    .btn-login:hover { opacity: 0.85; }
  `]
})
export class NavbarComponent implements OnInit {
  isLoggedIn = false;
  username = '';

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.api.isLoggedIn$.subscribe(v => this.isLoggedIn = v);
    this.api.username$.subscribe(v => this.username = v);
  }

  onLogout(): void {
    this.api.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => { this.api.clearAuth(); this.router.navigate(['/login']); }
    });
  }
}
