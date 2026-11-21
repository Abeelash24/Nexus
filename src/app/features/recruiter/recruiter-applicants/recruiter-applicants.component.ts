import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RecruiterService } from '../../../core/services/recruiter.service';
import { StudentService } from '../../../core/services/student.service';
import { JobService } from '../../../core/services/job.service';
import { SkillMatchingService, SingleJobSkillMatch } from '../../../core/services/skill-matching.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../core/services/toast.service';
import { Application, ApplicationStatus } from '../../../core/models/application.model';
import { IconComponent } from '../../../shared/icons/icon.component';
import { BadgeComponent } from '../../../shared/ui/badge.component';

@Component({
  selector: 'app-recruiter-applicants',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, BadgeComponent],
  template: `
    <div class="space-y-6 animate-in fade-in duration-300 pb-12">
      <!-- Error Alert with Retry -->
      <div
        *ngIf="recruiterService.error()"
        class="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between shadow-xs animate-in fade-in"
      >
        <div class="flex items-center gap-2.5">
          <app-icon name="alert-triangle" [size]="18" customClass="text-rose-600 shrink-0"></app-icon>
          <div>
            <div class="text-xs font-bold text-rose-900">Failed to sync applicant pipeline</div>
            <div class="text-[11px] text-rose-700 mt-0.5">{{ recruiterService.error() }}</div>
          </div>
        </div>
        <button
          type="button"
          (click)="recruiterService.loadRecruiterData(true)"
          class="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-xs transition-colors shrink-0"
        >
          Retry
        </button>
      </div>

      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {{ recruiterService.recruiterCompanyName() }}
            </span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Candidate Recruitment Pipeline</h1>
          <p class="text-sm text-slate-500 mt-1">Review student applications, analyze candidate skill matches, shortlist profiles, and extend offers.</p>
        </div>
      </div>

      <!-- Filters & Search Toolbar -->
      <div class="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <input
              type="text"
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
              placeholder="Search candidate name, roll, or email..."
              class="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900"
            />
          </div>
          <div>
            <select
              [ngModel]="statusFilter()"
              (ngModelChange)="statusFilter.set($event)"
              class="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white"
            >
              <option value="all">All Pipeline Stages ({{ recruiterService.recruiterApplications().length }})</option>
              <option value="Applied">Applied</option>
              <option value="Shortlisted">Shortlisted</option>
              <option value="Technical Interview">Technical Interview</option>
              <option value="HR Interview">HR Interview</option>
              <option value="Selected">Selected</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
          <div>
            <select
              [ngModel]="deptFilter()"
              (ngModelChange)="deptFilter.set($event)"
              class="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white"
            >
              <option value="all">All Departments</option>
              <option value="Computer Science & Engineering">Computer Science & Engineering</option>
              <option value="Information Technology">Information Technology</option>
              <option value="Electronics & Communication">Electronics & Communication</option>
            </select>
          </div>
        </div>

        <div *ngIf="searchQuery() || statusFilter() !== 'all' || deptFilter() !== 'all'" class="flex justify-end pt-1">
          <button
            type="button"
            (click)="resetFilters()"
            class="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
          >
            Reset Candidate Filters
          </button>
        </div>
      </div>

      <!-- Applicants List -->
      <div class="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="border-b border-slate-200 text-slate-400 uppercase font-bold text-[10px] tracking-wider bg-slate-50/50">
                <th class="py-3 px-4 sm:px-6">Candidate Details</th>
                <th class="py-3 px-4">Applied Role</th>
                <th class="py-3 px-4">Skill Match %</th>
                <th class="py-3 px-4">Academic Score</th>
                <th class="py-3 px-4">Current Pipeline Stage</th>
                <th class="py-3 px-4 sm:px-6 text-right">Recruitment Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <!-- SKELETON ROWS -->
              <tr *ngIf="recruiterService.isLoading() && !recruiterService.isInitialized()">
                <td colspan="6" class="p-6">
                  <div class="space-y-4 animate-pulse">
                    <div *ngFor="let _ of [1,2,3,4]" class="flex items-center justify-between gap-4 py-2 border-b border-slate-100">
                      <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-slate-200"></div>
                        <div class="space-y-1.5">
                          <div class="h-3.5 w-32 bg-slate-200 rounded"></div>
                          <div class="h-2.5 w-48 bg-slate-100 rounded"></div>
                        </div>
                      </div>
                      <div class="h-4 w-28 bg-slate-200 rounded"></div>
                      <div class="h-4 w-16 bg-slate-200 rounded"></div>
                      <div class="h-4 w-12 bg-slate-200 rounded"></div>
                      <div class="h-6 w-20 bg-slate-100 rounded-full"></div>
                      <div class="h-8 w-24 bg-slate-200 rounded-xl"></div>
                    </div>
                  </div>
                </td>
              </tr>

              <!-- LOADED ROWS -->
              <ng-container *ngIf="!recruiterService.isLoading() || recruiterService.isInitialized()">
                <tr *ngFor="let app of filteredApplications()" class="hover:bg-slate-50/70 transition-colors">
                  <td class="py-4 px-4 sm:px-6">
                    <div class="flex items-center gap-3">
                      <img
                        *ngIf="app.studentAvatar"
                        [src]="app.studentAvatar"
                        class="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                      />
                      <div
                        *ngIf="!app.studentAvatar"
                        class="w-10 h-10 rounded-full bg-linear-to-br from-blue-600 to-indigo-700 text-white font-bold text-xs flex items-center justify-center border border-slate-200 shrink-0"
                      >
                        {{ app.studentName.charAt(0) || 'A' }}
                      </div>
                      <div>
                        <h4 class="font-bold text-slate-900 text-sm">{{ app.studentName }}</h4>
                        <p class="text-[11px] text-slate-500 font-mono">{{ app.studentRoll }} • {{ app.studentDepartment }}</p>
                      </div>
                    </div>
                  </td>

                  <td class="py-4 px-4">
                    <span class="font-bold text-slate-800">{{ app.jobTitle }}</span>
                    <span class="text-[11px] text-slate-400 block font-semibold">{{ app.salary }}</span>
                  </td>

                  <!-- Skill Match % Column -->
                  <td class="py-4 px-4">
                    @let match = getApplicantSkillMatch(app);
                    <div *ngIf="match.matchPercentage !== null" class="space-y-1">
                      <div class="flex items-center gap-1.5 font-black text-xs" [ngClass]="match.matchPercentage >= 75 ? 'text-emerald-700' : match.matchPercentage >= 50 ? 'text-blue-700' : 'text-amber-700'">
                        <span>{{ match.matchPercentage }}%</span>
                        <span class="text-[10px] text-slate-400 font-normal">({{ match.matchedSkills.length }}/{{ match.requiredSkills.length }})</span>
                      </div>
                      <div class="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          class="h-full rounded-full"
                          [ngClass]="match.matchPercentage >= 75 ? 'bg-emerald-500' : match.matchPercentage >= 50 ? 'bg-blue-600' : 'bg-amber-500'"
                          [style.width]="match.matchPercentage + '%'"
                        ></div>
                      </div>
                    </div>
                    <span *ngIf="match.matchPercentage === null" class="text-[10px] text-slate-400 italic">No skill reqs</span>
                  </td>

                  <td class="py-4 px-4">
                    <span class="font-extrabold text-blue-700 text-sm">{{ app.studentCgpa.toFixed(2) }}</span>
                    <span class="text-[11px] text-slate-400 font-semibold block">CGPA / 10.0</span>
                  </td>

                  <td class="py-4 px-4">
                    <app-badge [variant]="app.status === 'Selected' ? 'success' : app.status === 'Rejected' ? 'error' : app.status === 'Technical Interview' ? 'primary' : 'warning'">
                      {{ app.status }}
                    </app-badge>
                  </td>

                  <td class="py-4 px-4 sm:px-6 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        *ngIf="getResumeUrl(app)"
                        (click)="openApplicantResume(app)"
                        [disabled]="loadingResumeId() === app.id"
                        class="p-1.5 rounded-lg border border-slate-200 text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                        title="View Verified Student Resume"
                      >
                        <span *ngIf="loadingResumeId() === app.id" class="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin inline-block"></span>
                        <app-icon *ngIf="loadingResumeId() !== app.id" name="file-text" [size]="15"></app-icon>
                      </button>
                      <button
                        type="button"
                        (click)="openCandidateWithAiFit(app)"
                        class="px-2.5 py-1.5 rounded-lg bg-linear-to-r from-cyan-50 to-indigo-50 hover:from-cyan-100 hover:to-indigo-100 text-indigo-700 border border-indigo-200/80 font-bold text-xs flex items-center gap-1 transition-all shadow-2xs"
                        title="Evaluate Candidate Fit with Gemini AI"
                      >
                        <app-icon name="sparkles" [size]="13" customClass="text-indigo-600"></app-icon>
                        <span>AI Fit</span>
                      </button>
                      <button
                        type="button"
                        (click)="openUpdateStatusModal(app)"
                        class="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs transition-colors"
                      >
                        Update Stage
                      </button>
                      <button
                        type="button"
                        (click)="inspectCandidate(app)"
                        class="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                        title="Inspect Candidate"
                      >
                        <app-icon name="eye" [size]="15"></app-icon>
                      </button>
                    </div>
                  </td>
                </tr>

                <!-- EMPTY STATE: NO MATCHING FILTERS -->
                <tr *ngIf="filteredApplications().length === 0 && recruiterService.recruiterApplications().length > 0">
                  <td colspan="6" class="py-12 text-center text-slate-500">
                    <p class="font-bold text-slate-600">No candidates match the specified filters.</p>
                    <p class="text-xs text-slate-400 mt-1">Try adjusting keywords, stage, or department filters.</p>
                    <button
                      type="button"
                      (click)="resetFilters()"
                      class="mt-2.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                      Clear Filters
                    </button>
                  </td>
                </tr>

                <!-- EMPTY STATE: ZERO TOTAL APPLICANTS -->
                <tr *ngIf="recruiterService.recruiterApplications().length === 0">
                  <td colspan="6" class="py-16 text-center text-slate-500">
                    <div class="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                      <app-icon name="users" [size]="24"></app-icon>
                    </div>
                    <h3 class="font-bold text-slate-800 text-sm">No Student Applications Found for {{ recruiterService.recruiterCompanyName() }}</h3>
                    <p class="text-xs text-slate-400 max-w-md mx-auto mt-1">
                      Candidates who apply to your active campus drives will immediately appear here with automated skill match scores and pipeline stages.
                    </p>
                  </td>
                </tr>
              </ng-container>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Update Stage Modal -->
      <div *ngIf="selectedAppForStage" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
        <div class="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 class="text-base font-bold text-slate-900">Update Candidate Stage</h3>
            <button (click)="selectedAppForStage = null" class="p-1 text-slate-400 hover:text-slate-600">
              <app-icon name="x" [size]="20"></app-icon>
            </button>
          </div>

          <div class="space-y-3 text-xs">
            <div>
              <span class="text-slate-400 uppercase font-bold text-[10px]">Candidate</span>
              <div class="font-bold text-slate-900 text-sm mt-0.5">{{ selectedAppForStage.studentName }} ({{ selectedAppForStage.jobTitle }})</div>
            </div>

            <div>
              <label class="block font-semibold text-slate-700">Next Stage</label>
              <select [(ngModel)]="newStageStatus" class="w-full px-3 py-2 mt-1 rounded-xl border border-slate-200 bg-white text-sm font-semibold">
                <option value="Applied">Applied (Initial Review)</option>
                <option value="Shortlisted">Shortlisted</option>
                <option value="Aptitude">Aptitude Assessment Round</option>
                <option value="Technical Interview">Technical Interview</option>
                <option value="HR Interview">HR & Leadership Interview</option>
                <option value="Selected">Selected (Extend Offer)</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <div>
              <label class="block font-semibold text-slate-700">Recruitment Notes & Feedback</label>
              <textarea [(ngModel)]="stageNotes" rows="2" placeholder="e.g. Cleared Round 1 DSA assessment with high score. Scheduling system design interview." class="w-full px-3 py-2 mt-1 rounded-xl border border-slate-200"></textarea>
            </div>

            <div>
              <label class="block font-semibold text-slate-700">Meeting / Video Link (Optional)</label>
              <input type="text" [(ngModel)]="stageLink" placeholder="https://meet.google.com/..." class="w-full px-3 py-2 mt-1 rounded-xl border border-slate-200" />
            </div>
          </div>

          <div class="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button type="button" (click)="selectedAppForStage = null" class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
            <button type="button" (click)="confirmStageUpdate()" class="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs">Save Stage</button>
          </div>
        </div>
      </div>

      <!-- Candidate Inspection Drawer -->
      <div *ngIf="inspectingApp" class="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs">
        <div class="w-full max-w-lg bg-white h-full shadow-2xl p-6 sm:p-8 overflow-y-auto space-y-6 animate-in slide-in-from-right duration-300 custom-scrollbar">
          <div class="flex items-center justify-between pb-4 border-b border-slate-100">
            <div class="flex items-center gap-3">
              <img
                *ngIf="inspectingApp.studentAvatar"
                [src]="inspectingApp.studentAvatar"
                class="w-12 h-12 rounded-full object-cover border border-slate-200 shrink-0"
              />
              <div
                *ngIf="!inspectingApp.studentAvatar"
                class="w-12 h-12 rounded-full bg-linear-to-br from-blue-600 to-indigo-700 text-white font-bold text-sm flex items-center justify-center border border-slate-200 shrink-0"
              >
                {{ inspectingApp.studentName.charAt(0) || 'A' }}
              </div>
              <div>
                <h3 class="text-base font-bold text-slate-900">{{ inspectingApp.studentName }}</h3>
                <p class="text-xs text-slate-500 font-mono">{{ inspectingApp.studentRoll }} • {{ inspectingApp.studentDepartment }}</p>
              </div>
            </div>
            <button (click)="inspectingApp = null" class="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100">
              <app-icon name="x" [size]="20"></app-icon>
            </button>
          </div>

          <div class="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
            <div>
              <div class="text-[10px] uppercase font-bold text-slate-400">CGPA</div>
              <div class="text-lg font-black text-blue-700 mt-0.5">{{ inspectingApp.studentCgpa.toFixed(2) }}</div>
            </div>
            <div>
              <div class="text-[10px] uppercase font-bold text-slate-400">Current Status</div>
              <div class="text-xs font-bold text-slate-800 mt-1.5">{{ inspectingApp.status }}</div>
            </div>
          </div>

          <!-- Resume Document Preview / Action -->
          <div class="flex items-center justify-between p-3.5 rounded-2xl bg-blue-50/50 border border-blue-100">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <app-icon name="file-text" [size]="16"></app-icon>
              </div>
              <div>
                <div class="font-bold text-slate-900 text-xs">Curriculum Vitae (CV)</div>
                <div class="text-[10px] text-slate-500">{{ inspectingApp.studentEmail }}</div>
              </div>
            </div>
            <button
              type="button"
              *ngIf="getResumeUrl(inspectingApp)"
              (click)="openApplicantResume(inspectingApp)"
              [disabled]="loadingResumeId() === inspectingApp.id"
              class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-60"
            >
              <span *ngIf="loadingResumeId() === inspectingApp.id" class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block"></span>
              <app-icon *ngIf="loadingResumeId() !== inspectingApp.id" name="file-text" [size]="12"></app-icon>
              View Resume
            </button>
            <span *ngIf="!getResumeUrl(inspectingApp)" class="text-[11px] text-slate-400 italic">No resume URL</span>
          </div>

          <!-- ✨ AI Candidate Fit Summary (Gemini + Edge Function) -->
          <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-5 text-white border border-cyan-500/30 shadow-xl shadow-cyan-950/20 backdrop-blur-md space-y-3.5">
            <!-- Decorative Electric Cyan & Orchid Glow Orbs -->
            <div class="absolute -right-8 -top-8 w-36 h-36 bg-cyan-500/15 rounded-full blur-2xl pointer-events-none"></div>
            <div class="absolute -left-8 -bottom-8 w-36 h-36 bg-fuchsia-500/15 rounded-full blur-2xl pointer-events-none"></div>

            <!-- Header -->
            <div class="relative z-10 flex items-center justify-between pb-2.5 border-b border-white/10">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-400 to-fuchsia-500 p-0.5 shadow-xs">
                  <div class="w-full h-full bg-slate-950 rounded-[5px] flex items-center justify-center">
                    <app-icon name="sparkles" [size]="13" customClass="text-cyan-300"></app-icon>
                  </div>
                </div>
                <div>
                  <h4 class="text-xs font-extrabold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-fuchsia-300">
                    ✨ AI Candidate Fit Summary
                  </h4>
                  <span class="text-[10px] text-cyan-200/70 font-mono">Gemini 2.5 Flash • 2-Sentence Evaluation</span>
                </div>
              </div>

              <!-- Top Action / Trigger -->
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  *ngIf="currentAiFitSummary()"
                  (click)="copyFitSummary()"
                  class="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] text-cyan-200 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Copy AI Summary"
                >
                  <app-icon name="copy" [size]="12"></app-icon>
                  <span>{{ hasCopiedSummary() ? 'Copied!' : 'Copy' }}</span>
                </button>
                <button
                  type="button"
                  (click)="generateAiFitSummary(inspectingApp, true)"
                  [disabled]="isGeneratingAiFit()"
                  class="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-[11px] font-semibold border border-cyan-400/30 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                  title="Generate or Regenerate with Gemini"
                >
                  <span *ngIf="isGeneratingAiFit()" class="w-3 h-3 border-2 border-cyan-300 border-t-transparent rounded-full animate-spin inline-block"></span>
                  <app-icon *ngIf="!isGeneratingAiFit()" name="sparkles" [size]="12"></app-icon>
                  <span>{{ isGeneratingAiFit() ? 'Analyzing...' : (currentAiFitSummary() ? 'Regenerate' : 'Generate AI Insight') }}</span>
                </button>
              </div>
            </div>

            <!-- Loading State: Shimmer Effect -->
            <div *ngIf="isGeneratingAiFit()" class="relative z-10 p-4 rounded-xl bg-slate-900/70 border border-cyan-500/20 space-y-3">
              <div class="flex items-center gap-2 text-cyan-300 text-xs font-semibold">
                <span class="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin inline-block"></span>
                <span>Consulting Gemini AI Recruiter...</span>
              </div>
              <div class="space-y-2 pt-1 animate-pulse">
                <div class="h-3 bg-gradient-to-r from-cyan-500/20 via-slate-700/50 to-cyan-500/10 rounded-md w-full border border-cyan-500/10"></div>
                <div class="h-3 bg-gradient-to-r from-cyan-500/20 via-slate-700/50 to-cyan-500/10 rounded-md w-11/12 border border-cyan-500/10"></div>
                <div class="h-3 bg-gradient-to-r from-cyan-500/20 via-slate-700/50 to-cyan-500/10 rounded-md w-4/5 border border-cyan-500/10"></div>
              </div>
            </div>

            <!-- Generated Fit Summary Display -->
            <div *ngIf="!isGeneratingAiFit() && currentAiFitSummary()" class="relative z-10 space-y-3">
              <div class="p-3.5 rounded-xl bg-slate-900/80 border border-cyan-500/25 space-y-2.5">
                <div class="flex items-center justify-between">
                  <span
                    class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1"
                    [ngClass]="{
                      'bg-emerald-500/20 text-emerald-300 border-emerald-400/30': currentAiFitSummary()?.match_level === 'High Fit',
                      'bg-cyan-500/20 text-cyan-300 border-cyan-400/30': currentAiFitSummary()?.match_level === 'Moderate Fit',
                      'bg-amber-500/20 text-amber-300 border-amber-400/30': currentAiFitSummary()?.match_level === 'Needs Review'
                    }"
                  >
                    <span class="w-1.5 h-1.5 rounded-full" [ngClass]="{
                      'bg-emerald-400': currentAiFitSummary()?.match_level === 'High Fit',
                      'bg-cyan-400': currentAiFitSummary()?.match_level === 'Moderate Fit',
                      'bg-amber-400': currentAiFitSummary()?.match_level === 'Needs Review'
                    }"></span>
                    {{ currentAiFitSummary()?.match_level }} ({{ currentAiFitSummary()?.match_percentage }}% Match)
                  </span>
                  <span class="text-[10px] text-slate-400 font-mono">
                    {{ currentAiFitSummary()?.source === 'gemini' ? 'Gemini Verified' : 'Realtime Engine' }}
                  </span>
                </div>

                <p class="text-xs sm:text-[13px] leading-relaxed text-slate-100 font-normal">
                  {{ currentAiFitSummary()?.summary }}
                </p>

                <!-- Breakdown: Strong Matches & Key Gaps -->
                <div class="pt-2 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div *ngIf="currentAiFitSummary()?.matched_skills?.length" class="space-y-1">
                    <span class="text-[10px] uppercase font-bold text-cyan-300 tracking-wider">Strong Alignments:</span>
                    <div class="flex flex-wrap gap-1">
                      <span *ngFor="let s of currentAiFitSummary()?.matched_skills?.slice(0, 4)" class="px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/25 text-cyan-200 text-[10px] font-semibold">
                        ✓ {{ s }}
                      </span>
                    </div>
                  </div>
                  <div *ngIf="currentAiFitSummary()?.missing_skills?.length" class="space-y-1">
                    <span class="text-[10px] uppercase font-bold text-fuchsia-300 tracking-wider">Potential Gaps:</span>
                    <div class="flex flex-wrap gap-1">
                      <span *ngFor="let s of currentAiFitSummary()?.missing_skills?.slice(0, 4)" class="px-1.5 py-0.5 rounded bg-fuchsia-500/15 border border-fuchsia-400/25 text-fuchsia-200 text-[10px] font-semibold">
                        ⚠ {{ s }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Initial Idle State (if summary not generated yet) -->
            <div *ngIf="!isGeneratingAiFit() && !currentAiFitSummary()" class="relative z-10 p-4 rounded-xl bg-slate-900/60 border border-cyan-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div class="space-y-0.5 text-center sm:text-left">
                <div class="text-xs font-bold text-white flex items-center justify-center sm:justify-start gap-1.5">
                  <span>Candidate Fit Evaluation Available</span>
                </div>
                <p class="text-[11px] text-slate-300">
                  Generate an instant 2-sentence screening report analyzing candidate skills against {{ inspectingApp.jobTitle }} requirements.
                </p>
              </div>
              <button
                type="button"
                (click)="generateAiFitSummary(inspectingApp)"
                class="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-cyan-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <app-icon name="sparkles" [size]="14"></app-icon>
                <span>Generate AI Insight</span>
              </button>
            </div>
          </div>

          <!-- Skill Matching & Gap Evaluation for Recruiter -->
          @let match = getApplicantSkillMatch(inspectingApp);
          <div class="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
            <div class="flex items-center justify-between pb-2 border-b border-slate-200/60">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <app-icon name="award" [size]="14" customClass="text-blue-600"></app-icon>
                Skill Match Evaluation
              </span>
              <span
                *ngIf="match.matchPercentage !== null"
                class="text-sm font-black"
                [ngClass]="match.matchPercentage >= 75 ? 'text-emerald-700' : match.matchPercentage >= 50 ? 'text-blue-700' : 'text-amber-700'"
              >
                {{ match.matchPercentage }}% Match
              </span>
            </div>

            <div *ngIf="match.matchPercentage !== null" class="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                [ngClass]="match.matchPercentage >= 75 ? 'bg-emerald-500' : match.matchPercentage >= 50 ? 'bg-blue-600' : 'bg-amber-500'"
                [style.width]="match.matchPercentage + '%'"
              ></div>
            </div>

            <!-- Job Required Skills -->
            <div>
              <span class="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">Job Required Skills ({{ match.requiredSkills.length }}):</span>
              <div class="flex flex-wrap gap-1">
                <span *ngFor="let s of match.requiredSkills" class="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-slate-800">
                  {{ s }}
                </span>
                <span *ngIf="match.requiredSkills.length === 0" class="text-xs text-slate-400 italic">No specific skill requirements defined.</span>
              </div>
            </div>

            <!-- Student Skills -->
            <div>
              <span class="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">Student Profile Skills ({{ match.studentSkills.length }}):</span>
              <div class="flex flex-wrap gap-1">
                <span *ngFor="let s of match.studentSkills" class="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-[11px] font-semibold text-blue-800">
                  {{ s }}
                </span>
                <span *ngIf="match.studentSkills.length === 0" class="text-xs text-amber-700 italic">No skills listed on profile.</span>
              </div>
            </div>

            <!-- Matched Skills (✓) -->
            <div *ngIf="match.matchedSkills.length > 0">
              <span class="text-[10px] uppercase font-bold text-emerald-800 block mb-1.5">Matched Skills:</span>
              <div class="flex flex-wrap gap-1">
                <span *ngFor="let s of match.matchedSkills" class="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800">
                  ✓ {{ s }}
                </span>
              </div>
            </div>

            <!-- Missing Skills (⚠) -->
            <div *ngIf="match.missingSkills.length > 0">
              <span class="text-[10px] uppercase font-bold text-rose-800 block mb-1.5">Missing Requirements:</span>
              <div class="flex flex-wrap gap-1">
                <span *ngFor="let s of match.missingSkills" class="px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-[11px] font-bold text-rose-800">
                  ⚠ {{ s }}
                </span>
              </div>
            </div>
          </div>

          <!-- Application Timeline History -->
          <div>
            <h4 class="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Recruitment Timeline History</h4>
            <div class="space-y-2.5">
              <div *ngFor="let t of inspectingApp.timeline" class="p-3 rounded-xl border border-slate-200 bg-white text-xs space-y-1">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-blue-700">{{ t.status }}</span>
                  <span class="text-[10px] text-slate-400">{{ t.date }}</span>
                </div>
                <p class="text-slate-600 text-[11px]">{{ t.notes }}</p>
                <a *ngIf="t.locationOrLink" [href]="t.locationOrLink" target="_blank" class="text-blue-600 hover:underline text-[11px] font-semibold block">
                  Link: {{ t.locationOrLink }}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class RecruiterApplicantsComponent implements OnInit {
  recruiterService = inject(RecruiterService);
  studentService = inject(StudentService);
  jobService = inject(JobService);
  skillMatchingService = inject(SkillMatchingService);
  supabase = inject(SupabaseService);
  toast = inject(ToastService);

  searchQuery = signal('');
  statusFilter = signal('all');
  deptFilter = signal('all');
  loadingResumeId = signal<string | null>(null);

  selectedAppForStage: Application | null = null;
  newStageStatus: ApplicationStatus = 'Shortlisted';
  stageNotes = '';
  stageLink = '';

  inspectingApp: Application | null = null;

  // AI Fit Summary State
  aiFitSummaries = signal<Record<string, {
    summary: string;
    match_percentage: number;
    match_level: string;
    matched_skills: string[];
    missing_skills: string[];
    source?: string;
  }>>({});
  isGeneratingAiFit = signal<boolean>(false);
  hasCopiedSummary = signal<boolean>(false);

  currentAiFitSummary = computed(() => {
    const app = this.inspectingApp;
    if (!app) return null;
    return this.aiFitSummaries()[app.id] || null;
  });

  ngOnInit(): void {
    this.recruiterService.loadRecruiterData();
  }

  getResumeUrl(app: Application | null): string | null {
    if (!app) return null;
    if (app.studentResumeUrl) return app.studentResumeUrl;
    const student = this.studentService.students().find(
      s => s.id === app.studentId || s.userId === app.studentId
    );
    return student?.resumeUrl || null;
  }

  async openApplicantResume(app: Application | null) {
    if (!app) return;
    const rawUrl = this.getResumeUrl(app);
    if (!rawUrl) return;

    this.loadingResumeId.set(app.id);
    try {
      if (this.supabase.isConfigured) {
        const signedUrl = await this.supabase.createSignedUrl('resumes', rawUrl, 3600);
        if (signedUrl) {
          window.open(signedUrl, '_blank');
          return;
        }
      }

      if (rawUrl.startsWith('http') || rawUrl.startsWith('blob:')) {
        window.open(rawUrl, '_blank');
      }
    } finally {
      this.loadingResumeId.set(null);
    }
  }

  getApplicantSkillMatch(app: Application): SingleJobSkillMatch {
    const student = this.studentService.students().find(
      s => s.id === app.studentId || s.userId === app.studentId
    ) || this.studentService.currentStudent();

    const job = this.jobService.jobs().find(j => j.id === app.jobId) || {
      id: app.jobId,
      companyId: app.companyId,
      companyName: app.companyName,
      companyLogo: app.companyLogo,
      companyLocation: 'Bengaluru',
      title: app.jobTitle,
      description: '',
      domain: 'Software Development',
      location: 'Bengaluru',
      employmentType: 'Full Time',
      salary: app.salary,
      eligibility: 'B.Tech',
      minimumCgpa: 7.0,
      requiredSkills: ['Java', 'SQL', 'Git', 'REST API', 'Spring Boot'],
      applicationDeadline: new Date().toISOString(),
      status: 'Active',
      vacancies: 5,
      applicantsCount: 1,
      createdAt: app.appliedAt,
      updatedAt: app.updatedAt
    };

    return this.skillMatchingService.calculateJobSkillMatch(student, job, app);
  }

  filteredApplications = computed(() => {
    let list = this.recruiterService.recruiterApplications();
    const q = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();
    const dept = this.deptFilter();

    if (status !== 'all') {
      list = list.filter(a => a.status === status);
    }
    if (dept !== 'all') {
      list = list.filter(a => a.studentDepartment === dept);
    }
    if (q) {
      list = list.filter(
        a =>
          a.studentName.toLowerCase().includes(q) ||
          a.studentRoll.toLowerCase().includes(q) ||
          a.studentEmail.toLowerCase().includes(q) ||
          a.jobTitle.toLowerCase().includes(q)
      );
    }
    return list;
  });

  openUpdateStatusModal(app: Application) {
    this.selectedAppForStage = app;
    this.newStageStatus = app.status;
    this.stageNotes = '';
    this.stageLink = '';
  }

  async confirmStageUpdate() {
    if (!this.selectedAppForStage) return;
    await this.recruiterService.updateCandidateStatus(
      this.selectedAppForStage.id,
      this.newStageStatus,
      this.stageNotes,
      this.stageLink
    );
    this.selectedAppForStage = null;
  }

  inspectCandidate(app: Application) {
    this.inspectingApp = app;
    // Auto-fetch AI fit summary if not already generated
    if (!this.aiFitSummaries()[app.id]) {
      this.generateAiFitSummary(app);
    }
  }

  openCandidateWithAiFit(app: Application) {
    this.inspectCandidate(app);
  }

  async generateAiFitSummary(app: Application, force = false) {
    if (!app) return;
    if (!force && this.aiFitSummaries()[app.id]) return;

    this.isGeneratingAiFit.set(true);
    this.hasCopiedSummary.set(false);

    try {
      const match = this.getApplicantSkillMatch(app);
      const studentSkills = (match.studentSkills && match.studentSkills.length > 0)
        ? match.studentSkills
        : ['Java', 'SQL', 'Git', 'Data Structures'];

      const jobRequirements = (match.requiredSkills && match.requiredSkills.length > 0)
        ? match.requiredSkills
        : ['Java', 'REST API', 'SQL', 'Git'];

      const res = await this.recruiterService.generateFitSummary({
        student_skills: studentSkills,
        job_requirements: jobRequirements,
        job_title: app.jobTitle,
        candidate_name: app.studentName,
        student_cgpa: app.studentCgpa
      });

      if (res && res.success && res.summary) {
        this.aiFitSummaries.update(map => ({
          ...map,
          [app.id]: {
            summary: res.summary,
            match_percentage: res.match_percentage ?? match.matchPercentage ?? 75,
            match_level: res.match_level ?? ((match.matchPercentage && match.matchPercentage >= 75) ? 'High Fit' : 'Moderate Fit'),
            matched_skills: res.matched_skills ?? match.matchedSkills,
            missing_skills: res.missing_skills ?? match.missingSkills,
            source: res.source
          }
        }));
      }
    } catch (err) {
      console.warn('Could not generate AI fit summary:', err);
    } finally {
      this.isGeneratingAiFit.set(false);
    }
  }

  async copyFitSummary() {
    const summary = this.currentAiFitSummary()?.summary;
    if (!summary) return;

    try {
      await navigator.clipboard.writeText(summary);
      this.hasCopiedSummary.set(true);
      this.toast.success('Copied to Clipboard! ✨', 'AI fit summary copied.');
      setTimeout(() => this.hasCopiedSummary.set(false), 2500);
    } catch {
      this.toast.info('AI Fit Summary', summary);
    }
  }

  resetFilters() {
    this.searchQuery.set('');
    this.statusFilter.set('all');
    this.deptFilter.set('all');
  }
}
