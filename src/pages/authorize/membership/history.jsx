/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect } from 'react';
import { LuTrash2, LuWallet } from 'react-icons/lu';
import { useSelector } from 'react-redux';

import { Input, Modal, OrderDetails } from '../../../components/ui';
import useModal from '../../../components/ui/modal/hook';
import useMembership from '../../../services/membership/hook';
import useOrder from '../../../services/sales/order/hook';
import { currencyFormat, dateFormat } from '../../../utils/common';

const CancelTopupModal = ({ log, membership, onClose }) => {
  const [reason, setReason] = React.useState('');
  const [pin, setPin] = React.useState('');
  const { cancelTopup, cancelTopupResult, show: showMember, saldoLog } = useMembership();

  const onConfirm = () => {
    const targetId = log?.id ?? log?.sync_id;
    if (!targetId) return;

    const payload = { cancelled_reason: reason, password: pin };
    cancelTopup({ id: targetId, payload });
  };

  React.useEffect(() => {
    if (cancelTopupResult?.isSuccess) {
      // refresh saldo & list log
      if (membership?.id) {
        showMember(membership?.id);
        saldoLog({ id: membership?.id, params: { page: 1, limit: 25 } });
      }
      onClose?.();
      setReason('');
      setPin('');
    }
  }, [cancelTopupResult]);

  return (
    <>
      <Modal.Header onClose={onClose}>
        <div className="text-lg font-semibold">Cancel Topup</div>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-3 py-4">
          <div className="mb-3">
            Are you sure you want to cancel this topup?
            <div className="text-gray-500 text-sm">
              {log?.reference_code} · {currencyFormat(log?.nominal)}
            </div>
          </div>
          <div className="space-y-4">
            <Input
              label="Reason"
              value={reason}
              onChange={e => setReason(e?.target?.value)}
              placeholder="Required"
            />

            <Input
              label="Enter PIN"
              value={pin}
              onChange={e => setPin(e?.target?.value)}
              type="password"
            />
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="btn btn-md px-10" onClick={onClose}>
          Cancel
        </div>
        <div
          className={`btn btn-md btn-error px-10 text-white ${
            cancelTopupResult?.isLoading || !reason || !pin ? 'btn-disabled' : ''
          }`}
          onClick={onConfirm}
        >
          Confirm {cancelTopupResult?.isLoading ? <span className="loading loading-spinner loading-sm"></span> : null}
        </div>
      </Modal.Footer>
    </>
  );
};

const HistorySection = ({ id, membership }) => {
  const isOnline = useSelector(state => state?.Offline?.isOnline);
  const apiReachable = useSelector(state => state?.Offline?.apiReachable);
  const sessionAuth = useSelector(state => state?.Auth?.session);

  const isOffline = !isOnline || apiReachable === false;

  const [logs, setLogs] = React.useState([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);

  const [selectedOrder, setSelectedOrder] = React.useState(null);
  const [selectedOrderId, setSelectedOrderId] = React.useState(null);

  const observerRef = React.useRef(null);
  const loadMoreRef = React.useRef(null);
  const isLoadingRef = React.useRef(false);
  const logsLengthRef = React.useRef(0);
  const isTriggeringRef = React.useRef(false);
  const processedIdsRef = React.useRef(new Set());
  const hasMoreRef = React.useRef(true);

  const {
    saldoLog,
    show: showMember,
    showResult,
    saldoLogResult,
  } = useMembership();
  const { show: orderShow, showResult: orderShowResult } = useOrder();
  const { openModal, closeModal } = useModal();

  const LIMIT = 25;

  React.useEffect(() => {
    setLogs([]);
    setPage(1);
    setHasMore(true);
    processedIdsRef.current.clear();
  }, [showResult]);

  // Fetch history
  React.useEffect(() => {
    if (showResult.isSuccess) {
      const params = {
        page,
        limit: LIMIT,
      };

      saldoLog({ id, params });
    }
  }, [showResult, page]);

  React.useEffect(() => {
    if (saldoLogResult?.isSuccess) {
      const res = saldoLogResult?.data || {};
      const newData = res?.data || [];

      // Filter data yang belum pernah diproses berdasarkan ID
      const filteredData = newData.filter(item => {
        const id = item?.id;
        if (!id) return true;
        const isDuplicate = processedIdsRef.current.has(id);
        if (!isDuplicate) {
          processedIdsRef.current.add(id);
        }
        return !isDuplicate;
      });

      // Skip jika tidak ada data baru
      if (filteredData.length === 0) return;

      setLogs(prev => [...prev, ...filteredData]);

      if (res?.meta) {
        setHasMore(res.meta.has_next);
      } else {
        if (newData.length < LIMIT) {
          setHasMore(false);
        }
      }

      // Reset isTriggeringRef setelah data berhasil ditambahkan
      isTriggeringRef.current = false;
    }
  }, [saldoLogResult, page]);

  // Sync refs
  React.useEffect(() => {
    const wasLoading = isLoadingRef.current;
    const isLoading = saldoLogResult?.isLoading || false;
    isLoadingRef.current = isLoading;

    if (!isLoading && wasLoading) {
      isTriggeringRef.current = false;
    }
  }, [saldoLogResult?.isLoading]);

  React.useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  const prevLogsLengthRef = React.useRef(0);

  React.useEffect(() => {
    logsLengthRef.current = logs.length;

    // Reconnect observer setelah data baru masuk (untuk trigger intersection check)
    if (logs.length > 0 && observerRef.current) {
      const target = loadMoreRef.current;
      if (target) {
        observerRef.current.unobserve(target);
        observerRef.current.observe(target);
      }
    }
    prevLogsLengthRef.current = logs.length;
  }, [logs.length]);

  // Infinite scroll observer
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    // Skip jika di mode detail order
    if (selectedOrder) return;

    const target = loadMoreRef.current;
    const container = containerRef.current;
    if (!target || !container) return;

    // Cleanup observer lama jika ada
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (
          entry.isIntersecting &&
          hasMoreRef.current &&
          !isLoadingRef.current &&
          !isTriggeringRef.current &&
          logsLengthRef.current > 0
        ) {
          isTriggeringRef.current = true;
          setTimeout(() => setPage(prev => prev + 1), 0);
        }
      },
      { threshold: 0.1, root: container, rootMargin: '100px' }
    );

    observer.observe(target);
    observerRef.current = observer;

    return () => {
      observer.disconnect();
    };
  }, [selectedOrder]); // Re-init observer ketika berubah tampilan

  const handleClickLog = item => {
    if (item?.ref_type !== 'sales_order') return;
    setSelectedOrder(null); // reset UI
    setSelectedOrderId(item.ref_id); // simpan intent user
    orderShow(item.ref_id); // fetch
  };

  const isCancellable = item => {
    // Cancel online-only: tidak tampil saat offline
    if (isOffline) return false;
    // Hanya role manager yang boleh cancel
    if (sessionAuth?.user?.role !== 'manager') return false;
    if (!['top-up', 'bonus'].includes(item?.reference_type)) return false;
    if (!item?.id && !item?.sync_id) return false;
    return true;
  };

  const handleCancel = item => {
    openModal(<CancelTopupModal log={item} membership={membership} onClose={closeModal} />);
  };

  React.useEffect(() => {
    if (
      orderShowResult?.isSuccess &&
      orderShowResult?.data?.data &&
      selectedOrderId === orderShowResult.data.data.id
    ) {
      setSelectedOrder(orderShowResult.data.data);
    }
  }, [orderShowResult?.isSuccess, orderShowResult?.data, selectedOrderId]);

  useEffect(() => {
    if (isOffline) {
      setLogs(membership?.saldo_logs || []);
    }
  }, [isOffline, membership?.card_id]);

  useEffect(() => {
    if (!isOffline && membership?.id) {
      showMember(membership?.id);
    }
  }, [membership?.card_id]);

  if (showResult?.isLoading) return <div>loading...</div>;

  const data = showResult?.data?.data || membership;

  if (selectedOrder) {
    return (
      <div className="bg-base-200 -mt-3 flex h-full flex-col space-y-4 overflow-y-auto px-2">
        {/* Header */}
        <div className="mt-2 flex items-center gap-3">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setSelectedOrder(null);
              setSelectedOrderId(null);
            }}
          >
            ← Kembali
          </button>
          <h2 className="text-lg font-semibold">Detail Order</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          <OrderDetails data={selectedOrder} />
        </div>
      </div>
    );
  }

  return (
    // tambahkan disini css meggunakan daiysiui dan css tailwind
    <div ref={containerRef} className="flex-1 space-y-4 overflow-y-auto px-2">
      {/* ===== Header Info ===== */}
      <div className="px-4 py-2">
        <div className="flex gap-2">
          <LuWallet className="h-6 w-6" />
          <span className="text-lg font-bold text-green-600">
            {currencyFormat(data?.saldo || 0)}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm text-gray-500">No Tel</span>
          <span className="">:</span>
          <span className="text-gray-900">{data?.reff_code || '-'}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm text-gray-500">Member No</span>
          <span className="">:</span>
          <span className="text-gray-900">{data?.card_id || '-'}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm text-gray-500">Member Since</span>
          <span className="">:</span>
          <span className="text-gray-900">{dateFormat(data?.created_at, 'DD/MM/YYYY')}</span>
        </div>
      </div>

      {logs.map((item, index) => (
        <div
          key={index}
          onClick={() => handleClickLog(item)}
          className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
        >
          {/* Title & Amount */}
          <div className="mb-1 flex items-start justify-between">
            <h3 className="font-semibold text-gray-900 capitalize">
              {item?.reference_type === 'bonus'
                ? 'Bonus'
                : item?.reference_type === 'top-up'
                  ? 'Topup'
                  : `${item?.reference_type}`}
            </h3>
            <div className="flex items-center gap-2">
              <span
                className={`font-semibold ${item?.nominal < 0 ? 'text-red-600' : 'text-green-600'}`}
              >
                {currencyFormat(item?.nominal)}
              </span>
              {isCancellable(item) && (
                <button
                  className="btn btn-ghost btn-circle btn-xs !text-error"
                  title="Cancel topup"
                  onClick={e => {
                    e.stopPropagation();
                    handleCancel(item);
                  }}
                >
                  <LuTrash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Payment Type */}
          <p className="text-sm leading-snug text-gray-600 capitalize">
            {item?.payment_type ? `${item?.payment_type} - ` : ''} {item?.reference_code}
          </p>

          {/* Date */}
          <p className="mt-1 text-xs text-gray-400">{dateFormat(item?.created_at)}</p>
        </div>
      ))}

      {/* Loader */}
      {saldoLogResult?.isLoading && (
        <div className="py-4 text-center text-sm text-gray-400">Memuat data...</div>
      )}
      {/* Sentinel */}
      {hasMore && <div ref={loadMoreRef} className="h-4" />}

      {/* End */}
      {!hasMore && (
        <div className="py-3 text-center text-xs text-gray-400">Semua riwayat ditampilkan</div>
      )}
    </div>
  );
};

export default HistorySection;
