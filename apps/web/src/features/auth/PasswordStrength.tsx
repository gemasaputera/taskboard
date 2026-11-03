import { assessPassword, type PasswordIdentity } from '@kanban/shared';
import { Check, Circle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PasswordStrengthProps {
  password: string;
  identity: PasswordIdentity;
}

const BAR_TONES = ['bg-danger', 'bg-danger', 'bg-[#e9c46a]', 'bg-success'];
const LABEL_TONES = ['text-danger', 'text-danger', 'text-[#8a5a00]', 'text-success'];

export function PasswordStrength({ password, identity }: PasswordStrengthProps) {
  if (password.length === 0) {
    return (
      <p id="password-strength" className="text-xs leading-relaxed text-muted">
        8+ characters with uppercase and lowercase letters, a number, and a symbol.
      </p>
    );
  }

  const assessment = assessPassword(password, identity);
  const toneIndex = assessment.score === 0 ? 0 : assessment.score - 1;

  return (
    <div id="password-strength" className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
          Password strength
        </span>
        <span
          className={cn('text-xs font-medium', LABEL_TONES[toneIndex])}
          role="status"
          aria-live="polite"
        >
          {assessment.label}
        </span>
      </div>

      <div
        className="grid grid-cols-4 gap-1"
        role="meter"
        aria-label="Password strength"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={assessment.score}
        aria-valuetext={`${assessment.label} (${assessment.score} of 4)`}
      >
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={cn(
              'h-1.5 rounded-full transition-colors',
              index < assessment.score ? BAR_TONES[toneIndex] : 'bg-line',
            )}
          />
        ))}
      </div>

      <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {assessment.checks.map((check) => (
          <li
            key={check.id}
            className={cn(
              'flex items-start gap-1.5 text-[11px] leading-4',
              check.met ? 'text-success' : 'text-muted',
            )}
          >
            {check.met ? (
              <Check className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
            ) : (
              <Circle className="mt-px h-3 w-3 shrink-0 text-line" aria-hidden="true" />
            )}
            <span>
              <span className="sr-only">{check.met ? 'Met: ' : 'Not met: '}</span>
              {check.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
