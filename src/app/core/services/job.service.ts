import { Injectable, signal, computed, inject } from '@angular/core';
import { Job } from '../models/job.model';
import { SupabaseService } from './supabase.service';
import { ToastService } from './toast.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class JobService {
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);
  private authService = inject(AuthService);

  private readonly LOCAL_STORAGE_KEY = 'placementconnect_jobs_cache';

  private jobsSignal = signal<Job[]>(this.loadInitialJobs());
  isLoading = signal<boolean>(false);

  jobs = computed(() => this.jobsSignal());
  activeJobs = computed(() => this.jobsSignal().filter(j => j.status === 'Active'));

  constructor() {
    this.fetchJobsFromDatabase();
    this.initRealtimeSubscription();
  }

  private loadInitialJobs(): Job[] {
    try {
      const stored = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  }

  private saveJobsToCache(jobs: Job[]) {
    try {
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(jobs));
    } catch {
      // ignore
    }
  }

  async fetchJobsFromDatabase() {
    const client = this.supabase.getClient();
    if (!this.supabase.isConfigured || !client) return;

    this.isLoading.set(true);
    try {
      const { data, error } = await client
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Could not fetch jobs from Supabase:', error.message);
        return;
      }

      if (data) {
        const mapped: Job[] = data.map((d: any) => this.mapDbRowToJob(d));
        this.jobsSignal.set(mapped);
        this.saveJobsToCache(mapped);
      }
    } catch (e) {
      console.warn('Jobs fetch exception:', e);
    } finally {
      this.isLoading.set(false);
    }
  }

  private initRealtimeSubscription() {
    if (!this.supabase.isConfigured) return;
    this.supabase.subscribeToChanges('jobs', (payload) => {
      if (payload.eventType === 'INSERT') {
        const newJob = this.mapDbRowToJob(payload.new);
        this.jobsSignal.update(list => [newJob, ...list.filter(j => j.id !== newJob.id)]);
      } else if (payload.eventType === 'UPDATE') {
        const updated = this.mapDbRowToJob(payload.new);
        this.jobsSignal.update(list => list.map(j => j.id === updated.id ? updated : j));
      } else if (payload.eventType === 'DELETE') {
        this.jobsSignal.update(list => list.filter(j => j.id !== payload.old.id));
      }
      this.saveJobsToCache(this.jobsSignal());
    });
  }

  private mapDbRowToJob(row: any): Job {
    return {
      id: row.id,
      companyId: row.company_id,
      companyName: row.company_name || 'Hiring Partner',
      companyLogo: row.company_logo || 'https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=128&auto=format&fit=crop&q=80',
      companyLocation: row.company_location || row.location || 'Bengaluru',
      bannerUrl: row.banner_url || '',
      driveId: row.drive_id || undefined,
      title: row.title,
      description: row.description || '',
      responsibilities: row.responsibilities || [],
      requirements: row.requirements || [],
      domain: row.domain || 'Software Development',
      location: row.location || 'Bengaluru',
      employmentType: row.employment_type || 'Full Time',
      salary: row.salary || '₹18 - ₹24 LPA',
      eligibility: row.eligibility || 'B.Tech with minimum 7.0 CGPA',
      eligibleDepartments: row.eligible_departments || ['Computer Science & Engineering', 'Information Technology'],
      eligibleBatches: row.eligible_batches || ['2026', '2027'],
      minimumCgpa: Number(row.minimum_cgpa) || 7.0,
      requiredSkills: row.required_skills || ['Java', 'DSA'],
      applicationDeadline: row.application_deadline || new Date(Date.now() + 14 * 86400000).toISOString(),
      status: row.status || 'Active',
      vacancies: row.vacancies || 5,
      applicantsCount: row.applicants_count || 0,
      createdBy: row.created_by || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  getJobById(id: string): Job | undefined {
    return this.jobsSignal().find(j => j.id === id);
  }

  async addJob(jobData: Omit<Job, 'id' | 'applicantsCount' | 'hasApplied' | 'createdAt' | 'updatedAt'>): Promise<Job> {
    const newJob: Job = {
      ...jobData,
      id: `j-${Date.now()}`,
      applicantsCount: 0,
      hasApplied: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.jobsSignal.update(list => [newJob, ...list]);
    this.saveJobsToCache(this.jobsSignal());

    const client = this.supabase.getClient();
    if (this.supabase.isConfigured && client) {
      try {
        const currentUser = (await client.auth.getUser())?.data?.user;
        const { data, error } = await client
          .from('jobs')
          .insert({
            company_id: jobData.companyId,
            company_name: jobData.companyName,
            company_logo: jobData.companyLogo,
            company_location: jobData.companyLocation,
            banner_url: jobData.bannerUrl || '',
            drive_id: jobData.driveId || null,
            title: jobData.title,
            description: jobData.description,
            responsibilities: jobData.responsibilities || [],
            requirements: jobData.requirements || [],
            domain: jobData.domain,
            location: jobData.location,
            employment_type: jobData.employmentType,
            salary: jobData.salary,
            eligibility: jobData.eligibility,
            eligible_departments: jobData.eligibleDepartments || ['Computer Science & Engineering', 'Information Technology'],
            eligible_batches: jobData.eligibleBatches || ['2026', '2027'],
            minimum_cgpa: jobData.minimumCgpa,
            required_skills: jobData.requiredSkills,
            application_deadline: jobData.applicationDeadline,
            status: jobData.status,
            vacancies: jobData.vacancies,
            applicants_count: 0,
            created_by: currentUser?.id
          })
          .select()
          .single();

        if (!error && data) {
          const mapped = this.mapDbRowToJob(data);
          this.jobsSignal.update(list => list.map(j => j.id === newJob.id ? mapped : j));
          this.saveJobsToCache(this.jobsSignal());
          this.toast.success('Job Drive Published', `${mapped.title} at ${mapped.companyName} is now live.`);
          return mapped;
        }
      } catch (err) {
        console.warn('Add job DB error:', err);
      }
    }

    this.toast.success('Job Drive Published', `${newJob.title} at ${newJob.companyName} is now open for applications.`);
    return newJob;
  }

  async updateJob(id: string, updates: Partial<Job>) {
    this.jobsSignal.update(list =>
      list.map(j => j.id === id ? { ...j, ...updates, updatedAt: new Date().toISOString() } : j)
    );
    this.saveJobsToCache(this.jobsSignal());

    const client = this.supabase.getClient();
    if (this.supabase.isConfigured && client && !id.startsWith('j-')) {
      try {
        const payload: any = {};
        if (updates.title) payload.title = updates.title;
        if (updates.description) payload.description = updates.description;
        if (updates.salary) payload.salary = updates.salary;
        if (updates.location) payload.location = updates.location;
        if (updates.domain) payload.domain = updates.domain;
        if (updates.employmentType) payload.employment_type = updates.employmentType;
        if (updates.bannerUrl !== undefined) payload.banner_url = updates.bannerUrl;
        if (updates.minimumCgpa) payload.minimum_cgpa = updates.minimumCgpa;
        if (updates.requiredSkills) payload.required_skills = updates.requiredSkills;
        if (updates.eligibleDepartments) payload.eligible_departments = updates.eligibleDepartments;
        if (updates.eligibleBatches) payload.eligible_batches = updates.eligibleBatches;
        if (updates.status) payload.status = updates.status;
        payload.updated_at = new Date().toISOString();

        await client.from('jobs').update(payload).eq('id', id);
      } catch (err) {
        console.warn('Update job DB error:', err);
      }
    }

    this.toast.success('Job Updated', 'Opening details saved.');
  }

  async deleteJob(id: string) {
    const job = this.jobsSignal().find(j => j.id === id);
    this.jobsSignal.update(list => list.filter(j => j.id !== id));
    this.saveJobsToCache(this.jobsSignal());

    const client = this.supabase.getClient();
    if (this.supabase.isConfigured && client && !id.startsWith('j-')) {
      try {
        await client.from('jobs').delete().eq('id', id);
      } catch (err) {
        console.warn('Delete job DB error:', err);
      }
    }

    this.toast.info('Job Removed', `${job?.title || 'Job'} has been removed.`);
  }

  async closeJob(id: string) {

    this.jobsSignal.update(list =>
      list.map(j => j.id === id ? { ...j, status: 'Closed', updatedAt: new Date().toISOString() } : j)
    );
    this.saveJobsToCache(this.jobsSignal());

    const client = this.supabase.getClient();
    if (this.supabase.isConfigured && client) {
      try {
        await client.from('jobs').update({ status: 'Closed', updated_at: new Date().toISOString() }).eq('id', id);
      } catch (err) {
        console.warn('Close job DB error:', err);
      }
    }

    this.toast.info('Job Closed', 'Application window for this drive has been closed.');
  }

  async markAsApplied(jobId: string) {
    this.jobsSignal.update(list =>
      list.map(j => j.id === jobId ? { ...j, hasApplied: true, applicantsCount: j.applicantsCount + 1 } : j)
    );
    this.saveJobsToCache(this.jobsSignal());

    const client = this.supabase.getClient();
    if (this.supabase.isConfigured && client) {
      try {
        const target = this.getJobById(jobId);
        if (target) {
          await client.from('jobs').update({ applicants_count: target.applicantsCount }).eq('id', jobId);
        }
      } catch (err) {
        console.warn('Mark applied DB error:', err);
      }
    }
  }
}
