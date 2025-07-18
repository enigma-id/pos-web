import { useContext } from 'react';

import { ModalContext } from './context';

const useModal = () => useContext(ModalContext);
export default useModal;
