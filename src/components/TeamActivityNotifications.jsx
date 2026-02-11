import { useEffect, useRef, useCallback } from 'react';
import { devOpsAPI } from '../api/backendClient';
import { useToast } from './Toast';

const POLL_INTERVAL = 30000;
const DISMISSED_KEY = 'devdash_dismissed_activities';
const NOTIFICATION_WINDOW_HOURS = parseInt(import.meta.env.VITE_NOTIFICATION_WINDOW_HOURS, 10) || 8;
const INITIAL_LOAD_WINDOW = NOTIFICATION_WINDOW_HOURS * 60 * 60 * 1000;

function getDismissedActivities() {
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

function dismissActivity(id) {
  try {
    const stored = localStorage.getItem(DISMISSED_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const filtered = parsed.filter((item) => item.timestamp > oneDayAgo);
    filtered.push({ id, timestamp: Date.now() });
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(filtered));
  } catch {
  }
}

export default function TeamActivityNotifications() {
  const { addToast } = useToast();
  const seenActivitiesRef = useRef(new Set());

  const fetchActivities = useCallback(async () => {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const response = await devOpsAPI.getTeamActivities(since);
      const activities = response.data?.activities || [];

      const dismissed = getDismissedActivities();

      for (const activity of activities) {
        if (seenActivitiesRef.current.has(activity.id)) continue;
        if (dismissed.has(activity.id)) continue;

        const activityAge = Date.now() - new Date(activity.timestamp).getTime();
        if (activityAge > INITIAL_LOAD_WINDOW) continue;

        seenActivitiesRef.current.add(activity.id);

        const typeLabels = {
          PRCreated: 'New PR',
          DraftPRCreated: 'Draft PR',
          PipelineSucceeded: 'Build Succeeded',
        };

        addToast({
          type: activity.type,
          title: activity.title,
          description: typeLabels[activity.type] || activity.description,
          author: activity.author,
          url: activity.url,
          duration: 0,
          onDismiss: () => dismissActivity(activity.id),
        });
      }
    } catch (error) {
      console.error('Failed to fetch team activities:', error);
    }
  }, [addToast]);

  useEffect(() => {
    fetchActivities();

    const interval = setInterval(fetchActivities, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchActivities]);

  return null;
}
