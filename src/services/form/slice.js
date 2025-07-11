import { createSlice } from '@reduxjs/toolkit';

import * as Action from './action';

const defineInitialState = () => ({
  errors: {},
  success: false,
  loading: false,
});

const formSlice = createSlice({
  name: 'Form',
  initialState: defineInitialState(),
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(Action.$reset, () => {
        return defineInitialState();
      })
      .addCase(Action.$failureAction, (state, action) => {
        state.errors = action.payload?.data?.errors;
        state.success = false;
        state.loading = false;
      })
      .addCase(Action.$success, state => {
        state.errors = {};
        state.success = true;
        state.loading = false;
      })
      .addCase(Action.$requesting, state => {
        state.errors = {};
        state.success = false;
        state.loading = true;
      });
  },
});

export const formReducer = formSlice.reducer;
