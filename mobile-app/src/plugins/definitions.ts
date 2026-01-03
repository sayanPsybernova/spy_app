import { registerPlugin } from '@capacitor/core';

// ============================================
// UsageStats Plugin
// ============================================
export interface AppInfo {
  packageName: string;
  appLabel: string;
  lastUsed: number;
}

export interface UsageStatsResult {
  apps: AppInfo[];
}

export interface UsageStatsPlugin {
  hasPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<void>;
  getCurrentApp(): Promise<AppInfo | null>;
  getUsageStats(options: { startTime: number; endTime: number }): Promise<UsageStatsResult>;
}

export const UsageStats = registerPlugin<UsageStatsPlugin>('UsageStats');

// ============================================
// Location Tracker Plugin
// ============================================
export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  speed: number | null;
  bearing: number | null;
  timestamp: number;
}

export interface LocationTrackerPlugin {
  hasPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
  startTracking(options?: { intervalMs?: number }): Promise<{ success: boolean }>;
  stopTracking(): Promise<{ success: boolean }>;
  getCurrentLocation(): Promise<LocationData>;
  addListener(
    eventName: 'locationUpdate',
    listenerFunc: (location: LocationData) => void
  ): Promise<{ remove: () => void }>;
  removeAllListeners(): Promise<void>;
}

export const LocationTracker = registerPlugin<LocationTrackerPlugin>('LocationTracker');

// ============================================
// Beep Plugin
// ============================================
export interface BeepPlugin {
  playBeep(options?: { duration?: number; volume?: number }): Promise<void>;
  stopBeep(): Promise<void>;
  vibrate(options?: { pattern?: number[] }): Promise<void>;
}

export const Beep = registerPlugin<BeepPlugin>('Beep');

// ============================================
// Foreground Service Plugin
// ============================================
export interface ForegroundServiceStartOptions {
  title: string;
  body: string;
  icon?: string;
  deviceId?: string;
  serverUrl?: string;
  wsUrl?: string;
  locationEnabled?: boolean;
}

export interface ForegroundServicePlugin {
  startService(options: ForegroundServiceStartOptions): Promise<void>;
  stopService(): Promise<void>;
  updateNotification(options: { title: string; body: string }): Promise<void>;
  isRunning(): Promise<{ running: boolean }>;
  saveConfig(options: {
    deviceId?: string;
    serverUrl?: string;
    wsUrl?: string;
    locationEnabled?: boolean;
  }): Promise<void>;
  updateLocationEnabled(options: { enabled: boolean }): Promise<void>;
}

export const ForegroundService = registerPlugin<ForegroundServicePlugin>('ForegroundService');

// ============================================
// Local Storage Plugin (Offline Buffer)
// ============================================
export interface PendingEvent {
  id: number;
  eventType: string;
  payload: string;
  timestamp: number;
  synced: boolean;
}

export interface LocalStoragePlugin {
  saveEvent(options: { eventType: string; payload: string }): Promise<{ id: number }>;
  getPendingEvents(): Promise<{ events: PendingEvent[] }>;
  markEventsSynced(options: { ids: number[] }): Promise<void>;
  clearAllEvents(): Promise<void>;
  getEventCount(): Promise<{ count: number }>;
}

export const LocalStorage = registerPlugin<LocalStoragePlugin>('LocalStorage');

// ============================================
// Accessibility Plugin (Browser URL Tracking)
// ============================================
export interface AccessibilityPlugin {
  hasPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<void>;
  isEnabled(): Promise<{ enabled: boolean }>;
}

export const Accessibility = registerPlugin<AccessibilityPlugin>('Accessibility');
