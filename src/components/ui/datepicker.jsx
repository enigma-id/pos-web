/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import moment from 'moment';

const DatePicker = ({
  mode = 'single',
  value,
  onChange,
  placeholder = 'Select date',
  format = 'YYYY-MM-DD',
  clearable = true,
}) => {
  const isRange = mode === 'range';

  const [internalValue, setInternalValue] = React.useState(value || null);
  const [viewMonths, setViewMonths] = React.useState(() => [
    moment().startOf('month'),
    moment().add(1, 'month').startOf('month'),
  ]);
  const [show, setShow] = React.useState(false);
  const [hoverDate, setHoverDate] = React.useState(null);
  const ref = React.useRef(null);

  React.useEffect(() => {
    setInternalValue(value || null);
  }, [value]);

  React.useEffect(() => {
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) setShow(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  React.useEffect(() => {
    if (!show) setHoverDate(null);
  }, [show]);

  const daysInMonthGrid = month => {
    const start = month.clone().startOf('month').startOf('week');
    const end = month.clone().endOf('month').endOf('week');
    const days = [];
    let day = start;
    while (day.isBefore(end) || day.isSame(end, 'day')) {
      days.push(day);
      day = day.clone().add(1, 'day');
    }
    return days;
  };

  const handleSelectDate = date => {
    if (isRange) {
      const [start, end] = internalValue || [null, null];
      if (!start || (start && end)) {
        setInternalValue([date, null]);
        onChange?.([date, null]);
      } else if (start && !end) {
        const newRange = date.isBefore(start) ? [date, start] : [start, date];
        setInternalValue(newRange);
        onChange?.(newRange);
        setShow(false);
      }
    } else {
      setInternalValue(date);
      onChange?.(date);
      setShow(false);
    }
  };

  const handleSelectToday = () => {
    const today = moment();
    if (isRange) {
      setInternalValue([today, null]);
      onChange?.([today, null]);
    } else {
      setInternalValue(today);
      onChange?.(today);
      setShow(false);
    }
  };

  const months = Array.from({ length: 12 }, (_, i) => ({
    label: moment().month(i).format('MMMM'),
    value: String(i + 1),
  }));

  const currentYear = moment().year();
  const currentMonth = moment().month() + 1;

  const years = [];
  for (let y = currentYear - 50; y <= currentYear + 20; y++) {
    years.push({ label: y.toString(), value: y.toString() });
  }

  const leftMonth = viewMonths[0].month() + 1;
  const leftYear = viewMonths[0].year();
  const rightYear = viewMonths[1].year();

  const monthsRight = months.filter(m => {
    if (rightYear === leftYear) return Number(m.value) >= leftMonth;
    return true;
  });
  const monthsLeft = months.filter(() => true);
  const yearsRight = years.filter(y => Number(y.value) >= leftYear);

  const onChangeMonthLeft = e => {
    const monthNumber = Number(e.target.value);
    setViewMonths(prev => {
      let newRightMonth = prev[1].month() + 1;
      if (prev[0].year() === prev[1].year() && monthNumber > newRightMonth) {
        newRightMonth = monthNumber;
      }
      return [
        prev[0].clone().month(monthNumber - 1),
        prev[1].clone().month(newRightMonth - 1),
      ];
    });
  };

  const onChangeYearLeft = e => {
    const yearNumber = Number(e.target.value);
    setViewMonths(prev => {
      let newRightYear = prev[1].year();
      let newRightMonth = prev[1].month() + 1;
      if (yearNumber > prev[1].year()) {
        newRightYear = yearNumber;
        newRightMonth = 1;
      }
      if (yearNumber === newRightYear && newRightMonth < prev[0].month() + 1) {
        newRightMonth = prev[0].month() + 1;
      }
      return [
        prev[0].clone().year(yearNumber),
        prev[1].clone().year(newRightYear).month(newRightMonth - 1),
      ];
    });
  };

  const onChangeMonthRight = e => {
    const monthNumber = Number(e.target.value);
    setViewMonths(prev => {
      const leftYear = prev[0].year();
      const leftMonth = prev[0].month() + 1;
      const rightYear = prev[1].year();
      let newMonth = monthNumber;
      if (rightYear === leftYear && newMonth < leftMonth) newMonth = leftMonth;
      return [prev[0], prev[1].clone().month(newMonth - 1)];
    });
  };

  const onChangeYearRight = e => {
    const yearNumber = Number(e.target.value);
    setViewMonths(prev => {
      const leftYear = prev[0].year();
      const newYear = yearNumber < leftYear ? leftYear : yearNumber;
      let newMonth = prev[1].month() + 1;
      if (newYear === leftYear && newMonth < prev[0].month() + 1) {
        newMonth = prev[0].month() + 1;
      }
      return [prev[0], prev[1].clone().year(newYear).month(newMonth - 1)];
    });
  };

  const monthsToRender = isRange ? viewMonths : [viewMonths[0]];

  const displayValue = () => {
    if (!internalValue) return '';
    if (isRange) {
      const [start, end] = internalValue || [null, null];
      return `${start ? start.format(format) : ''}${end ? ` - ${end.format(format)}` : ''}`;
    }
    return internalValue.format(format);
  };

  return (
    <div ref={ref} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          readOnly
          className="input input-sm input-bordered h-8 w-full cursor-pointer pr-8 !min-h-0"
          value={displayValue()}
          placeholder={placeholder}
          onFocus={() => setShow(true)}
          onClick={() => setShow(true)}
        />
        <button
          type="button"
          tabIndex={-1}
          className="absolute top-1/2 right-1 -translate-y-1/2 cursor-pointer p-1 text-gray-400 hover:text-gray-700"
          onClick={e => {
            e.stopPropagation();
            handleSelectToday();
          }}
          title="Hari ini"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </button>
      </div>

      {show && (
        <div className="absolute z-50 top-full mt-2 w-max rounded-xl border border-base-200 bg-white p-4 shadow-lg">
          <div className="flex gap-6">
            {monthsToRender.map((month, idx) => {
              const days = daysInMonthGrid(month);
              let start = null;
              let end = null;
              if (isRange && internalValue) {
                [start, end] = internalValue;
              }
              const isLeft = idx === 0;
              const monthOptions = isLeft ? monthsLeft : monthsRight;
              const yearOptions = isLeft ? years : yearsRight;
              const onChangeMonthHandler = isLeft ? onChangeMonthLeft : onChangeMonthRight;
              const onChangeYearHandler = isLeft ? onChangeYearLeft : onChangeYearRight;

              return (
                <div key={idx} className="min-w-60">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <select
                      className="select select-sm select-bordered"
                      value={String(month.month() + 1)}
                      onChange={onChangeMonthHandler}
                    >
                      {monthOptions.map(o => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <select
                      className="select select-sm select-bordered"
                      value={String(month.year())}
                      onChange={onChangeYearHandler}
                    >
                      {yearOptions.map(o => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-1 grid grid-cols-7 text-center text-xs font-semibold">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                      <div key={d} className="py-1">
                        {d}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center">
                    {days.map((day, i) => {
                      const isCurrentMonth = day.isSame(month, 'month');
                      let isSelected = false;
                      let isInRangeHover = false;

                      if (!isRange) {
                        isSelected = internalValue ? day.isSame(internalValue, 'day') : false;
                      } else {
                        if (start && end) {
                          isSelected =
                            day.isSame(start, 'day') ||
                            day.isSame(end, 'day') ||
                            (day.isAfter(start, 'day') && day.isBefore(end, 'day'));
                        } else if (start && !end) {
                          isSelected = day.isSame(start, 'day');
                          if (hoverDate) {
                            const rangeStart = start.isBefore(hoverDate) ? start : hoverDate;
                            const rangeEnd = start.isAfter(hoverDate) ? start : hoverDate;
                            isInRangeHover =
                              day.isAfter(rangeStart, 'day') && day.isBefore(rangeEnd, 'day');
                          }
                        }
                      }

                      return (
                        <button
                          type="button"
                          key={i}
                          className={`btn btn-sm btn-ghost p-0 ${
                            isSelected || isInRangeHover
                              ? '!btn-primary bg-primary text-white'
                              : 'hover:bg-primary/10'
                          } ${isCurrentMonth ? '' : 'opacity-40'}`}
                          style={{ width: '2rem', height: '2rem', minHeight: '2rem' }}
                          onClick={() => handleSelectDate(day)}
                          onMouseEnter={() => setHoverDate(day)}
                          onMouseLeave={() => setHoverDate(null)}
                        >
                          {day.date()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {clearable && (
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn btn-sm btn-error text-white"
                onClick={() => {
                  setInternalValue(null);
                  onChange?.(null);
                  setShow(false);
                }}
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DatePicker;
