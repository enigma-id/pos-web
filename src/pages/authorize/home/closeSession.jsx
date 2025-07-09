import React from 'react';
import useSession from '../../../services/sales/session/hook';
import { Input } from '../../../components/ui';
import { currencyFormat, dateFormat } from '../../../utils/common';
import useSidebar from '../../../components/ui/sidebar/hook';

const CloseSection = () => {
  const { summary, summaryResult, end, endResult } = useSession();
  const { showCart } = useSidebar();

  const [cash, setCash] = React.useState('');
  const [diff, setDiff] = React.useState(0);

  const onSubmit = async () => {
    const payload = {
      cash: Number(cash),
    };

    end(payload);
  };

  React.useEffect(() => {
    summary();
  }, []);

  const List = ({ title, value }) => {
    return (
      <div className="border-secondary mb-3 flex items-center justify-between border-b py-1">
        <div className="text-sm font-thin">{title} :</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    );
  };

  return (
    <div className="border-secondary flex h-[calc(100vh-116px)] flex-col border-t border-l bg-white">
      <div className="border-secondary flex h-[63px] items-center gap-4 border-b px-6">
        <div className="btn btn-md btn-outline btn-circle border-base-300" onClick={showCart}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M7.91664 5.41675L3.45116 9.88223C3.38607 9.94732 3.38607 10.0528 3.45116 10.1179L7.91664 14.5834M3.40234 10.0001H16.6666"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold">Sales Session</h2>
      </div>
      <div className="mt-4 flex-1 overflow-y-auto px-6 py-4">
        <List title="Session Started" value={dateFormat(summaryResult?.data?.data?.started_at)} />
        <List title="Cashier" value={summaryResult?.data?.data?.cashier?.name} />
        <List
          title="Starting Cash"
          value={currencyFormat(summaryResult?.data?.data?.cash_started || 0)}
        />
        <List
          title="Total Transactions"
          value={currencyFormat(summaryResult?.data?.data?.subtotal_order || 0)}
        />

        <div className="bg-base-300 mb-3 rounded-md p-4">
          {summaryResult?.data?.data?.cash_payments?.map((pm, i) => (
            <List
              key={i}
              title={pm?.payment_name === '' ? 'Cash' : pm?.payment_name}
              value={currencyFormat(pm?.subtotal || 0)}
            />
          ))}
        </div>

        <div className="mb-3">
          <div className="text-sm font-thin">Ending Cash</div>
          <Input
            value={cash}
            type="number"
            onChange={e => {
              setCash(e?.target?.value);

              const different =
                Number(e?.target?.value) - Number(summaryResult?.data?.data?.cash_due || 0);

              setDiff(isNaN(different) ? 0 : different);
            }}
          />
        </div>

        {cash > 0 && diff !== 0 && (
          <div className="border-secondary mb-3 flex items-center justify-between border-b py-1">
            <div className="text-sm font-thin">Difference:</div>
            <div className="text-error text-sm font-semibold">{currencyFormat(diff)}</div>
          </div>
        )}
      </div>

      <div className="border-secondary min-h-15 border-t px-6 py-4">
        <button
          className={`btn btn-block btn-md btn-primary rounded-full ${endResult?.isLoading ? 'btn-disabled' : ''}`}
          onClick={onSubmit}
        >
          {endResult?.isLoading && <span className="loading loading-spinner"></span>}
          End Session
        </button>
      </div>
    </div>
  );
};

export default CloseSection;
