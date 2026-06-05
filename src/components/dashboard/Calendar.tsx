import { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, getDay } from 'date-fns';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import { useCalendarStore } from '../../stores/calendarStore';
import { getCalendarEvents, createCalendarEvent } from '../../utils/calendarUtils';
import { useTodosStore } from '../../stores/todosStore';
import { useToastStore } from '../../stores/toastStore';
import clsx from 'clsx';

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  colorId?: string;
  type: 'thesis' | 'interview' | 'other';
}

export const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddDate, setQuickAddDate] = useState<Date | null>(null);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventStart, setNewEventStart] = useState('');
  const [newEventEnd, setNewEventEnd] = useState('');
  const [newEventType, setNewEventType] = useState<'thesis' | 'interview' | 'other'>('thesis');
  const [isLoading, setIsLoading] = useState(false);

  const { isConnected, accessToken } = useGoogleAuth();
  const { todos } = useTodosStore();
  const { success, error: showError } = useToastStore();

  // Fetch calendar events
  useEffect(() => {
    if (isConnected && accessToken) {
      const fetchEvents = async () => {
        setIsLoading(true);
        try {
          const monthStart = startOfMonth(currentDate);
          const monthEnd = endOfMonth(currentDate);
          const calendarEvents = await getCalendarEvents(accessToken, monthStart, monthEnd);
          
          const mappedEvents: CalendarEvent[] = calendarEvents.map(event => {
            let type: 'thesis' | 'interview' | 'other' = 'other';
            if (event.title.toLowerCase().includes('thesis')) {
              type = 'thesis';
            } else if (event.title.toLowerCase().includes('interview')) {
              type = 'interview';
            }
            return {
              ...event,
              type,
            };
          });
          
          setEvents(mappedEvents);
        } catch (err: any) {
          console.error('Failed to fetch calendar events:', err);
          showError('Failed to load calendar events');
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchEvents();
    } else {
      setEvents([]);
    }
  }, [isConnected, accessToken, currentDate]);

  // Calendar grid
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getEventsForDay = (day: Date) => {
    return events.filter(event => isSameDay(event.start, day));
  };

  const getTodosForDay = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return todos.filter(todo => !todo.completed && todo.dueDate === dayStr);
  };

  const getEventColor = (event: CalendarEvent) => {
    if (event.type === 'thesis') return 'bg-blue-500';
    if (event.type === 'interview') return 'bg-red-500';
    return 'bg-neutral-400';
  };

  const handleQuickAdd = (day: Date) => {
    setQuickAddDate(day);
    setNewEventTitle('');
    setNewEventStart('09:00');
    setNewEventEnd('10:00');
    setNewEventType('thesis');
    setIsQuickAddOpen(true);
  };

  const handleCreateEvent = async () => {
    if (!isConnected || !accessToken || !quickAddDate || !newEventTitle) {
      showError('Please fill in all required fields');
      return;
    }

    try {
      const [startHour, startMin] = newEventStart.split(':').map(Number);
      const [endHour, endMin] = newEventEnd.split(':').map(Number);
      
      const startTime = new Date(quickAddDate);
      startTime.setHours(startHour, startMin, 0, 0);
      
      const endTime = new Date(quickAddDate);
      endTime.setHours(endHour, endMin, 0, 0);

      let title = newEventTitle;
      if (newEventType === 'thesis' && !title.toLowerCase().includes('thesis')) {
        title = `Thesis: ${title}`;
      } else if (newEventType === 'interview' && !title.toLowerCase().includes('interview')) {
        title = `Interview: ${title}`;
      }

      await createCalendarEvent(accessToken, title, startTime, endTime);
      success('Event created successfully!');
      setIsQuickAddOpen(false);
      
      // Refresh events
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarEvents = await getCalendarEvents(accessToken, monthStart, monthEnd);
      const mappedEvents: CalendarEvent[] = calendarEvents.map(event => {
        let type: 'thesis' | 'interview' | 'other' = 'other';
        if (event.title.toLowerCase().includes('thesis')) {
          type = 'thesis';
        } else if (event.title.toLowerCase().includes('interview')) {
          type = 'interview';
        }
        return { ...event, type };
      });
      setEvents(mappedEvents);
    } catch (err: any) {
      showError(err.message || 'Failed to create event');
    }
  };

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
          >
            Today
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            >
              ←
            </Button>
            <h2 className="text-xl font-semibold text-[#1A1714] font-playfair min-w-[200px] text-center">
              {format(currentDate, 'MMMM yyyy')}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            >
              →
            </Button>
          </div>
        </div>
      </div>

      {!isConnected && (
        <div className="mb-4 p-4 bg-[#FBF6E8] border border-[#EEEBE4] rounded-xl text-sm text-[#7C7469] text-center">
          Connect Google Calendar in the Planning tab to see your events here
        </div>
      )}

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Day headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div
            key={day}
            className="p-2 text-center text-sm font-medium text-[#7C7469]"
          >
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {days.map(day => {
          const dayEvents = getEventsForDay(day);
          const dayTodos = getTodosForDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={day.toISOString()}
              className={clsx(
                'min-h-[100px] p-2 border border-[#EEEBE4] rounded',
                !isCurrentMonth && 'opacity-40',
                isToday && 'border border-[#E8C96A]'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={clsx(
                    'text-sm',
                    isToday && 'text-[#E8C96A] font-bold',
                    !isToday && 'text-[#B5AFA8]'
                  )}
                >
                  {format(day, 'd')}
                </span>
                {isConnected && (
                  <button
                    onClick={() => handleQuickAdd(day)}
                    className="text-xs text-[#B5AFA8] hover:text-[#E8C96A]"
                    title="Add event"
                  >
                    +
                  </button>
                )}
              </div>

              <div className="space-y-1">
                {dayEvents.slice(0, 3).map(event => (
                  <div
                    key={event.id}
                    onClick={() => {
                      setSelectedEvent(event);
                      setIsEventModalOpen(true);
                    }}
                    className={clsx(
                      'text-xs p-1 rounded truncate cursor-pointer hover:opacity-80',
                      getEventColor(event),
                      'text-white'
                    )}
                    title={event.title}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-[#B5AFA8]">
                    +{dayEvents.length - 3} more
                  </div>
                )}
                {dayTodos.length > 0 && (
                  <div className="flex gap-1">
                    {dayTodos.map(todo => (
                      <div
                        key={todo.id}
                        className="w-2 h-2 rounded-full bg-amber-500"
                        title={todo.text}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Event Detail Modal */}
      <Modal
        isOpen={isEventModalOpen && !!selectedEvent}
        onClose={() => {
          setIsEventModalOpen(false);
          setSelectedEvent(null);
        }}
        title={selectedEvent?.title}
      >
        {selectedEvent && (
          <div className="space-y-2">
            <p className="text-sm text-text-secondary text-text-secondary">
              <strong>Start:</strong> {format(selectedEvent.start, 'PPp')}
            </p>
            <p className="text-sm text-text-secondary text-text-secondary">
              <strong>End:</strong> {format(selectedEvent.end, 'PPp')}
            </p>
            <p className="text-sm text-text-secondary text-text-secondary">
              <strong>Type:</strong> {selectedEvent.type}
            </p>
          </div>
        )}
      </Modal>

      {/* Quick Add Event Modal */}
      <Modal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        title="Add Event"
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={newEventTitle}
            onChange={(e) => setNewEventTitle(e.target.value)}
            placeholder="Event title"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Time"
              type="time"
              value={newEventStart}
              onChange={(e) => setNewEventStart(e.target.value)}
            />
            <Input
              label="End Time"
              type="time"
              value={newEventEnd}
              onChange={(e) => setNewEventEnd(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary text-text-primary mb-2">
              Type
            </label>
            <select
              value={newEventType}
              onChange={(e) => setNewEventType(e.target.value as 'thesis' | 'interview' | 'other')}
              className="w-full px-3 py-2 border border-border-default border-border-default rounded-lg bg-white bg-white text-text-primary text-text-primary"
            >
              <option value="thesis">Thesis Block</option>
              <option value="interview">Interview</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsQuickAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateEvent} disabled={!newEventTitle}>
              Create Event
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
};
