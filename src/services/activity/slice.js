import { createSlice } from '@reduxjs/toolkit';
import * as Action from './action';

const defineInitialState = () => ({
  services: {
    default: false,
  },
  processing: false,
});

const activitySlice = createSlice({
  name: 'Activity',
  initialState: defineInitialState(),
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(Action.$reset, () => {
        return defineInitialState();
      })
      .addCase(Action.$processing, (state, action) => {
        state.services = {
          ...state.services,
          [action.payload]: true,
        };
        state.processing = Object.values(state.services).reduce((acc, v) => acc || v, false);
      })
      .addCase(Action.$done, (state, action) => {
        state.services = {
          ...state.services,
          [action.payload]: false,
        };
        state.processing = Object.values(state.services).reduce((acc, v) => acc || v, false);
      });
  },
});

export const activityReducer = activitySlice.reducer;
