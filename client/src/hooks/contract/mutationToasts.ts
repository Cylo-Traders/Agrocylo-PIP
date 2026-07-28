import { useToast } from '../../context/ToastContext';
import { toUserFacingError } from '../../lib/soroban/userFacingError';

/**
 * Shared success/failure toast helpers for contract write mutations.
 * Call from mutation `onSuccess` / `onError` so every write action surfaces
 * consistent feedback without duplicating toast copy in each form.
 */
export function useMutationToasts(labels: { success: string; error: string }) {
  const toast = useToast();

  return {
    notifySuccess: (description?: string) => {
      toast.success(labels.success, description);
    },
    notifyError: (err: unknown) => {
      toast.error(labels.error, toUserFacingError(err));
    },
  };
}
