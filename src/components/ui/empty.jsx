const EmptySection = () => {
  return (
    <div className="h-full w-full py-20 text-center">
      <h3 className="text-lg font-semibold">No Transactions Yet</h3>
      <p className="text-sm text-gray-500">
        There are no recorded transactions for this sales session.
      </p>
    </div>
  );
};

export default EmptySection;
