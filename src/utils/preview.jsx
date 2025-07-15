import { useEffect, useRef, useState, cloneElement } from 'react';
import ReactDOM from 'react-dom';

export default function PrintWindow({ children, onClose }) {
  const printWindow = useRef(null);
  const container = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    printWindow.current = window.open('', '', 'width=400,height=600,left=200,top=200');
    const win = printWindow.current;

    if (win) {
      container.current = win.document.createElement('div');
      win.document.body.appendChild(container.current);

      const style = win.document.createElement('style');
      style.innerHTML = `
        html {
            line-height: 1;
            -ms-text-size-adjust: 100%;
            -webkit-text-size-adjust: 100%
        }
        body {
          font-family: monospace;
          background: #e0e0e0
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

        body.80MM .sheet {
            width:80mm;
            height:fit-content;
            padding: 0;
            overflow: hide;
        }

        @media print {
            .page-break {
                page-break-after: always
            }
            @page {
                padding-right: 0px
            }
        }
      `;
      win.document.head.appendChild(style);

      setReady(true);

      const interval = setInterval(() => {
        if (win.closed) {
          clearInterval(interval);
          onClose?.();
        }
      }, 500);
    }

    return () => {
      // Tidak menutup langsung saat unmount agar user bisa print dulu
    };
  }, [onClose]);

  if (!ready || !container.current) return null;

  // Inject window.print() dari jendela popup ke children
  const enhancedChildren = cloneElement(children, {
    print: () => printWindow.current?.print(),
  });

  return ReactDOM.createPortal(enhancedChildren, container.current);
}
