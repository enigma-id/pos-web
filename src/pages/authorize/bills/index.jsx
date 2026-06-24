/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { FaCopy } from 'react-icons/fa';

import {
  EmptySection,
  Kitchen,
  Receipt,
  OrderDetails,
  Refund,
  CopyOrder,
} from '../../../components/ui';
import { MoneysIcon, PrintIcon, SearchIcon, TrashIcon } from '../../../components/ui/icon';
import useModal from '../../../components/ui/modal/hook';
import useCart from '../../../services/cart/hook';
import useOrder from '../../../services/sales/order/hook';
import { currencyFormat, dateFormat } from '../../../utils/common';
import { usePrintWindow } from '../../../utils/print';

const BillScreen = () => {
  const [detail, setDetail] = React.useState(null);
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  const { show, showResult } = useOrder();
  const { bill, billResult  } = useCart();
  const { openModal, closeModal } = useModal();

  const { open } = usePrintWindow({ title: 'Print Preview', autoClose: true });

  const handleOpenPrintReceipt = () => {
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
          bill()
          closeModal();
        }}
      />,
      'w-md'
    );
  };

  React.useEffect(() => {
    bill()
  }, []);

  // Reset to first item on new data
  React.useEffect(() => {
    if (billResult?.isSuccess) {
      setSelectedIndex(0);
      setDetail(null);
    }
  }, [billResult]);

  React.useEffect(() => {
    if (billResult?.isSuccess) {
      show(billResult?.data?.data?.[selectedIndex]?.id);
    }
  }, [billResult, selectedIndex]);

  React.useEffect(() => {
    if (showResult?.isSuccess) {
      setDetail(showResult?.data?.data);
    }
  }, [showResult]);

  const data = billResult?.data?.data || [];

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="border-base-200 flex w-100 flex-col overflow-y-auto border-r border-l bg-white">

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
                    <div className="text-base-300 text-xs">{item?.ticket || '-'}</div>
                  </div>
                </div>
                <div className="flex flex-col place-content-between">
                  <div className="text-base-300 text-end text-sm">{item?.code}</div>

                  <div className="text-base-300 text-end text-xs">
                    {dateFormat(item?.ordered_at)}
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
              {/* <div
                className="bg-success text-base-100 flex h-full cursor-pointer place-items-center gap-2 px-4 text-sm capitalize"
                onClick={onCopyOrder}
              >
                <FaCopy />
                copy order
              </div> */}
              <div
                className="bg-primary text-base-100 flex h-full cursor-pointer place-items-center gap-2 px-4 text-sm capitalize"
                onClick={handleOpenPrintReceipt}
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

export default BillScreen;
