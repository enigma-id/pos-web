/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { v4 as uuidv4 } from 'uuid';

import CardMockup from '../../../assets/card-mockup.jpg';
import { PaypassIcon } from '../../../components/ui/icon';
import TopupReceipt from '../../../components/ui/topup-receipt';
import useMembership from '../../../services/membership/hook';
import { appendTopupToSession, getAllSessions, getOfflinePendingCount, getOrCreateOfflineSession } from '../../../services/offline/queue';
import { setSessions, setPendingCount, setOfflineSummary, setWarning } from '../../../services/offline/slice';
import { computeOfflineSummary } from '../../../services/sales/session/hook';
import { updateMemberCacheSaldo, getCache, setCache } from '../../../utils/cache';
import { currencyFormat } from '../../../utils/common';
import { usePrintWindow } from '../../../utils/print';

const CardContent = ({ data, onClose }) => {
  const dispatch = useDispatch();
  const SalesSession = useSelector(state => state?.SalesSession?.hasSession);
  const FormState = useSelector(state => state?.Form);
  const authSession = useSelector(state => state?.Auth?.session);
  const authUser = useSelector(state => state?.Auth?.user);
  const userId = authSession?.user?.id || authUser?.id;
  const { topup, topupResult } = useMembership();

  const [value, setValue] = React.useState('');
  const [method, setMethod] = React.useState('');
  const { open: openPrint } = usePrintWindow({ title: 'Topup Receipt', autoClose: true });
  const topupSubmitted = React.useRef(false);

  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  const handleTopup = () => {
    const nominal = Number(value) || 0;
    const payload = {
      nominal,
      payment_type: method,
    };

    topupSubmitted.current = true;

    // ===== OFFLINE PATH =====
    if (isOffline) {
      const handleOffline = async () => {
        const sessionDoc = await getOrCreateOfflineSession(userId, authSession);
        const syncId = sessionDoc?.sync_id;
        if (!syncId) {
          dispatch(setWarning('No active session. Please start a session first.'));
          topupSubmitted.current = false;
          return;
        }
        dispatch(setSessions([sessionDoc]));

        const topupItem = {
          sync_id: uuidv4(),
          session_sync_id: syncId,
          membership_id: data?.id,
          nominal,
          payment_type: method,
          member_name: data?.name,
          member_code: data?.reff_code,
          member_card_id: data?.card_id,
          created_at: new Date().toISOString(),
        };

        await appendTopupToSession(syncId, topupItem, userId);
        // Update cache saldo
        const newSaldo = (data?.saldo || 0) + nominal;
        if (data?.card_id) {
          updateMemberCacheSaldo(data.card_id, newSaldo);

          // Update table cache juga biar list page kebaca
          const TABLE_CACHE_KEY = 'cache_table_membership';
          const existing = getCache(TABLE_CACHE_KEY);
          const tableData = Array.isArray(existing?.data) ? existing.data : [];
          const updated = tableData.map(m =>
            String(m.card_id) === String(data.card_id)
              ? { ...m, saldo: newSaldo }
              : m
          );
          setCache(TABLE_CACHE_KEY, { ...existing, data: updated });
        }

        // Print receipt lokal
        openPrint(
          <TopupReceipt
            member={data}
            nominal={nominal}
            paymentMethod={method}
            createdAt={topupItem.created_at}
          />
        );

        // Refresh Redux sessions & recompute summary
        const fresh = await getAllSessions(userId);
        dispatch(setSessions(fresh));
        const c = await getOfflinePendingCount(userId);
        dispatch(setPendingCount(c));
        const activeSession = fresh.find(s => s.sync_id === syncId);
        if (activeSession) {
          const s = computeOfflineSummary(activeSession, syncId, authUser || authSession?.user);
          dispatch(setOfflineSummary(s));
        }

        topupSubmitted.current = false;
        onClose?.();
      };

      handleOffline();
      return; // ⛔️ skip mutation API
    }

    // ===== ONLINE PATH =====
    topup({ id: data?.id, payload });
  };

  // Jika sukses: update cache lokal, print receipt, then close modal
  React.useEffect(() => {
    if (topupResult?.isSuccess && topupSubmitted.current) {
      // Skip kalo ini offline — offline path handle sendiri
      if (topupResult?.data?.data?.offline_queued) return;

      topupSubmitted.current = false;
      const nominal = Number(value) || 0;
      const resData = topupResult?.data?.data || {};

      // Update cache with optimistic saldo for offline fallback
      const newSaldo = (data?.saldo || 0) + nominal;
      if (data?.card_id) {
        updateMemberCacheSaldo(data.card_id, newSaldo);
      }

      openPrint(
        <TopupReceipt
          member={data}
          nominal={nominal}
          paymentMethod={method}
          createdAt={resData?.created_at || new Date().toISOString()}
        />
      );
      onClose?.();
    }
  }, [topupResult]);

  return (
    <>
      {/* Card Visual */}
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
              {currencyFormat(data?.saldo || 0)}
            </div>
            <div className="mt-2 text-[16px] font-medium tracking-wide uppercase">
              {data?.name || '-'}
            </div>
            <div className="text-xl font-medium tracking-wide uppercase">
              {data?.reff_code || '-'}
            </div>
          </div>
        </div>
      </div>

      {/* Form Section */}
      <div className="pt-4">
        <div className="px-4">
          <div className="mb-2 text-sm font-semibold tracking-wider uppercase">Topup Amount</div>
          <input
            type="text"
            inputMode="decimal"
            className={`border-base-200 text-primary bg-base-100 focus:!border-primary min-h-15 w-full rounded-2xl border px-4 py-3 text-center text-xl font-bold focus:!outline-none ${
              FormState?.errors?.nominal
                ? '!border-error !text-error !bg-[var(--color-error-shadow)]'
                : ''
            }`}
            value={currencyFormat(value, false)}
            onChange={e => {
              const raw = e.target.value.replace(/[^0-9]/g, '');
              setValue(raw);
            }}
          />
          <small className="text-error">{FormState?.errors?.nominal}</small>
        </div>

        <div className="mt-4 mb-2 px-4">
          <div className="mb-2 text-sm font-semibold tracking-wider uppercase">Payment Method</div>
          <div className="grid grid-cols-3 gap-3">
            {['cash', 'transfer'].map(m => (
              <div
                key={m}
                className={`border-base-200 hover:border-primary hover:text-primary cursor-pointer rounded border p-2 text-center text-sm font-medium tracking-wide uppercase ${
                  method === m ? '!border-primary !text-primary' : ''
                } ${FormState?.errors?.payment_type ? '!border-error !text-error' : ''}`}
                onClick={() => setMethod(m)}
              >
                {m}
              </div>
            ))}
          </div>
          <small className="text-error">{FormState?.errors?.payment_type}</small>
        </div>

        <div className="mt-4">
          <div
            className={`btn btn-primary btn-block btn-xl !rounded-none !rounded-b ${
              topupResult?.isLoading || (!isOffline && !SalesSession) ? 'btn-disabled' : ''
            }`}
            onClick={handleTopup}
          >
            Top Up
          </div>
        </div>
      </div>
    </>
  );
};

export default CardContent;
