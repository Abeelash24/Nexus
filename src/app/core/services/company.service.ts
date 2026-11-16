import { Injectable, signal, computed, inject } from '@angular/core';
import { Company } from '../models/company.model';
import { MOCK_COMPANIES } from '../data/mock-data';
import { SupabaseService } from './supabase.service';
import { ToastService } from './toast.service';

@Injectable({
  providedIn: 'root'
})
export class CompanyService {
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);

  private readonly LOCAL_STORAGE_KEY = 'placementconnect_companies_cache';

  private companiesSignal = signal<Company[]>(this.loadInitialCompanies());
  isLoading = signal<boolean>(false);

  companies = computed(() => this.companiesSignal());

  constructor() {
    this.fetchCompaniesFromDatabase();
  }

  private loadInitialCompanies(): Company[] {
    try {
      const stored = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    return MOCK_COMPANIES;
  }

  private saveCompaniesToCache(list: Company[]) {
    try {
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  }

  async fetchCompaniesFromDatabase() {
    const client = this.supabase.getClient();
    if (!this.supabase.isConfigured || !client) return;

    this.isLoading.set(true);
    try {
      const { data, error } = await client
        .from('companies')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Could not fetch companies from Supabase:', error.message);
        return;
      }

      if (data && data.length > 0) {
        const mapped: Company[] = data.map((d: any) => this.mapDbRowToCompany(d));
        this.companiesSignal.set(mapped);
        this.saveCompaniesToCache(mapped);
      }
    } catch (e) {
      console.warn('Companies fetch exception:', e);
    } finally {
      this.isLoading.set(false);
    }
  }

  private mapDbRowToCompany(row: any): Company {
    return {
      id: row.id,
      name: row.name,
      logo: row.logo && row.logo.trim() !== ''
        ? row.logo
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(row.name || 'Company')}&background=0284c7&color=fff&bold=true`,
      website: row.website || '',
      description: row.description || '',
      industry: row.industry || 'Technology',
      location: row.location || 'Bengaluru, India',
      tier: row.tier || 'Super Dream (Tier 1)',
      activeJobsCount: row.active_jobs_count || 1,
      placedStudentsCount: row.placed_students_count || 5,
      averagePackage: row.average_package || '₹24 LPA',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  getCompanyById(id: string): Company | undefined {
    return this.companiesSignal().find(c => c.id === id);
  }

  getCompanyByName(name: string): Company | undefined {
    const q = (name || '').toLowerCase().trim();
    if (!q) return undefined;
    return this.companiesSignal().find(c => {
      const cName = (c.name || '').toLowerCase().trim();
      return cName === q || cName.includes(q) || q.includes(cName);
    });
  }

  /**
   * Uploads an official company logo to Supabase Storage 'company-logos' bucket.
   * Validates MIME type (JPEG/PNG/WebP) and file size (max 5MB).
   */
  async uploadCompanyLogo(file: File): Promise<{ url: string; error?: string }> {
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMime.includes(file.type)) {
      const msg = 'Invalid file format. Please upload a JPEG, PNG, or WebP logo image.';
      this.toast.error('Logo Upload Error', msg);
      return { url: '', error: msg };
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      const msg = 'File exceeds maximum size limit of 5MB.';
      this.toast.error('Logo Upload Error', msg);
      return { url: '', error: msg };
    }

    const client = this.supabase.getClient();
    if (!this.supabase.isConfigured || !client) {
      const fallbackUrl = URL.createObjectURL(file);
      this.toast.info('Local Preview Ready', 'Company logo loaded for local preview.');
      return { url: fallbackUrl };
    }

    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
      const cleanFileName = `logo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `logos/${cleanFileName}`;

      const { data, error } = await client.storage
        .from('company-logos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        });

      if (error) {
        console.warn('Supabase company logo upload error:', error);
        const fallbackUrl = URL.createObjectURL(file);
        this.toast.warning('Storage Notice', `${error.message}. Local preview used.`);
        return { url: fallbackUrl, error: error.message };
      }

      const { data: pubData } = client.storage
        .from('company-logos')
        .getPublicUrl(filePath);

      const publicUrl = pubData.publicUrl;
      this.toast.success('Company Logo Uploaded', 'Official organization logo uploaded successfully.');
      return { url: publicUrl };
    } catch (err: any) {
      console.warn('Unexpected error uploading company logo:', err);
      const fallbackUrl = URL.createObjectURL(file);
      return { url: fallbackUrl, error: err?.message || 'Upload failed' };
    }
  }

  /**
   * Updates the official company logo in public.companies.
   * If the company doesn't exist yet, creates it.
   * The database trigger automatically propagates the updated logo to all placement drives and jobs.
   */
  async updateCompanyLogo(companyName: string, logoUrl: string): Promise<Company> {
    const existing = this.getCompanyByName(companyName);
    const client = this.supabase.getClient();
    const finalLogo = logoUrl?.trim() || `https://ui-avatars.com/api/?name=${encodeURIComponent(companyName)}&background=2563eb&color=fff&size=128&bold=true`;

    let targetCompany: Company;

    if (existing) {
      targetCompany = {
        ...existing,
        logo: finalLogo,
        updatedAt: new Date().toISOString()
      };

      this.companiesSignal.update(list =>
        list.map(c => c.id === existing.id ? targetCompany : c)
      );
    } else {
      targetCompany = {
        id: `c-${Date.now()}`,
        name: companyName,
        logo: finalLogo,
        website: `https://${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
        description: `Campus recruitment hiring partner: ${companyName}.`,
        industry: 'Technology',
        location: 'Bengaluru / Hybrid',
        tier: 'Super Dream (Tier 1)',
        activeJobsCount: 1,
        placedStudentsCount: 0,
        averagePackage: '₹20 LPA',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      this.companiesSignal.update(list => [targetCompany, ...list]);
    }

    this.saveCompaniesToCache(this.companiesSignal());

    if (this.supabase.isConfigured && client) {
      try {
        // Query remote database by name (case-insensitive) or existing UUID
        let remoteQuery = client.from('companies').select('id, name');
        if (existing && !existing.id.startsWith('c-')) {
          remoteQuery = remoteQuery.or(`id.eq.${existing.id},name.ilike.${companyName.trim()}`);
        } else {
          remoteQuery = remoteQuery.ilike('name', companyName.trim());
        }

        const { data: remoteRows } = await remoteQuery.limit(1);
        const remoteComp = remoteRows && remoteRows.length > 0 ? remoteRows[0] : null;

        if (remoteComp) {
          const { error: updErr } = await client
            .from('companies')
            .update({ logo: finalLogo, updated_at: new Date().toISOString() })
            .eq('id', remoteComp.id);

          if (!updErr) {
            targetCompany.id = remoteComp.id;
            this.companiesSignal.update(list =>
              list.map(c => c.name.toLowerCase().trim() === companyName.toLowerCase().trim() ? { ...c, id: remoteComp.id } : c)
            );
            this.saveCompaniesToCache(this.companiesSignal());
          }
        } else {
          // Company doesn't exist on remote Supabase yet, insert it
          const { data: inserted, error: insErr } = await client
            .from('companies')
            .insert({
              name: targetCompany.name,
              logo: targetCompany.logo,
              website: targetCompany.website,
              description: targetCompany.description,
              industry: targetCompany.industry,
              location: targetCompany.location,
              tier: targetCompany.tier,
              active_jobs_count: targetCompany.activeJobsCount,
              placed_students_count: targetCompany.placedStudentsCount,
              average_package: targetCompany.averagePackage
            })
            .select()
            .single();

          if (!insErr && inserted) {
            targetCompany.id = inserted.id;
            this.companiesSignal.update(list =>
              list.map(c => c.name.toLowerCase().trim() === companyName.toLowerCase().trim() ? { ...c, id: inserted.id } : c)
            );
            this.saveCompaniesToCache(this.companiesSignal());
          }
        }
      } catch (err) {
        console.warn('Database error persisting company logo:', err);
      }
    }

    this.toast.success('Company Logo Saved', `Official logo for ${targetCompany.name} has been updated.`);
    return targetCompany;
  }

  async addCompany(company: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<Company> {
    const newCompany: Company = {
      ...company,
      id: `c-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.companiesSignal.update(list => [newCompany, ...list]);
    this.saveCompaniesToCache(this.companiesSignal());

    const client = this.supabase.getClient();
    if (this.supabase.isConfigured && client) {
      try {
        const { data, error } = await client
          .from('companies')
          .insert({
            name: company.name,
            logo: company.logo,
            website: company.website,
            description: company.description,
            industry: company.industry,
            location: company.location,
            tier: company.tier,
            active_jobs_count: company.activeJobsCount || 1,
            placed_students_count: company.placedStudentsCount || 0,
            average_package: company.averagePackage || '₹24 LPA'
          })
          .select()
          .single();

        if (!error && data) {
          const mapped = this.mapDbRowToCompany(data);
          this.companiesSignal.update(list => list.map(c => c.id === newCompany.id ? mapped : c));
          this.saveCompaniesToCache(this.companiesSignal());
          this.toast.success('Company Added', `${mapped.name} has been saved to database.`);
          return mapped;
        }
      } catch (err) {
        console.warn('Add company DB error:', err);
      }
    }

    this.toast.success('Company Added', `${newCompany.name} has been added to placement partners.`);
    return newCompany;
  }

  async updateCompany(id: string, updates: Partial<Company>) {
    this.companiesSignal.update(list =>
      list.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c)
    );
    this.saveCompaniesToCache(this.companiesSignal());

    const client = this.supabase.getClient();
    if (this.supabase.isConfigured && client) {
      try {
        const payload: any = {};
        if (updates.name) payload.name = updates.name;
        if (updates.logo) payload.logo = updates.logo;
        if (updates.website) payload.website = updates.website;
        if (updates.description) payload.description = updates.description;
        if (updates.industry) payload.industry = updates.industry;
        if (updates.location) payload.location = updates.location;
        if (updates.tier) payload.tier = updates.tier;
        payload.updated_at = new Date().toISOString();

        await client.from('companies').update(payload).eq('id', id);
      } catch (err) {
        console.warn('Update company DB error:', err);
      }
    }

    this.toast.success('Company Updated', 'Company details saved.');
  }

  async deleteCompany(id: string) {
    const comp = this.getCompanyById(id);
    this.companiesSignal.update(list => list.filter(c => c.id !== id));
    this.saveCompaniesToCache(this.companiesSignal());

    const client = this.supabase.getClient();
    if (this.supabase.isConfigured && client) {
      try {
        await client.from('companies').delete().eq('id', id);
      } catch (err) {
        console.warn('Delete company DB error:', err);
      }
    }

    this.toast.warning('Company Removed', `${comp?.name || 'Company'} removed from platform.`);
  }
}
