/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

export function usePrintWindow({
  width = 400,
  height = 600,
  title = '',
  onClose,
  autoClose = false,
} = {}) {
  const [content, setContent] = useState(null);
  const printWindow = useRef(null);
  const container = useRef(null);
  const rootRef = useRef(null);
  const [ready, setReady] = useState(false);

  const open = children => {
    // Jika belum dibuka atau sudah ditutup, buka jendela baru
    if (!printWindow.current || printWindow.current.closed) {
      printWindow.current = window.open(
        '',
        title,
        `width=${width},height=${height},left=200,top=200`
      );

      if (!printWindow.current) {
        console.error('Failed to open print window');
        return;
      }

      // Buat kontainer baru
      container.current = printWindow.current.document.createElement('div');
      printWindow.current.document.body.appendChild(container.current);

      // Tambahkan style
      const style = printWindow.current.document.createElement('style');
      style.innerHTML = `
        html {
          line-height: 1;
          -ms-text-size-adjust: 100%;
          -webkit-text-size-adjust: 100%
        }
        body {
          font-family: monospace;
          background: #e0e0e0;
          margin: 0;
        }
        @page {
          margin: 0
        }
        .sheet {
          margin: 0 auto;
          overflow: hidden;
          position: relative;
          box-sizing: border-box;
          page-break-after: always;
          background: #fff;
          box-shadow: 0 .5mm 2mm rgba(0, 0, 0, .3);
          margin: 5mm auto;
        }
        body .sheet {
          width: 80mm;
          height: fit-content;
          padding: 0;
        }
        @media print {
          .page-break {
            page-break-after: always
          }
        }
      `;
      printWindow.current.document.head.appendChild(style);

      // Pantau jendela tertutup
      const interval = setInterval(() => {
        if (printWindow.current?.closed) {
          clearInterval(interval);
          setContent(null);
          setReady(false);
          rootRef.current = null;
          onClose?.();
        }
      }, 500);

      setReady(true);
    }

    setContent(() => children);
  };

  useEffect(() => {
    if (content && container.current && printWindow.current && !printWindow.current.closed) {
      if (!rootRef.current) {
        rootRef.current = createRoot(container.current);
      }
      rootRef.current.render(content);

      // Auto print setelah render + delay kecil agar DOM siap
      setTimeout(() => {
        printWindow.current?.focus();
        printWindow.current?.print();

        // Optional: auto-close setelah print
        if (autoClose) {
          setTimeout(() => {
            printWindow.current?.close();
            // printWindow.current.onafterprint = () => printWindow.current?.close();
          }, 300);
        }
      }, 500);
    }
  }, [content]);

  return {
    open,
    isOpen: ready,
    print: () => {
      if (printWindow.current && !printWindow.current.closed) {
        printWindow.current.focus();
        printWindow.current.print();
      }
    },
  };
}
