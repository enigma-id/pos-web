import React from 'react';
import { useSelector } from 'react-redux';

import Input from './input';
import Modal from './modal';
import { currencyFormat } from '../../utils/common';

// ini hanya untuk print discount open bill
const PrintDiscount = ({ data, onClose, onPrint }) => {
  const [discount, setDiscount] = React.useState('');

  const toPrint = () => {
    const x = {
      ...data,
      discount_value: discount,
      total_charges: data?.total_charges - discount,
    };
    onPrint(x);
  };

  return (
    <>
      <Modal.Header onClose={onClose}>
        <div className="text-lg font-semibold">Print Recipient</div>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-3 py-4">
          <div>Do you want to add a discount to this unpaid bill?</div>
          <div className="mb-3">Total bill amount will be reduced by the discount.</div>

          <Input
            value={currencyFormat(discount)}
            onChange={e => {
              const raw = e.target.value.replace(/[^0-9]/g, '');
              setDiscount(raw);
            }}
          />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="btn btn-md px-10" onClick={onClose}>
          Cancel
        </div>
        <div className="btn btn-md btn-error px-10 text-white" onClick={toPrint}>
          Print
        </div>
      </Modal.Footer>
    </>
  );
};

export default PrintDiscount;
