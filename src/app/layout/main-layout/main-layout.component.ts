import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';
import { ToastContainerComponent } from '../../shared/ui/toast.component';
import { CallOverlayComponent } from '../../shared/ui/call-overlay.component';
import { AuthService } from '../../core/services/auth.service';
import { LayoutService } from '../../core/services/layout.service';
import { ChatService } from '../../core/services/chat.service';
import { IconComponent } from '../../shared/icons/icon.component';
import { UserRole } from '../../core/models/user.model';

export interface MobileNavTab {
  label: string;
  route: string;
  icon: string;
  exact?: boolean;
  badge?: () => number;
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    SidebarComponent,
    HeaderComponent,
    ToastContainerComponent,
    CallOverlayComponent,
    IconComponent
  ],
  template: `
    <div
      class="app-shell h-screen max-h-screen w-full overflow-hidden bg-slate-50 flex flex-col relative select-none"
      [style.--navbar-height]="layoutService.navbarHeight()"
      [style.--sidebar-width]="layoutService.sidebarWidth()"
    >
      <!-- Fixed Global Navbar across the entire top -->
      <app-header (toggleSidebar)="layoutService.toggleMobileSidebar()"></app-header>

      <!-- Desktop Fixed Sidebar (positioned below navbar: top = navbarHeight, left = 0, bottom = 0) -->
      <app-sidebar class="hidden lg:block"></app-sidebar>

      <!-- Mobile Drawer Sidebar Backdrop -->
      <div
        *ngIf="layoutService.mobileSidebarOpen()"
        class="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs lg:hidden transition-opacity"
        (click)="layoutService.closeMobileSidebar()"
      ></div>

      <!-- Mobile Slide-out Drawer -->
      <div
        class="fixed inset-y-0 left-0 z-50 transform lg:hidden transition-transform duration-300 ease-in-out"
        [ngClass]="layoutService.mobileSidebarOpen() ? 'translate-x-0' : '-translate-x-full'"
      >
        <app-sidebar [isMobile]="true" (closeSidebar)="layoutService.closeMobileSidebar()"></app-sidebar>
      </div>

      <!-- Main Area (Starts below navbar, sits beside sidebar, fills remaining width) -->
      <div class="main-area flex flex-col min-w-0 overflow-hidden">
        <!-- Scrollable Page Content Area -->
        <div class="main-content flex-1 overflow-y-auto overflow-x-hidden min-w-0 custom-scrollbar">
          <main class="p-3 sm:p-6 lg:p-8 pb-20 md:pb-6 lg:pb-8 max-w-7xl w-full mx-auto min-w-0">
            <router-outlet></router-outlet>
          </main>
        </div>
      </div>

      <!-- Sticky Bottom Navigation Bar (Mobile Only: md:hidden) -->
      <nav
        class="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg px-2 py-1 flex items-center justify-around h-16 select-none"
        aria-label="Mobile Navigation"
      >
        <a
          *ngFor="let tab of mobileNavTabs()"
          [routerLink]="tab.route"
          routerLinkActive="active-mobile-tab"
          [routerLinkActiveOptions]="{ exact: tab.exact ?? false }"
          class="flex flex-col items-center justify-center flex-1 py-1 px-1 text-slate-500 hover:text-slate-800 transition-colors relative min-w-0"
          [attr.aria-label]="tab.label"
        >
          <div class="relative flex items-center justify-center">
            <app-icon [name]="tab.icon" [size]="20"></app-icon>
            <span
              *ngIf="tab.badge && tab.badge() > 0"
              class="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white"
            >
              {{ tab.badge() > 99 ? '99+' : tab.badge() }}
            </span>
          </div>
          <span class="text-[10px] font-medium tracking-tight mt-1 truncate max-w-full leading-none">{{ tab.label }}</span>
          <span class="mobile-tab-indicator absolute bottom-0 w-8 h-0.5 bg-blue-600 rounded-full opacity-0 scale-75 transition-all"></span>
        </a>
      </nav>

      <!-- Global Floating Toast Container -->
      <app-toast-container></app-toast-container>

      <!-- Global Calling Overlay -->
      <app-call-overlay></app-call-overlay>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100vh;
      overflow: hidden;
    }
    .app-shell {
      --navbar-height: 72px;
      --sidebar-width: 76px;
    }
    .main-area {
      margin-top: var(--navbar-height, 72px);
      margin-left: 0;
      width: 100%;
      height: calc(100vh - var(--navbar-height, 72px));
      max-height: calc(100vh - var(--navbar-height, 72px));
      transition: margin-left 220ms cubic-bezier(0.4, 0, 0.2, 1), width 220ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    @media (min-width: 1024px) {
      .main-area {
        margin-left: var(--sidebar-width, 76px);
        width: calc(100% - var(--sidebar-width, 76px));
      }
    }
    @media (max-width: 767px) {
      :host {
        height: 100dvh;
      }
      .app-shell {
        --navbar-height: 64px !important;
        height: 100dvh;
        max-height: 100dvh;
      }
      .main-area {
        margin-top: 64px !important;
        height: calc(100dvh - 64px) !important;
        max-height: calc(100dvh - 64px) !important;
      }
    }
    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 9999px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }
  `]
})
export class MainLayoutComponent {
  authService = inject(AuthService);
  layoutService = inject(LayoutService);
  chatService = inject(ChatService);

  activeRole = computed<UserRole>(() => this.authService.activeRole());

  mobileNavTabs = computed<MobileNavTab[]>(() => {
    const role = this.activeRole();
    switch (role) {
      case 'student':
        return [
          { label: 'Home', route: '/student/dashboard', icon: 'layout-dashboard', exact: true },
          { label: 'Jobs', route: '/student/jobs', icon: 'briefcase' },
          { label: 'Applied', route: '/student/applications', icon: 'file-text' },
          { label: 'Chat', route: '/student/chat', icon: 'message-square', badge: () => this.chatService.totalUnreadCount() },
          { label: 'Profile', route: '/student/profile', icon: 'user' }
        ];
      case 'alumni':
        return [
          { label: 'Home', route: '/alumni/dashboard', icon: 'layout-dashboard', exact: true },
          { label: 'Mentees', route: '/alumni/mentees', icon: 'users' },
          { label: 'Chat', route: '/alumni/chat', icon: 'message-square', badge: () => this.chatService.totalUnreadCount() },
          { label: 'Drive', route: '/alumni/resources', icon: 'folder' },
          { label: 'Profile', route: '/alumni/profile', icon: 'user' }
        ];
      case 'recruiter':
        return [
          { label: 'Home', route: '/recruiter/dashboard', icon: 'layout-dashboard', exact: true },
          { label: 'Drives', route: '/recruiter/drives', icon: 'calendar' },
          { label: 'Jobs', route: '/recruiter/jobs', icon: 'briefcase' },
          { label: 'Applicants', route: '/recruiter/applicants', icon: 'users' },
          { label: 'Chat', route: '/recruiter/chat', icon: 'message-square', badge: () => this.chatService.totalUnreadCount() }
        ];
      case 'admin':
        return [
          { label: 'Home', route: '/admin/dashboard', icon: 'layout-dashboard', exact: true },
          { label: 'Analytics', route: '/admin/analytics', icon: 'bar-chart-2' },
          { label: 'Students', route: '/admin/students', icon: 'users' },
          { label: 'Jobs', route: '/admin/jobs', icon: 'briefcase' },
          { label: 'Command', route: '/admin/command-center', icon: 'activity' }
        ];
      default:
        return [];
    }
  });
}
