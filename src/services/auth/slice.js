import { createSlice } from '@reduxjs/toolkit';

const defineInitialState = () => ({
  isAuthenticated: false,
  token: null,
  session: null,
});

const authSlice = createSlice({
  name: 'auth',
  initialState: defineInitialState(),
  reducers: {
    login: (state, action) => {
      state.token = action.payload.access_token;
      state.session = action.payload.user;
      state.isAuthenticated = true;
    },
    logout: state => {
      state.token = null;
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
