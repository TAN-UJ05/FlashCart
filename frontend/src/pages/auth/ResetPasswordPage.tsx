import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock } from 'lucide-react';
import * as authService from '../../services/auth.service';
import { useToast } from '../../stores/toast.store';
import { extractErrorMessage } from '../../utils/format';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';

const resetSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetFormValues = z.infer<typeof resetSchema>;

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [serverError, setServerError] = useState<string | null>(null);

  const tokenFromUrl = searchParams.get('token') ?? '';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { token: tokenFromUrl },
  });

  const onSubmit = async (values: ResetFormValues) => {
    setServerError(null);
    try {
      await authService.resetPassword(values.token, values.newPassword);
      toast({
        title: 'Password updated',
        description: 'You can now sign in with your new password.',
        variant: 'success',
      });
      navigate('/login');
    } catch (err) {
      setServerError(extractErrorMessage(err, 'Failed to reset password'));
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-12 animate-fade-in-up">
      <Card className="w-full shadow-soft">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-xl">Set new password</CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            Choose a strong password for your FlashCart account
          </p>
        </CardHeader>
        <CardContent>
          {serverError && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
              {serverError}
            </div>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {!tokenFromUrl && (
              <Input
                label="Reset Token"
                placeholder="Paste your reset token"
                error={errors.token?.message}
                {...register('token')}
              />
            )}
            <Input
              label="New Password"
              type="password"
              placeholder="Minimum 8 characters"
              leftIcon={<Lock className="h-4 w-4" />}
              error={errors.newPassword?.message}
              {...register('newPassword')}
            />
            <Input
              label="Confirm Password"
              type="password"
              placeholder="Repeat new password"
              leftIcon={<Lock className="h-4 w-4" />}
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
            <Button type="submit" className="w-full" isLoading={isSubmitting}>
              Reset Password
            </Button>
            <p className="text-center text-sm text-slate-600">
              <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
                Back to Sign In
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
