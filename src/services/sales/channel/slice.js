import { createSlice } from '@reduxjs/toolkit';

const defineInitialState = () => ({
  selectedChannel: null,
});

const salesChannelSlice = createSlice({
  name: 'salesChannel',
  initialState: defineInitialState(),
  reducers: {
    setSelectedChannel: (state, action) => {
      state.selectedChannel = action.payload;
    },
    clearSelectedChannel: state => {
      state.selectedChannel = null;
    },
  },
});

export const { setSelectedChannel, clearSelectedChannel } = salesChannelSlice.actions;
export const channelReducer = salesChannelSlice.reducer;
