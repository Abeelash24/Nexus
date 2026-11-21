import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AlumniService } from '../../../core/services/alumni.service';
import { AuthService } from '../../../core/services/auth.service';
import { ChatService } from '../../../core/services/chat.service';
import { ConnectedMentee } from '../../../core/models/alumni.model';
import { IconComponent } from '../../../shared/icons/icon.component';

@Component({
  selector: 'app-alumni-mentees',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    IconComponent
  ],
  template: `
    <div class="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      <!-- Header Banner -->
      <div class="bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-purple-500/15 relative overflow-hidden">
        <div class="absolute right-0 top-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

        <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 text-white backdrop-blur-xs border border-white/20">
                <app-icon name="shield-check" [size]="14"></app-icon>
                Verified Mentees Only
              </span>
              <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-400/20 text-emerald-200 border border-emerald-300/30">
                {{ mentees().length }} Connected
              </span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight">
              My Mentees
            </h1>
            <p class="text-purple-100 text-xs sm:text-sm mt-1 max-w-xl leading-relaxed">
              Students who have established an accepted 1-on-1 mentorship connection with you. Communicate, review portfolios, and guide their career milestones.
            </p>
          </div>

          <div class="flex items-center gap-3">
            <a
              routerLink="/alumni/dashboard"
              class="px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <app-icon name="layout-dashboard" [size]="15"></app-icon>
              <span>Alumni Dashboard</span>
            </a>
          </div>
        </div>
      </div>

      <!-- Search & Filter Bar (Only filters verified mentees) -->
      <div class="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div class="relative w-full sm:w-80">
          <app-icon name="search" [size]="16" customClass="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></app-icon>
          <input
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Search mentees by name, department, or skill..."
            class="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
          />
        </div>

        <div class="text-xs text-slate-500 font-medium">
          Showing <span class="font-bold text-slate-900">{{ filteredMentees().length }}</span> of {{ mentees().length }} connected mentees
        </div>
      </div>

      <!-- Loading State -->
      <div *ngIf="isLoading()" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div *ngFor="let item of [1,2,3]" class="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs animate-pulse space-y-4">
          <div class="flex items-center gap-3">
            <div class="w-14 h-14 rounded-2xl bg-slate-200"></div>
            <div class="space-y-2 flex-1">
              <div class="h-4 bg-slate-200 rounded-md w-3/4"></div>
              <div class="h-3 bg-slate-200 rounded-md w-1/2"></div>
            </div>
          </div>
          <div class="h-16 bg-slate-100 rounded-xl"></div>
          <div class="h-8 bg-slate-200 rounded-xl"></div>
        </div>
      </div>

      <!-- Mentees Cards Grid -->
      <div *ngIf="!isLoading() && filteredMentees().length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div
          *ngFor="let mentee of filteredMentees()"
          class="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 hover:border-purple-200 hover:shadow-lg transition-all flex flex-col justify-between group space-y-4"
        >
          <div>
            <!-- Mentee Header: Avatar, Name, Department -->
            <div class="flex items-start gap-3.5 mb-3">
              <img
                *ngIf="mentee.profilePhoto"
                [src]="mentee.profilePhoto"
                [alt]="mentee.fullName"
                (error)="onImgError($event, mentee.fullName)"
                class="w-13 h-13 rounded-2xl object-cover border border-slate-200 shadow-2xs shrink-0"
              />
              <div
                *ngIf="!mentee.profilePhoto"
                class="w-13 h-13 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-2xs"
              >
                {{ mentee.fullName.charAt(0) }}
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-1">
                  <h3 class="text-sm font-bold text-slate-900 truncate group-hover:text-purple-700 transition-colors">
                    {{ mentee.fullName }}
                  </h3>
                  <span *ngIf="mentee.rollNumber" class="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 shrink-0">
                    {{ mentee.rollNumber }}
                  </span>
                </div>
                <span class="text-xs text-slate-600 font-medium block truncate mt-0.5">
                  {{ mentee.program }} • {{ mentee.department }}
                </span>
                <span class="text-[11px] text-slate-400 block mt-0.5">
                  Class of {{ mentee.graduationYear }}
                </span>
              </div>
            </div>

            <!-- Mentorship Topic & Reason Box -->
            <div class="p-3 rounded-xl bg-purple-50/60 border border-purple-100/80 space-y-1 mb-3">
              <div class="flex items-center gap-1.5 text-[11px] font-semibold text-purple-900">
                <app-icon name="book-open" [size]="13" customClass="text-purple-600"></app-icon>
                <span>{{ mentee.mentorshipTopic }}</span>
              </div>
              <p *ngIf="mentee.reason" class="text-[11px] text-purple-800/80 line-clamp-2 italic">
                "{{ mentee.reason }}"
              </p>
            </div>

            <!-- Skills Badges -->
            <div *ngIf="mentee.skills && mentee.skills.length > 0" class="flex flex-wrap gap-1 mb-2">
              <span
                *ngFor="let skill of mentee.skills.slice(0, 4)"
                class="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/60"
              >
                {{ skill }}
              </span>
              <span *ngIf="mentee.skills.length > 4" class="text-[10px] text-slate-400 px-1 py-0.5">
                +{{ mentee.skills.length - 4 }}
              </span>
            </div>
          </div>

          <!-- Actions: View Profile, Chat, Call -->
          <div class="pt-3 border-t border-slate-100 flex items-center gap-2">
            <a
              [routerLink]="['/alumni/student', mentee.studentId]"
              class="flex-1 py-2 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <app-icon name="user" [size]="14"></app-icon>
              <span>View Profile</span>
            </a>

            <button
              type="button"
              (click)="chatWithMentee(mentee)"
              class="p-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition-colors cursor-pointer"
              title="Message Mentee"
            >
              <app-icon name="message-square" [size]="15"></app-icon>
            </button>

            <button
              type="button"
              (click)="callMentee(mentee, 'video')"
              class="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-purple-50 text-slate-700 hover:text-purple-700 transition-colors cursor-pointer"
              title="1-on-1 Video Session"
            >
              <app-icon name="video" [size]="15"></app-icon>
            </button>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div
        *ngIf="!isLoading() && filteredMentees().length === 0"
        class="bg-white rounded-3xl p-10 sm:p-14 border border-dashed border-slate-300 text-center space-y-4 max-w-2xl mx-auto shadow-xs"
      >
        <div class="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto shadow-inner">
          <app-icon name="users" [size]="32"></app-icon>
        </div>

        <div class="space-y-1">
          <h3 class="text-base sm:text-lg font-bold text-slate-900">
            {{ searchQuery.trim() ? 'No Matching Mentees' : 'No Connected Mentees Yet' }}
          </h3>
          <p class="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            {{ searchQuery.trim()
              ? 'No connected mentees matched your search query "' + searchQuery + '".'
              : 'You have zero visibility of unverified students. Once you review and accept student mentorship requests on your Alumni Dashboard, your mentees will appear here.'
            }}
          </p>
        </div>

        <div class="pt-2">
          <a
            routerLink="/alumni/dashboard"
            class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition-colors shadow-xs"
          >
            <app-icon name="clock" [size]="15"></app-icon>
            <span>Review Pending Requests on Dashboard</span>
          </a>
        </div>
      </div>
    </div>
  `
})
export class AlumniMenteesComponent implements OnInit {
  alumniService = inject(AlumniService);
  authService = inject(AuthService);
  chatService = inject(ChatService);
  private router = inject(Router);

  isLoading = signal<boolean>(true);
  searchQuery = '';

  mentees = computed(() => this.alumniService.myMentees());

  filteredMentees = computed(() => {
    const query = this.searchQuery.toLowerCase().trim();
    const list = this.mentees();
    if (!query) return list;

    return list.filter(m =>
      m.fullName.toLowerCase().includes(query) ||
      m.department.toLowerCase().includes(query) ||
      m.program.toLowerCase().includes(query) ||
      m.mentorshipTopic.toLowerCase().includes(query) ||
      (m.skills && m.skills.some(s => s.toLowerCase().includes(query)))
    );
  });

  async ngOnInit() {
    this.isLoading.set(true);
    try {
      await this.alumniService.fetchConnectedMentees();
    } finally {
      this.isLoading.set(false);
    }
  }

  chatWithMentee(mentee: ConnectedMentee) {
    const currentUserId = this.authService.currentUser()?.id;
    if (!currentUserId) return;

    const canonicalConvId = `conv-mentorship-${[currentUserId, mentee.userId].sort().join('_')}`;

    this.chatService.startConversationWith({
      id: mentee.userId,
      name: mentee.fullName,
      avatar: mentee.profilePhoto,
      role: 'student',
      headline: `${mentee.department} (Mentee)`
    });

    this.router.navigate(['/alumni/chat'], { queryParams: { conversationId: canonicalConvId } });
  }

  callMentee(mentee: ConnectedMentee, type: 'audio' | 'video') {
    this.router.navigate(['/alumni/calls'], {
      queryParams: {
        peerId: mentee.userId,
        initiate: 'true',
        callType: type
      }
    });
  }

  onImgError(event: Event, name: string) {
    const target = event.target as HTMLImageElement;
    target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=7c3aed&color=fff&bold=true`;
  }
}
