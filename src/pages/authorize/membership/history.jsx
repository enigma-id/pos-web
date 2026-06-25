/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { LuWallet } from 'react-icons/lu';

import CardMockup from '../../../assets/card-mockup.jpg';
import { NFCField, OrderDetails, Remove } from '../../../components/ui';
import { PaypassIcon, WalletIcon } from '../../../components/ui/icon';
import Input from '../../../components/ui/input';
import useMembership from '../../../services/membership/hook';
import useOrder from '../../../services/sales/order/hook';
import { currencyFormat, dateFormat } from '../../../utils/common';

const HistorySection = ({ id }) => {
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

  const { saldoLog, showResult, saldoLogResult } = useMembership(id);
  const { show: orderShow, showResult: orderShowResult } = useOrder();

  const LIMIT = 25;

  React.useEffect(() => {
    setLogs([]);
    setPage(1);
    setHasMore(true);
    processedIdsRef.current.clear();
  }, [id, showResult]);

  // Fetch history
  React.useEffect(() => {
    if (showResult.isSuccess) {
      const params = {
        page,
        limit: LIMIT
      }

      saldoLog({ id, params });
    }
  }, [showResult, id, page]);

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

  React.useEffect(() => {
    if (
      orderShowResult?.isSuccess &&
      orderShowResult?.data?.data &&
      selectedOrderId === orderShowResult.data.data.id
    ) {
      setSelectedOrder(orderShowResult.data.data);
    }
  }, [orderShowResult?.isSuccess, orderShowResult?.data, selectedOrderId]);

  if (showResult?.isLoading) return <div>loading...</div>;

  const data = showResult?.data?.data;

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
            <span
              className={`font-semibold ${item?.nominal < 0 ? 'text-red-600' : 'text-green-600'}`}
            >
              {currencyFormat(item?.nominal)}
            </span>
          </div>

          {/* Description */}
          <p className="text-sm leading-snug text-gray-600 capitalize">
            {item?.reference_type === 'bonus' || item?.reference_type === 'top-up'
              ? `${item?.payment_type}`
              : ''}
          </p>

          {/* Date */}
          <p className="mt-1 text-xs text-gray-400">{dateFormat(item?.recorded_at)}</p>
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
