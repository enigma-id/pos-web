import { useNavigate } from 'react-router-dom';

import { Kitchen, Receipt, Modal } from '../../../components/ui';
import { PrintIcon } from '../../../components/ui/icon';
import useModal from '../../../components/ui/modal/hook';
// import useOrder from '../../../services/sales/order/hook';
import { usePrintWindow } from '../../../utils/print';

const SuccessModal = ({ data, backToMenu }) => {
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
