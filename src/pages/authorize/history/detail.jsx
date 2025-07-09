/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useOrder from '../../../services/sales/order/hook';
import { currencyFormat, dateFormat } from '../../../utils/common';
import useDialogModal from '../../../utils/modal';
import { Input } from '../../../components/ui';
import { useSelector } from 'react-redux';

const DetailScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const FormState = useSelector(state => state?.Form);

  const { showResult, cancel, cancelResult } = useOrder(id);
  const [pin, setPin] = React.useState('');

  const { dialogRef, open, close } = useDialogModal({
    onClose: () => setPin(''),
  });

  const onCancel = () => {
    const payload = {
      pin,
    };

    cancel({ id, payload });
  };

  React.useEffect(() => {
    if (cancelResult?.isSuccess) {
      close();
      setPin('');
      navigate(-1, { replace: true });
    }
  }, [cancelResult]);

  if (showResult?.isLoading) return <div>loading</div>;

  let data = showResult?.data?.data;

  const ListItem = ({ title, value }) => (
    <div className="border-secondary mb-3 flex place-content-between place-items-center border-b pb-2">
      <div className="text-sm">{title}</div>
      <div
        className={`text-sm font-semibold ${value === 'completed' ? 'bg-success w-fit rounded-full px-4 py-1 !text-[11px] text-white uppercase' : value === 'pending' ? 'bg-accent w-fit rounded-full px-4 py-1 !text-[11px] text-white uppercase' : ''}`}
      >
        {value}
      </div>
    </div>
  );

  return (
    <div>
      <div className="border-secondary flex h-[62px] flex-1 place-content-between place-items-center gap-4 border-t border-b bg-white px-4">
        <div className="flex place-items-center">
          <div
            className="btn btn-md btn-outline btn-circle border-base-300"
            onClick={() => navigate(-1)}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M7.91664 5.41675L3.45116 9.88223C3.38607 9.94732 3.38607 10.0528 3.45116 10.1179L7.91664 14.5834M3.40234 10.0001H16.6666"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h2 className="border-secondary border-s ps-4 text-xl font-bold">Order {data?.code}</h2>
        </div>

        <div className="flex place-items-center gap-4">
          <div className="btn btn-md btn-info btn-circle">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5.56588 17.7979C4.37088 17.7299 3.42612 17.0932 3.3285 16.2959C2.94056 13.1273 2.85423 11.8804 3.29912 8.67455C3.40769 7.89221 4.34486 7.27584 5.51848 7.20841C6.20614 7.1689 6.86383 7.135 7.5 7.10673M18.4497 17.7966C19.6418 17.7292 20.5866 17.0958 20.6853 16.3005C21.0825 13.0996 21.1214 11.8582 20.7002 8.68384C20.5958 7.89735 19.6574 7.27479 18.4781 7.2067C17.7921 7.1671 17.1356 7.13319 16.5 7.10497M7.5 7.10673V5.5C7.5 4.11929 8.61929 3 10 3H14C15.3807 3 16.5 4.11929 16.5 5.5V7.10497M7.5 7.10673C10.6871 6.96506 13.3338 6.96438 16.5 7.10497M7.5 14H8.5M8.5 14L7.90765 18.1465C7.6925 19.6525 8.86115 21 10.3825 21H13.6175C15.1388 21 16.3075 19.6525 16.0924 18.1464L15.5 14M8.5 14H15.5M15.5 14H16.5M14.5 10.5H16.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="btn btn-md btn-error btn-circle text-white" onClick={open}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M11.0001 2.98546V3.13665C11.6366 3.19492 12.2678 3.27154 12.8932 3.36599C13.1247 3.40095 13.3555 3.43837 13.5854 3.4782C13.8575 3.52533 14.0399 3.78411 13.9927 4.0562C13.9456 4.32829 13.6868 4.51066 13.4147 4.46352C13.3683 4.45549 13.3219 4.44755 13.2754 4.43971L12.6051 13.1534C12.525 14.1954 11.6561 15 10.611 15H5.38913C4.34406 15 3.47517 14.1954 3.39502 13.1534L2.72474 4.43971C2.67826 4.44755 2.63183 4.45549 2.58542 4.46352C2.31333 4.51066 2.05455 4.32829 2.00742 4.0562C1.96029 3.78411 2.14265 3.52533 2.41474 3.4782C2.64467 3.43837 2.87543 3.40095 3.10699 3.36599C3.73239 3.27154 4.3636 3.19492 5.00008 3.13665V2.98546C5.00008 1.94248 5.80844 1.05212 6.87704 1.01794C7.24994 1.00601 7.62432 1 8.00008 1C8.37585 1 8.75022 1.00601 9.12313 1.01794C10.1917 1.05212 11.0001 1.94248 11.0001 2.98546ZM6.90901 2.01743C7.27126 2.00584 7.63498 2 8.00008 2C8.36518 2 8.7289 2.00584 9.09115 2.01743C9.59423 2.03352 10.0001 2.45596 10.0001 2.98546V3.06055C9.33851 3.02038 8.67164 3 8.00008 3C7.32852 3 6.66166 3.02038 6.00008 3.06055V2.98546C6.00008 2.45596 6.40593 2.03352 6.90901 2.01743ZM6.67248 5.98078C6.66187 5.70484 6.42957 5.48976 6.15364 5.50037C5.8777 5.51098 5.66261 5.74328 5.67322 6.01922L5.90399 12.0192C5.9146 12.2952 6.1469 12.5102 6.42284 12.4996C6.69878 12.489 6.91386 12.2567 6.90325 11.9808L6.67248 5.98078ZM10.3263 6.01922C10.3369 5.74328 10.1219 5.51098 9.84591 5.50037C9.56998 5.48976 9.33768 5.70484 9.32707 5.98078L9.0963 11.9808C9.08568 12.2567 9.30077 12.489 9.57671 12.4996C9.85265 12.5102 10.0849 12.2952 10.0956 12.0192L10.3263 6.01922Z"
                fill="currentColor"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-row bg-white p-4">
        <div className="flex-1/2 pe-4">
          <div className="text-accent pb-3 text-xs tracking-wide">INFORMASI TRANSAKSI</div>
          <ListItem title="Tanggal Transaksi" value={dateFormat(data?.ordered_at)} />

          <ListItem title="Transaksi" value={`No. ${data?.code}`} />
          <ListItem title="Metode Pembayaran" value={data?.payment_method?.name || 'CASH'} />
          {data?.payment_ref !== '' && <ListItem title="REF" value={data?.payment_ref} />}
          <ListItem title="Total Transaksi" value={currencyFormat(data?.total_charges)} />
          <ListItem title="Status" value={data?.status} />
        </div>
        <div className="flex-1/2 ps-4">
          <div className="text-accent pb-3 text-xs tracking-wide">INFORMASI BARANG</div>

          <table className="border-secondary table-striped table w-full border">
            <thead className="border-secondary border">
              <tr>
                <th className="w-8 px-4 py-2 text-left">no</th>
                <th className="px-4 py-2 text-left">item</th>
                <th className="px-4 py-2 text-center">qty</th>
                <th className="px-4 py-2 text-end">harga</th>
              </tr>
            </thead>
            <tbody>
              {data?.items?.map((item, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 text-left text-sm">{i + 1}</td>
                  <td className="px-4 py-2 text-left text-sm">
                    <div>{item?.catalog?.name}</div>
                    {item?.additionals && (
                      <div>
                        <div className="text-accent text-xs font-semibold tracking-wide uppercase">
                          Addon:
                        </div>
                        {item?.additionals?.map((addon, i) => (
                          <div key={i} className="text-xs">
                            {addon?.catalog?.name}
                            {addon?.unit_nett > 0 && `@${currencyFormat(addon?.unit_nett)}`}
                            {addon?.quantity > 0 && ` x ${addon?.quantity}`}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center text-sm">{item?.quantity}</td>
                  <td className="px-4 py-2 text-end text-sm">
                    {currencyFormat(item?.unit_nett * item?.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <dialog ref={dialogRef} className="modal">
        <div className="w-1/3 rounded bg-white px-4 py-6">
          <div className="border-secondary text-error mb-4 border-b pb-3 text-center text-lg font-semibold tracking-wide uppercase">
            Batalkan Order
          </div>
          <div className="mb-4 text-center text-sm">
            <div>Anda yakin akan membatalkan transaksi ini?</div>
            <div className="mb-3">Jumlah uang cash ditangan akan di kalkulasi ulang.</div>

            <Input
              label="masukkan pin"
              value={pin}
              onChange={e => setPin(e?.target?.value)}
              error={FormState?.errors?.pin}
              type="password"
            />
          </div>

          <div className="border-secondary flex place-content-end place-items-center gap-3 border-t pt-3">
            <div className="btn btn-md px-10" onClick={close}>
              Cancel
            </div>
            <div
              className={`btn btn-md btn-error px-10 text-white ${cancelResult?.isLoading ? 'btn-disabled' : ''}`}
              onClick={onCancel}
            >
              Confirm{' '}
              {cancelResult.isLoading ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : null}
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
};

export default DetailScreen;
