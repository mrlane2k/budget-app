'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getErrorMessage } from '@/lib/client/errors';
import { getSettings, getVaultStatus } from '@/lib/client/user-client';

function shouldRedirectToLogin(message: string): boolean {
  return (
    message === 'Unauthorized' ||
    message === 'Current password is incorrect' ||
    message.startsWith('Vault is locked.')
  );
}

export function useProtectedRoute() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function verifySession() {
      try {
        const vaultStatus = await getVaultStatus();
        if (cancelled) return;

        if (vaultStatus.setupRequired) {
          router.replace('/setup');
          return;
        }

        if (vaultStatus.passphraseEnabled && !vaultStatus.unlocked) {
          router.replace('/login');
          return;
        }

        await getSettings();
        if (cancelled) return;

        setAuthError('');
        setCheckingAuth(false);
      } catch (error) {
        if (cancelled) return;

        const message = getErrorMessage(error, 'Unable to verify your session.');
        if (shouldRedirectToLogin(message)) {
          router.replace('/login');
          return;
        }

        setAuthError(message);
        setCheckingAuth(false);
      }
    }

    void verifySession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return { checkingAuth, authError };
}
