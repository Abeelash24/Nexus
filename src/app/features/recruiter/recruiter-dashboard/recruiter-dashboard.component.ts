import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RecruiterService } from '../../../core/services/recruiter.service';
import { JobService } from '../../../core/services/job.service';
import { IconComponent } from '../../../shared/icons/icon.component';
import { StatCardComponent } from '../../../shared/ui/stat-card.component';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-recruiter-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent, StatCardComponent],
  template: `
    <div class="space-y-8 animate-in fade-in duration-300 pb-12">
      <!-- Error Alert with Retry -->
      <div
        *ngIf="recruiterService.error()"
        class="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between shadow-xs animate-in fade-in"
      >
        <div class="flex items-center gap-2.5">
          <app-icon name="alert-triangle" [size]="18" customClass="text-rose-600 shrink-0"></app-icon>
          <div>
            <div class="text-xs font-bold text-rose-900">Failed to sync recruiter workspace data</div>
            <div class="text-[11px] text-rose-700 mt-0.5">{{ recruiterService.error() }}</div>
          </div>
        </div>
        <button
          type="button"
          (click)="recruiterService.loadRecruiterData(true)"
          class="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-xs transition-colors shrink-0"
        >
          Retry Loading
        </button>
      </div>

      <!-- Top Recruiter Welcome Hero with Company Logo -->
      <div class="bg-linear-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-blue-500/15 relative overflow-hidden">
        <div class="absolute right-0 top-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

        <div class="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <!-- Company Logo Badge with Edit Trigger -->
            <div class="relative group shrink-0">
              <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/15 p-1 backdrop-blur-md border border-white/25 shadow-lg overflow-hidden flex items-center justify-center">
                <img
                  *ngIf="recruiterService.companyLogo()"
                  [src]="recruiterService.companyLogo()"
                  [alt]="recruiterService.recruiterCompanyName()"
                  (error)="onLogoError($event)"
                  class="w-full h-full object-cover rounded-xl bg-white"
                />
                <div
                  *ngIf="!recruiterService.companyLogo()"
                  class="w-full h-full rounded-xl bg-white/20 flex items-center justify-center text-white font-black text-2xl"
                >
                  {{ recruiterService.recruiterCompanyName().charAt(0) }}
                </div>
              </div>
              <button
                type="button"
                (click)="openLogoModal()"
                class="absolute -bottom-1.5 -right-1.5 p-1.5 rounded-lg bg-white text-slate-800 shadow-md hover:bg-slate-100 hover:scale-110 transition-all cursor-pointer"
                title="Change Company Logo"
              >
                <app-icon name="image" [size]="13" customClass="text-indigo-600"></app-icon>
              </button>
            </div>

            <div>
              <div class="flex flex-wrap items-center gap-2 mb-2">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 text-white backdrop-blur-xs border border-white/20">
                  <app-icon name="building" [size]="14"></app-icon>
                  {{ recruiterService.recruiterCompanyName() }} Talent Acquisition Portal
                </span>
                <button
                  type="button"
                  (click)="openLogoModal()"
                  class="text-[11px] font-semibold text-blue-200 hover:text-white underline underline-offset-2 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <app-icon name="edit-2" [size]="11"></app-icon>
                  Edit Brand Logo
                </button>
              </div>
              <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Recruiter & Hiring Workspace
              </h1>
              <p class="text-blue-100 text-sm sm:text-base mt-1.5 max-w-xl leading-relaxed">
                Track student candidate pipelines, schedule technical interview rounds, manage job descriptions, and roll out verified placement offers.
              </p>
            </div>
          </div>

          <div class="flex flex-wrap gap-2.5 sm:gap-3">
            <button
              type="button"
              (click)="openLogoModal()"
              class="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold text-xs sm:text-sm border border-white/25 backdrop-blur-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <app-icon name="image" [size]="15"></app-icon>
              Manage Logo
            </button>
            <a
              routerLink="/recruiter/drives"
              class="px-5 py-2.5 rounded-xl bg-white text-blue-700 font-semibold text-xs sm:text-sm hover:bg-blue-50 shadow-md transition-all hover:scale-[1.02] flex items-center gap-1.5"
            >
              <app-icon name="plus" [size]="15"></app-icon>
              + Create Placement Drive
            </a>
            <a
              routerLink="/recruiter/jobs"
              class="px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-semibold text-xs sm:text-sm border border-white/30 backdrop-blur-xs transition-all"
            >
              Post Job Opening
            </a>
            <a
              routerLink="/recruiter/applicants"
              class="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm border border-white/20 backdrop-blur-xs transition-all"
            >
              Review Pipeline ({{ recruiterService.totalApplicants() }})
            </a>
          </div>
        </div>
      </div>

      <!-- SKELETON LOADING STATE FOR STATS -->
      <div *ngIf="recruiterService.isLoading() && !recruiterService.isInitialized()" class="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div *ngFor="let _ of [1,2,3,4]" class="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs animate-pulse space-y-3">
          <div class="flex items-center justify-between">
            <div class="h-3 w-24 bg-slate-200 rounded"></div>
            <div class="w-10 h-10 rounded-xl bg-slate-100"></div>
          </div>
          <div class="h-8 w-16 bg-slate-200 rounded mt-2"></div>
          <div class="h-3 w-32 bg-slate-100 rounded"></div>
        </div>
      </div>

      <!-- 4 Key Hiring Metrics Cards (LOADED) -->
      <div *ngIf="!recruiterService.isLoading() || recruiterService.isInitialized()" class="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <app-stat-card
          title="Placement Drives"
          [value]="recruiterService.publishedDrivesCount()"
          icon="calendar"
          subtitle="Live on-campus drives"
          color="blue"
        ></app-stat-card>

        <app-stat-card
          title="Active Job Openings"
          [value]="recruiterService.activeJobsCount()"
          icon="briefcase"
          subtitle="Open for student applications"
          color="indigo"
        ></app-stat-card>

        <app-stat-card
          title="Total Applicants"
          [value]="recruiterService.totalApplicants()"
          icon="users"
          subtitle="Applied to your positions"
          color="purple"
        ></app-stat-card>

        <app-stat-card
          title="Shortlisted Candidates"
          [value]="recruiterService.shortlistedCount()"
          icon="check-circle"
          subtitle="Resume screening cleared"
          color="emerald"
        ></app-stat-card>
      </div>

      <!-- Active Placement Drives & Pipeline Overview -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Active Drives List (2 cols) -->
        <div class="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-bold text-slate-900">Active Placement Drives</h3>
              <p class="text-xs text-slate-500">Live recruitment schedules and campus hiring waves</p>
            </div>
            <a routerLink="/recruiter/drives" class="text-xs font-semibold text-blue-600 hover:underline">
              Manage All Drives →
            </a>
          </div>

          <!-- SKELETON FOR DRIVES -->
          <div *ngIf="recruiterService.isLoading() && !recruiterService.isInitialized()" class="space-y-4">
            <div *ngFor="let _ of [1,2]" class="p-5 rounded-2xl border border-slate-100 bg-slate-50 animate-pulse space-y-3">
              <div class="flex justify-between items-center">
                <div class="h-4 w-40 bg-slate-200 rounded"></div>
                <div class="h-4 w-16 bg-slate-200 rounded"></div>
              </div>
              <div class="h-3 w-64 bg-slate-200 rounded"></div>
            </div>
          </div>

          <!-- LOADED DRIVES -->
          <div *ngIf="!recruiterService.isLoading() || recruiterService.isInitialized()" class="space-y-4">
            <div
              *ngFor="let drive of recruiterService.recruiterDrives().slice(0, 4)"
              class="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-200 hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div class="flex items-start sm:items-center gap-3.5">
                <!-- Banner + Overlapping Logo Thumbnail -->
                <div class="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-200 shrink-0 border border-slate-200">
                  <img
                    *ngIf="drive.bannerUrl"
                    [src]="drive.bannerUrl"
                    alt="Drive Banner"
                    class="w-full h-full object-cover"
                  />
                  <div *ngIf="!drive.bannerUrl" class="w-full h-full bg-linear-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                    {{ drive.companyName.charAt(0) }}
                  </div>
                  <!-- Overlapping 1:1 Company Logo Avatar in Corner -->
                  <div class="absolute bottom-1 right-1 w-6 h-6 rounded-md bg-white border border-slate-200 shadow-xs overflow-hidden">
                    <img
                      [src]="drive.companyLogo || recruiterService.companyLogo()"
                      [alt]="drive.companyName"
                      (error)="onLogoError($event)"
                      class="w-full h-full object-cover"
                    />
                  </div>
                </div>

                <div class="space-y-1">
                  <div class="flex items-center gap-2">
                    <h4 class="text-sm font-bold text-slate-900">{{ drive.title }}</h4>
                    <span
                      class="px-2 py-0.5 rounded text-[10px] font-bold"
                      [ngClass]="{
                        'bg-emerald-100 text-emerald-800': drive.status === 'Published' || drive.status === 'Applications Open',
                        'bg-amber-100 text-amber-800': drive.status === 'Draft',
                        'bg-slate-100 text-slate-800': drive.status === 'Closed'
                      }"
                    >
                      {{ drive.status }}
                    </span>
                  </div>
                  <p class="text-xs text-slate-500 font-medium">
                    {{ drive.jobRole || drive.roleDesignation }} • {{ drive.location }} • Min CGPA: {{ drive.minimumCgpa }} • Package: <strong class="text-slate-800">{{ drive.salaryCtc }}</strong>
                  </p>
                  <div class="flex flex-wrap gap-1 mt-1">
                    <span *ngFor="let sk of drive.requiredSkills.slice(0, 3)" class="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-semibold text-slate-700">
                      {{ sk }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <a
                  routerLink="/recruiter/drives"
                  class="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs transition-colors flex items-center gap-1.5"
                >
                  Manage Drive
                </a>
              </div>
            </div>

            <!-- EMPTY STATE -->
            <div *ngIf="recruiterService.recruiterDrives().length === 0" class="p-8 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-2">
              <div class="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <app-icon name="calendar" [size]="20"></app-icon>
              </div>
              <h4 class="text-sm font-bold text-slate-800">No active placement drives found for {{ recruiterService.recruiterCompanyName() }}</h4>
              <p class="text-xs text-slate-500 max-w-sm mx-auto">
                There are currently no placement drives configured for your organization. Click below to schedule and publish your first campus recruitment drive.
              </p>
              <div class="pt-2">
                <a
                  routerLink="/recruiter/drives"
                  class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-colors"
                >
                  + Post First Drive
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Hiring Pipeline Funnel (1 col) -->
        <div class="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <div>
            <h3 class="text-lg font-bold text-slate-900">Pipeline Funnel</h3>
            <p class="text-xs text-slate-500">Live candidate status distribution</p>
          </div>

          <!-- SKELETON FOR FUNNEL -->
          <div *ngIf="recruiterService.isLoading() && !recruiterService.isInitialized()" class="space-y-3">
            <div *ngFor="let _ of [1,2,3,4]" class="p-3 rounded-2xl bg-slate-50 border border-slate-100 animate-pulse flex items-center justify-between">
              <div class="h-3 w-28 bg-slate-200 rounded"></div>
              <div class="h-3 w-8 bg-slate-200 rounded"></div>
            </div>
          </div>

          <!-- LOADED FUNNEL -->
          <div *ngIf="!recruiterService.isLoading() || recruiterService.isInitialized()" class="space-y-3">
            <div class="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-600 flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                1. Applied
              </span>
              <span class="text-sm font-bold text-slate-900">{{ recruiterService.totalApplicants() }}</span>
            </div>

            <div class="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-600 flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                2. Shortlisted
              </span>
              <span class="text-sm font-bold text-slate-900">{{ recruiterService.shortlistedCount() }}</span>
            </div>

            <div class="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-600 flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                3. Technical & HR Interview
              </span>
              <span class="text-sm font-bold text-slate-900">{{ recruiterService.interviewCount() }}</span>
            </div>

            <div class="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-600 flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                4. Selected (Offer)
              </span>
              <span class="text-sm font-bold text-slate-900">{{ recruiterService.selectedCount() }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- MANAGE COMPANY LOGO MODAL -->
      <div
        *ngIf="isLogoModalOpen()"
        class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in"
      >
        <div class="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6 relative">
          <!-- Modal Header -->
          <div class="flex items-center justify-between pb-4 border-b border-slate-100">
            <div class="flex items-center gap-2.5">
              <div class="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <app-icon name="image" [size]="20"></app-icon>
              </div>
              <div>
                <h3 class="text-base font-bold text-slate-900">Manage Company Logo</h3>
                <p class="text-xs text-slate-500">{{ recruiterService.recruiterCompanyName() }} official brand mark</p>
              </div>
            </div>
            <button
              type="button"
              (click)="closeLogoModal()"
              class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          <!-- Current / Preview Logo Display -->
          <div class="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div class="w-24 h-24 rounded-2xl bg-white border-2 border-slate-200 p-2 shadow-sm overflow-hidden flex items-center justify-center relative group">
              <img
                *ngIf="previewLogoUrl() || recruiterService.companyLogo()"
                [src]="previewLogoUrl() || recruiterService.companyLogo()"
                alt="Company logo preview"
                (error)="onLogoError($event)"
                class="w-full h-full object-contain rounded-xl"
              />
              <div
                *ngIf="!previewLogoUrl() && !recruiterService.companyLogo()"
                class="w-full h-full rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-2xl"
              >
                {{ recruiterService.recruiterCompanyName().charAt(0) }}
              </div>
            </div>
            <div class="text-center">
              <div class="text-xs font-bold text-slate-800">{{ recruiterService.recruiterCompanyName() }}</div>
              <div class="text-[11px] text-slate-400 mt-0.5">1:1 square ratio recommended • Max 5MB</div>
            </div>
          </div>

          <!-- Drag and Drop / Upload Controls -->
          <div class="space-y-3">
            <div
              (dragover)="onLogoDragOver($event)"
              (dragleave)="onLogoDragLeave($event)"
              (drop)="onLogoDrop($event)"
              [ngClass]="isDragging() ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50'"
              class="border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all"
            >
              <div *ngIf="!isUploadingLogo()" class="space-y-1.5">
                <app-icon name="upload" [size]="20" customClass="mx-auto text-indigo-600"></app-icon>
                <div>
                  <label class="text-xs font-bold text-indigo-600 hover:underline cursor-pointer">
                    Click to select logo file
                    <input
                      type="file"
                      (change)="handleLogoFileInput($event)"
                      accept="image/jpeg,image/png,image/webp"
                      class="hidden"
                    />
                  </label>
                  <span class="text-xs text-slate-500"> or drag & drop</span>
                </div>
                <p class="text-[10px] text-slate-400">PNG, JPG, or WebP up to 5MB</p>
              </div>

              <!-- Uploading progress spinner -->
              <div *ngIf="isUploadingLogo()" class="py-2 flex flex-col items-center justify-center gap-2">
                <div class="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <span class="text-xs font-semibold text-indigo-700">Uploading logo to storage...</span>
              </div>
            </div>

            <!-- Validation Error Alert -->
            <div *ngIf="uploadError()" class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <app-icon name="alert-circle" [size]="14" customClass="text-rose-600 shrink-0"></app-icon>
              <span>{{ uploadError() }}</span>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <button
              *ngIf="recruiterService.companyLogo() || previewLogoUrl()"
              type="button"
              (click)="removeLogo()"
              [disabled]="isUploadingLogo() || isSavingLogo()"
              class="px-3.5 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <app-icon name="trash-2" [size]="14"></app-icon>
              Remove Logo
            </button>
            <div *ngIf="!recruiterService.companyLogo() && !previewLogoUrl()"></div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="closeLogoModal()"
                [disabled]="isUploadingLogo() || isSavingLogo()"
                class="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                (click)="saveLogo()"
                [disabled]="(!selectedLogoFile() && !previewLogoUrl()) || isUploadingLogo() || isSavingLogo()"
                class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span *ngIf="isSavingLogo()" class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class RecruiterDashboardComponent implements OnInit {
  recruiterService = inject(RecruiterService);
  private toast = inject(ToastService);

  // Logo Modal States
  isLogoModalOpen = signal<boolean>(false);
  previewLogoUrl = signal<string>('');
  selectedLogoFile = signal<File | null>(null);
  isDragging = signal<boolean>(false);
  isUploadingLogo = signal<boolean>(false);
  isSavingLogo = signal<boolean>(false);
  uploadError = signal<string | null>(null);

  ngOnInit(): void {
    this.recruiterService.loadRecruiterData();
  }

  openLogoModal(): void {
    this.previewLogoUrl.set(this.recruiterService.companyLogo());
    this.selectedLogoFile.set(null);
    this.uploadError.set(null);
    this.isLogoModalOpen.set(true);
  }

  closeLogoModal(): void {
    this.isLogoModalOpen.set(false);
    this.previewLogoUrl.set('');
    this.selectedLogoFile.set(null);
    this.uploadError.set(null);
  }

  onLogoDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onLogoDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onLogoDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.processLogoFile(event.dataTransfer.files[0]);
    }
  }

  handleLogoFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.processLogoFile(input.files[0]);
    }
  }

  private processLogoFile(file: File): void {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.uploadError.set('Please select a valid image file (PNG, JPEG, or WebP).');
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      this.uploadError.set('Image size exceeds 5MB limit. Please choose a smaller file.');
      return;
    }

    this.uploadError.set(null);
    this.selectedLogoFile.set(file);
    this.previewLogoUrl.set(URL.createObjectURL(file));
  }

  async saveLogo(): Promise<void> {
    const file = this.selectedLogoFile();
    if (file) {
      this.isSavingLogo.set(true);
      this.isUploadingLogo.set(true);
      try {
        const uploadRes = await this.recruiterService.uploadCompanyLogo(file);
        if (uploadRes.error && !uploadRes.url) {
          this.uploadError.set(uploadRes.error);
          return;
        }
        await this.recruiterService.updateCompanyLogo(uploadRes.url);
        this.closeLogoModal();
      } catch (err: any) {
        this.uploadError.set(err?.message || 'Failed to save company logo.');
      } finally {
        this.isSavingLogo.set(false);
        this.isUploadingLogo.set(false);
      }
    } else if (this.previewLogoUrl()) {
      // Re-saving existing preview or manual URL
      this.isSavingLogo.set(true);
      try {
        await this.recruiterService.updateCompanyLogo(this.previewLogoUrl());
        this.closeLogoModal();
      } catch (err: any) {
        this.uploadError.set(err?.message || 'Failed to update company logo.');
      } finally {
        this.isSavingLogo.set(false);
      }
    }
  }

  async removeLogo(): Promise<void> {
    this.isSavingLogo.set(true);
    try {
      await this.recruiterService.updateCompanyLogo('');
      this.closeLogoModal();
    } catch (err: any) {
      this.uploadError.set(err?.message || 'Failed to remove logo.');
    } finally {
      this.isSavingLogo.set(false);
    }
  }

  onLogoError(event: Event): void {
    const target = event.target as HTMLImageElement;
    target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.recruiterService.recruiterCompanyName())}&background=2563eb&color=fff&bold=true`;
  }
}
