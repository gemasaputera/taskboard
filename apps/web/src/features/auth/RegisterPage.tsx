import {
  emailSchema,
  LIMITS,
  passwordIncludesIdentity,
  passwordSchema,
  usernameSchema,
} from '@kanban/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { ApiError } from '../../lib/api';
import { useAuth } from './AuthProvider';
import { AuthShell } from './AuthShell';
import { AvailabilityHint } from './AvailabilityHint';
import { PasswordStrength } from './PasswordStrength';
import { useAvailability } from './useAvailability';

const registerFormSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Passwords do not match.',
      });
    }

    if (passwordIncludesIdentity(value.password, value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: 'Password must not contain your username or email.',
      });
    }
  });

type RegisterFormValues = z.infer<typeof registerFormSchema>;

/** Spaces never belong in a username; remove them (and uppercase) as the user types. */
function normalizeUsername(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '').slice(0, LIMITS.usernameMax);
}

function normalizeEmail(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '').slice(0, 254);
}

export function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    mode: 'onTouched',
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
  });

  const username = form.watch('username');
  const email = form.watch('email');
  const password = form.watch('password');
  const usernameAvailability = useAvailability('username', username);
  const emailAvailability = useAvailability('email', email);

  const usernameError = form.formState.errors.username?.message;
  const emailError = form.formState.errors.email?.message;
  const passwordError = form.formState.errors.password?.message;
  const confirmPasswordError = form.formState.errors.confirmPassword?.message;

  const taken = usernameAvailability.status === 'taken' || emailAvailability.status === 'taken';

  const usernameField = form.register('username');
  const emailField = form.register('email');

  const onSubmit = form.handleSubmit(async (values) => {
    if (taken) return;

    setServerError(null);

    try {
      await registerUser({
        username: values.username,
        email: values.email,
        password: values.password,
      });
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
          <div
            className="rounded-lg border border-danger/20 bg-danger-soft px-3.5 py-3 text-sm text-danger"
            role="alert"
          >
            {serverError}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            maxLength={LIMITS.usernameMax}
            placeholder="gemasaputera"
            aria-invalid={Boolean(usernameError) || usernameAvailability.status === 'taken'}
            aria-describedby="username-status"
            {...usernameField}
            onChange={(event) => {
              event.target.value = normalizeUsername(event.target.value);
              void usernameField.onChange(event);
            }}
          />
          {usernameError ? (
            <p id="username-status" className="text-xs text-danger">
              {usernameError}
            </p>
          ) : (
            <AvailabilityHint
              id="username-status"
              state={usernameAvailability}
              idle="3–24 characters, lowercase letters, numbers, and underscores. Spaces are removed automatically."
            />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={254}
            placeholder="you@example.com"
            aria-invalid={Boolean(emailError) || emailAvailability.status === 'taken'}
            aria-describedby="email-status"
            {...emailField}
            onChange={(event) => {
              event.target.value = normalizeEmail(event.target.value);
              void emailField.onChange(event);
            }}
          />
          {emailError ? (
            <p id="email-status" className="text-xs text-danger">
              {emailError}
            </p>
          ) : (
            <AvailabilityHint
              id="email-status"
              state={emailAvailability}
              idle="We’ll check this address as you type."
            />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Create a strong password"
              className="pr-11"
              aria-invalid={Boolean(passwordError)}
              aria-describedby="password-strength"
              {...form.register('password')}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {passwordError ? <p className="text-xs text-danger">{passwordError}</p> : null}
          <PasswordStrength password={password} identity={{ username, email }} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Repeat your password"
              className="pr-11"
              aria-invalid={Boolean(confirmPasswordError)}
              {...form.register('confirmPassword')}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20"
              aria-label={
                showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'
              }
              aria-pressed={showConfirmPassword}
              onClick={() => setShowConfirmPassword((visible) => !visible)}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {confirmPasswordError ? (
            <p className="text-xs text-danger">{confirmPasswordError}</p>
          ) : null}
        </div>

        <Button
          className="w-full"
          size="lg"
          type="submit"
          disabled={form.formState.isSubmitting || taken}
          aria-busy={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
