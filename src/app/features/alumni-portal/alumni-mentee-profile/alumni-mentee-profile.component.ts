import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AlumniService } from '../../../core/services/alumni.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { ChatService } from '../../../core/services/chat.service';
import { ConnectedMentee } from '../../../core/models/alumni.model';
import { IconComponent } from '../../../shared/icons/icon.component';

@Component({
  selector: 'app-alumni-mentee-profile',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IconComponent
  ],
  template: `
    <!-- STRICT ACCESS GATE: Zero content rendered if accessDenied or mentee is null -->
    <div *ngIf="accessDenied()" class="min-h-[50vh] flex items-center justify-center">
      <div class="text-center p-8 max-w-md bg-white rounded-3xl border border-rose-200 shadow-sm space-y-3">
        <app-icon name="shield-alert" [size]="36" customClass="text-rose-500 mx-auto"></app-icon>
        <h2 class="text-lg font-bold text-slate-900">Access Restricted</h2>
        <p class="text-xs text-slate-500">Redirecting to Alumni Dashboard...</p>
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div *ngIf="isLoading() && !accessDenied()" class="space-y-6 animate-pulse">
      <div class="h-48 bg-slate-200 rounded-3xl"></div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="h-64 bg-slate-200 rounded-3xl"></div>
        <div class="md:col-span-2 h-64 bg-slate-200 rounded-3xl"></div>
      </div>
    </div>

    <!-- Verified Mentee Profile View -->
    <div *ngIf="mentee() && !accessDenied() && !isLoading()" class="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      <!-- Breadcrumb Navigation -->
      <div class="flex items-center gap-2 text-xs text-slate-500 font-medium">
        <a routerLink="/alumni/dashboard" class="hover:text-purple-600 transition-colors">Dashboard</a>
        <span>/</span>
        <a routerLink="/alumni/mentees" class="hover:text-purple-600 transition-colors">My Mentees</a>
        <span>/</span>
        <span class="text-slate-900 font-bold truncate">{{ mentee()!.fullName }}</span>
      </div>

      <!-- Hero Header Card -->
      <div class="bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-purple-500/15 relative overflow-hidden">
        <div class="absolute right-0 top-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

        <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div class="flex items-center gap-4 sm:gap-6 min-w-0">
            <img
              *ngIf="mentee()!.profilePhoto"
              [src]="mentee()!.profilePhoto"
              [alt]="mentee()!.fullName"
              (error)="onImgError($event, mentee()!.fullName)"
              class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl object-cover border-2 border-white/30 shadow-md shrink-0"
            />
            <div
              *ngIf="!mentee()!.profilePhoto"
              class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl bg-white/20 backdrop-blur-md text-white font-extrabold text-2xl sm:text-3xl flex items-center justify-center shrink-0 border-2 border-white/30 shadow-md"
            >
              {{ mentee()!.fullName.charAt(0) }}
            </div>

            <div class="min-w-0">
              <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-400/20 text-emerald-200 border border-emerald-300/30">
                  <app-icon name="check-circle" [size]="12"></app-icon>
                  Verified Mentee
                </span>
                <span *ngIf="mentee()!.rollNumber" class="text-xs font-mono px-2 py-0.5 rounded-md bg-white/15 text-purple-100">
                  {{ mentee()!.rollNumber }}
                </span>
              </div>

              <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight truncate">
                {{ mentee()!.fullName }}
              </h1>
              <p class="text-purple-100 text-xs sm:text-sm mt-0.5">
                {{ mentee()!.program }} • {{ mentee()!.department }} (Class of {{ mentee()!.graduationYear }})
              </p>
            </div>
          </div>

          <!-- Quick Interactive Actions -->
          <div class="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              (click)="chatWithMentee()"
              class="px-4 py-2.5 rounded-xl bg-white text-purple-700 hover:bg-purple-50 font-bold text-xs flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
            >
              <app-icon name="message-square" [size]="15"></app-icon>
              <span>Message</span>
            </button>

            <button
              type="button"
              (click)="callMentee('audio')"
              class="px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Voice Call"
            >
              <app-icon name="phone" [size]="15"></app-icon>
              <span class="hidden sm:inline">Call</span>
            </button>

            <button
              type="button"
              (click)="callMentee('video')"
              class="px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="1-on-1 Video Session"
            >
              <app-icon name="video" [size]="15"></app-icon>
              <span>Video Session</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Main Profile Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left Column: Mentorship Engagement & Academics -->
        <div class="space-y-6">
          <!-- Mentorship Topic Card -->
          <div class="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <h2 class="text-sm font-bold text-slate-900 flex items-center gap-2">
              <app-icon name="target" [size]="16" customClass="text-purple-600"></app-icon>
              Mentorship Focus Area
            </h2>

            <div class="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-100 space-y-1">
              <span class="text-xs font-bold text-purple-900 block">{{ mentee()!.mentorshipTopic }}</span>
              <p *ngIf="mentee()!.reason" class="text-xs text-purple-800/80 italic mt-1 leading-relaxed">
                "{{ mentee()!.reason }}"
              </p>
            </div>

            <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Connection Status:</span>
              <span class="font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-100">
                Active & Verified
              </span>
            </div>

            <div *ngIf="mentee()!.acceptedAt" class="flex items-center justify-between text-xs text-slate-500">
              <span>Connected Since:</span>
              <span class="font-semibold text-slate-700">{{ mentee()!.acceptedAt | date:'mediumDate' }}</span>
            </div>
          </div>

          <!-- Academic & Placement Metrics -->
          <div class="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <h2 class="text-sm font-bold text-slate-900 flex items-center gap-2">
              <app-icon name="graduation-cap" [size]="16" customClass="text-purple-600"></app-icon>
              Academic Overview
            </h2>

            <div class="grid grid-cols-2 gap-3 text-xs">
              <div *ngIf="mentee()!.cgpa !== undefined" class="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <span class="text-slate-400 block text-[10px] font-semibold uppercase">Cumulative CGPA</span>
                <span class="text-base font-extrabold text-slate-900 mt-0.5 block">{{ mentee()!.cgpa }} / 10.0</span>
              </div>

              <div *ngIf="mentee()!.placementStatus" class="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <span class="text-slate-400 block text-[10px] font-semibold uppercase">Placement Status</span>
                <span class="text-xs font-bold text-slate-800 mt-1 block truncate">{{ mentee()!.placementStatus }}</span>
              </div>

              <div *ngIf="mentee()!.preferredDomain" class="p-3 rounded-2xl bg-slate-50 border border-slate-100 col-span-2">
                <span class="text-slate-400 block text-[10px] font-semibold uppercase">Target Engineering Domain</span>
                <span class="text-xs font-bold text-slate-800 mt-0.5 block">{{ mentee()!.preferredDomain }}</span>
              </div>
            </div>
          </div>

          <!-- Portfolios & Social Links -->
          <div *ngIf="mentee()!.githubUrl || mentee()!.linkedinUrl || mentee()!.portfolioUrl" class="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
            <h2 class="text-sm font-bold text-slate-900 flex items-center gap-2">
              <app-icon name="link" [size]="16" customClass="text-purple-600"></app-icon>
              Verified External Portfolios
            </h2>

            <div class="space-y-2">
              <a
                *ngIf="mentee()!.githubUrl"
                [href]="mentee()!.githubUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 hover:bg-purple-50 text-slate-700 hover:text-purple-700 border border-slate-200/70 text-xs font-semibold transition-colors"
              >
                <app-icon name="github" [size]="16"></app-icon>
                <span class="truncate">GitHub Profile</span>
              </a>

              <a
                *ngIf="mentee()!.linkedinUrl"
                [href]="mentee()!.linkedinUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 hover:bg-purple-50 text-slate-700 hover:text-purple-700 border border-slate-200/70 text-xs font-semibold transition-colors"
              >
                <app-icon name="linkedin" [size]="16"></app-icon>
                <span class="truncate">LinkedIn Profile</span>
              </a>

              <a
                *ngIf="mentee()!.portfolioUrl"
                [href]="mentee()!.portfolioUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 hover:bg-purple-50 text-slate-700 hover:text-purple-700 border border-slate-200/70 text-xs font-semibold transition-colors"
              >
                <app-icon name="globe" [size]="16"></app-icon>
                <span class="truncate">Engineering Portfolio</span>
              </a>
            </div>
          </div>
        </div>

        <!-- Right Column: Skills, Bio, and Notes -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Skills & Proficiencies -->
          <div class="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-4">
            <h2 class="text-sm font-bold text-slate-900 flex items-center gap-2">
              <app-icon name="award" [size]="17" customClass="text-purple-600"></app-icon>
              Verified Technical Skills & Stack
            </h2>

            <div *ngIf="mentee()!.skills && mentee()!.skills.length > 0" class="flex flex-wrap gap-2">
              <span
                *ngFor="let skill of mentee()!.skills"
                class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100"
              >
                {{ skill }}
              </span>
            </div>

            <p *ngIf="!mentee()!.skills || mentee()!.skills.length === 0" class="text-xs text-slate-400">
              No technical skills listed on candidate record.
            </p>
          </div>

          <!-- Mentee Statement / Bio -->
          <div class="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-4">
            <h2 class="text-sm font-bold text-slate-900 flex items-center gap-2">
              <app-icon name="user" [size]="17" customClass="text-purple-600"></app-icon>
              Candidate Statement & Background
            </h2>

            <p *ngIf="mentee()!.bio" class="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {{ mentee()!.bio }}
            </p>

            <p *ngIf="!mentee()!.bio" class="text-xs text-slate-400 italic">
              Candidate has not published an extended bio yet.
            </p>
          </div>

          <!-- Mentorship Guidance Card -->
          <div class="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-7 text-white shadow-md space-y-3">
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
              <app-icon name="sparkles" [size]="16" customClass="text-amber-400"></app-icon>
              Mentor Advice & Engagement
            </h3>
            <p class="text-xs text-slate-300 leading-relaxed">
              As an alumni mentor, your advice directly shapes campus placement outcomes. You can conduct mock technical interviews, review architectural patterns, or give behavioral guidance via real-time WebRTC audio/video calls.
            </p>
            <div class="pt-2 flex items-center gap-3">
              <button
                type="button"
                (click)="callMentee('video')"
                class="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Schedule Video Call
              </button>
              <button
                type="button"
                (click)="chatWithMentee()"
                class="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Send Message
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AlumniMenteeProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private alumniService = inject(AlumniService);
  private authService = inject(AuthService);
  private chatService = inject(ChatService);
  private toast = inject(ToastService);

  isLoading = signal<boolean>(true);
  accessDenied = signal<boolean>(false);
  mentee = signal<ConnectedMentee | null>(null);

  async ngOnInit() {
    const studentId = this.route.snapshot.paramMap.get('id');

    if (!studentId) {
      this.accessDenied.set(true);
      this.toast.error('Mentee not found or access denied', 'Invalid student identifier.');
      this.router.navigate(['/alumni/dashboard']);
      return;
    }

    this.isLoading.set(true);
    try {
      // STRICT VERIFICATION: Verify that studentId is an accepted mentee of the logged-in alumni
      const verifiedMentee = await this.alumniService.getMenteeById(studentId);

      if (!verifiedMentee) {
        this.accessDenied.set(true);
        this.mentee.set(null);
        this.toast.error(
          'Mentee not found or access denied',
          'You can only view profiles of students who are your verified, connected mentees.'
        );
        this.router.navigate(['/alumni/dashboard']);
        return;
      }

      this.mentee.set(verifiedMentee);
    } catch (err) {
      this.accessDenied.set(true);
      this.toast.error('Mentee not found or access denied', 'Failed to retrieve mentee profile.');
      this.router.navigate(['/alumni/dashboard']);
    } finally {
      this.isLoading.set(false);
    }
  }

  chatWithMentee() {
    const menteeData = this.mentee();
    const currentUserId = this.authService.currentUser()?.id;
    if (!menteeData || !currentUserId) return;

    const canonicalConvId = `conv-mentorship-${[currentUserId, menteeData.userId].sort().join('_')}`;

    this.chatService.startConversationWith({
      id: menteeData.userId,
      name: menteeData.fullName,
      avatar: menteeData.profilePhoto,
      role: 'student',
      headline: `${menteeData.department} (Mentee)`
    });

    this.router.navigate(['/alumni/chat'], { queryParams: { conversationId: canonicalConvId } });
  }

  callMentee(type: 'audio' | 'video') {
    const menteeData = this.mentee();
    if (!menteeData) return;

    this.router.navigate(['/alumni/calls'], {
      queryParams: {
        peerId: menteeData.userId,
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
