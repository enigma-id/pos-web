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

  return (
    <div className={`flex items-center justify-between rounded-full ${small ? 'w-25' : 'w-full'}`}>
      <button
        className={`btn btn-primary ${small ? 'btn-sm' : 'btn-lg'}`}
        disabled={isDecrementDisabled}
        onClick={decrement}
      >
        -
      </button>
      <div className={`${small ? 'text-sm' : 'text-lg'} font-semibold`}>{value}</div>
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
