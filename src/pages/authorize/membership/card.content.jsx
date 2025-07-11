import React from 'react';
import { useSelector } from 'react-redux';

import CardMockup from '../../../assets/card-mockup.jpg';
import { PaypassIcon } from '../../../components/ui/icon';
import useMembership from '../../../services/membership/hook';
import { currencyFormat } from '../../../utils/common';

const CardContent = ({ data, onClose }) => {
  const FormState = useSelector(state => state?.Form);
  const { topup, topupResult } = useMembership();

  const [value, setValue] = React.useState('');
  const [method, setMethod] = React.useState('');

  const handleTopup = () => {
    const payload = {
      card_id: data?.card_id,
      nominal: Number(value) || 0,
      payment_type: method,
    };

    topup(payload);
  };

  // Jika sukses, tutup modal
  React.useEffect(() => {
    if (topupResult?.isSuccess) {
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
      <div className="p-4">
        <div>
          <div className="mb-2 text-sm font-semibold tracking-wider uppercase">Topup Amount</div>
          <input
            type="text"
            inputMode="decimal"
            className={`border-secondary text-primary bg-base-300 focus:!border-primary min-h-15 w-full rounded-2xl border px-4 py-3 text-center text-xl font-bold focus:!outline-none ${
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

        <div className="mt-4 mb-2">
          <div className="mb-2 text-sm font-semibold tracking-wider uppercase">Payment Method</div>
          <div className="grid grid-cols-3 gap-3">
            {['cash', 'transfer'].map(m => (
              <div
                key={m}
                className={`border-secondary hover:border-primary hover:text-primary cursor-pointer rounded border p-2 text-center text-sm font-medium tracking-wide uppercase ${
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

        <div className="border-secondary mt-4 border-t pt-4">
          <div
            className={`btn btn-primary btn-block btn-sm rounded-full ${
              topupResult?.isLoading ? 'btn-disabled' : ''
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
