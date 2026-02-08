/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';

import CardMockup from '../../../assets/card-mockup.jpg';
import { NFCField, OrderDetails, Remove } from '../../../components/ui';
import { PaypassIcon } from '../../../components/ui/icon';
import Input from '../../../components/ui/input';
import useModal from '../../../components/ui/modal/hook';
import useMembership from '../../../services/membership/hook';
import { currencyFormat, dateFormat } from '../../../utils/common';
import useOrder from '../../../services/sales/order/hook';

const HistorySection = ({ id }) => {
  const [logs, setLogs] = React.useState([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);

  const [selectedOrder, setSelectedOrder] = React.useState(null);
  const [selectedOrderId, setSelectedOrderId] = React.useState(null);

  const observerRef = React.useRef(null);
  const loadMoreRef = React.useRef(null);

  const { saldoLog, showResult, saldoLogResult } = useMembership(id);
  const { show: orderShow, showResult: orderShowResult} = useOrder();

  const LIMIT = 25;

  useEffect(() => {
    setLogs([]);
    setPage(1);
    setHasMore(true);
  }, [id]);

  // Fetch history
  React.useEffect(() => {
    saldoLog({
      membership_id: id,
      page,
      limit: LIMIT
    });
  }, []);

  React.useEffect(() => {
    if (saldoLogResult?.isSuccess) {
      const res = saldoLogResult?.data || {};
      const newData = res?.data || [];

      setLogs((prev) => [...prev, ...newData]);

      if (newData.length < LIMIT) {
        setHasMore(false);
      }
    }
  }, [saldoLogResult]);

  // Infinite scroll observer
  React.useEffect(() => {
    if (!hasMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !saldoLogResult?.isLoading) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, saldoLogResult?.isLoading]);

  const handleClickLog = (item) => {
    if (item?.ref_type !== 'sales_order') return;
      setSelectedOrder(null);          // reset UI
      setSelectedOrderId(item.ref_id); // simpan intent user
      orderShow(item.ref_id);          // fetch
  };

  useEffect(() => {
    if (
      orderShowResult?.isSuccess &&
      orderShowResult?.data?.data &&
      selectedOrderId === orderShowResult.data.data.id
    ) {
      setSelectedOrder(orderShowResult.data.data);
    }
  }, [
    orderShowResult?.isSuccess,
    orderShowResult?.data,
    selectedOrderId
  ]);

  if (showResult?.isLoading) return <div>loading...</div>;

  const data = showResult?.data?.data;

  if (selectedOrder) {
    return (
      <div className="space-y-4 bg-base-200 -mt-3 flex flex-col px-2 h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mt-2 ">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setSelectedOrder(null)
              setSelectedOrderId(null)
            }}
          >
            ← Kembali
          </button>
          <h2 className="font-semibold text-lg">Detail Order</h2>
        </div>

        <div className='overflow-y-auto flex-1'>
          <OrderDetails data={selectedOrder} />
        </div>
      </div>
    );
  }

  return (
    // tambahkan disini css meggunakan daiysiui dan css tailwind
     <div className="space-y-4 overflow-y-auto px-2">
      {/* ===== Header Info ===== */}
      <div className="px-4 py-3 border-b">
         <div className="mt-2 flex justify-between items-center">
          <span className="text-sm text-gray-500">Nama</span>
          <span className="font-semibold text-gray-900">
          {data?.name || '-'}
          </span>
        </div>

        <div className="mt-2 flex justify-between items-center">
          <span className="text-sm text-gray-500">Sisa Saldo</span>
          <span className="text-lg font-bold text-green-600">
            {currencyFormat(data?.saldo || 0)}
          </span>
        </div>
      </div>

      {logs.map((item, index) => (
        <div
          key={index}
          onClick={() => handleClickLog(item)}
          className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
        >
          {/* Title & Amount */}
          <div className="flex justify-between items-start mb-1">
            <h3 className="font-semibold text-gray-900">
              {item?.ref_type === 'bonus' ? 'Bonus' : item?.ref_type === 'top-up' ? 'Topup' : `${item?.ref_code}`}
            </h3>
            <span className={`font-semibold ${item?.nominal < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {currencyFormat(item?.nominal)}
            </span>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600 leading-snug capitalize">
            {(item?.ref_type === 'bonus' || item?.ref_type === 'top-up') ? `${item?.ref_code}` : 'Sales Order'}

          </p>

          {/* Date */}
          <p className="text-xs text-gray-400 mt-1">
            {dateFormat(item?.recorded_at)}
          </p>
        </div>
      ))}

      {/* Loader */}
      {saldoLogResult?.isLoading && (
        <div className="text-center text-sm text-gray-400 py-4">
          Memuat data...
        </div>
      )}
      {/* Sentinel */}
      {hasMore && <div ref={loadMoreRef} className="h-4" />}

      {/* End */}
      {!hasMore && (
        <div className="text-center text-xs text-gray-400 py-3">
          Semua riwayat ditampilkan
        </div>
      )}
    </div>
  );
};

export default HistorySection;
