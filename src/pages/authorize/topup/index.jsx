/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useSelector } from 'react-redux';

import CardContent from '../membership/card.content';
import { Drawer, Modal, NFCField } from '../../../components/ui';
import { CardSearchIcon } from '../../../components/ui/icon';
import useModal from '../../../components/ui/modal/hook';
import useTable from '../../../components/ui/table';
import useMembership from '../../../services/membership/hook';
import CancelTopupModal from './cancel.modal';
import createTableConfig from './table.config';

const TopUpScreen = () => {
  const isOnline = useSelector(state => state?.Offline?.isOnline);
  const apiReachable = useSelector(state => state?.Offline?.apiReachable);
  const isOffline = !isOnline || apiReachable === false;

  const { openModal, closeModal } = useModal();
  const { checkSaldo, checkResult } = useMembership();
  const [status, setStatus] = React.useState('completed');

  // Stable config → useTable only boots once (config identity must not change per render,
  // otherwise useTable's useEffect([config]) loops: boot → setTable → render → new config → boot...)
  const topupTableRef = React.useRef(null);

  const onRemove = React.useCallback(
    log => {
      openModal(
        <CancelTopupModal
          log={log}
          onClose={closeModal}
          onRefetch={() => topupTableRef.current?.boot()}
        />,
        'w-md'
      );
    },
    [openModal, closeModal]
  );

  const tableConfig = React.useMemo(() => createTableConfig({ onRemove }), [onRemove]);

  const topupTable = useTable('topup_saldo_logs', tableConfig);
  topupTableRef.current = topupTable;

  const STATUS_FILTERS = [
    { label: 'Completed', value: 'completed' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  const handleStatusChange = value => {
    setStatus(value);
    topupTable.filter('status', value === 'all' ? null : value);
  };

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
          <CardContent
            data={data}
            onClose={closeModal}
          />
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
    <Drawer.Wrapper>
      <topupTable.Tools>
        <div className="flex h-full place-content-end place-items-center gap-2 px-4">
          <button
            className="btn bg-primary/15 text-primary rounded-none border-0 px-6"
            onClick={() => openScan(checkResult)}
          >
            <CardSearchIcon /> Scan Card
          </button>
          <select
            name="filter-status"
            value={status}
            onChange={e => handleStatusChange(e.target.value)}
            className="select select-sm select-bordered"
          >
            {STATUS_FILTERS.map(f => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </topupTable.Tools>
      <topupTable.Render />
      <topupTable.Pagination />
    </Drawer.Wrapper>
  );
};

export default TopUpScreen;
