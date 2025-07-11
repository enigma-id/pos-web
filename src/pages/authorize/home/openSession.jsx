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
    <div className="border-secondary flex h-[calc(100vh-116px)] flex-col border-t border-l bg-white">
      <div className="border-secondary flex h-[63px] items-center gap-4 border-b px-6">
        <h2 className="text-xl font-bold">Open Sales Session</h2>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto px-6 py-4">
        <div className="bg-base-300 mb-3 rounded-md p-4 text-[16px]">
          You are about to start a sales session. All transactions made will be grouped into this
          session, making it easier to manage and track your cash flow.
        </div>
        <label>Starting Cash</label>
        <Input value={cash} onChange={e => setCash(e?.target?.value)} />
        <small className="text-gray-500">
          Enter the amount of cash in the drawer at the start of the session.
        </small>
      </div>

      <div className="border-secondary me-4 min-h-15 border-t px-6 py-4 pt-3">
        <button
          className={`btn btn-block btn-md btn-primary rounded-full ${startResult?.isLoading ? 'btn-disabled' : ''}`}
          onClick={onSubmit}
        >
          {startResult?.isLoading && <span className="loading loading-spinner"></span>}
          Start Session
        </button>
      </div>
    </div>
  );
};

export default OpenSection;
