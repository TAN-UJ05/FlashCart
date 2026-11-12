import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MapPin, Plus, Trash2, User as UserIcon, Edit2, Shield } from 'lucide-react';
import * as userService from '../../services/user.service';
import type { Address } from '../../types';
import { useAuth } from '../../stores/auth.store';
import { useToast } from '../../stores/toast.store';
import { extractErrorMessage } from '../../utils/format';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
});

const addressSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(200),
  phone: z.string().max(20).optional(),
  addressLine1: z.string().min(1, 'Address line 1 is required').max(255),
  addressLine2: z.string().max(255).optional(),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().min(1, 'State is required').max(100),
  postalCode: z.string().min(1, 'Postal code is required').max(20),
  country: z.string().min(1, 'Country is required').max(100),
  isDefault: z.boolean().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type AddressFormValues = z.infer<typeof addressSchema>;

export default function ProfilePage() {
  const { user, isAdmin, setUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  const profileValues = useMemo<ProfileFormValues | undefined>(
    () =>
      user
        ? {
            firstName: user.firstName,
            lastName: user.lastName ?? '',
            phone: user.phone ?? '',
          }
        : undefined,
    [user]
  );

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
    },
    values: profileValues,
    resetOptions: {
      keepDirtyValues: true,
    },
  });

  const addressForm = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: { country: 'India', isDefault: false },
  });

  const addressesQuery = useQuery({
    queryKey: ['addresses', user?.id ?? 'anon'],
    queryFn: async () => {
      const res = await userService.getAddresses();
      return res.data;
    },
    enabled: !!user?.id && !isAdmin,
  });

  const updateProfileMutation = useMutation({
    mutationFn: (values: ProfileFormValues) => userService.updateProfile(values),
    onSuccess: (res) => {
      setUser(res.data);
      toast({ title: 'Profile updated', variant: 'success' });
    },
    onError: (err) => {
      toast({ title: 'Update failed', description: extractErrorMessage(err), variant: 'error' });
    },
  });

  const saveAddressMutation = useMutation({
    mutationFn: (values: AddressFormValues) =>
      editingAddress
        ? userService.updateAddress(editingAddress.id, values)
        : userService.createAddress(values),
    onSuccess: () => {
      setAddressModalOpen(false);
      setEditingAddress(null);
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      toast({
        title: editingAddress ? 'Address updated' : 'Address added',
        variant: 'success',
      });
    },
    onError: (err) => {
      toast({ title: 'Could not save address', description: extractErrorMessage(err), variant: 'error' });
    },
  });

  const deleteAddressMutation = useMutation({
    mutationFn: (id: string) => userService.deleteAddress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      toast({ title: 'Address deleted', variant: 'info' });
    },
    onError: (err) => {
      toast({ title: 'Delete failed', description: extractErrorMessage(err), variant: 'error' });
    },
  });

  const openNewAddressModal = () => {
    setEditingAddress(null);
    addressForm.reset({
      fullName: '',
      phone: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
      isDefault: false,
    });
    setAddressModalOpen(true);
  };

  const openEditAddressModal = (addr: Address) => {
    setEditingAddress(addr);
    addressForm.reset({
      fullName: addr.fullName,
      phone: addr.phone ?? '',
      addressLine1: addr.addressLine1,
      addressLine2: addr.addressLine2 ?? '',
      city: addr.city,
      state: addr.state,
      postalCode: addr.postalCode,
      country: addr.country,
      isDefault: addr.isDefault,
    });
    setAddressModalOpen(true);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-fade-in-up">
      <div>
        <h1 className="font-display text-3xl font-bold text-slate-900">Account Settings</h1>
        <p className="mt-1 text-sm text-slate-500">{user?.email}</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-primary-600" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={profileForm.handleSubmit((v) => updateProfileMutation.mutate(v))}
              className="space-y-4"
            >
              <Input
                label="First Name"
                error={profileForm.formState.errors.firstName?.message}
                {...profileForm.register('firstName')}
              />
              <Input
                label="Last Name"
                error={profileForm.formState.errors.lastName?.message}
                {...profileForm.register('lastName')}
              />
              <Input
                label="Phone"
                error={profileForm.formState.errors.phone?.message}
                {...profileForm.register('phone')}
              />
              <Button type="submit" isLoading={updateProfileMutation.isPending}>
                Save Changes
              </Button>
            </form>
          </CardContent>
        </Card>

        {isAdmin ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary-600" />
                Administrator Workspace
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed text-slate-600">
                Your account has <strong className="text-slate-900">ADMIN</strong> permissions. Manage products, categories, flash drops, stock levels, customer accounts, and fulfillment from the admin console.
              </p>
              <Link to="/admin" className="inline-block">
                <Button>Open Admin Console</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary-600" />
                Saved Addresses
              </CardTitle>
              <Button size="sm" onClick={openNewAddressModal}>
                <Plus className="h-4 w-4" />
                Add Address
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {(addressesQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">No saved addresses yet.</p>
              ) : (
                (addressesQuery.data ?? []).map((addr) => (
                  <div
                    key={addr.id}
                    className="flex items-start justify-between rounded-xl border border-slate-200/80 p-4 transition-colors hover:border-slate-300"
                  >
                    <div className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{addr.fullName}</span>
                        {addr.isDefault && <Badge variant="primary">Default</Badge>}
                      </div>
                      <p className="mt-1 text-slate-600">{addr.addressLine1}</p>
                      <p className="text-slate-600">
                        {addr.city}, {addr.state} {addr.postalCode}
                      </p>
                      <p className="text-slate-500">{addr.country}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => openEditAddressModal(addr)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                        aria-label="Edit address"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteAddressMutation.mutate(addr.id)}
                        className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                        aria-label="Delete address"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {!isAdmin && (
        <Modal
          isOpen={addressModalOpen}
          onClose={() => setAddressModalOpen(false)}
          title={editingAddress ? 'Edit Address' : 'Add New Address'}
        >
          <form
            onSubmit={addressForm.handleSubmit((v) => saveAddressMutation.mutate(v))}
            className="space-y-3"
          >
            <Input
              label="Full Name"
              error={addressForm.formState.errors.fullName?.message}
              {...addressForm.register('fullName')}
            />
            <Input
              label="Phone"
              error={addressForm.formState.errors.phone?.message}
              {...addressForm.register('phone')}
            />
            <Input
              label="Address Line 1"
              error={addressForm.formState.errors.addressLine1?.message}
              {...addressForm.register('addressLine1')}
            />
            <Input
              label="Address Line 2 (Optional)"
              {...addressForm.register('addressLine2')}
            />
            <div className="grid grid-cols-3 gap-2">
              <Input
                label="City"
                error={addressForm.formState.errors.city?.message}
                {...addressForm.register('city')}
              />
              <Input
                label="State"
                error={addressForm.formState.errors.state?.message}
                {...addressForm.register('state')}
              />
              <Input
                label="Postal Code"
                error={addressForm.formState.errors.postalCode?.message}
                {...addressForm.register('postalCode')}
              />
            </div>
            <Input
              label="Country"
              error={addressForm.formState.errors.country?.message}
              {...addressForm.register('country')}
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" {...addressForm.register('isDefault')} />
              Set as default shipping address
            </label>
            <div className="flex justify-end gap-2 pt-3">
              <Button variant="outline" onClick={() => setAddressModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={saveAddressMutation.isPending}>
                Save Address
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
