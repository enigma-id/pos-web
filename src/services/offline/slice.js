import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  wasOffline: false,
  isSyncing: false,
  pendingCount: 0,
  failedCount: 0,
  warning: null,
  error: null,
  lastSyncTime: null,
  apiReachable: true,
  sessionSummary: null,
  offlineSessionEnded: false,
};

const offlineSlice = createSlice({
  name: 'Offline',
  initialState,
  reducers: {
    setNetworkState: (state, action) => {
      const { isOnline, wasOffline = false } = action.payload || {};
      if (typeof isOnline === 'boolean') {
        state.isOnline = isOnline;
      }
      state.wasOffline = !!wasOffline;
    },
    setSyncing: (state, action) => {
      state.isSyncing = !!action.payload;
    },
    setPendingCount: (state, action) => {
      state.pendingCount = Number(action.payload || 0);
    },
    setFailedCount: (state, action) => {
      state.failedCount = Number(action.payload || 0);
    },
    setWarning: (state, action) => {
      state.warning = action.payload || null;
    },
    clearWarning: state => {
      state.warning = null;
    },
    setOfflineError: (state, action) => {
      state.error = action.payload || null;
    },
    clearOfflineError: state => {
      state.error = null;
    },
    setLastSyncTime: (state, action) => {
      state.lastSyncTime = action.payload || null;
    },
    setApiReachable: (state, action) => {
      state.apiReachable = !!action.payload;
    },
    setSessionSummary: (state, action) => {
      state.sessionSummary = action.payload || null;
    },
    clearSessionSummary: state => {
      state.sessionSummary = null;
    },
setOfflineSessionEnded: (state, action) => {
      state.offlineSessionEnded = !!action.payload;
    },
    clearOfflineSessionEnded: state => {
      state.offlineSessionEnded = false;
    },
    resetOfflineState: () => initialState,
  },
});

export const {
  setNetworkState,
  setSyncing,
  setPendingCount,
  setFailedCount,
  setWarning,
  clearWarning,
  setOfflineError,
  clearOfflineError,
  setLastSyncTime,
  setApiReachable,
  setSessionSummary,
  clearSessionSummary,
  setOfflineSessionEnded,
  clearOfflineSessionEnded,
  resetOfflineState,
} = offlineSlice.actions;

export const offlineReducer = offlineSlice.reducer;
