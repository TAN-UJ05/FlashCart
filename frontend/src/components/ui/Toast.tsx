import * as ToastPrimitive from '@radix-ui/react-toast';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToast, type ToastVariant } from '../../stores/toast.store';
import { cn } from '../../utils/cn';

const variantStyles: Record<ToastVariant, string> = {
  success: 'border-emerald-200/90 bg-white text-slate-900 shadow-elevated [&>svg]:text-emerald-600',
  error: 'border-rose-200/90 bg-white text-slate-900 shadow-elevated [&>svg]:text-rose-600',
  warning: 'border-amber-200/90 bg-white text-slate-900 shadow-elevated [&>svg]:text-amber-600',
  info: 'border-sky-200/90 bg-white text-slate-900 shadow-elevated [&>svg]:text-sky-600',
};

const variantIcons: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {toasts.map((item) => {
        const Icon = variantIcons[item.variant];
        return (
          <ToastPrimitive.Root
            key={item.id}
            open
            onOpenChange={(open) => {
              if (!open) dismiss(item.id);
            }}
            className={cn(
              'flex items-start gap-3 rounded-2xl border p-4 backdrop-blur-lg transition-all animate-fade-in-up',
              variantStyles[item.variant]
            )}
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex-1 min-w-0">
              <ToastPrimitive.Title className="text-sm font-semibold">
                {item.title}
              </ToastPrimitive.Title>
              {item.description && (
                <ToastPrimitive.Description className="mt-0.5 text-xs text-slate-500">
                  {item.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close
              aria-label="Close"
              onClick={() => dismiss(item.id)}
              className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        );
      })}
      <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[100] flex max-w-sm flex-col gap-2 outline-none" />
    </ToastPrimitive.Provider>
  );
}
