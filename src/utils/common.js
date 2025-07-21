import moment from 'moment';

export const currencyFormat = (value, usingText = true, nullText = '-') => {
  let txt = usingText ? 'Rp' : '';

  if (isNaN(value)) {
    return nullText;
  }

  return `${txt}${new Intl.NumberFormat('de-DE').format(value)}`;
};

export const dateFormat = (v, format = 'DD/MM/YYYY HH:mm', nullText = '-') => {
  const date = moment(v);

  const year = date.format('YYYY');
  if (year === '0001' || year === '1970') {
    return nullText;
  }

  return date.format(format);
};

export const duration = v => {
  const start = moment(v);
  const year = start.format('YYYY');

  if (!start.isValid() || year === '0001' || year === '1970') {
    return '-';
  }

  return start.fromNow(); // akan return dalam format relatif, seperti "2 hours ago"
};

export const cashList = total => {
  const moneyList = [500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];

  let res = [];

  moneyList.forEach(i => {
    if (i >= total) {
      res.push(i);
    } else {
      let roundup = Math.ceil(total / i) * i;
      if (roundup !== i) {
        res.push(roundup);
      }
    }
  });

  return [total, ...Array.from(new Set(res))];
};

export const isActive = (val_1, val_2) => {
  return val_1 === val_2 ? 'active' : '';
};
