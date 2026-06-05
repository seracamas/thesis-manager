import { useState, useEffect } from 'react';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import { parseScheduleRequest, timeframeToDateRange } from '../../utils/scheduleParser';
import { getAvailableWindows, createCalendarEvent, getThesisBlocks, deleteCalendarEvent } from '../../utils/calendarUtils';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { useToastStore } from '../../stores/toastStore';
import { format } from 'date-fns';
import type { AvailableWindow } from '../../types';

export const ThesisPlanner = () => {
  const { accessToken, isConnected } = useGoogleAuth();
  const { success, error } = useToastStore();
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<AvailableWindow[]>([]);
  const [parsedRequest, setParsedRequest] = useState<{ task: string; durationMinutes: number } | null>(null);
  const [thesisBlocks, setThesisBlocks] = useState<Array<{ id: string; title: string; start: Date; end: Date }>>([]);
  const [isLoadingBlocks, setIsLoadingBlocks] = useState(false);

  useEffect(() => {
    if (isConnected && accessToken) {
      loadThesisBlocks();
    }
  }, [isConnected, accessToken]);

  const loadThesisBlocks = async () => {
    if (!accessToken) return;
    setIsLoadingBlocks(true);
    try {
      const blocks = await getThesisBlocks(accessToken);
      setThesisBlocks(blocks);
    } catch (err: any) {
      console.error('Failed to load thesis blocks:', err);
    } finally {
      setIsLoadingBlocks(false);
    }
  };

  const handleFindTime = async () => {
    if (!query.trim()) {
      error('Please enter what you need time for');
      return;
    }

    if (!isConnected || !accessToken) {
      error('Please connect your Google Calendar first');
      return;
    }

    setIsProcessing(true);
    try {
      // Parse the request with Claude
      const parsed = await parseScheduleRequest(query);
      setParsedRequest({ task: parsed.task, durationMinutes: parsed.durationMinutes });

      // Convert timeframe to date range
      const { start, end } = timeframeToDateRange(parsed.timeframe);
      const dayRange = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      // Find available windows
      const windows = await getAvailableWindows(accessToken, parsed.durationMinutes, dayRange);
      setAvailableSlots(windows.slice(0, 3)); // Top 3
    } catch (err: any) {
      error(err.message || 'Failed to find available time');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBlockTime = async (slot: AvailableWindow) => {
    if (!accessToken || !parsedRequest) return;

    try {
      const eventId = await createCalendarEvent(
        accessToken,
        parsedRequest.task,
        slot.start,
        slot.end,
        'Scheduled by your Thesis Research Tool',
        '9', // Blueberry color
        [{ method: 'popup', minutes: 30 }]
      );

      success('✓ Blocked on your calendar!');
      setAvailableSlots([]);
      setQuery('');
      setParsedRequest(null);
      await loadThesisBlocks();
    } catch (err: any) {
      error(err.message || 'Failed to block time');
    }
  };

  const handleRemoveBlock = async (eventId: string) => {
    if (!accessToken) return;
    if (!confirm('Remove this time block from your calendar?')) return;

    try {
      await deleteCalendarEvent(accessToken, eventId);
      success('Time block removed');
      await loadThesisBlocks();
    } catch (err: any) {
      error(err.message || 'Failed to remove time block');
    }
  };

  const formatTime = (date: Date) => format(date, 'h:mm a');
  const formatDate = (date: Date) => format(date, 'EEE, MMM d');

  if (!isConnected) {
    return (
      <Card className="p-6 text-center">
        <p className="text-text-secondary text-text-secondary mb-4">
          Connect your Google Calendar to unlock smart scheduling
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Natural Language Input */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-text-primary text-text-primary mb-4">
          Smart Schedule Finder
        </h2>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleFindTime()}
            placeholder="What do you need time for? (e.g., 'Find me a 3 hour window to write my thesis this week')"
            className="flex-1"
            disabled={isProcessing}
          />
          <Button onClick={handleFindTime} disabled={isProcessing || !query.trim()}>
            {isProcessing ? 'Finding...' : 'Find Time'}
          </Button>
        </div>
      </Card>

      {/* Available Slots */}
      {availableSlots.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-text-primary text-text-primary mb-4">
            Available Time Slots
          </h3>
          <div className="space-y-3">
            {availableSlots.map((slot, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-4 border border-border-subtle border-border-default rounded-lg"
              >
                <div>
                  <p className="font-medium text-text-primary text-text-primary">
                    📅 {formatDate(slot.start)} · {formatTime(slot.start)} – {formatTime(slot.end)}
                  </p>
                  <p className="text-sm text-text-secondary text-text-secondary">
                    {slot.durationMinutes / 60} hrs
                    {slot.hasMeetingsBefore && ' · No meetings before'}
                    {slot.hasMeetingsAfter && ' · No meetings after'}
                  </p>
                </div>
                <Button onClick={() => handleBlockTime(slot)} size="sm">
                  Block This Time
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Upcoming Blocks */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-text-primary text-text-primary mb-4">
          Upcoming Thesis Blocks
        </h3>
        {isLoadingBlocks ? (
          <p className="text-text-secondary text-text-secondary">Loading...</p>
        ) : thesisBlocks.length === 0 ? (
          <p className="text-text-secondary text-text-secondary">No upcoming thesis blocks</p>
        ) : (
          <div className="space-y-2">
            {thesisBlocks.map((block) => (
              <div
                key={block.id}
                className="flex items-center justify-between p-3 border border-border-subtle border-border-default rounded-lg"
              >
                <div>
                  <p className="font-medium text-text-primary text-text-primary">
                    📅 {formatDate(block.start)} · {formatTime(block.start)}–{formatTime(block.end)}
                  </p>
                  <p className="text-sm text-text-secondary text-text-secondary">{block.title}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemoveBlock(block.id)}
                  className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
