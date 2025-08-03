import Input from './input';

const QuantityStepper = ({ value, onChange, small, disableIncrement = false }) => {
  const increment = () => {
    if (!disableIncrement) {
      onChange(value + 1);
    }
  };

  const decrement = () => {
    onChange(value - 1);
  };

  const isDecrementDisabled = value === 0;

  const handleChangeInput = e => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    const parsed = raw === '' ? 0 : parseInt(raw, 10);

    onChange(parsed);
  };

  return (
    <div className={`flex items-center justify-between rounded-full ${small ? 'w-32' : 'w-full'}`}>
      <button
        className={`btn btn-primary ${small ? 'btn-sm' : 'btn-lg'}`}
        disabled={isDecrementDisabled}
        onClick={decrement}
      >
        -
      </button>
      {/* <div className={`${small ? 'text-sm' : 'text-lg'} font-semibold`}>{value}</div> */}
      <Input
        value={value}
        onChange={handleChangeInput}
        className={`-mt-2 !w-full !border-0 !bg-transparent text-center focus:!shadow-none ${small ? '!h-8 !min-h-8 !text-sm' : '!h-12 !text-lg'}`}
      />
      <button
        className={`btn btn-primary ${small ? 'btn-sm' : 'btn-lg'}`}
        disabled={disableIncrement}
        onClick={increment}
      >
        +
      </button>
    </div>
  );
};

export default QuantityStepper;
