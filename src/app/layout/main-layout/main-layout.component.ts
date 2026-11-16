import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';
import { ToastContainerComponent } from '../../shared/ui/toast.component';
import { CallOverlayComponent } from '../../shared/ui/call-overlay.component';
import { AuthService } from '../../core/services/auth.service';
import { LayoutService } from '../../core/services/layout.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    SidebarComponent,
    HeaderComponent,
    ToastContainerComponent,
    CallOverlayComponent
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
          <main class="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto min-w-0">
            <router-outlet></router-outlet>
          </main>
        </div>
      </div>

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
}
