import { AlertCircle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import type { AvailabilityState } from './useAvailability';

interface AvailabilityHintProps {
  id: string;
  state: AvailabilityState;
  idle: string;
}

export function AvailabilityHint({ id, state, idle }: AvailabilityHintProps) {
  if (state.status === 'checking') {
    return (
      <p id={id} className="flex items-center gap-1.5 text-xs text-muted" role="status">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Checking availability…
      </p>
    );
  }

  if (state.status === 'available') {
    return (
      <p
        id={id}
        className="flex items-center gap-1.5 text-xs font-medium text-success"
        role="status"
      >
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Available
      </p>
    );
  }

  if (state.status === 'taken') {
    return (
      <p id={id} className="flex items-center gap-1.5 text-xs text-danger" role="alert">
        <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {state.message ?? 'That value is already in use.'}
      </p>
    );
  }

  if (state.status === 'error') {
    return (
      <p id={id} className="flex items-center gap-1.5 text-xs text-muted" role="status">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Couldn’t check right now — we’ll verify when you submit.
      </p>
    );
  }

  return (
    <p id={id} className="text-xs text-muted">
      {idle}
    </p>
  );
}
