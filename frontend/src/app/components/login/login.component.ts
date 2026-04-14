import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="login-page">
      <div class="login-card">
        <div class="card-logo">
          <span class="logo-icon">⬡</span>
          <span class="logo-text">STEAM<span class="accent">DB</span> MINI</span>
        </div>
        <div class="card-subtitle">REAL-TIME GAME STATISTICS PLATFORM</div>

        <!-- Mode tabs (click event #1) -->
        <div class="mode-tabs">
          <button class="mode-tab" [class.active]="mode === 'login'" (click)="setMode('login')">SIGN IN</button>
          <button class="mode-tab" [class.active]="mode === 'register'" (click)="setMode('register')">REGISTER</button>
        </div>

        @if (errorMsg) {
          <div class="banner error">⚠ {{ errorMsg }}</div>
        }
        @if (successMsg) {
          <div class="banner success">✓ {{ successMsg }}</div>
        }

        <!-- Login form — 2 ngModel bindings -->
        @if (mode === 'login') {
          <div class="form">
            <div class="f-group">
              <label class="f-label">Username</label>
              <input class="f-input" type="text" placeholder="your_username"
                [(ngModel)]="loginData.username" name="username"
                (keydown.enter)="onLogin()" />
            </div>
            <div class="f-group">
              <label class="f-label">Password</label>
              <input class="f-input" type="password" placeholder="••••••••"
                [(ngModel)]="loginData.password" name="password"
                (keydown.enter)="onLogin()" />
            </div>
            <!-- click event #2 -->
            <button class="btn-submit" (click)="onLogin()" [disabled]="loading">
              {{ loading ? 'SIGNING IN...' : 'SIGN IN →' }}
            </button>
          </div>
        }

        <!-- Register form — 4 ngModel bindings -->
        @if (mode === 'register') {
          <div class="form">
            <div class="f-group">
              <label class="f-label">Username</label>
              <input class="f-input" type="text" placeholder="choose_username"
                [(ngModel)]="registerData.username" name="reg_username" />
            </div>
            <div class="f-group">
              <label class="f-label">Email</label>
              <input class="f-input" type="email" placeholder="you@example.com"
                [(ngModel)]="registerData.email" name="reg_email" />
            </div>
            <div class="f-group">
              <label class="f-label">Password</label>
              <input class="f-input" type="password" placeholder="min. 6 characters"
                [(ngModel)]="registerData.password" name="reg_pass" />
            </div>
            <div class="f-group">
              <label class="f-label">Confirm Password</label>
              <input class="f-input" type="password" placeholder="repeat password"
                [(ngModel)]="registerData.password2" name="reg_pass2" />
            </div>
            <!-- click event #3 -->
            <button class="btn-submit" (click)="onRegister()" [disabled]="loading">
              {{ loading ? 'CREATING...' : 'CREATE ACCOUNT →' }}
            </button>
          </div>
        }

        <!-- click event #4: back to home -->
        <div class="back-link" (click)="goHome()">← BACK TO GAME LIST</div>

        <div class="hints">
          <div class="hint-item">◆ Token-based authentication (DRF)</div>
          <div class="hint-item">◆ Token stored securely in localStorage</div>
          <div class="hint-item">◆ Auto-attach via HTTP Interceptor</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Share+Tech+Mono&family=Exo+2:wght@300;400;500;600&display=swap');
    :host { display: block; background: #090d16; min-height: 100vh; font-family: 'Exo 2', sans-serif; }
    .login-page { display: flex; align-items: center; justify-content: center; min-height: calc(100vh - 56px); padding: 40px 20px; }
    .login-card { background: #141c2e; border: 1px solid #1a2640; padding: 36px 32px; width: 100%; max-width: 420px; }
    .card-logo { display: flex; align-items: center; gap: 8px; font-family: 'Rajdhani', sans-serif; font-size: 22px; font-weight: 700; color: #fff; letter-spacing: 2px; margin-bottom: 4px; }
    .logo-icon { color: #00cfff; font-size: 22px; }
    .accent { color: #00cfff; }
    .card-subtitle { font-family: 'Share Tech Mono', monospace; font-size: 9px; color: #2e3e58; letter-spacing: 2px; margin-bottom: 24px; }

    .mode-tabs { display: flex; margin-bottom: 20px; border: 1px solid #1a2640; }
    .mode-tab { flex: 1; background: transparent; border: none; color: #6e80a0; font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 1.5px; padding: 10px; cursor: pointer; transition: all 0.15s; }
    .mode-tab.active { background: rgba(0,207,255,.08); color: #00cfff; }
    .mode-tab:hover:not(.active) { color: #bfcfe8; }

    .banner { padding: 8px 12px; margin-bottom: 14px; font-family: 'Share Tech Mono', monospace; font-size: 11px; }
    .banner.error { background: rgba(255,95,46,.1); border: 1px solid #ff5f2e; color: #ff5f2e; }
    .banner.success { background: rgba(61,220,132,.1); border: 1px solid #3ddc84; color: #3ddc84; }

    .form { display: flex; flex-direction: column; gap: 0; }
    .f-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
    .f-label { font-family: 'Share Tech Mono', monospace; font-size: 10px; color: #6e80a0; letter-spacing: 1px; }
    .f-input { background: #0d1220; border: 1px solid #1a2640; color: #bfcfe8; padding: 10px 14px; font-family: 'Share Tech Mono', monospace; font-size: 13px; outline: none; transition: border 0.2s; }
    .f-input:focus { border-color: #00cfff; }

    .btn-submit { background: #00cfff; color: #090d16; border: none; font-family: 'Rajdhani', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 1.5px; padding: 12px; cursor: pointer; width: 100%; margin-top: 4px; transition: opacity 0.2s; }
    .btn-submit:hover { opacity: 0.85; }
    .btn-submit:disabled { opacity: 0.4; cursor: not-allowed; }

    .back-link { font-family: 'Share Tech Mono', monospace; font-size: 10px; color: #2e3e58; text-align: center; margin-top: 16px; cursor: pointer; transition: color 0.15s; }
    .back-link:hover { color: #6e80a0; }

    .hints { margin-top: 20px; padding-top: 16px; border-top: 1px solid #1a2640; display: flex; flex-direction: column; gap: 4px; }
    .hint-item { font-family: 'Share Tech Mono', monospace; font-size: 9px; color: #1a2640; }
  `]
})
export class LoginComponent {
  mode: 'login' | 'register' = 'login';
  loading = false;
  errorMsg = '';
  successMsg = '';

  loginData = { username: '', password: '' };
  registerData = { username: '', email: '', password: '', password2: '' };

  constructor(private api: ApiService, private router: Router) {}

  // click event #1
  setMode(mode: 'login' | 'register'): void {
    this.mode = mode;
    this.errorMsg = '';
    this.successMsg = '';
  }

  // click event #2
  onLogin(): void {
    if (!this.loginData.username || !this.loginData.password) {
      this.errorMsg = 'Please fill in all fields.';
      return;
    }
    this.loading = true;
    this.errorMsg = '';
    this.api.login(this.loginData).subscribe({
      next: () => { this.loading = false; this.router.navigate(['/']); },
      error: (err) => {
        this.errorMsg = err.error?.detail ?? 'Login failed. Check your credentials.';
        this.loading = false;
      }
    });
  }

  // click event #3
  onRegister(): void {
    if (this.registerData.password !== this.registerData.password2) {
      this.errorMsg = 'Passwords do not match.';
      return;
    }
    this.loading = true;
    this.errorMsg = '';
    this.api.register(this.registerData).subscribe({
      next: () => { this.loading = false; this.router.navigate(['/']); },
      error: (err) => {
        const errors = err.error;
        this.errorMsg = errors?.username?.[0] ?? errors?.password?.[0] ?? errors?.detail ?? 'Registration failed.';
        this.loading = false;
      }
    });
  }

  // click event #4
  goHome(): void { this.router.navigate(['/']); }
}
