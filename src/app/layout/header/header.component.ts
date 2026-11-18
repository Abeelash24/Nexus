import { Component, Output, EventEmitter, inject, signal, computed, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { ChatService } from '../../core/services/chat.service';
import { IconComponent } from '../../shared/icons/icon.component';
import { UserRole } from '../../core/models/user.model';

export interface SmartNavItem {
  label: string;
  route: string;
  icon: string;
  exact?: boolean;
  badge?: () => number;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, IconComponent],
  template: `
    <header
      class="navbar h-16 md:h-18 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-3 sm:px-5 lg:px-6 flex items-center justify-between select-none transition-shadow duration-200 w-full relative"
      [class.navbar-expanded]="isNavExpanded()"
      [class.navbar-collapsed]="!isNavExpanded()"
      [class.shadow-md]="isNavExpanded()"
      (mouseenter)="onMouseEnter()"
      (mouseleave)="onMouseLeave()"
      (focusin)="onFocusIn()"
      (focusout)="onFocusOut($event)"
    >
      <!-- Left: Mobile Menu Toggle & Logo & Workspace Badge -->
      <div class="flex items-center gap-2.5 sm:gap-3 shrink-0">
        <button
          type="button"
          (click)="toggleSidebar.emit()"
          class="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl lg:hidden transition-colors"
          aria-label="Toggle navigation menu"
          title="Toggle Navigation Menu"
        >
          <app-icon name="menu" [size]="20"></app-icon>
        </button>

        <!-- Brand Logo Lockup -->
        <a routerLink="/" class="flex items-center gap-2 text-slate-800 hover:text-blue-600 transition-colors group shrink-0" title="CareerNexus Home">
          <div class="w-8 h-8 flex items-center justify-center shrink-0">
            <img
              src="assets/images/logo.png"
              alt="CareerNexus Logo"
              class="w-full h-full object-contain transition-transform duration-200 group-hover:scale-105"
            />
          </div>
          <div class="hidden sm:block">
            <span class="text-sm font-extrabold tracking-tight text-slate-900 block leading-tight">Career<span class="text-blue-600">Nexus</span></span>
            <span class="text-[8.5px] font-semibold text-slate-400 tracking-wider uppercase block leading-none">Placement Portal</span>
          </div>
        </a>

        <!-- Workspace Badge (Desktop) -->
        <div class="hidden xl:flex items-center gap-1.5 text-xs font-semibold pl-1 border-l border-slate-200/80">
          <span class="text-slate-800 capitalize bg-slate-100/80 px-2.5 py-0.5 rounded-full border border-slate-200/60 flex items-center gap-1.5 text-[11px]">
            <span class="w-1.5 h-1.5 rounded-full" [ngClass]="{
              'bg-blue-600': activeRole() === 'student',
              'bg-purple-600': activeRole() === 'alumni',
              'bg-indigo-600': activeRole() === 'recruiter',
              'bg-emerald-600': activeRole() === 'admin'
            }"></span>
            {{ activeRole() }} Workspace
          </span>
        </div>
      </div>

      <!-- Center: Smart Collapsible Navigation Bar (Desktop & Tablet) -->
      <nav
        class="hidden md:flex items-center gap-1 lg:gap-1.5 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/60 shadow-2xs transition-all duration-200"
        aria-label="Primary Navigation"
      >
        <a
          *ngFor="let item of navItems()"
          [routerLink]="item.route"
          routerLinkActive="active-nav-link"
          [routerLinkActiveOptions]="{ exact: item.exact || false }"
          [title]="item.label"
          [attr.aria-label]="item.label"
          class="nav-item group flex items-center justify-center rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-white/80 transition-all duration-200 border border-transparent"
          [ngClass]="getActiveRoleClasses()"
        >
          <div class="relative flex items-center justify-center shrink-0">
            <app-icon [name]="item.icon" [size]="17"></app-icon>
            <span
              *ngIf="item.badge && item.badge() > 0"
              class="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-blue-600 text-white text-[8px] font-bold flex items-center justify-center ring-1 ring-white"
            >
              {{ item.badge() > 9 ? '9+' : item.badge() }}
            </span>
          </div>
          <span class="nav-label">{{ item.label }}</span>
        </a>
      </nav>

      <!-- Right: Role Portal Badge + Notifications + Profile -->
      <div class="flex items-center gap-2 sm:gap-2.5 shrink-0">
        <!-- Authorized Role Badge (Desktop) -->
        <div class="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 text-[11px] font-semibold text-slate-700 shadow-2xs">
          <span>{{ getRoleEmoji(activeRole()) }}</span>
          <span class="capitalize">{{ activeRole() }} Portal</span>
        </div>

        <!-- Notification Bell & Dropdown -->
        <div class="relative">
          <button
            type="button"
            (click)="toggleNotifications($event)"
            class="relative p-2 rounded-2xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
            title="Notifications"
            aria-label="View notifications"
          >
            <app-icon name="bell" [size]="19"></app-icon>
            <span
              *ngIf="notificationService.unreadCount() > 0"
              class="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9.5px] font-extrabold flex items-center justify-center ring-2 ring-white animate-pulse-subtle"
            >
              {{ notificationService.unreadCount() }}
            </span>
          </button>

          <!-- Notifications Dropdown Flyout -->
          <div
            *ngIf="showNotifications()"
            class="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 mt-2 sm:w-96 max-w-sm sm:max-w-none mx-auto sm:mx-0 bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden z-50 glass-dropdown animate-in fade-in zoom-in-95 duration-150"
            (click)="$event.stopPropagation()"
          >
            <div class="p-4 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <h4 class="text-sm font-bold text-slate-900">Notifications</h4>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  {{ notificationService.unreadCount() }} unread
                </span>
              </div>
              <button
                type="button"
                (click)="notificationService.markAllAsRead()"
                class="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                Mark all read
              </button>
            </div>

            <div class="max-h-80 overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
              <div
                *ngFor="let item of notificationService.notifications()"
                (click)="onNotificationClick(item)"
                class="p-3.5 hover:bg-slate-50/80 transition-colors cursor-pointer flex gap-3 items-start"
                [ngClass]="{ 'bg-blue-50/30': !item.isRead }"
              >
                <div class="mt-1 shrink-0">
                  <span
                    class="w-2 h-2 rounded-full inline-block"
                    [ngClass]="item.isRead ? 'bg-slate-300' : 'bg-blue-600'"
                  ></span>
                </div>
                <div class="flex-1 min-w-0">
                  <h5 class="text-xs font-bold text-slate-900">{{ item.title }}</h5>
                  <p class="text-xs text-slate-600 mt-0.5 leading-relaxed">{{ item.message }}</p>
                  <span class="text-[10px] text-slate-400 mt-1 block font-mono">Just now</span>
                </div>
              </div>

              <div *ngIf="notificationService.notifications().length === 0" class="p-8 text-center text-xs text-slate-400">
                No notifications right now.
              </div>
            </div>
          </div>
        </div>

        <!-- User Profile Avatar & Dropdown -->
        <div class="relative pl-1 border-l border-slate-200">
          <button
            type="button"
            (click)="toggleProfileMenu($event)"
            class="flex items-center gap-1.5 p-1 rounded-2xl hover:bg-slate-100 transition-colors"
            title="User Profile Menu"
            aria-label="User Profile Menu"
          >
            <img
              *ngIf="authService.currentUser()?.avatarUrl"
              [src]="authService.currentUser()?.avatarUrl"
              [alt]="authService.currentUser()?.fullName"
              class="w-8.5 h-8.5 rounded-full object-cover border border-slate-200 ring-2 ring-blue-100 shadow-2xs"
            />
            <div
              *ngIf="!authService.currentUser()?.avatarUrl"
              class="w-8.5 h-8.5 rounded-full bg-linear-to-br from-blue-600 to-indigo-700 text-white font-bold text-xs flex items-center justify-center border border-slate-200 ring-2 ring-blue-100 shadow-2xs"
            >
              {{ authService.currentUser()?.fullName?.charAt(0) || 'U' }}
            </div>
            <app-icon name="chevron-down" [size]="13" customClass="text-slate-400 hidden sm:block"></app-icon>
          </button>

          <!-- User Menu Flyout -->
          <div
            *ngIf="showProfileMenu()"
            class="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 glass-dropdown animate-in fade-in zoom-in-95 duration-150 p-2 space-y-1 text-xs"
            (click)="$event.stopPropagation()"
          >
            <div class="px-3 py-2 border-b border-slate-100 mb-1">
              <p class="font-bold text-slate-900 truncate">{{ authService.currentUser()?.fullName }}</p>
              <p class="text-slate-500 text-[11px] truncate">{{ authService.currentUser()?.email }}</p>
            </div>

            <a
              *ngIf="authService.isStudent()"
              routerLink="/student/profile"
              (click)="closeDropdowns()"
              class="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 font-medium transition-colors"
            >
              <app-icon name="user" [size]="15" customClass="text-slate-500"></app-icon>
              <span>Placement Profile</span>
            </a>

            <a
              *ngIf="authService.isAdmin()"
              routerLink="/admin/command-center"
              (click)="closeDropdowns()"
              class="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 font-medium transition-colors"
            >
              <app-icon name="grid" [size]="15" customClass="text-slate-500"></app-icon>
              <span>Command Center</span>
            </a>

            <button
              type="button"
              (click)="authService.logout(); closeDropdowns()"
              class="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-semibold transition-colors text-left"
            >
              <app-icon name="log-out" [size]="15" customClass="text-rose-500"></app-icon>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  `,
  styles: [`
    :host {
      display: block;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 64px;
      z-index: 50;
      width: 100%;
    }
    @media (min-width: 768px) {
      :host {
        height: 72px;
      }
    }

    /* Invisible hover trigger zone immediately below the navbar */
    header::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: -10px;
      height: 10px;
      pointer-events: auto;
      background: transparent;
    }

    /* Smooth CSS label transitions */
    .nav-label {
      display: inline-block;
      white-space: nowrap;
      overflow: hidden;
      opacity: 0;
      max-width: 0;
      margin-left: 0;
      pointer-events: none;
      transition:
        max-width 220ms cubic-bezier(0.4, 0, 0.2, 1),
        opacity 180ms cubic-bezier(0.4, 0, 0.2, 1),
        margin-left 200ms ease;
    }

    /* Expanded state: smoothly reveal text labels */
    .navbar-expanded .nav-label {
      opacity: 1;
      max-width: 160px;
      margin-left: 0.5rem;
      pointer-events: auto;
    }

    /* Active navigation route highlighting in both states */
    .active-nav-link {
      box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    }

    /* Touch/mobile fallback */
    @media (hover: none) or (pointer: coarse) {
      .nav-label {
        opacity: 1;
        max-width: 160px;
        margin-left: 0.5rem;
        pointer-events: auto;
      }
    }
  `]
})
export class HeaderComponent {
  authService = inject(AuthService);
  notificationService = inject(NotificationService);
  chatService = inject(ChatService);
  router = inject(Router);
  private elementRef = inject(ElementRef);

  @Output() toggleSidebar = new EventEmitter<void>();

  isNavExpanded = signal(false);
  showNotifications = signal(false);
  showProfileMenu = signal(false);

  private collapseTimeout: any = null;
  private isMouseOver = false;

  activeRole = computed<UserRole>(() => this.authService.activeRole());

  // Role-specific navigation items
  navItems = computed<SmartNavItem[]>(() => {
    const role = this.activeRole();
    switch (role) {
      case 'student':
        return [
          { label: 'Dashboard', route: '/student/dashboard', icon: 'layout-dashboard', exact: true },
          { label: 'Jobs', route: '/student/jobs', icon: 'briefcase' },
          { label: 'Applications', route: '/student/applications', icon: 'check-circle' },
          { label: 'Resources', route: '/student/resources', icon: 'folder' },
          { label: 'Mentorship', route: '/student/alumni', icon: 'users' },
          { label: 'Career Hub', route: '/student/career', icon: 'sparkles' },
          { label: 'Chat', route: '/student/messages', icon: 'message-square', badge: () => this.chatService.totalUnreadCount() },
          { label: 'Profile', route: '/student/profile', icon: 'user' },
        ];
      case 'recruiter':
        return [
          { label: 'Dashboard', route: '/recruiter/dashboard', icon: 'layout-dashboard', exact: true },
          { label: 'Jobs', route: '/recruiter/jobs', icon: 'briefcase' },
          { label: 'Applicants', route: '/recruiter/applicants', icon: 'users' },
          { label: 'Calendar', route: '/recruiter/calendar', icon: 'calendar' },
          { label: 'Chat', route: '/recruiter/messages', icon: 'message-square', badge: () => this.chatService.totalUnreadCount() },
        ];
      case 'alumni':
        return [
          { label: 'Dashboard', route: '/alumni/dashboard', icon: 'layout-dashboard', exact: true },
          { label: 'Profile', route: '/alumni/profile', icon: 'user' },
          { label: 'Mentees', route: '/alumni/students', icon: 'users' },
          { label: 'Resources', route: '/alumni/resources', icon: 'folder' },
          { label: 'Chat', route: '/alumni/messages', icon: 'message-square', badge: () => this.chatService.totalUnreadCount() },
        ];
      case 'admin':
        return [
          { label: 'Command Center', route: '/admin/command-center', icon: 'grid' },
          { label: 'Analytics', route: '/admin/analytics', icon: 'bar-chart-2' },
          { label: 'Dashboard', route: '/admin/dashboard', icon: 'layout-dashboard', exact: true },
          { label: 'Users', route: '/admin/users', icon: 'users' },
          { label: 'Pipeline', route: '/admin/applications', icon: 'check-circle' },
          { label: 'Jobs', route: '/admin/jobs', icon: 'briefcase' },
          { label: 'Resources', route: '/admin/resources', icon: 'folder' },
          { label: 'Chat', route: '/admin/messages', icon: 'message-square', badge: () => this.chatService.totalUnreadCount() },
        ];
      default:
        return [];
    }
  });

  onMouseEnter() {
    this.isMouseOver = true;
    if (this.collapseTimeout) {
      clearTimeout(this.collapseTimeout);
      this.collapseTimeout = null;
    }
    this.isNavExpanded.set(true);
  }

  onMouseLeave() {
    this.isMouseOver = false;
    // Do not collapse if a dropdown interaction is active
    if (this.showNotifications() || this.showProfileMenu()) {
      return;
    }
    this.scheduleDelayedCollapse();
  }

  onFocusIn() {
    if (this.collapseTimeout) {
      clearTimeout(this.collapseTimeout);
      this.collapseTimeout = null;
    }
    this.isNavExpanded.set(true);
  }

  onFocusOut(event: FocusEvent) {
    const headerEl = this.elementRef.nativeElement as HTMLElement;
    const relatedTarget = event.relatedTarget as HTMLElement;
    if (headerEl && relatedTarget && headerEl.contains(relatedTarget)) {
      return;
    }
    if (!this.isMouseOver && !this.showNotifications() && !this.showProfileMenu()) {
      this.scheduleDelayedCollapse();
    }
  }

  private scheduleDelayedCollapse() {
    if (this.collapseTimeout) {
      clearTimeout(this.collapseTimeout);
    }
    // 250ms delay to prevent flicker when mouse leaves briefly
    this.collapseTimeout = setTimeout(() => {
      if (!this.isMouseOver && !this.showNotifications() && !this.showProfileMenu()) {
        this.isNavExpanded.set(false);
      }
      this.collapseTimeout = null;
    }, 250);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const headerEl = this.elementRef.nativeElement as HTMLElement;
    if (!headerEl.contains(target)) {
      if (this.showNotifications() || this.showProfileMenu()) {
        this.closeDropdowns();
      }
    }
  }

  toggleNotifications(event?: MouseEvent) {
    if (event) event.stopPropagation();
    this.showNotifications.update(v => !v);
    if (this.showNotifications()) {
      this.showProfileMenu.set(false);
      this.isNavExpanded.set(true);
    } else if (!this.isMouseOver) {
      this.scheduleDelayedCollapse();
    }
  }

  toggleProfileMenu(event?: MouseEvent) {
    if (event) event.stopPropagation();
    this.showProfileMenu.update(v => !v);
    if (this.showProfileMenu()) {
      this.showNotifications.set(false);
      this.isNavExpanded.set(true);
    } else if (!this.isMouseOver) {
      this.scheduleDelayedCollapse();
    }
  }

  closeDropdowns() {
    this.showNotifications.set(false);
    this.showProfileMenu.set(false);
    if (!this.isMouseOver) {
      this.scheduleDelayedCollapse();
    }
  }

  onNotificationClick(item: any) {
    this.notificationService.markAsRead(item.id);
    this.closeDropdowns();
    if (item.link) {
      this.router.navigateByUrl(item.link);
    }
  }

  getActiveRoleClasses(): string {
    const role = this.activeRole();
    switch (role) {
      case 'student':
        return '[&.active-nav-link]:bg-blue-50 [&.active-nav-link]:text-blue-700 [&.active-nav-link]:border-blue-200/80 [&.active-nav-link]:font-semibold [&.active-nav-link]:shadow-2xs';
      case 'alumni':
        return '[&.active-nav-link]:bg-purple-50 [&.active-nav-link]:text-purple-700 [&.active-nav-link]:border-purple-200/80 [&.active-nav-link]:font-semibold [&.active-nav-link]:shadow-2xs';
      case 'recruiter':
        return '[&.active-nav-link]:bg-indigo-50 [&.active-nav-link]:text-indigo-700 [&.active-nav-link]:border-indigo-200/80 [&.active-nav-link]:font-semibold [&.active-nav-link]:shadow-2xs';
      case 'admin':
        return '[&.active-nav-link]:bg-emerald-50 [&.active-nav-link]:text-emerald-700 [&.active-nav-link]:border-emerald-200/80 [&.active-nav-link]:font-semibold [&.active-nav-link]:shadow-2xs';
      default:
        return '[&.active-nav-link]:bg-slate-100 [&.active-nav-link]:text-slate-900 [&.active-nav-link]:border-slate-300 [&.active-nav-link]:font-semibold';
    }
  }

  getRoleEmoji(role: string): string {
    switch (role) {
      case 'student': return '🎓';
      case 'alumni': return '💼';
      case 'recruiter': return '🏢';
      case 'admin': return '⚡';
      default: return '👤';
    }
  }
}
