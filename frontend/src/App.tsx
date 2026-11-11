import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './stores/auth.store';
import { ToastProvider } from './stores/toast.store';
import Router from './router';
import { Toaster } from './components/ui/Toast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <Router />
          <Toaster />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
