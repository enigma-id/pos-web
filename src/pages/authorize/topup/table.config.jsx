import { TrashIcon } from '../../../components/ui/icon';
import config from '../../../services/table/const';
import { currencyFormat, dateFormat } from '../../../utils/common';

const createTableConfig = ({ onRemove, filter = {} }) => ({
  ...config,
  url: '/saldo_logs',
  filter,
  columns: {
    created_at: {
      component: row => (
        <div>{dateFormat(row?.created_at, 'DD/MM/YYYY HH:mm')}</div>
      ),
    },
    reference_type: {
      component: row => {
        const isBonus = row?.reference_type === 'bonus';
        return (
          <span className={`badge ${isBonus ? 'badge-soft' : 'badge-primary'}`}>
            {isBonus ? 'Bonus' : 'Topup'}
          </span>
        );
      },
    },
    nominal: {
      component: row => (
        <div className="font-semibold">{currencyFormat(row?.nominal)}</div>
      ),
    },
    reference_code: {
      component: row => <div>{row?.reference_code || '-'}</div>,
    },
    payment_type: {
      component: row => <div className="capitalize">{row?.payment_type || '-'}</div>,
    },
    membership: {
      component: row => <div>{row?.membership?.name || '-'}</div>,
    },
    status: {
      component: row => (
        <span className={`badge ${row?.status === 'cancelled' ? 'badge-error' : 'badge-success'}`}>
          {row?.status || 'completed'}
        </span>
      ),
    },
    cancelled_reason: {
      component: row => <div>{row?.cancelled_reason || '-'}</div>,
    },
    cancelled_by: {
      component: row => <div>{row?.cancelled_by || '-'}</div>,
    },
    cancelled_at: {
      component: row => (
        <div>
          {row?.cancelled_at ? dateFormat(row?.cancelled_at, 'DD/MM/YYYY HH:mm') : '-'}
        </div>
      ),
    },
    action: {
      component: row => (
        <button
          className="btn btn-ghost btn-circle btn-xs !text-error"
          title="Cancel topup"
          onClick={() => onRemove?.(row)}
        >
          <TrashIcon />
        </button>
      ),
    },
  },
});

export default createTableConfig;
