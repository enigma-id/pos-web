import { TrashIcon } from '../../../components/ui/icon';
import config from '../../../services/table/const';
import { currencyFormat, dateFormat } from '../../../utils/common';

const createTableConfig = ({ onRemove, filter = {} }) => ({
  ...config,
  url: '/saldo_logs',
  filter,
  columns: {
    created_at: {
      title: 'Tanggal',
      sortable: true,
      class: 'text-sm',
      component: row => (
        <div>
          <span className="block font-medium">{dateFormat(row?.created_at, 'DD/MM/YYYY')}</span>
          <span className="block text-xs text-gray-400">{dateFormat(row?.created_at, 'HH:mm')}</span>
        </div>
      ),
    },
    reference_type: {
      title: 'Tipe',
      sortable: true,
      class: 'text-center',
      headerClass: 'text-center',
      component: row => {
        const isBonus = row?.reference_type === 'bonus';
        return (
          <span
            className={`badge badge-sm px-2.5 font-semibold tracking-wider ${
              isBonus ? 'badge-soft' : 'badge-soft badge-primary'
            }`}
          >
            {isBonus ? 'Bonus' : 'Topup'}
          </span>
        );
      },
    },
    nominal: {
      title: 'Nominal',
      sortable: true,
      class: 'font-mono text-right',
      headerClass: 'text-right',
      component: row => <span className="font-semibold">{currencyFormat(row?.nominal)}</span>,
    },
    reference_code: {
      title: 'Kode',
      sortable: true,
      class: 'text-sm',
      component: row => <span className="font-medium">{row?.reference_code || '-'}</span>,
    },
    payment_type: {
      title: 'Metode',
      sortable: true,
      class: 'text-sm capitalize',
      component: row => (
        <span className="capitalize">{row?.payment_type || <span className="text-gray-400">-</span>}</span>
      ),
    },
    membership: {
      title: 'Member',
      sortable: true,
      class: 'text-sm',
      component: row => (
        <div>
          <span className="block font-medium">{row?.membership?.name || '-'}</span>
          <span className="block text-xs text-gray-400">{row?.membership?.reff_code || ''}</span>
        </div>
      ),
    },
    status: {
      title: 'Status',
      sortable: true,
      class: 'text-center',
      headerClass: 'text-center',
      component: row => (
        <span
          className={`badge badge-sm px-2.5 font-semibold tracking-wider ${
            row?.status === 'cancelled' ? 'badge-error badge-soft' : 'badge-success badge-soft'
          }`}
        >
          {row?.status || 'completed'}
        </span>
      ),
    },
    cancelled_reason: {
      title: 'Alasan',
      class: 'text-xs text-gray-500',
      component: row => (
        <div className="max-w-[10rem] truncate text-xs text-gray-500">
          {row?.cancelled_reason || '-'}
        </div>
      ),
    },
    cancelled_by: {
      title: 'Dibatalkan Oleh',
      class: 'text-xs text-gray-500',
      component: row => <div className="text-xs text-gray-500">{row?.cancelled_by || '-'}</div>,
    },
    cancelled_at: {
      title: 'Dibatalkan Saat',
      class: 'text-xs text-gray-500',
      component: row => (
        <div className="text-xs text-gray-500">
          {row?.cancelled_at ? dateFormat(row?.cancelled_at, 'DD/MM/YYYY HH:mm') : '-'}
        </div>
      ),
    },
    action: {
      title: '',
      class: 'text-right',
      headerClass: 'text-right',
      sortable: false,
      align: 'right',
      component: row =>
        row?.status === 'cancelled' ? (
          <span />
        ) : (
          <button
            className="btn btn-ghost btn-xs btn-circle text-error/70 transition-colors hover:bg-red-50 hover:text-error"
            title="Cancel topup"
            onClick={e => {
              e.stopPropagation();
              onRemove?.(row);
            }}
          >
            <TrashIcon />
          </button>
        ),
    },
  },
});

export default createTableConfig;
