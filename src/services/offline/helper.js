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
          dp = (dv / item.unit_nett) * 100;
        }

        if (dp > 0) {
          dv = item.unit_nett * (dp / 100);
        }

        totalDiscount += dv * item.quantity;
      }
    });

    dc.total_discount = totalDiscount;
    result.push(dc);
  });

  return result;
}
