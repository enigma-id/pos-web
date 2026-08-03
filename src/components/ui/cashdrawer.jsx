import React from 'react';

const CashDrawerTrigger = () => {
  return (
    <div className="sheet" style={{ height: '1mm', overflow: 'hidden' }}>
      {/*
          This is a tiny 1mm blank sheet.
          Printing this will trigger the Windows Printer Driver
          to "Open Cash Drawer" if configured in Printer Properties.
      */}
      &nbsp;
    </div>
  );
};

export default CashDrawerTrigger;
