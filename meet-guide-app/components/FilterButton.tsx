"use client";

import React from "react";
import { Filter } from "lucide-react";

type FilterButtonProps = {
  onClick?: () => void;
};

const FilterButton: React.FC<FilterButtonProps> = ({ onClick }) => {
  const handleClick = () => {
    console.log("Filter clicked");
    onClick?.();
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
    >
      <Filter size={16} />
      <span>Filter</span>
    </button>
  );
};

export default FilterButton;
