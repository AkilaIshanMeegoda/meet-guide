"use client";

import React from "react";
import { Download } from "lucide-react";

type ExportButtonProps = {
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  className?: string;
};

const ExportButton: React.FC<ExportButtonProps> = ({
  onClick,
  disabled = false,
  loading = false,
  label = "Export",
  className = "",
}) => {
  const handleClick = () => {
    if (disabled || loading) return;
    onClick?.();
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className={`inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors ${
        disabled || loading
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:bg-slate-50"
      } ${className}`}
    >
      <Download size={16} className={loading ? "animate-pulse" : ""} />
      <span>{loading ? "Exporting..." : label}</span>
    </button>
  );
};

export default ExportButton;
