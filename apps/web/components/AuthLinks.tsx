'use client';

import { useEffect, useState } from 'react';
import { electronProxyClient } from '@better-auth/electron/proxy';
import { authClient } from '../lib/auth/client';

const electronProxy = electronProxyClient({
  protocol: {
    scheme: 'mimic',
  },
});

export function AuthLinks() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    const redirectInterval = electronProxy.getActions().ensureElectronRedirect();

    return () => {
      clearInterval(redirectInterval);
    };
  }, []);

  async function google() {
    setMessage('');

    if (window.requestAuth) {
      try {
        await window.requestAuth({ provider: 'google' });
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : 'Google sign-in failed.',
        );
      }
      return;
    }

    const result = await authClient.signIn.social({
      provider: 'google',
    });

    if (result.error) {
      setMessage(result.error.message ?? 'Google sign-in failed.');
    }
  }

  return (
    <div className="auth-stack">
      <button onClick={google}>Continue with Google</button>

      {message && <small>{message}</small>}
    </div>
  );
}
