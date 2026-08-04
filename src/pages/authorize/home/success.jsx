import React from 'react';
import { useNavigate } from 'react-router-dom';

import { Kitchen, Receipt, Modal } from '../../../components/ui';
import { PrintIcon } from '../../../components/ui/icon';
import useModal from '../../../components/ui/modal/hook';
// import useOrder from '../../../services/sales/order/hook';
import { currencyFormat } from '../../../utils/common';
import { usePrintWindow } from '../../../utils/print';

const SuccessModal = ({ data, backToMenu }) => {
  const isCurrentlyOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  const isCompletedFlow = data?.status === 'completed';
  const navigate = useNavigate();
  const { closeModal } = useModal();
  const { open: openPrint } = usePrintWindow({ title: 'Print Preview', autoClose: true });
  //   const { show, showResult } = useOrder();

  //   const [data, setData] = React.useState(null);

  const handleOpenPrint = () => {
    openPrint(<Receipt data={data} />);
  };

  const handleOpenPrintKitchen = () => {
    openPrint(<Kitchen data={data} />);
  };

  return (
    <>
      <Modal.Header
        onClose={
          backToMenu
            ? () => {
                closeModal();
                navigate('/');
              }
            : closeModal
        }
      >
        <div className="text-lg font-semibold tracking-wide uppercase">
          {isCurrentlyOffline
            ? 'Payment Queued'
            : isCompletedFlow
              ? 'Payment success'
              : 'Bill Saved'}
        </div>
      </Modal.Header>

      <Modal.Body full>
        <div className="flex place-content-center place-items-center">
          <img src="./bill_success.png" className="h-64" />
        </div>

        <div className="py-4 text-center">
          {isCompletedFlow && !isCurrentlyOffline ? (
            <>
              <p className="text-base font-semibold">Payment success.</p>

              <div className="flex h-16 place-items-center">
                <div className="flex flex-1 flex-col place-content-center place-items-center">
                  <div className="text-xl font-semibold">{currencyFormat(data?.total_payment)}</div>
                  <div className="text-base-300 text-base font-thin capitalize">total paid</div>
                </div>

                {data?.payment_method?.provider === 'cash' && (
                  <div className="border-base-200 flex flex-1 flex-col place-content-center place-items-center border-l">
                    <div className="text-xl font-semibold text-red-500">
                      {currencyFormat(data?.total_payment - data?.total_charges)}
                    </div>
                    <div className="text-base-300 text-base font-thin capitalize">change</div>
                  </div>
                )}
              </div>
            </>
          ) : isCurrentlyOffline && isCompletedFlow ? (
            <>
              <p className="text-base font-semibold">Payment saved locally.</p>
              <p className="text-base-300 text-sm">
                It will sync automatically when your connection is restored.
              </p>

              <div className="flex h-16 place-items-center">
                <div className="flex flex-1 flex-col place-content-center place-items-center">
                  <div className="text-xl font-semibold">{currencyFormat(data?.total_payment)}</div>
                  <div className="text-base-300 text-base font-thin capitalize">total paid</div>
                </div>

                {data?.payment_method?.provider === 'cash' && (
                  <div className="border-base-200 flex flex-1 flex-col place-content-center place-items-center border-l">
                    <div className="text-xl font-semibold text-red-500">
                      {currencyFormat(data?.total_payment - data?.total_charges)}
                    </div>
                    <div className="text-base-300 text-base font-thin capitalize">change</div>
                  </div>
                )}
              </div>
            </>
          ) : isCurrentlyOffline ? (
            <>
              <p className="text-base font-semibold">Bill saved locally.</p>
              <p className="text-base-300 text-sm">
                It will sync automatically when your connection is restored.
              </p>
            </>
          ) : (
            <p className="text-base font-semibold">Bill saved successfully.</p>
          )}
          <p className="text-base-300 text-sm">Would you like to print to kitchen?</p>
        </div>

        <div className="px-4">
          <div className="flex h-16 gap-4">
            <div
              className="btn btn-lg btn-soft btn-primary mb-3 flex-1 rounded-none"
              onClick={() => handleOpenPrint(data)}
            >
              <PrintIcon /> Print Receipt
            </div>
            <div
              className="btn btn-lg btn-soft btn-primary flex-1 rounded-none"
              onClick={handleOpenPrintKitchen}
            >
              <PrintIcon /> Print Kitchen
            </div>
          </div>
          {backToMenu && (
            <div
              className="btn btn-block btn-lg btn-primary mb-3"
              onClick={() => {
                closeModal();
                navigate('/');
              }}
            >
              Back to menu
            </div>
          )}
        </div>
      </Modal.Body>
    </>
  );
};

export default SuccessModal;
