import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisterPage } from './RegisterPage';

const { registerMock } = vi.hoisted(() => ({ registerMock: vi.fn() }));

vi.mock('./AuthProvider', () => ({
  useAuth: () => ({
    register: registerMock,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    user: null,
    workplaces: [],
    loading: false,
  }),
}));

type FetchMock = ReturnType<typeof vi.fn>;

let fetchMock: FetchMock;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

function renderPage() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  registerMock.mockReset();

  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost');
    const username = url.searchParams.get('username');
    const email = url.searchParams.get('email');

    return jsonResponse({
      ...(username
        ? {
            username: {
              available: username !== 'takenname',
              message: username === 'takenname' ? 'That username is already taken.' : null,
            },
          }
        : {}),
      ...(email
        ? {
            email: {
              available: email !== 'taken@example.com',
              message: email === 'taken@example.com' ? 'That email is already registered.' : null,
            },
          }
        : {}),
    });
  });

  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RegisterPage', () => {
  it('normalizes spaces and uppercase in the username field', async () => {
    const user = userEvent.setup();
    renderPage();

    const username = screen.getByLabelText('Username');
    await user.type(username, 'Gema Saputra');

    expect(username).toHaveValue('gemasaputra');
  });

  it('shows password strength and the unmet requirements', async () => {
    const user = userEvent.setup();
    renderPage();

    const password = screen.getByLabelText('Password');
    await user.type(password, 'password');
    expect(await screen.findByText('Weak')).toBeInTheDocument();

    await user.clear(password);
    await user.type(password, 'Kanban!Passw0rd');

    expect(await screen.findByText('Very strong')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Password strength' })).toHaveAttribute(
      'aria-valuenow',
      '4',
    );
  });

  it('blocks mismatched confirmation passwords', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Username'), 'validname');
    await user.type(screen.getByLabelText('Email'), 'valid@example.com');
    await user.type(screen.getByLabelText('Password'), 'Kanban!Passw0rd');
    await user.type(screen.getByLabelText('Confirm password'), 'Kanban!Passw0rD');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('warns when a username is taken and disables submission', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Username'), 'takenname');

    expect(
      await screen.findByText('That username is already taken.', {}, { timeout: 2500 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled();
  });

  it('confirms a free username', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Username'), 'freename');

    expect(await screen.findByText('Available', {}, { timeout: 2500 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeEnabled();
  });
});
