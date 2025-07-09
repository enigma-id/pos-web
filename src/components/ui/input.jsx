import React from 'react';
import { FaRegEye, FaRegEyeSlash } from 'react-icons/fa';

const Input = ({ id, label, required, error, value, type, disabled, onChange }) => {
  const [secured, setSecured] = React.useState('password');

  const renderLabel = () => {
    return (
      label && (
        <label htmlFor={id} className="">
          <span className="text-[10px] leading-[1.2] font-bold tracking-[.6px] uppercase">
            {label} {required && <span className="text-error">*</span>}
          </span>
        </label>
      )
    );
  };

  const renderError = () => {
    return (
      error && <div className="text-error pt-1 text-xs leading-[1.66] font-medium">{error}</div>
    );
  };

  return (
    <div>
      <div className="flex items-center gap-5 pb-2">{renderLabel()}</div>
      <div className="relative">
        <input
          id={id}
          className={`input ${error ? `input-error !border-error` : `input-neutral`}`}
          type={type === 'password' ? secured : type}
          value={value}
          disabled={disabled}
          onChange={onChange}
        />

        {type === 'password' && (
          <div className="absolute top-3.5 right-4 flex h-auto w-5 cursor-pointer">
            {secured === 'password' ? (
              <FaRegEyeSlash size={20} onClick={() => setSecured('text')} />
            ) : (
              <FaRegEye size={20} onClick={() => setSecured('password')} />
            )}
          </div>
        )}
      </div>
      {renderError()}
    </div>
  );
};

export default Input;
