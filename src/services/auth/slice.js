import { createSlice } from '@reduxjs/toolkit';

const defineInitialState = () => ({
  isAuthenticated: false,
  session: null,
});

const authSlice = createSlice({
  name: 'auth',
  initialState: defineInitialState(),
  reducers: {
    login: (state, action) => {
      state.session = action.payload;
      state.isAuthenticated = true;
    },
    logout: state => {
      state.session = null;
      state.isAuthenticated = false;
    },
    session: (state, action) => {
      state.session = action.payload;
    },
  },
});

export const { login, logout, session } = authSlice.actions;
export const authReducer = authSlice.reducer;
