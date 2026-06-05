import { useCalendarStore } from '../stores/calendarStore';
import { useToastStore } from '../stores/toastStore';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

/**
 * Hook for Google Calendar OAuth
 */
export function useGoogleAuth() {
  const { accessToken, userEmail, setAccessToken, clearAccessToken, isConnected } = useCalendarStore();
  const { success, error } = useToastStore();

  const connectCalendar = () => {
    if (!GOOGLE_CLIENT_ID) {
      error('Google Calendar Client ID not configured. Please set VITE_GOOGLE_CLIENT_ID in .env file.');
      return;
    }

    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ].join(' ');

    const redirectUri = window.location.origin;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent`;

    // Open popup for OAuth
    const width = 500;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const popup = window.open(
      authUrl,
      'Google Calendar Auth',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    // Listen for OAuth callback
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
        setAccessToken(event.data.accessToken, event.data.email || '');
        success('Google Calendar connected successfully!');
        popup?.close();
        window.removeEventListener('message', handleMessage);
      } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
        error('Failed to connect Google Calendar');
        popup?.close();
        window.removeEventListener('message', handleMessage);
      }
    };

    window.addEventListener('message', handleMessage);

    // Check for token in URL (fallback for redirect flow)
    const checkUrl = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkUrl);
        window.removeEventListener('message', handleMessage);
      }
    }, 1000);
  };

  const disconnectCalendar = () => {
    clearAccessToken();
    success('Google Calendar disconnected');
  };

  return {
    accessToken,
    userEmail,
    isConnected: isConnected(),
    connectCalendar,
    disconnectCalendar,
  };
}

// Handle OAuth callback from redirect
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const hash = window.location.hash;
    if (hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      
      if (accessToken) {
        // Get user email
        fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
          .then(res => res.json())
          .then(data => {
            window.opener?.postMessage(
              {
                type: 'GOOGLE_AUTH_SUCCESS',
                accessToken,
                email: data.email,
              },
              window.location.origin
            );
            window.close();
          })
          .catch(() => {
            window.opener?.postMessage(
              {
                type: 'GOOGLE_AUTH_ERROR',
              },
              window.location.origin
            );
            window.close();
          });
      }
    }
  });
}
