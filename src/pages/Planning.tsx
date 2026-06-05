import { useState } from 'react';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ThesisPlanner } from '../components/planning/ThesisPlanner';
import { InterviewScheduler } from '../components/planning/InterviewScheduler';
import clsx from 'clsx';

export const Planning = () => {
  const { isConnected, userEmail, connectCalendar, disconnectCalendar } = useGoogleAuth();
  const [activeTab, setActiveTab] = useState<'thesis' | 'interviews'>('thesis');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title">Planning</h1>
        <p className="mt-2 text-text-secondary text-text-secondary">
          Smart scheduling and interview management
        </p>
      </div>

      {/* Google Calendar Connection */}
      {!isConnected ? (
        <Card className="p-4 bg-primary-50 bg-accent-gold-soft border-primary-200 border-accent-gold">
          <div className="flex items-center justify-between">
            <p className="text-sm text-primary-800 text-text-primary">
              Connect your Google Calendar to unlock smart scheduling →
            </p>
            <Button onClick={connectCalendar} size="sm">
              Connect Google Calendar
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-4 bg-green-50 dark:bg-green-900/20 border-green-200 border-green-200">
          <div className="flex items-center justify-between">
            <p className="text-sm text-green-800 dark:text-green-200">
              ✓ Connected to Google Calendar ({userEmail})
            </p>
            <Button variant="outline" size="sm" onClick={disconnectCalendar}>
              Disconnect
            </Button>
          </div>
        </Card>
      )}

      {/* Tab Toggle */}
      <div className="flex gap-2 border-b border-border-subtle border-border-default">
        <button
          onClick={() => setActiveTab('thesis')}
          className={clsx(
            'px-4 py-2 font-medium transition-colors',
            activeTab === 'thesis'
              ? 'text-primary-800 text-accent-gold border-b-2 border-primary-500'
              : 'text-text-secondary text-text-secondary hover:text-text-primary dark:hover:text-neutral-100'
          )}
        >
          🗓 Thesis Planner
        </button>
        <button
          onClick={() => setActiveTab('interviews')}
          className={clsx(
            'px-4 py-2 font-medium transition-colors',
            activeTab === 'interviews'
              ? 'text-primary-800 text-accent-gold border-b-2 border-primary-500'
              : 'text-text-secondary text-text-secondary hover:text-text-primary dark:hover:text-neutral-100'
          )}
        >
          👥 Interview Scheduler
        </button>
      </div>

      {/* Content */}
      {activeTab === 'thesis' ? <ThesisPlanner /> : <InterviewScheduler />}
    </div>
  );
};
