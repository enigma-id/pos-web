
const QuantityStepper = ({ value, onChange, small }) => {
  const increment = () => onChange(value + 1);
  const decrement = () => {
    onChange(value - 1);
  };

  const isDisabled = () => {
    value === 0 ? 'btn-disabled' : '';
  };

  return (
    <div
      className={`border-secondary flex items-center justify-between rounded-full border ${small ? 'w-25' : 'w-full'}`}
    >
      <div
        className={`btn btn-circle btn-primary ${isDisabled()} ${small ? 'btn-sm' : ''}`}
        disabled={value === 0}
        onClick={decrement}
      >
        -
      </div>
      <div className={`${small ? 'text-sm' : 'text-lg'} font-medium`}>{value}</div>
      <div className={`btn btn-circle btn-primary ${small ? 'btn-sm' : ''}`} onClick={increment}>
        +
      </div>
    </div>
  );
};

export default QuantityStepper;
