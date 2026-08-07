import { createSlice } from '@reduxjs/toolkit';

const defineInitialState = () => ({
  hasSession: false,
  sessionSummary: {
    summary: {
      sales: {
        outstanding_bill: 0,
      },
    },
  },
});

const sessionSlice = createSlice({
  name: 'salesSession',
  initialState: defineInitialState(),
  reducers: {
    resetSummary: () => defineInitialState(),

    setSummary: (state, action) => {
      state.hasSession = action.payload === null ? false : true;
      state.sessionSummary = action.payload;
    },
    updateSummary: (state, action) => {
      state.sessionSummary = action.payload;
    },
  },
});

export const { setSummary, updateSummary, resetSummary } = sessionSlice.actions;

export const sessionReducer = sessionSlice.reducer;
