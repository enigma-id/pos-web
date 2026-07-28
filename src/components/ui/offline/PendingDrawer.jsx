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
  }, [open, userId]);

  const hasPendingOrFailed = useMemo(() => {
    return data.sessions.some(s => s.syncStatus === 'pending' || s.syncStatus === 'failed');
  }, [data]);

  // Flatten sessions for shifts tab
  const shiftItems = useMemo(() => {
    return data.sessions.map(s => {
      const isClosed = !!s.close_at;
      const isOfflineSession = !s.id;
      const skipShift = !isOfflineSession && !isClosed;
      return {
        id: s.sync_id,
        sync_id: s.sync_id,
        _type: 'session',
        status: s.syncStatus || 'pending',
        lastError: s.error || null,
        createdAt: isClosed ? s.close_at : (s.createdAt || s.open_at),
        body: {
          cash: isClosed ? (s.cash_finished || s.cash_started) : s.cash_started,
          cash_started: s.cash_started,
          cash_finished: s.cash_finished,
          open_at: s.open_at,
          close_at: s.close_at,
          orderCount: data.bills.filter(b => b.origin_session_sync_id === s.sync_id).length + data.orders.filter(o => o.paid_session_sync_id === s.sync_id).length,
        },
        transaction_preview: {
          code: `SES-${(s.sync_id || '').slice(0, 8)}`,
          cashier: { name: '-' },
          session: { cashier: { name: '-' } },
          created_at: isClosed ? s.close_at : (s.createdAt || s.open_at),
        },
      };
    }).filter(s => !s.skipShift);
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
        code: b.code || `OFF-${(b.sync_id || '').slice(0, 8)}`,
        bill_name: b.bill_name,
        channel: { name: b.sales_channel_name || '-' },
        payment_method: { name: b.payment_method_name || (b.payment_method_id === 0 || b.payment_method_id === null ? 'Cash' : '#' + b.payment_method_id) },
        cashier: { name: b.cashier_name || '-' },
        item_count: (b.items || []).length,
        total_charges: b.total_payment || 0,
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
        payment_method: { name: p.payment_method_name || (p.payment_method_id === 0 || p.payment_method_id === null ? 'Cash' : '#' + p.payment_method_id) },
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
        className={`relative z-10 flex-1 h-10 flex items-center justify-center transition-colors duration-300 gap-1.5 ${
          isActive ? 'text-primary-content' : 'text-base-content/40 hover:text-base-content/70'
        }`}
        onClick={() => setActiveTab(id)}
      >
        <span className={`text-lg transition-transform ${isActive ? 'scale-110' : 'scale-90'}`}>
          {icon}
        </span>
        {isActive && (
          <span className="capitalize text-[11px] font-bold tracking-tight animate-in fade-in duration-300">
            {label}
          </span>
        )}
        {count > 0 && (
          <span
            className={`badge badge-xs min-w-4 h-3.5 ${
              isActive
                ? 'bg-primary-content text-primary border-none'
                : 'badge-neutral text-white border-none'
            } tabular-nums text-[8px]`}
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
        className="bg-base-100 h-full w-105 shadow-2xl overflow-hidden flex flex-col animate-fade-slide"
        onClick={e => e.stopPropagation()}
        style={{ '--tw-translate-x': '100%' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-200 bg-base-100">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-black text-base-content uppercase tracking-widest">
              Queue Manager
            </h3>
            {hasPendingOrFailed && (
              <button className="btn btn-ghost btn-xs btn-circle" onClick={() => syncPendingSessions()}>
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
          <div className="bg-base-200/60 p-1 rounded-xl flex relative border border-base-300/30 h-12">
            <div
              className="absolute h-[calc(100%-8px)] top-1 bg-primary rounded-lg transition-all duration-300 ease-in-out shadow-md"
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
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-base-200/20">
          {filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-base-content/30 italic">
              <span className="text-4xl mb-3 opacity-20">
                {activeTab === 'member' ? '👤' : activeTab === 'order' ? '🛒' : activeTab === 'bills' ? '📋' : '💼'}
              </span>
              <span className="text-xs font-medium">No {activeTab} items in queue</span>
            </div>
          )}

          {filteredItems.map(item => {
            const preview = item?.transaction_preview || {};
            const code = preview?.code || item?.code || `OFF-${item?.sync_id?.slice(0, 8) || item?.id}`;
            const channelName = preview?.channel?.name || item?.sales_channel_name || item?.sales_channel_id || '-';
            const paymentName = preview?.payment_method?.name || item?.payment_method_name || (item?.payment_method_id === 0 || item?.payment_method_id === null ? 'Cash' : '#' + item?.payment_method_id);
            const cashierName = preview?.cashier?.name || preview?.session?.cashier?.name || '-';
            const itemCount = Number(preview?.item_count) || preview?.items?.length || item?.items?.length || 0;
            const totalCharges = Number(preview?.total_charges || preview?.total_bill) || item?.total_payment || 0;
            const itemsTotal = (item?.items || []).reduce((sum, p) =>
              sum + (Number(p.unit_nett || p.unit_price || 0) * Number(p.quantity || 0))
                + (p.addons || []).reduce((asum, a) => asum + (Number(a.unit_nett || a.unit_price || 0) * Number(a.quantity || 0)), 0),
            0);
            const displayTotal = totalCharges || itemsTotal + (Number(item?.service_charge_value) || 0);
            const createdAt = preview?.created_at || item?.paid_at || item?.createdAt;
            const status = statusConfig[item.status] || statusConfig.pending;
            const itemsList = preview?.items || item?.items || [];

            const apiType = item._type === 'topup' ? 'topup'
              : item._type === 'membership' ? 'create member'
              : item._type === 'session' ? (item.body?.cash_started != null && item.body?.cash_finished != null ? 'both' : item.body?.cash_finished ? 'close' : 'start')
              : item.status === 'pending' ? 'save bill' : 'checkout';

            const isSession = apiType === 'start' || apiType === 'close' || apiType === 'both';

            if (isSession) {
              const sessionLabel = apiType === 'both' ? 'Open & Close Session' : (apiType === 'start' ? 'Open Session' : 'Close Session');
              const sessionIcon = apiType === 'both' ? '🔄' : (apiType === 'start' ? '🚪' : '🏁');
              const sessionColor = apiType === 'both' ? 'badge-info' : (apiType === 'start' ? 'badge-success' : 'badge-warning');
              const cashAmount = item?.body?.cash || 0;

              return (
                <div key={item.id} className="rounded-lg border border-base-200 bg-base-100 transition-colors hover:border-base-300 overflow-hidden">
                  <div className={`h-1 w-full ${apiType === 'start' ? 'bg-success' : 'bg-warning'}`} />
                  <div className="p-2.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`badge badge-xs ${sessionColor} uppercase font-bold tracking-wider`}>
                        {sessionIcon} {sessionLabel}
                      </span>
                      {apiType !== 'both' && (
                        <span className="text-[10px] font-bold text-base-content/50 flex-1 truncate">
                          {dateFormat(createdAt)}
                        </span>
                      )}
                      <span className={`badge badge-xs ${status.badge} gap-0.5`}>
                        <span className="text-[9px]">{status.icon}</span>
                        {item.status}
                      </span>
                    </div>
                    {apiType === 'both' && (
                      <div className="flex gap-3 text-[10px] text-base-content/50 font-bold mb-1.5">
                        <span>Open: {dateFormat(item?.body?.open_at || item?.createdAt)}</span>
                        <span>Close: {dateFormat(item?.body?.close_at || createdAt)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center bg-base-200/30 rounded p-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] uppercase text-base-content/40 font-bold">
                          {apiType === 'both' ? 'Starting Cash' : (apiType === 'start' ? 'Starting Cash' : 'Ending Cash')}
                        </span>
                        <span className="text-sm font-black text-base-content">
                          {currencyFormat(apiType === 'both' ? (item?.body?.cash_started || item?.body?.cash) : cashAmount)}
                        </span>
                        {apiType === 'both' && (
                          <>
                            <span className="text-[9px] uppercase text-base-content/40 font-bold">Ending Cash</span>
                            <span className="text-sm font-black text-base-content">{currencyFormat(item?.body?.cash || 0)}</span>
                          </>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] uppercase text-base-content/40 font-bold block">Total Orders</span>
                        <span className="text-[10px] font-bold">{item?.body?.orderCount || 0}</span>
                      </div>
                    </div>
                    {item.lastError && (
                      <div className="mt-2 text-[10px] text-error bg-error/10 rounded px-2 py-1 leading-tight">{item.lastError}</div>
                    )}
                  </div>
                </div>
              );
            }

            if (apiType === 'topup') {
              const nominal = Number(preview?.nominal || item?.nominal || 0);
              const memberName = preview?.member_name || item?.member_name || '-';

              return (
                <div key={item.id} className="rounded-lg border border-base-200 bg-base-100 transition-colors hover:border-base-300 overflow-hidden">
                  <div className="h-1 w-full bg-info" />
                  <div className="p-2.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="badge badge-xs badge-info uppercase font-bold tracking-wider">💰 Topup</span>
                      <span className="flex-1" />
                      <span className={`badge badge-xs ${status.badge} gap-0.5`}>
                        <span className="text-[9px]">{status.icon}</span>
                        {item.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-base-content/50 flex-wrap mb-2">
                      <span className="truncate">{memberName}</span>
                      <span>·</span>
                      <span className="whitespace-nowrap">{dateFormat(createdAt)}</span>
                    </div>
                    <div className="bg-base-200/30 rounded p-2">
                      <div className="flex justify-between text-[9px] uppercase text-base-content/40 font-bold">
                        <span>Payment</span>
                        <span>Amount</span>
                      </div>
                      <div className="flex justify-between items-center mt-0.5">
                        <span className="text-[13px] font-bold capitalize">{item?.payment_type || '-'}</span>
                        <span className="text-sm font-black text-success">{currencyFormat(nominal)}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-1">
                      <button className="btn btn-ghost btn-xs text-base-content/50" onClick={() => onRemove?.(item.id)}>
                        🗑️ Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            if (apiType === 'create member') {
              return (
                <div key={item.id} className="rounded-lg border border-base-200 bg-base-100 transition-colors hover:border-base-300 overflow-hidden">
                  <div className="h-1 w-full bg-success" />
                  <div className="p-2.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="badge badge-xs badge-success uppercase font-bold tracking-wider">👤 Create Member</span>
                      <span className="flex-1" />
                      <span className={`badge badge-xs ${status.badge} gap-0.5`}>
                        <span className="text-[9px]">{status.icon}</span>
                        {item.status}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-base-200/30 rounded p-2">
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase text-base-content/40 font-bold">Member</span>
                        <span className="text-[13px] font-bold">{item.name || '-'} {item.reff_code ? `(${item.reff_code})` : ''}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] uppercase text-base-content/40 font-bold block">Card ID</span>
                        <span className="text-sm font-black text-base-content">{item.card_id || '-'}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-1">
                      <button className="btn btn-ghost btn-xs text-base-content/50" onClick={() => onRemove?.(item.id)}>
                        🗑️ Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            // Default render for bills & orders
            return (
              <div key={item.id} className="rounded-lg border border-base-200 bg-base-100 transition-colors hover:border-base-300 overflow-hidden">
                <div className="p-2.5 pb-1.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="badge badge-xs badge-primary badge-outline uppercase font-bold tracking-wider">{apiType}</span>
                    <span className="text-xs font-bold text-base-content truncate flex-1">{code}</span>
                    <span className={`badge badge-xs ${status.badge} gap-0.5`}>
                      <span className="text-[9px]">{status.icon}</span>
                      {item.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-base-content/50 flex-wrap">
                    <span className="truncate max-w-24">{preview?.bill_name || item?.bill_name || cashierName}</span>
                    <span>·</span>
                    <span className="truncate">{channelName}</span>
                    <span>·</span>
                    <span className="truncate">{paymentName}</span>
                    <span>·</span>
                    <span className="whitespace-nowrap">{dateFormat(createdAt)}</span>
                  </div>
                </div>

                {itemsList.length > 0 ? (
                  <div className="collapse collapse-arrow rounded-none border-t border-base-200">
                    <input type="checkbox" className="min-h-0" />
                    <div className="collapse-title min-h-0 py-2 px-2.5 flex items-center justify-between group">
                      <span className="text-[12px] font-bold text-base-content/70">
                        {itemCount} item{itemCount !== 1 ? 's' : ''}
                      </span>
                      <span className="text-[12px] font-extrabold text-base-content mr-6">{currencyFormat(displayTotal)}</span>
                    </div>
                    <div className="collapse-content px-2.5 pb-2 bg-base-200/30">
                      <div className="space-y-2 pt-2">
                        {itemsList.map((product, idx) => (
                          <div key={idx} className="flex flex-col gap-0.5">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex gap-1.5 items-start flex-1 min-w-0">
                                <span className="bg-base-content/80 rounded px-1.5 py-0.5 text-[13px] text-white font-bold leading-none mt-0.5">{product.quantity}</span>
                                <span className="text-[13px] font-bold uppercase truncate leading-tight">
                                  {product.catalog?.name || product.catalog_name || product.description || 'Unknown Item'}
                                </span>
                              </div>
                              <span className="text-[13px] text-base-content/60 font-medium whitespace-nowrap">
                                {currencyFormat(Number(product.unit_nett || product.unit_price || 0) * Number(product.quantity || 0))}
                              </span>
                            </div>
                            {product.addons?.length > 0 && (
                              <div className="ml-5 border-l border-base-content/10 pl-2 flex flex-col gap-0.5">
                                {product.addons?.map((add, aIdx) => {
                                  const addonName = add.catalog_name || add.catalog?.name || add.name || '';
                                  const addonPrice = Number(add.unit_price || add.unit_nett || 0);
                                  const addonQty = Number(add.quantity || 1);
                                  return (
                                    <div key={aIdx} className="flex justify-between text-[11px] text-base-content/40 italic">
                                      <span>+ {addonName} ({addonQty} x {currencyFormat(addonPrice)})</span>
                                      {addonPrice > 0 && <span>{currencyFormat(addonQty * addonPrice)}</span>}
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
                  <div className="px-2.5 py-2 border-t border-base-200 flex justify-between items-center bg-base-200/10">
                    <span className="text-[10px] text-base-content/50">No items</span>
                    <span className="text-xs font-extrabold text-base-content">{currencyFormat(displayTotal)}</span>
                  </div>
                )}

                {item.lastError && (
                  <div className="mx-2.5 mb-1.5 text-[10px] text-error bg-error/10 rounded px-2 py-1 leading-tight">{item.lastError}</div>
                )}

                <div className="p-2.5 pt-0 flex gap-1">
                  {apiType === 'save bill' && item.status === 'pending' && (
                    <button className="btn btn-primary btn-xs flex-1 gap-1" onClick={() => { onOpenBill?.(item); onClose(); }}>
                      📋 Open Bill
                    </button>
                  )}
                  {item.status === 'pending' && (
                    <button className="btn btn-error btn-ghost btn-xs text-base-content/50" onClick={() => onRemove?.(item.id)}>
                      &#10006; Remove
                    </button>
                  )}
                  {item.status === 'failed' && (
                    <button className="btn btn-error btn-xs flex-1 gap-1" onClick={() => onRetry?.(item.id)}>
                      ↻ Retry Sync
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
