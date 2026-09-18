/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useSelector } from 'react-redux';

import CardMockup from '../../../assets/card-mockup.jpg';
import { Modal, NFCField } from '../../../components/ui';
import { PaypassIcon } from '../../../components/ui/icon';
import useMembership from '../../../services/membership/hook';
import { showMembership } from '../../../utils/cache';
import { currencyFormat } from '../../../utils/common';

const MemberPayment = ({ total = 0, allowPoint = false, onConfirm, onClose, isLoading }) => {
  const isOnline = useSelector(state => state?.Offline?.isOnline);
  const apiReachable = useSelector(state => state?.Offline?.apiReachable);

  const isOffline = !isOnline || apiReachable === false;

  const { checkSaldo, checkResult } = useMembership();

  const [card, setCard] = React.useState(null);
  const [cardId, setCardId] = React.useState(null);
  const [isPointPay, setIsPointPay] = React.useState(false);
  const [scanResult, setScanResult] = React.useState(null);
  const [paying, setPaying] = React.useState(false);
  const [payError, setPayError] = React.useState(null);

  // Menandai request checkSaldo yang sedang jalan: 'scan' (ambil data kartu) vs 'pay' (validasi bayar)
  const pendingRef = React.useRef(null);

  const pointErrorMessage = 'Point anda kurang, silahkan bayar dengan saldo atau metode lain';
  const saldoErrorMessage = 'Saldo anda kurang, silahkan topup terlebih dahulu';

  const handleRead = uid => {
    setPayError(null);
    setCardId(uid);

    if (isOffline) {
      const membership = showMembership(uid);

      if (membership) {
        setCard(membership);
      } else {
        setScanResult({ isError: true, message: 'Kartu tidak ditemukan' });
      }

      return;
    }

    pendingRef.current = 'scan';
    checkSaldo({ card_id: uid });
  };

  const resolveErrorMessage = () => {
    const errors = checkResult?.error?.data?.errors;
    const field = errors?.id || errors?.point || errors?.saldo;

    if (Array.isArray(field)) return field[0];
    if (field) return field;

    return isPointPay ? pointErrorMessage : saldoErrorMessage;
  };

  React.useEffect(() => {
    // useLazyQuery menyimpan hasil sukses sebelumnya (lastResult) → saat request baru
    // pending, `isLoading` bisa false & `isSuccess` tetap true. `isFetching` yang benar.
    if (checkResult?.isFetching) return;

    const pending = pendingRef.current;
    if (!pending) return;

    if (pending === 'scan') {
      if (checkResult?.isSuccess) {
        pendingRef.current = null;
        setCard(checkResult?.data?.data);
      } else if (checkResult?.isError) {
        pendingRef.current = null;
        setScanResult(checkResult);
      }
    } else if (pending === 'pay') {
      if (checkResult?.isSuccess) {
        pendingRef.current = null;
        setPaying(false);
        onConfirm?.({ card: checkResult?.data?.data || card, isPointPay });
      } else if (checkResult?.isError) {
        pendingRef.current = null;
        setPaying(false);
        setPayError(resolveErrorMessage());
      }
    }
  }, [checkResult]);

  const onPay = () => {
    setPayError(null);

    if (isOffline) {
      const enough = isPointPay ? (card?.point || 0) >= total : (card?.saldo || 0) >= total;

      if (!enough) {
        setPayError(isPointPay ? pointErrorMessage : saldoErrorMessage);
        return;
      }

      console.log(card, '===========onConfirm==========');

      onConfirm?.({ card, isPointPay });
      return;
    }

    setPaying(true);
    pendingRef.current = 'pay';
    checkSaldo({
      card_id: cardId || card?.card_id,
      is_checkout: true,
      nominal: total,
      is_point: isPointPay,
    });
  };

  const onRescan = () => {
    pendingRef.current = null;
    setCard(null);
    setCardId(null);
    setIsPointPay(false);
    setScanResult(null);
    setPayError(null);
    setPaying(false);
  };

  // Fase scan — pakai NFCField yang sama seperti alur scan lain.
  if (!card) {
    return <NFCField onRead={handleRead} isOpen onClose={onClose} result={scanResult} />;
  }

  // Fase data member — kartu + saldo/point + toggle point + Pay.
  return (
    <>
      <Modal.Header onClose={onClose}>
        <div className="text-[16px] font-semibold tracking-wide">Membership Card</div>
      </Modal.Header>
      <Modal.Body full>
        <div className="h-70 w-full overflow-hidden">
          <div
            className="flex h-full w-full place-content-center place-items-center bg-center"
            style={{ background: `url(${CardMockup})` }}
          >
            <div
              className="flex h-58 w-7/8 flex-col rounded-lg p-6 text-white shadow shadow-white/45"
              style={{
                background:
                  'linear-gradient(112.91deg, rgba(255,255,255,0.3) 3.51%, rgba(255,255,255,0) 111.71%), rgba(0,0,0,0.1)',
                backdropFilter: 'blur(8.36975px)',
              }}
            >
              <div className="flex flex-1 place-content-between">
                <div className="text-2xl font-semibold tracking-wide">Suka Bread.</div>
                <PaypassIcon />
              </div>
              <div className="text-5xl font-semibold tracking-wide">
                {currencyFormat(card?.saldo || 0)}
              </div>
              <div className="mt-2 text-[16px] font-medium tracking-wide uppercase">
                {card?.name || '-'}
              </div>
              <div className="text-xl font-medium tracking-wide uppercase">
                {card?.reff_code || '-'}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-6 py-4">
          <div className="flex place-content-between place-items-center">
            <span className="text-base-300 text-sm">Saldo</span>
            <span className="text-lg font-semibold text-green-600">
              {currencyFormat(card?.saldo || 0)}
            </span>
          </div>
          <div className="flex place-content-between place-items-center">
            <span className="text-base-300 text-sm">Point</span>
            <span className="text-lg font-semibold text-amber-500">
              {currencyFormat(card?.point || 0, false)}
            </span>
          </div>
          <div className="border-base-200 flex place-content-between place-items-center border-t pt-3">
            <span className="font-semibold">Total</span>
            <span className="text-lg font-bold">{currencyFormat(total)}</span>
          </div>

          {allowPoint && (
            <label className="border-base-200 flex cursor-pointer place-content-between place-items-center rounded border px-4 py-3">
              <span className="text-base font-semibold">Bayar pakai point</span>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={isPointPay}
                disabled={paying}
                onChange={e => {
                  setIsPointPay(e.target.checked);
                  setPayError(null);
                }}
              />
            </label>
          )}

          {payError && <small className="text-error block text-center">{payError}</small>}

          <div className="flex gap-2 pt-2">
            <div className="btn btn-default btn-block flex-1" onClick={onRescan}>
              Scan ulang
            </div>
            <div
              className={`btn btn-primary btn-block flex-1 ${paying || isLoading ? 'btn-disabled' : ''}`}
              onClick={onPay}
            >
              Pay
              {(paying || isLoading) && (
                <span className="loading loading-spinner loading-sm"></span>
              )}
            </div>
          </div>
        </div>
      </Modal.Body>
    </>
  );
};

export default MemberPayment;
