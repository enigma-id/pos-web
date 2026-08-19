/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import { useSelector } from 'react-redux';

const TableTool = ({ name, onSearch, children, downloadable, onDownload }) => {
  const StateSearch = useSelector(state => state?.Table?.data[name]?.textSearch);

  const [searchTerm, setSearchTerm] = React.useState('');

  React.useEffect(() => {
    if (StateSearch === '') return;
    setSearchTerm(StateSearch);
  }, [StateSearch]);

  React.useEffect(() => {
    if (StateSearch === searchTerm) return;

    const delayDebounceFn = setTimeout(() => {
      onSearch(searchTerm);
    }, 1000);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const Download = () => {
    if (!downloadable) return null;

    return (
      <button
        onClick={onDownload}
        className="ml-2 flex h-10 items-center justify-center rounded-md bg-gray-700 px-3 text-white hover:bg-gray-800"
        title="Download"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16l5 5 5-5M12 3v12"
          />
        </svg>
      </button>
    );
  };

  return (
    <div className="border-base-200 bg-base-100 flex h-[62px] border-t border-b">
      <div className="border-base-200 flex-1 border-r">
        <div className="relative flex h-full w-full items-center">
          <div className="absolute left-4">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M17.3556 17.3658C18.8279 15.8961 19.7388 13.8641 19.7388 11.6194C19.7388 7.13518 16.1036 3.5 11.6194 3.5C7.13518 3.5 3.5 7.13518 3.5 11.6194C3.5 16.1036 7.13518 19.7388 11.6194 19.7388C13.8589 19.7388 15.8866 18.8321 17.3556 17.3658ZM17.3556 17.3658L20.5 20.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <input
            name="search"
            placeholder="Search ..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="h-full w-full pl-15 focus-visible:!outline-none"
          />
        </div>
      </div>
      {children && <div className="relative flex-1 overflow-visible">{children}</div>}
    </div>
  );
};

TableTool.defaultProps = {
  downloadable: false,
};

export default TableTool;
