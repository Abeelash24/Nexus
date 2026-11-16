import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RecruiterService } from '../../../core/services/recruiter.service';
import { Job } from '../../../core/models/job.model';
import { IconComponent } from '../../../shared/icons/icon.component';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-recruiter-jobs',
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
            <div class="text-xs font-bold text-rose-900">Failed to sync recruiter jobs</div>
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
            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
              Open Positions
            </span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Job Openings & Roles</h1>
          <p class="text-sm text-slate-500 mt-1">
            Manage individual job openings, customize eligibility cutoffs, specify technical domain requirements, and track applicants.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <a
            routerLink="/recruiter/drives"
            class="px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors"
          >
            <app-icon name="calendar" [size]="16"></app-icon>
            Placement Drives
          </a>
          <button
            type="button"
            (click)="openCreateModal()"
            class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02]"
          >
            <app-icon name="plus" [size]="16"></app-icon>
            + Post New Job Opening
          </button>
        </div>
      </div>

      <!-- SKELETON LOADING STATE -->
      <div *ngIf="recruiterService.isLoading() && !recruiterService.isInitialized()" class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div *ngFor="let _ of [1,2,3,4]" class="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs animate-pulse space-y-4">
          <div class="flex justify-between items-start">
            <div class="space-y-1.5">
              <div class="h-3 w-20 bg-slate-200 rounded"></div>
              <div class="h-5 w-48 bg-slate-200 rounded"></div>
            </div>
            <div class="h-5 w-16 bg-slate-200 rounded-full"></div>
          </div>
          <div class="h-12 bg-slate-100 rounded-xl"></div>
          <div class="grid grid-cols-2 gap-2">
            <div class="h-10 bg-slate-100 rounded-xl"></div>
            <div class="h-10 bg-slate-100 rounded-xl"></div>
          </div>
        </div>
      </div>

      <!-- Job List Grid -->
      <div *ngIf="!recruiterService.isLoading() || recruiterService.isInitialized()" class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div
          *ngFor="let job of recruiterService.recruiterJobs()"
          class="rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
        >
          <div>
            <!-- Banner Preview if available -->
            <div *ngIf="job.bannerUrl" class="h-36 w-full overflow-hidden bg-slate-100 relative">
              <img [src]="job.bannerUrl" [alt]="job.title" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div class="absolute top-3 right-3">
                <span
                  class="px-2.5 py-0.5 rounded-full text-xs font-bold backdrop-blur-md shadow-xs"
                  [ngClass]="job.status === 'Active' ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-white'"
                >
                  {{ job.status }}
                </span>
              </div>
            </div>

            <!-- Overlapping Company Logo if Banner present -->
            <div *ngIf="job.bannerUrl" class="px-6 -mt-6 relative z-10 flex items-end justify-between">
              <div class="w-12 h-12 rounded-xl bg-white p-1 border-2 border-slate-100 shadow-md overflow-hidden shrink-0 flex items-center justify-center">
                <img
                  [src]="job.companyLogo || recruiterService.companyLogo()"
                  [alt]="job.companyName"
                  (error)="onLogoError($event, job.companyName)"
                  class="w-full h-full object-contain rounded-lg"
                />
              </div>
              <span class="text-xs font-bold text-slate-700 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
                {{ job.companyName }}
              </span>
            </div>

            <div class="p-6 space-y-4" [ngClass]="job.bannerUrl ? 'pt-3' : ''">
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-start gap-3">
                  <!-- Company Logo if no banner -->
                  <div *ngIf="!job.bannerUrl" class="w-12 h-12 rounded-xl bg-slate-50 p-1 border border-slate-200 shadow-2xs overflow-hidden shrink-0 flex items-center justify-center">
                    <img
                      [src]="job.companyLogo || recruiterService.companyLogo()"
                      [alt]="job.companyName"
                      (error)="onLogoError($event, job.companyName)"
                      class="w-full h-full object-contain rounded-lg"
                    />
                  </div>
                  <div>
                    <span class="text-xs font-bold uppercase tracking-wider text-blue-600">{{ job.domain }}</span>
                    <h3 class="text-base font-bold text-slate-900 mt-0.5 group-hover:text-blue-600 transition-colors">{{ job.title }}</h3>
                    <p class="text-xs text-slate-500">{{ job.companyName }} • {{ job.location }} • {{ job.employmentType }}</p>
                  </div>
                </div>
                <span
                  *ngIf="!job.bannerUrl"
                  class="px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0"
                  [ngClass]="job.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'"
                >
                  {{ job.status }}
                </span>
              </div>

              <p class="text-xs text-slate-600 leading-relaxed line-clamp-2">{{ job.description }}</p>

              <div class="grid grid-cols-2 gap-2 text-xs py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <span class="text-slate-400 text-[10px] uppercase font-bold block">Compensation:</span>
                  <div class="font-bold text-slate-900 mt-0.5">{{ job.salary }}</div>
                </div>
                <div>
                  <span class="text-slate-400 text-[10px] uppercase font-bold block">Cutoff CGPA:</span>
                  <div class="font-bold text-slate-900 mt-0.5">{{ job.minimumCgpa }} / 10.0</div>
                </div>
              </div>

              <div>
                <span class="text-[10px] font-bold uppercase text-slate-400 block mb-1">Required Skills:</span>
                <div class="flex flex-wrap gap-1.5">
                  <span *ngFor="let sk of job.requiredSkills.slice(0, 4)" class="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100">
                    {{ sk }}
                  </span>
                  <span *ngIf="job.requiredSkills.length > 4" class="text-[10px] text-slate-400 px-1 py-0.5">
                    +{{ job.requiredSkills.length - 4 }} more
                  </span>
                </div>
              </div>

              <div class="pt-2 flex items-center justify-between text-xs text-slate-400">
                <span>Deadline: <strong class="text-slate-700">{{ job.applicationDeadline | date:'mediumDate' }}</strong></span>
                <span class="font-semibold text-slate-600">{{ job.vacancies }} Vacancies</span>
              </div>
            </div>
          </div>

          <!-- Actions Footer -->
          <div class="p-4 sm:px-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="openEditModal(job)"
                class="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs transition-colors"
              >
                Edit
              </button>
              <a
                routerLink="/recruiter/applicants"
                class="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs transition-colors flex items-center gap-1"
              >
                <app-icon name="users" [size]="13"></app-icon>
                Applicants ({{ job.applicantsCount }})
              </a>
            </div>

            <div class="flex items-center gap-1.5">
              <button
                type="button"
                (click)="toggleJobStatus(job)"
                class="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors"
                [ngClass]="job.status === 'Active' ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'"
              >
                {{ job.status === 'Active' ? 'Close Opening' : 'Reactivate' }}
              </button>
              <button
                type="button"
                (click)="confirmDeleteJob(job)"
                class="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Delete Job"
              >
                <app-icon name="trash" [size]="14"></app-icon>
              </button>
            </div>
          </div>
        </div>

        <!-- EMPTY STATE -->
        <div
          *ngIf="recruiterService.recruiterJobs().length === 0"
          class="col-span-full p-12 rounded-3xl bg-white border border-dashed border-slate-200 text-center space-y-3"
        >
          <div class="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <app-icon name="briefcase" [size]="24"></app-icon>
          </div>
          <h3 class="text-base font-bold text-slate-800">No Job Openings Found for {{ recruiterService.recruiterCompanyName() }}</h3>
          <p class="text-xs text-slate-500 max-w-md mx-auto">
            Your company does not currently have any active campus placement openings published. Click below to configure your first position.
          </p>
          <button
            type="button"
            (click)="openCreateModal()"
            class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md transition-all"
          >
            <app-icon name="plus" [size]="15"></app-icon>
            + Post New Job Opening
          </button>
        </div>
      </div>

      <!-- Create / Edit Job Modal -->
      <div *ngIf="showModal()" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
        <div class="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4 custom-scrollbar">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 class="text-base font-bold text-slate-900">
                {{ isEditing() ? 'Edit Job Opening' : 'Post New Campus Job Opening' }}
              </h3>
              <p class="text-xs text-slate-500 mt-0.5">Publishing on behalf of {{ recruiterService.recruiterCompanyName() }}</p>
            </div>
            <button (click)="closeModal()" class="p-1 text-slate-400 hover:text-slate-600">
              <app-icon name="x" [size]="20"></app-icon>
            </button>
          </div>

          <form (submit)="saveJob($event)" class="space-y-3 text-xs">
            <div>
              <label class="block font-semibold text-slate-700">Job Title *</label>
              <input type="text" [(ngModel)]="jobForm.title" name="jTitle" required placeholder="e.g. Associate Software Engineer - Cloud" class="w-full px-3 py-2 mt-1 rounded-xl border border-slate-200 text-sm" />
            </div>

            <div>
              <label class="block font-semibold text-slate-700">Banner Image URL (Optional)</label>
              <input type="text" [(ngModel)]="jobForm.bannerUrl" name="jBanner" placeholder="https://images.unsplash.com/... or uploaded banner link" class="w-full px-3 py-2 mt-1 rounded-xl border border-slate-200" />
            </div>

            <div>
              <label class="block font-semibold text-slate-700">Job Description & Responsibilities *</label>
              <textarea [(ngModel)]="jobForm.description" name="jDesc" required rows="3" placeholder="Outline candidate responsibilities, team structure, and project scope..." class="w-full px-3 py-2 mt-1 rounded-xl border border-slate-200 text-sm"></textarea>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-slate-700">Technical Domain</label>
                <select [(ngModel)]="jobForm.domain" name="jDomain" class="w-full px-3 py-2 mt-1 rounded-xl border border-slate-200 bg-white">
                  <option value="Software Development">Software Development</option>
                  <option value="Cloud Computing">Cloud Computing</option>
                  <option value="AI / Machine Learning">AI / Machine Learning</option>
                  <option value="Data Science">Data Science</option>
                  <option value="FinTech">FinTech</option>
                  <option value="Cybersecurity">Cybersecurity</option>
                </select>
              </div>
              <div>
                <label class="block font-semibold text-slate-700">Location</label>
                <input type="text" [(ngModel)]="jobForm.location" name="jLoc" placeholder="Bengaluru / Hyderabad" class="w-full px-3 py-2 mt-1 rounded-xl border border-slate-200" />
              </div>
            </div>

            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block font-semibold text-slate-700">Compensation (CTC) *</label>
                <input type="text" [(ngModel)]="jobForm.salary" name="jSal" required placeholder="e.g. ₹28 - ₹34 LPA" class="w-full px-3 py-2 mt-1 rounded-xl border border-slate-200 font-bold" />
              </div>
              <div>
                <label class="block font-semibold text-slate-700">Min CGPA Cutoff</label>
                <input type="number" step="0.1" [(ngModel)]="jobForm.minimumCgpa" name="jCgpa" required class="w-full px-3 py-2 mt-1 rounded-xl border border-slate-200 font-bold" />
              </div>
              <div>
                <label class="block font-semibold text-slate-700">Vacancies</label>
                <input type="number" [(ngModel)]="jobForm.vacancies" name="jVac" required class="w-full px-3 py-2 mt-1 rounded-xl border border-slate-200" />
              </div>
            </div>

            <div>
              <label class="block font-semibold text-slate-700">Required Skills & Technologies (Comma separated) *</label>
              <input type="text" [(ngModel)]="jobSkillsRaw" name="jSkills" required placeholder="Java, Data Structures, Spring Boot, PostgreSQL, Docker" class="w-full px-3 py-2 mt-1 rounded-xl border border-slate-200" />
            </div>

            <div>
              <label class="block font-semibold text-slate-700">Application Deadline</label>
              <input type="date" [(ngModel)]="formDeadlineDate" name="jDeadline" class="w-full px-3 py-2 mt-1 rounded-xl border border-slate-200" />
            </div>

            <div class="pt-4 flex justify-end gap-2 border-t border-slate-100">
              <button type="button" (click)="closeModal()" class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
              <button
                type="submit"
                [disabled]="isSaving()"
                class="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-xs"
              >
                {{ isSaving() ? 'Saving...' : isEditing() ? 'Save Changes' : 'Publish Job Opening' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `
})
export class RecruiterJobsComponent implements OnInit {
  recruiterService = inject(RecruiterService);
  toast = inject(ToastService);

  showModal = signal(false);
  isEditing = signal(false);
  editingJobId = signal<string | null>(null);
  isSaving = signal(false);

  jobForm = {
    title: '',
    description: '',
    domain: 'Software Development',
    location: 'Bengaluru / Hyderabad',
    salary: '₹24 - ₹30 LPA',
    minimumCgpa: 7.5,
    vacancies: 5,
    employmentType: 'Full Time' as const,
    bannerUrl: ''
  };

  jobSkillsRaw = 'Java, Data Structures, SQL, Docker, Microservices';
  formDeadlineDate = '';

  ngOnInit(): void {
    this.recruiterService.loadRecruiterData();
  }

  openCreateModal(): void {
    this.isEditing.set(false);
    this.editingJobId.set(null);
    this.formDeadlineDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
    this.jobForm = {
      title: '',
      description: '',
      domain: 'Software Development',
      location: 'Bengaluru / Hyderabad',
      salary: '₹24 - ₹30 LPA',
      minimumCgpa: 7.5,
      vacancies: 5,
      employmentType: 'Full Time',
      bannerUrl: ''
    };
    this.jobSkillsRaw = 'Java, Data Structures, SQL, Docker, Microservices';
    this.showModal.set(true);
  }

  openEditModal(job: Job): void {
    this.isEditing.set(true);
    this.editingJobId.set(job.id);
    this.formDeadlineDate = job.applicationDeadline ? job.applicationDeadline.split('T')[0] : '';
    this.jobForm = {
      title: job.title,
      description: job.description,
      domain: job.domain,
      location: job.location,
      salary: job.salary,
      minimumCgpa: job.minimumCgpa,
      vacancies: job.vacancies,
      employmentType: (job.employmentType as any) || 'Full Time',
      bannerUrl: job.bannerUrl || ''
    };
    this.jobSkillsRaw = (job.requiredSkills || []).join(', ');
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.isEditing.set(false);
    this.editingJobId.set(null);
  }

  async saveJob(e: Event): Promise<void> {
    e.preventDefault();
    this.isSaving.set(true);
    try {
      const skills = this.jobSkillsRaw.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
      const deadline = this.formDeadlineDate ? new Date(this.formDeadlineDate).toISOString() : new Date(Date.now() + 14 * 86400000).toISOString();

      if (this.isEditing() && this.editingJobId()) {
        await this.recruiterService.updateRecruiterJob(this.editingJobId()!, {
          ...this.jobForm,
          requiredSkills: skills.length > 0 ? skills : ['Java', 'SQL', 'Data Structures'],
          applicationDeadline: deadline
        });
      } else {
        await this.recruiterService.createRecruiterJob({
          ...this.jobForm,
          requiredSkills: skills.length > 0 ? skills : ['Java', 'SQL', 'Data Structures'],
          applicationDeadline: deadline
        });
      }
      this.closeModal();
    } catch (err: any) {
      this.toast.error('Save Failed', err?.message || 'Could not save job opening.');
    } finally {
      this.isSaving.set(false);
    }
  }

  async toggleJobStatus(job: Job): Promise<void> {
    const newStatus = job.status === 'Active' ? 'Closed' : 'Active';
    try {
      if (newStatus === 'Closed') {
        await this.recruiterService.closeRecruiterJob(job.id);
      } else {
        await this.recruiterService.updateRecruiterJob(job.id, { status: 'Active' });
      }
    } catch (err: any) {
      this.toast.error('Status Update Failed', err?.message || 'Could not update status.');
    }
  }

  async confirmDeleteJob(job: Job): Promise<void> {
    if (confirm(`Are you sure you want to delete "${job.title}"? This cannot be undone.`)) {
      try {
        await this.recruiterService.deleteRecruiterJob(job.id);
      } catch (err: any) {
        this.toast.error('Delete Failed', err?.message || 'Could not delete job.');
      }
    }
  }

  onLogoError(event: any, companyName?: string): void {
    const target = event.target as HTMLImageElement;
    target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(companyName || 'Company')}&background=2563eb&color=fff&bold=true`;
  }
}
