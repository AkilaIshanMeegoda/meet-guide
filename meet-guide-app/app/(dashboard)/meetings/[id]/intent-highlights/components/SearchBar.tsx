"use client";

import React, { useState, KeyboardEvent } from "react";
import { Search } from "lucide-react";

type SearchBarProps = {
  onSearch?: (query: string) => void;
  className?: string;
};

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, className = "" }) => {
  const [value, setValue] = useState("");

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const trimmed = value.trim();
      if (!trimmed) return;
      console.log("Searching for:", trimmed);
      onSearch?.(trimmed);
    }
  };

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm ${className}`}
    >
      <Search size={16} className="text-slate-400" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search by topics, decisions, questions..."
        className="flex-1 border-none bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
      />
    </div>
  );
};

export default SearchBar;
