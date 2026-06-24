/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useSelector } from 'react-redux';

import {
  EmptySection,
  Kitchen,
  OrderDetails,
  Receipt,
  Refund,
} from '../../../components/ui';
import { MoneysIcon, PrintIcon, SearchIcon, TrashIcon } from '../../../components/ui/icon';
import useModal from '../../../components/ui/modal/hook';
import useOrder from '../../../services/sales/order/hook';
import useSession from '../../../services/sales/session/hook';
import { currencyFormat, dateFormat } from '../../../utils/common';
import { usePrintWindow } from '../../../utils/print';

const HistoryScreen = () => {
  const Session = useSelector(state => state?.Auth?.session);

  const [detail, setDetail] = React.useState(null);
  // const [search, setSearch] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [data, setData] = React.useState([]);

  const { show, showResult } = useSession();
  const { show: showOrder, showResult: showOrderResult } = useOrder();

  const { openModal, closeModal } = useModal();

  const { open } = usePrintWindow({ title: 'Print Preview', autoClose: true });

  const handleOpenPrint = () => {
    open(<Receipt data={detail} />);
  };
  const handleOpenPrintKitchen = () => {
    open(<Kitchen data={detail} />);
  };

  const onRefund = id => {
    openModal(
      <Refund
        id={id}
        onClose={() => {
          show(Session?.sales_session?.id)
          closeModal();
        }}
      />,
      'w-md'
    );
  };

  React.useEffect(() => {
    if (Session?.sales_session) {
      show(Session?.sales_session?.id)
    }
  }, [Session]);


  React.useEffect(() => {
    if (showResult?.isSuccess) {
      setSelectedIndex(0);
      setData(showResult?.data?.data?.orders);
    }
  }, [showResult]);

  React.useEffect(() => {
    if (showResult?.isSuccess && data?.length > 0) {
      showOrder(data[selectedIndex]?.id);
    }
  }, [showResult, data, selectedIndex]);

  React.useEffect(() => {
    if (showOrderResult?.isSuccess) {
      setDetail(showOrderResult?.data?.data)
    }
  }, [showOrderResult]);


  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="border-base-200 flex w-100 flex-col overflow-y-auto border-r border-l bg-white">
        {/* <div className="h-16">
          <div className="border-base-200 relative flex h-full w-full items-center border-b border-l">
            <div className="absolute left-4">
              <SearchIcon />
            </div>

            <input
              name="search"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-full w-full pl-15 focus-visible:outline-none!"
            />
          </div>
        </div> */}

        <div className="flex-1 overflow-y-auto">
          {data?.map((item, index) => (
            <div
              key={item.id}
              onClick={() => setSelectedIndex(index)}
              className={`border-base-200 cursor-pointer border-b p-4 ${
                selectedIndex === index ? 'bg-gray-100' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex place-content-between">
                <div className="flex place-items-center gap-4">
                  <div className={`text-base ${selectedIndex === index ? 'text-primary' : ''}`}>
                    <MoneysIcon />
                  </div>
                  <div>
                    <div className={`text-base ${selectedIndex === index ? 'text-primary' : ''}`}>
                      {currencyFormat(item?.total_charges)}
                    </div>
                    <div className="text-base-300 text-xs">{
                      item?.ticket ? item?.ticket :
                      item?.membership ? item?.membership?.name :
                      item?.note ? item?.note :
                      '-'
                    }</div>
                  </div>
                </div>
                <div className="flex flex-col place-content-between">
                  <div className="text-base-300 text-end text-sm">{item?.code}</div>

                  <div className="text-base-300 text-end text-xs">
                    {dateFormat(item?.created_at)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail View */}
      {detail ? (
        <div className="h-full w-full">
          <div className="bg-base-100 h-16 w-full">
            <div className="flex h-full flex-1/2 place-content-end place-items-center">
              <div
                className="bg-primary text-base-100 flex h-full cursor-pointer place-items-center gap-2 px-4 text-sm capitalize"
                onClick={handleOpenPrint}
              >
                <PrintIcon />
                print receipt
              </div>
              <div
                className="bg-base-content text-base-100 flex h-full cursor-pointer place-items-center gap-2 px-4 text-sm capitalize"
                onClick={handleOpenPrintKitchen}
              >
                <PrintIcon />
                print kitchen
              </div>
              <div
                className="bg-error text-base-100 flex h-full cursor-pointer place-items-center gap-2 px-4 text-sm capitalize"
                onClick={() => onRefund(detail?.id)}
              >
                <TrashIcon />
                refund
              </div>
            </div>
          </div>

          <div className="flex h-[calc(100vh-64px)] w-full place-content-center overflow-x-auto py-20">
            <div className="w-2/4">
              <OrderDetails data={detail} />
            </div>
          </div>
        </div>
      ) : (
        <div className="h-full w-full">
          <EmptySection />
        </div>
      )}
    </div>
  );
};

export default HistoryScreen;
