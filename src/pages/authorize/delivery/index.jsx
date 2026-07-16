import { useEffect, useState } from 'react';

import { Input } from '../../../components/ui';
import { SearchIcon } from '../../../components/ui/icon';
import useDelivery from '../../../services/delivery/hook';
import { currencyFormat } from '../../../utils/common';

const DeliveryPage = () => {
  const { getPlan, planResult, receive, receiveResult } = useDelivery();
  const [refCode, setRefCode] = useState('');
  const [quantities, setQuantities] = useState({});

  const plan = planResult?.data?.data || planResult?.data || null;
  const items = plan?.items || [];

  const handleSearch = () => {
    if (!refCode.trim()) return;
    getPlan(refCode.trim());
  };

  useEffect(() => {
    if (items.length > 0) {
      const initial = {};
      items.forEach((item, i) => {
        initial[i] = item?.quantity ?? 0;
      });
      setQuantities(initial);
    }
  }, [items]);

  const handleReceive = () => {
    const receivedItems = items.map((item, i) => ({
      catalog_id: item?.catalog_id ?? item?.id ?? item?.catalog?.id,
      quantity_received: Number(quantities[i]) || 0,
      quantity_planned: item?.quantity || 0,
    }));

    receive({
      ref_code: refCode.trim(),
      items: receivedItems,
    });
  };

  return (
    <div className="flex h-screen flex-col">
      <div className="border-base-200 bg-base-100 flex min-h-16 place-content-between place-items-center border-b px-6">
        <h2 className="text-xl font-bold">Delivery Receive</h2>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
        {/* Search */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              label="Reference Code"
              placeholder="Enter delivery reference code..."
              value={refCode}
              onChange={e => setRefCode(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
            />
          </div>
          <div
            className={`btn btn-primary btn-lg mt-6 ${planResult?.isLoading ? 'btn-disabled' : ''}`}
            onClick={handleSearch}
          >
            <SearchIcon />
            {planResult?.isLoading ? 'Searching...' : 'Search'}
          </div>
        </div>

        {/* Error */}
        {planResult?.isError && (
          <div className="alert alert-error">
            <span>Failed to load delivery plan. Check the reference code.</span>
          </div>
        )}

        {/* Plan Detail */}
        {plan && (
          <>
            <div className="bg-accent rounded-box p-4">
              <div className="mb-2 grid grid-cols-2 gap-4 text-sm">
                <div><span className="font-semibold">Ref Code:</span> {plan?.ref_code || refCode}</div>
                <div><span className="font-semibold">Status:</span> {plan?.status || '-'}</div>
                <div><span className="font-semibold">Supplier:</span> {plan?.supplier_name || '-'}</div>
                <div><span className="font-semibold">Date:</span> {plan?.delivery_date || '-'}</div>
              </div>
            </div>

            {/* Items Table */}
            <div className="flex-1 overflow-y-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-center">Planned</th>
                    <th className="text-center">Received</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i}>
                      <td>
                        <div className="font-semibold">{item?.catalog?.name || item?.name || '-'}</div>
                        {item?.catalog?.code && (
                          <div className="text-base-300 text-xs">{item?.catalog?.code}</div>
                        )}
                      </td>
                      <td className="text-center align-middle">{item?.quantity || 0}</td>
                      <td className="text-center align-middle">
                        <input
                          type="number"
                          min={0}
                          max={item?.quantity || 0}
                          className="input input-sm input-bordered w-20 text-center"
                          value={quantities[i] ?? item?.quantity ?? 0}
                          onChange={e => {
                            const val = parseInt(e.target.value, 10) || 0;
                            setQuantities(prev => ({ ...prev, [i]: Math.min(val, item?.quantity || 0) }));
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Receive Button */}
            <div>
              <div
                className={`btn btn-primary btn-block btn-lg ${receiveResult?.isLoading ? 'btn-disabled' : ''}`}
                onClick={handleReceive}
              >
                {receiveResult?.isLoading ? (
                  <>
                    <span className="loading loading-spinner"></span>
                    Processing...
                  </>
                ) : (
                  'Confirm Receive'
                )}
              </div>

              {receiveResult?.isSuccess && (
                <div className="alert alert-success mt-2">
                  <span>Delivery received successfully!</span>
                </div>
              )}

              {receiveResult?.isError && (
                <div className="alert alert-error mt-2">
                  <span>Failed to process receive. Try again.</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Empty State */}
        {!plan && !planResult?.isLoading && !planResult?.isError && (
          <div className="flex flex-1 place-content-center place-items-center">
            <div className="text-base-300 text-center">
              <div className="text-4xl">📦</div>
              <p className="mt-2 text-lg font-semibold">Search a delivery plan</p>
              <p className="text-sm">Enter a reference code above to load a delivery plan.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliveryPage;
