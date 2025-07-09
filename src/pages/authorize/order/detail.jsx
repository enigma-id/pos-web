import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useSession from '../../../services/sales/session/hook';
import { currencyFormat, dateFormat } from '../../../utils/common';
import { EmptySection } from '../../../components/ui';

const DetailScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showResult } = useSession(id);

  if (showResult?.isLoading) return <div>loading</div>;

  const data = showResult?.data?.data;

  const ListItem = ({ title, value }) => (
    <div className="border-secondary mb-3 flex place-content-between place-items-center border-b pb-2">
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
      <div className="border-secondary flex h-[62px] flex-1 place-content-between place-items-center gap-4 border-t border-b bg-white px-4">
        <div className="flex place-items-center">
          <div
            className="btn btn-md btn-outline btn-circle border-base-300"
            onClick={() => navigate(-1)}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M7.91664 5.41675L3.45116 9.88223C3.38607 9.94732 3.38607 10.0528 3.45116 10.1179L7.91664 14.5834M3.40234 10.0001H16.6666"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h2 className="border-secondary border-s ps-4 text-xl font-bold">Session Details</h2>
        </div>
      </div>

      <div className="flex flex-1 flex-row bg-white p-4">
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
          <div className="text-accent pb-3 text-xs tracking-wide">CASHFLOW SUMMARY</div>
          <ListItem title="Starting Cash" value={currencyFormat(data?.cash_started)} />
          <ListItem title="Ending Cash" value={currencyFormat(data?.cash_finished)} />
          <ListItem title="Expected Cash" value={currencyFormat(data?.cash_due)} />
          <ListItem title="Total Sales" value={currencyFormat(data?.subtotal_order)} />
          <ListItem title="Total Orders" value={currencyFormat(data?.total_cup, false)} />
        </div>
      </div>

      <div className="">
        <div className="text-accent p-4 pb-3 text-xs tracking-wide">TRANSACTION INFORMATION</div>
        {data?.sales_orders ? (
          <div className="table-responsive m-0 flex h-[calc(60vh)] flex-col">
            <div className="flex-1 overflow-auto">
              <table className="table-hover table-vcenter card-table datatable table-striped table w-full">
                <thead className="border-secondary sticky top-0 z-10 border-b bg-white">
                  <tr>
                    <th className="px-4 py-4 text-left text-sm font-semibold tracking-wide text-black uppercase select-none">
                      Tgl
                    </th>
                    <th className="px-4 py-4 text-left text-sm font-semibold tracking-wide text-black uppercase select-none">
                      Channel
                    </th>
                    <th className="px-4 py-4 text-left text-sm font-semibold tracking-wide text-black uppercase select-none">
                      Code
                    </th>
                    <th className="px-4 py-4 text-end text-sm font-semibold tracking-wide text-black uppercase select-none">
                      Total Charges
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
                      onClick={() => navigate(`/history/${order?.id}`)}
                    >
                      <td className="w-38 px-4 py-2 text-sm">
                        <div>{dateFormat(order?.ordered_at) || '-'}</div>
                      </td>
                      <td className="w-38 px-4 py-2 text-sm">
                        <div>{order?.channel?.name}</div>
                      </td>
                      <td className="w-38 px-4 py-2 text-sm">
                        <div>{order?.code}</div>
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
