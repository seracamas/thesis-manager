import { useState, useEffect } from 'react';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import { useInterviewRequestsStore } from '../../stores/interviewRequestsStore';
import { getAvailableWindows, createCalendarEvent } from '../../utils/calendarUtils';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { useToastStore } from '../../stores/toastStore';
import { format } from 'date-fns';
import type { InterviewRequest, AvailableWindow } from '../../types';

export const InterviewScheduler = () => {
  const { accessToken, isConnected } = useGoogleAuth();
  const { requests, fetchRequests, createRequest, updateRequest, deleteRequest } = useInterviewRequestsStore();
  const { success, error } = useToastStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<AvailableWindow[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [isFindingSlots, setIsFindingSlots] = useState(false);
  const [emailText, setEmailText] = useState('');

  // Form state
  const [participantName, setParticipantName] = useState('');
  const [participantEmail, setParticipantEmail] = useState('');
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleCreateRequest = async () => {
    if (!participantName.trim() || !participantEmail.trim()) {
      error('Please fill in participant name and email');
      return;
    }

    try {
      await createRequest({
        participantName,
        participantEmail,
        status: 'pending',
        proposedTimes: [],
        confirmedTime: null,
        duration,
        notes,
        calendarEventId: null,
      });
      success('Interview request created');
      setIsModalOpen(false);
      setParticipantName('');
      setParticipantEmail('');
      setDuration(60);
      setNotes('');
    } catch (err: any) {
      error(err.message || 'Failed to create request');
    }
  };

  const handleFindSlots = async (requestId: string) => {
    if (!isConnected || !accessToken) {
      error('Please connect your Google Calendar first');
      return;
    }

    const request = requests.find(r => r.id === requestId);
    if (!request) return;

    setIsFindingSlots(true);
    setSelectedRequest(requestId);
    try {
      const windows = await getAvailableWindows(accessToken, request.duration, 14);
      setAvailableSlots(windows.slice(0, 5));
      setSelectedSlots([]);
    } catch (err: any) {
      error(err.message || 'Failed to find available times');
    } finally {
      setIsFindingSlots(false);
    }
  };

  const handleGenerateEmail = (request: InterviewRequest) => {
    const slots = availableSlots.filter((_, idx) => selectedSlots.includes(String(idx)));
    if (slots.length === 0) {
      error('Please select at least one time slot');
      return;
    }

    const options = slots.map((slot, idx) => {
      const dateStr = format(slot.start, 'EEEE, MMM d');
      const timeStr = format(slot.start, 'h:mm a');
      return `Option ${idx + 1}: ${dateStr} at ${timeStr} PST`;
    }).join('\n     ');

    const email = `Hi ${request.participantName}, thank you for your interest in participating in my research!
Here are some times that work for a ${request.duration}-minute interview:

     ${options}

Please reply with your preferred time and I will send a calendar invite.

Thank you!`;

    setEmailText(email);
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(emailText);
    success('Email copied to clipboard!');
  };

  const handleConfirmTime = async (requestId: string, slotIndex: number) => {
    if (!accessToken) return;

    const request = requests.find(r => r.id === requestId);
    if (!request) return;

    const slot = availableSlots[slotIndex];
    if (!slot) return;

    try {
      const eventId = await createCalendarEvent(
        accessToken,
        `Research Interview – ${request.participantName}`,
        slot.start,
        slot.end,
        request.notes || undefined,
        '11', // Tomato color
        [
          { method: 'popup', minutes: 1440 }, // 24 hours before
          { method: 'popup', minutes: 30 }, // 30 minutes before
        ]
      );

      await updateRequest(requestId, {
        status: 'scheduled',
        confirmedTime: slot.start.toISOString(),
        calendarEventId: eventId,
      });

      success('Interview scheduled and added to calendar!');
      setSelectedRequest(null);
      setAvailableSlots([]);
    } catch (err: any) {
      error(err.message || 'Failed to schedule interview');
    }
  };

  const handleMarkComplete = async (requestId: string) => {
    await updateRequest(requestId, { status: 'completed' });
    success('Interview marked as complete');
  };

  const handleDelete = async (requestId: string) => {
    if (!confirm('Delete this interview request?')) return;
    await deleteRequest(requestId);
    success('Request deleted');
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const scheduledRequests = requests.filter(r => r.status === 'scheduled');
  const completedRequests = requests.filter(r => r.status === 'completed');

  const stats = {
    total: requests.length,
    scheduled: scheduledRequests.length,
    pending: pendingRequests.length,
    completed: completedRequests.length,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <Card className="p-6">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-text-secondary text-text-secondary">Total Requests</p>
            <p className="text-2xl font-bold text-text-primary text-text-primary">{stats.total}</p>
          </div>
          <div>
            <p className="text-sm text-text-secondary text-text-secondary">✅ Scheduled</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.scheduled}</p>
          </div>
          <div>
            <p className="text-sm text-text-secondary text-text-secondary">⏳ Pending</p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</p>
          </div>
          <div>
            <p className="text-sm text-text-secondary text-text-secondary">✔️ Completed</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.completed}</p>
          </div>
        </div>
      </Card>

      {/* New Request Button */}
      <div className="flex justify-end">
        <Button onClick={() => setIsModalOpen(true)}>New Request</Button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-3 gap-4">
        {/* Pending */}
        <Card className="p-4">
          <h3 className="font-semibold text-text-primary text-text-primary mb-4">Pending</h3>
          <div className="space-y-3">
            {pendingRequests.map((request) => (
              <div key={request.id} className="p-3 border border-border-subtle border-border-default rounded-lg">
                <p className="font-medium text-text-primary text-text-primary">{request.participantName}</p>
                <p className="text-sm text-text-secondary text-text-secondary">{request.participantEmail}</p>
                <p className="text-xs text-text-muted text-text-muted mt-1">{request.duration} min</p>
                {selectedRequest === request.id && availableSlots.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {availableSlots.map((slot, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-sm flex-1">
                          <input
                            type="checkbox"
                            checked={selectedSlots.includes(String(idx))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSlots([...selectedSlots, String(idx)]);
                              } else {
                                setSelectedSlots(selectedSlots.filter(s => s !== String(idx)));
                              }
                            }}
                          />
                          <span>
                            {format(slot.start, 'EEE, MMM d')} at {format(slot.start, 'h:mm a')}
                          </span>
                        </label>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleConfirmTime(request.id, idx)}
                          disabled={!isConnected}
                        >
                          Confirm
                        </Button>
                      </div>
                    ))}
                    <Button size="sm" onClick={() => handleGenerateEmail(request)} className="mt-2">
                      Generate Email
                    </Button>
                    {emailText && selectedRequest === request.id && (
                      <div className="mt-2">
                        <textarea
                          value={emailText}
                          readOnly
                          className="w-full p-2 text-xs border rounded"
                          rows={8}
                        />
                        <Button size="sm" onClick={handleCopyEmail} className="mt-1">
                          Copy Email
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleFindSlots(request.id)}
                    disabled={isFindingSlots || !isConnected}
                  >
                    Find Times
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(request.id)}
                    className="text-red-600"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Scheduled */}
        <Card className="p-4">
          <h3 className="font-semibold text-text-primary text-text-primary mb-4">Scheduled</h3>
          <div className="space-y-3">
            {scheduledRequests.map((request) => (
              <div key={request.id} className="p-3 border border-border-subtle border-border-default rounded-lg">
                <p className="font-medium text-text-primary text-text-primary">{request.participantName}</p>
                {request.confirmedTime && (
                  <p className="text-sm text-text-secondary text-text-secondary">
                    {format(new Date(request.confirmedTime), 'EEE, MMM d · h:mm a')}
                  </p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleMarkComplete(request.id)}
                  className="mt-2"
                >
                  Mark Complete
                </Button>
              </div>
            ))}
          </div>
        </Card>

        {/* Completed */}
        <Card className="p-4">
          <h3 className="font-semibold text-text-primary text-text-primary mb-4">Completed</h3>
          <div className="space-y-3">
            {completedRequests.map((request) => (
              <div key={request.id} className="p-3 border border-border-subtle border-border-default rounded-lg">
                <p className="font-medium text-text-primary text-text-primary">{request.participantName}</p>
                {request.confirmedTime && (
                  <p className="text-sm text-text-secondary text-text-secondary">
                    {format(new Date(request.confirmedTime), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* New Request Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Interview Request">
        <div className="space-y-4">
          <Input
            label="Participant Name"
            value={participantName}
            onChange={(e) => setParticipantName(e.target.value)}
            required
          />
          <Input
            label="Participant Email"
            type="email"
            value={participantEmail}
            onChange={(e) => setParticipantEmail(e.target.value)}
            required
          />
          <div>
            <label className="block text-sm font-medium text-text-primary text-text-primary mb-2">
              Duration
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-border-default border-border-default bg-white bg-white"
            >
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
              <option value={90}>90 minutes</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary text-text-primary mb-2">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border-default border-border-default bg-white bg-white"
              rows={3}
              placeholder="e.g., PhD student, focus group"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateRequest}>Create Request</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
