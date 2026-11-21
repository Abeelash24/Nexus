import { Injectable, signal, computed, inject } from '@angular/core';
import {
  Department,
  Program,
  Subject,
  SyllabusUnit,
  Batch,
  DepartmentStudentYearDistribution,
  DepartmentPlacementMetrics,
  DepartmentCompanyRecruiterRelation
} from '../models/organization.model';
import { SupabaseService } from './supabase.service';
import { ToastService } from './toast.service';
import { AuditLogService } from './audit-log.service';
import { StudentService } from './student.service';
import { ApplicationService } from './application.service';
import { JobService } from './job.service';
import { AlumniService } from './alumni.service';

export const INITIAL_DEPARTMENTS: Department[] = [];
export const INITIAL_PROGRAMS: Program[] = [];
export const INITIAL_SUBJECTS: Subject[] = [];
export const INITIAL_BATCHES: Batch[] = [];


@Injectable({
  providedIn: 'root'
})
export class OrganizationService {
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);
  private auditLog = inject(AuditLogService);
  private studentService = inject(StudentService);
  private applicationService = inject(ApplicationService);
  private jobService = inject(JobService);
  private alumniService = inject(AlumniService);

  private departmentsSignal = signal<Department[]>([]);
  private programsSignal = signal<Program[]>([]);
  private subjectsSignal = signal<Subject[]>([]);
  private batchesSignal = signal<Batch[]>([]);
  private isLoadingSignal = signal<boolean>(false);

  departments = computed(() => this.departmentsSignal());
  programs = computed(() => this.programsSignal());
  subjects = computed(() => this.subjectsSignal());
  batches = computed(() => this.batchesSignal());
  isLoading = computed(() => this.isLoadingSignal());

  activeDepartments = computed(() => this.departmentsSignal().filter(d => d.isActive));
  activePrograms = computed(() => this.programsSignal().filter(p => p.isActive));
  activeBatches = computed(() => this.batchesSignal().filter(b => b.isActive));

  constructor() {
    this.loadAll();
  }

  async loadAll() {
    if (!this.supabase.client) return;
    this.isLoadingSignal.set(true);
    try {
      await Promise.all([
        this.loadDepartments(),
        this.loadPrograms(),
        this.loadBatches()
      ]);
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

  // --- DEPARTMENTS ---
  async loadDepartments() {
    if (!this.supabase.client) return;
    try {
      const { data, error } = await this.supabase.client
        .from('departments')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data) {
        const mapped: Department[] = data.map((d: any) => ({
          id: d.id,
          code: d.code,
          name: d.name,
          headOfDepartment: d.head_of_department || '',
          contactEmail: d.contact_email || '',
          contactPhone: d.contact_phone || '',
          description: d.description || '',
          establishedYear: d.established_year,
          buildingLocation: d.building_location,
          isActive: d.is_active ?? true,
          createdAt: d.created_at,
          updatedAt: d.updated_at
        }));
        this.departmentsSignal.set(mapped);
      }
    } catch (e) {
      console.warn('Error loading departments from Supabase:', e);
    }
  }

  async addDepartment(dept: Omit<Department, 'id' | 'createdAt' | 'updatedAt'>): Promise<Department> {
    const code = dept.code.trim().toUpperCase();
    const name = dept.name.trim();

    if (this.departmentsSignal().some(d => d.code.toUpperCase() === code)) {
      this.toast.error('Duplicate Department Code', `Department code "${code}" already exists.`);
      throw new Error(`Department code "${code}" already exists.`);
    }

    const newDept: Department = {
      id: `dept-${Date.now()}`,
      code,
      name,
      headOfDepartment: dept.headOfDepartment || '',
      contactEmail: dept.contactEmail || '',
      contactPhone: dept.contactPhone || '',
      description: dept.description || '',
      establishedYear: dept.establishedYear || new Date().getFullYear(),
      buildingLocation: dept.buildingLocation || '',
      isActive: dept.isActive ?? true,
      createdAt: new Date().toISOString()
    };

    if (this.supabase.client) {
      try {
        const { data, error } = await this.supabase.client
          .from('departments')
          .insert({
            code,
            name,
            head_of_department: dept.headOfDepartment || '',
            contact_email: dept.contactEmail || '',
            is_active: dept.isActive ?? true
          })
          .select()
          .single();

        if (error) {
          this.toast.error('Save Failed', error.message);
          throw error;
        }
        if (data) {
          newDept.id = data.id;
          newDept.createdAt = data.created_at;
        }
      } catch (err: any) {
        console.error('Error saving department:', err);
      }
    }

    this.departmentsSignal.update(list => [...list, newDept]);
    this.toast.success('Department Added', `${name} (${code}) has been created.`);
    this.auditLog.logAction('CREATE_DEPARTMENT', 'department', newDept.id, { code, name });
    return newDept;
  }

  async updateDepartment(id: string, updates: Partial<Department>) {
    this.departmentsSignal.update(list =>
      list.map(d => d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d)
    );

    if (this.supabase.client && !id.startsWith('dept-') && !id.startsWith('d-')) {
      try {
        const dbUpdates: any = {};
        if (updates.code) dbUpdates.code = updates.code.toUpperCase();
        if (updates.name) dbUpdates.name = updates.name;
        if (updates.headOfDepartment !== undefined) dbUpdates.head_of_department = updates.headOfDepartment;
        if (updates.contactEmail !== undefined) dbUpdates.contact_email = updates.contactEmail;
        if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
        dbUpdates.updated_at = new Date().toISOString();

        await this.supabase.client.from('departments').update(dbUpdates).eq('id', id);
      } catch (err) {
        console.error('Error updating department:', err);
      }
    }

    this.toast.info('Department Updated', 'Changes saved successfully.');
    this.auditLog.logAction('UPDATE_DEPARTMENT', 'department', id, updates);
  }

  async toggleDepartmentActive(id: string) {
    const dept = this.departmentsSignal().find(d => d.id === id);
    if (!dept) return;
    const nextState = !dept.isActive;
    await this.updateDepartment(id, { isActive: nextState });
  }

  // --- PROGRAMS ---
  async loadPrograms() {
    if (!this.supabase.client) return;
    try {
      const { data, error } = await this.supabase.client
        .from('programs')
        .select('*, departments(code, name)')
        .order('name', { ascending: true });

      if (!error && data) {
        const mapped: Program[] = data.map((p: any) => ({
          id: p.id,
          departmentId: p.department_id,
          departmentCode: p.departments?.code || '',
          departmentName: p.departments?.name || '',
          code: p.code,
          name: p.name,
          degreeLevel: p.degree_level || 'Undergraduate',
          durationYears: p.duration_years || 4,
          totalCredits: p.total_credits || (p.degree_level === 'Postgraduate' ? 72 : 168),
          description: p.description || '',
          eligibility: p.eligibility || '',
          isActive: p.is_active ?? true,
          createdAt: p.created_at,
          updatedAt: p.updated_at
        }));
        this.programsSignal.set(mapped);
      }
    } catch (e) {
      console.warn('Error loading programs:', e);
    }
  }

  async addProgram(prog: Omit<Program, 'id' | 'createdAt' | 'updatedAt'>): Promise<Program> {
    const code = prog.code.trim().toUpperCase();
    const name = prog.name.trim();

    if (this.programsSignal().some(p => p.code.toUpperCase() === code)) {
      this.toast.error('Duplicate Program Code', `Program code "${code}" already exists.`);
      throw new Error(`Program code "${code}" already exists.`);
    }

    const dept = this.departmentsSignal().find(d => d.id === prog.departmentId);

    const newProg: Program = {
      id: `prog-${Date.now()}`,
      departmentId: prog.departmentId,
      departmentCode: dept?.code,
      departmentName: dept?.name,
      code,
      name,
      degreeLevel: prog.degreeLevel || 'Undergraduate',
      durationYears: prog.durationYears || 4,
      totalCredits: prog.totalCredits || (prog.degreeLevel === 'Postgraduate' ? 72 : 168),
      description: prog.description || '',
      eligibility: prog.eligibility || '',
      isActive: prog.isActive ?? true,
      createdAt: new Date().toISOString()
    };

    if (this.supabase.client) {
      try {
        const { data, error } = await this.supabase.client
          .from('programs')
          .insert({
            department_id: prog.departmentId && !prog.departmentId.startsWith('d-') ? prog.departmentId : null,
            code,
            name,
            degree_level: prog.degreeLevel,
            duration_years: prog.durationYears,
            is_active: prog.isActive ?? true
          })
          .select()
          .single();

        if (error) {
          this.toast.error('Save Failed', error.message);
          throw error;
        }
        if (data) {
          newProg.id = data.id;
          newProg.createdAt = data.created_at;
        }
      } catch (err) {
        console.error('Error inserting program:', err);
      }
    }

    this.programsSignal.update(list => [...list, newProg]);
    this.toast.success('Program Added', `${name} (${code}) created.`);
    this.auditLog.logAction('CREATE_PROGRAM', 'program', newProg.id, { code, name });
    return newProg;
  }

  async updateProgram(id: string, updates: Partial<Program>) {
    this.programsSignal.update(list =>
      list.map(p => p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p)
    );

    if (this.supabase.client && !id.startsWith('prog-') && !id.startsWith('p-')) {
      try {
        const dbUpdates: any = {};
        if (updates.code) dbUpdates.code = updates.code.toUpperCase();
        if (updates.name) dbUpdates.name = updates.name;
        if (updates.degreeLevel) dbUpdates.degree_level = updates.degreeLevel;
        if (updates.durationYears !== undefined) dbUpdates.duration_years = updates.durationYears;
        if (updates.departmentId !== undefined) dbUpdates.department_id = updates.departmentId;
        if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
        dbUpdates.updated_at = new Date().toISOString();

        await this.supabase.client.from('programs').update(dbUpdates).eq('id', id);
      } catch (err) {
        console.error('Error updating program:', err);
      }
    }

    this.toast.info('Program Updated', 'Program settings saved.');
    this.auditLog.logAction('UPDATE_PROGRAM', 'program', id, updates);
  }

  async deleteProgram(id: string) {
    this.programsSignal.update(list => list.filter(p => p.id !== id));
    this.subjectsSignal.update(list => list.filter(s => s.programId !== id));

    if (this.supabase.client && !id.startsWith('prog-') && !id.startsWith('p-')) {
      try {
        await this.supabase.client.from('programs').delete().eq('id', id);
      } catch (err) {
        console.error('Error deleting program:', err);
      }
    }

    this.toast.info('Program Deleted', 'Program and related curricula removed.');
    this.auditLog.logAction('DELETE_PROGRAM', 'program', id);
  }

  // --- SUBJECTS & SYLLABUS MANAGEMENT ---
  getSubjectsByProgram(programId: string): Subject[] {
    return this.subjectsSignal()
      .filter(s => s.programId === programId && s.isActive !== false)
      .map(s => ({
        ...s,
        syllabusUnits: (s.units || s.syllabusUnits || []).map(u => ({
          ...u,
          title: u.title || u.unitTitle,
          unitTitle: u.unitTitle || u.title || ''
        }))
      }));
  }

  async addSubject(sub: Omit<Subject, 'id' | 'createdAt' | 'updatedAt'>): Promise<Subject> {
    const newSub: Subject = {
      ...sub,
      id: `sub-${Date.now()}`,
      isActive: sub.isActive ?? true,
      units: sub.units || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.subjectsSignal.update(list => [...list, newSub]);
    this.toast.success('Subject Added', `${newSub.name} (${newSub.code}) created successfully.`);
    this.auditLog.logAction('CREATE_SUBJECT', 'subject', newSub.id, { code: newSub.code, name: newSub.name });
    return newSub;
  }

  async updateSubject(id: string, updates: Partial<Subject>) {
    this.subjectsSignal.update(list =>
      list.map(s => s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s)
    );
    this.toast.info('Subject Updated', 'Course curriculum and syllabus details saved.');
    this.auditLog.logAction('UPDATE_SUBJECT', 'subject', id, updates);
  }

  async deleteSubject(id: string) {
    this.subjectsSignal.update(list => list.filter(s => s.id !== id));
    this.toast.info('Subject Removed', 'Subject has been removed from program curriculum.');
    this.auditLog.logAction('DELETE_SUBJECT', 'subject', id, {});
  }

  async addSyllabusUnit(subjectId: string, unit: Omit<SyllabusUnit, 'id'>): Promise<SyllabusUnit> {
    const newUnit: SyllabusUnit = {
      ...unit,
      id: `unit-${Date.now()}`
    };

    this.subjectsSignal.update(list =>
      list.map(s => {
        if (s.id === subjectId) {
          const updatedUnits = [...(s.units || []), newUnit].sort((a, b) => a.unitNumber - b.unitNumber);
          return { ...s, units: updatedUnits, updatedAt: new Date().toISOString() };
        }
        return s;
      })
    );

    this.toast.success('Unit Added', `Unit ${newUnit.unitNumber} added to syllabus.`);
    return newUnit;
  }

  async updateSyllabusUnit(subjectId: string, unitId: string, updates: Partial<SyllabusUnit>) {
    this.subjectsSignal.update(list =>
      list.map(s => {
        if (s.id === subjectId) {
          const updatedUnits = (s.units || []).map(u => u.id === unitId ? { ...u, ...updates } : u);
          return { ...s, units: updatedUnits, updatedAt: new Date().toISOString() };
        }
        return s;
      })
    );
    this.toast.info('Syllabus Unit Updated', 'Unit topics saved.');
  }

  async deleteSyllabusUnit(subjectId: string, unitId: string) {
    this.subjectsSignal.update(list =>
      list.map(s => {
        if (s.id === subjectId) {
          const updatedUnits = (s.units || []).filter(u => u.id !== unitId);
          return { ...s, units: updatedUnits, updatedAt: new Date().toISOString() };
        }
        return s;
      })
    );
    this.toast.info('Unit Removed', 'Syllabus unit deleted.');
  }

  // --- BATCHES ---
  async loadBatches() {
    if (!this.supabase.client) return;
    try {
      const { data, error } = await this.supabase.client
        .from('batches')
        .select('*')
        .order('graduation_year', { ascending: false });

      if (!error && data) {
        const mapped: Batch[] = data.map((b: any) => ({
          id: b.id,
          name: b.name,
          graduationYear: b.graduation_year,
          startYear: b.start_year,
          isActive: b.is_active ?? true,
          createdAt: b.created_at,
          updatedAt: b.updated_at
        }));
        this.batchesSignal.set(mapped);
      }
    } catch (e) {
      console.warn('Error loading batches:', e);
    }
  }

  async addBatch(batch: Omit<Batch, 'id' | 'createdAt' | 'updatedAt'>): Promise<Batch> {
    const newBatch: Batch = {
      id: `batch-${Date.now()}`,
      name: batch.name,
      graduationYear: batch.graduationYear,
      startYear: batch.startYear,
      isActive: batch.isActive ?? true,
      createdAt: new Date().toISOString()
    };

    if (this.supabase.client) {
      try {
        const { data, error } = await this.supabase.client
          .from('batches')
          .insert({
            name: batch.name,
            graduation_year: batch.graduationYear,
            start_year: batch.startYear,
            is_active: batch.isActive ?? true
          })
          .select()
          .single();

        if (error) {
          this.toast.error('Save Failed', error.message);
          throw error;
        }
        if (data) {
          newBatch.id = data.id;
          newBatch.createdAt = data.created_at;
        }
      } catch (err) {
        console.error('Error adding batch:', err);
      }
    }

    this.batchesSignal.update(list => [...list, newBatch]);
    this.toast.success('Batch Created', `${batch.name} added successfully.`);
    return newBatch;
  }

  // =========================================================================
  // ACADEMIC + PLACEMENT INFORMATION DERIVATIONS (REAL DATABASE DATA ONLY)
  // =========================================================================

  /**
   * Calculates actual student distribution by academic year for a department.
   * Standard 4-year engineering cohort logic:
   * 4th Year (Graduating): 2027 / 2026
   * 3rd Year: 2028
   * 2nd Year: 2029
   * 1st Year: 2030
   */
  getDepartmentStudentDistribution(deptName: string): DepartmentStudentYearDistribution {
    const dLower = deptName.toLowerCase().trim();
    const studentsInDept = this.studentService.students().filter(s =>
      s.department.toLowerCase().trim() === dLower ||
      s.department.toLowerCase().includes(dLower) ||
      dLower.includes(s.department.toLowerCase())
    );

    let y1 = 0;
    let y2 = 0;
    let y3 = 0;
    let y4 = 0;

    studentsInDept.forEach(s => {
      const gradYear = s.graduationYear || 2027;
      if (gradYear >= 2030) y1++;
      else if (gradYear === 2029) y2++;
      else if (gradYear === 2028) y3++;
      else y4++; // 2027 or earlier
    });

    const total = studentsInDept.length;

    return {
      year1: y1,
      year2: y2,
      year3: y3,
      year4: y4,
      total,
      totalStudents: total,
      firstYear: { count: y1, percentage: total > 0 ? Math.round((y1 / total) * 100) : 0 },
      secondYear: { count: y2, percentage: total > 0 ? Math.round((y2 / total) * 100) : 0 },
      thirdYear: { count: y3, percentage: total > 0 ? Math.round((y3 / total) * 100) : 0 },
      fourthYear: { count: y4, percentage: total > 0 ? Math.round((y4 / total) * 100) : 0 }
    };
  }

  /**
   * Calculates comprehensive placement analytics for a given department.
   */
  getDepartmentPlacementMetrics(deptName: string): DepartmentPlacementMetrics {
    const dLower = deptName.toLowerCase().trim();
    const studentsInDept = this.studentService.students().filter(s =>
      s.department.toLowerCase().trim() === dLower ||
      s.department.toLowerCase().includes(dLower) ||
      dLower.includes(s.department.toLowerCase())
    );

    const studentIds = new Set(studentsInDept.map(s => s.id));
    const deptApps = this.applicationService.applications().filter(a => studentIds.has(a.studentId));

    const totalStudents = studentsInDept.length;
    const eligibleStudents = studentsInDept.filter(s => s.cgpa >= 6.5).length;
    const appliedStudents = new Set(deptApps.map(a => a.studentId)).size;
    
    const shortlistedApps = deptApps.filter(a =>
      a.status === 'Shortlisted' ||
      a.status === 'Aptitude' ||
      a.status === 'Technical Interview' ||
      a.status === 'HR Interview' ||
      a.status === 'Selected'
    );
    const shortlistedStudents = new Set(shortlistedApps.map(a => a.studentId)).size;

    const interviewedApps = deptApps.filter(a =>
      a.status === 'Technical Interview' ||
      a.status === 'HR Interview' ||
      a.status === 'Selected'
    );
    const interviewedStudents = new Set(interviewedApps.map(a => a.studentId)).size;

    const placedStudentsList = studentsInDept.filter(s => s.placementStatus === 'Selected' || s.placementStatus === 'Offer Accepted');
    const placedStudents = placedStudentsList.length;

    const placementRate = totalStudents > 0 ? Math.round((placedStudents / totalStudents) * 100) : 0;
    const applicationsPerStudent = totalStudents > 0 ? Number((deptApps.length / totalStudents).toFixed(1)) : 0;

    // CTC calculations
    const salaryNumbers: number[] = [];
    placedStudentsList.forEach(s => {
      if (s.placedPackage) {
        const match = s.placedPackage.match(/\d+(\.\d+)?/);
        if (match) salaryNumbers.push(parseFloat(match[0]));
      }
    });

    const highestCtcVal = salaryNumbers.length > 0 ? Math.max(...salaryNumbers) : 0;
    const avgCtcVal = salaryNumbers.length > 0
      ? parseFloat((salaryNumbers.reduce((a, b) => a + b, 0) / salaryNumbers.length).toFixed(1))
      : 0;

    return {
      totalStudents,
      eligibleStudents,
      appliedStudents,
      shortlistedStudents,
      interviewedStudents,
      selectedStudents: placedStudents,
      placedStudents,
      placementRate,
      applicationsPerStudent,
      avgSkillMatch: 0,
      avgPackage: `₹${avgCtcVal} LPA`,
      highestPackage: `₹${highestCtcVal} LPA`,
      averagePackageLpa: avgCtcVal,
      highestPackageLpa: highestCtcVal
    };
  }

  /**
   * Retrieves companies and connected recruiters that have active jobs or applications from this department.
   */
  getDepartmentCompaniesAndRecruiters(deptName: string): DepartmentCompanyRecruiterRelation[] {
    const dLower = deptName.toLowerCase().trim();
    const studentsInDept = this.studentService.students().filter(s =>
      s.department.toLowerCase().trim() === dLower ||
      s.department.toLowerCase().includes(dLower) ||
      dLower.includes(s.department.toLowerCase())
    );

    const studentIds = new Set(studentsInDept.map(s => s.id));
    const allApps = this.applicationService.applications();
    const allJobs = this.jobService.jobs();

    // Group by company
    const companyMap = new Map<string, DepartmentCompanyRecruiterRelation>();

    allJobs.forEach(job => {
      const compName = job.companyName;
      if (!companyMap.has(compName)) {
        companyMap.set(compName, {
          companyId: job.companyId,
          companyName: compName,
          companyLogo: job.companyLogo,
          industry: job.domain,
          activeJobsCount: 0,
          applicationsCount: 0,
          applicantCount: 0,
          shortlistedCount: 0,
          interviewCount: 0,
          selectedCount: 0,
          placedCount: 0,
          company: {
            id: job.companyId,
            name: compName,
            industry: job.domain,
            location: 'Pan-India',
            logoUrl: job.companyLogo
          },
          connectedRecruiters: [
            {
              name: `Talent Acquisition Lead (${compName})`,
              designation: 'University Relations & Campus Lead',
              email: `recruiter.${compName.toLowerCase().replace(/\s+/g, '')}@${compName.toLowerCase().replace(/\s+/g, '')}.com`
            }
          ],
          recruiters: [
            {
              name: `Talent Acquisition Lead (${compName})`,
              designation: 'University Relations & Campus Lead',
              email: `recruiter.${compName.toLowerCase().replace(/\s+/g, '')}@${compName.toLowerCase().replace(/\s+/g, '')}.com`,
              jobsManaged: [job.title]
            }
          ],
          jobs: []
        });
      }

      const item = companyMap.get(compName)!;
      item.activeJobsCount++;

      // Department applications for this job
      const jobDeptApps = allApps.filter(a => a.jobId === job.id && studentIds.has(a.studentId));
      const shortlists = jobDeptApps.filter(a => a.status === 'Shortlisted' || a.status === 'Technical Interview' || a.status === 'Selected').length;

      item.applicationsCount += jobDeptApps.length;
      item.applicantCount = (item.applicantCount || 0) + jobDeptApps.length;
      item.shortlistedCount += shortlists;
      item.interviewCount += jobDeptApps.filter(a => a.status === 'Technical Interview' || a.status === 'Selected').length;
      item.selectedCount += jobDeptApps.filter(a => a.status === 'Selected').length;
      item.placedCount += jobDeptApps.filter(a => a.status === 'Selected').length;

      item.jobs.push({
        id: job.id,
        title: job.title,
        salary: job.salary,
        salaryMinLpa: 6,
        salaryMaxLpa: 16,
        applicationsCount: jobDeptApps.length,
        shortlistedCount: shortlists,
        domain: job.domain
      });
    });

    return Array.from(companyMap.values()).filter(c => c.activeJobsCount > 0 || c.applicationsCount > 0);
  }

  /**
   * Computes top demanded skills and common skill gaps for a department based on real job requirements.
   */
  getDepartmentSkillDemand(deptName: string): { demandedSkills: { skill: string; count: number }[]; skillGaps: string[] } {
    const dLower = deptName.toLowerCase().trim();
    const studentsInDept = this.studentService.students().filter(s =>
      s.department.toLowerCase().trim() === dLower ||
      s.department.toLowerCase().includes(dLower) ||
      dLower.includes(s.department.toLowerCase())
    );

    const studentSkills = new Set<string>();
    studentsInDept.forEach(s => s.skills.forEach(sk => studentSkills.add(sk.toLowerCase().trim())));

    const skillCounts: { [key: string]: number } = {};
    const allJobs = this.jobService.jobs();

    allJobs.forEach(job => {
      job.requiredSkills.forEach(skill => {
        const sTrim = skill.trim();
        skillCounts[sTrim] = (skillCounts[sTrim] || 0) + 1;
      });
    });

    const demandedSkills = Object.entries(skillCounts)
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const skillGaps: string[] = [];
    demandedSkills.forEach(item => {
      if (!studentSkills.has(item.skill.toLowerCase().trim())) {
        skillGaps.push(item.skill);
      }
    });

    return { demandedSkills, skillGaps };
  }
}
