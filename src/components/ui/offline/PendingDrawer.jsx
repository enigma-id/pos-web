import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';

import { syncPendingSessions } from '../../../services/offline';
import { ensureDB, STORES } from '../../../services/offline/queue';
import { FiRefreshCw } from 'react-icons/fi';
import { currencyFormat, dateFormat } from '../../../utils/common';

const statusConfig = {
  failed: { badge: 'badge-error', icon: '✕' },
  syncing: { badge: 'badge-warning', icon: '↻' },
  pending: { badge: 'badge-info', icon: '◷' },
};

const PendingDrawer = ({ open, onClose, onOpenBill, onRemove }) => {
  const sessionUserId = useSelector(state => state?.Auth?.session?.user?.id);
  const [activeTab, setActiveTab] = useState('order');
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState({
    orders: [],
    bills: [],
    topups: [],
    memberships: [],
    sessions: [],
  });

  // Fetch data from IndexedDB directly when drawer opens
  useEffect(() => {
    if (!open || !sessionUserId) return;

    const fetchData = async () => {
      try {
        const db = await ensureDB(sessionUserId);

        const sessions = await db.getAll(STORES.sessions);
        const bills = await db.getAll(STORES.orderBills);
        const payments = await db.getAll(STORES.orderPayments);
        const topups = await db.getAll(STORES.topups);
        const memberships = await db.getAll(STORES.memberships);

        setData({
          orders: payments,
          bills: bills,
          topups,
          memberships,
          sessions: sessions,
        });
      } catch (err) {
        console.error('[PendingDrawer] fetch error:', err);
      }
    };

    fetchData();
  }, [open, sessionUserId, refreshKey]);

  const hasPendingOrFailed = useMemo(() => {
    return data.sessions.some(s => s.syncStatus === 'pending' || s.syncStatus === 'failed');
  }, [data]);

  // Build categorized items
  const categorized = useMemo(() => {
    const result = { order: [], bills: [], shifts: [], member: [], failedCount: {} };

    // Tab Bills
    result.bills = data.bills;

    // Tab Order
    result.order = data.orders;

    // Tab Shifts
    result.shifts = data.sessions;

    // Tab Member — memberships
    data.memberships.forEach(m => {
      result.member.push({ ...m, sync_type: 'membership' });
    });

    // Tab Member — topups
    data.topups.forEach(t => {
      result.member.push({ ...t, sync_type: 'topup' });
    });

    return result;
  }, [data]);

  const filteredItems = categorized[activeTab] || [];

  if (!open) return null;

  const tabs = [
    { id: 'order', label: 'Order', icon: '🛒' },
    { id: 'bills', label: 'Bills', icon: '📋' },
    { id: 'member', label: 'Member', icon: '👤' },
    { id: 'shifts', label: 'Shifts', icon: '💼' },
  ];

  const activeIndex = tabs.findIndex(t => t.id === activeTab);

  const Tab = ({ id, label, icon, isActive }) => {
    const count = categorized[id]?.length || 0;
    return (
      <button
        className={`relative z-10 flex h-10 flex-1 items-center justify-center gap-1.5 transition-colors duration-300 ${
          isActive ? 'text-primary-content' : 'text-base-content/40 hover:text-base-content/70'
        }`}
        onClick={() => setActiveTab(id)}
      >
        <span className={`text-lg transition-transform ${isActive ? 'scale-110' : 'scale-90'}`}>
          {icon}
        </span>
        {isActive && (
          <span className="animate-in fade-in text-[11px] font-bold tracking-tight capitalize duration-300">
            {label}
          </span>
        )}
        {count > 0 && (
          <span
            className={`badge badge-xs h-3.5 min-w-4 ${
              isActive
                ? 'bg-primary-content text-primary border-none'
                : 'badge-neutral border-none text-white'
            } text-[8px] tabular-nums`}
          >
            {count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="bg-base-100 animate-fade-slide flex h-full w-105 flex-col overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
        style={{ '--tw-translate-x': '100%' }}
      >
        {/* Header */}
        <div className="border-base-200 bg-base-100 flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base-content text-sm font-black tracking-widest uppercase">
              Queue Manager
            </h3>
            {hasPendingOrFailed && (
              <button
                className="btn btn-ghost btn-xs btn-circle"
                onClick={() => syncPendingSessions()}
              >
                <FiRefreshCw className="h-4 w-4" />
              </button>
            )}
          </div>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Sliding Pill Tabs */}
        <div className="mx-4 mt-3 mb-1">
          <div className="bg-base-200/60 border-base-300/30 relative flex h-12 rounded-xl border p-1">
            <div
              className="bg-primary absolute top-1 h-[calc(100%-8px)] rounded-lg shadow-md transition-all duration-300 ease-in-out"
              style={{
                width: 'calc(25% - 4px)',
                left: `calc(${activeIndex * 25}% + 2px)`,
              }}
            />
            {tabs.map(tab => (
              <Tab key={tab.id} {...tab} isActive={activeTab === tab.id} />
            ))}
          </div>
        </div>

        {/* List */}
        <div className="bg-base-200/20 flex-1 space-y-2 overflow-y-auto p-3">
          {filteredItems.length === 0 && (
            <div className="text-base-content/30 flex flex-col items-center justify-center py-12 italic">
              <span className="mb-3 text-4xl opacity-20">
                {activeTab === 'member'
                  ? '👤'
                  : activeTab === 'order'
                    ? '🛒'
                    : activeTab === 'bills'
                      ? '📋'
                      : '💼'}
              </span>
              <span className="text-xs font-medium">No {activeTab} items in queue</span>
            </div>
          )}

          {filteredItems.map(item => {
            if (activeTab === 'shifts') {
              const sessionLabel =
                item.sync_type === 'both'
                  ? 'Open & Close Session'
                  : item.sync_type === 'opened'
                    ? 'Open Session'
                    : 'Close Session';
              const sessionIcon =
                item.sync_type === 'both' ? '🔄' : item.sync_type === 'opened' ? '🚪' : '🏁';
              const sessionColor =
                item.sync_type === 'both'
                  ? 'badge-info'
                  : item.sync_type === 'opened'
                    ? 'badge-success'
                    : 'badge-warning';

              return (
                <div
                  key={item.id}
                  className="border-base-200 bg-base-100 hover:border-base-300 overflow-hidden rounded-lg border transition-colors"
                >
                  <div
                    className={`h-1 w-full ${item.sync_type === 'opened' ? 'bg-success' : 'bg-warning'}`}
                  />
                  <div className="p-2.5">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span
                        className={`badge badge-xs ${sessionColor} font-bold tracking-wider uppercase`}
                      >
                        {sessionIcon} {sessionLabel}
                      </span>
                      {item.sync_type !== 'both' && (
                        <span className="text-base-content/50 flex-1 truncate text-[10px] font-bold">
                          {dateFormat(item?.started_at)}
                        </span>
                      )}
                    </div>
                    {item.sync_type === 'both' && (
                      <div className="text-base-content/50 mb-1.5 flex gap-3 text-[10px] font-bold">
                        <span>Open: {dateFormat(item?.started_at)}</span>
                        <span>Close: {dateFormat(item?.finished_at)}</span>
                      </div>
                    )}
                    <div className="bg-base-200/30 rounded p-2">
                      <div className="text-base-content/40 flex justify-between text-[9px] font-bold uppercase">
                        {(item?.sync_type === 'opened' || item?.sync_type === 'both') && (
                          <span>Starting Cash</span>
                        )}
                        {(item?.sync_type === 'closed' || item?.sync_type === 'both') && (
                          <span>Ending Cash</span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center justify-between">
                        {(item?.sync_type === 'opened' || item?.sync_type === 'both') && (
                          <span className="text-base-content text-sm font-black">
                            {currencyFormat(item?.cash_started)}
                          </span>
                        )}

                        {(item?.sync_type === 'closed' || item?.sync_type === 'both') && (
                          <span className="text-base-content text-sm font-black">
                            {currencyFormat(item?.cash_finished)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            if (activeTab === 'member') {
              console.log('[DEBUG] [ITEM DATE MEMBER]', item);

              if (item.sync_type === 'membership') {
                return (
                  <div
                    key={item.id}
                    className="border-base-200 bg-base-100 hover:border-base-300 overflow-hidden rounded-lg border transition-colors"
                  >
                    <div className="bg-info h-1 w-full" />
                    <div className="p-2.5">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="badge badge-xs badge-info font-bold tracking-wider uppercase">
                          {item?.id ? 'Perbaharui Member' : 'Create Member'}
                        </span>
                      </div>
                      <div className="bg-base-200/30 rounded p-2">
                        <div className="text-base-content/40 flex justify-between text-[9px] font-bold uppercase">
                          <span>Name</span>
                          <span>Phone</span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between">
                          <span className="text-[13px] font-bold capitalize">
                            {item?.name || '-'}
                          </span>
                          <span className="text-[13px] font-bold capitalize">
                            {item?.reff_code || '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div
                    key={item.id}
                    className="border-base-200 bg-base-100 hover:border-base-300 overflow-hidden rounded-lg border transition-colors"
                  >
                    <div className="bg-success h-1 w-full" />
                    <div className="p-2.5">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="badge badge-xs badge-success font-bold tracking-wider uppercase">
                          💰 Topup
                        </span>
                      </div>
                      <div className="text-base-content/50 mb-2 flex flex-wrap items-center gap-1 text-[10px]">
                        <span className="truncate">{item?.membership?.name}</span>
                        <span>·</span>
                        <span className="whitespace-nowrap">{dateFormat(item?.created_at)}</span>
                      </div>
                      <div className="bg-base-200/30 rounded p-2">
                        <div className="text-base-content/40 flex justify-between text-[9px] font-bold uppercase">
                          <span>Payment</span>
                          <span>Amount</span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between">
                          <span className="text-[13px] font-bold capitalize">
                            {item?.payment_type || '-'}
                          </span>
                          <span className="text-success text-sm font-black">
                            {currencyFormat(item?.nominal)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-1 p-2.5 pt-0">
                        <button
                          className="btn btn-error btn-ghost btn-xs text-base-content/50"
                          onClick={async () => {
                            await onRemove?.('topup', item);
                            setRefreshKey(k => k + 1);
                          }}
                        >
                          &#10006; Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }
            }

            if (activeTab === 'bills') {
              return (
                <div
                  key={item.id}
                  className="border-base-200 bg-base-100 hover:border-base-300 overflow-hidden rounded-lg border transition-colors"
                >
                  <div className="p-2.5 pb-1.5">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="badge badge-xs badge-primary badge-outline font-bold tracking-wider uppercase">
                        Bills
                      </span>
                      <span className="text-base-content flex-1 truncate text-xs font-bold">
                        {item?.code}
                      </span>
                    </div>
                    <div className="text-base-content/50 flex flex-wrap items-center gap-1 text-[10px]">
                      <span className="max-w-24 truncate">{item?.bill_name || '-'}</span>
                      <span>·</span>
                      <span className="truncate">{item?.sales_channel?.name}</span>
                      <span>·</span>
                      <span className="whitespace-nowrap">{dateFormat(item?.created_at)}</span>
                    </div>
                  </div>

                  {item?.items.length > 0 ? (
                    <div className="collapse-arrow border-base-200 collapse rounded-none border-t">
                      <input type="checkbox" className="min-h-0" />
                      <div className="collapse-title group flex min-h-0 items-center justify-between px-2.5 py-2">
                        <span className="text-base-content/70 text-[12px] font-bold">
                          {item?.items.length} item{item?.items.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-base-content mr-6 text-[12px] font-extrabold">
                          {currencyFormat(item?.total_charges)}
                        </span>
                      </div>
                      <div className="collapse-content bg-base-200/30 px-2.5 pb-2">
                        <div className="space-y-2 pt-2">
                          {item?.items.map((product, idx) => (
                            <div key={idx} className="flex flex-col gap-0.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex min-w-0 flex-1 items-start gap-1.5">
                                  <span className="bg-base-content/80 mt-0.5 rounded px-1.5 py-0.5 text-[13px] leading-none font-bold text-white">
                                    {product.quantity}
                                  </span>
                                  <span className="truncate text-[13px] leading-tight font-bold uppercase">
                                    {product.catalog_name || product.catalog?.name || '-'}{' '}
                                    {/* catalog_name langsung, catalog?.name fallback struktural */}
                                  </span>
                                </div>
                                <span className="text-base-content/60 text-[13px] font-medium whitespace-nowrap">
                                  {currencyFormat(
                                    Number(product.unit_nett || 0) * Number(product.quantity || 0)
                                  )}
                                </span>
                              </div>
                              {product.addons?.length > 0 && (
                                <div className="border-base-content/10 ml-5 flex flex-col gap-0.5 border-l pl-2">
                                  {product.addons?.map((add, aIdx) => {
                                    const addonName = add.catalog_name || '-';
                                    const addonPrice = Number(add.unit_nett || 0);
                                    const addonQty = Number(add.quantity || 1);
                                    return (
                                      <div
                                        key={aIdx}
                                        className="text-base-content/40 flex justify-between text-[11px] italic"
                                      >
                                        <span>
                                          + {addonName} ({addonQty} x {currencyFormat(addonPrice)})
                                        </span>
                                        {addonPrice > 0 && (
                                          <span>{currencyFormat(addonQty * addonPrice)}</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border-base-200 bg-base-200/10 flex items-center justify-between border-t px-2.5 py-2">
                      <span className="text-base-content/50 text-[10px]">No items</span>
                    </div>
                  )}

                  <div className="mt-2 flex gap-1 p-2.5 pt-0">
                    <button
                      className="btn btn-primary btn-xs flex-1 gap-1"
                      onClick={() => {
                        onOpenBill?.(item);
                        onClose();
                      }}
                    >
                      📋 Open Bill
                    </button>
                    <button
                      className="btn btn-error btn-ghost btn-xs text-base-content/50"
                      onClick={async () => {
                        await onRemove?.('bill', item);
                        setRefreshKey(k => k + 1);
                      }}
                    >
                      &#10006; Remove
                    </button>
                  </div>
                </div>
              );
            }

            if (activeTab === 'order') {
              return (
                <div
                  key={item.id}
                  className="border-base-200 bg-base-100 hover:border-base-300 overflow-hidden rounded-lg border transition-colors"
                >
                  <div className="p-2.5 pb-1.5">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="badge badge-xs badge-primary badge-outline font-bold tracking-wider uppercase">
                        Orders
                      </span>
                      <span className="text-base-content flex-1 truncate text-xs font-bold">
                        {item?.code}
                      </span>
                    </div>
                    <div className="text-base-content/50 flex flex-wrap items-center gap-1 text-[10px]">
                      {item?.bill_name && (
                        <>
                          <span className="max-w-24 truncate">{item?.bill_name || '-'}</span>
                          <span>·</span>
                        </>
                      )}
                      <span className="truncate">{item?.sales_channel?.name}</span>
                      <span>·</span>
                      <span className="truncate">{item?.payment_method?.name}</span>
                      <span>·</span>
                      <span className="whitespace-nowrap">{dateFormat(item?.paid_at)}</span>
                    </div>
                  </div>

                  {item?.items.length > 0 ? (
                    <div className="collapse-arrow border-base-200 collapse rounded-none border-t">
                      <input type="checkbox" className="min-h-0" />
                      <div className="collapse-title group flex min-h-0 items-center justify-between px-2.5 py-2">
                        <span className="text-base-content/70 text-[12px] font-bold">
                          {item?.items.length} item{item?.items.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-base-content mr-6 text-[12px] font-extrabold">
                          {currencyFormat(item?.total_charges)}
                        </span>
                      </div>
                      <div className="collapse-content bg-base-200/30 px-2.5 pb-2">
                        <div className="space-y-2 pt-2">
                          {item?.items.map((product, idx) => (
                            <div key={idx} className="flex flex-col gap-0.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex min-w-0 flex-1 items-start gap-1.5">
                                  <span className="bg-base-content/80 mt-0.5 rounded px-1.5 py-0.5 text-[13px] leading-none font-bold text-white">
                                    {product.quantity}
                                  </span>
                                  <span className="truncate text-[13px] leading-tight font-bold uppercase">
                                    {product.catalog_name || product.catalog?.name || '-'}{' '}
                                    {/* catalog_name langsung, catalog?.name fallback struktural */}
                                  </span>
                                </div>
                                <span className="text-base-content/60 text-[13px] font-medium whitespace-nowrap">
                                  {currencyFormat(
                                    Number(product.unit_nett || 0) * Number(product.quantity || 0)
                                  )}
                                </span>
                              </div>
                              {product.addons?.length > 0 && (
                                <div className="border-base-content/10 ml-5 flex flex-col gap-0.5 border-l pl-2">
                                  {product.addons?.map((add, aIdx) => {
                                    const addonName = add.catalog_name || '-';
                                    const addonPrice = Number(add.unit_nett || 0);
                                    const addonQty = Number(add.quantity || 1);
                                    return (
                                      <div
                                        key={aIdx}
                                        className="text-base-content/40 flex justify-between text-[11px] italic"
                                      >
                                        <span>
                                          + {addonName} ({addonQty} x {currencyFormat(addonPrice)})
                                        </span>
                                        {addonPrice > 0 && (
                                          <span>{currencyFormat(addonQty * addonPrice)}</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border-base-200 bg-base-200/10 flex items-center justify-between border-t px-2.5 py-2">
                      <span className="text-base-content/50 text-[10px]">No items</span>
                    </div>
                  )}

                  <div className="mt-2 flex gap-1">
                    <button
                      className="btn btn-ghost btn-xs text-base-content/50"
                      onClick={async () => {
                        await onRemove?.('payment', item);
                        setRefreshKey(k => k + 1);
                      }}
                    >
                      &#10006; Remove
                    </button>
                  </div>
                </div>
              );
            }
          })}
        </div>
      </div>
    </div>
  );
};

export default PendingDrawer;
