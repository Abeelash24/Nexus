import { Component, Input, Output, EventEmitter, inject, computed, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';
import { NotificationService } from '../../core/services/notification.service';
import { LayoutService } from '../../core/services/layout.service';
import { IconComponent } from '../../shared/icons/icon.component';
import { UserRole } from '../../core/models/user.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, IconComponent],
  template: `
    <aside
      class="sidebar bg-white border-r border-slate-200/80 flex flex-col shrink-0 select-none transition-[width] duration-220 ease-[cubic-bezier(0.4,0,0.2,1)]"
      [ngClass]="{
        'fixed left-0 bottom-0 z-40': !isMobile,
        'h-full': isMobile,
        'w-[300px] shadow-lg lg:shadow-none': isExpanded(),
        'w-[76px]': !isExpanded() && !isMobile,
        'w-72 sm:w-80': isMobile
      }"
      [style.top]="!isMobile ? 'var(--navbar-height, 72px)' : null"
      (mouseenter)="onMouseEnter()"
      (mouseleave)="onMouseLeave()"
      (focusin)="onFocusIn()"
      (focusout)="onFocusOut($event)"
      aria-label="Sidebar Navigation"
    >
      <!-- Logo & Brand Header -->
      <div
        class="h-18 border-b border-slate-100 flex items-center transition-all duration-200 shrink-0"
        [ngClass]="isExpanded() ? 'px-4 sm:px-5 justify-between' : 'px-2 justify-center'"
      >
        <a
          routerLink="/"
          class="flex items-center gap-3 w-fit group transition-all"
          [ngClass]="{ 'justify-center': !isExpanded() }"
          title="CareerNexus Home"
          aria-label="CareerNexus Home"
        >
          <div class="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center shrink-0">
            <img
              src="assets/images/logo.png"
              alt="CareerNexus Logo"
              class="w-full h-full object-contain filter drop-shadow-xs transition-transform duration-200 group-hover:scale-105"
            />
          </div>
          <div
            class="nav-label transition-all"
            [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'"
          >
            <span class="text-base font-extrabold tracking-tight text-slate-900 block leading-tight">Career<span class="text-blue-600">Nexus</span></span>
            <span class="text-[9.5px] font-semibold text-slate-400 tracking-wider uppercase block truncate">Connect • Prepare • Placed</span>
          </div>
        </a>

        <button
          *ngIf="isMobile"
          type="button"
          (click)="closeSidebar.emit()"
          class="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg lg:hidden"
          title="Close sidebar"
          aria-label="Close sidebar"
        >
          <app-icon name="x" [size]="20"></app-icon>
        </button>
      </div>

      <!-- Navigation Links -->
      <div class="flex-1 overflow-y-auto px-2.5 sm:px-3 py-4 space-y-5 custom-scrollbar overflow-x-hidden">
        <!-- STUDENT NAVIGATION -->
        <ng-container *ngIf="activeRole() === 'student'">
          <div>
            <div *ngIf="isExpanded()" class="px-2.5 mb-1.5">
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Overview</span>
            </div>
            <div *ngIf="!isExpanded()" class="border-t border-slate-200/70 my-2 mx-1.5"></div>

            <div class="space-y-1">
              <a
                routerLink="/student/dashboard"
                routerLinkActive="bg-blue-50 text-blue-700 font-semibold"
                [routerLinkActiveOptions]="{ exact: true }"
                (click)="onNavClick()"
                title="Dashboard"
                aria-label="Dashboard"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="layout-dashboard" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Dashboard</span>
              </a>

              <a
                routerLink="/student/profile"
                routerLinkActive="bg-blue-50 text-blue-700 font-semibold"
                (click)="onNavClick()"
                title="Placement Analysis"
                aria-label="Placement Analysis"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="user" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Placement Analysis</span>
              </a>
            </div>
          </div>

          <div>
            <div *ngIf="isExpanded()" class="px-2.5 mb-1.5">
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Prep & Intelligence</span>
            </div>
            <div *ngIf="!isExpanded()" class="border-t border-slate-200/70 my-2 mx-1.5"></div>

            <div class="space-y-1">
              <a
                routerLink="/student/career"
                routerLinkActive="bg-blue-50 text-blue-700 font-semibold"
                (click)="onNavClick()"
                title="Career Hub & Roadmap"
                aria-label="Career Hub & Roadmap"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="sparkles" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Career Hub & Roadmap</span>
              </a>

              <a
                routerLink="/student/assessments"
                routerLinkActive="bg-blue-50 text-blue-700 font-semibold"
                (click)="onNavClick()"
                title="Mock Assessments"
                aria-label="Mock Assessments"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="code" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Mock Assessments</span>
              </a>

              <a
                routerLink="/student/calendar"
                routerLinkActive="bg-blue-50 text-blue-700 font-semibold"
                (click)="onNavClick()"
                title="Drive Calendar"
                aria-label="Drive Calendar"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="calendar" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Drive Calendar</span>
              </a>
            </div>
          </div>

          <div>
            <div *ngIf="isExpanded()" class="px-2.5 mb-1.5">
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Drives & Network</span>
            </div>
            <div *ngIf="!isExpanded()" class="border-t border-slate-200/70 my-2 mx-1.5"></div>

            <div class="space-y-1">
              <a
                routerLink="/student/jobs"
                routerLinkActive="bg-blue-50 text-blue-700 font-semibold"
                (click)="onNavClick()"
                title="Job Openings"
                aria-label="Job Openings"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="briefcase" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Job Openings</span>
              </a>

              <a
                routerLink="/student/applications"
                routerLinkActive="bg-blue-50 text-blue-700 font-semibold"
                (click)="onNavClick()"
                title="My Applications"
                aria-label="My Applications"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="check-circle" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">My Applications</span>
              </a>

              <a
                routerLink="/student/companies"
                routerLinkActive="bg-blue-50 text-blue-700 font-semibold"
                (click)="onNavClick()"
                title="Companies"
                aria-label="Companies"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="building" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Companies</span>
              </a>

              <a
                routerLink="/student/alumni"
                routerLinkActive="bg-blue-50 text-blue-700 font-semibold"
                (click)="onNavClick()"
                title="Alumni Mentors"
                aria-label="Alumni Mentors"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="users" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Alumni Mentors</span>
              </a>

              <a
                routerLink="/student/resources"
                routerLinkActive="bg-blue-50 text-blue-700 font-semibold"
                (click)="onNavClick()"
                title="Resource Drive"
                aria-label="Resource Drive"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="folder" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Resource Drive</span>
              </a>

              <a
                routerLink="/student/messages"
                routerLinkActive="bg-blue-50 text-blue-700 font-semibold"
                (click)="onNavClick()"
                title="Mentorship Chat"
                aria-label="Mentorship Chat"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-between' : 'px-0 py-2 justify-center'"
              >
                <div class="relative flex items-center" [ngClass]="{ 'gap-3': isExpanded() }">
                  <div class="relative w-8 h-8 flex items-center justify-center shrink-0">
                    <app-icon name="message-square" [size]="18"></app-icon>
                    <span
                      *ngIf="!isExpanded() && chatService.totalUnreadCount() > 0"
                      class="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center bg-blue-600 text-white ring-2 ring-white"
                    >
                      {{ chatService.totalUnreadCount() > 9 ? '9+' : chatService.totalUnreadCount() }}
                    </span>
                  </div>
                  <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Mentorship Chat</span>
                </div>
                <span
                  *ngIf="isExpanded() && chatService.totalUnreadCount() > 0"
                  class="ml-auto px-2 py-0.5 text-[11px] font-bold bg-blue-600 text-white rounded-full shrink-0"
                >
                  {{ chatService.totalUnreadCount() }}
                </span>
              </a>

              <a
                routerLink="/student/notifications"
                routerLinkActive="bg-blue-50 text-blue-700 font-semibold"
                (click)="onNavClick()"
                title="Notifications"
                aria-label="Notifications"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-between' : 'px-0 py-2 justify-center'"
              >
                <div class="relative flex items-center" [ngClass]="{ 'gap-3': isExpanded() }">
                  <div class="relative w-8 h-8 flex items-center justify-center shrink-0">
                    <app-icon name="bell" [size]="18"></app-icon>
                    <span
                      *ngIf="!isExpanded() && notificationService.unreadCount() > 0"
                      class="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center bg-blue-600 text-white ring-2 ring-white"
                    >
                      {{ notificationService.unreadCount() > 9 ? '9+' : notificationService.unreadCount() }}
                    </span>
                  </div>
                  <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Notifications</span>
                </div>
                <span
                  *ngIf="isExpanded() && notificationService.unreadCount() > 0"
                  class="ml-auto px-2 py-0.5 text-[11px] font-bold bg-blue-600 text-white rounded-full shrink-0"
                >
                  {{ notificationService.unreadCount() }}
                </span>
              </a>
            </div>
          </div>
        </ng-container>

        <!-- RECRUITER NAVIGATION -->
        <ng-container *ngIf="activeRole() === 'recruiter'">
          <div>
            <div *ngIf="isExpanded()" class="px-2.5 mb-1.5">
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Recruiter Central</span>
            </div>
            <div *ngIf="!isExpanded()" class="border-t border-slate-200/70 my-2 mx-1.5"></div>

            <div class="space-y-1">
              <a
                routerLink="/recruiter/dashboard"
                routerLinkActive="bg-indigo-50 text-indigo-700 font-semibold"
                [routerLinkActiveOptions]="{ exact: true }"
                (click)="onNavClick()"
                title="Hiring Dashboard"
                aria-label="Hiring Dashboard"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="layout-dashboard" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Hiring Dashboard</span>
              </a>

              <a
                routerLink="/recruiter/drives"
                routerLinkActive="bg-indigo-50 text-indigo-700 font-semibold"
                (click)="onNavClick()"
                title="Placement Drives"
                aria-label="Placement Drives"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="calendar" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Placement Drives</span>
              </a>

              <a
                routerLink="/recruiter/jobs"
                routerLinkActive="bg-indigo-50 text-indigo-700 font-semibold"
                (click)="onNavClick()"
                title="Job Postings"
                aria-label="Job Postings"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="briefcase" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Job Postings</span>
              </a>

              <a
                routerLink="/recruiter/applicants"
                routerLinkActive="bg-indigo-50 text-indigo-700 font-semibold"
                (click)="onNavClick()"
                title="Candidate Pipeline"
                aria-label="Candidate Pipeline"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="users" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Candidate Pipeline</span>
              </a>

              <a
                routerLink="/recruiter/calendar"
                routerLinkActive="bg-indigo-50 text-indigo-700 font-semibold"
                (click)="onNavClick()"
                title="Interview Calendar"
                aria-label="Interview Calendar"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="calendar" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Interview Calendar</span>
              </a>

              <a
                routerLink="/recruiter/messages"
                routerLinkActive="bg-indigo-50 text-indigo-700 font-semibold"
                (click)="onNavClick()"
                title="Candidate Chat"
                aria-label="Candidate Chat"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-between' : 'px-0 py-2 justify-center'"
              >
                <div class="relative flex items-center" [ngClass]="{ 'gap-3': isExpanded() }">
                  <div class="relative w-8 h-8 flex items-center justify-center shrink-0">
                    <app-icon name="message-square" [size]="18"></app-icon>
                    <span
                      *ngIf="!isExpanded() && chatService.totalUnreadCount() > 0"
                      class="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center bg-indigo-600 text-white ring-2 ring-white"
                    >
                      {{ chatService.totalUnreadCount() > 9 ? '9+' : chatService.totalUnreadCount() }}
                    </span>
                  </div>
                  <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Candidate Chat</span>
                </div>
                <span
                  *ngIf="isExpanded() && chatService.totalUnreadCount() > 0"
                  class="ml-auto px-2 py-0.5 text-[11px] font-bold bg-indigo-600 text-white rounded-full shrink-0"
                >
                  {{ chatService.totalUnreadCount() }}
                </span>
              </a>

              <a
                routerLink="/recruiter/notifications"
                routerLinkActive="bg-indigo-50 text-indigo-700 font-semibold"
                (click)="onNavClick()"
                title="Notifications"
                aria-label="Notifications"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-between' : 'px-0 py-2 justify-center'"
              >
                <div class="relative flex items-center" [ngClass]="{ 'gap-3': isExpanded() }">
                  <div class="relative w-8 h-8 flex items-center justify-center shrink-0">
                    <app-icon name="bell" [size]="18"></app-icon>
                    <span
                      *ngIf="!isExpanded() && notificationService.unreadCount() > 0"
                      class="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center bg-indigo-600 text-white ring-2 ring-white"
                    >
                      {{ notificationService.unreadCount() > 9 ? '9+' : notificationService.unreadCount() }}
                    </span>
                  </div>
                  <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Notifications</span>
                </div>
                <span
                  *ngIf="isExpanded() && notificationService.unreadCount() > 0"
                  class="ml-auto px-2 py-0.5 text-[11px] font-bold bg-indigo-600 text-white rounded-full shrink-0"
                >
                  {{ notificationService.unreadCount() }}
                </span>
              </a>
            </div>
          </div>
        </ng-container>

        <!-- ALUMNI NAVIGATION -->
        <ng-container *ngIf="activeRole() === 'alumni'">
          <div>
            <div *ngIf="isExpanded()" class="px-2.5 mb-1.5">
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Alumni Portal</span>
            </div>
            <div *ngIf="!isExpanded()" class="border-t border-slate-200/70 my-2 mx-1.5"></div>

            <div class="space-y-1">
              <a
                routerLink="/alumni/dashboard"
                routerLinkActive="bg-purple-50 text-purple-700 font-semibold"
                [routerLinkActiveOptions]="{ exact: true }"
                (click)="onNavClick()"
                title="Dashboard"
                aria-label="Dashboard"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="layout-dashboard" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Dashboard</span>
              </a>

              <a
                routerLink="/alumni/profile"
                routerLinkActive="bg-purple-50 text-purple-700 font-semibold"
                (click)="onNavClick()"
                title="Mentor Profile"
                aria-label="Mentor Profile"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="user" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Mentor Profile</span>
              </a>

              <a
                routerLink="/alumni/students"
                routerLinkActive="bg-purple-50 text-purple-700 font-semibold"
                (click)="onNavClick()"
                title="Student Mentees"
                aria-label="Student Mentees"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="users" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Student Mentees</span>
              </a>

              <a
                routerLink="/alumni/resources"
                routerLinkActive="bg-purple-50 text-purple-700 font-semibold"
                (click)="onNavClick()"
                title="Shared Resources"
                aria-label="Shared Resources"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="folder" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Shared Resources</span>
              </a>

              <a
                routerLink="/alumni/messages"
                routerLinkActive="bg-purple-50 text-purple-700 font-semibold"
                (click)="onNavClick()"
                title="Mentorship Chat"
                aria-label="Mentorship Chat"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-between' : 'px-0 py-2 justify-center'"
              >
                <div class="relative flex items-center" [ngClass]="{ 'gap-3': isExpanded() }">
                  <div class="relative w-8 h-8 flex items-center justify-center shrink-0">
                    <app-icon name="message-square" [size]="18"></app-icon>
                    <span
                      *ngIf="!isExpanded() && chatService.totalUnreadCount() > 0"
                      class="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center bg-purple-600 text-white ring-2 ring-white"
                    >
                      {{ chatService.totalUnreadCount() > 9 ? '9+' : chatService.totalUnreadCount() }}
                    </span>
                  </div>
                  <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Mentorship Chat</span>
                </div>
                <span
                  *ngIf="isExpanded() && chatService.totalUnreadCount() > 0"
                  class="ml-auto px-2 py-0.5 text-[11px] font-bold bg-purple-600 text-white rounded-full shrink-0"
                >
                  {{ chatService.totalUnreadCount() }}
                </span>
              </a>

              <a
                routerLink="/alumni/calls"
                routerLinkActive="bg-purple-50 text-purple-700 font-semibold"
                (click)="onNavClick()"
                title="1:1 Video Calls"
                aria-label="1:1 Video Calls"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="video" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">1:1 Video Calls</span>
              </a>

              <a
                routerLink="/alumni/notifications"
                routerLinkActive="bg-purple-50 text-purple-700 font-semibold"
                (click)="onNavClick()"
                title="Notifications"
                aria-label="Notifications"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-between' : 'px-0 py-2 justify-center'"
              >
                <div class="relative flex items-center" [ngClass]="{ 'gap-3': isExpanded() }">
                  <div class="relative w-8 h-8 flex items-center justify-center shrink-0">
                    <app-icon name="bell" [size]="18"></app-icon>
                    <span
                      *ngIf="!isExpanded() && notificationService.unreadCount() > 0"
                      class="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center bg-purple-600 text-white ring-2 ring-white"
                    >
                      {{ notificationService.unreadCount() > 9 ? '9+' : notificationService.unreadCount() }}
                    </span>
                  </div>
                  <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Notifications</span>
                </div>
                <span
                  *ngIf="isExpanded() && notificationService.unreadCount() > 0"
                  class="ml-auto px-2 py-0.5 text-[11px] font-bold bg-purple-600 text-white rounded-full shrink-0"
                >
                  {{ notificationService.unreadCount() }}
                </span>
              </a>
            </div>
          </div>
        </ng-container>

        <!-- ADMIN NAVIGATION -->
        <ng-container *ngIf="activeRole() === 'admin'">
          <div>
            <div *ngIf="isExpanded()" class="px-2.5 mb-1.5">
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Admin Central</span>
            </div>
            <div *ngIf="!isExpanded()" class="border-t border-slate-200/70 my-2 mx-1.5"></div>

            <div class="space-y-1">
              <a
                routerLink="/admin/command-center"
                routerLinkActive="bg-emerald-50 text-emerald-700 font-semibold"
                (click)="onNavClick()"
                title="Command Center"
                aria-label="Command Center"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="grid" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Command Center</span>
              </a>

              <a
                routerLink="/admin/analytics"
                routerLinkActive="bg-emerald-50 text-emerald-700 font-semibold"
                (click)="onNavClick()"
                title="Placement Analytics"
                aria-label="Placement Analytics"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="bar-chart-2" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Placement Analytics</span>
              </a>

              <a
                routerLink="/admin/dashboard"
                routerLinkActive="bg-emerald-50 text-emerald-700 font-semibold"
                [routerLinkActiveOptions]="{ exact: true }"
                (click)="onNavClick()"
                title="Operations Overview"
                aria-label="Operations Overview"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="layout-dashboard" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Operations Overview</span>
              </a>

              <a
                routerLink="/admin/calendar"
                routerLinkActive="bg-emerald-50 text-emerald-700 font-semibold"
                (click)="onNavClick()"
                title="Placement Calendar"
                aria-label="Placement Calendar"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="calendar" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Placement Calendar</span>
              </a>

              <a
                routerLink="/admin/users"
                routerLinkActive="bg-emerald-50 text-emerald-700 font-semibold"
                (click)="onNavClick()"
                title="User Management"
                aria-label="User Management"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="users" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">User Management</span>
              </a>

              <a
                routerLink="/admin/applications"
                routerLinkActive="bg-emerald-50 text-emerald-700 font-semibold"
                (click)="onNavClick()"
                title="Pipeline Tracker"
                aria-label="Pipeline Tracker"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="check-circle" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Pipeline Tracker</span>
              </a>

              <a
                routerLink="/admin/jobs"
                routerLinkActive="bg-emerald-50 text-emerald-700 font-semibold"
                (click)="onNavClick()"
                title="Job Drives"
                aria-label="Job Drives"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="briefcase" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Job Drives</span>
              </a>

              <a
                routerLink="/admin/companies"
                routerLinkActive="bg-emerald-50 text-emerald-700 font-semibold"
                (click)="onNavClick()"
                title="Companies"
                aria-label="Companies"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="building" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Companies</span>
              </a>

              <a
                routerLink="/admin/resources"
                routerLinkActive="bg-emerald-50 text-emerald-700 font-semibold"
                (click)="onNavClick()"
                title="Resource Drive"
                aria-label="Resource Drive"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-start' : 'px-0 py-2 justify-center'"
              >
                <div class="w-8 h-8 flex items-center justify-center shrink-0">
                  <app-icon name="folder" [size]="18"></app-icon>
                </div>
                <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Resource Drive</span>
              </a>

              <a
                routerLink="/admin/messages"
                routerLinkActive="bg-emerald-50 text-emerald-700 font-semibold"
                (click)="onNavClick()"
                title="Placement Chat"
                aria-label="Placement Chat"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-between' : 'px-0 py-2 justify-center'"
              >
                <div class="relative flex items-center" [ngClass]="{ 'gap-3': isExpanded() }">
                  <div class="relative w-8 h-8 flex items-center justify-center shrink-0">
                    <app-icon name="message-square" [size]="18"></app-icon>
                    <span
                      *ngIf="!isExpanded() && chatService.totalUnreadCount() > 0"
                      class="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center bg-emerald-600 text-white ring-2 ring-white"
                    >
                      {{ chatService.totalUnreadCount() > 9 ? '9+' : chatService.totalUnreadCount() }}
                    </span>
                  </div>
                  <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Placement Chat</span>
                </div>
                <span
                  *ngIf="isExpanded() && chatService.totalUnreadCount() > 0"
                  class="ml-auto px-2 py-0.5 text-[11px] font-bold bg-emerald-600 text-white rounded-full shrink-0"
                >
                  {{ chatService.totalUnreadCount() }}
                </span>
              </a>

              <a
                routerLink="/admin/notifications"
                routerLinkActive="bg-emerald-50 text-emerald-700 font-semibold"
                (click)="onNavClick()"
                title="Notifications"
                aria-label="Notifications"
                class="group flex items-center rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                [ngClass]="isExpanded() ? 'px-3 py-2 justify-between' : 'px-0 py-2 justify-center'"
              >
                <div class="relative flex items-center" [ngClass]="{ 'gap-3': isExpanded() }">
                  <div class="relative w-8 h-8 flex items-center justify-center shrink-0">
                    <app-icon name="bell" [size]="18"></app-icon>
                    <span
                      *ngIf="!isExpanded() && notificationService.unreadCount() > 0"
                      class="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center bg-emerald-600 text-white ring-2 ring-white"
                    >
                      {{ notificationService.unreadCount() > 9 ? '9+' : notificationService.unreadCount() }}
                    </span>
                  </div>
                  <span class="nav-label truncate" [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'">Notifications</span>
                </div>
                <span
                  *ngIf="isExpanded() && notificationService.unreadCount() > 0"
                  class="ml-auto px-2 py-0.5 text-[11px] font-bold bg-emerald-600 text-white rounded-full shrink-0"
                >
                  {{ notificationService.unreadCount() }}
                </span>
              </a>
            </div>
          </div>
        </ng-container>
      </div>

      <!-- User footer profile bar -->
      <div
        class="border-t border-slate-100 bg-slate-50/70 transition-all duration-200 shrink-0"
        [ngClass]="isExpanded() ? 'p-3 sm:p-4 flex items-center justify-between' : 'p-2 flex flex-col items-center gap-2'"
      >
        <div
          class="flex items-center gap-3 min-w-0"
          [ngClass]="{ 'justify-center': !isExpanded() }"
          [title]="(authService.currentUser()?.fullName || 'User') + ' (' + activeRole() + ')'"
        >
          <img
            [src]="authService.currentUser()?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'"
            class="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
            alt="User avatar"
          />
          <div
            class="nav-label min-w-0 transition-all"
            [ngClass]="isExpanded() ? 'nav-label-expanded' : 'nav-label-collapsed'"
          >
            <h5 class="text-xs font-semibold text-slate-800 truncate">{{ authService.currentUser()?.fullName }}</h5>
            <span
              class="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              [ngClass]="{
                'bg-blue-100 text-blue-700': activeRole() === 'student',
                'bg-purple-100 text-purple-700': activeRole() === 'alumni',
                'bg-indigo-100 text-indigo-700': activeRole() === 'recruiter',
                'bg-emerald-100 text-emerald-700': activeRole() === 'admin'
              }"
            >
              {{ activeRole() }}
            </span>
          </div>
        </div>

        <button
          type="button"
          (click)="authService.logout()"
          title="Sign out"
          aria-label="Sign out"
          class="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors shrink-0"
        >
          <app-icon name="log-out" [size]="18"></app-icon>
        </button>
      </div>
    </aside>
  `,
  styles: [`
    :host {
      display: block;
    }
    .nav-label {
      transition: opacity 160ms ease, max-width 220ms ease, margin 220ms ease;
      white-space: nowrap;
    }
    .nav-label-collapsed {
      opacity: 0;
      max-width: 0;
      margin-left: 0;
      overflow: hidden;
      pointer-events: none;
    }
    .nav-label-expanded {
      opacity: 1;
      max-width: 215px;
      margin-left: 0.75rem;
    }
    .custom-scrollbar::-webkit-scrollbar {
      width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #e2e8f0;
      border-radius: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #cbd5e1;
    }
  `]
})
export class SidebarComponent {
  authService = inject(AuthService);
  chatService = inject(ChatService);
  notificationService = inject(NotificationService);
  layoutService = inject(LayoutService);
  private elementRef = inject(ElementRef);

  @Input() isMobile = false;
  @Output() closeSidebar = new EventEmitter<void>();

  activeRole = computed<UserRole>(() => this.authService.activeRole());

  isExpanded = computed(() => {
    if (this.isMobile) {
      return true;
    }
    return this.layoutService.isSidebarExpanded();
  });

  onMouseEnter() {
    if (this.isMobile) return;
    this.layoutService.onSidebarMouseEnter();
  }

  onMouseLeave() {
    if (this.isMobile) return;
    this.layoutService.onSidebarMouseLeave();
  }

  onFocusIn() {
    if (this.isMobile) return;
    this.layoutService.onSidebarFocusIn();
  }

  onFocusOut(event: FocusEvent) {
    if (this.isMobile) return;
    this.layoutService.onSidebarFocusOut(event, this.elementRef.nativeElement);
  }

  onNavClick() {
    if (this.isMobile) {
      this.closeSidebar.emit();
    }
  }
}
