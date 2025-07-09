import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { cashList, currencyFormat } from '../../utils/common';

const Keypad = ({ onDone, payment, subtotal }) => {
  const FormState = useSelector(state => state?.Form);

  const [value, setValue] = useState('');
  const [moneyList, setMoneyList] = React.useState([]);

  const handleInput = key => {
    if (key === 'C') return setValue('');
    if (key === '←') return setValue(prev => prev.slice(0, -1));
    if (key === 'Done') {
      const cleaned = value.endsWith('.') ? value.slice(0, -1) : value;
      const normalized = cleaned ? parseFloat(cleaned).toString() : '';
      return onDone?.(normalized);
    }

    setValue(prev => {
      const hasDot = prev.includes('.');

      // Jika belum ada angka, hanya boleh 1–9 (atau preset)
      if (prev === '') {
        if (['0', '.', '00'].includes(key)) return prev;
        return key;
      }

      // Batasi hanya 1 titik desimal
      if (key === '.' && hasDot) return prev;

      return prev + key;
    });
  };

  const keys = ['1', '2', '3', 'C', '4', '5', '6', '←', '7', '8', '9', 'Done', '.', '0', '00', ''];

  const getButtonStyle = key => {
    if (key === '←') return 'bg-red-50 text-red-500';
    if (key === 'C') return 'bg-orange-50 text-orange-500';
    if (key === '10' || key === '20') return 'bg-blue-50 text-blue-600';
    if (key === 'Done') return 'bg-black text-white';
    return 'bg-[#f9fafe] text-black';
  };

  React.useEffect(() => {
    if (payment === 0) {
      const list = cashList(subtotal);
      setMoneyList(list);
    }
  }, [subtotal, payment]);

  return (
    <div>
      <div className="mb-3">
        <div className="mb-3 text-[16px] font-semibold">Input amount</div>
        {/* <div className="border-secondary text-primary bg-base-300 min-h-15 w-full place-content-center rounded-2xl border text-center text-xl font-bold">
          {currencyFormat(value, false)}
        </div> */}

        <input
          type="text"
          inputMode="decimal"
          className={`border-secondary text-primary bg-base-300 focus:!border-primary min-h-15 w-full rounded-2xl border px-4 py-3 text-center text-xl font-bold focus:!outline-none ${FormState?.errors?.total_payment ? '!border-error !text-error !bg-[var(--color-error-shadow)]' : ''}`}
          value={currencyFormat(value, false)}
          onChange={e => {
            const raw = e.target.value.replace(/[^0-9]/g, '');
            setValue(raw);
          }}
        />
        {FormState?.errors?.total_payment && (
          <small className="text-error">{FormState?.errors?.total_payment}</small>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {moneyList?.map((mon, i) => (
          <div
            key={i}
            onClick={() => setValue(String(mon))}
            className="btn btn-info btn-outline btn-md"
          >
            {currencyFormat(mon)}
          </div>
        ))}
      </div>
      <div className="mx-auto w-full">
        <div className="grid grid-cols-4 grid-rows-4 gap-2">
          {keys.map((key, i) => {
            if (key === '') return null;

            const isDone = key === 'Done';

            return (
              <button
                key={`${key}-${i}`}
                onClick={() => handleInput(key)}
                className={`btn btn-outline btn-secondary px-4 py-3 text-center text-sm font-semibold ${getButtonStyle(key)} ${isDone ? 'row-span-2 h-full bg-black text-white' : ''} `}
              >
                {key === '←' ? (
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 40 40"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M31.2443 10H16.2216C14.3197 10 11.9642 11.1657 10.8585 12.6534L6.93756 17.93L5.13633 20.3552C4.95456 20.608 4.95306 21.0659 5.14084 21.3143L6.92554 23.7179L10.86 29.0147C11.9642 30.501 14.3182 31.6667 16.2216 31.6667H31.2443C33.316 31.6667 35 30.046 35 28.0556V13.6111C35 11.6207 33.316 10 31.2443 10ZM27.7996 24.1454C27.9391 24.2796 28.0497 24.4388 28.1252 24.614C28.2007 24.7892 28.2395 24.977 28.2395 25.1667C28.2395 25.3563 28.2007 25.5441 28.1252 25.7193C28.0497 25.8946 27.9391 26.0538 27.7996 26.1879C27.6601 26.322 27.4945 26.4284 27.3123 26.501C27.1301 26.5735 26.9348 26.6109 26.7375 26.6109C26.5403 26.6109 26.3449 26.5735 26.1627 26.501C25.9805 26.4284 25.8149 26.322 25.6754 26.1879L22.2307 22.8758L18.786 26.1879C18.6468 26.3225 18.4813 26.4293 18.299 26.5022C18.1167 26.5751 17.9213 26.6126 17.7239 26.6126C17.5265 26.6126 17.331 26.5751 17.1487 26.5022C16.9664 26.4293 16.801 26.3225 16.6618 26.1879C16.5221 26.0539 16.4114 25.8947 16.3358 25.7194C16.2602 25.5442 16.2213 25.3564 16.2213 25.1667C16.2213 24.977 16.2602 24.7891 16.3358 24.6139C16.4114 24.4387 16.5221 24.2795 16.6618 24.1454L20.1065 20.8333L16.6618 17.5212C16.5223 17.3871 16.4116 17.2279 16.3362 17.0527C16.2607 16.8775 16.2218 16.6897 16.2218 16.5C16.2218 16.3103 16.2607 16.1225 16.3362 15.9473C16.4116 15.7721 16.5223 15.6129 16.6618 15.4788C16.8012 15.3447 16.9668 15.2383 17.1491 15.1657C17.3313 15.0931 17.5266 15.0558 17.7239 15.0558C17.9211 15.0558 18.1164 15.0931 18.2987 15.1657C18.4809 15.2383 18.6465 15.3447 18.786 15.4788L22.2307 18.7909L25.6754 15.4788C25.8149 15.3447 25.9805 15.2383 26.1627 15.1657C26.3449 15.0931 26.5403 15.0558 26.7375 15.0558C26.9348 15.0558 27.1301 15.0931 27.3123 15.1657C27.4945 15.2383 27.6601 15.3447 27.7996 15.4788C27.9391 15.6129 28.0497 15.7721 28.1252 15.9473C28.2007 16.1225 28.2395 16.3103 28.2395 16.5C28.2395 16.6897 28.2007 16.8775 28.1252 17.0527C28.0497 17.2279 27.9391 17.3871 27.7996 17.5212L24.3549 20.8333L27.7996 24.1454Z"
                      fill="#EA4F3B"
                    />
                  </svg>
                ) : key === 'Done' ? (
                  'Done ↵'
                ) : (
                  key
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Keypad;
