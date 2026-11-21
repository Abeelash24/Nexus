import { Injectable, signal, computed, inject } from '@angular/core';
import { PlacementEvent, PlacementEventType } from '../models/calendar.model';
import { SupabaseService } from './supabase.service';
import { ToastService } from './toast.service';

@Injectable({
  providedIn: 'root'
})
export class CalendarService {
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);

  private readonly STORAGE_KEY = 'careernexus_calendar_events_cache';

  private eventsSignal = signal<PlacementEvent[]>(this.loadInitialEvents());
  events = computed(() => this.eventsSignal());

  constructor() {
    this.fetchEventsFromDatabase();
  }

  private loadInitialEvents(): PlacementEvent[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  }

  private saveEventsToCache(events: PlacementEvent[]) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(events));
    } catch {
      // ignore
    }
  }

  async fetchEventsFromDatabase() {
    const client = this.supabase.getClient();
    if (!this.supabase.isConfigured || !client) return;

    try {
      const { data, error } = await client
        .from('placement_events')
        .select('*')
        .order('start_date', { ascending: true });

      if (!error && data) {
        const mapped: PlacementEvent[] = data.map((d: any) => ({
          id: d.id,
          title: d.title,
          description: d.description,
          eventType: d.event_type as PlacementEventType,
          companyName: d.company_name,
          companyLogo: d.company_logo,
          startDate: d.start_date,
          endDate: d.end_date,
          locationOrUrl: d.location_or_url,
          isMandatory: Boolean(d.is_mandatory),
          targetDepartment: d.target_department,
          targetBatch: d.target_batch,
          forRole: d.for_role
        }));
        this.eventsSignal.set(mapped);
        this.saveEventsToCache(mapped);
      }
    } catch (err) {
      console.warn('Error fetching placement events:', err);
    }
  }

  async addEvent(event: Omit<PlacementEvent, 'id'>): Promise<PlacementEvent> {
    const newEvent: PlacementEvent = {
      ...event,
      id: `evt-${Date.now()}`
    };

    this.eventsSignal.update(list => [...list, newEvent]);
    this.saveEventsToCache(this.eventsSignal());

    const client = this.supabase.getClient();
    if (this.supabase.isConfigured && client) {
      try {
        await client.from('placement_events').insert({
          id: newEvent.id,
          title: newEvent.title,
          description: newEvent.description,
          event_type: newEvent.eventType,
          company_name: newEvent.companyName,
          company_logo: newEvent.companyLogo,
          start_date: newEvent.startDate,
          location_or_url: newEvent.locationOrUrl,
          is_mandatory: newEvent.isMandatory,
          for_role: newEvent.forRole
        });
      } catch (err) {
        console.warn('Error syncing calendar event:', err);
      }
    }

    this.toast.success('Calendar Event Added', `"${newEvent.title}" has been scheduled.`);
    return newEvent;
  }
}
