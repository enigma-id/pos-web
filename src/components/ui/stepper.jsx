const QuantityStepper = ({ value, onChange, small }) => {
  const increment = () => onChange(value + 1);
  const decrement = () => {
    onChange(value - 1);
  };

  const isDisabled = () => {
    value === 0 ? 'btn-disabled' : '';
  };

  return (
    <div className={`flex items-center justify-between rounded-full ${small ? 'w-25' : 'w-full'}`}>
      <div
        className={`btn btn-primary ${isDisabled()} ${small ? 'btn-sm' : 'btn-lg'}`}
        disabled={value === 0}
        onClick={decrement}
      >
        -
      </div>
      <div className={`${small ? 'text-sm' : 'text-lg'} font-semibold`}>{value}</div>
      <div className={`btn btn-primary ${small ? 'btn-sm' : 'btn-lg'}`} onClick={increment}>
        +
      </div>
    </div>
  );
};

export default QuantityStepper;
