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
        <div className="text-accent mt-2 text-[16px] font-thin tracking-wide">{row?.reff_code}</div>
      ),
    },
    saldo: {
      component: row => (
        <div className="text-primary mt-2 flex place-items-center gap-2 text-[16px] font-semibold tracking-wide">
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0 4C0 2.9 0.9 2 2 2H17C17.2652 2 17.5196 2.10536 17.7071 2.29289C17.8946 2.48043 18 2.73478 18 3V4H2V5H19C19.2652 5 19.5196 5.10536 19.7071 5.29289C19.8946 5.48043 20 5.73478 20 6V16C20 16.5304 19.7893 17.0391 19.4142 17.4142C19.0391 17.7893 18.5304 18 18 18H2C1.46957 18 0.960859 17.7893 0.585786 17.4142C0.210714 17.0391 0 16.5304 0 16V4ZM16.5 13C16.8978 13 17.2794 12.842 17.5607 12.5607C17.842 12.2794 18 11.8978 18 11.5C18 11.1022 17.842 10.7206 17.5607 10.4393C17.2794 10.158 16.8978 10 16.5 10C16.1022 10 15.7206 10.158 15.4393 10.4393C15.158 10.7206 15 11.1022 15 11.5C15 11.8978 15.158 12.2794 15.4393 12.5607C15.7206 12.842 16.1022 13 16.5 13Z"
              fill="currentColor"
            />
          </svg>
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
