import React from "react";

type StatsCardProps = {
  title: string;
  value: string;
  valueColor: string;
};

const StatsCard: React.FC<StatsCardProps> = ({ title, value, valueColor }) => {
  return (
    <div className="flex w-70 flex-col rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="text-sm font-medium text-slate-600">{title}</span>
      <span className="mt-2 text-2xl font-semibold" style={{ color: valueColor }}>
        {value}
      </span>
    </div>
  );
};

export default StatsCard;
