import { useSelector } from 'react-redux';

const TableWrapper = ({ children }) => {
  const StateLoading = useSelector(state => state?.Activity?.services['Table.Request']);

  return <div>{children}</div>;
};

export default TableWrapper;
