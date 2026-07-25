import React from 'react';
import { useSelector } from 'react-redux';
import CardContent from './card.content';
import useMembership from '../../../services/membership/hook';
import { getMemberCache, setMemberCache } from '../../../utils/cache';
import { BackIcon, SearchIcon } from '../../../components/ui/icon';

const TopupManual = () => {
  const { checkSaldo, checkResult } = useMembership();
  const [cardId, setCardId] = React.useState('');
  const [member, setMember] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const scanConsumed = React.useRef(false);

  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  const handleSearch = () => {
    const uid = cardId.trim();
    if (!uid) return;

    setError('');
    setLoading(true);
    scanConsumed.current = false;

    if (isOffline) {
      const cached = getMemberCache(uid);
      if (cached) {
        setMember(cached);
        setLoading(false);
        return;
      }
      setError('Member data not available offline. Please scan while online first to cache.');
      setLoading(false);
      return;
    }

    checkSaldo({ card_id: uid });
  };

  React.useEffect(() => {
    if (checkResult?.isSuccess && !scanConsumed.current) {
      scanConsumed.current = true;
      const data = checkResult?.data?.data;
      if (data?.card_id) setMemberCache(data.card_id, data);
      setMember(data);
      setLoading(false);
    }
  }, [checkResult]);

  React.useEffect(() => {
    if (checkResult?.isError && !scanConsumed.current) {
      scanConsumed.current = true;
      setError('Member not found. Check card ID or try again later.');
      setLoading(false);
    }
  }, [checkResult]);

  if (member) {
    return (
      <div className="flex h-screen flex-col">
        <div className="border-base-200 bg-base-100 flex h-16 border-t border-b">
          <div className="border-base-200 flex-1 place-content-center border-r border-l">
            <div className="flex place-items-center gap-6 px-4">
              <div className="btn btn-circle btn-md btn-outline" onClick={() => setMember(null)}>
                <BackIcon />
              </div>
              <div className="text-lg font-semibold">Topup — {member.name}</div>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <CardContent
            data={member}
            onClose={() => {
              setMember(null);
              setCardId('');
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="border-base-200 bg-base-100 flex h-16 border-t border-b">
        <div className="border-base-200 flex-1 place-content-center border-r border-l">
          <div className="flex place-items-center gap-6 px-4">
            <div className="text-lg font-semibold">Manual Topup</div>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col place-content-center place-items-center p-8">
        <div className="w-full max-w-md space-y-4">
          <label className="text-sm font-semibold">Card ID / Member Code</label>
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder="e.g. 1234567890"
            value={cardId}
            onChange={e => setCardId(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
            autoFocus
          />

          {error && (
            <div className="text-sm text-error bg-error/10 rounded px-3 py-2">{error}</div>
          )}

          <button
            className={`btn btn-primary btn-block btn-xl ${loading ? 'btn-disabled' : ''}`}
            onClick={handleSearch}
          >
            {loading ? <span className="loading loading-spinner"></span> : <><SearchIcon /> Search Member</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopupManual;
