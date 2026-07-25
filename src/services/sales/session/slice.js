import {createSlice} from '@reduxjs/toolkit';

const defineInitialState = () => ({
  hasSession: false,
  activeSyncId: null,
  offlineStartResult: null,
});

const sessionSlice = createSlice({
  name: 'salesSession',
  initialState: defineInitialState(),
  reducers: {
    checkSession: state => {
      state.hasSession = true;
    },
    invalidateSession: state => {
      state.hasSession = false;
    },
    setActiveSyncId: (state, action) => {
      state.activeSyncId = action.payload || null;
    },
    clearActiveSyncId: state => {
      state.activeSyncId = null;
    },
    setOfflineStartResult: (state, action) => {
      state.offlineStartResult = action.payload || null;
    },
    clearOfflineStartResult: state => {
      state.offlineStartResult = null;
    },
  },
});

export const {
  checkSession,
  invalidateSession,
  setActiveSyncId,
  clearActiveSyncId,
  setOfflineStartResult,
  clearOfflineStartResult,
} = sessionSlice.actions;
export const sessionReducer = sessionSlice.reducer;
