import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { Application, ApplicationStatus } from '../models/application.model';
import { Job } from '../models/job.model';
import { PlacementDrive, DriveStatus } from '../models/placement-drive.model';
import { ApplicationService } from './application.service';
import { JobService } from './job.service';
import { CompanyService } from './company.service';
import { PlacementDriveService } from './placement-drive.service';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { AuditLogService } from './audit-log.service';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class RecruiterService {
  private applicationService = inject(ApplicationService);
  private jobService = inject(JobService);
  private companyService = inject(CompanyService);
  private placementDriveService = inject(PlacementDriveService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);
  private auditLog = inject(AuditLogService);
  private supabase = inject(SupabaseService);

  // Loading & Error States
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);
  isInitialized = signal<boolean>(false);

  private lastLoadedUserId: string | null = null;
  private loadPromise: Promise<void> | null = null;

  constructor() {
    effect(() => {
      const user = this.authService.currentUser();
      if (user && user.role === 'recruiter') {
        if (user.id !== this.lastLoadedUserId) {
          this.loadRecruiterData();
        }
      } else if (!user && this.lastLoadedUserId) {
        this.resetState();
      }
    });
  }

  // Recruiter's assigned company (Dynamic from authenticated user profile, fallback 'Corporate Partner')
  private customCompanyName = signal<string>('');
  recruiterCompanyName = computed<string>(() => {
    const user = this.authService.currentUser();
    const comp = (user?.company || this.customCompanyName() || '').trim();
    return comp || 'Corporate Partner';
  });

  setCompanyName(name: string) {
    this.customCompanyName.set(name);
  }

  // Official Company Profile for this recruiter's company
  companyProfile = computed(() => {
    return this.companyService.getCompanyByName(this.recruiterCompanyName());
  });

  // Official Company Logo
  companyLogo = computed(() => {
    return this.companyProfile()?.logo || '';
  });

  // Placement Drives belonging to this recruiter's company or created by recruiter
  recruiterDrives = computed<PlacementDrive[]>(() => {
    const compName = this.recruiterCompanyName().toLowerCase().trim();
    const currentUserId = this.authService.currentUser()?.id;

    return this.placementDriveService.drives().filter(d => {
      if (currentUserId && d.createdBy && d.createdBy === currentUserId) return true;
      const dComp = (d.companyName || '').toLowerCase().trim();
      return (compName && compName !== 'corporate partner') && 
        (dComp === compName || dComp.includes(compName) || compName.includes(dComp));
    });
  });

  // Jobs belonging to this recruiter's company or created by recruiter
  recruiterJobs = computed<Job[]>(() => {
    const compName = this.recruiterCompanyName().toLowerCase().trim();
    const currentUserId = this.authService.currentUser()?.id;

    return this.jobService.jobs().filter(j => {
      if (currentUserId && j.createdBy && j.createdBy === currentUserId) return true;
      const jComp = (j.companyName || '').toLowerCase().trim();
      return (compName && compName !== 'corporate partner') &&
        (jComp === compName || jComp.includes(compName) || compName.includes(jComp));
    });
  });

  // Applications submitted to this recruiter's company or jobs (Server-Scoped)
  private scopedApplicationsSignal = signal<Application[]>([]);
  recruiterApplications = computed<Application[]>(() => this.scopedApplicationsSignal());

  // Metrics
  totalApplicants = computed(() => this.recruiterApplications().length);
  shortlistedCount = computed(() => this.recruiterApplications().filter(a => a.status === 'Shortlisted').length);
  interviewCount = computed(() => this.recruiterApplications().filter(a => a.status === 'Technical Interview' || a.status === 'HR Interview' || a.status === 'Aptitude').length);
  selectedCount = computed(() => this.recruiterApplications().filter(a => a.status === 'Selected').length);

  // Placement Drive Metrics
  totalDrivesCount = computed(() => this.recruiterDrives().length);
  publishedDrivesCount = computed(() => this.recruiterDrives().filter(d => d.status === 'Published' || d.status === 'Applications Open' || d.status === 'In Progress').length);
  draftDrivesCount = computed(() => this.recruiterDrives().filter(d => d.status === 'Draft').length);
  closedDrivesCount = computed(() => this.recruiterDrives().filter(d => d.status === 'Closed' || d.status === 'Completed' || d.status === 'Cancelled').length);
  
  // Job Metrics
  totalJobsCount = computed(() => this.recruiterJobs().length);
  activeJobsCount = computed(() => this.recruiterJobs().filter(j => j.status === 'Active').length);

  /**
   * Concurrently loads and refreshes recruiter jobs, drives, scoped applications, and company data.
   * Direct server-level filtering with zero global student exposure.
   */
  async loadRecruiterData(force = false): Promise<void> {
    const currentId = this.authService.currentUser()?.id || null;
    const userChanged = currentId !== this.lastLoadedUserId;

    if (this.loadPromise && !force && !userChanged) {
      return this.loadPromise;
    }

    this.lastLoadedUserId = currentId;
    this.isLoading.set(true);
    this.error.set(null);

    this.loadPromise = (async () => {
      try {
        await Promise.all([
          this.jobService.fetchJobsFromDatabase(),
          this.placementDriveService.fetchDrivesFromSupabase(),
          this.companyService.fetchCompaniesFromDatabase()
        ]);
        await this.fetchScopedApplications();
        this.isInitialized.set(true);
      } catch (err: any) {
        console.warn('RecruiterService data load warning:', err);
        this.error.set(err?.message || 'Failed to load recruiter data. Please check your connection.');
      } finally {
        this.isLoading.set(false);
        this.loadPromise = null;
      }
    })();

    return this.loadPromise;
  }

  /**
   * Server-level query strictly filtering applications by this recruiter's company.
   * Joined with public.students so candidate skills, resume_url, and cgpa are
   * provided without any global StudentService usage.
   */
  async fetchScopedApplications(): Promise<Application[]> {
    const client = this.supabase.getClient();
    const compName = this.recruiterCompanyName();
    let companyId = this.companyProfile()?.id;

    if (!companyId && client && compName && compName !== 'Corporate Partner') {
      try {
        const { data: compRow } = await client
          .from('companies')
          .select('id')
          .ilike('name', compName)
          .limit(1)
          .maybeSingle();
        if (compRow?.id) {
          companyId = compRow.id;
        }
      } catch {
        // ignore
      }
    }

    const apps = await this.applicationService.fetchApplicationsForCompany(companyId, compName);
    this.scopedApplicationsSignal.set(apps);
    return apps;
  }

  /**
   * Strictly verifies whether an application or student belongs to
   * this recruiter's company pipeline.
   */
  isCandidateAuthorizedForRecruiter(applicationIdOrStudentId: string, studentId?: string): boolean {
    const apps = this.scopedApplicationsSignal();
    return apps.some(a =>
      a.id === applicationIdOrStudentId ||
      a.studentId === applicationIdOrStudentId ||
      (studentId && a.studentId === studentId)
    );
  }

  /**
   * Strictly retrieves candidate application details by ID only if the candidate
   * has applied to this recruiter's company.
   */
  getApplicantById(applicantOrStudentId: string): Application | null {
    const apps = this.scopedApplicationsSignal();
    return apps.find(a =>
      a.id === applicantOrStudentId ||
      a.studentId === applicantOrStudentId
    ) || null;
  }

  resetState() {
    this.customCompanyName.set('');
    this.scopedApplicationsSignal.set([]);
    this.isLoading.set(false);
    this.error.set(null);
    this.isInitialized.set(false);
    this.lastLoadedUserId = null;
    this.loadPromise = null;
  }

  // --- COMPANY LOGO & PROFILE MANAGEMENT ---

  async uploadCompanyLogo(file: File): Promise<{ url: string; error?: string }> {
    return this.companyService.uploadCompanyLogo(file);
  }

  async updateCompanyLogo(logoUrl: string): Promise<void> {
    const compName = this.recruiterCompanyName();
    const updatedCompany = await this.companyService.updateCompanyLogo(compName, logoUrl);

    // Propagate logo to local drives and jobs signals for instant UI synchronization
    for (const drive of this.recruiterDrives()) {
      await this.placementDriveService.updateDrive(drive.id, { companyLogo: logoUrl });
    }
    for (const job of this.recruiterJobs()) {
      await this.jobService.updateJob(job.id, { companyLogo: logoUrl });
    }
  }

  // --- PLACEMENT DRIVES MANAGEMENT ---

  async uploadBannerImage(file: File): Promise<{ url: string; error?: string }> {
    return this.placementDriveService.uploadBannerImage(file);
  }

  async createPlacementDrive(driveData: Partial<PlacementDrive>): Promise<PlacementDrive> {
    const compName = this.recruiterCompanyName();
    const existingCompany = this.companyProfile() || this.companyService.getCompanyByName(compName);
    const resolvedLogo = this.companyLogo() || driveData.companyLogo || existingCompany?.logo || 'https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=150&auto=format&fit=crop&q=80';

    const payload: Partial<PlacementDrive> = {
      ...driveData,
      companyName: compName,
      companyId: driveData.companyId || existingCompany?.id || 'comp-default',
      companyLogo: resolvedLogo
    };

    const created = await this.placementDriveService.createDrive(payload);
    return created;
  }

  async updatePlacementDrive(id: string, updates: Partial<PlacementDrive>): Promise<void> {
    await this.placementDriveService.updateDrive(id, updates);
  }

  async deletePlacementDrive(id: string): Promise<void> {
    await this.placementDriveService.deleteDrive(id);
  }

  async publishPlacementDrive(id: string): Promise<void> {
    await this.placementDriveService.publishDrive(id);
  }

  async closePlacementDrive(id: string): Promise<void> {
    await this.placementDriveService.closeDrive(id);
  }

  // --- JOBS MANAGEMENT ---

  async createRecruiterJob(jobData: {
    title: string;
    description: string;
    domain: string;
    location: string;
    salary: string;
    minimumCgpa: number;
    requiredSkills: string[];
    applicationDeadline: string;
    vacancies: number;
    employmentType: 'Full Time' | 'Full Time + 6M Internship' | 'Internship' | 'Contract';
    bannerUrl?: string;
  }): Promise<Job> {
    const compName = this.recruiterCompanyName().toLowerCase().trim();
    const existingJob = this.jobService.jobs().find(j => (j.companyName || '').toLowerCase().trim() === compName);
    const existingCompany = this.companyService.companies().find(c => (c.name || '').toLowerCase().trim() === compName);
    const currentUser = this.authService.currentUser();

    const newJob: Job = {
      id: `job-${Date.now()}`,
      companyId: existingCompany?.id || existingJob?.companyId || 'c-01',
      companyName: this.recruiterCompanyName(),
      companyLogo: existingCompany?.logo || existingJob?.companyLogo || 'https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=128&auto=format&fit=crop&q=80',
      companyLocation: jobData.location,
      bannerUrl: jobData.bannerUrl || '',
      title: jobData.title,
      description: jobData.description,
      domain: jobData.domain,
      location: jobData.location,
      employmentType: jobData.employmentType,
      salary: jobData.salary,
      eligibility: `B.Tech / M.Tech / MCA with minimum CGPA of ${jobData.minimumCgpa}`,
      minimumCgpa: jobData.minimumCgpa,
      requiredSkills: jobData.requiredSkills,
      applicationDeadline: jobData.applicationDeadline,
      status: 'Active',
      vacancies: jobData.vacancies,
      applicantsCount: 0,
      createdBy: currentUser?.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const added = await this.jobService.addJob(newJob);
    
    await this.auditLog.logAction(
      'job_created',
      'job',
      newJob.id,
      { title: newJob.title, company: newJob.companyName, salary: newJob.salary }
    );

    this.toast.success('Job Drive Created! 🚀', `Opening for "${newJob.title}" is now active and visible to eligible students.`);
    return added;
  }

  async updateRecruiterJob(id: string, updates: Partial<Job>): Promise<void> {
    await this.jobService.updateJob(id, updates);
  }

  async deleteRecruiterJob(id: string): Promise<void> {
    await this.jobService.deleteJob(id);
  }

  async closeRecruiterJob(id: string): Promise<void> {
    await this.jobService.closeJob(id);
  }

  // --- CANDIDATE EVALUATION & STAGES ---

  async updateCandidateStatus(
    applicationId: string,
    newStatus: ApplicationStatus,
    notes?: string,
    meetingLink?: string
  ): Promise<void> {
    const app = this.applicationService.applications().find(a => a.id === applicationId);
    if (!app) return;

    await this.applicationService.updateApplicationStatus(applicationId, newStatus, notes, meetingLink);

    await this.auditLog.logAction(
      `application_status_${newStatus.toLowerCase().replace(/\s+/g, '_')}`,
      'application',
      applicationId,
      {
        studentName: app.studentName,
        companyName: app.companyName,
        jobTitle: app.jobTitle,
        newStatus,
        notes
      }
    );

    this.toast.success('Candidate Updated', `${app.studentName} has been moved to "${newStatus}" stage.`);
  }

  // --- AI CANDIDATE FIT SUMMARY (Gemini + Edge Function) ---

  /**
   * Invokes the 'generate-fit-summary' Supabase Edge Function to evaluate
   * candidate skills against job requirements using Gemini AI.
   */
  async generateFitSummary(payload: {
    student_skills: string[];
    job_requirements: string[] | string;
    job_title?: string;
    candidate_name?: string;
    student_cgpa?: number;
    minimum_cgpa?: number;
  }): Promise<{
    success: boolean;
    summary: string;
    match_percentage?: number;
    match_level?: string;
    matched_skills?: string[];
    missing_skills?: string[];
    source?: string;
    error?: string;
  }> {
    try {
      const { data, error } = await this.supabase.invokeFunction<any>('generate-fit-summary', payload);

      if (error || !data || !data.success || !data.summary) {
        console.warn('Edge function generate-fit-summary notice (using smart fallback):', error || data);
        const fallback = this.generateLocalFitSummaryFallback(payload);
        return {
          success: true,
          summary: fallback.summary,
          match_percentage: fallback.matchPercentage,
          match_level: fallback.matchLevel,
          matched_skills: fallback.matchedSkills,
          missing_skills: fallback.missingSkills,
          source: 'local_heuristic'
        };
      }

      return data;
    } catch (err: any) {
      console.warn('generateFitSummary exception, using local fallback:', err);
      const fallback = this.generateLocalFitSummaryFallback(payload);
      return {
        success: true,
        summary: fallback.summary,
        match_percentage: fallback.matchPercentage,
        match_level: fallback.matchLevel,
        matched_skills: fallback.matchedSkills,
        missing_skills: fallback.missingSkills,
        source: 'local_heuristic'
      };
    }
  }

  private generateLocalFitSummaryFallback(payload: {
    student_skills: string[];
    job_requirements: string[] | string;
    job_title?: string;
    candidate_name?: string;
  }) {
    const candidateName = payload.candidate_name || 'The candidate';
    const jobTitle = payload.job_title || 'target position';
    const studentSkills = payload.student_skills || [];
    const jobReqs: string[] = Array.isArray(payload.job_requirements)
      ? payload.job_requirements
      : typeof payload.job_requirements === 'string'
      ? payload.job_requirements.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)
      : [];

    const lowerSet = new Set(studentSkills.map(s => s.toLowerCase()));
    const matchedSkills = jobReqs.filter(r => lowerSet.has(r.toLowerCase()));
    const missingSkills = jobReqs.filter(r => !lowerSet.has(r.toLowerCase()));

    const total = Math.max(jobReqs.length, 1);
    const matchPercentage = Math.min(100, Math.round((matchedSkills.length / total) * 100));
    const matchLevel = matchPercentage >= 75 ? 'High Fit' : matchPercentage >= 45 ? 'Moderate Fit' : 'Needs Review';

    const topMatched = matchedSkills.length > 0
      ? matchedSkills.slice(0, 3).join(', ')
      : studentSkills.slice(0, 3).join(', ') || 'core computational principles';

    const topMissing = missingSkills.length > 0
      ? missingSkills.slice(0, 3).join(', ')
      : 'advanced enterprise scaling';

    let summary = '';
    if (matchPercentage >= 75) {
      summary = `${candidateName} demonstrates strong technical alignment in ${topMatched}, positioning them as a high-potential day-one contributor for the ${jobTitle} role. While overall technical fit is robust, verifying hands-on depth in ${topMissing} during technical rounds is recommended.`;
    } else if (matchPercentage >= 40) {
      summary = `${candidateName} showcases foundational proficiency in ${topMatched}, satisfying several core baseline requirements for the ${jobTitle} position. However, noticeable gaps in ${topMissing} indicate that targeted interview probing and potential ramp-up support will be essential.`;
    } else {
      summary = `${candidateName} possesses transferable baseline skills including ${topMatched}, but exhibits significant gaps against key ${jobTitle} requirements such as ${topMissing}. Deeper technical screening is advised to assess the candidate's learning agility and domain depth before advancement.`;
    }

    return {
      summary,
      matchPercentage,
      matchLevel,
      matchedSkills,
      missingSkills
    };
  }
}
