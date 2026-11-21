import { Injectable, signal, computed, inject } from '@angular/core';
import { AdminAuditLog, AuditAction } from '../models/audit-log.model';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuditLogService {
  private supabase = inject(SupabaseService);
  private authService = inject(AuthService);

  private logsSignal = signal<AdminAuditLog[]>([]);
  private isLoadingSignal = signal<boolean>(false);

  logs = computed(() => this.logsSignal());
  isLoading = computed(() => this.isLoadingSignal());

  constructor() {
    this.loadLogs();
  }

  async loadLogs() {
    if (!this.supabase.client) return;
    this.isLoadingSignal.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        const mapped: AdminAuditLog[] = data.map((d: any) => ({
          id: d.id,
          adminId: d.admin_id,
          adminName: d.admin_name || 'Placement Administrator',
          adminEmail: d.admin_email || '',
          action: d.action,
          entityType: d.entity_type,
          entityId: d.entity_id,
          details: d.details || {},
          createdAt: d.created_at
        }));
        this.logsSignal.set(mapped);
      }
    } catch (e) {
      console.warn('Error loading audit logs:', e);
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

  async logAction(
    action: AuditAction | string,
    entityType: 'student' | 'alumni' | 'user' | 'department' | 'program' | 'subject' | 'batch' | 'settings' | 'job' | 'application' | string,
    entityId: string,
    details?: Record<string, any>
  ) {
    const admin = this.authService.currentUser();
    const newLog: AdminAuditLog = {
      id: `log-${Date.now()}`,
      adminId: admin?.id || 'u-admin-01',
      adminName: admin?.fullName || 'Placement Administrator',
      adminEmail: admin?.email || 'admin@careernexus.edu',
      action,
      entityType,
      entityId,
      details: details || {},
      createdAt: new Date().toISOString()
    };

    // Prepend to local signal immediately
    this.logsSignal.update(list => [newLog, ...list]);

    if (this.supabase.client) {
      try {
        await this.supabase.client
          .from('admin_audit_logs')
          .insert({
            admin_id: admin?.id || null,
            admin_name: admin?.fullName || 'Placement Administrator',
            admin_email: admin?.email || '',
            action,
            entity_type: entityType,
            entity_id: entityId,
            details: details || {}
          });
      } catch (err) {
        console.warn('Could not save audit log to DB:', err);
      }
    }
  }
}
