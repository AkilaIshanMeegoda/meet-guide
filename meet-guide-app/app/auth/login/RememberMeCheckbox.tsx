"use client";
import React, { useState } from "react";

const RememberMeCheckbox: React.FC = () => {
  const [isChecked, setIsChecked] = useState<boolean>(false);

  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={isChecked}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          setIsChecked(e.target.checked)
        }
        className="sr-only"
      />
      <div
        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
          isChecked
            ? "bg-[#4c46b6] border-[#4c46b6]"
            : "bg-white border-gray-300"
        }`}
      >
        {isChecked && (
          <svg
            width="12"
            height="9"
            viewBox="0 0 12 9"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M1 4.5L4.5 8L11 1"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <span className="text-sm font-medium text-[#1e3a5f]">
        Remember me
      </span>
    </label>
  );
};

export default RememberMeCheckbox;

