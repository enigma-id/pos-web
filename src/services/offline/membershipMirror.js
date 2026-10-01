import { v4 as uuidv4 } from 'uuid';

import { computeEarnedPoint } from './helper';
import { perbaharuiMembership, showMembership } from '../../utils/cache';

// Entri lokal bersifat provisional — begitu online, cache ditimpa data server (Q4 = a).
// reference_type lokal tidak benturan dengan point_log server (UNIQUE reference_id + reference_type)
// karena id-nya uuidv4() lokal.
const isMemberPayment = order => !!order?.payment_method?.is_member_payment;

const referenceId = order => order?.id || order?.sync_id;

const logEntry = (customer, { nominal, referenceId: refId, referenceCode, referenceType }) => ({
  id: uuidv4(),
  nominal,
  membership_id: customer?.id,
  reference_id: refId,
  reference_type: referenceType,
  reference_code: referenceCode,
  created_at: new Date(),
});

// Basis hitung WAJIB entri cache terkini, bukan snapshot `order.membership`.
// `perbaharuiMembership` menimpa semua field ({...existing, ...clone}), jadi kalau basisnya
// snapshot lama, nilai point/saldo hasil hitung akan menimpa nilai terbaru di cache
// (contoh: revert menulis 408.100 padahal seharusnya 413.900).
const updateCache = (customer, mutate) => {
  const base = showMembership(customer?.card_id) || customer;
  const clone = JSON.parse(JSON.stringify(base));
  mutate(clone);
  return perbaharuiMembership(clone);
};

/**
 * Mirror lokal membership saat checkout offline.
 * Tulis entri ledger lokal (point_logs/saldo_logs) supaya tab Saldo/Point offline ada isinya
 * sebelum sync; server menulis ledger aslinya saat sync.
 * Guard sama dengan redeem/saldo: hanya untuk member payment (Q1).
 *
 * Order harus membawa: membership, payment_method, is_point, total_charges, items, code.
 */
export function mirrorMembershipOrder(order) {
  const customer = order?.membership;
  if (!customer || !isMemberPayment(order)) return null;

  return updateCache(customer, clone => {
    const totalCharges = Number(order?.total_charges || 0);
    const refId = referenceId(order);

    // Bayar pakai point → redeem saja; server juga skip Earned saat IsPoint.
    if (order?.is_point) {
      clone.point = (clone.point || 0) - totalCharges;
      clone.point_logs = clone.point_logs || [];
      clone.point_logs.unshift(
        logEntry(customer, {
          nominal: -1 * totalCharges,
          referenceId: refId,
          referenceCode: order?.code,
          referenceType: 'redeem',
        })
      );
      return;
    }

    // Earn — hanya item root; addon tidak dapat point (server: additional_id IS NULL).
    const earned = computeEarnedPoint(order?.items);
    if (earned > 0) {
      clone.point = (clone.point || 0) + earned;
      clone.point_logs = clone.point_logs || [];
      clone.point_logs.unshift(
        logEntry(customer, {
          nominal: earned,
          referenceId: refId,
          referenceCode: order?.code,
          referenceType: 'earn',
        })
      );
    }

    clone.saldo = (clone.saldo || 0) - totalCharges;
    clone.saldo_logs = clone.saldo_logs || [];
    clone.saldo_logs.unshift(
      logEntry(customer, {
        nominal: -1 * totalCharges,
        referenceId: refId,
        referenceCode: order?.code,
        referenceType: 'Sales',
      })
    );
  });
}

/**
 * Kebalikan dari mirrorMembershipOrder — dipakai saat order di-remove dari queue (F1).
 * Kembalikan angka saldo/point DAN buang entri ledger lokal milik order ini
 * (match `reference_id`). Tidak membuat entri log baru.
 */
export function revertMembershipOrder(order) {
  const customer = order?.membership;
  if (!customer || !isMemberPayment(order)) return null;

  return updateCache(customer, clone => {
    const totalCharges = Number(order?.total_charges || 0);
    const refId = referenceId(order);

    // Tanpa reference_id yang jelas, jangan sentuh ledger sama sekali.
    const dropLogs = logs => {
      if (refId == null) return logs || [];
      return (logs || []).filter(log => log?.reference_id !== refId);
    };

    if (order?.is_point) {
      clone.point = (clone.point || 0) + totalCharges;
      clone.point_logs = dropLogs(clone.point_logs);
      return;
    }

    const earned = computeEarnedPoint(order?.items);
    if (earned > 0) {
      clone.point = (clone.point || 0) - earned;
    }

    clone.point_logs = dropLogs(clone.point_logs);
    clone.saldo = (clone.saldo || 0) + totalCharges;
    clone.saldo_logs = dropLogs(clone.saldo_logs);
  });
}
