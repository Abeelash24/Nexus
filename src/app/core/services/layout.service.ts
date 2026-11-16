import { Injectable, signal, computed } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LayoutService {
  readonly navbarHeightPx = 72;
  readonly navbarHeight = computed(() => `${this.navbarHeightPx}px`);

  readonly isSidebarHovered = signal(false);
  readonly isSidebarFocused = signal(false);
  readonly mobileSidebarOpen = signal(false);

  private collapseTimer: ReturnType<typeof setTimeout> | null = null;

  readonly isSidebarExpanded = computed(() => {
    return this.isSidebarHovered() || this.isSidebarFocused();
  });

  readonly sidebarWidthPx = computed(() => {
    return this.isSidebarExpanded() ? 300 : 76;
  });

  readonly sidebarWidth = computed(() => {
    return `${this.sidebarWidthPx()}px`;
  });

  onSidebarMouseEnter() {
    if (this.collapseTimer) {
      clearTimeout(this.collapseTimer);
      this.collapseTimer = null;
    }
    this.isSidebarHovered.set(true);
  }

  onSidebarMouseLeave() {
    if (this.collapseTimer) {
      clearTimeout(this.collapseTimer);
    }
    this.collapseTimer = setTimeout(() => {
      this.isSidebarHovered.set(false);
    }, 250);
  }

  onSidebarFocusIn() {
    if (this.collapseTimer) {
      clearTimeout(this.collapseTimer);
      this.collapseTimer = null;
    }
    this.isSidebarFocused.set(true);
  }

  onSidebarFocusOut(event: FocusEvent, containerEl?: HTMLElement | null) {
    const relatedTarget = event.relatedTarget as Node | null;
    if (containerEl && relatedTarget && containerEl.contains(relatedTarget)) {
      return;
    }
    if (this.collapseTimer) {
      clearTimeout(this.collapseTimer);
    }
    this.collapseTimer = setTimeout(() => {
      this.isSidebarFocused.set(false);
    }, 250);
  }

  toggleMobileSidebar() {
    this.mobileSidebarOpen.update(v => !v);
  }

  closeMobileSidebar() {
    this.mobileSidebarOpen.set(false);
  }

  openMobileSidebar() {
    this.mobileSidebarOpen.set(true);
  }
}
