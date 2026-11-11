import type { ReactElement } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import { ToastProvider } from '../stores/toast.store';
import * as authStore from '../stores/auth.store';

function renderWithProviders(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe('Auth Pages', () => {
  const mockLogin = vi.fn();
  const mockRegister = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(authStore, 'useAuth').mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      isAdmin: false,
      login: mockLogin,
      register: mockRegister,
      logout: vi.fn(),
      refreshAuth: vi.fn(),
      setUser: vi.fn(),
    });
  });

  it('shows validation errors on empty login submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('submits valid login credentials', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({
      id: 'u1',
      email: 'customer@flashcart.com',
      firstName: 'Customer',
      role: 'CUSTOMER',
      enabled: true,
      createdAt: '',
    });

    renderWithProviders(<LoginPage />);

    await user.type(screen.getByPlaceholderText('you@example.com'), 'customer@flashcart.com');
    await user.type(screen.getByPlaceholderText('Enter your password'), 'Customer@123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('customer@flashcart.com', 'Customer@123');
    });
  });

  it('validates matching passwords on register page', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    await user.type(screen.getByPlaceholderText('Jane'), 'Jane');
    await user.type(screen.getByPlaceholderText('jane@example.com'), 'jane@example.com');
    await user.type(screen.getByPlaceholderText('Minimum 8 characters'), 'Password@123');
    await user.type(screen.getByPlaceholderText('Repeat password'), 'Different@123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
    expect(mockRegister).not.toHaveBeenCalled();
  });
});
