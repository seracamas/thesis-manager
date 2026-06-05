import { useState, FormEvent } from 'react';
import { useAuthStore } from '../stores/authStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { useToastStore } from '../stores/toastStore';

export const Login = () => {
  const { login } = useAuthStore();
  const { error, success: showSuccess } = useToastStore();
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Small delay for better UX
    await new Promise((resolve) => setTimeout(resolve, 300));

    const loginSuccess = login(password);
    if (loginSuccess) {
      showSuccess('Login successful');
      // Redirect will happen via ProtectedRoute
    } else {
      error('Incorrect password');
      setPassword('');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-secondary bg-bg-secondary p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-text-primary text-text-primary mb-2">
            Thesis Research Manager
          </h1>
          <p className="text-text-secondary text-text-secondary">
            Please sign in to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            type="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            autoFocus
            disabled={isLoading}
          />

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-text-muted text-text-secondary">
            Default password: <code className="bg-bg-input bg-white px-2 py-1 rounded">thesis2024</code>
          </p>
          <p className="text-xs text-text-muted text-text-muted mt-2">
            Change it in Settings after logging in
          </p>
        </div>
      </Card>
    </div>
  );
};
