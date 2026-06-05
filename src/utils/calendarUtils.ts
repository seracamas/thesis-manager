import type { AvailableWindow } from '../types';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

/**
 * Make authenticated request to Google Calendar API
 */
async function calendarRequest(accessToken: string, endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${CALENDAR_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(error.error?.message || `API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Get busy times from Google Calendar
 */
export async function getBusyTimes(
  accessToken: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ start: Date; end: Date }>> {
  try {
    // Get list of calendars
    const calendarsResponse = await calendarRequest(accessToken, '/users/me/calendarList');
    const calendarIds = calendarsResponse.items?.map((cal: any) => cal.id || '') || ['primary'];
    
    // Query freebusy
    const freebusyResponse = await calendarRequest(accessToken, '/freeBusy', {
      method: 'POST',
      body: JSON.stringify({
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        items: calendarIds.map((id: string) => ({ id })),
      }),
    });
    
    const busyTimes: Array<{ start: Date; end: Date }> = [];
    
    // Extract busy periods from all calendars
    Object.values(freebusyResponse.calendars || {}).forEach((calendar: any) => {
      calendar.busy?.forEach((busy: any) => {
        if (busy.start && busy.end) {
          busyTimes.push({
            start: new Date(busy.start),
            end: new Date(busy.end),
          });
        }
      });
    });
    
    // Sort by start time
    busyTimes.sort((a, b) => a.start.getTime() - b.start.getTime());
    
    return busyTimes;
  } catch (error: any) {
    console.error('Error fetching busy times:', error);
    throw new Error(`Failed to fetch busy times: ${error.message}`);
  }
}

/**
 * Find available time windows
 */
export async function getAvailableWindows(
  accessToken: string,
  durationMinutes: number,
  dayRange: number = 14,
  workingHours: { start: number; end: number } = { start: 8, end: 22 }
): Promise<AvailableWindow[]> {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + dayRange);
  
  // Get busy times
  const busyTimes = await getBusyTimes(accessToken, startDate, endDate);
  
  const availableWindows: AvailableWindow[] = [];
  const durationMs = durationMinutes * 60 * 1000;
  
  // Iterate through each day
  for (let day = 0; day < dayRange; day++) {
    const currentDay = new Date(startDate);
    currentDay.setDate(currentDay.getDate() + day);
    
    // Skip weekends (optional - can be made configurable)
    // if (currentDay.getDay() === 0 || currentDay.getDay() === 6) continue;
    
    // Find busy times for this day
    const dayBusyTimes = busyTimes.filter(busy => {
      const busyDate = new Date(busy.start);
      return (
        busyDate.getDate() === currentDay.getDate() &&
        busyDate.getMonth() === currentDay.getMonth() &&
        busyDate.getFullYear() === currentDay.getFullYear()
      );
    });
    
    // Start from working hours start
    let currentTime = new Date(currentDay);
    currentTime.setHours(workingHours.start, 0, 0, 0);
    
    const dayEnd = new Date(currentDay);
    dayEnd.setHours(workingHours.end, 0, 0, 0);
    
    while (currentTime.getTime() + durationMs <= dayEnd.getTime()) {
      const windowEnd = new Date(currentTime.getTime() + durationMs);
      
      // Check if this window conflicts with any busy time
      const conflicts = dayBusyTimes.some(busy => {
        return (
          (currentTime >= busy.start && currentTime < busy.end) ||
          (windowEnd > busy.start && windowEnd <= busy.end) ||
          (currentTime <= busy.start && windowEnd >= busy.end)
        );
      });
      
      if (!conflicts) {
        // Check if there are meetings before/after
        const hasMeetingsBefore = dayBusyTimes.some(
          busy => busy.end.getTime() <= currentTime.getTime() && 
          (currentTime.getTime() - busy.end.getTime()) < 2 * 60 * 60 * 1000 // Within 2 hours
        );
        const hasMeetingsAfter = dayBusyTimes.some(
          busy => busy.start.getTime() >= windowEnd.getTime() && 
          (busy.start.getTime() - windowEnd.getTime()) < 2 * 60 * 60 * 1000 // Within 2 hours
        );
        
        availableWindows.push({
          start: new Date(currentTime),
          end: new Date(windowEnd),
          durationMinutes,
          hasMeetingsBefore,
          hasMeetingsAfter,
        });
      }
      
      // Move to next 30-minute slot
      currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
    }
  }
  
  // Sort by start time and return top results
  availableWindows.sort((a, b) => a.start.getTime() - b.start.getTime());
  
  return availableWindows;
}

/**
 * Create a Google Calendar event
 */
export async function createCalendarEvent(
  accessToken: string,
  title: string,
  startTime: Date,
  endTime: Date,
  description?: string,
  colorId?: string,
  reminders?: { minutes: number }[]
): Promise<string> {
  try {
    const event = await calendarRequest(accessToken, '/calendars/primary/events', {
      method: 'POST',
      body: JSON.stringify({
        summary: title,
        description: description || 'Scheduled by your Thesis Research Tool',
        start: {
          dateTime: startTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        colorId: colorId || '9', // Blueberry for thesis blocks
        reminders: {
          useDefault: false,
          overrides: (reminders || [{ method: 'popup', minutes: 30 }]).map(r => ({
            method: 'popup',
            minutes: r.minutes,
          })),
        },
      }),
    });
    
    return event.id || '';
  } catch (error: any) {
    console.error('Error creating calendar event:', error);
    throw new Error(`Failed to create calendar event: ${error.message}`);
  }
}

/**
 * Delete a Google Calendar event
 */
export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<void> {
  try {
    await calendarRequest(accessToken, `/calendars/primary/events/${eventId}`, {
      method: 'DELETE',
    });
  } catch (error: any) {
    console.error('Error deleting calendar event:', error);
    throw new Error(`Failed to delete calendar event: ${error.message}`);
  }
}

/**
 * Get upcoming thesis blocks from Google Calendar
 */
export async function getThesisBlocks(
  accessToken: string,
  maxResults: number = 20
): Promise<Array<{ id: string; title: string; start: Date; end: Date }>> {
  try {
    const now = new Date();
    const params = new URLSearchParams({
      timeMin: now.toISOString(),
      maxResults: String(maxResults),
      singleEvents: 'true',
      orderBy: 'startTime',
      q: 'Thesis', // Search for events with "Thesis" in title
    });
    
    const response = await calendarRequest(accessToken, `/calendars/primary/events?${params}`);
    const events = response.items || [];
    
    return events
      .filter((event: any) => event.start?.dateTime && event.end?.dateTime)
      .map((event: any) => ({
        id: event.id || '',
        title: event.summary || 'Untitled',
        start: new Date(event.start.dateTime),
        end: new Date(event.end.dateTime),
      }));
  } catch (error: any) {
    console.error('Error fetching thesis blocks:', error);
    throw new Error(`Failed to fetch thesis blocks: ${error.message}`);
  }
}

/**
 * Get calendar events for a date range
 */
export async function getCalendarEvents(
  accessToken: string,
  timeMin: Date,
  timeMax: Date
): Promise<Array<{ id: string; title: string; start: Date; end: Date; colorId?: string; description?: string }>> {
  try {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '2500',
    });
    
    const response = await calendarRequest(accessToken, `/calendars/primary/events?${params}`);
    const events = response.items || [];
    
    return events
      .filter((event: any) => event.start?.dateTime && event.end?.dateTime)
      .map((event: any) => ({
        id: event.id || '',
        title: event.summary || 'Untitled',
        start: new Date(event.start.dateTime),
        end: new Date(event.end.dateTime),
        colorId: event.colorId,
        description: event.description,
      }));
  } catch (error: any) {
    console.error('Error fetching calendar events:', error);
    throw new Error(`Failed to fetch calendar events: ${error.message}`);
  }
}
