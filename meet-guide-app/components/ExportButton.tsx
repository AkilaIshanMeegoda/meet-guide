"use client";

import React from "react";
import { Download } from "lucide-react";

type ExportButtonProps = {
  onClick?: () => void;
};

const ExportButton: React.FC<ExportButtonProps> = ({ onClick }) => {
  const handleClick = () => {
    console.log("Export clicked");
    onClick?.();
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
    >
      <Download size={16} />
      <span>Export</span>
    </button>
  );
};

export default ExportButton;
