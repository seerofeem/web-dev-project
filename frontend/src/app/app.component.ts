import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar.component';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, CommonModule],
  template: `
    <app-navbar (toggleSidebar)="sidebarOpen = !sidebarOpen" />

    <div class="sidebar-overlay" [class.open]="sidebarOpen" (click)="sidebarOpen = false"></div>

    <aside class="sidebar" [class.open]="sidebarOpen">
      <div class="sidebar-head">
        <span class="sidebar-title">STEAMDB MINI</span>
        <button class="sidebar-close" (click)="sidebarOpen = false">✕</button>
      </div>
      <nav class="sidebar-nav">
        <button (click)="navigate('/', 'overview')">Overview</button>
        <button (click)="navigate('/', 'charts')">Charts</button>
        <button (click)="navigate('/', 'prices')">Prices</button>
        <button (click)="navigate('/', 'feed')">Feed</button>
        <button (click)="navigate('/profile', null)">Profile</button>
      </nav>
    </aside>

    <router-outlet />
  `,
  styles: [`
    .sidebar-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 300;
    }
    .sidebar-overlay.open { display: block; }

    .sidebar {
      background: var(--surface, #1b2228);
      border-right: 1px solid var(--border, #2c3843);
      display: flex;
      flex-direction: column;
      gap: 0;
      height: 100vh;
      left: 0;
      position: fixed;
      top: 0;
      transform: translateX(-100%);
      transition: transform 0.25s ease;
      width: 260px;
      z-index: 400;
    }
    .sidebar.open { transform: translateX(0); }

    .sidebar-head {
      align-items: center;
      border-bottom: 1px solid var(--border, #2c3843);
      display: flex;
      justify-content: space-between;
      padding: 16px 18px;
    }
    .sidebar-title {
      color: var(--heading-text, #fff);
      font-family: 'Rajdhani', sans-serif;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 2px;
    }
    .sidebar-close {
      background: transparent;
      border: none;
      color: var(--muted-text, #75838f);
      cursor: pointer;
      font-size: 16px;
      padding: 4px 8px;
    }
    .sidebar-close:hover { color: var(--heading-text, #fff); }

    .sidebar-nav {
      display: flex;
      flex-direction: column;
      padding: 12px 0;
    }
    .sidebar-nav button {
      background: transparent;
      border: none;
      border-left: 2px solid transparent;
      color: var(--secondary-text, #aab6c0);
      cursor: pointer;
      font-family: 'Rajdhani', sans-serif;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 1px;
      padding: 12px 20px;
      text-align: left;
      text-transform: uppercase;
      transition: all 0.15s;
    }
    .sidebar-nav button:hover {
      background: var(--accent-soft, rgba(102,192,244,0.08));
      border-left-color: var(--accent, #66c0f4);
      color: var(--heading-text, #fff);
    }
  `]
})
export class AppComponent {
  sidebarOpen = false;

  constructor(private router: Router) {}

  navigate(route: string, view: string | null): void {
    this.sidebarOpen = false;
    if (view) {
      this.router.navigate([route], { queryParams: { view } });
    } else {
      this.router.navigate([route]);
    }
  }
}
