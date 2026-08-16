import React from 'react';

const CashDrawerTrigger = () => {
  return (
    <div
      className="sheet"
      style={{ height: '0.5mm', overflow: 'hidden', margin: 0, padding: 0 }}
    >
      {/*
          Tiny near-blank sheet — height, margin & padding zeroed to
          minimize paper feed. Printing this triggers the Windows Printer
          Driver to "Open Cash Drawer" if configured in Printer Properties.
          NOTE: driver may still feed a few mm for tear bar; raw ESC/POS
          (not possible in pure web) would be needed for zero feed.
      */}
    </div>
  );
};

export default CashDrawerTrigger;
