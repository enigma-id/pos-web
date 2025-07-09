import {createSlice} from '@reduxjs/toolkit';

const defineInitialState = () => ({
  hasSession: false,
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
  },
});

export const {checkSession, invalidateSession} = sessionSlice.actions;
export const sessionReducer = sessionSlice.reducer;
