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

const PendingDrawer = ({ open, onClose, onRetry, onOpenBill, onRemove, onRefresh }) => {
  const userId = useSelector(state => state?.Auth?.session?.user?.id);
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
    if (!open || !userId) return;

    const fetchData = async () => {
      try {
        const db = await ensureDB(userId);

        const sessions = await db.getAll(STORES.sessions);
        const bills = await db.getAll(STORES.orderBills);
        const payments = await db.getAll(STORES.orderPayments);
        const topups = await db.getAll(STORES.topups);
        const memberships = await db.getAll(STORES.memberships);

        setData({
          orders: payments.filter(p => p.status === 'completed'),
          bills: bills.filter(b => b.status === 'pending' && b.is_show !== false),
          topups,
          memberships,
          sessions: sessions.filter(s => s.syncStatus !== 'synced'),
        });
      } catch (err) {
        console.error('[PendingDrawer] fetch error:', err);
      }
    };

    fetchData();
  }, [open, userId, refreshKey]);

  const hasPendingOrFailed = useMemo(() => {
    return data.sessions.some(s => s.syncStatus === 'pending' || s.syncStatus === 'failed');
  }, [data]);

  // Flatten sessions for shifts tab
  const shiftItems = useMemo(() => {
    return data.sessions
      .map(s => {
        const isClosed = !!s.close_at;
        const isOfflineSession = !s.id;
        const skipShift = !isOfflineSession && !isClosed;
        return {
          id: s.sync_id,
          sync_id: s.sync_id,
          _type: 'session',
          status: s.syncStatus || 'pending',
          lastError: s.error || null,
          createdAt: isClosed ? s.close_at : s.createdAt || s.open_at,
          body: {
            cash: isClosed ? s.cash_finished || s.cash_started : s.cash_started,
            cash_started: s.cash_started,
            cash_finished: s.cash_finished,
            open_at: s.open_at,
            close_at: s.close_at,
            orderCount:
              data.bills.filter(b => b.origin_session_sync_id === s.sync_id).length +
              data.orders.filter(o => o.paid_session_sync_id === s.sync_id).length,
          },
          transaction_preview: {
            code: `SES-${(s.sync_id || '').slice(0, 8)}`,
            cashier: { name: '-' },
            session: { cashier: { name: '-' } },
            created_at: isClosed ? s.close_at : s.createdAt || s.open_at,
          },
        };
      })
      .filter(s => !s.skipShift);
  }, [data.sessions, data.bills, data.orders]);

  // Build categorized items
  const categorized = useMemo(() => {
    const result = { order: [], bills: [], shifts: [], member: [], failedCount: {} };

    // Tab Bills
    result.bills = data.bills.map(b => ({
      ...b,
      id: b.sync_id,
      _type: 'bill',
      status: b.status || 'pending',
      lastError: null,
      transaction_preview: {
        code: b.code,
        bill_name: b.bill_name,
        sales_channel: b.sales_channel,
        payment_method: b.payment_method,
        session: b.session,
        item_count: (b.items || []).length,
        total_charges: b.total_charges || 0,
        items: b.items || [],
        created_at: b.createdAt,
      },
    }));

    // Tab Order
    result.order = data.orders.map(p => ({
      ...p,
      id: p.sync_id,
      _type: 'payment',
      status: p.status || 'completed',
      lastError: null,
      transaction_preview: {
        code: p.code || `OFF-${(p.sync_id || '').slice(0, 8)}`,
        bill_name: p.bill_name,
        channel: { name: p.sales_channel_name || '-' },
        payment_method: {
          name:
            p.payment_method_name ||
            (p.payment_method_id === 0 || p.payment_method_id === null
              ? 'Cash'
              : '#' + p.payment_method_id),
        },
        cashier: { name: p.cashier_name || '-' },
        item_count: (p.items || []).length,
        total_charges: p.total_payment || 0,
        items: p.items || [],
        created_at: p.paid_at || p.createdAt,
      },
    }));

    // Tab Shifts
    result.shifts = shiftItems;

    // Tab Member — topups
    data.topups.forEach(t => {
      result.member.push({
        ...t,
        _type: 'topup',
        id: t.sync_id,
        status: 'pending',
        lastError: null,
        transaction_preview: {
          code: `TOP-${(t.sync_id || '').slice(0, 8)}`,
          nominal: t.nominal,
          payment_type: t.payment_type,
          member_name: t.member_name,
          member_code: t.member_code,
          created_at: t.created_at,
        },
      });
    });

    // Tab Member — memberships
    data.memberships.forEach(m => {
      result.member.push({
        ...m,
        _type: 'membership',
        id: m.sync_id,
        status: 'pending',
        lastError: null,
        transaction_preview: {
          code: `MEM-${(m.sync_id || '').slice(0, 8)}`,
          member_name: m.name,
          member_code: m.reff_code,
          created_at: m.created_at,
        },
      });
    });

    return result;
  }, [data, shiftItems]);

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
            const preview = item?.transaction_preview || {};
            const itemCount =
              Number(preview?.item_count) || preview?.items?.length || item?.items?.length || 0;
            const createdAt = preview?.created_at || item?.paid_at || item?.createdAt;
            const status = statusConfig[item.status] || statusConfig.pending;
            const itemsList = preview?.items || item?.items || [];

            const apiType =
              item._type === 'topup'
                ? 'topup'
                : item._type === 'membership'
                  ? 'create member'
                  : item._type === 'session'
                    ? item.body?.cash_started != null && item.body?.cash_finished != null
                      ? 'both'
                      : item.body?.cash_finished
                        ? 'close'
                        : 'start'
                    : item.status === 'pending'
                      ? 'save bill'
                      : 'checkout';

            const isSession = apiType === 'start' || apiType === 'close' || apiType === 'both';

            if (isSession) {
              const sessionLabel =
                apiType === 'both'
                  ? 'Open & Close Session'
                  : apiType === 'start'
                    ? 'Open Session'
                    : 'Close Session';
              const sessionIcon = apiType === 'both' ? '🔄' : apiType === 'start' ? '🚪' : '🏁';
              const sessionColor =
                apiType === 'both'
                  ? 'badge-info'
                  : apiType === 'start'
                    ? 'badge-success'
                    : 'badge-warning';
              const cashAmount = item?.body?.cash || 0;

              return (
                <div
                  key={item.id}
                  className="border-base-200 bg-base-100 hover:border-base-300 overflow-hidden rounded-lg border transition-colors"
                >
                  <div
                    className={`h-1 w-full ${apiType === 'start' ? 'bg-success' : 'bg-warning'}`}
                  />
                  <div className="p-2.5">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span
                        className={`badge badge-xs ${sessionColor} font-bold tracking-wider uppercase`}
                      >
                        {sessionIcon} {sessionLabel}
                      </span>
                      {apiType !== 'both' && (
                        <span className="text-base-content/50 flex-1 truncate text-[10px] font-bold">
                          {dateFormat(createdAt)}
                        </span>
                      )}
                      <span className={`badge badge-xs ${status.badge} gap-0.5`}>
                        <span className="text-[9px]">{status.icon}</span>
                        {item.status}
                      </span>
                    </div>
                    {apiType === 'both' && (
                      <div className="text-base-content/50 mb-1.5 flex gap-3 text-[10px] font-bold">
                        <span>Open: {dateFormat(item?.body?.open_at || item?.createdAt)}</span>
                        <span>Close: {dateFormat(item?.body?.close_at || createdAt)}</span>
                      </div>
                    )}
                    <div className="bg-base-200/30 flex items-center justify-between rounded p-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-base-content/40 text-[9px] font-bold uppercase">
                          {apiType === 'both'
                            ? 'Starting Cash'
                            : apiType === 'start'
                              ? 'Starting Cash'
                              : 'Ending Cash'}
                        </span>
                        <span className="text-base-content text-sm font-black">
                          {currencyFormat(
                            apiType === 'both'
                              ? item?.body?.cash_started || item?.body?.cash
                              : cashAmount
                          )}
                        </span>
                        {apiType === 'both' && (
                          <>
                            <span className="text-base-content/40 text-[9px] font-bold uppercase">
                              Ending Cash
                            </span>
                            <span className="text-base-content text-sm font-black">
                              {currencyFormat(item?.body?.cash || 0)}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-base-content/40 block text-[9px] font-bold uppercase">
                          Total Orders
                        </span>
                        <span className="text-[10px] font-bold">{item?.body?.orderCount || 0}</span>
                      </div>
                    </div>
                    {item.lastError && (
                      <div className="text-error bg-error/10 mt-2 rounded px-2 py-1 text-[10px] leading-tight">
                        {item.lastError}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            if (apiType === 'topup') {
              const nominal = Number(preview?.nominal || item?.nominal || 0);
              const memberName = preview?.member_name || item?.member_name || '-';

              return (
                <div
                  key={item.id}
                  className="border-base-200 bg-base-100 hover:border-base-300 overflow-hidden rounded-lg border transition-colors"
                >
                  <div className="bg-info h-1 w-full" />
                  <div className="p-2.5">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="badge badge-xs badge-info font-bold tracking-wider uppercase">
                        💰 Topup
                      </span>
                      <span className="flex-1" />
                      <span className={`badge badge-xs ${status.badge} gap-0.5`}>
                        <span className="text-[9px]">{status.icon}</span>
                        {item.status}
                      </span>
                    </div>
                    <div className="text-base-content/50 mb-2 flex flex-wrap items-center gap-1 text-[10px]">
                      <span className="truncate">{memberName}</span>
                      <span>·</span>
                      <span className="whitespace-nowrap">{dateFormat(createdAt)}</span>
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
                          {currencyFormat(nominal)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-1">
                      <button
                        className="btn btn-ghost btn-xs text-base-content/50"
                        onClick={async () => {
                          await onRemove?.(item.id);
                          setRefreshKey(k => k + 1);
                        }}
                      >
                        🗑️ Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            // Default render for bills & orders
            return (
              <div
                key={item.id}
                className="border-base-200 bg-base-100 hover:border-base-300 overflow-hidden rounded-lg border transition-colors"
              >
                <div className="p-2.5 pb-1.5">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="badge badge-xs badge-primary badge-outline font-bold tracking-wider uppercase">
                      {apiType}
                    </span>
                    <span className="text-base-content flex-1 truncate text-xs font-bold">
                      {preview?.code}
                    </span>
                    <span className={`badge badge-xs ${status.badge} gap-0.5`}>
                      <span className="text-[9px]">{status.icon}</span>
                      {item.status}
                    </span>
                  </div>
                  <div className="text-base-content/50 flex flex-wrap items-center gap-1 text-[10px]">
                    {preview?.bill_name && (
                      <>
                        <span className="max-w-24 truncate">{preview?.bill_name || '-'}</span>
                        <span>·</span>
                      </>
                    )}
                    <span className="truncate">{preview?.sales_channel?.name}</span>
                    <span>·</span>
                    {preview?.payment_method && (
                      <>
                        <span className="truncate">{preview?.payment_method?.name}</span>
                        <span>·</span>
                      </>
                    )}
                    <span className="whitespace-nowrap">{dateFormat(preview?.created_at)}</span>
                  </div>
                </div>

                {itemsList.length > 0 ? (
                  <div className="collapse-arrow border-base-200 collapse rounded-none border-t">
                    <input type="checkbox" className="min-h-0" />
                    <div className="collapse-title group flex min-h-0 items-center justify-between px-2.5 py-2">
                      <span className="text-base-content/70 text-[12px] font-bold">
                        {itemCount} item{itemCount !== 1 ? 's' : ''}
                      </span>
                      <span className="text-base-content mr-6 text-[12px] font-extrabold">
                        {currencyFormat(preview?.total_charges)}
                      </span>
                    </div>
                    <div className="collapse-content bg-base-200/30 px-2.5 pb-2">
                      <div className="space-y-2 pt-2">
                        {itemsList.map((product, idx) => (
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

                {item.lastError && (
                  <div className="text-error bg-error/10 mx-2.5 mb-1.5 rounded px-2 py-1 text-[10px] leading-tight">
                    {item.lastError}
                  </div>
                )}

                <div className="flex gap-1 p-2.5 pt-0">
                  {apiType === 'save bill' && item.status === 'pending' && (
                    <button
                      className="btn btn-primary btn-xs flex-1 gap-1"
                      onClick={() => {
                        onOpenBill?.(item);
                        onClose();
                      }}
                    >
                      📋 Open Bill
                    </button>
                  )}
                  {item.status === 'pending' && (
                    <button
                      className="btn btn-error btn-ghost btn-xs text-base-content/50"
                      onClick={async () => {
                        await onRemove?.(item.id);
                        setRefreshKey(k => k + 1);
                      }}
                    >
                      &#10006; Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PendingDrawer;
