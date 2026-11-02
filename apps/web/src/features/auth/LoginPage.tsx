import { loginSchema } from '@kanban/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { ApiError } from '../../lib/api';
import { useAuth } from './AuthProvider';
import { AuthShell } from './AuthShell';

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await login(values);
      navigate('/app', { replace: true });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to sign in right now.';
      setServerError(message);
      toast.error(message);
    }
  });

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in with your username or email to pick up where the board left off."
      footer={
        <>
          New here?{' '}
          <Link className="font-medium text-accent hover:underline" to="/register">
            Create an account
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={onSubmit} noValidate>
        {serverError ? (
          <div className="rounded-lg border border-danger/20 bg-danger-soft px-3.5 py-3 text-sm text-danger">
            {serverError}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="identifier">Username or email</Label>
          <Input
            id="identifier"
            autoComplete="username"
            autoFocus
            placeholder="gemasaputera"
            aria-invalid={Boolean(form.formState.errors.identifier)}
            {...form.register('identifier')}
          />
          {form.formState.errors.identifier ? (
            <p className="text-xs text-danger">{form.formState.errors.identifier.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={Boolean(form.formState.errors.password)}
            {...form.register('password')}
          />
          {form.formState.errors.password ? (
            <p className="text-xs text-danger">{form.formState.errors.password.message}</p>
          ) : null}
        </div>

        <Button className="w-full" size="lg" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
