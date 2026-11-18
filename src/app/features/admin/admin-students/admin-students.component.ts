import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { StudentService } from '../../../core/services/student.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../core/services/toast.service';
import { Student } from '../../../core/models/student.model';
import { IconComponent } from '../../../shared/icons/icon.component';
import { BadgeComponent } from '../../../shared/ui/badge.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';

export interface ParsedImportStudent {
  id: string;
  fullName: string;
  email: string;
  rollNumber: string;
  department: string;
  cgpa: number;
  phone?: string;
  avatarUrl?: string;
  localPhotoFile?: File;
  password?: string;
  status: 'ready' | 'warning' | 'error';
  statusReason?: string;
}

export interface ImportSummary {
  total: number;
  created: number;
  updated: number;
  failed: number;
  errors: { email: string; rollNumber?: string; reason: string }[];
}

@Component({
  selector: 'app-admin-students',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IconComponent,
    BadgeComponent,
    EmptyStateComponent
  ],
  template: `
    <div class="space-y-6 animate-in fade-in duration-300">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Master Student Directory</h1>
          <p class="text-sm text-slate-500 mt-1">
            Database of registered final-year engineering students with verified academic records, resumes, and profile pictures.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <!-- Bulk Import Button -->
          <button
            type="button"
            (click)="openImportModal()"
            class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-xs flex items-center gap-2 transition-all"
          >
            <app-icon name="upload" [size]="16"></app-icon>
            <span>Import Students (CSV / Excel)</span>
          </button>

          <!-- Export CSV Button -->
          <button
            type="button"
            (click)="exportStudentsToCsv()"
            class="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-xs flex items-center gap-2 transition-all"
          >
            <app-icon name="download" [size]="16"></app-icon>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <!-- Search & Multi-factor Filters -->
      <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <!-- Search input -->
          <div class="relative lg:col-span-2">
            <app-icon name="search" [size]="18" customClass="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></app-icon>
            <input
              type="text"
              [(ngModel)]="searchQuery"
              placeholder="Search by name, roll no (23CS101), skills, email..."
              class="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          <!-- Branch Filter -->
          <div>
            <select
              [(ngModel)]="selectedDepartment"
              class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Departments</option>
              <option value="Computer Science & Engineering">CSE</option>
              <option value="Information Technology">IT</option>
              <option value="Artificial Intelligence & Data Science">AI & DS</option>
              <option value="Electronics & Communication">ECE</option>
              <option value="Electrical & Electronics">EEE</option>
              <option value="Mechanical Engineering">MECH</option>
            </select>
          </div>

          <!-- Placement Status Filter -->
          <div>
            <select
              [(ngModel)]="selectedStatus"
              class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Placement Statuses</option>
              <option value="Selected">Selected / Placed</option>
              <option value="In Progress">In Progress</option>
              <option value="Not Placed">Not Placed</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Students Table -->
      <div *ngIf="filteredStudents().length > 0" class="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th class="py-3.5 px-4 sm:px-6">Student Roster</th>
                <th class="py-3.5 px-4 sm:px-6">Branch & Roll</th>
                <th class="py-3.5 px-4 sm:px-6">CGPA</th>
                <th class="py-3.5 px-4 sm:px-6">Primary Domain & Skills</th>
                <th class="py-3.5 px-4 sm:px-6">Placement Status</th>
                <th class="py-3.5 px-4 sm:px-6 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr *ngFor="let s of filteredStudents().slice(0, 30)" class="hover:bg-slate-50/50 transition-colors">
                <!-- Name & Custom Avatar -->
                <td class="py-3.5 px-4 sm:px-6">
                  <div class="flex items-center gap-3">
                    <img
                      *ngIf="s.avatarUrl || s.profilePhoto"
                      [src]="s.avatarUrl || s.profilePhoto"
                      class="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0 shadow-2xs"
                      [alt]="s.fullName"
                      (error)="onImgError($event, s.fullName)"
                    />
                    <div
                      *ngIf="!s.avatarUrl && !s.profilePhoto"
                      class="w-9 h-9 rounded-full bg-linear-to-br from-blue-600 to-indigo-700 text-white font-bold text-xs flex items-center justify-center border border-slate-200 shrink-0 shadow-2xs"
                    >
                      {{ s.fullName.charAt(0) || 'S' }}
                    </div>
                    <div>
                      <h4 class="text-xs font-bold text-slate-900">{{ s.fullName }}</h4>
                      <span class="text-[11px] text-slate-400 font-mono">{{ s.email }}</span>
                    </div>
                  </div>
                </td>

                <!-- Branch & Roll -->
                <td class="py-3.5 px-4 sm:px-6">
                  <span class="font-semibold text-slate-800">{{ s.rollNumber }}</span>
                  <p class="text-[11px] text-slate-500">{{ s.department }}</p>
                </td>

                <!-- CGPA -->
                <td class="py-3.5 px-4 sm:px-6">
                  <span
                    class="font-bold px-2 py-0.5 rounded-md text-xs"
                    [ngClass]="s.cgpa >= 8.5 ? 'bg-emerald-50 text-emerald-700' : s.cgpa >= 7.0 ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700'"
                  >
                    {{ s.cgpa }}
                  </span>
                </td>

                <!-- Domain & Skills -->
                <td class="py-3.5 px-4 sm:px-6">
                  <span class="font-medium text-slate-800">{{ s.preferredDomain }}</span>
                  <div class="flex gap-1 mt-0.5">
                    <span *ngFor="let sk of s.skills.slice(0, 2)" class="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                      {{ sk }}
                    </span>
                  </div>
                </td>

                <!-- Placement Status -->
                <td class="py-3.5 px-4 sm:px-6">
                  <app-badge
                    [variant]="s.placementStatus === 'Selected' ? 'success' : s.placementStatus === 'In Progress' ? 'warning' : 'neutral'"
                    [dot]="true"
                  >
                    {{ s.placementStatus }}
                  </app-badge>
                  <span *ngIf="s.placedCompany" class="block text-[10px] font-semibold text-emerald-800 mt-0.5">
                    {{ s.placedCompany }} ({{ s.placedPackage }})
                  </span>
                </td>

                <!-- Action button -->
                <td class="py-3.5 px-4 sm:px-6 text-right">
                  <button
                    type="button"
                    (click)="selectedStudentForView.set(s)"
                    class="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-colors"
                    title="View Full Profile"
                  >
                    <app-icon name="eye" [size]="16"></app-icon>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div *ngIf="filteredStudents().length > 30" class="p-4 bg-slate-50 border-t border-slate-100 text-center text-xs text-slate-500">
          Showing 30 of {{ filteredStudents().length }} students. Refine search criteria for targeted lists.
        </div>
      </div>

      <!-- Empty State -->
      <app-empty-state
        *ngIf="filteredStudents().length === 0"
        title="No Students Match Filter"
        description="No student records match your active search query, department, or CGPA filter."
        actionLabel="Clear Filters"
        (action)="resetFilters()"
      ></app-empty-state>
    </div>

    <!-- ========================================================================= -->
    <!-- CSV / EXCEL BULK STUDENT IMPORTER MODAL -->
    <!-- ========================================================================= -->
    <div
      *ngIf="showImportModal()"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div class="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        <!-- Modal Header -->
        <div class="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div>
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Institutional Importer</span>
            </div>
            <h3 class="text-xl font-black text-slate-900 mt-0.5">Bulk Import Students (CSV / Excel)</h3>
            <p class="text-xs text-slate-500">
              Provision student credentials, profiles, academic records, and matched profile pictures in bulk.
            </p>
          </div>

          <div class="flex items-center gap-2">
            <!-- Sample Template Download Button -->
            <button
              type="button"
              (click)="downloadSampleTemplate()"
              class="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors"
              title="Download sample template"
            >
              <app-icon name="download" [size]="14"></app-icon>
              <span>Download Sample CSV</span>
            </button>

            <button
              type="button"
              (click)="closeImportModal()"
              class="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <app-icon name="x" [size]="20"></app-icon>
            </button>
          </div>
        </div>

        <!-- Modal Body (Scrollable) -->
        <div class="space-y-6 overflow-y-auto flex-1 pr-1 custom-scrollbar">

          <!-- Dropzones Section (Grid: CSV/Excel on left, Photos on right) -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <!-- 1. CSV / Excel Dropzone -->
            <div
              (dragover)="onDragOverCsv($event)"
              (dragleave)="onDragLeaveCsv($event)"
              (drop)="onDropCsv($event)"
              class="p-5 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer relative"
              [ngClass]="{
                'border-blue-500 bg-blue-50/50': dragOverCsv(),
                'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50': !dragOverCsv()
              }"
            >
              <input
                type="file"
                (change)="handleFileSelect($event)"
                accept=".csv, .xlsx, .xls"
                class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div class="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mb-2.5 shadow-2xs">
                <app-icon name="file-text" [size]="24"></app-icon>
              </div>
              <h4 class="text-xs font-bold text-slate-900">Upload Student Data (.csv or .xlsx)</h4>
              <p class="text-[11px] text-slate-500 mt-1 max-w-xs">
                Drag & drop your Excel spreadsheet or CSV roster here, or click to browse files.
              </p>
              <span *ngIf="parsedStudents().length > 0" class="mt-2 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                ✓ {{ parsedStudents().length }} students loaded
              </span>
            </div>

            <!-- 2. Optional Multi-Photo Matcher Dropzone -->
            <div
              (dragover)="onDragOverPhotos($event)"
              (dragleave)="onDragLeavePhotos($event)"
              (drop)="onDropPhotos($event)"
              class="p-5 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer relative"
              [ngClass]="{
                'border-purple-500 bg-purple-50/50': dragOverPhotos(),
                'border-slate-300 hover:border-purple-400 bg-slate-50/50 hover:bg-slate-50': !dragOverPhotos()
              }"
            >
              <input
                type="file"
                (change)="handlePhotosSelect($event)"
                accept="image/png, image/jpeg, image/jpg, image/webp"
                multiple
                class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div class="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mb-2.5 shadow-2xs">
                <app-icon name="camera" [size]="24"></app-icon>
              </div>
              <h4 class="text-xs font-bold text-slate-900">Match Student Photos (Optional)</h4>
              <p class="text-[11px] text-slate-500 mt-1 max-w-xs">
                Select photos named <code class="bg-purple-100/80 text-purple-900 px-1 py-0.5 rounded text-[10px] font-mono">&lt;roll_number&gt;.jpg/.png</code> to automatically upload & link.
              </p>
              <span *ngIf="matchedPhotosCount() > 0" class="mt-2 text-[10px] font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                ⭐ {{ matchedPhotosCount() }} photos matched
              </span>
            </div>
          </div>

          <!-- Live Preview Table -->
          <div *ngIf="parsedStudents().length > 0" class="space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Data Preview & Verification
                </h4>
                <p class="text-[11px] text-slate-500">
                  {{ parsedStudents().length }} students parsed ({{ validStudentsCount() }} ready, {{ warningStudentsCount() }} warnings, {{ errorStudentsCount() }} errors)
                </p>
              </div>

              <button
                type="button"
                (click)="clearParsedStudents()"
                class="text-xs font-semibold text-rose-600 hover:underline"
              >
                Clear All
              </button>
            </div>

            <div class="rounded-2xl border border-slate-200 overflow-hidden bg-white max-h-72 overflow-y-auto overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] sticky top-0 z-10">
                  <tr>
                    <th class="py-2.5 px-3">Student & Avatar</th>
                    <th class="py-2.5 px-3">Roll Number</th>
                    <th class="py-2.5 px-3">Email</th>
                    <th class="py-2.5 px-3">Branch & CGPA</th>
                    <th class="py-2.5 px-3 text-right">Validation</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr *ngFor="let row of parsedStudents()" class="hover:bg-slate-50/60">
                    <!-- Photo thumbnail + Name -->
                    <td class="py-2.5 px-3">
                      <div class="flex items-center gap-2.5">
                        <img
                          *ngIf="row.avatarUrl"
                          [src]="row.avatarUrl"
                          class="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                          [alt]="row.fullName"
                        />
                        <div
                          *ngIf="!row.avatarUrl"
                          class="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0"
                        >
                          {{ row.fullName.charAt(0) || 'S' }}
                        </div>
                        <div class="min-w-0">
                          <div class="font-bold text-slate-900 truncate">{{ row.fullName }}</div>
                          <div *ngIf="row.localPhotoFile" class="text-[10px] text-purple-600 font-medium">Photo Attached</div>
                        </div>
                      </div>
                    </td>

                    <!-- Roll No -->
                    <td class="py-2.5 px-3 font-semibold text-slate-800">
                      {{ row.rollNumber || 'Auto-generated' }}
                    </td>

                    <!-- Email -->
                    <td class="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                      {{ row.email }}
                    </td>

                    <!-- Branch & CGPA -->
                    <td class="py-2.5 px-3">
                      <div class="truncate max-w-[150px] text-slate-700">{{ row.department }}</div>
                      <span class="text-[10px] font-bold text-emerald-700">CGPA: {{ row.cgpa }}</span>
                    </td>

                    <!-- Status -->
                    <td class="py-2.5 px-3 text-right">
                      <span
                        [ngClass]="{
                          'bg-emerald-100 text-emerald-800': row.status === 'ready',
                          'bg-amber-100 text-amber-800': row.status === 'warning',
                          'bg-rose-100 text-rose-800': row.status === 'error'
                        }"
                        class="px-2 py-0.5 rounded-md text-[10px] font-bold"
                      >
                        {{ row.status === 'ready' ? 'Ready' : row.status === 'warning' ? 'Notice' : 'Error' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Import Progress Bar -->
          <div *ngIf="isImporting()" class="p-4 rounded-2xl bg-blue-50 border border-blue-200 space-y-2">
            <div class="flex justify-between text-xs font-bold text-blue-900">
              <span class="flex items-center gap-1.5">
                <span class="w-3.5 h-3.5 border-2 border-blue-700 border-t-transparent rounded-full animate-spin"></span>
                Importing & Provisioning Student Accounts in Supabase...
              </span>
              <span>{{ importProgress() }}%</span>
            </div>
            <div class="w-full h-2.5 bg-blue-200 rounded-full overflow-hidden">
              <div class="h-full bg-blue-600 rounded-full transition-all duration-300" [style.width]="importProgress() + '%'"></div>
            </div>
          </div>

          <!-- Import Summary Report (Success/Failures) -->
          <div *ngIf="importSummary()" class="p-5 rounded-2xl border space-y-3" [ngClass]="importSummary()!.failed === 0 ? 'bg-emerald-50/70 border-emerald-200' : 'bg-amber-50/70 border-amber-200'">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full" [ngClass]="importSummary()!.failed === 0 ? 'bg-emerald-600' : 'bg-amber-600'"></span>
                <h4 class="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Bulk Import Execution Report
                </h4>
              </div>
              <span class="text-xs font-bold text-slate-700">Total Processed: {{ importSummary()!.total }}</span>
            </div>

            <div class="grid grid-cols-3 gap-3 text-center">
              <div class="p-3 rounded-xl bg-white border border-slate-200">
                <span class="text-[10px] font-bold text-slate-500 uppercase">Created</span>
                <div class="text-xl font-black text-emerald-700 mt-0.5">{{ importSummary()!.created }}</div>
              </div>
              <div class="p-3 rounded-xl bg-white border border-slate-200">
                <span class="text-[10px] font-bold text-slate-500 uppercase">Updated</span>
                <div class="text-xl font-black text-blue-700 mt-0.5">{{ importSummary()!.updated }}</div>
              </div>
              <div class="p-3 rounded-xl bg-white border border-slate-200">
                <span class="text-[10px] font-bold text-slate-500 uppercase">Failed</span>
                <div class="text-xl font-black text-rose-700 mt-0.5">{{ importSummary()!.failed }}</div>
              </div>
            </div>

            <!-- Error List if any -->
            <div *ngIf="importSummary()!.errors.length > 0" class="pt-2">
              <span class="text-[11px] font-bold text-rose-800 block mb-1">Errors Encountered:</span>
              <ul class="text-[11px] text-rose-700 space-y-1 bg-white p-3 rounded-xl border border-rose-200 max-h-32 overflow-y-auto">
                <li *ngFor="let err of importSummary()!.errors">
                  • <strong>{{ err.email }}</strong>: {{ err.reason }}
                </li>
              </ul>
            </div>
          </div>

        </div>

        <!-- Modal Footer -->
        <div class="pt-4 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span class="text-xs text-slate-500">
            {{ parsedStudents().length }} students loaded
          </span>

          <div class="flex items-center gap-2.5">
            <button
              type="button"
              (click)="closeImportModal()"
              class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
            >
              {{ importSummary() ? 'Close' : 'Cancel' }}
            </button>

            <button
              type="button"
              (click)="importAllStudents()"
              [disabled]="parsedStudents().length === 0 || isImporting()"
              class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
            >
              <span *ngIf="isImporting()" class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <app-icon *ngIf="!isImporting()" name="upload" [size]="14"></app-icon>
              <span>{{ isImporting() ? 'Importing...' : 'Import All Students' }}</span>
            </button>
          </div>
        </div>

      </div>
    </div>

    <!-- Student Detail Modal Drawer -->
    <div
      *ngIf="selectedStudentForView()"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4"
    >
      <div class="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div class="flex items-center gap-3">
            <img
              *ngIf="selectedStudentForView()?.avatarUrl || selectedStudentForView()?.profilePhoto"
              [src]="selectedStudentForView()?.avatarUrl || selectedStudentForView()?.profilePhoto"
              class="w-12 h-12 rounded-full object-cover border border-slate-200 shadow-xs"
              (error)="onImgError($event, selectedStudentForView()?.fullName || 'Student')"
            />
            <div
              *ngIf="!selectedStudentForView()?.avatarUrl && !selectedStudentForView()?.profilePhoto"
              class="w-12 h-12 rounded-full bg-linear-to-br from-blue-600 to-indigo-700 text-white font-bold text-base flex items-center justify-center border border-slate-200 shadow-xs"
            >
              {{ selectedStudentForView()?.fullName?.charAt(0) || 'S' }}
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-900">{{ selectedStudentForView()?.fullName }}</h3>
              <p class="text-xs text-slate-500">{{ selectedStudentForView()?.department }} • Roll: {{ selectedStudentForView()?.rollNumber }}</p>
            </div>
          </div>
          <button (click)="selectedStudentForView.set(null)" class="p-1 text-slate-400 hover:text-slate-600">
            <app-icon name="x" [size]="20"></app-icon>
          </button>
        </div>

        <div class="grid grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-2xl text-center text-xs">
          <div>
            <span class="text-slate-400 text-[10px] uppercase font-semibold block">CGPA</span>
            <span class="text-sm font-bold text-slate-900">{{ selectedStudentForView()?.cgpa }}</span>
          </div>
          <div>
            <span class="text-slate-400 text-[10px] uppercase font-semibold block">10th Score</span>
            <span class="text-sm font-bold text-slate-900">{{ selectedStudentForView()?.tenthPercentage }}%</span>
          </div>
          <div>
            <span class="text-slate-400 text-[10px] uppercase font-semibold block">12th Score</span>
            <span class="text-sm font-bold text-slate-900">{{ selectedStudentForView()?.twelfthPercentage }}%</span>
          </div>
        </div>

        <div>
          <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Technical Skills</h4>
          <div class="flex flex-wrap gap-1.5">
            <span
              *ngFor="let skill of selectedStudentForView()?.skills"
              class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-100"
            >
              {{ skill }}
            </span>
          </div>
        </div>

        <div *ngIf="selectedStudentForView()?.bio">
          <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Bio Summary</h4>
          <p class="text-xs text-slate-600 leading-relaxed">{{ selectedStudentForView()?.bio }}</p>
        </div>

        <div class="pt-4 flex justify-end gap-2 border-t border-slate-100">
          <button (click)="selectedStudentForView.set(null)" class="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800">
            Close Drawer
          </button>
        </div>
      </div>
    </div>
  `
})
export class AdminStudentsComponent {
  studentService = inject(StudentService);
  supabaseService = inject(SupabaseService);
  toast = inject(ToastService);

  searchQuery = '';
  selectedDepartment = 'all';
  selectedStatus = 'all';

  selectedStudentForView = signal<Student | null>(null);

  // Bulk Import Signals
  showImportModal = signal(false);
  parsedStudents = signal<ParsedImportStudent[]>([]);
  isImporting = signal(false);
  importProgress = signal(0);
  importSummary = signal<ImportSummary | null>(null);
  dragOverCsv = signal(false);
  dragOverPhotos = signal(false);

  // Roll Number -> File & Preview URL map
  photoMap = new Map<string, { file: File; previewUrl: string }>();

  filteredStudents = computed(() => {
    let list = this.studentService.students();
    const q = this.searchQuery.toLowerCase().trim();
    const dept = this.selectedDepartment;
    const status = this.selectedStatus;

    if (q) {
      list = list.filter(s =>
        s.fullName.toLowerCase().includes(q) ||
        s.rollNumber.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.skills.some(sk => sk.toLowerCase().includes(q))
      );
    }

    if (dept !== 'all') {
      list = list.filter(s => s.department.toLowerCase() === dept.toLowerCase());
    }

    if (status !== 'all') {
      list = list.filter(s => s.placementStatus.toLowerCase() === status.toLowerCase());
    }

    return list;
  });

  validStudentsCount = computed(() => this.parsedStudents().filter(s => s.status === 'ready').length);
  warningStudentsCount = computed(() => this.parsedStudents().filter(s => s.status === 'warning').length);
  errorStudentsCount = computed(() => this.parsedStudents().filter(s => s.status === 'error').length);
  matchedPhotosCount = computed(() => this.parsedStudents().filter(s => !!s.avatarUrl).length);

  openImportModal() {
    this.showImportModal.set(true);
    this.importSummary.set(null);
    this.importProgress.set(0);
  }

  closeImportModal() {
    this.showImportModal.set(false);
    this.clearParsedStudents();
  }

  clearParsedStudents() {
    this.parsedStudents.set([]);
    this.photoMap.clear();
    this.importSummary.set(null);
    this.importProgress.set(0);
  }

  onDragOverCsv(e: DragEvent) {
    e.preventDefault();
    this.dragOverCsv.set(true);
  }

  onDragLeaveCsv(e: DragEvent) {
    e.preventDefault();
    this.dragOverCsv.set(false);
  }

  onDropCsv(e: DragEvent) {
    e.preventDefault();
    this.dragOverCsv.set(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      this.parseSpreadsheetFile(file);
    }
  }

  handleFileSelect(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      this.parseSpreadsheetFile(file);
    }
  }

  parseSpreadsheetFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (rawRows.length === 0) {
          this.toast.error('Empty File', 'The selected file contains no data rows.');
          return;
        }

        const parsed: ParsedImportStudent[] = rawRows.map((r, idx) => {
          // Normalize column lookups
          const getVal = (aliases: string[]) => {
            for (const a of aliases) {
              for (const key of Object.keys(r)) {
                if (key.trim().toLowerCase() === a.trim().toLowerCase() && r[key] !== '') {
                  return String(r[key]).trim();
                }
              }
            }
            return '';
          };

          const fullName = getVal(['full_name', 'full name', 'name', 'student name']);
          const email = getVal(['email', 'email address', 'email_address']).toLowerCase();
          const rollNumber = getVal(['roll_number', 'roll number', 'roll no', 'roll_no', 'roll']);
          const department = getVal(['department', 'branch', 'dept']) || 'Computer Science & Engineering';
          const cgpaStr = getVal(['cgpa', 'gpa', 'score']);
          const phone = getVal(['phone', 'mobile', 'contact', 'phone number']);
          const avatarUrl = getVal(['avatar_url', 'avatar', 'photo_url', 'photo', 'profile_photo']);
          const password = getVal(['password', 'pwd']) || 'Student@2026';

          const cgpa = parseFloat(cgpaStr) || 7.50;

          // Check for matching photo uploaded via image picker
          const normRoll = rollNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
          const matchedPhoto = normRoll ? this.photoMap.get(normRoll) : undefined;

          let status: 'ready' | 'warning' | 'error' = 'ready';
          let statusReason = '';

          if (!email || !email.includes('@')) {
            status = 'error';
            statusReason = 'Missing or invalid email address';
          } else if (!fullName) {
            status = 'warning';
            statusReason = 'Name missing (will derive from email)';
          }

          return {
            id: `row-${idx}-${Date.now()}`,
            fullName: fullName || email.split('@')[0],
            email,
            rollNumber,
            department,
            cgpa,
            phone,
            avatarUrl: avatarUrl || matchedPhoto?.previewUrl,
            localPhotoFile: matchedPhoto?.file,
            password,
            status,
            statusReason
          };
        });

        this.parsedStudents.set(parsed);
        this.toast.success('File Parsed', `Extracted ${parsed.length} student rows from ${file.name}.`);
      } catch (err: any) {
        console.error('Spreadsheet parse error:', err);
        this.toast.error('Parse Error', 'Could not parse spreadsheet: ' + (err.message || 'Unknown format'));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  onDragOverPhotos(e: DragEvent) {
    e.preventDefault();
    this.dragOverPhotos.set(true);
  }

  onDragLeavePhotos(e: DragEvent) {
    e.preventDefault();
    this.dragOverPhotos.set(false);
  }

  onDropPhotos(e: DragEvent) {
    e.preventDefault();
    this.dragOverPhotos.set(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processPhotoFiles(Array.from(files));
    }
  }

  handlePhotosSelect(event: any) {
    const files = event.target.files;
    if (files && files.length > 0) {
      this.processPhotoFiles(Array.from(files));
    }
  }

  processPhotoFiles(files: File[]) {
    let matchedCount = 0;

    for (const f of files) {
      const nameWithoutExt = f.name.substring(0, f.name.lastIndexOf('.'));
      const normKey = nameWithoutExt.toLowerCase().replace(/[^a-z0-9]/g, '');
      const previewUrl = URL.createObjectURL(f);
      this.photoMap.set(normKey, { file: f, previewUrl });
    }

    // Match with parsed students
    const current = this.parsedStudents();
    if (current.length > 0) {
      const updated = current.map(s => {
        const normRoll = s.rollNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
        const photo = this.photoMap.get(normRoll);
        if (photo) {
          matchedCount++;
          return {
            ...s,
            avatarUrl: photo.previewUrl,
            localPhotoFile: photo.file
          };
        }
        return s;
      });
      this.parsedStudents.set(updated);
    }

    this.toast.info('Photos Loaded', `Loaded ${files.length} student photos into matcher.`);
  }

  async importAllStudents() {
    const students = this.parsedStudents();
    if (students.length === 0) return;

    this.isImporting.set(true);
    this.importProgress.set(10);

    try {
      // Step 1: Upload any local photo files to Supabase Storage 'avatars' bucket
      const studentsWithLocalPhotos = students.filter(s => s.localPhotoFile);
      const totalPhotos = studentsWithLocalPhotos.length;
      let uploadedPhotos = 0;

      for (const s of students) {
        if (s.localPhotoFile) {
          try {
            const ext = s.localPhotoFile.name.split('.').pop() || 'png';
            const fileName = `student_${s.rollNumber || 'id'}_${Date.now()}.${ext}`;
            const res = await this.supabaseService.uploadFile('avatars', fileName, s.localPhotoFile);
            if (res?.url) {
              s.avatarUrl = res.url;
            }
          } catch (err) {
            console.warn('Could not upload student avatar:', s.rollNumber, err);
          }
          uploadedPhotos++;
          this.importProgress.set(10 + Math.round((uploadedPhotos / Math.max(totalPhotos, 1)) * 30));
        }
      }

      this.importProgress.set(45);

      // Step 2: Prepare payload for admin_bulk_create_students
      const payload = students.map(s => ({
        full_name: s.fullName,
        email: s.email,
        roll_number: s.rollNumber,
        department: s.department,
        cgpa: s.cgpa,
        phone: s.phone || '',
        avatar_url: s.avatarUrl || '',
        password: s.password || 'Student@2026'
      }));

      this.importProgress.set(65);

      // Step 3: Call Supabase RPC
      const result = await this.studentService.bulkImportStudents(payload);
      this.importProgress.set(100);

      if (!result.success) {
        this.toast.error('Import Failed', result.error || 'Database error occurred.');
        return;
      }

      const rows: any[] = Array.isArray(result.data) ? result.data : [];
      let created = 0;
      let updated = 0;
      let failed = 0;
      const errors: { email: string; rollNumber?: string; reason: string }[] = [];

      for (const r of rows) {
        if (r.status === 'created') created++;
        else if (r.status === 'updated') updated++;
        else {
          failed++;
          errors.push({ email: r.email, rollNumber: r.roll_number, reason: r.reason || 'Unknown error' });
        }
      }

      this.importSummary.set({
        total: rows.length,
        created,
        updated,
        failed,
        errors
      });

      if (failed === 0) {
        this.toast.success('Bulk Import Complete', `Successfully provisioned ${created} new students and updated ${updated} existing records.`);
      } else {
        this.toast.warning('Import Completed with Warnings', `${created + updated} succeeded, ${failed} failed.`);
      }
    } catch (err: any) {
      console.error('Bulk import exception:', err);
      this.toast.error('Import Error', err.message || 'An unexpected error occurred during bulk import.');
    } finally {
      this.isImporting.set(false);
    }
  }

  downloadSampleTemplate() {
    const sampleData = [
      {
        'Full Name': 'Aarav Sharma',
        'Email': 'aarav.sharma@careernexus.edu',
        'Roll Number': '23CS101',
        'Department': 'Computer Science & Engineering',
        'CGPA': 8.75,
        'Phone': '9876543210',
        'Avatar URL': '',
        'Password': 'Student@2026'
      },
      {
        'Full Name': 'Diya Patel',
        'Email': 'diya.patel@careernexus.edu',
        'Roll Number': '23EC204',
        'Department': 'Electronics & Communication',
        'CGPA': 9.12,
        'Phone': '9876543211',
        'Avatar URL': '',
        'Password': 'Student@2026'
      },
      {
        'Full Name': 'Rohan Verma',
        'Email': 'rohan.verma@careernexus.edu',
        'Roll Number': '23IT305',
        'Department': 'Information Technology',
        'CGPA': 7.85,
        'Phone': '9876543212',
        'Avatar URL': '',
        'Password': 'Student@2026'
      },
      {
        'Full Name': 'Ananya Iyer',
        'Email': 'ananya.iyer@careernexus.edu',
        'Roll Number': '23ME402',
        'Department': 'Mechanical Engineering',
        'CGPA': 8.20,
        'Phone': '9876543213',
        'Avatar URL': '',
        'Password': 'Student@2026'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
    XLSX.writeFile(workbook, 'CareerNexus_Student_Bulk_Import_Template.csv');
  }

  exportStudentsToCsv() {
    const list = this.filteredStudents();
    const headers = ['Roll Number', 'Full Name', 'Department', 'CGPA', '10th %', '12th %', 'Placement Status', 'Placed Company', 'Package', 'Email', 'Skills', 'Avatar URL'];
    const rows = list.map(s => [
      s.rollNumber,
      `"${s.fullName}"`,
      `"${s.department}"`,
      s.cgpa,
      s.tenthPercentage,
      s.twelfthPercentage,
      s.placementStatus,
      s.placedCompany || 'N/A',
      s.placedPackage || 'N/A',
      s.email,
      `"${s.skills.join(', ')}"`,
      `"${s.avatarUrl || s.profilePhoto || ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `CareerNexus_Student_Roster_2026_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  onImgError(event: Event, name: string) {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=fff&bold=true`;
    }
  }

  resetFilters() {
    this.searchQuery = '';
    this.selectedDepartment = 'all';
    this.selectedStatus = 'all';
  }
}
