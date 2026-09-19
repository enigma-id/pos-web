export function recalculateDiscountCategory(discountCategories, items) {
  if (!Array.isArray(discountCategories)) return [];

  let result = [];
  discountCategories.map(dc => {
    let totalDiscount = 0;
    let used = false;
    items.map(item => {
      if (item.category_id === dc.category_id) {
        totalDiscount += item.unit_discount * item.quantity;
        used = true;
      }
    });

    if (used) {
      // Salin objek dc agar aman untuk dimodifikasi (tidak read-only)
      const updatedDc = { ...dc };

      if (updatedDc.discount_percentage > 0) {
        updatedDc.is_discount_percentage = true;
      }
      updatedDc.total_discount = totalDiscount;

      result.push(updatedDc);
    }
  });

  return result;
}

export const checkPartialPaid = (reqItems, oldItems) => {
  let itemsPending = [];
  let isPending = false;

  // Clone oldItems agar tidak merusak read-only reference dari Redux/Props
  const clonedOldItems = JSON.parse(JSON.stringify(oldItems));

  for (const oldItem of clonedOldItems) {
    // ini untuk masukan category_id bro
    oldItem.category_id = oldItem.catalog?.category_id;
    oldItem.unit_discount = oldItem.discount_value;

    let notPay = false;
    let change = false;

    for (const ir of reqItems) {
      if (ir.id === oldItem.id) {
        notPay = true;

        // Cari partial bayar
        if (ir.quantity !== oldItem.quantity) {
          oldItem.quantity -= ir.quantity;
          change = true;
        }
      }
    }

    if (change) {
      if (oldItem.addons && oldItem.addons.length > 0) {
        let pendingAddons = [];
        for (const oldAddon of oldItem.addons) {
          let cpAdd = { ...oldAddon };

          // Fallback / 1 untuk mencegah NaN jika quantity 0
          let qty =
            oldAddon.quantity && oldAddon.quantity !== 0
              ? oldAddon.quantity / oldAddon.quantity
              : 1;

          cpAdd.quantity = qty * oldItem.quantity;

          pendingAddons.push(cpAdd);
        }

        oldItem.addons = pendingAddons;
      }

      itemsPending.push(oldItem);
    }

    if (!notPay) {
      itemsPending.push(oldItem);
    }
  }

  if (itemsPending.length > 0) {
    isPending = true;
  }

  return { itemsPending, isPending };
};

/**
 * Mirror MembershipUsecase.Earned (server): per item root, floor(unit_bill * qty * rate/100),
 * lalu dijumlahkan. Addon TIDAK dapat point (server: additional_id IS NULL).
 *
 * Rate diambil dari item.point_percentage (snapshot dari /catalog). Item lama yang belum punya
 * field-nya dianggap rate 0 → tidak dapat point lokal (server tetap menghitungnya saat sync).
 *
 * @param {Array} items  item order offline: { point_percentage, unit_nett, unit_discount, quantity }
 * @returns {number} total point earned (integer, floor per item)
 */
export function computeEarnedPoint(items) {
  let total = 0;

  for (const item of items || []) {
    const rate = Number(item?.point_percentage ?? 0);
    if (rate <= 0) continue;

    const unitBill = Math.max(0, Number(item?.unit_nett || 0) - Number(item?.unit_discount || 0));
    const qty = Number(item?.quantity || 0);

    // floor per item — sama seperti SQL server (floor(unit_bill * quantity * point_percentage / 100))
    total += Math.floor((unitBill * qty * rate) / 100);
  }

  return total;
}
