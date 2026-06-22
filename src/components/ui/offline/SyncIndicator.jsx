import React from 'react';

const SyncIndicator = ({ pendingCount = 0, failedCount = 0, onClick }) => {
  if (pendingCount <= 0 && failedCount <= 0) return null;

  const badgeClass = failedCount > 0 ? 'badge-error' : 'badge-warning';
  const count = failedCount > 0 ? failedCount : pendingCount;

  return (
    <button className="btn btn-sm btn-outline relative" onClick={onClick}>
      Sync Queue
      <span className={`badge badge-sm ${badgeClass} absolute -top-2 -right-2`}>{count}</span>
    </button>
  );
};

export default SyncIndicator;
