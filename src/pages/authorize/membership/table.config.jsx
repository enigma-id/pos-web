import { WalletIcon } from '../../../components/ui/icon';
import config from '../../../services/table/const';
import { currencyFormat } from '../../../utils/common';

const createTableConfig = ({ onClick, filter = {} }) => ({
  ...config,
  url: '/membership',
  filter,
  columns: {
    name: {
      component: row => (
        <div className="text-2xl font-semibold tracking-wide capitalize">{row?.name || '-'}</div>
      ),
    },
    reff_code: {
      component: row => (
        <div className="text-base-300 mt-2 text-[16px] font-thin tracking-wide">
          {row?.reff_code}
        </div>
      ),
    },
    saldo: {
      component: row => (
        <div className="text-primary mt-2 flex place-items-center gap-2 text-[16px] font-semibold tracking-wide">
          <WalletIcon />
          {currencyFormat(row?.saldo)}
        </div>
      ),
    },
    action: {
      component: row => (
        <div className="btn btn-block btn-soft btn-primary mt-4" onClick={() => onClick(row)}>
          See details
        </div>
      ),
    },
  },
});

export default createTableConfig;
