/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useSelector } from 'react-redux';
import { v4 as uuidv4 } from 'uuid';

import CardMockup from '../../../assets/card-mockup.jpg';
import { PaypassIcon } from '../../../components/ui/icon';
import TopupReceipt from '../../../components/ui/topup-receipt';
import useMembership from '../../../services/membership/hook';
import { createTopup } from '../../../services/offline/queue';
import { triggerQueueRefresh } from '../../../services/offline/usePendingQueueCount';
import { perbaharuiMembership } from '../../../utils/cache';
import { currencyFormat } from '../../../utils/common';
import { usePrintWindow } from '../../../utils/print';
import useMaster from '../../../services/master/hook';
import useSession from '../../../services/sales/session/hook';

const CardContent = ({ data, onClose }) => {
  const sessionSummary = useSelector(state => state?.SalesSession?.sessionSummary);
  const FormState = useSelector(state => state?.Form);
  const sessionAuth = useSelector(state => state?.Auth?.session);

  const isOnline = useSelector(state => state?.Offline?.isOnline);
  const apiReachable = useSelector(state => state?.Offline?.apiReachable);
  const isOffline = !isOnline || apiReachable === false;

  const { topup, topupResult } = useMembership();
  const { getSchemaBonus, schemaBonus } = useMaster();
  const { updateSessionSummary } = useSession();

  const [value, setValue] = React.useState('');
  const [method, setMethod] = React.useState('');
  const { open: openPrint } = usePrintWindow({ title: 'Topup Receipt', autoClose: true });

  const onTopupOffline = async () => {
    const useBonuses = schemaBonus.filter(sb => sb.min_amount <= value)?.slice(0, 1);
    console.log('=======[DEBUG]===[useBonus]============', useBonuses);
    console.log('=======[DEBUG]===[data]============', data);

    const membership = JSON.parse(JSON.stringify(data));
    const dataPrint = {
      membership: data,
      topup: null,
      bonus: null,
    };

    const nominal = Number(value) || 0;

    const payload = {
      sync_id: uuidv4(),
      membership: data,
      membership_id: data?.id,
      nominal: parseFloat(value) || 0,
      payment_type: method,
      reference_type: 'top-up',
      created_at: new Date(),
      session_sync_id: sessionSummary?.id || sessionSummary?.sync_id,
    };

    try {
      await createTopup(payload, sessionAuth?.user?.id);

      if (!membership.saldo_logs) {
        membership.saldo_logs = [];
      }

      membership.saldo += payload.nominal;
      membership.saldo_logs.push(payload);
      dataPrint.topup = payload;
    } catch (err) {
      console.log('[DEBUG] createTopup', err);
    }

    if (useBonuses?.length > 0) {
      const nominalBonus = Math.ceil(nominal * (useBonuses[0].bonus_percentage / 100));

      const payloadBonus = {
        nominal: nominalBonus,
        membership: data,
        membership_id: data?.id,
        reference_type: 'bonus',
        created_at: new Date(),
        session_sync_id: sessionSummary?.id || sessionSummary?.sync_id,
      };

      try {
        membership.saldo += payloadBonus.nominal;
        membership.saldo_logs.push(payloadBonus);
        dataPrint.bonus = payloadBonus;
      } catch (err) {
        console.log('[DEBUG] createTopup bonus', err);
      }
    }

    triggerQueueRefresh();

    try {
      perbaharuiMembership(membership);
    } catch (err) {
      console.log('[DEBUG] perbaharuiMembership ', err);
    }

    updateSessionSummary({
      type: 'topup',
      topup_method: method,
      topup_nominal: nominal,
    });

    console.log('[DEBUG] [DATA PRINT] ', dataPrint);

    handleModalPrint(dataPrint);

    onClose?.();
  };

  const onTopupOnline = async () => {
    const nominal = Number(value) || 0;

    const payload = {
      nominal: parseFloat(nominal) || 0,
      payment_type: method,
    };

    topup({ id: data?.id, payload });
  };

  const onTopup = async () => {
    if (isOffline) {
      onTopupOffline();
    } else {
      onTopupOnline();
    }
  };

  const handleModalPrint = data => {
    openPrint(<TopupReceipt data={data} />);
  };

  // Jika sukses: update cache lokal, print receipt, then close modal
  React.useEffect(() => {
    if (topupResult?.isSuccess) {
      handleModalPrint(topupResult?.data?.data);

      onClose?.();
    }
  }, [topupResult]);

  React.useEffect(() => {
    getSchemaBonus();
  }, []);

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
              topupResult?.isLoading || (!isOffline && !sessionSummary) ? 'btn-disabled' : ''
            }`}
            onClick={onTopup}
          >
            Top Up
          </div>
        </div>
      </div>
    </>
  );
};

export default CardContent;
