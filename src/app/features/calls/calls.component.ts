import { Component, inject, OnInit, OnDestroy, ElementRef, ViewChild, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CallService } from '../../core/services/call.service';
import { AlumniService } from '../../core/services/alumni.service';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { IconComponent } from '../../shared/icons/icon.component';
import { BadgeComponent } from '../../shared/ui/badge.component';

@Component({
  selector: 'app-calls',
  standalone: true,
  imports: [CommonModule, IconComponent, BadgeComponent],
  template: `
    <div class="space-y-6 animate-in fade-in duration-300">
      <!-- 1. Dedicated In-Page Active WebRTC Video Arena -->
      <div
        *ngIf="callService.isInCall()"
        class="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[75vh] max-h-[780px] min-h-[500px]"
      >
        <!-- Top bar with call status, connection type and timer -->
        <div class="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-white shrink-0">
          <div class="flex items-center gap-3">
            <span
              class="w-2.5 h-2.5 rounded-full"
              [ngClass]="callService.connectionState() === 'connected' ? 'bg-emerald-500 animate-ping' : 'bg-amber-400 animate-pulse'"
            ></span>
            <div>
              <div class="flex items-center gap-2">
                <h4 class="text-sm font-bold tracking-wide">
                  {{ callService.activeCall()?.callType === 'video' ? '1-on-1 Video Session' : 'Voice Mentoring Call' }}
                </h4>
                <!-- Connection State Badge -->
                <span
                  class="px-2.5 py-0.5 rounded-full text-[10px] font-medium border"
                  [ngClass]="{
                    'bg-emerald-500/20 text-emerald-300 border-emerald-500/30': callService.connectionState() === 'connected',
                    'bg-amber-500/20 text-amber-300 border-amber-500/30': callService.connectionState() === 'connecting' || callService.connectionState() === 'calling',
                    'bg-rose-500/20 text-rose-300 border-rose-500/30': callService.connectionState() === 'disconnected' || callService.connectionState() === 'reconnecting',
                    'bg-slate-500/20 text-slate-300 border-slate-500/30': callService.connectionState() === 'idle' || callService.connectionState() === 'ended'
                  }"
                >
                  {{ callService.connectionState() === 'connected' ? 'Connected (P2P)' : callService.connectionState() === 'connecting' || callService.connectionState() === 'calling' ? 'Connecting...' : callService.connectionState() === 'reconnecting' ? 'Reconnecting...' : 'Disconnected' }}
                </span>
              </div>
              <p class="text-xs text-slate-400 mt-0.5">
                Session with {{ getPeerName() }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <div class="px-3.5 py-1.5 rounded-full bg-slate-800 text-xs font-mono font-semibold text-emerald-400 border border-slate-700">
              {{ callService.formatDuration(callService.callDuration()) }}
            </div>
          </div>
        </div>

        <!-- Video & Audio Stream Arena -->
        <div class="flex-1 relative bg-slate-950 p-4 flex flex-col sm:flex-row gap-4 items-center justify-center overflow-hidden">
          <!-- Main participant tile (Remote Stream) -->
          <div class="relative flex-1 w-full h-full rounded-2xl bg-slate-800/90 border border-slate-700 overflow-hidden flex flex-col items-center justify-center">
            <!-- Active Remote Video if available -->
            <video
              #remoteVideoRef
              autoplay
              playsinline
              class="w-full h-full object-cover"
              [ngClass]="callService.remoteStream() && callService.activeCall()?.callType === 'video' ? 'block' : 'hidden'"
            ></video>

            <!-- Audio-only or avatar fallback view -->
            <div
              *ngIf="!callService.remoteStream() || callService.activeCall()?.callType === 'audio'"
              class="flex flex-col items-center justify-center p-6 text-center"
            >
              <div class="relative mb-4">
                <img
                  *ngIf="getPeerAvatar()"
                  [src]="getPeerAvatar()"
                  class="w-28 h-28 rounded-full border-4 border-slate-700 shadow-2xl object-cover"
                />
                <div
                  *ngIf="!getPeerAvatar()"
                  class="w-28 h-28 rounded-full bg-purple-700 text-white font-extrabold text-2xl flex items-center justify-center border-4 border-slate-700 shadow-2xl"
                >
                  {{ getPeerInitials() }}
                </div>
                <span class="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900"></span>
              </div>

              <h3 class="text-lg font-bold text-white">{{ getPeerName() }}</h3>
              <p class="text-xs text-slate-400 mt-1">
                {{ callService.activeCall()?.status === 'ringing' ? 'Ringing and establishing connection...' : 'Session in progress • High definition WebRTC audio' }}
              </p>

              <!-- Audio Waveform indicator -->
              <div class="flex items-center gap-1.5 mt-4">
                <span class="w-1 h-4 bg-emerald-500 rounded-full animate-bounce"></span>
                <span class="w-1 h-6 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.15s]"></span>
                <span class="w-1 h-8 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.3s]"></span>
                <span class="w-1 h-5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.45s]"></span>
              </div>
            </div>

            <!-- Remote user label -->
            <div class="absolute bottom-3 left-3 px-3 py-1 rounded-xl bg-slate-900/80 backdrop-blur-xs text-white text-xs font-semibold border border-slate-700 flex items-center gap-1.5">
              <span>{{ getPeerName() }}</span>
              <span class="text-[10px] text-slate-400">({{ getPeerRole() }})</span>
            </div>
          </div>

          <!-- Local Self PIP tile (Camera Feed) -->
          <div
            *ngIf="callService.activeCall()?.callType === 'video'"
            class="absolute top-6 right-6 w-36 sm:w-52 h-28 sm:h-38 rounded-2xl bg-slate-900 border-2 border-blue-500/80 shadow-2xl overflow-hidden flex flex-col items-center justify-center z-10"
          >
            <!-- Local Video Element -->
            <video
              #localVideoRef
              autoplay
              muted
              playsinline
              class="w-full h-full object-cover"
              [ngClass]="!callService.isVideoOff() && callService.localStream() ? 'block' : 'hidden'"
            ></video>

            <!-- Camera Off Fallback -->
            <div
              *ngIf="callService.isVideoOff() || !callService.localStream()"
              class="w-full h-full bg-slate-900 flex flex-col items-center justify-center text-slate-400 p-2 text-center"
            >
              <app-icon name="video-off" [size]="22"></app-icon>
              <span class="text-[10px] mt-1 text-slate-400">Camera Paused</span>
            </div>

            <div class="absolute bottom-1.5 left-2 px-2 py-0.5 rounded bg-slate-950/80 text-[10px] text-white/90 font-medium">
              You {{ callService.isMicMuted() ? '(Muted)' : '' }}
            </div>
          </div>
        </div>

        <!-- Controls Bottom Bar -->
        <div class="px-6 py-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-center gap-4 shrink-0">
          <!-- Mic toggle -->
          <button
            type="button"
            (click)="callService.toggleMic()"
            class="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200"
            [ngClass]="{
              'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700': !callService.isMicMuted(),
              'bg-rose-600 text-white hover:bg-rose-700': callService.isMicMuted()
            }"
            [title]="callService.isMicMuted() ? 'Unmute microphone' : 'Mute microphone'"
          >
            <app-icon [name]="callService.isMicMuted() ? 'mic-off' : 'mic'" [size]="20"></app-icon>
          </button>

          <!-- Video toggle (only on video calls) -->
          <button
            *ngIf="callService.activeCall()?.callType === 'video'"
            type="button"
            (click)="callService.toggleVideo()"
            class="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200"
            [ngClass]="{
              'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700': !callService.isVideoOff(),
              'bg-rose-600 text-white hover:bg-rose-700': callService.isVideoOff()
            }"
            [title]="callService.isVideoOff() ? 'Turn camera on' : 'Turn camera off'"
          >
            <app-icon [name]="callService.isVideoOff() ? 'video-off' : 'video'" [size]="20"></app-icon>
          </button>

          <!-- Screen Share toggle (only on video calls) -->
          <button
            *ngIf="callService.activeCall()?.callType === 'video'"
            type="button"
            (click)="callService.toggleScreenShare()"
            class="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200"
            [ngClass]="{
              'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/25': callService.isScreenSharing(),
              'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700': !callService.isScreenSharing()
            }"
            [title]="callService.isScreenSharing() ? 'Stop sharing screen' : 'Share screen'"
          >
            <app-icon name="monitor" [size]="20"></app-icon>
          </button>

          <!-- End Call Button -->
          <button
            type="button"
            (click)="callService.endCall()"
            class="px-6 h-12 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all duration-200 hover:scale-105"
          >
            <app-icon name="phone-off" [size]="18"></app-icon>
            <span>End Call</span>
          </button>
        </div>
      </div>

      <!-- 2. Idle State: Header & Overview -->
      <div *ngIf="!callService.isInCall()" class="space-y-6">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">1-on-1 Voice & Video Sessions</h1>
            <p class="text-sm text-slate-500 mt-1">
              Conduct live mock interviews, resume feedback, and behavioral practice with alumni mentors.
            </p>
          </div>

          <button
            type="button"
            (click)="startTestCall()"
            class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-blue-500/20 flex items-center gap-2 self-start sm:self-auto transition-all"
          >
            <app-icon name="video" [size]="16"></app-icon>
            Test Video Call
          </button>
        </div>

        <!-- Quick Call With Mentors -->
        <div class="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-4">
          <h3 class="text-base font-bold text-slate-900">Available Mentors for Quick Call</h3>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              *ngFor="let mentor of alumniService.availableMentors().slice(0, 3)"
              class="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-purple-200 hover:shadow-md transition-all flex items-center justify-between"
            >
              <div class="flex items-center gap-3 min-w-0">
                <img
                  [src]="mentor.profilePhoto"
                  class="w-11 h-11 rounded-full object-cover border border-slate-200"
                />
                <div class="min-w-0">
                  <h4 class="text-xs font-bold text-slate-900 truncate">{{ mentor.fullName }}</h4>
                  <p class="text-[11px] text-purple-700 truncate font-medium">{{ mentor.company }}</p>
                </div>
              </div>

              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  (click)="startCallWith(mentor, 'audio')"
                  class="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  title="Voice Call"
                >
                  <app-icon name="phone" [size]="15"></app-icon>
                </button>
                <button
                  type="button"
                  (click)="startCallWith(mentor, 'video')"
                  class="p-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 transition-colors"
                  title="Video Call"
                >
                  <app-icon name="video" [size]="15"></app-icon>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent Call Logs -->
        <div class="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div class="p-5 border-b border-slate-100">
            <h3 class="text-base font-bold text-slate-900">Recent Session History</h3>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th class="py-3.5 px-6">Participant</th>
                  <th class="py-3.5 px-6">Call Type</th>
                  <th class="py-3.5 px-6">Duration</th>
                  <th class="py-3.5 px-6">Date</th>
                  <th class="py-3.5 px-6">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr *ngFor="let row of callHistory()" class="hover:bg-slate-50/50 transition-colors">
                  <td class="py-4 px-6 font-semibold text-slate-900 flex items-center gap-3">
                    <img
                      [src]="row.peerAvatar || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(row.peerName) + '&background=7c3aed&color=fff&bold=true')"
                      class="w-8 h-8 rounded-full object-cover border border-slate-200"
                    />
                    <span>{{ row.peerName }}</span>
                  </td>
                  <td class="py-4 px-6">
                    <span class="inline-flex items-center gap-1 font-medium text-slate-700 capitalize">
                      <app-icon [name]="row.call_type === 'video' ? 'video' : 'phone'" [size]="14" [customClass]="row.call_type === 'video' ? 'text-blue-600' : 'text-purple-600'"></app-icon>
                      {{ row.call_type }} Session
                    </span>
                  </td>
                  <td class="py-4 px-6 font-mono text-slate-600">{{ formatHistoryDuration(row.duration_seconds) }}</td>
                  <td class="py-4 px-6 text-slate-500">{{ formatDate(row.created_at) }}</td>
                  <td class="py-4 px-6">
                    <app-badge [variant]="row.status === 'ended' || row.status === 'completed' ? 'success' : row.status === 'ringing' ? 'warning' : 'neutral'" [dot]="true">
                      {{ row.status | titlecase }}
                    </app-badge>
                  </td>
                </tr>

                <!-- Default sample rows if no calls in history yet -->
                <ng-container *ngIf="callHistory().length === 0">
                  <tr class="hover:bg-slate-50/50 transition-colors">
                    <td class="py-4 px-6 font-semibold text-slate-900 flex items-center gap-3">
                      <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80" class="w-8 h-8 rounded-full object-cover" />
                      <span>Priya Nair (Senior SDE @ Google)</span>
                    </td>
                    <td class="py-4 px-6">
                      <span class="inline-flex items-center gap-1 font-medium text-slate-700">
                        <app-icon name="video" [size]="14" customClass="text-blue-600"></app-icon>
                        1-on-1 Video Mock
                      </span>
                    </td>
                    <td class="py-4 px-6 font-mono text-slate-600">32m 45s</td>
                    <td class="py-4 px-6 text-slate-500">28 Sep 2026</td>
                    <td class="py-4 px-6">
                      <app-badge variant="success" [dot]="true">Completed</app-badge>
                    </td>
                  </tr>
                  <tr class="hover:bg-slate-50/50 transition-colors">
                    <td class="py-4 px-6 font-semibold text-slate-900 flex items-center gap-3">
                      <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80" class="w-8 h-8 rounded-full object-cover" />
                      <span>Karthik Raman (Azure @ Microsoft)</span>
                    </td>
                    <td class="py-4 px-6">
                      <span class="inline-flex items-center gap-1 font-medium text-slate-700">
                        <app-icon name="phone" [size]="14" customClass="text-purple-600"></app-icon>
                        Voice Mentoring
                      </span>
                    </td>
                    <td class="py-4 px-6 font-mono text-slate-600">18m 10s</td>
                    <td class="py-4 px-6 text-slate-500">24 Sep 2026</td>
                    <td class="py-4 px-6">
                      <app-badge variant="success" [dot]="true">Completed</app-badge>
                    </td>
                  </tr>
                </ng-container>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `
})
export class CallsComponent implements OnInit {
  callService = inject(CallService);
  alumniService = inject(AlumniService);
  authService = inject(AuthService);
  private supabase = inject(SupabaseService);
  private route = inject(ActivatedRoute);

  callHistory = signal<any[]>([]);
  encodeURIComponent = encodeURIComponent;

  @ViewChild('localVideoRef') localVideoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideoRef') remoteVideoRef?: ElementRef<HTMLVideoElement>;

  constructor() {
    // Reactively bind streams to in-page video elements whenever streams change
    effect(() => {
      const local = this.callService.localStream();
      if (this.localVideoRef?.nativeElement && local) {
        this.localVideoRef.nativeElement.srcObject = local;
      }
    });

    effect(() => {
      const remote = this.callService.remoteStream();
      if (this.remoteVideoRef?.nativeElement && remote) {
        this.remoteVideoRef.nativeElement.srcObject = remote;
      }
    });
  }

  ngOnInit() {
    this.handleQueryParams();
    this.loadCallHistory();
  }

  private handleQueryParams() {
    this.route.queryParams.subscribe(async params => {
      const peerId = params['peerId'];
      const initiate = params['initiate'];
      const callType = (params['callType'] || params['type'] || 'video') as 'audio' | 'video';

      if (initiate === 'true' && peerId) {
        if (this.callService.isInCall()) return;

        let name = 'Participant';
        let avatar: string | undefined = undefined;
        let role = 'alumni';

        const foundMentor = this.alumniService.alumni().find(a => a.userId === peerId);
        if (foundMentor) {
          name = foundMentor.fullName;
          avatar = foundMentor.profilePhoto;
          role = 'alumni';
        } else if (this.supabase.client) {
          try {
            const { data: u } = await this.supabase.client
              .from('users')
              .select('full_name, avatar_url, role')
              .eq('id', peerId)
              .maybeSingle();

            if (u) {
              name = u.full_name;
              avatar = u.avatar_url;
              role = u.role;
            }
          } catch {}
        }

        await this.callService.startCall({
          id: peerId,
          name,
          avatar,
          role
        }, callType);
      }
    });
  }

  async loadCallHistory() {
    const currentUserId = this.authService.currentUser()?.id;
    if (!currentUserId || !this.supabase.client) return;

    try {
      const { data, error } = await this.supabase.client
        .from('calls')
        .select('*')
        .or(`caller_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data && data.length > 0) {
        const mapped = data.map((c: any) => {
          const isCaller = c.caller_id === currentUserId;
          return {
            ...c,
            peerName: isCaller ? (c.receiver_name || 'Participant') : (c.caller_name || 'Participant'),
            peerAvatar: isCaller ? c.receiver_avatar : c.caller_avatar
          };
        });
        this.callHistory.set(mapped);
      }
    } catch {}
  }

  getPeerName(): string {
    const active = this.callService.activeCall();
    if (!active) return 'Participant';
    const currentUserId = this.authService.currentUser()?.id;
    return active.callerId === currentUserId ? active.receiverName : active.callerName;
  }

  getPeerAvatar(): string | undefined {
    const active = this.callService.activeCall();
    if (!active) return undefined;
    const currentUserId = this.authService.currentUser()?.id;
    return active.callerId === currentUserId ? active.receiverAvatar : active.callerAvatar;
  }

  getPeerRole(): string {
    const active = this.callService.activeCall();
    if (!active) return '';
    const currentUserId = this.authService.currentUser()?.id;
    return active.callerId === currentUserId ? (active.receiverRole || 'alumni') : (active.callerRole || 'student');
  }

  getPeerInitials(): string {
    const name = this.getPeerName();
    return (name || 'U').substring(0, 2).toUpperCase();
  }

  formatHistoryDuration(seconds?: number): string {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  startTestCall() {
    const mentor = this.alumniService.alumni()[0];
    if (!mentor) return;
    this.callService.startCall({
      id: mentor.userId,
      name: mentor.fullName,
      avatar: mentor.profilePhoto,
      role: 'alumni'
    }, 'video');
  }

  startCallWith(mentor: any, type: 'audio' | 'video') {
    this.callService.startCall({
      id: mentor.userId,
      name: mentor.fullName,
      avatar: mentor.profilePhoto,
      role: 'alumni'
    }, type);
  }
}
