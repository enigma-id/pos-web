/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';

import useMembership from '../../../services/membership/hook';
import { currencyFormat, dateFormat } from '../../../utils/common';

const POINT_TYPE_LABEL = {
  earn: 'Earn',
  redeem: 'Redeem',
  revert: 'Revert',
  revert_earn: 'Revert Earn',
};

const PointHistorySection = ({ id, membership }) => {
  const isOnline = useSelector(state => state?.Offline?.isOnline);
  const apiReachable = useSelector(state => state?.Offline?.apiReachable);

  const isOffline = !isOnline || apiReachable === false;

  const [logs, setLogs] = React.useState([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);

  const observerRef = React.useRef(null);
  const loadMoreRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const isLoadingRef = React.useRef(false);
  const logsLengthRef = React.useRef(0);
  const isTriggeringRef = React.useRef(false);
  const processedIdsRef = React.useRef(new Set());
  const hasMoreRef = React.useRef(true);

  const { pointLog, pointLogResult } = useMembership();

  const LIMIT = 25;

  React.useEffect(() => {
    setLogs([]);
    setPage(1);
    setHasMore(true);
    processedIdsRef.current.clear();
  }, [id]);

  React.useEffect(() => {
    if (id) {
      pointLog({ id, params: { page, limit: LIMIT } });
    }
  }, [id, page]);

  React.useEffect(() => {
    if (pointLogResult?.isSuccess) {
      const res = pointLogResult?.data || {};
      const newData = res?.data || [];

      const filteredData = newData.filter(item => {
        const logId = item?.id;
        if (!logId) return true;
        const isDuplicate = processedIdsRef.current.has(logId);
        if (!isDuplicate) {
          processedIdsRef.current.add(logId);
        }
        return !isDuplicate;
      });

      if (filteredData.length === 0) return;

      setLogs(prev => [...prev, ...filteredData]);

      if (res?.meta) {
        setHasMore(res.meta.has_next);
      } else if (newData.length < LIMIT) {
        setHasMore(false);
      }

      isTriggeringRef.current = false;
    }
  }, [pointLogResult, page]);

  React.useEffect(() => {
    const wasLoading = isLoadingRef.current;
    const isLoading = pointLogResult?.isLoading || false;
    isLoadingRef.current = isLoading;

    if (!isLoading && wasLoading) {
      isTriggeringRef.current = false;
    }
  }, [pointLogResult?.isLoading]);

  React.useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  React.useEffect(() => {
    logsLengthRef.current = logs.length;

    if (logs.length > 0 && observerRef.current) {
      const target = loadMoreRef.current;
      if (target) {
        observerRef.current.unobserve(target);
        observerRef.current.observe(target);
      }
    }
  }, [logs.length]);

  React.useEffect(() => {
    const target = loadMoreRef.current;
    const container = containerRef.current;
    if (!target || !container) return;

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
  }, []);

  useEffect(() => {
    if (isOffline) {
      setLogs(membership?.point_logs || []);
    }
  }, [isOffline, membership?.card_id]);

  return (
    <div ref={containerRef} className="flex-1 space-y-4 overflow-y-auto px-2">
      {logs.map((item, index) => (
        <div key={index} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-1 flex items-start justify-between">
            <h3 className="font-semibold text-gray-900 capitalize">
              {POINT_TYPE_LABEL[item?.reference_type] || item?.reference_type}
            </h3>
            <span
              className={`font-semibold ${item?.nominal < 0 ? 'text-red-600' : 'text-green-600'}`}
            >
              {currencyFormat(item?.nominal, false)}
            </span>
          </div>

          <p className="text-sm leading-snug text-gray-600">{item?.reference_code}</p>

          <p className="mt-1 text-xs text-gray-400">{dateFormat(item?.created_at)}</p>
        </div>
      ))}

      {pointLogResult?.isLoading && (
        <div className="py-4 text-center text-sm text-gray-400">Memuat data...</div>
      )}
      {hasMore && <div ref={loadMoreRef} className="h-4" />}

      {!hasMore && (
        <div className="py-3 text-center text-xs text-gray-400">Semua riwayat ditampilkan</div>
      )}
    </div>
  );
};

export default PointHistorySection;
