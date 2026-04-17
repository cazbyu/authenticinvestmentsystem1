import React, { useState } from 'react';
import { Clock, MapPin, Check, X } from 'lucide-react';
import { useCommitments, Commitment } from '../hooks/useCommitments';
import { useAuth } from '../contexts/AuthContext';

/**
 * Check whether a commitment's end time has passed.
 * - Timed events: past when current time > end_time on that date
 * - All-day events: past when the date itself is in the past (before today)
 * - No end_time but has start_time: use start_time as cutoff
 */
function isEventPast(commitment: Commitment): boolean {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Parse the commitment date as local
  const [year, month, day] = commitment.date.split('-').map(Number);
  const eventDate = new Date(year, month - 1, day);

  // If the event date is before today, it's definitely past
  if (eventDate < today) return true;

  // If the event date is after today, it's not past
  if (eventDate > today) return false;

  // Event is today — check time
  if (commitment.is_all_day) {
    // All-day events on today are not past until the day is over
    return false;
  }

  const timeStr = commitment.end_time || commitment.start_time;
  if (!timeStr) return false;

  const [hours, minutes] = timeStr.split(':').map(Number);
  const eventEnd = new Date(year, month - 1, day, hours, minutes);

  return now > eventEnd;
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const isPM = h >= 12;
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
}

function CommitmentCard({
  commitment,
  onMarkDone,
  onMarkMissed,
}: {
  commitment: Commitment;
  onMarkDone: (id: string) => void;
  onMarkMissed: (id: string) => void;
}) {
  const [isUpdating, setIsUpdating] = useState(false);
  const past = isEventPast(commitment);
  const isReviewed = commitment.status === 'done' || commitment.status === 'missed';

  const handleDone = async () => {
    setIsUpdating(true);
    await onMarkDone(commitment.id);
    setIsUpdating(false);
  };

  const handleMissed = async () => {
    setIsUpdating(true);
    await onMarkMissed(commitment.id);
    setIsUpdating(false);
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
      commitment.status === 'done'
        ? 'bg-green-50 border-green-200'
        : commitment.status === 'missed'
        ? 'bg-red-50 border-red-200'
        : 'bg-white border-gray-200'
    }`}>
      {/* Time column */}
      <div className="w-20 flex-shrink-0 text-right">
        {commitment.is_all_day ? (
          <span className="text-xs font-medium text-gray-500 uppercase">All day</span>
        ) : commitment.start_time ? (
          <span className="text-sm text-gray-600">{formatTime(commitment.start_time)}</span>
        ) : null}
      </div>

      {/* Event info */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${
          commitment.status === 'done' ? 'text-green-800 line-through' :
          commitment.status === 'missed' ? 'text-red-800' :
          'text-gray-900'
        }`}>
          {commitment.title}
        </p>

        <div className="flex items-center gap-3 mt-0.5">
          {commitment.start_time && commitment.end_time && (
            <span className="flex items-center text-xs text-gray-500">
              <Clock size={11} className="mr-1" />
              {formatTime(commitment.start_time)} – {formatTime(commitment.end_time)}
            </span>
          )}
          {commitment.location && (
            <span className="flex items-center text-xs text-gray-500 truncate">
              <MapPin size={11} className="mr-1" />
              {commitment.location}
            </span>
          )}
        </div>
      </div>

      {/* Status badge OR action buttons */}
      <div className="flex-shrink-0">
        {isReviewed ? (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            commitment.status === 'done'
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}>
            {commitment.status === 'done' ? (
              <><Check size={12} /> Done</>
            ) : (
              <><X size={12} /> Missed</>
            )}
          </span>
        ) : past ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleDone}
              disabled={isUpdating}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50 transition-colors"
              title="Mark as done"
            >
              <Check size={12} /> Done
            </button>
            <button
              onClick={handleMissed}
              disabled={isUpdating}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
              title="Mark as missed"
            >
              <X size={12} /> Missed
            </button>
          </div>
        ) : (
          <span className="text-xs text-gray-400">Upcoming</span>
        )}
      </div>
    </div>
  );
}

export function DailyCommitments() {
  const { user } = useAuth();
  const { commitments, loading, error, markDone, markMissed } = useCommitments();

  if (!user) return null;

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Commitments</h3>
        <div className="flex justify-center py-6">
          <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Commitments</h3>
        <p className="text-sm text-red-500">Failed to load commitments.</p>
      </div>
    );
  }

  if (commitments.length === 0) return null;

  const doneCount = commitments.filter(c => c.status === 'done').length;
  const total = commitments.length;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Today's Commitments</h3>
        {total > 0 && (
          <span className="text-xs text-gray-500">
            {doneCount}/{total} done
          </span>
        )}
      </div>

      <div className="space-y-2">
        {commitments.map(commitment => (
          <CommitmentCard
            key={commitment.id}
            commitment={commitment}
            onMarkDone={markDone}
            onMarkMissed={markMissed}
          />
        ))}
      </div>
    </div>
  );
}
