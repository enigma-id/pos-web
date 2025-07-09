import config from '../../../services/table/const';
import { dateFormat } from '../../../utils/common';

const createTableConfig = (navigate, filter = {}) => ({
  ...config,
  url: '/sales/order',
  filter,
  columns: {
    ordered_at: {
      title: 'Tgl',
      sortable: true,
      width: 150,
      component: row => <div>{dateFormat(row?.ordered_at) || '-'}</div>,
    },
    channel: {
      alias: 'channel.id',
      title: 'Channel',
      sortable: true,
      width: 150,
      component: row => <div>{row?.channel?.name}</div>,
    },
    code: {
      title: 'Code',
      sortable: true,
      width: 150,
      component: row => <div>{row?.code}</div>,
    },
    total_charges: {
      title: 'Total Charges',
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
      component: () => (
        <div>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M10.8536 7.64645C11.0488 7.84171 11.0488 8.15829 10.8536 8.35355L5.85355 13.3536C5.65829 13.5488 5.34171 13.5488 5.14645 13.3536C4.95118 13.1583 4.95118 12.8417 5.14645 12.6464L9.79289 8L5.14645 3.35355C4.95118 3.15829 4.95118 2.84171 5.14645 2.64645C5.34171 2.45118 5.65829 2.45118 5.85355 2.64645L10.8536 7.64645Z"
              fill="currentColor"
            />
          </svg>
        </div>
      ),
    },
  },
  onRowClick: row => {
    navigate(`/history/${row?.id}`);
  },
});

export default createTableConfig;
