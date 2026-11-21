import { Injectable, signal, computed, inject, OnDestroy, effect } from '@angular/core';
import { NotificationItem, NotificationType } from '../models/notification.model';
import { ToastService } from './toast.service';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService implements OnDestroy {
  private supabase = inject(SupabaseService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);

  private notificationsSignal = signal<NotificationItem[]>([]);
  private realtimeChannel: any = null;

  notifications = computed(() => this.notificationsSignal());

  unreadCount = computed(() =>
    this.notificationsSignal().filter(n => !n.isRead).length
  );

  constructor() {
    // Reactively load notifications and subscribe to Realtime whenever active user changes
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        this.loadNotifications();
        this.setupRealtimeSubscription(user.id);
      } else {
        this.notificationsSignal.set([]);
        this.teardownRealtimeSubscription();
      }
    });
  }

  ngOnDestroy() {
    this.teardownRealtimeSubscription();
  }

  private setupRealtimeSubscription(userId: string) {
    this.teardownRealtimeSubscription();
    if (!this.supabase.client) return;

    this.realtimeChannel = this.supabase.subscribeToTable(
      `notifications_${userId}_${Date.now()}`,
      'notifications',
      (payload) => {
        if (payload.eventType === 'INSERT' && payload.new) {
          const row = payload.new;
          if (row.user_id === userId || row.user_id === 'all') {
            const item: NotificationItem = {
              id: row.id,
              userId: row.user_id,
              senderId: row.sender_id,
              type: row.type as NotificationType,
              title: row.title,
              message: row.message,
              link: row.link,
              referenceType: row.reference_type,
              referenceId: row.reference_id,
              isRead: row.is_read ?? false,
              createdAt: row.created_at
            };
            this.notificationsSignal.update(list => [item, ...list.filter(n => n.id !== item.id)]);
            this.toast.info(item.title, item.message);
          }
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          const row = payload.new;
          if (row.user_id === userId) {
            this.notificationsSignal.update(list =>
              list.map(n => n.id === row.id ? { ...n, isRead: row.is_read } : n)
            );
          }
        }
      },
      `user_id=eq.${userId}`
    );
  }

  private teardownRealtimeSubscription() {
    if (this.realtimeChannel) {
      this.supabase.unsubscribe(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }

  async loadNotifications() {
    if (!this.supabase.client) return;
    const currentUser = this.authService.currentUser();
    if (!currentUser) return;

    try {
      const { data, error } = await this.supabase.client
        .from('notifications')
        .select('*')
        .or(`user_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Could not load notifications from Supabase:', error);
        return;
      }

      if (data) {
        const mapped: NotificationItem[] = data.map((d: any) => ({
          id: d.id,
          userId: d.user_id,
          type: d.type as NotificationType,
          title: d.title,
          message: d.message,
          link: d.link,
          isRead: d.is_read ?? false,
          createdAt: d.created_at
        }));
        this.notificationsSignal.set(mapped);
      }
    } catch (err) {
      console.warn('Error loading notifications:', err);
    }
  }

  async markAsRead(id: string) {
    this.notificationsSignal.update(list =>
      list.map(n => n.id === id ? { ...n, isRead: true } : n)
    );

    if (this.supabase.client && !id.startsWith('n-')) {
      try {
        await this.supabase.client
          .from('notifications')
          .update({ is_read: true })
          .eq('id', id);
      } catch (err) {
        console.warn('Error updating notification read status:', err);
      }
    }
  }

  async markAllAsRead() {
    this.notificationsSignal.update(list =>
      list.map(n => ({ ...n, isRead: true }))
    );

    if (this.supabase.client) {
      const currentUser = this.authService.currentUser();
      if (currentUser) {
        try {
          await this.supabase.client
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', currentUser.id);
        } catch (err) {
          console.warn('Error marking all notifications read:', err);
        }
      }
    }

    this.toast.info('Notifications Updated', 'All notifications marked as read.');
  }

  async addNotification(notification: Omit<NotificationItem, 'id' | 'createdAt' | 'isRead'>) {
    const newItem: NotificationItem = {
      ...notification,
      id: `n-${Date.now()}`,
      isRead: false,
      createdAt: new Date().toISOString()
    };

    const currentUser = this.authService.currentUser();
    // Only add to local signal and show toast if this notification is for the current user
    if (notification.userId === currentUser?.id || notification.userId === 'all') {
      this.notificationsSignal.update(list => [newItem, ...list]);
      this.toast.info(newItem.title, newItem.message);
    }

    if (this.supabase.client) {
      try {
        const { data, error } = await this.supabase.client
          .from('notifications')
          .insert({
            user_id: notification.userId === 'all' ? currentUser?.id : notification.userId,
            sender_id: notification.senderId || currentUser?.id || null,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            link: notification.link || '',
            reference_type: notification.referenceType || 'general',
            reference_id: notification.referenceId || '',
            is_read: false
          })
          .select()
          .single();

        if (data && (notification.userId === currentUser?.id || notification.userId === 'all')) {
          this.notificationsSignal.update(list =>
            list.map(n => n.id === newItem.id ? { ...n, id: data.id } : n)
          );
        } else if (error) {
          console.warn('Could not insert notification into DB:', error.message);
        }
      } catch (err) {
        console.warn('Error inserting notification to DB:', err);
      }
    }
  }

  broadcastAnnouncement(title: string, message: string) {
    this.addNotification({
      userId: 'all',
      type: 'announcement',
      title: `📢 Announcement: ${title}`,
      message: message,
      link: '/student/dashboard'
    });
    this.toast.success('Announcement Broadcasted', 'All students and mentors have received this announcement.');
  }
}
