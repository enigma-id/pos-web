import { createAction } from '@reduxjs/toolkit';

const MODULE = 'Form';

export const $reset = createAction(`${MODULE}/reset`);
export const $failure = payload => dispatch => {
  dispatch($failureAction(payload));
  setTimeout(() => {
    dispatch($reset());
  }, 10000);
};
export const $failureAction = createAction(`${MODULE}/failure`);
export const $success = createAction(`${MODULE}/success`);
export const $requesting = createAction(`${MODULE}/requesting`);
