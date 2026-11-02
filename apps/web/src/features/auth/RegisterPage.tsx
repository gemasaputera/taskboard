import { registerSchema } from '@kanban/shared';
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

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: '', email: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await registerUser(values);
      navigate('/app', { replace: true });
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Unable to create your account right now.';

      if (error instanceof ApiError && error.fields) {
        for (const [field, messages] of Object.entries(error.fields)) {
          if (field === 'username' || field === 'email' || field === 'password') {
            form.setError(field, { message: messages[0] });
          }
        }
      }

      setServerError(message);
      toast.error(message);
    }
  });

  return (
    <AuthShell
      title="Create your workplace"
      subtitle="Your account comes with a ready-to-use board and your own private workplace."
      footer={
        <>
          Already have an account?{' '}
          <Link className="font-medium text-accent hover:underline" to="/login">
            Sign in
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
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            autoComplete="username"
            autoFocus
            placeholder="gemasaputera"
            aria-invalid={Boolean(form.formState.errors.username)}
            {...form.register('username')}
          />
          {form.formState.errors.username ? (
            <p className="text-xs text-danger">{form.formState.errors.username.message}</p>
          ) : (
            <p className="text-xs text-muted">
              3–24 characters, lowercase letters, numbers, and underscores.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={Boolean(form.formState.errors.email)}
            {...form.register('email')}
          />
          {form.formState.errors.email ? (
            <p className="text-xs text-danger">{form.formState.errors.email.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            aria-invalid={Boolean(form.formState.errors.password)}
            {...form.register('password')}
          />
          {form.formState.errors.password ? (
            <p className="text-xs text-danger">{form.formState.errors.password.message}</p>
          ) : null}
        </div>

        <Button className="w-full" size="lg" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
