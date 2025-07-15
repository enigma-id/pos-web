import React from 'react';
import { useSelector } from 'react-redux';

import { BackspaceIcon } from './icon';
import { cashList, currencyFormat } from '../../utils/common';

const Keypad = ({ onChange, payment, subtotal }) => {
  const FormState = useSelector(state => state?.Form);

  const [value, setValue] = React.useState('');
  const [moneyList, setMoneyList] = React.useState([]);

  const handleInput = key => {
    if (key === 'C') return setValue('');
    if (key === '←') return setValue(prev => prev.slice(0, -1));

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

  const keys = ['1', '2', '3', 'C', '4', '5', '6', '', '7', '8', '9', '←', '.', '0', '000', ''];

  const getButtonStyle = key => {
    if (key === '←') return 'bg-red-50 text-red-500';
    if (key === 'C') return 'bg-orange-50 text-orange-500';
    if (key === '10' || key === '20') return 'bg-blue-50 text-blue-600';
    return 'bg-[#f9fafe] text-black';
  };

  React.useEffect(() => {
    if (payment === 0) {
      const list = cashList(subtotal);
      setMoneyList(list);
    }
  }, [subtotal, payment]);

  React.useEffect(() => {
    const cleaned = value.endsWith('.') ? value.slice(0, -1) : value;
    const normalized = cleaned ? parseFloat(cleaned).toString() : '';
    onChange?.(normalized);
  }, [value]);

  return (
    <div className="mt-4">
      <div className="mb-3">
        <input
          type="text"
          inputMode="decimal"
          className={`text-primary bg-base-100 min-h-25 w-full px-4 py-3 text-center text-4xl font-bold focus:!outline-none ${FormState?.errors?.total_payment ? '!border-error !text-error !bg-[var(--color-error-shadow)]' : ''}`}
          value={currencyFormat(value)}
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
          <div key={i} onClick={() => setValue(String(mon))} className="btn btn-outline btn-lg">
            {currencyFormat(mon)}
          </div>
        ))}
      </div>
      <div className="mx-auto w-full">
        <div className="grid grid-cols-4 grid-rows-4 gap-2">
          {keys.map((key, i) => {
            if (key === '') return null;

            const isBig = key === 'C' || key === '←';

            return (
              <button
                key={`${key}-${i}`}
                onClick={() => handleInput(key)}
                className={`btn btn-outline btn-secondary h-14 text-center text-xl font-semibold ${getButtonStyle(key)} ${isBig ? 'row-span-2 h-full' : ''} `}
              >
                {key === '←' ? <BackspaceIcon /> : key}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Keypad;
