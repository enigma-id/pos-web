// services/sales/session/hook.js
import { useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';

import {
  useStartMutation,
  useEndMutation,
  useUpdateDeviceMutation,
  useLazySummaryQuery,
  useLazySessionQuery,
  useLazyShowSessionQuery,
} from './action';
import { checkSession, invalidateSession } from './slice';
import { resetCart } from '../../cart/slice';
import useCatalog from '../../catalog/hooks';
import { $failure } from '../../form/action';

const getDeviceInfo = async () => {
  const info = {};

  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 300000,
      });
    });
    info.latitude = pos.coords.latitude;
    info.longitude = pos.coords.longitude;
  } catch (e) {
    // Geolocation unavailable or permission denied
    console.log(e);
  }

  try {
    const battery = await navigator.getBattery();
    info.battery_level = `${Math.round(battery.level * 100)}`;
  } catch (e) {
    // Battery API unavailable
    console.log(e);
  }

  return info;
};

// Module-level ref so external modules can stop tracking (e.g. on logout)
export const trackingRef = { current: null };

export const stopDeviceTrackingGlobal = () => {
  if (trackingRef.current) {
    clearInterval(trackingRef.current);
    trackingRef.current = null;
  }
};

const useSession = () => {
  const dispatch = useDispatch();

  const [startMutation, startResult] = useStartMutation();
  const [endMutation, endResult] = useEndMutation();
  const [updateDeviceMutation, updateDeviceResult] = useUpdateDeviceMutation();

  const [triggerSummary, summaryResult] = useLazySummaryQuery();
  const [triggerSession, sessionResult] = useLazySessionQuery();
  const [triggerShow, showResult] = useLazyShowSessionQuery();

  const { refreshCatalog } = useCatalog();

  const sendDeviceData = useCallback(async () => {
    const deviceInfo = await getDeviceInfo();
    if (deviceInfo.latitude != null || deviceInfo.battery_level != null) {
      try {
        await updateDeviceMutation(deviceInfo).unwrap();
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('Device update error:', err);
        }
      }
    }
  }, [updateDeviceMutation]);

  const start = async data => {
    try {
      const deviceInfo = await getDeviceInfo();
      const res = await startMutation({ ...data, ...deviceInfo }).unwrap();
      if (res?.message === 'success') {
        refreshCatalog();
        dispatch(resetCart());

        if (res?.data?.is_offline_session) {
          dispatch(checkSession());
        } else {
          summary();
        }
      }
    } catch (err) {
      dispatch($failure(err));
    }
  };

  const startDeviceTracking = useCallback(
    (intervalMs = 300000) => {
      stopDeviceTracking();
      trackingRef.current = setInterval(() => {
        sendDeviceData();
      }, intervalMs);
    },
    [sendDeviceData]
  );

  const stopDeviceTracking = useCallback(() => {
    if (trackingRef.current) {
      clearInterval(trackingRef.current);
      trackingRef.current = null;
    }
  }, []);

  const end = async data => {
    stopDeviceTracking();
    try {
      const res = await endMutation(data).unwrap();

      if (res?.message === 'success') {
        refreshCatalog();
        dispatch(resetCart());
      }
    } catch (err) {
      dispatch($failure(err));
    }
  };

  const summary = async () => {
    try {
      const res = await triggerSummary().unwrap();
      if (res?.data) {
        dispatch(checkSession());
      } else {
        dispatch(invalidateSession());
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('error:', err);
      }
    }
  };

  const session = async (params = {}) => {
    try {
      await triggerSession(params).unwrap();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('error:', error);
      }
    }
  };

  const show = async id => {
    try {
      await triggerShow({ id }).unwrap();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('error:', error);
      }
    }
  };

  return {
    start,
    startResult,
    end,
    endResult,
    summary,
    summaryResult,
    session,
    sessionResult,
    show,
    showResult,
    sendDeviceData,
    startDeviceTracking,
    stopDeviceTracking,
    updateDeviceResult,
  };
};

export default useSession;
