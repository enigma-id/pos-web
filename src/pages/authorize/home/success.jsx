import React from 'react';

import { Kitchen, Modal } from '../../../components/ui';
import { PrintIcon } from '../../../components/ui/icon';
import useModal from '../../../components/ui/modal/hook';
// import useOrder from '../../../services/sales/order/hook';
import { usePrintWindow } from '../../../utils/print';

const SuccessModal = ({ data }) => {
  const { closeModal } = useModal();
  const { open: openPrint } = usePrintWindow({ title: 'Print Preview', autoClose: true });
  //   const { show, showResult } = useOrder();

  //   const [data, setData] = React.useState(null);

  const handleOpenPrintKitchen = () => {
    openPrint(<Kitchen data={data} />);
  };

  //   React.useEffect(() => {
  //     if (!id) return;
  //     show(id);
  //   }, [id]);

  //   React.useEffect(() => {
  //     if (showResult?.isSuccess) {
  //       setData(showResult?.data?.data);
  //     }
  //   }, [showResult]);

  return (
    <>
      <Modal.Header onClose={closeModal}>
        <div className="text-lg font-semibold tracking-wide uppercase">Bill Saved</div>
      </Modal.Header>

      <Modal.Body full>
        <div className="flex place-content-center place-items-center">
          <img src="./bill_success.png" className="h-64" />
        </div>

        <div className="py-4 text-center">
          <p className="text-base font-semibold">Bill saved successfully.</p>
          <p className="text-base-300 text-sm">Would you like to print to kitchen?</p>
        </div>

        <div className="flex h-16 px-4">
          <div
            className="btn btn-lg btn-soft btn-primary flex-1 rounded-none"
            onClick={handleOpenPrintKitchen}
          >
            <PrintIcon /> Print Kitchen
          </div>
        </div>
      </Modal.Body>
    </>
  );
};

export default SuccessModal;
