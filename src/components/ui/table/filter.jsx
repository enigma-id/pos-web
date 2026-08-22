import React from 'react';

const TableFilter = ({ children, isActive = false, isDirty = false, handleClear, handleFilter }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`btn btn-sm h-9 gap-2 rounded-lg px-3 font-medium shadow-sm transition-colors ${
          isActive
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-base-300 bg-base-100 text-base-content hover:bg-base-200'
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="7" y1="12" x2="17" y2="12" />
          <line x1="10" y1="18" x2="14" y2="18" />
        </svg>
        <span className="text-sm">Filter Options</span>
        {isActive && <span className="ml-1 h-2 w-2 rounded-full bg-primary" />}
        <svg
          className={`ml-1 h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[90vw] rounded-xl border border-base-200 bg-base-100 p-5 shadow-lg md:w-[500px]">
          <div className="flex flex-col gap-4">
            <div className="border-b border-base-200 pb-3 text-sm font-semibold text-base-content">
              Filter Options
            </div>
            <div className="flex flex-col gap-3">{children}</div>

            <div className="mt-2 flex gap-3 border-t border-base-200 pt-4">
              <button
                type="button"
                className="btn btn-sm flex-1 border border-base-300 bg-base-100 text-base-content shadow-sm hover:bg-base-200"
                onClick={handleClear}
                disabled={!isDirty && !isActive}
              >
                Clear
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary flex-1 font-medium shadow-sm"
                onClick={handleFilter}
                disabled={!isDirty}
              >
                Apply Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableFilter;
