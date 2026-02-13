/**
 * Utility functions for managing dismissed team activity notifications
 */

const DISMISSED_KEY = 'devdash_dismissed_activities';

export function getDismissedActivities() {
  try {
    const stored = localStorage.getItem(DISMISSED_KEY);
    if (!stored) return new Set();
    const parsed = JSON.parse(stored);
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const filtered = parsed.filter((item) => item.timestamp > oneDayAgo);
    return new Set(filtered.map((item) => item.id));
  } catch {
    return new Set();
  }
}

export function dismissActivity(id) {
  try {
    const stored = localStorage.getItem(DISMISSED_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const filtered = parsed.filter((item) => item.timestamp > oneDayAgo);
    filtered.push({ id, timestamp: Date.now() });
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(filtered));
  } catch {
    // Ignore storage errors
  }
}

export function clearDismissedActivities() {
  localStorage.removeItem(DISMISSED_KEY);
  // Dispatch event to notify components to reset and re-fetch
  window.dispatchEvent(new CustomEvent('devdash:reset-notifications'));
}
