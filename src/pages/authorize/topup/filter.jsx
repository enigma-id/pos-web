import React from 'react';
import moment from 'moment';

import DatePicker from '../../../components/ui/datepicker';
import TableFilters from '../../../components/ui/table/filter';

const STATUS_OPTIONS = [
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

const TableFilter = ({ table }) => {
  const current = React.useMemo(() => table.State?.filter ?? {}, [table.State?.filter]);

  const [status, setStatus] = React.useState(() => current.status || '');
  const [dateRange, setDateRange] = React.useState(() => {
    const start = current.start_at;
    const end = current.end_at;
    if (start && end) return [moment(start), moment(end)];
    return undefined;
  });

  const buildFilters = () => ({
    status: status || '',
    start_at: dateRange?.[0]?.format('YYYY-MM-DD') || '',
    end_at: dateRange?.[1]?.format('YYYY-MM-DD') || '',
  });

  const isDirty = React.useMemo(() => {
    const f = buildFilters();
    return (
      (f.status || '') !== (current.status || '') ||
      (f.start_at || '') !== (current.start_at || '') ||
      (f.end_at || '') !== (current.end_at || '')
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, dateRange, current]);

  const anyActive = !!(current.status || current.start_at || current.end_at);

  const handleClear = () => {
    setStatus('');
    setDateRange(undefined);
    table.filter('bulk', { status: '', start_at: '', end_at: '' });
  };

  const handleFilter = () => table.filter('bulk', buildFilters());

  return (
    <TableFilters
      isActive={anyActive}
      isDirty={isDirty}
      handleClear={handleClear}
      handleFilter={handleFilter}
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold tracking-wide text-gray-500 uppercase">
            Status
          </label>
          <select
            className="select select-sm select-bordered w-full"
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            <option value="">Semua Status</option>
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold tracking-wide text-gray-500 uppercase">
            Tanggal Dibuat
          </label>
          <DatePicker
            mode="range"
            value={dateRange}
            onChange={setDateRange}
            placeholder="Filter Tanggal"
          />
        </div>
      </div>
    </TableFilters>
  );
};

export default TableFilter;
