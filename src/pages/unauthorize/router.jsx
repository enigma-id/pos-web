import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import SigninScreen from './signin';

const UnauthorizeRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/signin" element={<SigninScreen />} />
        <Route path="*" element={<Navigate to="/signin" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default UnauthorizeRouter;
