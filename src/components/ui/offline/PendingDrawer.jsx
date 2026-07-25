import React, { useState } from 'react';
import { useSelector } from 'react-redux';

import { currencyFormat, dateFormat } from '../../../utils/common';

const getApiCategory = (item) => {
  if (item._type === 'topup') return 'topup';
  if (item._type === 'session') return 'shifts';
  if (item.status === 'pending') return 'bills';
  if (item.status === 'completed') return 'order';
  return 'other';
};

const getApiType = (item) => {
  if (item._type === 'topup') return 'topup';
  if (item._type === 'session') return item.body?.cash_finished ? 'close session' : 'start session';
  if (item.status === 'pending') return 'save bill';
  if (item.status === 'completed') return 'checkout';
  return 'order';
};

const statusConfig = {
  failed: { badge: 'badge-error', icon: '✕' },
  syncing: { badge: 'badge-warning', icon: '↻' },
  pending: { badge: 'badge-info', icon: '◷' },
};

const PendingDrawer = ({ open, onClose, onRetry, onOpenBill, onRemove }) => {
  const sessions = useSelector(state => state?.Offline?.sessions || []);
  const [activeTab, setActiveTab] = useState('order');

  const categorized = React.useMemo(() => {
    const result = { order: [], bills: [], shifts: [], topup: [], other: [], failedCount: {} };

    for (const s of sessions) {
      if (s.syncStatus === 'synced') continue;

      // Session-level items (shifts tab)
      // Skip session yg start online & belum close — itu cuma mirror server session
      const isClosed = !!s.session?.close_at;
      const isOfflineSession = !s.referenceId;
      const skipShift = !isOfflineSession && !isClosed;
      const shiftItem = {
        id: s.sync_id,
        sync_id: s.sync_id,
        _type: 'session',
        status: s.syncStatus || 'pending',
        lastError: s.error || null,
        createdAt: isClosed ? s.session?.close_at : (s.createdAt || s.session?.open_at),
        body: {
          cash: isClosed ? (s.session?.cash_finished || s.session?.cash_started) : s.session?.cash_started,
          cash_started: s.session?.cash_started,
          cash_finished: s.session?.cash_finished,
          open_at: s.session?.open_at,
          close_at: s.session?.close_at,
          orderCount: s.orders?.length || 0,
        },
        session: s.session || {},
        transaction_preview: {
          code: `SES-${(s.sync_id || '').slice(0, 8)}`,
          cashier: { name: s.cashier_name || '-' },
          session: { cashier: { name: s.cashier_name || '-' } },
          created_at: isClosed ? s.session?.close_at : (s.createdAt || s.session?.open_at),
        },
      };
      if (!skipShift) {
        result.shifts.push(shiftItem);
        if (s.syncStatus === 'failed') {
          result.failedCount.shifts = (result.failedCount.shifts || 0) + 1;
        }
      }

      // Flatten orders dari session
      for (const o of s.orders || []) {
        const item = {
          ...o,
          id: o.sync_id,
          _sessionSyncId: s.sync_id,
          _sessionStatus: s.syncStatus,
          _sessionError: s.error,
          _sessionCreatedAt: s.createdAt,
        };

        const cat = getApiCategory(item);
        result[cat]?.push(item);
        if (item.status === 'failed') {
          result.failedCount[cat] = (result.failedCount[cat] || 0) + 1;
        }
      }

      // Topups dari session
      for (const t of s.topups || []) {
        const item = {
          ...t,
          _type: 'topup',
          _sessionSyncId: s.sync_id,
          _sessionStatus: s.syncStatus,
        };
        result.topup.push(item);
        if (s.syncStatus === 'failed') {
          result.failedCount.topup = (result.failedCount.topup || 0) + 1;
        }
      }
    }

    return result;
  }, [sessions]);

  // Merge 'other' into none — we don't show it as a tab
  const filteredItems = categorized[activeTab] || [];

  if (!open) return null;

  const tabs = [
    { id: 'order', label: 'Order', icon: '🛒' },
    { id: 'bills', label: 'Bills', icon: '📋' },
    { id: 'topup', label: 'Topup', icon: '💰' },
    { id: 'shifts', label: 'Shifts', icon: '💼' },
  ];

  const activeIndex = tabs.findIndex(t => t.id === activeTab);

  const Tab = ({ id, label, icon, isActive }) => {
    const count = categorized[id]?.length || 0;
    const failed = categorized.failedCount[id] || 0;

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
          <div className="flex gap-0.5 items-center">
            {failed > 0 && (
              <span
                className={`badge ${
                  isActive ? 'bg-error text-error-content border-none' : 'badge-error'
                } badge-xs w-3 h-3 p-0 flex items-center justify-center text-[7px] font-black animate-pulse`}
              >
                !
              </span>
            )}
            <span
              className={`badge badge-xs min-w-4 h-3.5 ${
                isActive
                  ? 'bg-primary-content text-primary border-none'
                  : 'badge-neutral text-white border-none'
              } tabular-nums text-[8px]`}
            >
              {count}
            </span>
          </div>
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
            {Object.values(categorized.failedCount).reduce((a, b) => a + b, 0) > 0 && (
              <span className="badge badge-error badge-sm gap-1.5 font-bold px-2 py-2.5">
                <span className="animate-bounce">✕</span>
                {Object.values(categorized.failedCount).reduce((a, b) => a + b, 0)} Issues
              </span>
            )}
          </div>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Sliding Pill Tabs */}
        <div className="mx-4 mt-3 mb-1">
          <div className="bg-base-200/60 p-1 rounded-xl flex relative border border-base-300/30 h-12">
            {/* The Shifter / Slider background */}
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
                {activeTab === 'topup' ? '💰' : activeTab === 'order' ? '🛒' : activeTab === 'bills' ? '📋' : '💼'}
              </span>
              <span className="text-xs font-medium">No {activeTab} items in queue</span>
            </div>
          )}

          {filteredItems.map(item => {
            const preview = item?.transaction_preview || {};
            const apiType = getApiType(item);
            const code = preview?.code || item?.code || `OFF-${item?.sync_id?.slice(0, 8) || item?.id}`;
            const channelName = preview?.channel?.name || item?.salesChannelName || item?.salesChannelId || '-';
            const paymentName = preview?.payment_method?.name || (item?.paymentMethodId ? '-' : '-');
            const cashierName = preview?.cashier?.name || preview?.session?.cashier?.name || '-';
            const itemCount = Number(preview?.item_count) || preview?.items?.length || item?.items?.length || 0;
            const totalCharges = Number(preview?.total_charges || preview?.total_bill) || item?.totalPayment || 0;
            // Fallback: calculate from items when totalPayment is 0 (pending save-bill)
            const itemsTotal = (item?.items || []).reduce((sum, p) =>
              sum + (Number(p.unit_nett || p.unit_price || 0) * Number(p.quantity || 0))
                + (p.addons || []).reduce((asum, a) => asum + (Number(a.unit_nett || a.unit_price || 0) * Number(a.quantity || 0)), 0),
            0);
            const displayTotal = totalCharges || itemsTotal + (Number(item?.serviceChargeValue) || 0);
            const createdAt = preview?.created_at || item?.paidAt || item?.createdAt || item?._sessionCreatedAt;
            const status = statusConfig[item.status] || statusConfig.pending;
            const itemsList = preview?.items || item?.items || [];

            const isSession = apiType === 'start' || apiType === 'end' || apiType === 'both';
            // Specialized rendering for Topup
            const isTopup = apiType === 'topup';

            if (isSession) {
              const sessionLabel = apiType === 'both' ? 'Open & Close Session' : (apiType === 'start' ? 'Open Session' : 'Close Session');
              const sessionIcon = apiType === 'both' ? '🔄' : (apiType === 'start' ? '🚪' : '🏁');
              const sessionColor = apiType === 'both' ? 'badge-info' : (apiType === 'start' ? 'badge-success' : 'badge-warning');
              const cashAmount = item?.body?.cash || 0;

              return (
                <div
                  key={item.id}
                  className={`rounded-lg border border-base-200 bg-base-100 transition-colors hover:border-base-300 overflow-hidden`}
                >
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
                            <span className="text-sm font-black text-base-content">
                              {currencyFormat(item?.body?.cash || 0)}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] uppercase text-base-content/40 font-bold block">Total Orders</span>
                        <span className="text-[10px] font-bold">{item?.body?.orderCount || 0}</span>
                      </div>
                    </div>

                    {/* Error message */}
                    {item.lastError && (
                      <div className="mt-2 text-[10px] text-error bg-error/10 rounded px-2 py-1 leading-tight">
                        {item.lastError}
                      </div>
                    )}

                    {/* Action buttons — session ga perlu retry, auto lewat heartbeat */}
                    <div className="mt-2 flex gap-1">
                      {(item.status === 'pending' && !isSession) && (
                        <button
                          className="btn btn-ghost btn-xs text-base-content/50"
                          onClick={() => onRemove?.(item.id)}
                        >
                          🗑️ Remove
                        </button>
                      )}
                      {(item.status === 'failed' && !isSession) && (
                        <button
                          className="btn btn-error btn-xs flex-1 gap-1"
                          onClick={() => onRetry?.(item.id)}
                        >
                          ↻ Retry Sync
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            if (isTopup) {
              const nominal = Number(preview?.nominal) || 0;
              const memberName = preview?.member_name || '-';
              const memberCode = preview?.member_code || '';

              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-base-200 bg-base-100 transition-colors hover:border-base-300 overflow-hidden"
                >
                  <div className="h-1 w-full bg-info" />
                  <div className="p-2.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="badge badge-xs badge-info uppercase font-bold tracking-wider">
                        💰 Topup
                      </span>
                      <span className="text-xs font-bold text-base-content truncate flex-1">{code}</span>
                      <span className={`badge badge-xs ${status.badge} gap-0.5`}>
                        <span className="text-[9px]">{status.icon}</span>
                        {item.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-base-content/50 flex-wrap mb-2">
                      <span className="truncate">{memberName}</span>
                      {memberCode && <><span>·</span><span className="truncate">{memberCode}</span></>}
                      <span>·</span>
                      <span className="whitespace-nowrap">{dateFormat(createdAt)}</span>
                    </div>

                    <div className="flex justify-between items-center bg-base-200/30 rounded p-2">
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase text-base-content/40 font-bold">Payment</span>
                        <span className="text-[13px] font-bold">{paymentName}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] uppercase text-base-content/40 font-bold block">Amount</span>
                        <span className="text-sm font-black text-success">{currencyFormat(nominal)}</span>
                      </div>
                    </div>

                    {item.lastError && (
                      <div className="mt-2 text-[10px] text-error bg-error/10 rounded px-2 py-1 leading-tight">
                        {item.lastError}
                      </div>
                    )}

                    <div className="mt-2 flex gap-1">
                      {item.status === 'pending' && (
                        <button
                          className="btn btn-ghost btn-xs text-base-content/50"
                          onClick={() => onRemove?.(item.id)}
                        >
                          🗑️ Remove
                        </button>
                      )}
                      {item.status === 'failed' && (
                        <button
                          className="btn btn-error btn-xs flex-1 gap-1"
                          onClick={() => onRetry?.(item.id)}
                        >
                          ↻ Retry Sync
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={item.id}
                className="rounded-lg border border-base-200 bg-base-100 transition-colors hover:border-base-300 overflow-hidden"
              >
                {/* Header Info */}
                <div className="p-2.5 pb-1.5">
                  {/* Row 1: Type badge + Code + Status */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="badge badge-xs badge-primary badge-outline uppercase font-bold tracking-wider">
                      {apiType}
                    </span>
                    <span className="text-xs font-bold text-base-content truncate flex-1">{code}</span>
                    <span className={`badge badge-xs ${status.badge} gap-0.5`}>
                      <span className="text-[9px]">{status.icon}</span>
                      {item.status}
                    </span>
                  </div>

                  {/* Row 2: Metadata - single compact line */}
                  <div className="flex items-center gap-1 text-[10px] text-base-content/50 flex-wrap">
                    <span className="truncate max-w-24">{preview?.bill_name || item?.billName || item?.bill_name || cashierName}</span>
                    <span>·</span>
                    <span className="truncate">{channelName}</span>
                    <span>·</span>
                    <span className="truncate">{paymentName}</span>
                    <span>·</span>
                    <span className="whitespace-nowrap">{dateFormat(createdAt)}</span>
                  </div>
                </div>

                {/* Collapsible Items Section */}
                {itemsList.length > 0 ? (
                  <div className="collapse collapse-arrow rounded-none border-t border-base-200">
                    <input type="checkbox" className="min-h-0" />
                    <div className="collapse-title min-h-0 py-2 px-2.5 flex items-center justify-between group">
                      <span className="text-[12px] font-bold text-base-content/70">
                        {itemCount} item{itemCount !== 1 ? 's' : ''}
                      </span>
                      <span className="text-[12px] font-extrabold text-base-content mr-6">
                        {currencyFormat(displayTotal)}
                      </span>
                    </div>
                    <div className="collapse-content px-2.5 pb-2 bg-base-200/30">
                      <div className="space-y-2 pt-2">
                        {itemsList.map((product, idx) => (
                          <div key={idx} className="flex flex-col gap-0.5">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex gap-1.5 items-start flex-1 min-w-0">
                                <span className="bg-base-content/80 rounded px-1.5 py-0.5 text-[13px] text-white font-bold leading-none mt-0.5">
                                  {product.quantity}
                                </span>
                                <span className="text-[13px] font-bold uppercase truncate leading-tight">
                                  {product.catalog?.name || product.catalog_name || product.description || 'Unknown Item'}
                                </span>
                              </div>
                              <span className="text-[13px] text-base-content/60 font-medium whitespace-nowrap">
                                {currencyFormat(Number(product.unit_nett || product.unit_price || 0) * Number(product.quantity || 0))}
                              </span>
                            </div>

                            {/* Additionals for queued items */}
                            {product.addons?.length > 0 && (
                              <div className="ml-5 border-l border-base-content/10 pl-2 flex flex-col gap-0.5">
                                {product.addons?.map((add, aIdx) => {
                          const suffix = add?.addon?.type === 'quantity' || add?.addon?.type === 'checkbox' ? `(${product?.quantity} x ${add?.quantity}) x ${currencyFormat(add?.unit_nett || 0)}` : '';
                                return (
                                    <div key={aIdx} className="flex justify-between text-[11px] text-base-content/40 italic">
                                    <span>+ {add.catalog?.name} {suffix}</span>
                                        {add.unit_nett > 0 && (
                                      <span>
                                        {currencyFormat(product?.quantity * add?.quantity * add?.unit_nett || 0)}
                                       </span>
                                        )}
                                    </div>
                                  )})}
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
                    <span className="text-xs font-extrabold text-base-content">
                      {currencyFormat(displayTotal)}
                    </span>
                  </div>
                )}

                {/* Error message */}
                {item.lastError && (
                  <div className="mx-2.5 mb-1.5 text-[10px] text-error bg-error/10 rounded px-2 py-1 leading-tight">
                    {item.lastError}
                  </div>
                )}

                {/* Action buttons */}
                <div className="p-2.5 pt-0 flex gap-1">
                  {/* Open Bill button - only for save-bill type and pending status */}
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

                  {/* Remove button for pending items */}
                  {item.status === 'pending' && (
                    <button
                      className="btn btn-error btn-ghost btn-xs text-base-content/50"
                      onClick={() => onRemove?.(item.id)}
                    >
                      &#10006; Remove
                    </button>
                  )}

                  {/* Retry button for failed items */}
                  {item.status === 'failed' && (
                    <button
                      className="btn btn-error btn-xs flex-1 gap-1"
                      onClick={() => onRetry?.(item.id)}
                    >
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
