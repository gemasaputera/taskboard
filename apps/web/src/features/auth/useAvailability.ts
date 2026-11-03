import { emailSchema, usernameSchema } from '@kanban/shared';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api';

export type AvailabilityStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error';

export interface AvailabilityState {
  status: AvailabilityStatus;
  message: string | null;
}

const DEBOUNCE_MS = 450;

const IDLE: AvailabilityState = { status: 'idle', message: null };

/**
 * Debounced uniqueness check for one sign-up field. Invalid values are left to
 * the form resolver, and a failed check never blocks submission — the register
 * endpoint still enforces uniqueness.
 */
export function useAvailability(field: 'username' | 'email', value: string): AvailabilityState {
  const [state, setState] = useState<AvailabilityState>(IDLE);
  const lastChecked = useRef<string>('');
  const sequence = useRef(0);

  useEffect(() => {
    const schema = field === 'username' ? usernameSchema : emailSchema;
    const parsed = schema.safeParse(value);

    if (!parsed.success) {
      lastChecked.current = '';
      setState(IDLE);
      return;
    }

    const candidate = parsed.data;
    if (lastChecked.current === candidate) return;

    const requestId = ++sequence.current;
    const controller = new AbortController();

    const timer = window.setTimeout(() => {
      setState({ status: 'checking', message: null });

      const input = field === 'username' ? { username: candidate } : { email: candidate };

      api
        .checkAvailability(input, controller.signal)
        .then((response) => {
          if (requestId !== sequence.current) return;

          const result = field === 'username' ? response.username : response.email;
          if (!result) return;

          lastChecked.current = candidate;
          setState({
            status: result.available ? 'available' : 'taken',
            message: result.message,
          });
        })
        .catch((error: unknown) => {
          if (requestId !== sequence.current || controller.signal.aborted) return;

          setState({
            status: 'error',
            message:
              error instanceof ApiError ? error.message : 'Could not check availability right now.',
          });
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [field, value]);

  return state;
}
