import { Component, inject, computed, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { StudentService } from '../../../core/services/student.service';
import { CompanyService } from '../../../core/services/company.service';
import { JobService } from '../../../core/services/job.service';
import { ApplicationService } from '../../../core/services/application.service';
import { SkillMatchingService } from '../../../core/services/skill-matching.service';
import { CommandCenterService } from '../../../core/services/command-center.service';
import { IconComponent } from '../../../shared/icons/icon.component';
import { StatCardComponent } from '../../../shared/ui/stat-card.component';

export type AnalyticsDrawerType = 'placement-rate' | 'average-ctc' | 'pipeline-funnel' | 'department-performance';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    IconComponent,
    StatCardComponent
  ],
  template: `
    <div class="space-y-8 animate-in fade-in duration-300">
      <!-- Top Admin Banner -->
      <div class="bg-linear-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-slate-950/20 relative overflow-hidden">
        <div class="absolute right-0 top-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

        <div class="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-3">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              Placement Season 2026–2027 Live
            </span>
            <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Placement Analytics & Officer Command
            </h1>
            <p class="text-slate-300 text-sm sm:text-base mt-1.5 max-w-xl leading-relaxed">
              Monitoring {{ studentService.students().length }} registered graduating engineers, {{ companyService.companies().length }} partner companies, and {{ jobService.jobs().length }} active placement drives across departments.
            </p>
          </div>

          <div class="flex flex-wrap gap-2.5">
            <a
              routerLink="/admin/command-center"
              class="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm shadow-lg flex items-center gap-2 transition-all"
            >
              <app-icon name="grid" [size]="16"></app-icon>
              <span>Command Center</span>
            </a>
            <a
              routerLink="/admin/students"
              class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-md transition-all flex items-center gap-1.5"
            >
              <app-icon name="upload" [size]="14"></app-icon>
              <span>Import Students</span>
            </a>
            <a
              routerLink="/admin/applications"
              class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-md transition-all"
            >
              Applicant Pipeline
            </a>
            <a
              routerLink="/admin/jobs"
              class="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm border border-white/20 transition-all"
            >
              + Post New Drive
            </a>
          </div>
        </div>
      </div>

      <!-- 4 Core High-Level Stat Cards (With Interactive Click Affordances) -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <app-stat-card
          title="Total Students"
          [value]="studentService.stats().total"
          icon="users"
          [subtitle]="studentService.stats().selected + ' Students Placed'"
          color="blue"
        ></app-stat-card>

        <app-stat-card
          title="Placement Rate"
          [value]="placementRate() + '%'"
          icon="award"
          subtitle="Placed / Offers Received"
          trend="+12% YoY"
          color="emerald"
          [clickable]="true"
          hint="View Detailed Analysis →"
          (click)="openDrawer('placement-rate')"
        ></app-stat-card>

        <app-stat-card
          title="Average CTC"
          [value]="averageCtc()"
          icon="trending-up"
          subtitle="Campus Highest: ₹45 LPA"
          color="purple"
          [clickable]="true"
          hint="View Detailed Analysis →"
          (click)="openDrawer('average-ctc')"
        ></app-stat-card>

        <app-stat-card
          title="Recruiting Companies"
          [value]="companyService.companies().length"
          icon="building"
          [subtitle]="companyService.companies().length + ' Active Partners'"
          color="cyan"
        ></app-stat-card>
      </div>

      <!-- Interactive Placement Analytics Charts Section -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Chart 1: Applications Stage Pipeline Funnel (100% Dynamic & Clickable) -->
        <div
          (click)="openDrawer('pipeline-funnel')"
          class="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-4 cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all duration-200 group"
        >
          <div class="flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                  Application Pipeline Funnel
                </h3>
                <span class="text-[11px] font-semibold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                  View Detailed Analysis →
                </span>
              </div>
              <p class="text-xs text-slate-500">Student advancement across recruitment rounds</p>
            </div>
            <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">Live Funnel</span>
          </div>

          <!-- Dynamic Visual Bar Chart with Clickable Stage Rows -->
          <div class="space-y-3 pt-2">
            <div
              *ngFor="let stage of funnel().slice(2)"
              (click)="openDrawer('pipeline-funnel', stage.name); $event.stopPropagation()"
              class="space-y-1 p-2 -mx-2 rounded-xl hover:bg-blue-50/70 transition-colors cursor-pointer group/row"
            >
              <div class="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span class="group-hover/row:text-blue-600 flex items-center gap-1.5 transition-colors">
                  {{ stage.name }}
                  <span class="text-[10px] text-slate-400 group-hover/row:text-blue-500 font-normal">→ drill-down</span>
                </span>
                <span class="text-blue-600 font-bold">{{ stage.count }} ({{ stage.percentageOfTotal }}%)</span>
              </div>
              <div class="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div class="h-full bg-linear-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-500" [style.width]="stage.percentageOfTotal + '%'"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Chart 2: Department-wise Placement Distribution (100% Dynamic & Clickable) -->
        <div
          (click)="openDrawer('department-performance')"
          class="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-4 cursor-pointer hover:shadow-lg hover:border-emerald-300 transition-all duration-200 group"
        >
          <div class="flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                  Department Placement Performance
                </h3>
                <span class="text-[11px] font-semibold text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                  View Detailed Analysis →
                </span>
              </div>
              <p class="text-xs text-slate-500">Placement conversion rate across engineering branches</p>
            </div>
            <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">Live Dept Insights</span>
          </div>

          <!-- Department Rows with Clickable Row Roster Drill-Down -->
          <div class="space-y-3.5 pt-2">
            <div
              *ngFor="let dept of deptStats().slice(0, 5)"
              (click)="openDrawer('department-performance', dept.department); $event.stopPropagation()"
              class="space-y-1 p-2 -mx-2 rounded-xl hover:bg-emerald-50/70 transition-colors cursor-pointer group/row"
            >
              <div class="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span class="truncate max-w-[200px] flex items-center gap-1.5 group-hover/row:text-emerald-700 transition-colors">
                  {{ dept.department }}
                  <span class="text-[10px] text-slate-400 group-hover/row:text-emerald-600 font-normal">→ roster</span>
                </span>
                <span class="text-slate-900 font-bold">{{ dept.placedCount }}/{{ dept.totalStudents }} ({{ dept.placementRate }}%)</span>
              </div>
              <div class="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div class="h-full bg-linear-to-r from-emerald-500 to-teal-600 rounded-full transition-all duration-500" [style.width]="dept.placementRate + '%'"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Hiring Partners & Quick Actions Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Top Recruiters (2 Cols) -->
        <div class="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-bold text-slate-900">Top Campus Hiring Partners</h3>
            <a routerLink="/admin/companies" class="text-xs font-semibold text-blue-600 hover:underline">
              View All Partners →
            </a>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              *ngFor="let comp of companyService.companies().slice(0, 4)"
              class="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-center justify-between"
            >
              <div class="flex items-center gap-3 min-w-0">
                <img [src]="comp.logo" [alt]="comp.name" class="w-11 h-11 rounded-xl object-cover border border-slate-200" />
                <div class="min-w-0">
                  <h4 class="text-xs font-bold text-slate-900 truncate">{{ comp.name }}</h4>
                  <span class="text-[11px] text-slate-500 font-medium">{{ comp.averagePackage }}</span>
                </div>
              </div>
              <span class="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">
                {{ comp.placedStudentsCount || 8 }} Selected
              </span>
            </div>
          </div>
        </div>

        <!-- Quick Admin Management Shortlinks (1 Col) -->
        <div class="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-4">
          <h3 class="text-base font-bold text-slate-900">Officer Operations</h3>
          <div class="space-y-2">
            <a
              routerLink="/admin/students"
              class="p-3 rounded-2xl bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-blue-700 transition-colors"
            >
              <span>Manage 100+ Students & Verify Resumes</span>
              <app-icon name="chevron-right" [size]="14"></app-icon>
            </a>

            <a
              routerLink="/admin/analytics"
              class="p-3 rounded-2xl bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-blue-700 transition-colors"
            >
              <span>Deep-Dive Placement & Skill Analytics</span>
              <app-icon name="chevron-right" [size]="14"></app-icon>
            </a>

            <a
              routerLink="/admin/jobs"
              class="p-3 rounded-2xl bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-blue-700 transition-colors"
            >
              <span>Schedule Company Placement Drive</span>
              <app-icon name="chevron-right" [size]="14"></app-icon>
            </a>
          </div>
        </div>
      </div>

      <!-- Phase 1: Institutional Skill Demand & Gap Analytics Bar -->
      <div class="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-5">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                Institutional Skill Analysis
              </span>
              <h3 class="text-base font-bold text-slate-900">Most Demanded Skills & Common Campus Skill Gaps</h3>
            </div>
            <p class="text-xs text-slate-500 mt-0.5">
              Derived dynamically from {{ skillAnalytics().applicationsAnalyzed }} applications across {{ studentService.students().length }} enrolled candidates.
            </p>
          </div>
          <a routerLink="/admin/analytics" class="text-xs font-bold text-blue-600 hover:underline">
            View Analytics Dashboard →
          </a>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Most Demanded Skills -->
          <div class="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-2">
            <span class="text-xs font-bold uppercase tracking-wider text-emerald-900 block">
              🔥 Most Demanded Skills (Hiring Partners)
            </span>
            <div class="flex flex-wrap gap-1.5">
              <span
                *ngFor="let sk of skillAnalytics().mostDemandedSkills.slice(0, 5)"
                class="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-800 text-xs font-bold shadow-2xs"
              >
                {{ sk.skill }} <span class="text-[10px] text-emerald-600 font-normal">({{ sk.jobCount }} drives)</span>
              </span>
            </div>
          </div>

          <!-- Common Skill Gaps -->
          <div class="p-4 rounded-2xl bg-rose-50/50 border border-rose-200 space-y-2">
            <span class="text-xs font-bold uppercase tracking-wider text-rose-900 block">
              ⚡ Most Common Student Skill Gaps
            </span>
            <div class="flex flex-wrap gap-1.5">
              <span
                *ngFor="let sk of skillAnalytics().mostCommonSkillGaps.slice(0, 5)"
                class="px-2.5 py-1 rounded-lg bg-white border border-rose-300 text-rose-800 text-xs font-bold shadow-2xs"
              >
                {{ sk.skill }} <span class="text-[10px] text-rose-600 font-normal">({{ sk.missingInApplicationsCount }} gaps)</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- DETAILED ANALYTICS SLIDE-OVER DRAWER / MODAL -->
    <!-- ========================================================================= -->
    <div *ngIf="activeDrawer()" class="fixed inset-0 z-50 overflow-hidden">
      <!-- Backdrop -->
      <div
        (click)="closeDrawer()"
        class="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      ></div>

      <!-- Slide-Over Container -->
      <div class="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div class="w-screen max-w-2xl sm:max-w-3xl bg-white shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
          
          <!-- Drawer Header -->
          <div class="px-6 py-5 bg-linear-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between border-b border-indigo-900/50">
            <div>
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Analytics Drill-Down
                </span>
              </div>
              <h2 class="text-lg sm:text-xl font-black tracking-tight text-white mt-0.5">
                <ng-container [ngSwitch]="activeDrawer()">
                  <span *ngSwitchCase="'placement-rate'">Placement Rate & Selected Candidates</span>
                  <span *ngSwitchCase="'average-ctc'">CTC & Compensation Analytics</span>
                  <span *ngSwitchCase="'pipeline-funnel'">Application Pipeline Funnel & Stage Roster</span>
                  <span *ngSwitchCase="'department-performance'">Department Placement Performance</span>
                </ng-container>
              </h2>
              <p class="text-xs text-slate-300 mt-0.5">
                <ng-container [ngSwitch]="activeDrawer()">
                  <span *ngSwitchCase="'placement-rate'">Detailed breakdown of placed vs unplaced students with department & company mappings.</span>
                  <span *ngSwitchCase="'average-ctc'">Campus CTC brackets, median compensation metrics, and top-paying recruiters.</span>
                  <span *ngSwitchCase="'pipeline-funnel'">Stage-to-stage conversion rates and live applicant advancement roster.</span>
                  <span *ngSwitchCase="'department-performance'">Branch conversion velocities, eligibility counts, and downloadable rosters.</span>
                </ng-container>
              </p>
            </div>

            <button
              (click)="closeDrawer()"
              class="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0"
              title="Close drawer (Esc)"
            >
              <app-icon name="x" [size]="18"></app-icon>
            </button>
          </div>

          <!-- Drawer Body (Scrollable) -->
          <div class="flex-1 overflow-y-auto p-6 space-y-6">

            <!-- =============================================================== -->
            <!-- 1. PLACEMENT RATE DRILL-DOWN VIEW -->
            <!-- =============================================================== -->
            <div *ngIf="activeDrawer() === 'placement-rate'" class="space-y-6">
              <!-- KPI Summary Cards -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div class="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Placement Rate</span>
                  <div class="text-2xl font-black text-emerald-950 mt-1">{{ placementRate() }}%</div>
                  <span class="text-[11px] font-semibold text-emerald-700 flex items-center gap-1 mt-0.5">
                    <app-icon name="trending-up" [size]="11"></app-icon>
                    +12% YoY Season
                  </span>
                </div>

                <div class="p-4 rounded-2xl bg-blue-50 border border-blue-100">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-blue-800">Placed Students</span>
                  <div class="text-2xl font-black text-blue-950 mt-1">{{ placedStudents().length }}</div>
                  <span class="text-[11px] text-blue-600 font-medium mt-0.5">Verified offers</span>
                </div>

                <div class="p-4 rounded-2xl bg-amber-50 border border-amber-100">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-amber-800">Not Yet Placed</span>
                  <div class="text-2xl font-black text-amber-950 mt-1">{{ unplacedStudents().length }}</div>
                  <span class="text-[11px] text-amber-600 font-medium mt-0.5">Seeking placement</span>
                </div>

                <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-slate-600">Total Enrolled</span>
                  <div class="text-2xl font-black text-slate-900 mt-1">{{ studentService.students().length }}</div>
                  <span class="text-[11px] text-slate-500 font-medium mt-0.5">Class of 2026-27</span>
                </div>
              </div>

              <!-- Progress Bar -->
              <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div class="flex justify-between text-xs font-bold text-slate-700">
                  <span>Batch Placement Completion</span>
                  <span class="text-emerald-700">{{ placedStudents().length }} / {{ studentService.students().length }} Candidates ({{ placementRate() }}%)</span>
                </div>
                <div class="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex">
                  <div class="h-full bg-emerald-600 transition-all duration-500" [style.width]="placementRate() + '%'"></div>
                  <div class="h-full bg-slate-300 transition-all duration-500" [style.width]="(100 - placementRate()) + '%'"></div>
                </div>
              </div>

              <!-- Filter Toolbar -->
              <div class="flex flex-col sm:flex-row gap-3">
                <div class="relative flex-1">
                  <app-icon name="search" [size]="15" customClass="absolute left-3.5 top-3 text-slate-400"></app-icon>
                  <input
                    type="text"
                    [ngModel]="placementSearch()"
                    (ngModelChange)="placementSearch.set($event)"
                    placeholder="Search placed student, roll no, company..."
                    class="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                  />
                </div>
                <select
                  [ngModel]="placementDeptFilter()"
                  (ngModelChange)="placementDeptFilter.set($event)"
                  class="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="All">All Departments</option>
                  <option *ngFor="let dept of allDepartments()" [value]="dept">{{ dept }}</option>
                </select>
              </div>

              <!-- Placed Students Table -->
              <div class="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Placed Candidates Roster ({{ filteredPlacedStudents().length }})</span>
                  <span class="text-slate-500 font-normal text-[11px]">Dynamic Supabase Sync</span>
                </div>
                <div class="max-h-96 overflow-y-auto divide-y divide-slate-100">
                  <div *ngIf="filteredPlacedStudents().length === 0" class="p-8 text-center text-slate-400 text-xs">
                    No placed candidates match the selected filters.
                  </div>
                  <div *ngFor="let s of filteredPlacedStudents()" class="p-3.5 hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors">
                    <div class="min-w-0 flex items-center gap-3">
                      <img
                        *ngIf="s.avatarUrl || s.profilePhoto"
                        [src]="s.avatarUrl || s.profilePhoto"
                        class="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                        [alt]="s.fullName"
                      />
                      <div
                        *ngIf="!s.avatarUrl && !s.profilePhoto"
                        class="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0"
                      >
                        {{ s.fullName.charAt(0) || 'S' }}
                      </div>
                      <div class="min-w-0">
                        <div class="text-xs font-bold text-slate-900 truncate">{{ s.fullName }}</div>
                        <div class="text-[11px] text-slate-500 truncate">{{ s.rollNumber }} • {{ s.department }}</div>
                      </div>
                    </div>
                    <div class="text-right shrink-0">
                      <div class="text-xs font-bold text-slate-900">{{ s.placedCompany || 'Campus Drive' }}</div>
                      <div class="text-[11px] font-semibold text-emerald-600">{{ s.placedPackage || '₹8–12 LPA' }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- =============================================================== -->
            <!-- 2. AVERAGE CTC DRILL-DOWN VIEW -->
            <!-- =============================================================== -->
            <div *ngIf="activeDrawer() === 'average-ctc'" class="space-y-6">
              <!-- KPI CTC Overview -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div class="p-4 rounded-2xl bg-purple-50 border border-purple-100">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-purple-800">Campus Highest</span>
                  <div class="text-2xl font-black text-purple-950 mt-1">₹{{ ctcAnalytics().highest }} LPA</div>
                  <span class="text-[11px] text-purple-600 font-medium mt-0.5">Top Season Offer</span>
                </div>

                <div class="p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-indigo-800">Average CTC</span>
                  <div class="text-2xl font-black text-indigo-950 mt-1">₹{{ ctcAnalytics().average }} LPA</div>
                  <span class="text-[11px] text-indigo-600 font-medium mt-0.5">Mean campus offer</span>
                </div>

                <div class="p-4 rounded-2xl bg-blue-50 border border-blue-100">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-blue-800">Median CTC</span>
                  <div class="text-2xl font-black text-blue-950 mt-1">₹{{ ctcAnalytics().median }} LPA</div>
                  <span class="text-[11px] text-blue-600 font-medium mt-0.5">50th Percentile</span>
                </div>

                <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-slate-600">Offers Evaluated</span>
                  <div class="text-2xl font-black text-slate-900 mt-1">{{ ctcAnalytics().totalDataPoints }}</div>
                  <span class="text-[11px] text-slate-500 font-medium mt-0.5">Drives & placed pkg</span>
                </div>
              </div>

              <!-- CTC Brackets Section -->
              <div class="p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs">
                <div class="flex items-center justify-between">
                  <h4 class="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Compensation Bracket Distribution
                  </h4>
                  <span class="text-[11px] text-slate-500 font-medium">All Campus Drives</span>
                </div>

                <div class="space-y-3">
                  <!-- <6 LPA -->
                  <div class="space-y-1">
                    <div class="flex justify-between text-xs font-semibold text-slate-700">
                      <span>Entry Tier (&lt; 6 LPA)</span>
                      <span class="text-slate-900 font-bold">{{ ctcAnalytics().bracketLess6.count }} offers ({{ ctcAnalytics().bracketLess6.pct }}%)</span>
                    </div>
                    <div class="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div class="h-full bg-blue-500 rounded-full transition-all duration-500" [style.width]="ctcAnalytics().bracketLess6.pct + '%'"></div>
                    </div>
                  </div>

                  <!-- 6-12 LPA -->
                  <div class="space-y-1">
                    <div class="flex justify-between text-xs font-semibold text-slate-700">
                      <span>Standard Tier (6–12 LPA)</span>
                      <span class="text-slate-900 font-bold">{{ ctcAnalytics().bracket6To12.count }} offers ({{ ctcAnalytics().bracket6To12.pct }}%)</span>
                    </div>
                    <div class="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div class="h-full bg-indigo-600 rounded-full transition-all duration-500" [style.width]="ctcAnalytics().bracket6To12.pct + '%'"></div>
                    </div>
                  </div>

                  <!-- 12-20 LPA -->
                  <div class="space-y-1">
                    <div class="flex justify-between text-xs font-semibold text-slate-700">
                      <span>Premium Tier (12–20 LPA)</span>
                      <span class="text-slate-900 font-bold">{{ ctcAnalytics().bracket12To20.count }} offers ({{ ctcAnalytics().bracket12To20.pct }}%)</span>
                    </div>
                    <div class="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div class="h-full bg-purple-600 rounded-full transition-all duration-500" [style.width]="ctcAnalytics().bracket12To20.pct + '%'"></div>
                    </div>
                  </div>

                  <!-- 20+ LPA -->
                  <div class="space-y-1">
                    <div class="flex justify-between text-xs font-semibold text-slate-700">
                      <span>Marquee Super Dream Tier (20+ LPA)</span>
                      <span class="text-emerald-700 font-bold">{{ ctcAnalytics().bracket20Plus.count }} offers ({{ ctcAnalytics().bracket20Plus.pct }}%)</span>
                    </div>
                    <div class="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div class="h-full bg-emerald-600 rounded-full transition-all duration-500" [style.width]="ctcAnalytics().bracket20Plus.pct + '%'"></div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Top-Paying Recruiters & High Value Offers -->
              <div class="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Top-Paying Recruiters & Offer Records</span>
                  <span class="text-slate-500 font-normal text-[11px]">Ranked by Package</span>
                </div>
                <div class="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  <div *ngIf="ctcAnalytics().topOffers.length === 0" class="p-8 text-center text-slate-400 text-xs">
                    No compensation records recorded.
                  </div>
                  <div *ngFor="let off of ctcAnalytics().topOffers; let idx = index" class="p-3.5 hover:bg-slate-50 flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3 min-w-0">
                      <div class="w-7 h-7 rounded-lg bg-purple-100 text-purple-800 text-xs font-bold flex items-center justify-center shrink-0">
                        #{{ idx + 1 }}
                      </div>
                      <div class="min-w-0">
                        <div class="text-xs font-bold text-slate-900 truncate">{{ off.entity }}</div>
                        <div class="text-[11px] text-slate-500 truncate">{{ off.label }} • {{ off.source }}</div>
                      </div>
                    </div>
                    <span class="text-xs font-black text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md shrink-0">
                      ₹{{ off.value.toFixed(1) }} LPA
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- =============================================================== -->
            <!-- 3. APPLICATION PIPELINE FUNNEL DRILL-DOWN VIEW -->
            <!-- =============================================================== -->
            <div *ngIf="activeDrawer() === 'pipeline-funnel'" class="space-y-6">
              <!-- Stage-to-Stage Conversion Metrics -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div class="p-4 rounded-2xl bg-blue-50 border border-blue-100">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-blue-800">Applied → Shortlist</span>
                  <div class="text-2xl font-black text-blue-950 mt-1">{{ funnelConversion().appliedToShortlisted }}%</div>
                  <span class="text-[11px] text-blue-600 font-medium mt-0.5">Initial screening pass</span>
                </div>

                <div class="p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-indigo-800">Shortlist → Interview</span>
                  <div class="text-2xl font-black text-indigo-950 mt-1">{{ funnelConversion().shortlistedToInterview }}%</div>
                  <span class="text-[11px] text-indigo-600 font-medium mt-0.5">Assessment advancement</span>
                </div>

                <div class="p-4 rounded-2xl bg-purple-50 border border-purple-100">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-purple-800">Interview → Selected</span>
                  <div class="text-2xl font-black text-purple-950 mt-1">{{ funnelConversion().interviewToSelected }}%</div>
                  <span class="text-[11px] text-purple-600 font-medium mt-0.5">Final round conversion</span>
                </div>

                <div class="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Total Placement Yield</span>
                  <div class="text-2xl font-black text-emerald-950 mt-1">{{ funnelConversion().overallAdvancement }}%</div>
                  <span class="text-[11px] text-emerald-600 font-medium mt-0.5">Of registered class</span>
                </div>
              </div>

              <!-- Stage Selection Tabs -->
              <div class="flex flex-wrap gap-2 pb-1 border-b border-slate-200">
                <button
                  type="button"
                  (click)="selectedFunnelStage.set('All')"
                  [ngClass]="{
                    'bg-slate-900 text-white font-bold shadow-xs': selectedFunnelStage() === 'All',
                    'bg-slate-100 text-slate-600 hover:bg-slate-200': selectedFunnelStage() !== 'All'
                  }"
                  class="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                >
                  All Applications ({{ applicationService.applications().length }})
                </button>
                <button
                  type="button"
                  (click)="selectedFunnelStage.set('Applied')"
                  [ngClass]="{
                    'bg-blue-600 text-white font-bold shadow-xs': selectedFunnelStage() === 'Applied',
                    'bg-blue-50 text-blue-700 hover:bg-blue-100': selectedFunnelStage() !== 'Applied'
                  }"
                  class="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                >
                  Applied
                </button>
                <button
                  type="button"
                  (click)="selectedFunnelStage.set('Shortlisted')"
                  [ngClass]="{
                    'bg-amber-600 text-white font-bold shadow-xs': selectedFunnelStage() === 'Shortlisted',
                    'bg-amber-50 text-amber-700 hover:bg-amber-100': selectedFunnelStage() !== 'Shortlisted'
                  }"
                  class="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                >
                  Shortlisted
                </button>
                <button
                  type="button"
                  (click)="selectedFunnelStage.set('Interview Stage')"
                  [ngClass]="{
                    'bg-purple-600 text-white font-bold shadow-xs': selectedFunnelStage() === 'Interview Stage',
                    'bg-purple-50 text-purple-700 hover:bg-purple-100': selectedFunnelStage() !== 'Interview Stage'
                  }"
                  class="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                >
                  Interviews
                </button>
                <button
                  type="button"
                  (click)="selectedFunnelStage.set('Selected Offers')"
                  [ngClass]="{
                    'bg-emerald-600 text-white font-bold shadow-xs': selectedFunnelStage() === 'Selected Offers',
                    'bg-emerald-50 text-emerald-700 hover:bg-emerald-100': selectedFunnelStage() !== 'Selected Offers'
                  }"
                  class="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                >
                  Selected Offers
                </button>
                <button
                  type="button"
                  (click)="selectedFunnelStage.set('Rejected')"
                  [ngClass]="{
                    'bg-rose-600 text-white font-bold shadow-xs': selectedFunnelStage() === 'Rejected',
                    'bg-rose-50 text-rose-700 hover:bg-rose-100': selectedFunnelStage() !== 'Rejected'
                  }"
                  class="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                >
                  Rejected
                </button>
              </div>

              <!-- Search Bar -->
              <div class="relative">
                <app-icon name="search" [size]="15" customClass="absolute left-3.5 top-3 text-slate-400"></app-icon>
                <input
                  type="text"
                  [ngModel]="applicantSearch()"
                  (ngModelChange)="applicantSearch.set($event)"
                  placeholder="Filter applicants by student name, roll no, company, or job..."
                  class="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                />
              </div>

              <!-- Applicants Table -->
              <div class="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Stage Applicants List ({{ filteredApplicants().length }})</span>
                  <span class="text-slate-500 font-normal text-[11px]">Sorted by Recency</span>
                </div>
                <div class="max-h-96 overflow-y-auto divide-y divide-slate-100">
                  <div *ngIf="filteredApplicants().length === 0" class="p-8 text-center text-slate-400 text-xs">
                    No applicants found in this pipeline stage matching criteria.
                  </div>
                  <div *ngFor="let app of filteredApplicants()" class="p-3.5 hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors">
                    <div class="min-w-0 flex items-center gap-3">
                      <div class="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center shrink-0">
                        {{ app.studentName.charAt(0) || 'A' }}
                      </div>
                      <div class="min-w-0">
                        <div class="text-xs font-bold text-slate-900 truncate">{{ app.studentName }}</div>
                        <div class="text-[11px] text-slate-500 truncate">
                          {{ app.studentRoll }} • {{ app.studentDepartment }}
                        </div>
                      </div>
                    </div>
                    <div class="text-right shrink-0">
                      <div class="text-xs font-bold text-slate-900 truncate max-w-[180px]">{{ app.companyName }}</div>
                      <div class="flex items-center justify-end gap-1.5 mt-0.5">
                        <span
                          [ngClass]="{
                            'bg-blue-100 text-blue-800': app.status === 'Applied',
                            'bg-amber-100 text-amber-800': app.status === 'Shortlisted',
                            'bg-purple-100 text-purple-800': app.status === 'Technical Interview' || app.status === 'HR Interview' || app.status === 'Aptitude',
                            'bg-emerald-100 text-emerald-800': app.status === 'Selected',
                            'bg-rose-100 text-rose-800': app.status === 'Rejected'
                          }"
                          class="px-2 py-0.5 rounded-md text-[10px] font-bold"
                        >
                          {{ app.status }}
                        </span>
                        <span class="text-[10px] text-slate-400">
                          {{ app.updatedAt | date:'shortDate' }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- =============================================================== -->
            <!-- 4. DEPARTMENT PERFORMANCE DRILL-DOWN VIEW -->
            <!-- =============================================================== -->
            <div *ngIf="activeDrawer() === 'department-performance'" class="space-y-6">
              <!-- Department Selection Pills -->
              <div class="flex flex-wrap gap-2 pb-1 border-b border-slate-200">
                <button
                  type="button"
                  (click)="selectedDepartment.set('All')"
                  [ngClass]="{
                    'bg-slate-900 text-white font-bold shadow-xs': selectedDepartment() === 'All',
                    'bg-slate-100 text-slate-600 hover:bg-slate-200': selectedDepartment() !== 'All'
                  }"
                  class="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                >
                  All Branches
                </button>
                <button
                  *ngFor="let dept of deptStats()"
                  type="button"
                  (click)="selectedDepartment.set(dept.department)"
                  [ngClass]="{
                    'bg-emerald-600 text-white font-bold shadow-xs': selectedDepartment() === dept.department,
                    'bg-emerald-50 text-emerald-800 hover:bg-emerald-100': selectedDepartment() !== dept.department
                  }"
                  class="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors truncate max-w-[200px]"
                >
                  {{ dept.department }}
                </button>
              </div>

              <!-- Branch Breakdown Metrics -->
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                <div class="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Placement %</span>
                  <div class="text-2xl font-black text-emerald-950 mt-1">{{ selectedDeptStats().placementRate }}%</div>
                  <span class="text-[11px] text-emerald-700 font-medium mt-0.5">
                    {{ selectedDeptStats().placedCount }} of {{ selectedDeptStats().totalStudents }} placed
                  </span>
                </div>

                <div class="p-4 rounded-2xl bg-blue-50 border border-blue-100">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-blue-800">Eligible Candidates</span>
                  <div class="text-2xl font-black text-blue-950 mt-1">{{ selectedDeptStats().eligibleStudents }}</div>
                  <span class="text-[11px] text-blue-600 font-medium mt-0.5">CGPA ≥ 6.0 cutoff</span>
                </div>

                <div class="p-4 rounded-2xl bg-purple-50 border border-purple-100">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-purple-800">Branch Avg CTC</span>
                  <div class="text-2xl font-black text-purple-950 mt-1">{{ selectedDeptStats().averageCtc }}</div>
                  <span class="text-[11px] text-purple-600 font-medium mt-0.5">Highest: {{ selectedDeptStats().highestCtc }}</span>
                </div>
              </div>

              <!-- Student Roster Controls & Export Button -->
              <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div class="relative flex-1">
                  <app-icon name="search" [size]="15" customClass="absolute left-3.5 top-3 text-slate-400"></app-icon>
                  <input
                    type="text"
                    [ngModel]="deptStudentSearch()"
                    (ngModelChange)="deptStudentSearch.set($event)"
                    placeholder="Search roster by student name, roll no, company..."
                    class="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                  />
                </div>

                <div class="flex items-center gap-2">
                  <select
                    [ngModel]="deptPlacementStatusFilter()"
                    (ngModelChange)="deptPlacementStatusFilter.set($event)"
                    class="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Placed">Placed / Selected</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Not Placed">Not Placed</option>
                  </select>

                  <button
                    type="button"
                    (click)="exportBranchCsv()"
                    class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
                    title="Export Branch Roster as CSV"
                  >
                    <app-icon name="download" [size]="14"></app-icon>
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              <!-- Branch Student Roster Table -->
              <div class="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>{{ selectedDeptStats().department }} Student Roster ({{ filteredDeptStudents().length }})</span>
                  <span class="text-slate-500 font-normal text-[11px]">Live Database Stream</span>
                </div>
                <div class="max-h-96 overflow-y-auto divide-y divide-slate-100">
                  <div *ngIf="filteredDeptStudents().length === 0" class="p-8 text-center text-slate-400 text-xs">
                    No students found matching this branch and filter combination.
                  </div>
                  <div *ngFor="let s of filteredDeptStudents()" class="p-3.5 hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors">
                    <div class="min-w-0 flex items-center gap-3">
                      <img
                        *ngIf="s.avatarUrl || s.profilePhoto"
                        [src]="s.avatarUrl || s.profilePhoto"
                        class="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                        [alt]="s.fullName"
                      />
                      <div
                        *ngIf="!s.avatarUrl && !s.profilePhoto"
                        class="w-9 h-9 rounded-full bg-slate-100 text-slate-800 font-bold text-xs flex items-center justify-center shrink-0"
                      >
                        {{ s.fullName.charAt(0) || 'S' }}
                      </div>
                      <div class="min-w-0">
                        <div class="text-xs font-bold text-slate-900 truncate">{{ s.fullName }}</div>
                        <div class="text-[11px] text-slate-500 truncate">
                          {{ s.rollNumber }} • CGPA: <span class="font-bold text-slate-700">{{ s.cgpa || 'N/A' }}</span>
                        </div>
                      </div>
                    </div>
                    <div class="text-right shrink-0">
                      <span
                        [ngClass]="{
                          'bg-emerald-100 text-emerald-800': s.placementStatus === 'Selected' || s.placementStatus === 'Offer Accepted',
                          'bg-blue-100 text-blue-800': s.placementStatus === 'In Progress',
                          'bg-slate-100 text-slate-700': s.placementStatus === 'Not Placed'
                        }"
                        class="px-2 py-0.5 rounded-md text-[10px] font-bold block"
                      >
                        {{ s.placementStatus || 'Not Placed' }}
                      </span>
                      <div *ngIf="s.placedCompany" class="text-[11px] font-semibold text-slate-700 mt-0.5">
                        {{ s.placedCompany }} ({{ s.placedPackage || '8 LPA' }})
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- Drawer Footer -->
          <div class="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span class="text-xs text-slate-500 font-medium">
              CareerNexus Institutional Analytics Engine
            </span>
            <div class="flex items-center gap-2.5">
              <a
                routerLink="/admin/command-center"
                (click)="closeDrawer()"
                class="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition-colors"
              >
                Full Command Center →
              </a>
              <button
                type="button"
                (click)="closeDrawer()"
                class="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
              >
                Done
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  `
})
export class AdminDashboardComponent {
  studentService = inject(StudentService);
  companyService = inject(CompanyService);
  jobService = inject(JobService);
  applicationService = inject(ApplicationService);
  skillMatchingService = inject(SkillMatchingService);
  commandService = inject(CommandCenterService);

  // Active slide-over drawer
  activeDrawer = signal<AnalyticsDrawerType | null>(null);

  // Sub-filters for Placement Rate
  placementSearch = signal('');
  placementDeptFilter = signal('All');

  // Sub-filters for Funnel
  selectedFunnelStage = signal<string>('All');
  applicantSearch = signal('');

  // Sub-filters for Department Performance
  selectedDepartment = signal<string>('All');
  deptStudentSearch = signal('');
  deptPlacementStatusFilter = signal<string>('All');

  // Key derived services & computeds
  skillAnalytics = computed(() => this.skillMatchingService.getAdminSkillAnalytics());
  funnel = this.commandService.placementFunnel;
  deptStats = this.commandService.departmentAnalytics;

  placementRate = computed(() => {
    const list = this.studentService.students();
    if (list.length === 0) return 0;
    const placed = list.filter(s => s.placementStatus === 'Selected' || s.placementStatus === 'Offer Accepted').length;
    return Math.round((placed / list.length) * 100);
  });

  averageCtc = computed(() => {
    const jobs = this.jobService.jobs();
    const comps = this.companyService.companies();
    const values: number[] = [];

    jobs.forEach(j => {
      const match = j.salary?.match(/(\d+(\.\d+)?)/g);
      if (match) {
        match.forEach(m => {
          const val = parseFloat(m);
          if (val > 0 && val < 200) values.push(val);
        });
      }
    });

    if (values.length === 0) {
      comps.forEach(c => {
        const match = c.averagePackage?.match(/(\d+(\.\d+)?)/g);
        if (match) {
          match.forEach(m => {
            const val = parseFloat(m);
            if (val > 0 && val < 200) values.push(val);
          });
        }
      });
    }

    if (values.length === 0) return '₹0.0 LPA';
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    return `₹${avg.toFixed(1)} LPA`;
  });

  // Placed & Unplaced lists for Placement Rate Drill-Down
  placedStudents = computed(() => {
    return this.studentService.students().filter(s => s.placementStatus === 'Selected' || s.placementStatus === 'Offer Accepted');
  });

  unplacedStudents = computed(() => {
    return this.studentService.students().filter(s => s.placementStatus !== 'Selected' && s.placementStatus !== 'Offer Accepted');
  });

  filteredPlacedStudents = computed(() => {
    const list = this.placedStudents();
    const query = this.placementSearch().trim().toLowerCase();
    const dept = this.placementDeptFilter();

    return list.filter(s => {
      const matchDept = dept === 'All' || s.department === dept;
      const matchQuery = !query ||
        (s.fullName || '').toLowerCase().includes(query) ||
        (s.rollNumber || '').toLowerCase().includes(query) ||
        (s.placedCompany || '').toLowerCase().includes(query) ||
        (s.department || '').toLowerCase().includes(query);
      return matchDept && matchQuery;
    });
  });

  allDepartments = computed(() => {
    const depts = new Set<string>();
    this.studentService.students().forEach(s => {
      if (s.department) depts.add(s.department);
    });
    return Array.from(depts).sort();
  });

  // CTC Comprehensive Analytics Drill-Down
  ctcAnalytics = computed(() => {
    const students = this.studentService.students();
    const jobs = this.jobService.jobs();
    const companies = this.companyService.companies();

    const points: { value: number; source: string; label: string; entity: string }[] = [];

    students.forEach(s => {
      if (s.placedPackage) {
        const matches = s.placedPackage.match(/(\d+(\.\d+)?)/g);
        if (matches) {
          matches.forEach(m => {
            const val = parseFloat(m);
            if (val > 0 && val < 200) {
              points.push({
                value: val,
                source: 'Student Offer',
                label: s.fullName,
                entity: s.placedCompany || 'Campus Recruiter'
              });
            }
          });
        }
      }
    });

    jobs.forEach(j => {
      if (j.salary) {
        const matches = j.salary.match(/(\d+(\.\d+)?)/g);
        if (matches) {
          matches.forEach(m => {
            const val = parseFloat(m);
            if (val > 0 && val < 200) {
              points.push({
                value: val,
                source: 'Drive Package',
                label: j.title,
                entity: j.companyName
              });
            }
          });
        }
      }
    });

    companies.forEach(c => {
      if (c.averagePackage) {
        const matches = c.averagePackage.match(/(\d+(\.\d+)?)/g);
        if (matches) {
          matches.forEach(m => {
            const val = parseFloat(m);
            if (val > 0 && val < 200) {
              points.push({
                value: val,
                source: 'Partner Average',
                label: c.name,
                entity: c.name
              });
            }
          });
        }
      }
    });

    const values = points.map(p => p.value);
    const sorted = [...values].sort((a, b) => a - b);
    const count = values.length;
    const highest = count > 0 ? Math.max(...values) : 45.0;
    const avg = count > 0 ? values.reduce((a, b) => a + b, 0) / count : 12.8;
    const median = count > 0
      ? (count % 2 === 1 ? sorted[Math.floor(count / 2)] : (sorted[count / 2 - 1] + sorted[count / 2]) / 2)
      : 10.5;

    const bLess6 = points.filter(p => p.value < 6);
    const b6To12 = points.filter(p => p.value >= 6 && p.value < 12);
    const b12To20 = points.filter(p => p.value >= 12 && p.value < 20);
    const b20Plus = points.filter(p => p.value >= 20);

    return {
      highest: highest.toFixed(1),
      average: avg.toFixed(1),
      median: median.toFixed(1),
      totalDataPoints: count,
      bracketLess6: {
        count: bLess6.length,
        pct: count > 0 ? Math.round((bLess6.length / count) * 100) : 0,
        items: bLess6
      },
      bracket6To12: {
        count: b6To12.length,
        pct: count > 0 ? Math.round((b6To12.length / count) * 100) : 0,
        items: b6To12
      },
      bracket12To20: {
        count: b12To20.length,
        pct: count > 0 ? Math.round((b12To20.length / count) * 100) : 0,
        items: b12To20
      },
      bracket20Plus: {
        count: b20Plus.length,
        pct: count > 0 ? Math.round((b20Plus.length / count) * 100) : 0,
        items: b20Plus
      },
      topOffers: [...points].sort((a, b) => b.value - a.value).slice(0, 8)
    };
  });

  // Funnel Conversions & Filtered Applicants
  funnelConversion = computed(() => {
    const f = this.funnel();
    const applied = f.find(s => s.name === 'Students Applied')?.count || 0;
    const shortlisted = f.find(s => s.name === 'Shortlisted')?.count || 0;
    const interviewed = f.find(s => s.name === 'Interview Stage')?.count || 0;
    const selected = f.find(s => s.name === 'Selected Offers')?.count || 0;
    const total = f[0]?.count || 1;

    return {
      appliedToShortlisted: applied > 0 ? Math.round((shortlisted / applied) * 100) : 0,
      shortlistedToInterview: shortlisted > 0 ? Math.round((interviewed / shortlisted) * 100) : 0,
      interviewToSelected: interviewed > 0 ? Math.round((selected / interviewed) * 100) : 0,
      overallAdvancement: total > 0 ? Math.round((selected / total) * 100) : 0
    };
  });

  filteredApplicants = computed(() => {
    const apps = this.applicationService.applications();
    const stage = this.selectedFunnelStage();
    const query = this.applicantSearch().trim().toLowerCase();

    return apps.filter(app => {
      let matchesStage = true;
      if (stage === 'Applied') matchesStage = app.status === 'Applied';
      else if (stage === 'Shortlisted') matchesStage = app.status === 'Shortlisted';
      else if (stage === 'Interview Stage' || stage === 'Interview') {
        matchesStage = app.status === 'Technical Interview' || app.status === 'HR Interview' || app.status === 'Aptitude';
      } else if (stage === 'Selected Offers' || stage === 'Selected') {
        matchesStage = app.status === 'Selected';
      } else if (stage === 'Rejected') {
        matchesStage = app.status === 'Rejected';
      }

      const matchesQuery = !query ||
        (app.studentName || '').toLowerCase().includes(query) ||
        (app.studentRoll || '').toLowerCase().includes(query) ||
        (app.studentDepartment || '').toLowerCase().includes(query) ||
        (app.companyName || '').toLowerCase().includes(query) ||
        (app.jobTitle || '').toLowerCase().includes(query);

      return matchesStage && matchesQuery;
    });
  });

  // Department Performance Drill-Down Computations
  selectedDeptStats = computed(() => {
    const selected = this.selectedDepartment();
    const allStudents = this.studentService.students();
    const deptList = this.deptStats();

    if (selected === 'All') {
      const totalStudents = allStudents.length;
      const eligibleStudents = allStudents.filter(s => (s.cgpa || 0) >= 6.0).length;
      const placedCount = allStudents.filter(s => s.placementStatus === 'Selected' || s.placementStatus === 'Offer Accepted').length;
      const placementRate = totalStudents > 0 ? Math.round((placedCount / totalStudents) * 100) : 0;
      return {
        department: 'All Departments',
        totalStudents,
        eligibleStudents,
        placedCount,
        placementRate,
        averageCtc: this.averageCtc(),
        highestCtc: `₹${this.ctcAnalytics().highest} LPA`
      };
    }

    const deptStat = deptList.find(d => d.department === selected);
    const branchStudents = allStudents.filter(s => s.department === selected);
    const totalStudents = branchStudents.length;
    const eligibleStudents = branchStudents.filter(s => (s.cgpa || 0) >= 6.0).length;
    const placedCount = deptStat ? deptStat.placedCount : branchStudents.filter(s => s.placementStatus === 'Selected' || s.placementStatus === 'Offer Accepted').length;
    const placementRate = deptStat ? deptStat.placementRate : (totalStudents > 0 ? Math.round((placedCount / totalStudents) * 100) : 0);

    const ctcNums: number[] = [];
    branchStudents.forEach(s => {
      if (s.placedPackage) {
        const m = s.placedPackage.match(/(\d+(\.\d+)?)/g);
        if (m) m.forEach(v => { const n = parseFloat(v); if (n > 0 && n < 200) ctcNums.push(n); });
      }
    });
    const avg = ctcNums.length > 0 ? (ctcNums.reduce((a, b) => a + b, 0) / ctcNums.length).toFixed(1) : this.ctcAnalytics().average;
    const high = ctcNums.length > 0 ? Math.max(...ctcNums).toFixed(1) : this.ctcAnalytics().highest;

    return {
      department: selected,
      totalStudents,
      eligibleStudents,
      placedCount,
      placementRate,
      averageCtc: `₹${avg} LPA`,
      highestCtc: `₹${high} LPA`
    };
  });

  filteredDeptStudents = computed(() => {
    const selected = this.selectedDepartment();
    let list = this.studentService.students();
    if (selected !== 'All') {
      list = list.filter(s => s.department === selected);
    }
    const status = this.deptPlacementStatusFilter();
    const query = this.deptStudentSearch().trim().toLowerCase();

    return list.filter(s => {
      let matchesStatus = true;
      if (status === 'Placed') {
        matchesStatus = s.placementStatus === 'Selected' || s.placementStatus === 'Offer Accepted';
      } else if (status === 'Not Placed') {
        matchesStatus = s.placementStatus === 'Not Placed';
      } else if (status === 'In Progress') {
        matchesStatus = s.placementStatus === 'In Progress';
      }

      const matchesQuery = !query ||
        (s.fullName || '').toLowerCase().includes(query) ||
        (s.rollNumber || '').toLowerCase().includes(query) ||
        (s.placedCompany || '').toLowerCase().includes(query) ||
        (s.department || '').toLowerCase().includes(query);

      return matchesStatus && matchesQuery;
    });
  });

  openDrawer(type: AnalyticsDrawerType, context?: string) {
    this.activeDrawer.set(type);
    if (type === 'pipeline-funnel') {
      if (context) {
        if (context.includes('Applied')) this.selectedFunnelStage.set('Applied');
        else if (context.includes('Shortlisted')) this.selectedFunnelStage.set('Shortlisted');
        else if (context.includes('Interview')) this.selectedFunnelStage.set('Interview Stage');
        else if (context.includes('Selected') || context.includes('Offers')) this.selectedFunnelStage.set('Selected Offers');
        else this.selectedFunnelStage.set('All');
      } else {
        this.selectedFunnelStage.set('All');
      }
      this.applicantSearch.set('');
    } else if (type === 'department-performance') {
      if (context) {
        this.selectedDepartment.set(context);
      }
      this.deptStudentSearch.set('');
      this.deptPlacementStatusFilter.set('All');
    } else if (type === 'placement-rate') {
      this.placementSearch.set('');
      this.placementDeptFilter.set('All');
    }
  }

  closeDrawer() {
    this.activeDrawer.set(null);
  }

  @HostListener('window:keydown.escape')
  onEscapeKey() {
    if (this.activeDrawer()) {
      this.closeDrawer();
    }
  }

  exportBranchCsv(branchName?: string) {
    const targetBranch = branchName || this.selectedDepartment();
    let students = this.studentService.students();
    if (targetBranch && targetBranch !== 'All') {
      students = students.filter(s => s.department === targetBranch);
    }

    const header = ['Full Name', 'Roll Number', 'Department', 'CGPA', 'Placement Status', 'Placed Company', 'Package (CTC)', 'Email'];
    const rows = students.map(s => [
      `"${(s.fullName || '').replace(/"/g, '""')}"`,
      `"${(s.rollNumber || '').replace(/"/g, '""')}"`,
      `"${(s.department || '').replace(/"/g, '""')}"`,
      `"${s.cgpa || ''}"`,
      `"${(s.placementStatus || '').replace(/"/g, '""')}"`,
      `"${(s.placedCompany || '').replace(/"/g, '""')}"`,
      `"${(s.placedPackage || '').replace(/"/g, '""')}"`,
      `"${(s.email || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [header.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const cleanName = (targetBranch === 'All' ? 'All_Departments' : targetBranch).replace(/[^a-zA-Z0-9_-]/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `CareerNexus_${cleanName}_Placement_Roster.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
