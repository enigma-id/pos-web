import {createAction} from '@reduxjs/toolkit';

const MODULE = 'Activity';

export const $reset = createAction(`${MODULE}/reset`);
export const $processing = createAction(`${MODULE}/processing`);
export const $done = createAction(`${MODULE}/done`);
