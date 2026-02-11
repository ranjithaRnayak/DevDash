import { useEffect, useRef, useCallback } from 'react';
import { devOpsAPI } from '../api/backendClient';
import { useToast } from './Toast';

const POLL_INTERVAL = 30000; // 30 seconds for more timely notifications
const DISMISSED_KEY = 'devdash_dismissed_activities';
const INITIAL_LOAD_WINDOW = 5 * 60 * 1000; // Show toasts for activities from last 5 minutes on initial load

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
    // Ignore storage errors
  }
}

export default function TeamActivityNotifications() {
  const { addToast } = useToast();
  const seenActivitiesRef = useRef(new Set());
  const initialFetchDoneRef = useRef(false);

  const fetchActivities = useCallback(async () => {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const response = await devOpsAPI.getTeamActivities(since);
      const activities = response.data?.activities || [];

      const dismissed = getDismissedActivities();

      for (const activity of activities) {
        if (seenActivitiesRef.current.has(activity.id)) continue;
        if (dismissed.has(activity.id)) continue;

        seenActivitiesRef.current.add(activity.id);

        // On initial load, only show toasts for very recent activities (last 5 min)
        // to avoid spamming with old notifications
        if (!initialFetchDoneRef.current) {
          const activityAge = Date.now() - new Date(activity.timestamp).getTime();
          if (activityAge > INITIAL_LOAD_WINDOW) continue;
        }

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

      initialFetchDoneRef.current = true;
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
