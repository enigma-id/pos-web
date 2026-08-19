/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useSelector } from 'react-redux';

import CardContent from '../membership/card.content';
import { Modal, NFCField } from '../../../components/ui';
import { CardSearchIcon } from '../../../components/ui/icon';
import useModal from '../../../components/ui/modal/hook';
import useTable from '../../../components/ui/table';
import useMembership from '../../../services/membership/hook';
import CancelTopupModal from './cancel.modal';
import createTableConfig from './table.config';
import TableFilter from './filter';

const TopUpScreen = () => {
  const isOnline = useSelector(state => state?.Offline?.isOnline);
  const apiReachable = useSelector(state => state?.Offline?.apiReachable);
  const isOffline = !isOnline || apiReachable === false;

  const { openModal, closeModal } = useModal();
  const { checkSaldo, checkResult } = useMembership();

  // Stable config → useTable only boots once (config identity must not change per render,
  // otherwise useTable's useEffect([config]) loops: boot → setTable → render → new config → boot...)
  const topupTableRef = React.useRef(null);

  const onRemove = React.useCallback(
    log => {
      if (isOffline) return;
      openModal(
        <CancelTopupModal
          log={log}
          onClose={closeModal}
          onRefetch={() => topupTableRef.current?.boot()}
        />,
        'w-md'
      );
    },
    [openModal, closeModal, isOffline]
  );

  const tableConfig = React.useMemo(() => createTableConfig({ onRemove }), [onRemove]);

  const topupTable = useTable('topup_saldo_logs', tableConfig);
  topupTableRef.current = topupTable;

  // ── Scan card (mirror membership/index.jsx) ──
  const openScan = result => {
    openModal(<NFCField onRead={handleRead} isOpen onClose={closeModal} result={result} />, 'w-md');
  };

  const handleRead = uid => {
    if (isOffline) return;
    checkSaldo({ card_id: uid });
  };

  const onScanSuccess = data => {
    openModal(
      <>
        <Modal.Header onClose={closeModal}>
          <div className="text-[16px] font-semibold tracking-wide">Membership Card</div>
        </Modal.Header>
        <Modal.Body full>
          <CardContent data={data} onClose={closeModal} />
        </Modal.Body>
      </>,
      'w-md'
    );
  };

  React.useEffect(() => {
    if (checkResult?.isSuccess) {
      onScanSuccess(checkResult?.data?.data);
    } else if (checkResult?.isError) {
      openScan(checkResult);
    }
  }, [checkResult]);

  return (
    <div className="flex h-full min-h-screen flex-col bg-slate-50">
      {/* Header */}
      <div className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-semibold tracking-wider text-gray-400 uppercase">
            Membership
          </div>
          <h1 className="text-xl font-bold text-gray-900">Top Up</h1>
          <p className="mt-1 text-sm text-gray-500">
            Kelola riwayat top-up & bonus seluruh member.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn btn-primary btn-sm px-5" onClick={() => openScan(checkResult)}>
            <CardSearchIcon /> Scan Card
          </button>
        </div>
      </div>

      {/* Body: card container */}
      <div className="mx-6 mb-6 min-h-0 flex-1">
        <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <topupTable.Tools>
            <div className="flex h-full items-center justify-end px-4">
              <TableFilter table={topupTable} />
            </div>
          </topupTable.Tools>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <topupTable.Render />
          </div>
          <topupTable.Pagination />
        </div>
      </div>
    </div>
  );
};

export default TopUpScreen;
