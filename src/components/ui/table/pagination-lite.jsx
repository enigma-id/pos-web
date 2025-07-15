import React from 'react';
import { useSelector } from 'react-redux';

const TablePaginationLite = ({ name, onChangePage }) => {
  const StateLimit = useSelector(state => state?.Table?.data[name]?.limit);
  const StateTotal = useSelector(state => state?.Table?.data[name]?.total);
  const StateCurrentPage = useSelector(state => state?.Table?.data[name]?.page);

  const numberOfPages = Math.ceil(StateTotal / StateLimit);

  const changedPage = i => {
    if (i < 1 || i > numberOfPages || i === StateCurrentPage) return;
    onChangePage(i);
  };

  return (
    <div className="border-base-200 bg-base-100 mt-4 flex min-h-[62px] w-full shrink-0 items-center justify-end gap-4 border-t p-4">
      <div className="flex items-center gap-2">
        <button
          className={`btn ${StateCurrentPage === 1 ? 'btn-disabled' : ''}`}
          onClick={() => changedPage(StateCurrentPage - 1)}
        >
          ‹ Previous
        </button>
        <button
          className={`btn ${StateCurrentPage === numberOfPages ? 'btn-disabled' : ''}`}
          onClick={() => changedPage(StateCurrentPage + 1)}
        >
          Next ›
        </button>
      </div>
    </div>
  );
};

export default TablePaginationLite;
