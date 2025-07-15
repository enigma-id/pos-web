/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useSelector } from 'react-redux';

const TablePagination = ({ name, onChangePage, onChangeLimit, pageLimit = [25, 50, 100, 200] }) => {
  const StateLimit = useSelector(state => state?.Table?.data[name]?.limit);
  const StateTotal = useSelector(state => state?.Table?.data[name]?.total);
  const StateCurrentPage = useSelector(state => state?.Table?.data[name]?.page);

  const [pageLinks, setPageLinks] = React.useState(0);
  const [numberOfPages, setNumberOfPages] = React.useState(0);
  const [diff, setDiff] = React.useState(1);
  const [showPrev, setShowPrev] = React.useState(false);
  const [showNext, setShowNext] = React.useState(false);

  const changedPage = i => {
    if (StateCurrentPage === i) return;
    onChangePage(i);
  };

  const changedLimit = i => {
    if (StateLimit === i) return;
    onChangeLimit(i);
  };

  const range = () => {
    let first_num = (StateCurrentPage - 1) * StateLimit + 1;
    let last_num = Math.min(StateTotal, StateCurrentPage * StateLimit);
    return `${first_num} - ${last_num}`;
  };

  React.useEffect(() => {
    const calcPages = () => {
      const totalPages = Math.ceil(StateTotal / StateLimit);
      return totalPages < 1 ? 1 : totalPages;
    };

    const calcLinks = () => {
      let result = StateLimit;
      const limit = 7;
      const nop = calcPages();

      if (StateCurrentPage > nop) changedPage(1);
      setShowPrev(false);
      setShowNext(false);

      if (nop <= limit) return nop;

      if (StateCurrentPage >= limit - 2 && StateCurrentPage <= nop - limit + 2) {
        setDiff(StateCurrentPage - 1);
        setShowPrev(true);
        setShowNext(true);
        result = limit - 4;
      } else {
        if (StateCurrentPage <= limit - 2) {
          setShowNext(true);
          result = limit - 2;
        }

        if (StateCurrentPage > nop - limit + 2) {
          setDiff(nop - limit + 2);
          setShowPrev(true);
          result = limit - 1;
        }
      }

      return result;
    };

    setNumberOfPages(calcPages());
    setPageLinks(calcLinks());
  }, [name, StateLimit, StateTotal, StateCurrentPage]);

  return (
    <div className="border-base-200 bg-base-100 mt-4 flex min-h-[62px] w-full shrink-0 flex-col items-center justify-between gap-4 border-t p-4 md:flex-row">
      <div className="text-sm text-gray-500">
        Showing <span className="font-semibold">{range()}</span> of{' '}
        <span className="font-semibold">{StateTotal}</span> results
      </div>

      <div className="relative flex items-center gap-2">
        <div className="join">
          <button
            className={`join-item btn ${StateCurrentPage === 1 ? 'btn-disabled' : ''}`}
            onClick={() => changedPage(StateCurrentPage - 1)}
          >
            ‹
          </button>

          {showPrev && (
            <>
              <button className="join-item btn text-sm font-thin" onClick={() => changedPage(1)}>
                1
              </button>
              <button className="join-item btn btn-disabled">...</button>
            </>
          )}

          {Array(pageLinks)
            .fill(0)
            .map((_, i) => (
              <button
                key={i}
                className={`join-item btn text-sm ${i + diff === StateCurrentPage ? 'btn-active border-primary rounded bg-[var(--color-primary-shadow)] !font-semibold' : 'font-thin'} hover:border-primary hover:bg-[var(--color-primary-shadow)]`}
                onClick={() => changedPage(i + diff)}
              >
                {i + diff}
              </button>
            ))}

          {showNext && (
            <>
              <button className="join-item btn btn-disabled">...</button>
              <button
                className={`join-item btn text-sm ${StateCurrentPage === numberOfPages ? 'btn-active' : 'font-thin'}`}
                onClick={() => changedPage(numberOfPages)}
              >
                {numberOfPages}
              </button>
            </>
          )}

          <button
            className={`join-item btn ${StateCurrentPage === numberOfPages ? 'btn-disabled' : ''}`}
            onClick={() => changedPage(StateCurrentPage + 1)}
          >
            ›
          </button>
        </div>

        {/* Dropdown for limit */}
        <div className="dropdown dropdown-top dropdown-end">
          <div
            tabIndex={0}
            role="button"
            className="btn btn-outline border-base-200 text-sm font-thin"
          >
            {StateLimit} / page
          </div>
          <ul
            tabIndex={0}
            className="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm"
          >
            {pageLimit?.map(limit => (
              <li key={limit}>
                <a onClick={() => changedLimit(limit)}>{limit} / page</a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TablePagination;
