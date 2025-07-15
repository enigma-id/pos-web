import { useNavigate, useParams } from 'react-router-dom';

import { EmptySection } from '../../../components/ui';
import { ArrowRightIcon, BackIcon } from '../../../components/ui/icon';
import useSession from '../../../services/sales/session/hook';
import { currencyFormat, dateFormat } from '../../../utils/common';

const DetailScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showResult } = useSession(id);

  if (showResult?.isLoading) return <div>loading</div>;

  const data = showResult?.data?.data;

  const ListItem = ({ title, value }) => (
    <div className="border-base-200 mb-3 flex place-content-between place-items-center border-b pb-2">
      <div className="text-sm">{title}</div>
      <div
        className={`text-sm font-semibold ${value === 'completed' || value === 'finished' ? 'bg-success w-fit rounded-full px-4 py-1 !text-[11px] text-white uppercase' : value === 'pending' || value === 'active' ? 'bg-accent w-fit rounded-full px-4 py-1 !text-[11px] text-white uppercase' : ''}`}
      >
        {value}
      </div>
    </div>
  );

  return (
    <div>
      <div className="border-base-200 bg-base-100 flex h-[62px] flex-1 place-content-between place-items-center gap-4 border-t border-b px-4">
        <div className="flex place-items-center">
          <div
            className="btn btn-md btn-outline btn-circle border-base-200"
            onClick={() => navigate(-1)}
          >
            <BackIcon />
          </div>
          <h2 className="border-base-200 border-s ps-4 text-xl font-bold">Session Details</h2>
        </div>
      </div>

      <div className="bg-base-100 flex flex-1 flex-row p-4">
        <div className="flex-1/2 pe-4">
          <div className="text-accent pb-3 text-xs tracking-wide">SESSION OVERVIEW</div>
          <ListItem title="Status" value={data?.status} />
          <ListItem
            title="Transaction Date"
            value={dateFormat(data?.transaction_date, 'DD MMM YYYY')}
          />
          <ListItem
            title="Session Time"
            value={`${dateFormat(data?.started_at, 'DD MMM YYYY')} - ${dateFormat(data?.finished_at, 'DD MMM YYYY', '(ongoing)')}`}
          />
          <ListItem title="Outlet" value={data?.outlet?.alias} />
          <ListItem title="Cashier" value={data?.cashier?.name} />
        </div>
        <div className="flex-1/2 pe-4">
          <div className="text-accent mb-1 pb-3 text-xs tracking-wide">CASHFLOW SUMMARY</div>
          <ListItem title="Starting Cash" value={currencyFormat(data?.cash_started)} />
          <ListItem title="Ending Cash" value={currencyFormat(data?.cash_finished)} />
          <ListItem title="Expected Cash" value={currencyFormat(data?.cash_due)} />
          <ListItem title="Total Sales" value={currencyFormat(data?.subtotal_order)} />
          <ListItem
            title="Total Orders"
            value={currencyFormat(data?.sales_orders?.length, false)}
          />
        </div>
      </div>

      <div className="">
        <div className="text-accent p-4 pb-3 text-xs tracking-wide">TRANSACTION INFORMATION</div>
        {data?.sales_orders ? (
          <div className="table-responsive m-0 flex h-[calc(45vh)] flex-col">
            <div className="flex-1 overflow-auto">
              <table className="table-hover table-vcenter card-table datatable table-striped table w-full">
                <thead className="border-base-200 bg-base-100 sticky top-0 z-10 border-b">
                  <tr>
                    <th className="px-4 py-4 text-left text-sm font-semibold tracking-wide text-black uppercase select-none">
                      Code
                    </th>
                    <th className="px-4 py-4 text-left text-sm font-semibold tracking-wide text-black uppercase select-none">
                      Order Date
                    </th>
                    <th className="px-4 py-4 text-center text-sm font-semibold tracking-wide text-black uppercase select-none">
                      Channel
                    </th>
                    <th className="px-4 py-4 text-center text-sm font-semibold tracking-wide text-black uppercase select-none">
                      Payment Method
                    </th>
                    <th className="px-4 py-4 text-end text-sm font-semibold tracking-wide text-black uppercase select-none">
                      Total Bill
                    </th>
                    <th className="px-4 py-4 text-end text-sm font-semibold tracking-wide text-black uppercase select-none">
                      Discount
                    </th>
                    <th className="px-4 py-4 text-end text-sm font-semibold tracking-wide text-black uppercase select-none">
                      Total Paid
                    </th>
                    <th className="px-4 py-4 text-center text-sm font-semibold tracking-wide text-black uppercase select-none">
                      Status
                    </th>
                    <th className="px-4 py-4 text-left text-sm font-semibold tracking-wide text-black uppercase select-none"></th>
                  </tr>
                </thead>
                <tbody>
                  {data?.sales_orders?.map((order, i) => (
                    <tr
                      key={i}
                      className="text-accent hover:!text-primary text-sm font-medium tracking-wide uppercase hover:cursor-pointer"
                      onClick={() =>
                        order?.status === 'completed'
                          ? navigate(`/history/${order?.id}`)
                          : navigate(`/bills/${order?.id}`)
                      }
                    >
                      <td className="w-38 px-4 py-2 text-sm">
                        <div>{order?.code}</div>
                      </td>
                      <td className="w-38 px-4 py-2 text-sm">
                        <div>{dateFormat(order?.ordered_at) || '-'}</div>
                      </td>
                      <td className="w-38 px-4 py-2 text-center text-sm">
                        <div>{order?.channel?.name}</div>
                      </td>
                      <td className="w-38 px-4 py-2 text-center text-sm">
                        <div>{order?.payment_method?.name || 'CASH'}</div>
                      </td>
                      <td className="w-38 px-4 py-2 text-end text-sm !capitalize">
                        {currencyFormat(order?.total_bill)}
                      </td>

                      <td className="w-38 px-4 py-2 text-end text-sm !capitalize">
                        {order?.discount_value > 0
                          ? `${currencyFormat(order?.discount_value)} (${order?.discount}%)`
                          : '-'}
                      </td>
                      <td className="w-38 px-4 py-2 text-end text-sm !capitalize">
                        {currencyFormat(order?.total_charges)}
                      </td>
                      <td className="w-38 place-items-center px-4 py-2 text-sm">
                        <div
                          className={`${
                            order?.status === 'pending' ? 'bg-accent' : 'bg-success'
                          } w-fit rounded-full px-4 py-1 text-[11px] text-white`}
                        >
                          {order?.status}
                        </div>
                      </td>
                      <td className="w-5 px-4 py-2 text-sm">
                        <div>
                          <ArrowRightIcon />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptySection />
        )}
      </div>
    </div>
  );
};

export default DetailScreen;
