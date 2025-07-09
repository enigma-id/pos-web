import { createSlice } from '@reduxjs/toolkit';
import { $reset } from './action';

const defineInitialState = () => ({
  data: {},
});

const tableSlice = createSlice({
  name: 'table',
  initialState: defineInitialState(),
  reducers: {
    initialized: (state, action) => {
      const { name, config } = action.payload;
      state.data[name] = config;
    },
    setTable: (state, action) => {
      const { name, table } = action.payload;
      state.data[name] = table;
    },
    setPage: (state, action) => {
      const { name, page } = action.payload;
      if (state.data[name]) {
        state.data[name].currentPage = page;
      }
    },
    setLimit: (state, action) => {
      const { name, limit } = action.payload;
      if (state.data[name]) {
        state.data[name].limitPerPage = limit;
        state.data[name].currentPage = 1;
      }
    },
    setSearch: (state, action) => {
      const { name, text } = action.payload;
      if (state.data[name]) {
        state.data[name].textSearch = text;
        state.data[name].currentPage = 1;
      }
    },
    setSorting: (state, action) => {
      const { name, sorting } = action.payload;
      if (state.data[name]) {
        state.data[name].sorting = sorting;
      }
    },
    setFilter: (state, action) => {
      const { name, field, value } = action.payload;
      if (state.data[name]) {
        if (field === 'bulk') {
          state.data[name].filter = value;
        } else {
          state.data[name].filter = {
            ...state.data[name].filter,
            [field]: value,
          };
        }
        state.data[name].currentPage = 1;
      }
    },
  },
  extraReducers: builder => {
    builder.addCase($reset, () => defineInitialState());
  },
});

export const { initialized, setTable, setPage, setLimit, setSearch, setSorting, setFilter } =
  tableSlice.actions;

export const tableReducer = tableSlice.reducer;
