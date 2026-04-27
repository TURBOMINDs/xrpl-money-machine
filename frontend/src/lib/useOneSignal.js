import { useEffect, useRef, useState, useCallback } from 'react';
import { notifApi } from '@/lib/api';

const APP_ID = 'aeda621f-69bd-49ca-94c2-7692e20fdfe0';

/**
 * useOneSignal — initialize the OneSignal Web SDK v16 (deferred), expose
 * subscription state, and sync the player_id to the backend on changes.
 *
 *   const { ready, optedIn, subscriptionId, requestPermission, openPrompt } = useOneSignal({ user });
 *
 * The hook is safe to call before the SDK script loads; it queues into
 * window.OneSignalDeferred and resolves once OneSignal is available.
 */
export function useOneSignal({ user, autoLoginExternalId = true } = {}) {
  const [ready, setReady] = useState(false);
  const [optedIn, setOptedIn] = useState(false);
  const [subscriptionId, setSubscriptionId] = useState(null);
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  );
  const initOnceRef = useRef(false);
  const lastSyncedIdRef = useRef(null);

  // Initialize SDK
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (initOnceRef.current) return;
    initOnceRef.current = true;
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.init({
          appId: APP_ID,
          serviceWorkerPath: '/OneSignalSDKWorker.js',
          serviceWorkerParam: { scope: '/' },
          allowLocalhostAsSecureOrigin: true,
          notifyButton: { enable: false },
        });
        setReady(true);
        // Initial state
        try {
          setOptedIn(!!OneSignal.User?.PushSubscription?.optedIn);
          setSubscriptionId(OneSignal.User?.PushSubscription?.id || null);
        } catch {}
        // Listen for changes
        try {
          OneSignal.User?.PushSubscription?.addEventListener('change', (event) => {
            const cur = event.current || {};
            setOptedIn(!!cur.optedIn);
            setSubscriptionId(cur.id || null);
          });
        } catch {}
        // Native permission tracking
        if (typeof Notification !== 'undefined') {
          setPermission(Notification.permission);
        }
      } catch (e) {
        // SDK may already be initialized in dev hot-reload — silent
         
        console.debug('[OneSignal] init error:', e?.message || e);
      }
    });
  }, []);

  // Login (link external_id) once we know the user
  useEffect(() => {
    if (!ready || !user?.id || !autoLoginExternalId) return;
    if (typeof window === 'undefined') return;
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        if (OneSignal.login) await OneSignal.login(String(user.id));
      } catch (e) {
         
        console.debug('[OneSignal] login error:', e?.message || e);
      }
    });
  }, [ready, user?.id, autoLoginExternalId]);

  // Sync subscription_id to backend when it changes
  useEffect(() => {
    if (!subscriptionId || !user) return;
    if (lastSyncedIdRef.current === subscriptionId) return;
    lastSyncedIdRef.current = subscriptionId;
    notifApi.subscribe(subscriptionId).catch(() => {
      // not fatal
      lastSyncedIdRef.current = null;
    });
  }, [subscriptionId, user]);

  const requestPermission = useCallback(async () => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') return resolve(false);
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (OneSignal) => {
        try {
          await OneSignal.User.PushSubscription.optIn();
          if (typeof Notification !== 'undefined') {
            setPermission(Notification.permission);
          }
          setOptedIn(!!OneSignal.User?.PushSubscription?.optedIn);
          resolve(true);
        } catch (e) {
           
          console.debug('[OneSignal] optIn error:', e?.message || e);
          resolve(false);
        }
      });
    });
  }, []);

  const openPrompt = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        if (OneSignal.Slidedown?.promptPush) {
          await OneSignal.Slidedown.promptPush({ force: true });
        } else {
          await OneSignal.User.PushSubscription.optIn();
        }
      } catch (e) {
         
        console.debug('[OneSignal] promptPush error:', e?.message || e);
      }
    });
  }, []);

  const optOut = useCallback(async () => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') return resolve(false);
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (OneSignal) => {
        try {
          await OneSignal.User.PushSubscription.optOut();
          setOptedIn(false);
          resolve(true);
        } catch (e) {
          resolve(false);
        }
      });
    });
  }, []);

  return {
    ready,
    optedIn,
    subscriptionId,
    permission,
    requestPermission,
    openPrompt,
    optOut,
    appId: APP_ID,
  };
}
