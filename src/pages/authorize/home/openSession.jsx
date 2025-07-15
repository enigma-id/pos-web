import React from 'react';

import { Input } from '../../../components/ui';
import useSession from '../../../services/sales/session/hook';

const OpenSection = () => {
  const { start, startResult } = useSession();
  const [cash, setCash] = React.useState('');

  const onSubmit = async () => {
    const payload = {
      cash: parseFloat(cash),
    };

    start(payload);
  };

  return (
    <div className="border-base-200 bg-base-100 flex h-screen flex-col border-t border-l">
      <div className="border-base-200 flex h-[62px] items-center gap-4 border-b px-6">
        <h2 className="text-xl font-bold">Open Sales Session</h2>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto px-6 py-4">
        <div className="bg-accent mb-3 rounded-md p-4 text-[16px]">
          You are about to start a sales session. All transactions made will be grouped into this
          session, making it easier to manage and track your cash flow.
        </div>
        <label>Starting Cash</label>
        <Input value={cash} onChange={e => setCash(e?.target?.value)} />
        <small className="text-gray-500">
          Enter the amount of cash in the drawer at the start of the session.
        </small>
      </div>

      <div className="border-base-200 me-4 min-h-15 border-t px-6 py-4 pt-3">
        <button
          className={`btn btn-block btn-xl btn-primary rounded-none ${startResult?.isLoading ? 'btn-disabled' : ''}`}
          onClick={onSubmit}
        >
          Start Session
          {startResult?.isLoading && <span className="loading loading-spinner"></span>}
        </button>
      </div>
    </div>
  );
};

export default OpenSection;
