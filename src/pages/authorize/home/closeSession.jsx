import React from 'react';

import { Input } from '../../../components/ui';
import { BackIcon } from '../../../components/ui/icon';
import useSidebar from '../../../components/ui/sidebar/hook';
import useSession from '../../../services/sales/session/hook';
import { currencyFormat, dateFormat } from '../../../utils/common';

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
          <BackIcon />
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
