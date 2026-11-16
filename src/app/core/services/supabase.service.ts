import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  public client: SupabaseClient | null = null;
  public readonly isConfigured: boolean;

  constructor() {
    this.isConfigured = !!(
      environment.supabaseUrl &&
      environment.supabaseKey
    );

    if (this.isConfigured) {
      try {
        this.client = createClient(environment.supabaseUrl, environment.supabaseKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          },
          realtime: {
            params: {
              eventsPerSecond: 10
            }
          }
        });
      } catch (err) {
        console.warn('Supabase client initialization warning:', err);
      }
    }
  }

  getClient(): SupabaseClient | null {
    return this.client;
  }

  get auth() {
    return this.client?.auth || null;
  }

  get storage() {
    return this.client?.storage || null;
  }

  from(table: string) {
    return this.client ? this.client.from(table) : null;
  }

  async uploadFile(bucket: string, path: string, file: File | Blob): Promise<{ path: string; url: string } | null> {
    if (!this.client) return null;
    try {
      const { data, error } = await this.client.storage.from(bucket).upload(path, file, {
        upsert: true
      });
      if (error) {
        console.error(`Error uploading to ${bucket}/${path}:`, error);
        return null;
      }
      const { data: urlData } = this.client.storage.from(bucket).getPublicUrl(data.path);
      return {
        path: data.path,
        url: urlData.publicUrl
      };
    } catch (e) {
      console.error('Storage upload exception:', e);
      return null;
    }
  }

  getPublicUrl(bucket: string, path: string): string {
    if (!this.client) return '';
    const { data } = this.client.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  extractStoragePath(bucket: string, pathOrUrl: string): string {
    if (!pathOrUrl) return '';
    let cleaned = pathOrUrl.trim();

    // Remove query params or hash if present
    const queryIndex = cleaned.indexOf('?');
    if (queryIndex !== -1) {
      cleaned = cleaned.substring(0, queryIndex);
    }
    const hashIndex = cleaned.indexOf('#');
    if (hashIndex !== -1) {
      cleaned = cleaned.substring(0, hashIndex);
    }

    // Standard Supabase storage URL patterns
    const patterns = [
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/object/sign/${bucket}/`,
      `/storage/v1/object/authenticated/${bucket}/`,
      `/storage/v1/object/${bucket}/`
    ];

    for (const pat of patterns) {
      const idx = cleaned.indexOf(pat);
      if (idx !== -1) {
        return decodeURIComponent(cleaned.substring(idx + pat.length));
      }
    }

    // If string begins with '<bucket>/'
    if (cleaned.startsWith(`${bucket}/`)) {
      return cleaned.substring(bucket.length + 1);
    }

    // Generic URL parsing if bucket is a path segment
    if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
      try {
        const url = new URL(cleaned);
        const parts = url.pathname.split('/');
        const bucketIdx = parts.indexOf(bucket);
        if (bucketIdx !== -1 && bucketIdx < parts.length - 1) {
          return decodeURIComponent(parts.slice(bucketIdx + 1).join('/'));
        }
      } catch {
        // ignore and fallback
      }
    }

    return cleaned;
  }

  async createSignedUrl(bucket: string, pathOrUrl: string, expiresIn: number = 3600): Promise<string | null> {
    if (!this.client || !pathOrUrl) return null;
    try {
      const path = this.extractStoragePath(bucket, pathOrUrl);
      if (!path) return null;
      const { data, error } = await this.client.storage.from(bucket).createSignedUrl(path, expiresIn);
      if (error) {
        console.error(`Error generating signed URL for ${bucket}/${path}:`, error);
        return null;
      }
      return data?.signedUrl || null;
    } catch (e) {
      console.error('Signed URL exception:', e);
      return null;
    }
  }

  async downloadFileBlob(bucket: string, path: string): Promise<Blob | null> {
    if (!this.client) return null;
    try {
      const { data, error } = await this.client.storage.from(bucket).download(path);
      if (error) {
        console.error(`Error downloading blob from ${bucket}/${path}:`, error);
        return null;
      }
      return data;
    } catch (e) {
      console.error('Blob download exception:', e);
      return null;
    }
  }

  async deleteStorageFile(bucket: string, path: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      const { error } = await this.client.storage.from(bucket).remove([path]);
      if (error) {
        console.error(`Error deleting storage file ${bucket}/${path}:`, error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Storage delete exception:', e);
      return false;
    }
  }

  subscribeToChanges(table: string, onEvent: (payload: any) => void): RealtimeChannel | null {
    return this.subscribeToTable(`public:${table}:${Date.now()}`, table, onEvent);
  }

  subscribeToTable(
    channelName: string,
    table: string,
    onEvent: (payload: any) => void,
    filter?: string
  ): RealtimeChannel | null {
    if (!this.client) return null;
    try {
      const config: any = { event: '*', schema: 'public', table: table };
      if (filter) {
        config.filter = filter;
      }
      const channel = this.client
        .channel(channelName)
        .on('postgres_changes', config, (payload) => onEvent(payload))
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`[Supabase Realtime] Subscribed to ${table} via channel ${channelName}`);
          }
        });
      return channel;
    } catch (err) {
      console.warn(`Could not subscribe to realtime changes for ${table}:`, err);
      return null;
    }
  }

  unsubscribe(channel: RealtimeChannel | null) {
    if (channel && this.client) {
      try {
        this.client.removeChannel(channel);
      } catch (err) {
        console.warn('Error unsubscribing channel:', err);
      }
    }
  }
}
