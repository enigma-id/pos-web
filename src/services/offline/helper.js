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
