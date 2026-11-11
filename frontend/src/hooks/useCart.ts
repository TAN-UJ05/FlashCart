import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as cartService from '../services/cart.service';
import { useAuth } from '../stores/auth.store';
import { useToast } from '../stores/toast.store';
import { extractErrorMessage } from '../utils/format';

export const CART_QUERY_KEY = ['cart'] as const;

export function useCart() {
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const userCartKey = [...CART_QUERY_KEY, user?.id ?? 'anon'] as const;

  const cartQuery = useQuery({
    queryKey: userCartKey,
    queryFn: async () => {
      const res = await cartService.getCart();
      return res.data;
    },
    enabled: isAuthenticated,
  });

  const addItemMutation = useMutation({
    mutationFn: ({ productId, quantity }: { productId: string; quantity?: number }) =>
      cartService.addItem(productId, quantity ?? 1),
    onSuccess: (res) => {
      queryClient.setQueryData(userCartKey, res.data);
      toast({
        title: 'Added to cart',
        description: 'Item has been added to your shopping cart.',
        variant: 'success',
      });
    },
    onError: (err) => {
      toast({
        title: 'Failed to add item',
        description: extractErrorMessage(err),
        variant: 'error',
      });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ productId, quantity }: { productId: string; quantity: number }) =>
      cartService.updateItem(productId, quantity),
    onSuccess: (res) => {
      queryClient.setQueryData(userCartKey, res.data);
    },
    onError: (err) => {
      toast({
        title: 'Could not update quantity',
        description: extractErrorMessage(err),
        variant: 'error',
      });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: (productId: string) => cartService.removeItem(productId),
    onSuccess: (res) => {
      queryClient.setQueryData(userCartKey, res.data);
      toast({
        title: 'Item removed',
        variant: 'info',
      });
    },
    onError: (err) => {
      toast({
        title: 'Could not remove item',
        description: extractErrorMessage(err),
        variant: 'error',
      });
    },
  });

  const clearCartMutation = useMutation({
    mutationFn: () => cartService.clearCart(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
  });

  const totalItems =
    cartQuery.data?.totalItems ??
    cartQuery.data?.items?.reduce((acc, item) => acc + item.quantity, 0) ??
    0;

  return {
    cart: cartQuery.data,
    isLoading: cartQuery.isLoading,
    isError: cartQuery.isError,
    refetch: cartQuery.refetch,
    totalItems,
    addItem: addItemMutation.mutateAsync,
    isAdding: addItemMutation.isPending,
    updateItem: updateItemMutation.mutateAsync,
    isUpdating: updateItemMutation.isPending,
    removeItem: removeItemMutation.mutateAsync,
    isRemoving: removeItemMutation.isPending,
    clearCart: clearCartMutation.mutateAsync,
  };
}
