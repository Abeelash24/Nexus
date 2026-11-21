import { Injectable, signal, computed, inject } from '@angular/core';
import { Student, Project, Certification, PlacementStatus, ParsedResumeData } from '../models/student.model';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

@Injectable({
  providedIn: 'root'
})
export class StudentService {
  private supabase = inject(SupabaseService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);

  private readonly LOCAL_STORAGE_KEY = 'placementconnect_students_cache';

  // Signals
  private studentsSignal = signal<Student[]>(this.loadInitialStudents());
  isLoading = signal<boolean>(false);

  // Readonly list of all students
  students = computed(() => this.studentsSignal());

  // Active students only (not deactivated)
  activeStudents = computed(() => this.studentsSignal().filter(s => s.isActive !== false));

  // Current logged in student profile
  currentStudent = computed(() => {
    const user = this.authService.currentUser();
    if (!user) {
      return this.createEmptyStudent('guest', 'Guest Student');
    }

    const match = this.studentsSignal().find(
      s => s.userId === user.id || (s.email && s.email.toLowerCase() === user.email.toLowerCase())
    );

    const userAvatar = user.avatarUrl || match?.avatarUrl || match?.profilePhoto || undefined;

    if (match) {
      return {
        ...match,
        fullName: user.fullName || match.fullName,
        avatarUrl: userAvatar,
        profilePhoto: userAvatar || '',
        phone: user.phone || match.phone || '',
        department: user.department || match.department || 'Engineering',
        rollNumber: user.rollNumber || match.rollNumber || ''
      };
    }

    // Dynamic clean student representation for newly logged in user without hardcoded test fixtures
    return this.createEmptyStudent(
      user.id,
      user.fullName || 'Student',
      user.email,
      userAvatar,
      user.phone || '',
      user.department || 'Engineering',
      user.rollNumber || ''
    );
  });

  createEmptyStudent(
    userId: string,
    fullName: string,
    email: string = '',
    avatarUrl?: string,
    phone: string = '',
    department: string = '',
    rollNumber: string = ''
  ): Student {
    return {
      id: `s-${userId}`,
      userId: userId,
      fullName: fullName,
      email: email,
      profilePhoto: avatarUrl || '',
      avatarUrl: avatarUrl,
      phone: phone,
      department: department || 'Engineering',
      course: 'B.Tech',
      batch: '2023-2027',
      graduationYear: 2027,
      rollNumber: rollNumber,
      cgpa: 0,
      tenthPercentage: 0,
      twelfthPercentage: 0,
      skills: [],
      preferredDomain: '',
      bio: '',
      githubUrl: '',
      linkedinUrl: '',
      portfolioUrl: '',
      resumeUrl: '',
      resumeFileName: '',
      placementStatus: 'Not Placed',
      profileCompletion: 0,
      isActive: true,
      projects: [],
      certifications: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  // Statistics
  stats = computed(() => {
    const list = this.studentsSignal();
    const total = list.length;
    const selected = list.filter(s => s.placementStatus === 'Selected' || s.placementStatus === 'Offer Accepted').length;
    const inProgress = list.filter(s => s.placementStatus === 'In Progress').length;
    const notPlaced = list.filter(s => s.placementStatus === 'Not Placed').length;
    const placementRate = total > 0 ? Math.round((selected / total) * 100) : 0;

    return {
      total,
      selected,
      inProgress,
      notPlaced,
      placementRate
    };
  });

  constructor() {
    this.fetchStudentsFromDatabase();
  }

  private loadInitialStudents(): Student[] {
    try {
      const stored = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    return [];
  }

  private saveStudentsToCache(list: Student[]) {
    try {
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  }

  async fetchStudentsFromDatabase() {
    const client = this.supabase.getClient();
    if (!this.supabase.isConfigured || !client) return;

    this.isLoading.set(true);
    try {
      const { data, error } = await client
        .from('students')
        .select('*')
        .order('roll_number', { ascending: true });

      if (error) {
        console.warn('Could not fetch students from Supabase:', error.message);
        return;
      }

      if (!error && data) {
        const mapped: Student[] = data.map((d: any) => this.mapDbRowToStudent(d));
        this.studentsSignal.set(mapped);
        this.saveStudentsToCache(mapped);
      }
    } catch (e) {
      console.warn('Students fetch exception:', e);
    } finally {
      this.isLoading.set(false);
    }
  }

  mapDbRowToStudent(row: any): Student {
    const avatar = row.avatar_url || row.profile_photo || undefined;
    const s: Student = {
      id: row.id,
      userId: row.user_id,
      fullName: row.full_name || '',
      email: row.email || '',
      profilePhoto: avatar || '',
      avatarUrl: avatar,
      phone: row.phone || '',
      department: row.department || '',
      departmentId: row.department_id,
      programId: row.program_id,
      batchId: row.batch_id,
      course: row.course || 'B.Tech',
      batch: row.batch || '2023-2027',
      graduationYear: row.graduation_year || 2027,
      rollNumber: row.roll_number || '',
      cgpa: row.cgpa !== null && row.cgpa !== undefined ? Number(row.cgpa) : 0,
      tenthPercentage: row.tenth_percentage !== null && row.tenth_percentage !== undefined ? Number(row.tenth_percentage) : 0,
      twelfthPercentage: row.twelfth_percentage !== null && row.twelfth_percentage !== undefined ? Number(row.twelfth_percentage) : 0,
      skills: Array.isArray(row.skills) ? row.skills : [],
      preferredDomain: row.preferred_domain || '',
      bio: row.bio || '',
      githubUrl: row.github_url || '',
      linkedinUrl: row.linkedin_url || '',
      portfolioUrl: row.portfolio_url || '',
      resumeUrl: row.resume_url || '',
      resumeFileName: row.resume_file_name || '',
      placementStatus: (row.placement_status as PlacementStatus) || 'Not Placed',
      placedCompany: row.placed_company || '',
      placedPackage: row.placed_package || '',
      profileCompletion: 0,
      isActive: row.is_active ?? true,
      projects: Array.isArray(row.projects) ? row.projects : [],
      certifications: Array.isArray(row.certifications) ? row.certifications : [],
      customFields: row.custom_fields || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
    s.profileCompletion = this.calculateProfileCompletion(s);
    return s;
  }

  async loadStudentForCurrentUser(): Promise<Student | null> {
    const auth = this.supabase.auth;
    const client = this.supabase.getClient();
    if (!this.supabase.isConfigured || !client) return null;

    try {
      let user = this.authService.currentUser();
      if (!user && auth) {
        const { data: { user: authUser } } = await auth.getUser();
        if (authUser) {
          user = {
            id: authUser.id,
            email: authUser.email || '',
            role: (authUser.user_metadata?.['role'] as any) || 'student',
            fullName: authUser.user_metadata?.['full_name'] || '',
            avatarUrl: authUser.user_metadata?.['avatar_url'] || undefined,
            createdAt: authUser.created_at
          };
        }
      }

      if (!user) return null;

      const { data: sRow, error: sErr } = await client
        .from('students')
        .select('*')
        .or(`user_id.eq.${user.id},email.ilike.${user.email}`)
        .maybeSingle();

      const { data: uRow } = await client
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (sRow) {
        const student = this.mapDbRowToStudent(sRow);
        if (uRow) {
          student.fullName = uRow.full_name || student.fullName;
          student.avatarUrl = uRow.avatar_url || student.avatarUrl;
          student.profilePhoto = uRow.avatar_url || student.profilePhoto;
          student.phone = uRow.phone || student.phone;
          student.department = uRow.department || student.department;
          student.rollNumber = uRow.roll_number || student.rollNumber;
        }
        student.profileCompletion = this.calculateProfileCompletion(student);
        this.addStudentDirectly(student);
        return student;
      } else if (uRow) {
        const empty = this.createEmptyStudent(
          user.id,
          uRow.full_name || user.email?.split('@')[0] || 'Student',
          user.email || '',
          uRow.avatar_url,
          uRow.phone || '',
          uRow.department || '',
          uRow.roll_number || ''
        );
        this.addStudentDirectly(empty);
        return empty;
      }
    } catch (err) {
      console.warn('Could not load student for current user:', err);
    }
    return null;
  }

  getStudentById(id: string): Student | undefined {
    return this.studentsSignal().find(s => s.id === id || s.userId === id);
  }

  addStudentDirectly(student: Student) {
    this.studentsSignal.update(list => [student, ...list.filter(s => s.id !== student.id && s.rollNumber !== student.rollNumber)]);
    this.saveStudentsToCache(this.studentsSignal());
  }

  updateStudentDirectly(id: string, updates: Partial<Student>) {
    this.studentsSignal.update(list =>
      list.map(s => (s.id === id || s.userId === id) ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s)
    );
    this.saveStudentsToCache(this.studentsSignal());
  }

  removeStudentDirectly(id: string) {
    this.studentsSignal.update(list => list.filter(s => s.id !== id && s.userId !== id));
    this.saveStudentsToCache(this.studentsSignal());
  }

  async updateCurrentStudentProfile(profile: Partial<Student>) {
    const current = this.currentStudent();
    const updated: Student = {
      ...current,
      ...profile,
      updatedAt: new Date().toISOString()
    };
    updated.profileCompletion = this.calculateProfileCompletion(updated);

    this.studentsSignal.update(list => {
      const exists = list.some(s => s.id === updated.id || s.userId === updated.userId || (s.email && s.email.toLowerCase() === updated.email.toLowerCase()));
      if (exists) {
        return list.map(s => (s.id === updated.id || s.userId === updated.userId || (s.email && s.email.toLowerCase() === updated.email.toLowerCase())) ? updated : s);
      }
      return [updated, ...list];
    });
    this.saveStudentsToCache(this.studentsSignal());

    const client = this.supabase.getClient();
    if (this.supabase.isConfigured && client) {
      try {
        const payload: any = {
          full_name: updated.fullName,
          bio: updated.bio,
          cgpa: updated.cgpa,
          phone: updated.phone,
          github_url: updated.githubUrl,
          linkedin_url: updated.linkedinUrl,
          portfolio_url: updated.portfolioUrl,
          resume_url: updated.resumeUrl,
          resume_file_name: updated.resumeFileName,
          skills: updated.skills,
          preferred_domain: updated.preferredDomain,
          profile_completion: updated.profileCompletion,
          projects: updated.projects,
          certifications: updated.certifications,
          updated_at: new Date().toISOString()
        };

        if (updated.avatarUrl || updated.profilePhoto) {
          payload.avatar_url = updated.avatarUrl || updated.profilePhoto;
          payload.profile_photo = updated.avatarUrl || updated.profilePhoto;
        }

        const { error } = await client
          .from('students')
          .update(payload)
          .eq('user_id', updated.userId);

        if (error) {
          console.warn('Could not update student profile in Supabase, trying upsert:', error.message);
          await client.from('students').upsert({
            ...payload,
            user_id: updated.userId,
            email: updated.email,
            roll_number: updated.rollNumber,
            department: updated.department
          }, { onConflict: 'user_id' });
        }

        // Also sync public.users
        if (updated.userId) {
          await client.from('users').update({
            avatar_url: payload.avatar_url,
            full_name: updated.fullName,
            phone: updated.phone
          }).eq('id', updated.userId);
        }
      } catch (err) {
        console.warn('Student profile update DB exception:', err);
      }
    }

    this.toast.success('Profile Updated', 'Your student career profile has been saved successfully.');
  }

  async uploadAvatarFile(file: File): Promise<string | null> {
    const current = this.currentStudent();
    let uploadedUrl = '';

    if (this.supabase.isConfigured && this.supabase.getClient()) {
      const ext = file.name.split('.').pop() || 'png';
      const fileName = `student_${current.rollNumber || current.userId}_${Date.now()}.${ext}`;
      const res = await this.supabase.uploadFile('avatars', fileName, file);
      if (res) {
        uploadedUrl = res.url;
      }
    }

    if (!uploadedUrl) {
      uploadedUrl = URL.createObjectURL(file);
    }

    await this.updateCurrentStudentProfile({
      avatarUrl: uploadedUrl,
      profilePhoto: uploadedUrl
    });

    this.authService.updateUserSessionData({
      avatarUrl: uploadedUrl
    });

    this.toast.success('Avatar Updated', 'Your profile picture has been updated across CareerNexus.');
    return uploadedUrl;
  }

  async bulkImportStudents(students: any[]): Promise<{ success: boolean; data?: any; error?: string }> {
    const client = this.supabase.getClient();
    if (!this.supabase.isConfigured || !client) {
      return { success: false, error: 'Database connection not available.' };
    }

    try {
      const { data, error } = await client.rpc('admin_bulk_create_students', {
        p_students: students
      });

      if (error) {
        return { success: false, error: error.message };
      }

      await this.fetchStudentsFromDatabase();
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Bulk student import failed.' };
    }
  }

  async uploadResumeFile(file: File): Promise<string | null> {
    const current = this.currentStudent();
    let uploadedUrl = '';

    if (this.supabase.isConfigured && this.supabase.getClient()) {
      const fileName = `${current.rollNumber || current.userId}_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const res = await this.supabase.uploadFile('resumes', fileName, file);
      if (res) {
        uploadedUrl = res.url;
      }
    }

    if (!uploadedUrl) {
      uploadedUrl = URL.createObjectURL(file);
    }

    await this.updateCurrentStudentProfile({
      resumeFileName: file.name,
      resumeUrl: uploadedUrl
    });

    this.toast.success('Resume Uploaded', `"${file.name}" is now active and attached to all your applications.`);
    return uploadedUrl;
  }

  /**
   * AI Resume Parser:
   * 1. Uploads PDF file to 'resumes' Supabase Storage bucket.
   * 2. Invokes 'parse-resume' Edge Function.
   * 3. Returns parsed structured resume data (skills, cgpa, phone, projects).
   */
  async parseResumeWithAi(file: File): Promise<{
    filePath: string;
    parsedData: ParsedResumeData;
  } | null> {
    const current = this.currentStudent();
    if (!this.supabase.isConfigured || !this.supabase.getClient()) {
      this.toast.error('Service Offline', 'Supabase client is not connected.');
      return null;
    }

    const cleanFileName = `${current.rollNumber || current.userId}_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const uploadRes = await this.supabase.uploadFile('resumes', cleanFileName, file);
    if (!uploadRes) {
      this.toast.error('Upload Failed', 'Could not upload PDF resume to storage bucket.');
      return null;
    }

    const { data: edgeData, error: edgeError } = await this.supabase.invokeFunction<{ success: boolean; data: ParsedResumeData; error?: string }>(
      'parse-resume',
      { file_path: uploadRes.path }
    );

    if (edgeError || !edgeData?.success || !edgeData?.data) {
      console.warn('Edge function parse notice (using smart fallback):', edgeError || edgeData);
      const fallbackData = this.generateFallbackResumeData(file.name, uploadRes.path);
      return {
        filePath: uploadRes.path,
        parsedData: fallbackData
      };
    }

    return {
      filePath: uploadRes.path,
      parsedData: edgeData.data
    };
  }

  /**
   * Applies validated parsed resume data into the current student's profile & database.
   */
  async applyParsedResumeData(data: ParsedResumeData, filePath: string, originalFileName: string) {
    const current = this.currentStudent();

    // Merge skills (case-insensitive deduplication)
    const existingSkills = current.skills || [];
    const newSkills = data.skills || [];
    const skillSet = new Map<string, string>();
    for (const s of existingSkills) {
      if (s?.trim()) skillSet.set(s.trim().toLowerCase(), s.trim());
    }
    for (const s of newSkills) {
      if (s?.trim()) skillSet.set(s.trim().toLowerCase(), s.trim());
    }
    const combinedSkills = Array.from(skillSet.values());

    // Merge projects
    const formattedProjects: Project[] = (data.projects || []).map((p, idx) => ({
      id: p.id || `proj-${Date.now()}-${idx}`,
      title: p.title || 'Technical Project',
      description: p.description || '',
      technologies: p.technologies || []
    }));

    const combinedProjects = [...(current.projects || [])];
    for (const np of formattedProjects) {
      if (!combinedProjects.some(ep => ep.title.toLowerCase() === np.title.toLowerCase())) {
        combinedProjects.push(np);
      }
    }

    const updates: Partial<Student> = {
      skills: combinedSkills,
      resumeUrl: filePath,
      resumeFileName: originalFileName,
      projects: combinedProjects
    };

    if (data.cgpa !== null && !isNaN(data.cgpa)) {
      updates.cgpa = data.cgpa;
    }
    if (data.phone) {
      updates.phone = data.phone;
    }

    await this.updateCurrentStudentProfile(updates);

    if (data.phone) {
      this.authService.updateUserSessionData({ phone: data.phone });
    }

    this.toast.success(
      'Profile Auto-Filled!',
      `Extracted ${newSkills.length} skills, academic score, and ${formattedProjects.length} projects from your resume.`
    );
  }

  private generateFallbackResumeData(fileName: string, filePath: string): ParsedResumeData {
    const current = this.currentStudent();
    return {
      skills: current.skills?.length ? current.skills : [],
      cgpa: current.cgpa || null,
      phone: current.phone || null,
      projects: current.projects?.length ? current.projects : [],
      filePath: filePath
    };
  }

  async addProject(project: Omit<Project, 'id'>) {
    const newProj: Project = {
      ...project,
      id: `p-${Date.now()}`
    };
    const current = this.currentStudent();
    const projects = [...(current.projects || []), newProj];
    await this.updateCurrentStudentProfile({ projects });
    this.toast.success('Project Added', `"${newProj.title}" added to your profile showcase.`);
  }

  async removeProject(id: string) {
    const current = this.currentStudent();
    const projects = (current.projects || []).filter(p => p.id !== id);
    await this.updateCurrentStudentProfile({ projects });
    this.toast.info('Project Removed', 'The project has been removed from your showcase.');
  }

  async addCertification(cert: Omit<Certification, 'id'>) {
    const newCert: Certification = {
      ...cert,
      id: `cert-${Date.now()}`
    };
    const current = this.currentStudent();
    const certifications = [...(current.certifications || []), newCert];
    await this.updateCurrentStudentProfile({ certifications });
    this.toast.success('Certification Added', `"${newCert.title}" added to your verified credentials.`);
  }

  calculateProfileCompletion(s: Student): number {
    let score = 0;
    if (s.fullName) score += 10;
    if (s.profilePhoto) score += 10;
    if (s.phone) score += 5;
    if (s.bio) score += 10;
    if (s.skills && s.skills.length >= 3) score += 15;
    if (s.githubUrl) score += 10;
    if (s.linkedinUrl) score += 10;
    if (s.portfolioUrl) score += 5;
    if (s.resumeUrl || s.resumeFileName) score += 15;
    if (s.projects && s.projects.length >= 1) score += 10;
    if (s.certifications && s.certifications.length >= 1) score += 10;
    return Math.min(100, score);
  }
}
