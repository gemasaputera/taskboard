import { REALTIME_EVENTS, type MeResponse, type RealtimePayload, type UserSummary, type WorkplaceSummary } from '@kanban/shared';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError, type LoginInput, type RegisterInput } from '../../lib/api';
import { connectSocket, disconnectSocket } from '../../lib/socket';

interface AuthContextValue {
  user: UserSummary | null;
  workplaces: WorkplaceSummary[];
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<UserSummary | null>(null);
  const [workplaces, setWorkplaces] = useState<WorkplaceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const apply = useCallback((payload: MeResponse) => {
    setUser(payload.user);
    setWorkplaces(payload.workplaces);
  }, []);

  const refresh = useCallback(async () => {
    try {
      apply(await api.getMe());
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
        setWorkplaces([]);
        return;
      }
      console.error('[auth] Could not refresh session', error);
    }
  }, [apply]);

  useEffect(() => {
    let active = true;

    api
      .getMe()
      .then((payload) => {
        if (active) apply(payload);
      })
      .catch(() => {
        if (active) {
          setUser(null);
          setWorkplaces([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [apply]);

  const login = useCallback(
    async (input: LoginInput) => {
      apply(await api.login(input));
      setLoading(false);
    },
    [apply],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      apply(await api.register(input));
      setLoading(false);
    },
    [apply],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      disconnectSocket();
      setUser(null);
      setWorkplaces([]);
      queryClient.clear();
    }
  }, [queryClient]);

  const userId = user?.id;

  useEffect(() => {
    if (!userId) {
      disconnectSocket();
      return;
    }

    const socket = connectSocket();

    const invalidateBoard = (payload: RealtimePayload) => {
      if (payload.workplaceId) {
        void queryClient.invalidateQueries({ queryKey: ['board', payload.workplaceId] });
      }
    };

    const invalidateCard = (payload: RealtimePayload) => {
      if (payload.cardId) {
        void queryClient.invalidateQueries({ queryKey: ['card', payload.cardId] });
      }
    };

    const invalidateCardsAndBoard = (payload: RealtimePayload) => {
      invalidateBoard(payload);
      invalidateCard(payload);
    };

    const invalidateMembers = (payload: RealtimePayload) => {
      if (payload.workplaceId) {
        void queryClient.invalidateQueries({ queryKey: ['members', payload.workplaceId] });
      }
    };

    const handlers: Array<[string, (payload: RealtimePayload) => void]> = [
      [REALTIME_EVENTS.columnCreated, invalidateBoard],
      [REALTIME_EVENTS.columnUpdated, invalidateBoard],
      [REALTIME_EVENTS.columnDeleted, (payload) => {
        invalidateBoard(payload);
        void queryClient.invalidateQueries({ queryKey: ['card'] });
      }],
      [REALTIME_EVENTS.columnsReordered, invalidateBoard],
      [REALTIME_EVENTS.cardCreated, invalidateBoard],
      [REALTIME_EVENTS.cardMoved, invalidateBoard],
      [REALTIME_EVENTS.cardDeleted, invalidateBoard],
      [REALTIME_EVENTS.cardUpdated, invalidateCardsAndBoard],
      [REALTIME_EVENTS.subtaskCreated, invalidateCardsAndBoard],
      [REALTIME_EVENTS.subtaskUpdated, invalidateCardsAndBoard],
      [REALTIME_EVENTS.subtaskDeleted, invalidateCardsAndBoard],
      [REALTIME_EVENTS.commentCreated, invalidateCardsAndBoard],
      [REALTIME_EVENTS.commentUpdated, invalidateCardsAndBoard],
      [REALTIME_EVENTS.commentDeleted, invalidateCardsAndBoard],
      [REALTIME_EVENTS.tagCreated, invalidateBoard],
      [REALTIME_EVENTS.tagUpdated, (payload) => {
        invalidateBoard(payload);
        void queryClient.invalidateQueries({ queryKey: ['card'] });
      }],
      [REALTIME_EVENTS.tagDeleted, (payload) => {
        invalidateBoard(payload);
        void queryClient.invalidateQueries({ queryKey: ['card'] });
      }],
      [REALTIME_EVENTS.memberJoined, (payload) => {
        invalidateMembers(payload);
        void refresh();
      }],
      [REALTIME_EVENTS.memberRemoved, (payload) => {
        invalidateMembers(payload);
        invalidateBoard(payload);
        void queryClient.invalidateQueries({ queryKey: ['card'] });
        void refresh();
      }],
      [REALTIME_EVENTS.workplaceUpdated, (payload) => {
        invalidateBoard(payload);
        void refresh();
      }],
      [REALTIME_EVENTS.invitationReceived, () => {
        void queryClient.invalidateQueries({ queryKey: ['myInvitations'] });
      }],
      [REALTIME_EVENTS.invitationRemoved, () => {
        void queryClient.invalidateQueries({ queryKey: ['myInvitations'] });
      }],
      [REALTIME_EVENTS.invitationResponded, (payload) => {
        if (payload.workplaceId) {
          void queryClient.invalidateQueries({
            queryKey: ['workplaceInvitations', payload.workplaceId],
          });
        }
      }],
    ];

    for (const [event, handler] of handlers) {
      socket.on(event, handler);
    }

    const onConnect = () => {
      void queryClient.invalidateQueries();
      void refresh();
    };
    socket.on('connect', onConnect);

    if (!socket.connected) socket.connect();

    return () => {
      for (const [event, handler] of handlers) {
        socket.off(event, handler);
      }
      socket.off('connect', onConnect);
    };
  }, [userId, queryClient, refresh]);

  return (
    <AuthContext.Provider
      value={{ user, workplaces, loading, login, register, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
