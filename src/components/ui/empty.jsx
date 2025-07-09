const EmptySection = () => {
  return (
    <div className="h-full w-full py-20 text-center">
      <h3 className="text-lg font-semibold">Belum ada transaksi</h3>
      <p className="text-sm text-gray-500">
        Belum ada transaksi yang tercatat untuk sesi penjualan ini.
      </p>
    </div>
  );
};

export default EmptySection;
