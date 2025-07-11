import { ArrowRightIcon } from '../../../components/ui/icon';
import config from '../../../services/table/const';
import { currencyFormat, dateFormat } from '../../../utils/common';

const createTableConfig = (navigate, filter = {}) => ({
  ...config,
  url: '/sales/order',
  filter,
  columns: {
    code: {
      title: 'Code',
      sortable: true,
      width: 80,
      component: row => <div>{row?.code}</div>,
    },
    ordered_at: {
      title: 'Order Date',
      sortable: true,
      width: 150,
      component: row => <div>{dateFormat(row?.ordered_at) || '-'}</div>,
    },
    channel: {
      alias: 'channel.id',
      title: 'Channel',
      sortable: true,
      headerClass: '!text-center',
      class: 'text-center',
      width: 150,
      component: row => <div>{row?.channel?.name}</div>,
    },
    payment: {
      alias: 'payment_method.id',
      title: 'Payment Method',
      headerClass: '!text-center',
      class: 'text-center',
      sortable: true,
      width: 150,
      component: row => <div>{row?.payment_method?.name || 'CASH'}</div>,
    },
    total_bill: {
      title: 'Total Bill',
      sortable: true,
      format_number: true,
      class: 'text-end capitalize',
      headerClass: '!text-end',
      width: 150,
    },
    discount: {
      title: 'Discount',
      sortable: true,
      class: 'text-end capitalize',
      headerClass: '!text-end',
      width: 150,
      component: row => (
        <div>
          {row?.discount_value > 0
            ? `${currencyFormat(row?.discount_value)} (${row?.discount}%)`
            : '-'}
        </div>
      ),
    },
    total_charges: {
      title: 'Total Paid',
      sortable: true,
      format_number: true,
      class: 'text-end capitalize',
      headerClass: '!text-end',
      width: 150,
    },
    status: {
      title: 'Status',
      sortable: true,
      width: 150,
      class: 'place-items-center',
      headerClass: '!text-center',
      component: row => (
        <div
          className={`${
            row?.status === 'pending' ? 'bg-accent' : 'bg-success'
          } w-fit rounded-full px-4 py-1 text-[11px] text-white`}
        >
          {row?.status}
        </div>
      ),
    },
    action: {
      title: '',
      class: 'place-items-center',
      width: 20,
      component: () => <ArrowRightIcon />,
    },
  },
  onRowClick: row => {
    navigate(`/history/${row?.id}`);
  },
});

export default createTableConfig;
