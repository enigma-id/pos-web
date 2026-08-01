export function recalculateDiscountCategory(discountCategories, items) {
  if (!Array.isArray(discountCategories)) return [];

  let result = [];
  discountCategories.map(dc => {
    let totalDiscount = 0;
    items.map(item => {
      if (item.category_id === dc.category_id) {
        let dv = dc.discount_value;
        let dp = dc.discount_percentage;

        if (dv > 0) {
          dp = Math.ceil(dv / item.unit_nett) * 100;
        }

        if (dp > 0) {
          dv = item.unit_nett * (dp / 100);
        }

        totalDiscount += dv * item.quantity;
      }
    });

    if (dc.discount_percentage > 0) {
      dc.is_discount_percentage = true;
    }
    dc.total_discount = totalDiscount;
    result.push(dc);
  });

  return result;
}

export const checkPartialPaid = (reqItems, oldItems) => {
  let itemsPending = [];
  let isPending = false;

  // Cari item yang pending
  for (const oldItem of oldItems) {
    let notPay = false;
    let change = false;

    for (const ir of reqItems) {
      if (ir.id === oldItem.id) {
        notPay = true;

        // Cari partial bayar
        if (ir.quantity !== oldItem.quantity) {
          // Buat salinan atau modifikasi (tergantung apakah oldItem mutable)
          oldItem.quantity -= ir.quantity;
          change = true;
        }
      }
    }

    if (change) {
      if (oldItem.addons && oldItem.addons.length > 0) {
        let pendingAddons = [];
        for (const oldAddon of oldItem.addons) {
          let cpAdd = { ...oldAddon }; // Shallow copy object di JS

          // Catatan: di golang oldaddon.Quantity / oldaddon.Quantity hasilnya selalu 1 (kecuali 0/0)
          // Jika maksudnya untuk reset atau proporsi, pastikan pembagiannya benar.
          // Di sini kita ikutin logika aslinya:
          let qty = oldAddon.quantity / oldAddon.quantity;

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
