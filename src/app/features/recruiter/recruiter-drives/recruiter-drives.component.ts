import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RecruiterService } from '../../../core/services/recruiter.service';
import { PlacementDriveService } from '../../../core/services/placement-drive.service';
import { PlacementDrive, DriveStatus } from '../../../core/models/placement-drive.model';
import { IconComponent } from '../../../shared/icons/icon.component';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-recruiter-drives',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  template: `
    <div class="space-y-6 animate-in fade-in duration-300 pb-16">
      <!-- Error Alert with Retry -->
      <div
        *ngIf="recruiterService.error()"
        class="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between shadow-xs animate-in fade-in"
      >
        <div class="flex items-center gap-2.5">
          <app-icon name="alert-triangle" [size]="18" customClass="text-rose-600 shrink-0"></app-icon>
          <div>
            <div class="text-xs font-bold text-rose-900">Failed to sync placement drives</div>
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
            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {{ recruiterService.recruiterCompanyName() }}
            </span>
            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
              Campus Placement Drives
            </span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Placement Drives Management</h1>
          <p class="text-sm text-slate-500 mt-1">
            Create on-campus and virtual hiring drives, customize eligibility cutoffs, upload promotional banners, and publish opportunities.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <a
            routerLink="/recruiter/jobs"
            class="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors"
          >
            <app-icon name="briefcase" [size]="16"></app-icon>
            View Job Postings
          </a>
          <button
            type="button"
            (click)="openCreateModal()"
            class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-indigo-500/20 transition-all hover:scale-[1.02]"
          >
            <app-icon name="plus" [size]="16"></app-icon>
            + Create Placement Drive
          </button>
        </div>
      </div>

      <!-- Quick Metrics Overview -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div class="flex items-center justify-between text-slate-500 mb-2">
            <span class="text-xs font-bold uppercase tracking-wider">Total Drives</span>
            <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <app-icon name="calendar" [size]="16"></app-icon>
            </div>
          </div>
          <div class="text-2xl font-black text-slate-900">{{ recruiterService.totalDrivesCount() }}</div>
          <p class="text-[11px] text-slate-400 mt-1">Configured recruitment drives</p>
        </div>

        <div class="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div class="flex items-center justify-between text-slate-500 mb-2">
            <span class="text-xs font-bold uppercase tracking-wider">Published & Active</span>
            <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <app-icon name="check-circle" [size]="16"></app-icon>
            </div>
          </div>
          <div class="text-2xl font-black text-emerald-600">{{ recruiterService.publishedDrivesCount() }}</div>
          <p class="text-[11px] text-slate-400 mt-1">Open for student applications</p>
        </div>

        <div class="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div class="flex items-center justify-between text-slate-500 mb-2">
            <span class="text-xs font-bold uppercase tracking-wider">Draft Drives</span>
            <div class="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <app-icon name="file-text" [size]="16"></app-icon>
            </div>
          </div>
          <div class="text-2xl font-black text-amber-600">{{ recruiterService.draftDrivesCount() }}</div>
          <p class="text-[11px] text-slate-400 mt-1">Unpublished drafts</p>
        </div>

        <div class="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div class="flex items-center justify-between text-slate-500 mb-2">
            <span class="text-xs font-bold uppercase tracking-wider">Closed Drives</span>
            <div class="w-8 h-8 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center">
              <app-icon name="archive" [size]="16"></app-icon>
            </div>
          </div>
          <div class="text-2xl font-black text-slate-700">{{ recruiterService.closedDrivesCount() }}</div>
          <p class="text-[11px] text-slate-400 mt-1">Past completed drives</p>
        </div>
      </div>

      <!-- Filters & Search Toolbar -->
      <div class="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div class="relative flex-1 w-full">
          <app-icon name="search" [size]="16" customClass="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></app-icon>
          <input
            type="text"
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
            placeholder="Search drives by title, role designation, or required skills..."
            class="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div class="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <select
            [ngModel]="statusFilter()"
            (ngModelChange)="statusFilter.set($event)"
            class="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Statuses ({{ recruiterService.recruiterDrives().length }})</option>
            <option value="Published">Published / Live</option>
            <option value="Draft">Draft</option>
            <option value="Closed">Closed</option>
          </select>

          <select
            [ngModel]="modeFilter()"
            (ngModelChange)="modeFilter.set($event)"
            class="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Modes</option>
            <option value="Online">Online</option>
            <option value="On-Campus">On-Campus</option>
            <option value="Hybrid">Hybrid</option>
          </select>

          <button
            *ngIf="searchQuery() || statusFilter() !== 'all' || modeFilter() !== 'all'"
            type="button"
            (click)="resetFilters()"
            class="px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      <!-- SKELETON LOADING STATE -->
      <div *ngIf="recruiterService.isLoading() && !recruiterService.isInitialized()" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div *ngFor="let _ of [1,2,3]" class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs animate-pulse">
          <div class="h-36 bg-slate-200"></div>
          <div class="p-6 space-y-3">
            <div class="h-5 w-48 bg-slate-200 rounded"></div>
            <div class="h-3 w-32 bg-slate-100 rounded"></div>
            <div class="h-10 bg-slate-50 rounded-xl"></div>
          </div>
        </div>
      </div>

      <!-- Drives Grid -->
      <div *ngIf="!recruiterService.isLoading() || recruiterService.isInitialized()" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          *ngFor="let drive of filteredDrives()"
          class="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
        >
          <div>
            <!-- Banner Image Header -->
            <div class="relative h-40 w-full overflow-hidden bg-slate-100">
              <img
                *ngIf="drive.bannerUrl"
                [src]="drive.bannerUrl"
                [alt]="drive.title"
                (error)="onBannerError($event)"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div
                *ngIf="!drive.bannerUrl"
                class="w-full h-full bg-linear-to-r from-indigo-600 via-purple-600 to-blue-700 flex items-center justify-center p-4 text-center text-white"
              >
                <div class="space-y-1">
                  <div class="text-sm font-extrabold tracking-tight opacity-90">{{ drive.companyName }}</div>
                  <div class="text-xs text-indigo-100 line-clamp-1 font-medium">{{ drive.title }}</div>
                </div>
              </div>

              <!-- Status Badge Overlay -->
              <div class="absolute top-3 right-3">
                <span
                  class="px-2.5 py-1 rounded-full text-[11px] font-bold backdrop-blur-md shadow-xs"
                  [ngClass]="{
                    'bg-emerald-500 text-white': drive.status === 'Published' || drive.status === 'Applications Open' || drive.status === 'In Progress',
                    'bg-amber-500 text-white': drive.status === 'Draft',
                    'bg-slate-800 text-white': drive.status === 'Closed' || drive.status === 'Completed' || drive.status === 'Cancelled'
                  }"
                >
                  {{ drive.status }}
                </span>
              </div>

              <!-- Mode Badge -->
              <div class="absolute bottom-3 left-3">
                <span class="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-white/90 text-slate-800 shadow-xs flex items-center gap-1 backdrop-blur-xs">
                  <app-icon name="map-pin" [size]="10"></app-icon>
                  {{ drive.mode }} • {{ drive.location }}
                </span>
              </div>
            </div>

            <!-- Overlapping Company Logo Badge (1:1 Brand Mark) -->
            <div class="px-6 -mt-7 relative z-10 flex items-end justify-between">
              <div class="w-14 h-14 rounded-2xl bg-white p-1 border-2 border-slate-100 shadow-md overflow-hidden shrink-0 flex items-center justify-center">
                <img
                  [src]="drive.companyLogo || recruiterService.companyLogo()"
                  [alt]="drive.companyName"
                  (error)="onLogoError($event, drive.companyName)"
                  class="w-full h-full object-contain rounded-xl"
                />
              </div>
              <span class="text-xs font-bold text-slate-700 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
                {{ drive.companyName }}
              </span>
            </div>

            <!-- Card Content Body -->
            <div class="p-6 pt-3 space-y-4">
              <div>
                <span class="text-[11px] font-bold uppercase tracking-wider text-indigo-600">{{ drive.jobRole || drive.roleDesignation }}</span>
                <h3 class="text-base font-bold text-slate-900 mt-0.5 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                  {{ drive.title }}
                </h3>
                <p class="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                  {{ drive.description }}
                </p>
              </div>

              <!-- Compensation & Cutoff Box -->
              <div class="grid grid-cols-2 gap-2 text-xs p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div>
                  <span class="text-slate-400 text-[10px] uppercase font-bold block">Package (CTC)</span>
                  <div class="font-bold text-slate-900 mt-0.5">{{ drive.salaryCtc }}</div>
                </div>
                <div>
                  <span class="text-slate-400 text-[10px] uppercase font-bold block">Min CGPA</span>
                  <div class="font-bold text-slate-900 mt-0.5">{{ drive.minimumCgpa }} / 10.0</div>
                </div>
              </div>

              <!-- Required Skills -->
              <div>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    *ngFor="let sk of drive.requiredSkills.slice(0, 4)"
                    class="px-2 py-0.5 rounded-md bg-indigo-50/70 text-indigo-700 text-[11px] font-semibold border border-indigo-100"
                  >
                    {{ sk }}
                  </span>
                  <span *ngIf="drive.requiredSkills.length > 4" class="text-[10px] text-slate-400 px-1 py-0.5">
                    +{{ drive.requiredSkills.length - 4 }} more
                  </span>
                </div>
              </div>

              <!-- Dates Info -->
              <div class="space-y-1 text-xs text-slate-500 pt-1">
                <div class="flex items-center justify-between">
                  <span class="flex items-center gap-1.5">
                    <app-icon name="calendar" [size]="12"></app-icon>
                    Drive Date:
                  </span>
                  <strong class="text-slate-700">{{ drive.driveDate | date:'mediumDate' }}</strong>
                </div>
                <div class="flex items-center justify-between">
                  <span class="flex items-center gap-1.5">
                    <app-icon name="clock" [size]="12"></app-icon>
                    Deadline:
                  </span>
                  <strong class="text-slate-700">{{ drive.applicationDeadline | date:'mediumDate' }}</strong>
                </div>
              </div>
            </div>
          </div>

          <!-- Card Actions Footer -->
          <div class="p-4 sm:px-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                (click)="openDetailModal(drive)"
                class="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs transition-colors"
                title="View Drive Details"
              >
                Inspect
              </button>
              <button
                type="button"
                (click)="openEditModal(drive)"
                class="px-3 py-1.5 rounded-xl bg-white hover:bg-indigo-50 border border-slate-200 text-indigo-700 font-semibold text-xs transition-colors"
                title="Edit Drive"
              >
                Edit
              </button>
            </div>

            <div class="flex items-center gap-1.5">
              <!-- Publish button for Drafts -->
              <button
                *ngIf="drive.status === 'Draft'"
                type="button"
                (click)="togglePublishStatus(drive, 'Published')"
                class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors flex items-center gap-1"
                title="Publish Drive to Students"
              >
                <app-icon name="check" [size]="12"></app-icon>
                Publish
              </button>

              <!-- Close button for Published -->
              <button
                *ngIf="drive.status === 'Published' || drive.status === 'Applications Open' || drive.status === 'In Progress'"
                type="button"
                (click)="togglePublishStatus(drive, 'Closed')"
                class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
                title="Close Application Window"
              >
                Close
              </button>

              <!-- Delete Drive -->
              <button
                type="button"
                (click)="confirmDeleteDrive(drive)"
                class="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Delete Placement Drive"
              >
                <app-icon name="trash" [size]="14"></app-icon>
              </button>
            </div>
          </div>
        </div>

        <!-- EMPTY STATE -->
        <div
          *ngIf="filteredDrives().length === 0"
          class="col-span-full p-12 sm:p-16 rounded-3xl bg-white border border-dashed border-slate-200 text-center space-y-4"
        >
          <div class="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <app-icon name="calendar" [size]="28"></app-icon>
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-800">No Placement Drives Found</h3>
            <p class="text-xs text-slate-500 max-w-md mx-auto mt-1">
              {{ searchQuery() || statusFilter() !== 'all' || modeFilter() !== 'all'
                ? 'No drives match your specified filters. Try clearing your search parameters.'
                : 'Your organization currently has no placement drives configured. Click below to schedule and publish your first drive.' }}
            </p>
          </div>
          <div class="pt-2 flex justify-center gap-3">
            <button
              *ngIf="searchQuery() || statusFilter() !== 'all' || modeFilter() !== 'all'"
              type="button"
              (click)="resetFilters()"
              class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Clear Filters
            </button>
            <button
              type="button"
              (click)="openCreateModal()"
              class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md transition-all"
            >
              <app-icon name="plus" [size]="15"></app-icon>
              + Create First Drive
            </button>
          </div>
        </div>
      </div>

      <!-- CREATE / EDIT PLACEMENT DRIVE MODAL -->
      <div *ngIf="showModal()" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
        <div class="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto space-y-5 custom-scrollbar">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 class="text-base font-bold text-slate-900">
                {{ isEditing() ? 'Edit Placement Drive' : 'Create New Placement Drive' }}
              </h3>
              <p class="text-xs text-slate-500 mt-0.5">
                Configuring recruitment drive for {{ recruiterService.recruiterCompanyName() }}
              </p>
            </div>
            <button (click)="closeModal()" class="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
              <app-icon name="x" [size]="20"></app-icon>
            </button>
          </div>

          <form (submit)="saveDriveForm($event)" class="space-y-4 text-xs">
            <!-- COMPANY LOGO & BRAND IDENTITY HEADER (1:1 Logo) -->
            <div class="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between gap-4">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-xl bg-white p-1 border border-indigo-200 shadow-2xs overflow-hidden shrink-0 flex items-center justify-center">
                  <img
                    *ngIf="recruiterService.companyLogo()"
                    [src]="recruiterService.companyLogo()"
                    [alt]="recruiterService.recruiterCompanyName()"
                    (error)="onLogoError($event, recruiterService.recruiterCompanyName())"
                    class="w-full h-full object-contain rounded-lg"
                  />
                  <div *ngIf="!recruiterService.companyLogo()" class="w-full h-full rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-base">
                    {{ recruiterService.recruiterCompanyName().charAt(0) }}
                  </div>
                </div>
                <div>
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs font-bold text-slate-900">{{ recruiterService.recruiterCompanyName() }}</span>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">Brand Logo (1:1)</span>
                  </div>
                  <p class="text-[11px] text-slate-500 mt-0.5">
                    Official organization logo automatically attached to this drive and shown across student portals.
                  </p>
                </div>
              </div>
              <a
                routerLink="/recruiter/dashboard"
                class="px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-semibold text-[11px] transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                title="Manage Company Logo in Dashboard"
              >
                <app-icon name="edit-2" [size]="12"></app-icon>
                Manage Logo
              </a>
            </div>

            <!-- PROMOTIONAL BANNER IMAGE UPLOAD SECTION (Landscape Hero) -->
            <div class="space-y-2">
              <label class="block font-bold text-slate-800 text-xs">
                Drive Promotional Banner Image
                <span class="font-normal text-slate-400 ml-1">(Optional landscape hero • JPEG, PNG, WebP up to 5MB)</span>
              </label>

              <!-- Live Preview if Banner URL present -->
              <div *ngIf="formBannerUrl()" class="relative rounded-2xl overflow-hidden border border-slate-200 h-36 w-full bg-slate-100 group">
                <img
                  [src]="formBannerUrl()"
                  alt="Banner preview"
                  (error)="onBannerError($event)"
                  class="w-full h-full object-cover"
                />
                <div class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <label class="px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white text-slate-800 font-semibold text-xs cursor-pointer shadow-md transition-all">
                    Replace Image
                    <input type="file" (change)="handleFileSelect($event)" accept="image/jpeg,image/png,image/webp" class="hidden" />
                  </label>
                  <button
                    type="button"
                    (click)="removeBannerImage()"
                    class="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-md transition-all"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <!-- Upload Drag & Drop Dropzone if no banner selected -->
              <div
                *ngIf="!formBannerUrl()"
                (dragover)="onDragOver($event)"
                (dragleave)="onDragLeave($event)"
                (drop)="onDrop($event)"
                [ngClass]="isDragging() ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50'"
                class="border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all"
              >
                <div *ngIf="!isUploadingBanner()" class="space-y-2">
                  <div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                    <app-icon name="image" [size]="20"></app-icon>
                  </div>
                  <div>
                    <label class="text-xs font-bold text-indigo-600 hover:underline cursor-pointer">
                      Click to upload banner
                      <input type="file" (change)="handleFileSelect($event)" accept="image/jpeg,image/png,image/webp" class="hidden" />
                    </label>
                    <span class="text-slate-500"> or drag and drop</span>
                  </div>
                  <p class="text-[10px] text-slate-400">PNG, JPG or WebP (Max 5MB • 1200x400 recommended)</p>
                </div>

                <!-- Uploading Spinner -->
                <div *ngIf="isUploadingBanner()" class="py-3 flex flex-col items-center justify-center gap-2">
                  <div class="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <span class="text-xs font-semibold text-indigo-700">Uploading banner to storage bucket...</span>
                </div>
              </div>
            </div>

            <!-- Basic Details -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700">Drive Title *</label>
                <input
                  type="text"
                  [(ngModel)]="driveFormData.title"
                  name="dTitle"
                  required
                  placeholder="e.g. Campus Recruitment Wave 2026"
                  class="w-full px-3 py-2 mt-1 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label class="block font-semibold text-slate-700">Job Role / Designation *</label>
                <input
                  type="text"
                  [(ngModel)]="driveFormData.jobRole"
                  name="dRole"
                  required
                  placeholder="e.g. Software Development Engineer I"
                  class="w-full px-3 py-2 mt-1 rounded-xl border border-slate-200 text-xs"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block font-semibold text-slate-700">Employment Type *</label>
                <select [(ngModel)]="driveFormData.employmentType" name="dEmpType" class="w-full px-3 py-2 mt-1 rounded-xl border border-slate-200 bg-white">
                  <option value="Full Time">Full Time</option>
                  <option value="Full Time + 6M Internship">Full Time + 6M Internship</option>
                  <option value="Internship">Internship</option>
                  <option value="Contract">Contract</option>
                </select>
              </div>

              <div>
                <label class="block font-semibold text-slate-700">Drive Mode *</label>
                <select [(ngModel)]="driveFormData.mode" name="dMode" class="w-full px-3 py-2 mt-1 rounded-xl border border-slate-200 bg-white">
                  <option value="Online">Online</option>
                  <option value="On-Campus">On-Campus</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </div>

              <div>
                <label class="block font-semibold text-slate-700">Location *</label>
                <input
                  type="text"
                  [(ngModel)]="driveFormData.location"
                  name="dLoc"
                  required
                  placeholder="Bengaluru / Hybrid"
                  class="w-full px-3 py-2 mt-1 rounded-xl border border-slate-200"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block font-semibold text-slate-700">Compensation (CTC) *</label>
                <input
                  type="text"
                  [(ngModel)]="driveFormData.salaryCtc"
                  name="dSalary"
                  required
                  placeholder="e.g. ₹18 - ₹24 LPA"
                  class="w-full px-3 py-2 mt-1 rounded-xl border border-slate-200 font-bold"
                />
              </div>

              <div>
                <label class="block font-semibold text-slate-700">Min CGPA Cutoff</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  [(ngModel)]="driveFormData.minimumCgpa"
                  name="dCgpa"
                  required
                  class="w-full px-3 py-2 mt-1 rounded-xl border border-slate-200 font-bold"
                />
              </div>

              <div>
                <label class="block font-semibold text-slate-700">Max Backlogs Allowed</label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  [(ngModel)]="driveFormData.maxBacklogs"
                  name="dBacklogs"
                  required
                  class="w-full px-3 py-2 mt-1 rounded-xl border border-slate-200"
                />
              </div>
            </div>

            <!-- Dates -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700">Application Deadline *</label>
                <input
                  type="date"
                  [(ngModel)]="formDeadlineDate"
                  name="dDeadline"
                  required
                  class="w-full px-3 py-2 mt-1 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label class="block font-semibold text-slate-700">Drive Conduct Date *</label>
                <input
                  type="date"
                  [(ngModel)]="formDriveDate"
                  name="dDriveDate"
                  required
                  class="w-full px-3 py-2 mt-1 rounded-xl border border-slate-200"
                />
              </div>
            </div>

            <!-- Eligible Departments & Batches -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700">Eligible Departments (Comma separated)</label>
                <input
                  type="text"
                  [(ngModel)]="formDeptsRaw"
                  name="dDepts"
                  placeholder="Computer Science & Engineering, Information Technology"
                  class="w-full px-3 py-2 mt-1 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label class="block font-semibold text-slate-700">Eligible Batches (Comma separated)</label>
                <input
                  type="text"
                  [(ngModel)]="formBatchesRaw"
                  name="dBatches"
                  placeholder="2026, 2027"
                  class="w-full px-3 py-2 mt-1 rounded-xl border border-slate-200"
                />
              </div>
            </div>

            <div>
              <label class="block font-semibold text-slate-700">Required Skills & Frameworks *</label>
              <input
                type="text"
                [(ngModel)]="formSkillsRaw"
                name="dSkills"
                required
                placeholder="Data Structures, Java, TypeScript, SQL, System Design"
                class="w-full px-3 py-2 mt-1 rounded-xl border border-slate-200"
              />
            </div>

            <div>
              <label class="block font-semibold text-slate-700">Selection Process Pipeline</label>
              <input
                type="text"
                [(ngModel)]="driveFormData.selectionProcess"
                name="dProcess"
                placeholder="Online Assessment -> Technical Interview 1 -> System Design -> HR Interview"
                class="w-full px-3 py-2 mt-1 rounded-xl border border-slate-200"
              />
            </div>

            <div>
              <label class="block font-semibold text-slate-700">Drive Description & Instructions *</label>
              <textarea
                [(ngModel)]="driveFormData.description"
                name="dDesc"
                required
                rows="3"
                placeholder="Comprehensive overview of role requirements, project details, and interview preparation advice..."
                class="w-full px-3 py-2 mt-1 rounded-xl border border-slate-200"
              ></textarea>
            </div>

            <!-- Form Actions -->
            <div class="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                (click)="closeModal()"
                class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                (click)="submitDrive('Draft')"
                [disabled]="isSavingDrive()"
                class="px-4 py-2 rounded-xl text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
              >
                Save as Draft
              </button>

              <button
                type="submit"
                [disabled]="isSavingDrive()"
                class="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5"
              >
                <app-icon *ngIf="!isSavingDrive()" name="check" [size]="14"></app-icon>
                <div *ngIf="isSavingDrive()" class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {{ isEditing() ? 'Save Changes & Publish' : 'Publish Placement Drive' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- DRIVE DETAILS INSPECT MODAL -->
      <div *ngIf="inspectingDrive()" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
        <div class="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5 custom-scrollbar">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div class="flex items-center gap-2">
              <span
                class="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                [ngClass]="inspectingDrive()!.status === 'Published' ? 'bg-emerald-100 text-emerald-800' : inspectingDrive()!.status === 'Draft' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'"
              >
                {{ inspectingDrive()!.status }}
              </span>
              <h3 class="text-base font-bold text-slate-900">{{ inspectingDrive()!.title }}</h3>
            </div>
            <button (click)="inspectingDrive.set(null)" class="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
              <app-icon name="x" [size]="20"></app-icon>
            </button>
          </div>

          <div *ngIf="inspectingDrive()!.bannerUrl" class="h-44 w-full rounded-2xl overflow-hidden border border-slate-200">
            <img [src]="inspectingDrive()!.bannerUrl" [alt]="inspectingDrive()!.title" class="w-full h-full object-cover" />
          </div>

          <!-- Company Brand Header in Inspect Modal -->
          <div class="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <div class="w-12 h-12 rounded-xl bg-white p-1 border border-slate-200 shadow-2xs overflow-hidden shrink-0 flex items-center justify-center">
              <img
                [src]="inspectingDrive()!.companyLogo || recruiterService.companyLogo()"
                [alt]="inspectingDrive()!.companyName"
                (error)="onLogoError($event, inspectingDrive()!.companyName)"
                class="w-full h-full object-contain rounded-lg"
              />
            </div>
            <div>
              <div class="text-xs font-bold text-slate-900">{{ inspectingDrive()!.companyName }}</div>
              <div class="text-[11px] text-slate-500 font-medium">{{ inspectingDrive()!.jobRole || inspectingDrive()!.roleDesignation }} • {{ inspectingDrive()!.location }}</div>
            </div>
          </div>

          <div class="space-y-3 text-xs">
            <p class="text-slate-600 leading-relaxed">{{ inspectingDrive()!.description }}</p>

            <div class="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div>
                <span class="text-slate-400 text-[10px] uppercase font-bold">Role Designation</span>
                <div class="font-bold text-slate-900 mt-0.5">{{ inspectingDrive()!.jobRole || inspectingDrive()!.roleDesignation }}</div>
              </div>
              <div>
                <span class="text-slate-400 text-[10px] uppercase font-bold">Package</span>
                <div class="font-bold text-slate-900 mt-0.5">{{ inspectingDrive()!.salaryCtc }}</div>
              </div>
              <div>
                <span class="text-slate-400 text-[10px] uppercase font-bold">Min CGPA</span>
                <div class="font-bold text-slate-900 mt-0.5">{{ inspectingDrive()!.minimumCgpa }} / 10.0</div>
              </div>
              <div>
                <span class="text-slate-400 text-[10px] uppercase font-bold">Max Backlogs</span>
                <div class="font-bold text-slate-900 mt-0.5">{{ inspectingDrive()!.maxBacklogs }}</div>
              </div>
            </div>

            <div>
              <span class="text-slate-400 text-[10px] uppercase font-bold block mb-1">Required Skills:</span>
              <div class="flex flex-wrap gap-1">
                <span *ngFor="let s of inspectingDrive()!.requiredSkills" class="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                  {{ s }}
                </span>
              </div>
            </div>

            <div>
              <span class="text-slate-400 text-[10px] uppercase font-bold block mb-1">Selection Workflow:</span>
              <p class="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium">
                {{ inspectingDrive()!.selectionProcess || 'Online Assessment -> Technical Interview -> HR Round' }}
              </p>
            </div>
          </div>

          <div class="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button type="button" (click)="inspectingDrive.set(null)" class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100">
              Close
            </button>
            <button
              type="button"
              (click)="openEditModal(inspectingDrive()!); inspectingDrive.set(null)"
              class="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Edit Drive
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class RecruiterDrivesComponent implements OnInit {
  recruiterService = inject(RecruiterService);
  placementDriveService = inject(PlacementDriveService);
  toast = inject(ToastService);

  searchQuery = signal('');
  statusFilter = signal('all');
  modeFilter = signal('all');

  showModal = signal(false);
  isEditing = signal(false);
  editingDriveId = signal<string | null>(null);
  inspectingDrive = signal<PlacementDrive | null>(null);

  isDragging = signal(false);
  isUploadingBanner = signal(false);
  isSavingDrive = signal(false);

  formBannerUrl = signal('');
  formDeadlineDate = '';
  formDriveDate = '';
  formSkillsRaw = '';
  formDeptsRaw = '';
  formBatchesRaw = '';

  driveFormData: Partial<PlacementDrive> = {
    title: '',
    jobRole: '',
    roleDesignation: '',
    description: '',
    employmentType: 'Full Time',
    location: 'Bengaluru / Hybrid',
    mode: 'Online',
    venue: 'Virtual Tech Hall / Google Meet',
    salaryCtc: '₹14 - ₹20 LPA',
    minimumCgpa: 7.0,
    maxBacklogs: 0,
    vacancies: 5,
    selectionProcess: 'Online Assessment -> Technical Interview 1 -> HR Round'
  };

  filteredDrives = computed(() => {
    let list = this.recruiterService.recruiterDrives();
    const query = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();
    const mode = this.modeFilter();

    if (query) {
      list = list.filter(d =>
        d.title.toLowerCase().includes(query) ||
        (d.jobRole && d.jobRole.toLowerCase().includes(query)) ||
        (d.roleDesignation && d.roleDesignation.toLowerCase().includes(query)) ||
        d.requiredSkills.some(s => s.toLowerCase().includes(query))
      );
    }

    if (status !== 'all') {
      if (status === 'Published') {
        list = list.filter(d => d.status === 'Published' || d.status === 'Applications Open' || d.status === 'In Progress');
      } else if (status === 'Draft') {
        list = list.filter(d => d.status === 'Draft');
      } else if (status === 'Closed') {
        list = list.filter(d => d.status === 'Closed' || d.status === 'Completed' || d.status === 'Cancelled');
      }
    }

    if (mode !== 'all') {
      list = list.filter(d => d.mode === mode);
    }

    return list;
  });

  ngOnInit(): void {
    this.recruiterService.loadRecruiterData();
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.statusFilter.set('all');
    this.modeFilter.set('all');
  }

  openCreateModal(): void {
    this.isEditing.set(false);
    this.editingDriveId.set(null);
    this.formBannerUrl.set('');
    this.formDeadlineDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
    this.formDriveDate = new Date(Date.now() + 20 * 86400000).toISOString().split('T')[0];
    this.formSkillsRaw = 'Java, Data Structures, SQL, Git, REST API';
    this.formDeptsRaw = 'Computer Science & Engineering, Information Technology';
    this.formBatchesRaw = '2026, 2027';

    this.driveFormData = {
      title: `${this.recruiterService.recruiterCompanyName()} Campus Drive 2026`,
      jobRole: 'Associate Software Engineer',
      roleDesignation: 'Associate Software Engineer',
      description: 'Campus placement drive for core engineering and product innovation teams.',
      employmentType: 'Full Time',
      location: 'Bengaluru / Hybrid',
      mode: 'Online',
      venue: 'Campus Tech Hall / Virtual Assessment',
      salaryCtc: '₹14 - ₹20 LPA',
      minimumCgpa: 7.0,
      maxBacklogs: 0,
      vacancies: 5,
      selectionProcess: 'Online Assessment -> Technical Interview -> HR Round'
    };

    this.showModal.set(true);
  }

  openEditModal(drive: PlacementDrive): void {
    this.isEditing.set(true);
    this.editingDriveId.set(drive.id);
    this.formBannerUrl.set(drive.bannerUrl || '');
    this.formDeadlineDate = drive.applicationDeadline ? drive.applicationDeadline.split('T')[0] : '';
    this.formDriveDate = drive.driveDate ? drive.driveDate.split('T')[0] : '';
    this.formSkillsRaw = (drive.requiredSkills || []).join(', ');
    this.formDeptsRaw = (drive.eligibleDepartments || []).join(', ');
    this.formBatchesRaw = (drive.eligibleBatches || []).join(', ');

    this.driveFormData = {
      title: drive.title,
      jobRole: drive.jobRole || drive.roleDesignation,
      roleDesignation: drive.roleDesignation || drive.jobRole,
      description: drive.description,
      employmentType: drive.employmentType,
      location: drive.location,
      mode: drive.mode,
      venue: drive.venue,
      salaryCtc: drive.salaryCtc,
      minimumCgpa: drive.minimumCgpa,
      maxBacklogs: drive.maxBacklogs,
      vacancies: drive.vacancies,
      selectionProcess: drive.selectionProcess,
      status: drive.status
    };

    this.showModal.set(true);
  }

  openDetailModal(drive: PlacementDrive): void {
    this.inspectingDrive.set(drive);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.isEditing.set(false);
    this.editingDriveId.set(null);
  }

  // --- BANNER UPLOAD & DRAG DROP ---

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging.set(false);

    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      this.processBannerFile(file);
    }
  }

  handleFileSelect(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processBannerFile(input.files[0]);
    }
  }

  async processBannerFile(file: File): Promise<void> {
    this.isUploadingBanner.set(true);
    try {
      const res = await this.recruiterService.uploadBannerImage(file);
      if (res.url) {
        this.formBannerUrl.set(res.url);
      }
    } finally {
      this.isUploadingBanner.set(false);
    }
  }

  removeBannerImage(): void {
    this.formBannerUrl.set('');
  }

  onBannerError(event: any): void {
    event.target.style.display = 'none';
  }

  onLogoError(event: any, companyName?: string): void {
    const target = event.target as HTMLImageElement;
    target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(companyName || 'Company')}&background=4f46e5&color=fff&bold=true`;
  }

  // --- SAVE / PUBLISH ACTIONS ---

  saveDriveForm(e: Event): void {
    e.preventDefault();
    this.submitDrive('Published');
  }

  async submitDrive(status: DriveStatus): Promise<void> {
    const skills = this.formSkillsRaw.split(',').map(s => s.trim()).filter(Boolean);
    const depts = this.formDeptsRaw.split(',').map(d => d.trim()).filter(Boolean);
    const batches = this.formBatchesRaw.split(',').map(b => b.trim()).filter(Boolean);

    const payload: Partial<PlacementDrive> = {
      ...this.driveFormData,
      bannerUrl: this.formBannerUrl(),
      requiredSkills: skills.length > 0 ? skills : ['Java', 'SQL'],
      eligibleDepartments: depts.length > 0 ? depts : ['Computer Science & Engineering', 'Information Technology'],
      eligibleBatches: batches.length > 0 ? batches : ['2026', '2027'],
      applicationDeadline: this.formDeadlineDate ? new Date(this.formDeadlineDate).toISOString() : new Date().toISOString(),
      driveDate: this.formDriveDate ? new Date(this.formDriveDate).toISOString() : new Date().toISOString(),
      status
    };

    this.isSavingDrive.set(true);
    try {
      if (this.isEditing() && this.editingDriveId()) {
        await this.recruiterService.updatePlacementDrive(this.editingDriveId()!, payload);
      } else {
        await this.recruiterService.createPlacementDrive(payload);
      }
      this.closeModal();
    } catch (err: any) {
      this.toast.error('Save Failed', err?.message || 'Could not save placement drive.');
    } finally {
      this.isSavingDrive.set(false);
    }
  }

  async togglePublishStatus(drive: PlacementDrive, newStatus: DriveStatus): Promise<void> {
    try {
      if (newStatus === 'Published') {
        await this.recruiterService.publishPlacementDrive(drive.id);
      } else {
        await this.recruiterService.closePlacementDrive(drive.id);
      }
    } catch (err: any) {
      this.toast.error('Status Update Failed', err?.message || 'Could not change drive status.');
    }
  }

  async confirmDeleteDrive(drive: PlacementDrive): Promise<void> {
    if (confirm(`Are you sure you want to delete "${drive.title}"? This cannot be undone.`)) {
      try {
        await this.recruiterService.deletePlacementDrive(drive.id);
      } catch (err: any) {
        this.toast.error('Delete Failed', err?.message || 'Could not delete placement drive.');
      }
    }
  }
}
