import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider as StateProvider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import App from './App.jsx';
import { persistor, store } from './services/store.js';

import './components/styles/index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StateProvider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <App />
      </PersistGate>
    </StateProvider>
  </React.StrictMode>
);
