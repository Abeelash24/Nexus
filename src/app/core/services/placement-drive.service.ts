import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ToastService } from './toast.service';
import { AuditLogService } from './audit-log.service';
import { 
  PlacementDrive, 
  DriveRound, 
  DriveRoundResult, 
  InterviewSlot, 
  DriveOffer, 
  DriveStatus, 
  SlotStatus 
} from '../models/placement-drive.model';

const STORAGE_KEYS = {
  DRIVES: 'careernexus_placement_drives_cache',
  ROUNDS: 'careernexus_drive_rounds_cache',
  RESULTS: 'careernexus_round_results_cache',
  SLOTS: 'careernexus_interview_slots_cache',
  OFFERS: 'careernexus_drive_offers_cache'
};

const INITIAL_DRIVES: PlacementDrive[] = [
  {
    id: 'drv-google-2026',
    companyId: 'comp-google',
    companyName: 'Google',
    companyLogo: 'https://images.unsplash.com/photo-1572021335469-31706a17aaef?w=150&auto=format&fit=crop&q=80',
    title: 'Google Campus Placement Drive 2026',
    roleDesignation: 'Software Development Engineer I',
    description: 'On-campus recruitment drive for 2026 and 2027 graduating cohorts. Evaluation across data structures, system design, and Go/Java development.',
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology', 'Electronics & Communication'],
    minimumCgpa: 8.0,
    maxBacklogs: 0,
    requiredSkills: ['Data Structures & Algorithms', 'Java', 'Python', 'System Design', 'Git'],
    applicationDeadline: new Date(Date.now() + 10 * 86400000).toISOString(),
    driveDate: new Date(Date.now() + 14 * 86400000).toISOString(),
    mode: 'Hybrid',
    venue: 'Campus Tech Hall / Google Meet Virtual Assessment',
    salaryCtc: '₹32 - ₹45 LPA',
    status: 'In Progress',
    currentRoundNumber: 2,
    totalRounds: 4,
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    applicantCount: 42
  },
  {
    id: 'drv-microsoft-2026',
    companyId: 'comp-msft',
    companyName: 'Microsoft',
    companyLogo: 'https://images.unsplash.com/photo-1642132652809-8c6ef031dcf7?w=150&auto=format&fit=crop&q=80',
    title: 'Microsoft College Hiring Wave',
    roleDesignation: 'Cloud Solutions & Software Engineer',
    description: 'Full-time campus intake for Azure Cloud Infrastructure and Core Software Engineering engineering teams.',
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology'],
    minimumCgpa: 7.5,
    maxBacklogs: 0,
    requiredSkills: ['C#', 'TypeScript', 'Azure', 'Algorithms', 'SQL'],
    applicationDeadline: new Date(Date.now() + 15 * 86400000).toISOString(),
    driveDate: new Date(Date.now() + 20 * 86400000).toISOString(),
    mode: 'Online',
    venue: 'Microsoft Teams Assessment Portal',
    salaryCtc: '₹28 - ₹36 LPA',
    status: 'Applications Open',
    currentRoundNumber: 1,
    totalRounds: 3,
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    applicantCount: 38
  },
  {
    id: 'drv-amazon-2026',
    companyId: 'comp-amazon',
    companyName: 'Amazon',
    companyLogo: 'https://images.unsplash.com/photo-1523474255658-4af61b1684c2?w=150&auto=format&fit=crop&q=80',
    title: 'Amazon SDE University Hiring',
    roleDesignation: 'Software Development Engineer',
    description: 'Annual placement drive focusing on Leadership Principles, scalable distributed systems, and real-time coding challenges.',
    eligibleDepartments: ['Computer Science & Engineering', 'Information Technology', 'Electronics & Communication'],
    minimumCgpa: 7.0,
    maxBacklogs: 1,
    requiredSkills: ['Java', 'Object Oriented Programming', 'AWS', 'Data Structures', 'REST API'],
    applicationDeadline: new Date(Date.now() + 5 * 86400000).toISOString(),
    driveDate: new Date(Date.now() + 8 * 86400000).toISOString(),
    mode: 'Online',
    venue: 'Amazon Chime & HackerRank Platform',
    salaryCtc: '₹26 - ₹34 LPA',
    status: 'Screening',
    currentRoundNumber: 1,
    totalRounds: 4,
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    applicantCount: 56
  }
];

const INITIAL_ROUNDS: DriveRound[] = [
  {
    id: 'rnd-g-1',
    driveId: 'drv-google-2026',
    roundOrder: 1,
    roundName: 'Round 1: Online Coding Challenge',
    roundType: 'Coding Assessment',
    scheduledAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    durationMinutes: 90,
    description: '3 algorithmic problems on dynamic programming, graph traversal, and arrays.',
    venueOrLink: 'Google Online Assessment Platform',
    status: 'Completed',
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'rnd-g-2',
    driveId: 'drv-google-2026',
    roundOrder: 2,
    roundName: 'Round 2: Technical Problem Solving',
    roundType: 'Technical Interview',
    scheduledAt: new Date(Date.now() + 2 * 86400000).toISOString(),
    durationMinutes: 45,
    description: '1-on-1 live coding session defending time complexity and optimal space allocation.',
    venueOrLink: 'https://meet.google.com/nexus-tech-round2',
    status: 'In Progress',
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'rnd-g-3',
    driveId: 'drv-google-2026',
    roundOrder: 3,
    roundName: 'Round 3: System Architecture & Core CS',
    roundType: 'Technical Interview',
    scheduledAt: new Date(Date.now() + 4 * 86400000).toISOString(),
    durationMinutes: 45,
    description: 'Operating systems, network protocols, database transactions, and scalable architecture.',
    venueOrLink: 'https://meet.google.com/nexus-system-round3',
    status: 'Pending',
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'rnd-g-4',
    driveId: 'drv-google-2026',
    roundOrder: 4,
    roundName: 'Round 4: Googliness & Leadership',
    roundType: 'HR Interview',
    scheduledAt: new Date(Date.now() + 6 * 86400000).toISOString(),
    durationMinutes: 30,
    description: 'Behavioral scenarios, cross-functional collaboration, and cultural alignment.',
    venueOrLink: 'https://meet.google.com/nexus-hr-round4',
    status: 'Pending',
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const INITIAL_SLOTS: InterviewSlot[] = [
  {
    id: 'slt-101',
    driveId: 'drv-google-2026',
    roundId: 'rnd-g-2',
    studentId: 'std-101',
    studentName: 'Aarav Sharma',
    studentRoll: '2023CSE042',
    interviewerName: 'Senior Google Staff Engineer',
    interviewerEmail: 'interviewer.g@google.com',
    slotDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
    startTime: '10:00 AM',
    endTime: '10:45 AM',
    meetingLink: 'https://meet.google.com/nexus-slot-101',
    venue: 'Google Meet Room A',
    status: 'Scheduled',
    feedback: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'slt-102',
    driveId: 'drv-google-2026',
    roundId: 'rnd-g-2',
    studentId: 'std-102',
    studentName: 'Priya Patel',
    studentRoll: '2023IT019',
    interviewerName: 'Principal Tech Lead',
    interviewerEmail: 'techlead.g@google.com',
    slotDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
    startTime: '11:00 AM',
    endTime: '11:45 AM',
    meetingLink: 'https://meet.google.com/nexus-slot-102',
    venue: 'Google Meet Room B',
    status: 'Scheduled',
    feedback: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const INITIAL_OFFERS: DriveOffer[] = [
  {
    id: 'ofr-901',
    driveId: 'drv-google-2026',
    studentId: 'std-101',
    studentName: 'Aarav Sharma',
    studentEmail: 'aarav.sharma@careernexus.edu',
    companyName: 'Google',
    roleDesignation: 'Software Development Engineer I',
    ctcPackage: '₹42 LPA',
    baseSalary: '₹22 LPA',
    joiningDate: '2027-07-01',
    offerLetterUrl: 'https://careernexus.edu/docs/offers/google-sde-aarav.pdf',
    status: 'Offered',
    acceptanceDeadline: new Date(Date.now() + 14 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  }
];

@Injectable({
  providedIn: 'root'
})
export class PlacementDriveService {
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);
  private auditLog = inject(AuditLogService);

  private drivesSignal = signal<PlacementDrive[]>(this.loadCache(STORAGE_KEYS.DRIVES, INITIAL_DRIVES));
  private roundsSignal = signal<DriveRound[]>(this.loadCache(STORAGE_KEYS.ROUNDS, INITIAL_ROUNDS));
  private slotsSignal = signal<InterviewSlot[]>(this.loadCache(STORAGE_KEYS.SLOTS, INITIAL_SLOTS));
  private offersSignal = signal<DriveOffer[]>(this.loadCache(STORAGE_KEYS.OFFERS, INITIAL_OFFERS));

  isLoading = signal<boolean>(false);

  drives = computed(() => this.drivesSignal());
  rounds = computed(() => this.roundsSignal());
  slots = computed(() => this.slotsSignal());
  offers = computed(() => this.offersSignal());

  activeDrives = computed(() => 
    this.drivesSignal().filter(d => d.status !== 'Completed' && d.status !== 'Cancelled')
  );

  getDriveById(id: string): PlacementDrive | undefined {
    return this.drivesSignal().find(d => d.id === id);
  }

  async publishDrive(id: string): Promise<void> {
    await this.updateDrive(id, { status: 'Published' });
  }

  async closeDrive(id: string): Promise<void> {
    await this.updateDriveStatus(id, 'Closed');
  }

  constructor() {
    this.fetchDrivesFromSupabase();
  }

  private loadCache<T>(key: string, fallback: T[]): T[] {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return fallback;
  }

  private saveCache<T>(key: string, data: T[]) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      // ignore
    }
  }

  /**
   * Uploads a banner image to Supabase Storage 'drive-banners' bucket
   * Validates MIME type (JPEG/PNG/WebP) and file size (max 5MB).
   */
  async uploadBannerImage(file: File): Promise<{ url: string; error?: string }> {
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMime.includes(file.type)) {
      const msg = 'Invalid file format. Please upload a JPEG, PNG, or WebP image.';
      this.toast.error('Upload Error', msg);
      return { url: '', error: msg };
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      const msg = 'File exceeds maximum size limit of 5MB.';
      this.toast.error('Upload Error', msg);
      return { url: '', error: msg };
    }

    const client = this.supabase.getClient();
    if (!this.supabase.isConfigured || !client) {
      const fallbackUrl = URL.createObjectURL(file);
      this.toast.info('Local Preview Ready', 'Image loaded for local preview.');
      return { url: fallbackUrl };
    }

    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
      const cleanFileName = `drive_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `banners/${cleanFileName}`;

      const { data, error } = await client.storage
        .from('drive-banners')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        });

      if (error) {
        console.warn('Supabase storage upload error:', error);
        const fallbackUrl = URL.createObjectURL(file);
        this.toast.warning('Storage Notice', `${error.message}. Local preview used.`);
        return { url: fallbackUrl, error: error.message };
      }

      const { data: pubData } = client.storage
        .from('drive-banners')
        .getPublicUrl(filePath);

      const publicUrl = pubData.publicUrl;
      this.toast.success('Banner Uploaded', 'Placement drive banner image uploaded successfully.');
      return { url: publicUrl };
    } catch (err: any) {
      console.warn('Unexpected error uploading banner:', err);
      const fallbackUrl = URL.createObjectURL(file);
      return { url: fallbackUrl, error: err?.message || 'Upload failed' };
    }
  }

  async fetchDrivesFromSupabase() {
    const client = this.supabase.getClient();
    if (!this.supabase.isConfigured || !client) return;

    this.isLoading.set(true);
    try {
      // 1. Fetch Drives
      const { data: driveData, error: driveErr } = await client
        .from('placement_drives')
        .select('*')
        .order('created_at', { ascending: false });

      if (!driveErr && driveData && driveData.length > 0) {
        const formatted: PlacementDrive[] = driveData.map((d: any) => ({
          id: d.id,
          companyId: d.company_id || 'comp-default',
          jobId: d.job_id || undefined,
          companyName: d.company_name,
          companyLogo: d.company_logo || '',
          bannerUrl: d.banner_url || '',
          title: d.title,
          jobRole: d.job_role || d.role_designation || 'Software Engineer',
          roleDesignation: d.role_designation || d.job_role || 'Software Engineer',
          description: d.description || '',
          employmentType: d.employment_type || 'Full Time',
          location: d.location || 'Bengaluru / Hybrid',
          eligibilityCriteria: d.eligibility_criteria || '',
          eligibleDepartments: d.eligible_departments || ['Computer Science & Engineering', 'Information Technology'],
          eligibleBatches: d.eligible_batches || ['2026', '2027'],
          minimumCgpa: Number(d.minimum_cgpa) || 6.5,
          maxBacklogs: d.max_backlogs ?? 0,
          requiredSkills: d.required_skills || [],
          applicationStartDate: d.application_start_date || d.created_at,
          applicationDeadline: d.application_deadline,
          driveDate: d.drive_date,
          mode: d.mode || 'Online',
          venue: d.venue || 'Virtual Campus Hall',
          salaryCtc: d.salary_ctc || '₹12 - ₹18 LPA',
          selectionProcess: d.selection_process || 'Online Assessment -> Technical Interview -> HR Interview',
          vacancies: d.vacancies || 5,
          status: (d.status as DriveStatus) || 'Published',
          currentRoundNumber: d.current_round_number || 1,
          totalRounds: d.total_rounds || 3,
          createdBy: d.created_by,
          createdAt: d.created_at,
          updatedAt: d.updated_at
        }));
        this.drivesSignal.set(formatted);
        this.saveCache(STORAGE_KEYS.DRIVES, formatted);
      }

      // 2. Fetch Rounds
      const { data: roundData } = await client
        .from('drive_rounds')
        .select('*')
        .order('round_order', { ascending: true });

      if (roundData && roundData.length > 0) {
        const formattedRounds: DriveRound[] = roundData.map((r: any) => ({
          id: r.id,
          driveId: r.drive_id,
          roundOrder: r.round_order,
          roundName: r.round_name,
          roundType: r.round_type,
          scheduledAt: r.scheduled_at,
          durationMinutes: r.duration_minutes,
          description: r.description || '',
          venueOrLink: r.venue_or_link || '',
          status: r.status,
          createdAt: r.created_at,
          updatedAt: r.updated_at
        }));
        this.roundsSignal.set(formattedRounds);
        this.saveCache(STORAGE_KEYS.ROUNDS, formattedRounds);
      }

      // 3. Fetch Slots
      const { data: slotData } = await client
        .from('interview_slots')
        .select('*')
        .order('slot_date', { ascending: true });

      if (slotData && slotData.length > 0) {
        const formattedSlots: InterviewSlot[] = slotData.map((s: any) => ({
          id: s.id,
          driveId: s.drive_id,
          roundId: s.round_id,
          studentId: s.student_id,
          studentName: s.student_name,
          studentRoll: s.student_roll,
          interviewerName: s.interviewer_name,
          interviewerEmail: s.interviewer_email,
          slotDate: s.slot_date,
          startTime: s.start_time,
          endTime: s.end_time,
          meetingLink: s.meeting_link,
          venue: s.venue,
          status: s.status,
          createdAt: s.created_at,
          updatedAt: s.updated_at
        }));
        this.slotsSignal.set(formattedSlots);
        this.saveCache(STORAGE_KEYS.SLOTS, formattedSlots);
      }

      // 4. Fetch Offers
      const { data: offerData } = await client
        .from('drive_offers')
        .select('*')
        .order('created_at', { ascending: false });

      if (offerData && offerData.length > 0) {
        const formattedOffers: DriveOffer[] = offerData.map((o: any) => ({
          id: o.id,
          driveId: o.drive_id,
          studentId: o.student_id,
          studentName: o.student_name,
          studentEmail: o.student_email,
          companyName: o.company_name,
          roleDesignation: o.role_designation,
          ctcPackage: o.ctc_package,
          baseSalary: o.base_salary,
          joiningDate: o.joining_date,
          offerLetterUrl: o.offer_letter_url,
          status: o.status,
          acceptanceDeadline: o.acceptance_deadline,
          createdAt: o.created_at,
          updatedAt: o.updated_at
        }));
        this.offersSignal.set(formattedOffers);
        this.saveCache(STORAGE_KEYS.OFFERS, formattedOffers);
      }
    } catch (err) {
      console.warn('Could not sync placement drives from Supabase:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  async createDrive(driveInput: Partial<PlacementDrive>): Promise<PlacementDrive> {
    const client = this.supabase.getClient();
    let currentUserId: string | undefined;
    if (client) {
      try {
        const { data: uData } = await client.auth.getUser();
        currentUserId = uData?.user?.id;
      } catch {
        // ignore
      }
    }

    const newDrive: PlacementDrive = {
      id: 'drv-' + Math.random().toString(36).substring(2, 9),
      companyId: driveInput.companyId || 'comp-default',
      companyName: driveInput.companyName || 'Hiring Partner',
      companyLogo: driveInput.companyLogo || 'https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=150&auto=format&fit=crop&q=80',
      bannerUrl: driveInput.bannerUrl || '',
      title: driveInput.title || 'Campus Recruitment Drive',
      jobRole: driveInput.jobRole || driveInput.roleDesignation || 'Associate Engineer',
      roleDesignation: driveInput.roleDesignation || driveInput.jobRole || 'Associate Engineer',
      description: driveInput.description || 'University placement hiring drive.',
      employmentType: driveInput.employmentType || 'Full Time',
      location: driveInput.location || 'Bengaluru / Hybrid',
      eligibilityCriteria: driveInput.eligibilityCriteria || '',
      eligibleDepartments: driveInput.eligibleDepartments || ['Computer Science & Engineering', 'Information Technology'],
      eligibleBatches: driveInput.eligibleBatches || ['2026', '2027'],
      minimumCgpa: driveInput.minimumCgpa ?? 7.0,
      maxBacklogs: driveInput.maxBacklogs ?? 0,
      requiredSkills: driveInput.requiredSkills || ['Java', 'SQL', 'Git'],
      applicationStartDate: driveInput.applicationStartDate || new Date().toISOString(),
      applicationDeadline: driveInput.applicationDeadline || new Date(Date.now() + 14 * 86400000).toISOString(),
      driveDate: driveInput.driveDate || new Date(Date.now() + 20 * 86400000).toISOString(),
      mode: driveInput.mode || 'Online',
      venue: driveInput.venue || 'Virtual Campus Hall',
      salaryCtc: driveInput.salaryCtc || '₹12 - ₹18 LPA',
      selectionProcess: driveInput.selectionProcess || 'Online Assessment -> Technical Interview -> HR Interview',
      vacancies: driveInput.vacancies || 5,
      status: driveInput.status || 'Published',
      currentRoundNumber: 1,
      totalRounds: driveInput.totalRounds || 3,
      createdBy: currentUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (this.supabase.isConfigured && client) {
      try {
        const { data, error } = await client.from('placement_drives').insert({
          company_name: newDrive.companyName,
          company_logo: newDrive.companyLogo,
          banner_url: newDrive.bannerUrl,
          title: newDrive.title,
          job_role: newDrive.jobRole,
          role_designation: newDrive.roleDesignation,
          description: newDrive.description,
          employment_type: newDrive.employmentType,
          location: newDrive.location,
          eligibility_criteria: newDrive.eligibilityCriteria,
          eligible_departments: newDrive.eligibleDepartments,
          eligible_batches: newDrive.eligibleBatches,
          minimum_cgpa: newDrive.minimumCgpa,
          max_backlogs: newDrive.maxBacklogs,
          required_skills: newDrive.requiredSkills,
          application_start_date: newDrive.applicationStartDate,
          application_deadline: newDrive.applicationDeadline,
          drive_date: newDrive.driveDate,
          mode: newDrive.mode,
          venue: newDrive.venue,
          salary_ctc: newDrive.salaryCtc,
          selection_process: newDrive.selectionProcess,
          vacancies: newDrive.vacancies,
          status: newDrive.status,
          current_round_number: newDrive.currentRoundNumber,
          total_rounds: newDrive.totalRounds,
          created_by: currentUserId
        }).select().single();

        if (!error && data) {
          newDrive.id = data.id;

          // If published, sync to public.jobs table for student applicants
          if (newDrive.status === 'Published') {
            const { data: jobData } = await client.from('jobs').insert({
              company_name: newDrive.companyName,
              company_logo: newDrive.companyLogo,
              company_location: newDrive.location,
              title: newDrive.title,
              description: newDrive.description,
              domain: 'Software Development',
              location: newDrive.location,
              employment_type: newDrive.employmentType,
              salary: newDrive.salaryCtc,
              eligibility: `B.Tech with minimum CGPA of ${newDrive.minimumCgpa}`,
              minimum_cgpa: newDrive.minimumCgpa,
              required_skills: newDrive.requiredSkills,
              application_deadline: newDrive.applicationDeadline,
              status: 'Active',
              vacancies: newDrive.vacancies,
              applicants_count: 0,
              banner_url: newDrive.bannerUrl,
              drive_id: newDrive.id,
              eligible_departments: newDrive.eligibleDepartments,
              eligible_batches: newDrive.eligibleBatches,
              created_by: currentUserId
            }).select().single();

            if (jobData) {
              newDrive.jobId = jobData.id;
              await client.from('placement_drives').update({ job_id: jobData.id }).eq('id', newDrive.id);
            }
          }
        } else if (error) {
          console.warn('Error inserting placement drive to Supabase:', error);
        }
      } catch (err) {
        console.warn('Error inserting placement drive to Supabase:', err);
      }
    }

    this.drivesSignal.update(list => [newDrive, ...list]);
    this.saveCache(STORAGE_KEYS.DRIVES, this.drivesSignal());

    this.auditLog.logAction(
      'CREATE_PLACEMENT_DRIVE',
      'placement_drive',
      newDrive.id,
      { title: newDrive.title, companyName: newDrive.companyName, status: newDrive.status }
    );

    this.toast.success(
      newDrive.status === 'Draft' ? 'Draft Saved' : 'Drive Published Successfully',
      `Placement drive "${newDrive.title}" for ${newDrive.companyName} is ${newDrive.status.toLowerCase()}.`
    );
    return newDrive;
  }

  async updateDrive(driveId: string, updates: Partial<PlacementDrive>): Promise<void> {
    const existing = this.drivesSignal().find(d => d.id === driveId);
    this.drivesSignal.update(list =>
      list.map(d => d.id === driveId ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d)
    );
    this.saveCache(STORAGE_KEYS.DRIVES, this.drivesSignal());

    const client = this.supabase.getClient();
    if (this.supabase.isConfigured && client && !driveId.startsWith('drv-')) {
      try {
        const payload: any = { updated_at: new Date().toISOString() };
        if (updates.title !== undefined) payload.title = updates.title;
        if (updates.jobRole !== undefined) payload.job_role = updates.jobRole;
        if (updates.roleDesignation !== undefined) payload.role_designation = updates.roleDesignation;
        if (updates.description !== undefined) payload.description = updates.description;
        if (updates.bannerUrl !== undefined) payload.banner_url = updates.bannerUrl;
        if (updates.employmentType !== undefined) payload.employment_type = updates.employmentType;
        if (updates.location !== undefined) payload.location = updates.location;
        if (updates.eligibilityCriteria !== undefined) payload.eligibility_criteria = updates.eligibilityCriteria;
        if (updates.eligibleDepartments !== undefined) payload.eligible_departments = updates.eligibleDepartments;
        if (updates.eligibleBatches !== undefined) payload.eligible_batches = updates.eligibleBatches;
        if (updates.minimumCgpa !== undefined) payload.minimum_cgpa = updates.minimumCgpa;
        if (updates.maxBacklogs !== undefined) payload.max_backlogs = updates.maxBacklogs;
        if (updates.requiredSkills !== undefined) payload.required_skills = updates.requiredSkills;
        if (updates.applicationStartDate !== undefined) payload.application_start_date = updates.applicationStartDate;
        if (updates.applicationDeadline !== undefined) payload.application_deadline = updates.applicationDeadline;
        if (updates.driveDate !== undefined) payload.drive_date = updates.driveDate;
        if (updates.mode !== undefined) payload.mode = updates.mode;
        if (updates.venue !== undefined) payload.venue = updates.venue;
        if (updates.salaryCtc !== undefined) payload.salary_ctc = updates.salaryCtc;
        if (updates.selectionProcess !== undefined) payload.selection_process = updates.selectionProcess;
        if (updates.vacancies !== undefined) payload.vacancies = updates.vacancies;
        if (updates.status !== undefined) payload.status = updates.status;

        await client.from('placement_drives').update(payload).eq('id', driveId);

        // Sync with jobs table if linked
        const targetJobId = updates.jobId || existing?.jobId;
        if (targetJobId) {
          const jobPayload: any = { updated_at: new Date().toISOString() };
          if (updates.title) jobPayload.title = updates.title;
          if (updates.description) jobPayload.description = updates.description;
          if (updates.salaryCtc) jobPayload.salary = updates.salaryCtc;
          if (updates.location) jobPayload.location = updates.location;
          if (updates.bannerUrl !== undefined) jobPayload.banner_url = updates.bannerUrl;
          if (updates.minimumCgpa !== undefined) jobPayload.minimum_cgpa = updates.minimumCgpa;
          if (updates.requiredSkills !== undefined) jobPayload.required_skills = updates.requiredSkills;
          if (updates.status === 'Closed' || updates.status === 'Cancelled' || updates.status === 'Completed') {
            jobPayload.status = 'Closed';
          } else if (updates.status === 'Published') {
            jobPayload.status = 'Active';
          }
          await client.from('jobs').update(jobPayload).eq('id', targetJobId);
        } else if (updates.status === 'Published' && existing && !existing.jobId) {
          // If transitioning from Draft to Published, create corresponding job
          const { data: jobData } = await client.from('jobs').insert({
            company_name: existing.companyName,
            company_logo: existing.companyLogo,
            company_location: updates.location || existing.location,
            title: updates.title || existing.title,
            description: updates.description || existing.description,
            domain: 'Software Development',
            location: updates.location || existing.location,
            employment_type: updates.employmentType || existing.employmentType,
            salary: updates.salaryCtc || existing.salaryCtc,
            eligibility: `B.Tech with minimum CGPA of ${updates.minimumCgpa ?? existing.minimumCgpa}`,
            minimum_cgpa: updates.minimumCgpa ?? existing.minimumCgpa,
            required_skills: updates.requiredSkills || existing.requiredSkills,
            application_deadline: updates.applicationDeadline || existing.applicationDeadline,
            status: 'Active',
            vacancies: updates.vacancies || existing.vacancies,
            applicants_count: 0,
            banner_url: updates.bannerUrl !== undefined ? updates.bannerUrl : existing.bannerUrl,
            drive_id: driveId,
            eligible_departments: updates.eligibleDepartments || existing.eligibleDepartments,
            eligible_batches: updates.eligibleBatches || existing.eligibleBatches,
            created_by: existing.createdBy
          }).select().single();

          if (jobData) {
            await client.from('placement_drives').update({ job_id: jobData.id }).eq('id', driveId);
            this.drivesSignal.update(list => list.map(d => d.id === driveId ? { ...d, jobId: jobData.id } : d));
          }
        }
      } catch (err) {
        console.warn('Error updating drive in Supabase:', err);
      }
    }

    this.toast.info('Drive Updated', 'Placement drive details saved.');
  }

  async deleteDrive(driveId: string): Promise<void> {
    const drive = this.drivesSignal().find(d => d.id === driveId);
    this.drivesSignal.update(list => list.filter(d => d.id !== driveId));
    this.saveCache(STORAGE_KEYS.DRIVES, this.drivesSignal());

    const client = this.supabase.getClient();
    if (this.supabase.isConfigured && client && !driveId.startsWith('drv-')) {
      try {
        if (drive?.jobId) {
          await client.from('jobs').delete().eq('id', drive.jobId);
        }
        await client.from('placement_drives').delete().eq('id', driveId);
      } catch (err) {
        console.warn('Error deleting drive from Supabase:', err);
      }
    }

    this.toast.info('Drive Removed', `${drive?.title || 'Placement drive'} has been removed.`);
  }

  async updateDriveStatus(driveId: string, status: DriveStatus): Promise<void> {
    const existing = this.drivesSignal().find(d => d.id === driveId);
    if (!existing) return;

    this.drivesSignal.update(list => 
      list.map(d => d.id === driveId ? { ...d, status, updatedAt: new Date().toISOString() } : d)
    );
    this.saveCache(STORAGE_KEYS.DRIVES, this.drivesSignal());

    const client = this.supabase.getClient();
    if (this.supabase.isConfigured && client && !driveId.startsWith('drv-')) {
      try {
        await client.from('placement_drives').update({ status, updated_at: new Date().toISOString() }).eq('id', driveId);
        if (existing.jobId) {
          const jobStatus = (status === 'Closed' || status === 'Completed' || status === 'Cancelled') ? 'Closed' : 'Active';
          await client.from('jobs').update({ status: jobStatus, updated_at: new Date().toISOString() }).eq('id', existing.jobId);
        }
      } catch (err) {
        console.warn('Error updating drive status in Supabase:', err);
      }
    }

    this.auditLog.logAction(
      'UPDATE_DRIVE_STATUS',
      'placement_drive',
      driveId,
      { status, title: existing.title }
    );

    this.toast.info('Drive Status Updated', `Status changed to "${status}".`);
  }

  async addRound(roundInput: Partial<DriveRound>): Promise<DriveRound> {
    const newRound: DriveRound = {
      id: 'rnd-' + Math.random().toString(36).substring(2, 9),
      driveId: roundInput.driveId!,
      roundOrder: roundInput.roundOrder || (this.roundsSignal().filter(r => r.driveId === roundInput.driveId).length + 1),
      roundName: roundInput.roundName || 'Technical Interview',
      roundType: roundInput.roundType || 'Technical Interview',
      scheduledAt: roundInput.scheduledAt || new Date().toISOString(),
      durationMinutes: roundInput.durationMinutes || 60,
      description: roundInput.description || '',
      venueOrLink: roundInput.venueOrLink || 'Google Meet',
      status: 'Pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.roundsSignal.update(list => [...list, newRound]);
    this.saveCache(STORAGE_KEYS.ROUNDS, this.roundsSignal());

    const client = this.supabase.getClient();
    if (this.supabase.isConfigured && client && !roundInput.driveId?.startsWith('drv-')) {
      try {
        const { data } = await client.from('drive_rounds').insert({
          drive_id: newRound.driveId,
          round_order: newRound.roundOrder,
          round_name: newRound.roundName,
          round_type: newRound.roundType,
          scheduled_at: newRound.scheduledAt,
          duration_minutes: newRound.durationMinutes,
          description: newRound.description,
          venue_or_link: newRound.venueOrLink,
          status: newRound.status
        }).select().single();
        if (data) newRound.id = data.id;
      } catch (err) {
        console.warn('Error saving round to Supabase:', err);
      }
    }

    this.toast.success('Round Configured', `Added "${newRound.roundName}" to drive.`);
    return newRound;
  }

  async updateRoundStatus(roundId: string, status: 'Pending' | 'In Progress' | 'Completed'): Promise<void> {
    this.roundsSignal.update(list =>
      list.map(r => r.id === roundId ? { ...r, status, updatedAt: new Date().toISOString() } : r)
    );
    this.saveCache(STORAGE_KEYS.ROUNDS, this.roundsSignal());

    const client = this.supabase.getClient();
    if (this.supabase.isConfigured && client && !roundId.startsWith('rnd-')) {
      try {
        await client.from('drive_rounds').update({ status, updated_at: new Date().toISOString() }).eq('id', roundId);
      } catch (err) {
        console.warn('Error updating round in Supabase:', err);
      }
    }

    this.toast.info('Round Updated', `Round status changed to ${status}.`);
  }

  async deleteRound(roundId: string): Promise<void> {
    this.roundsSignal.update(list => list.filter(r => r.id !== roundId));
    this.saveCache(STORAGE_KEYS.ROUNDS, this.roundsSignal());

    const client = this.supabase.getClient();
    if (this.supabase.isConfigured && client && !roundId.startsWith('rnd-')) {
      try {
        await client.from('drive_rounds').delete().eq('id', roundId);
      } catch (err) {
        console.warn('Error deleting round in Supabase:', err);
      }
    }

    this.toast.info('Round Removed', 'Round deleted from drive.');
  }

  async scheduleSlot(slotInput: Partial<InterviewSlot>): Promise<InterviewSlot> {
    const newSlot: InterviewSlot = {
      id: 'slt-' + Math.random().toString(36).substring(2, 9),
      driveId: slotInput.driveId!,
      roundId: slotInput.roundId,
      studentId: slotInput.studentId,
      studentName: slotInput.studentName || 'Student Candidate',
      studentRoll: slotInput.studentRoll || '',
      interviewerName: slotInput.interviewerName || 'Technical Interviewer',
      interviewerEmail: slotInput.interviewerEmail || '',
      slotDate: slotInput.slotDate || new Date().toISOString().split('T')[0],
      startTime: slotInput.startTime || '10:00 AM',
      endTime: slotInput.endTime || '10:45 AM',
      meetingLink: slotInput.meetingLink || 'https://meet.google.com/interview',
      venue: slotInput.venue || 'Virtual Panel',
      status: 'Scheduled',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.slotsSignal.update(list => [...list, newSlot]);
    this.saveCache(STORAGE_KEYS.SLOTS, this.slotsSignal());

    const client = this.supabase.getClient();
    if (this.supabase.isConfigured && client && !slotInput.driveId?.startsWith('drv-')) {
      try {
        const { data } = await client.from('interview_slots').insert({
          drive_id: newSlot.driveId,
          round_id: newSlot.roundId?.startsWith('rnd-') ? null : newSlot.roundId,
          student_id: newSlot.studentId?.startsWith('s-') ? null : newSlot.studentId,
          student_name: newSlot.studentName,
          student_roll: newSlot.studentRoll,
          interviewer_name: newSlot.interviewerName,
          interviewer_email: newSlot.interviewerEmail,
          slot_date: newSlot.slotDate,
          start_time: newSlot.startTime,
          end_time: newSlot.endTime,
          meeting_link: newSlot.meetingLink,
          venue: newSlot.venue,
          status: newSlot.status
        }).select().single();
        if (data) newSlot.id = data.id;
      } catch (err) {
        console.warn('Error saving slot to Supabase:', err);
      }
    }

    this.toast.success('Interview Slot Scheduled', `Slot allocated for ${newSlot.studentName} at ${newSlot.startTime}.`);
    return newSlot;
  }

  async updateSlotStatus(slotId: string, status: SlotStatus): Promise<void> {
    this.slotsSignal.update(list => 
      list.map(s => s.id === slotId ? { ...s, status, updatedAt: new Date().toISOString() } : s)
    );
    this.saveCache(STORAGE_KEYS.SLOTS, this.slotsSignal());

    const client = this.supabase.getClient();
    if (this.supabase.isConfigured && client && !slotId.startsWith('slt-')) {
      try {
        await client.from('interview_slots').update({ status, updated_at: new Date().toISOString() }).eq('id', slotId);
      } catch (err) {
        console.warn('Error updating slot in Supabase:', err);
      }
    }

    this.toast.info('Slot Updated', `Interview slot marked as ${status}.`);
  }

  async releaseOffer(offerInput: Partial<DriveOffer>): Promise<DriveOffer> {
    const newOffer: DriveOffer = {
      id: 'ofr-' + Math.random().toString(36).substring(2, 9),
      driveId: offerInput.driveId!,
      studentId: offerInput.studentId!,
      studentName: offerInput.studentName || 'Selected Candidate',
      studentEmail: offerInput.studentEmail || '',
      companyName: offerInput.companyName || 'Hiring Partner',
      roleDesignation: offerInput.roleDesignation || 'Software Engineer',
      ctcPackage: offerInput.ctcPackage || '₹18 LPA',
      baseSalary: offerInput.baseSalary,
      joiningDate: offerInput.joiningDate,
      offerLetterUrl: offerInput.offerLetterUrl || 'https://careernexus.edu/docs/sample-offer.pdf',
      status: 'Offered',
      acceptanceDeadline: offerInput.acceptanceDeadline || new Date(Date.now() + 14 * 86400000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.offersSignal.update(list => [newOffer, ...list]);
    this.saveCache(STORAGE_KEYS.OFFERS, this.offersSignal());

    const client = this.supabase.getClient();
    if (this.supabase.isConfigured && client && offerInput.driveId) {
      try {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        let resolvedDriveId: string | null = null;
        if (uuidRegex.test(offerInput.driveId)) {
          // Check if drive exists directly in placement_drives
          const { data: driveRow } = await client
            .from('placement_drives')
            .select('id')
            .eq('id', offerInput.driveId)
            .maybeSingle();

          if (driveRow?.id) {
            resolvedDriveId = driveRow.id;
          } else {
            // Check if driveId is actually a jobs.id mapped to a drive
            const { data: mappedDrive } = await client
              .from('placement_drives')
              .select('id')
              .eq('job_id', offerInput.driveId)
              .maybeSingle();
            if (mappedDrive?.id) {
              resolvedDriveId = mappedDrive.id;
            }
          }
        }

        let resolvedStudentId: string | null = null;
        if (offerInput.studentId && uuidRegex.test(offerInput.studentId)) {
          const { data: sRow } = await client
            .from('students')
            .select('id')
            .or(`id.eq.${offerInput.studentId},user_id.eq.${offerInput.studentId}`)
            .maybeSingle();
          if (sRow?.id) {
            resolvedStudentId = sRow.id;
          }
        }

        if (!resolvedStudentId && newOffer.studentEmail) {
          const { data: sRow } = await client
            .from('students')
            .select('id')
            .eq('email', newOffer.studentEmail)
            .maybeSingle();
          if (sRow?.id) {
            resolvedStudentId = sRow.id;
          }
        }

        // Only insert into drive_offers if both drive_id and student_id resolve to valid foreign keys
        if (resolvedDriveId && resolvedStudentId) {
          const { data, error } = await client.from('drive_offers').upsert({
            drive_id: resolvedDriveId,
            student_id: resolvedStudentId,
            student_name: newOffer.studentName,
            student_email: newOffer.studentEmail,
            company_name: newOffer.companyName,
            role_designation: newOffer.roleDesignation,
            ctc_package: newOffer.ctcPackage,
            base_salary: newOffer.baseSalary,
            joining_date: newOffer.joiningDate,
            offer_letter_url: newOffer.offerLetterUrl,
            status: newOffer.status,
            acceptance_deadline: newOffer.acceptanceDeadline
          }, { onConflict: 'drive_id,student_id' }).select().single();

          if (!error && data) {
            newOffer.id = data.id;
            newOffer.driveId = resolvedDriveId;
            newOffer.studentId = resolvedStudentId;

            // Also synchronize student placement_status
            await client
              .from('students')
              .update({ placement_status: 'Selected', updated_at: new Date().toISOString() })
              .eq('id', resolvedStudentId);

            // Also update any matching application status to Selected
            await client
              .from('applications')
              .update({ status: 'Selected', updated_at: new Date().toISOString() })
              .or(`student_id.eq.${resolvedStudentId},student_email.eq.${newOffer.studentEmail}`);
          } else if (error) {
            console.warn('Error saving offer to Supabase:', error.message);
          }
        }
      } catch (err) {
        console.warn('Error saving offer to Supabase:', err);
      }
    }

    this.auditLog.logAction(
      'RELEASE_OFFER',
      'placement_offer',
      newOffer.id,
      { studentName: newOffer.studentName, companyName: newOffer.companyName, ctcPackage: newOffer.ctcPackage }
    );

    this.toast.success('Placement Offer Released! 🏆', `Offer extended to ${newOffer.studentName} (${newOffer.ctcPackage}).`);
    return newOffer;
  }

  getRoundsForDrive(driveId: string): DriveRound[] {
    return this.roundsSignal().filter(r => r.driveId === driveId).sort((a, b) => a.roundOrder - b.roundOrder);
  }

  getSlotsForDrive(driveId: string): InterviewSlot[] {
    return this.slotsSignal().filter(s => s.driveId === driveId);
  }

  getOffersForDrive(driveId: string): DriveOffer[] {
    return this.offersSignal().filter(o => o.driveId === driveId);
  }
}
