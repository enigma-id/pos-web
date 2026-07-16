import React from 'react';

const variantMap = {
  offline: 'alert-warning',
  syncing: 'alert-info',
  warning: 'alert-warning',
  error: 'alert-error',
  success: 'alert-success',
};

const OfflineBanner = ({
  variant = 'offline',
  message,
  pendingCount = 0,
  onRetry,
  onDismiss,
  className = '',
}) => {
  const resolvedVariant = variantMap[variant] || 'alert-warning';

  return (
    <div className={`pointer-events-none fixed top-2 left-0 z-50 w-full px-4 ${className}`}>
      <div
        className={`alert ${resolvedVariant} pointer-events-auto mx-auto flex max-w-4xl place-content-between place-items-center shadow-lg`}
      >
        <div className="flex place-items-center gap-2">
          <span className="font-semibold">{message}</span>
          {variant === 'syncing' && pendingCount > 0 && (
            <span className="badge badge-sm badge-neutral">{pendingCount}</span>
          )}
        </div>

        <div className="flex gap-2">
          {onRetry && (
            <button className="btn btn-xs btn-neutral" onClick={onRetry}>
              Retry
            </button>
          )}
          {onDismiss && (
            <button className="btn btn-xs btn-ghost" onClick={onDismiss}>
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfflineBanner;
