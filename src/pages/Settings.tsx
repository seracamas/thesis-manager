import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { hasApiKey, setApiKey as saveApiKey, removeApiKey, getUsage, resetUsage } from '../utils/anthropic';
import { resetDatabase } from '../utils/db';
import { testClaudeConnection } from '../utils/testAnthropic';

export const Settings = () => {
  const { logout, setPassword, checkPassword } = useAuthStore();
  const { success, error } = useToastStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [usage, setUsage] = useState(getUsage());
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  useEffect(() => {
    setUsage(getUsage());
  }, []);

  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      saveApiKey(apiKey.trim());
      success('API key saved');
      setApiKey('');
      setUsage(getUsage()); // Refresh usage display
    } else {
      error('Please enter an API key');
    }
  };

  const handleRemoveApiKey = () => {
    if (confirm('Remove API key? AI features will be disabled.')) {
      removeApiKey();
      setUsage({ calls: 0, tokens: 0 });
      success('API key removed');
    }
  };

  const handleResetUsage = () => {
    if (confirm('Reset usage statistics?')) {
      resetUsage();
      setUsage({ calls: 0, tokens: 0 });
      success('Usage statistics reset');
    }
  };

  const handleTestConnection = async () => {
    if (!hasApiKey()) {
      error('Please save an API key first');
      return;
    }
    
    setIsTestingConnection(true);
    try {
      const result = await testClaudeConnection();
      if (result.success) {
        success(result.message);
      } else {
        error(result.message);
      }
    } catch (err: any) {
      error(err.message || 'Connection test failed');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();

    if (!checkPassword(currentPassword)) {
      error('Current password is incorrect');
      return;
    }

    if (newPassword.length < 6) {
      error('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      error('New passwords do not match');
      return;
    }

    setPassword(newPassword);
    success('Password changed successfully');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleLogout = () => {
    logout();
    success('Logged out successfully');
  };

  const handleResetDatabase = async () => {
    if (confirm('⚠️ WARNING: This will delete ALL your data (sources, notes, interviews, etc.). This cannot be undone. Are you sure?')) {
      if (confirm('This is your last chance. All data will be permanently deleted. Continue?')) {
        try {
          success('Resetting database... Page will reload automatically.');
          // The resetDatabase function will handle the reload
          await resetDatabase();
        } catch (err: any) {
          // Even if there's an error, try to reload to clear the corrupted state
          error(`Database reset initiated. Page will reload...`);
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="mt-2 text-text-secondary text-text-secondary">
          Manage your account settings
        </p>
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-semibold text-text-primary text-text-primary mb-4">
          Change Password
        </h2>
        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          <Input
            type="password"
            label="Current Password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <Input
            type="password"
            label="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
          />
          <Input
            type="password"
            label="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
          />
          <Button type="submit">Change Password</Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold text-text-primary text-text-primary mb-4">
          AI Settings (Claude API)
        </h2>
        {hasApiKey() ? (
          <div className="space-y-4">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 border-green-200 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-200">
                ✓ API key configured
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary text-text-primary">
                Usage Statistics
              </p>
              <div className="text-sm text-text-secondary text-text-secondary">
                <p>API Calls: {usage.calls}</p>
                <p>Tokens Used: {usage.tokens.toLocaleString()}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleResetUsage}>
                  Reset Statistics
                </Button>
                <Button variant="outline" size="sm" onClick={handleTestConnection} disabled={isTestingConnection}>
                  {isTestingConnection ? 'Testing...' : 'Test Connection'}
                </Button>
              </div>
            </div>
            <Button variant="danger" size="sm" onClick={handleRemoveApiKey}>
              Remove API Key
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary text-text-secondary">
              Add your Anthropic Claude API key to enable AI-powered features like theme suggestions, semantic search, and content summarization.
            </p>
            <div className="space-y-2">
              <Input
                type={showApiKey ? 'text' : 'password'}
                label="API Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
              />
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="show-key"
                  checked={showApiKey}
                  onChange={(e) => setShowApiKey(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="show-key" className="text-sm text-text-secondary text-text-secondary">
                  Show API key
                </label>
              </div>
              <Button onClick={handleSaveApiKey} disabled={!apiKey.trim()}>
                Save API Key
              </Button>
            </div>
            <p className="text-xs text-text-muted text-text-secondary">
              Get your API key from{' '}
              <a
                href="https://console.anthropic.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 text-accent-gold underline"
              >
                Anthropic Console
              </a>
            </p>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold text-text-primary text-text-primary mb-4">
          Database
        </h2>
        <div className="space-y-4">
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
              <strong>Reset Database</strong>
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              If you're experiencing database errors (like "ConstraintError"), resetting the database will fix the issue. 
              <strong className="block mt-1">⚠️ This will delete ALL your data permanently.</strong>
            </p>
          </div>
          <Button variant="danger" onClick={handleResetDatabase}>
            Reset Database
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold text-text-primary text-text-primary mb-4">
          Session
        </h2>
        <Button variant="danger" onClick={handleLogout}>
          Log Out
        </Button>
      </Card>
    </div>
  );
};
