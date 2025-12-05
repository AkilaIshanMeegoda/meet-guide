"use client";
import React, { useState } from "react";

const RememberMeCheckbox: React.FC = () => {
  const [isChecked, setIsChecked] = useState<boolean>(false);

  return (
    <div className="flex gap-2 items-center">
      <label className="flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setIsChecked(e.target.checked)
          }
          className="sr-only"
        />
        <div
          className={`w-5 h-5 rounded border border-gray-300 border-solid flex items-center justify-center ${
            isChecked ? "bg-indigo-800 border-indigo-800" : "bg-gray-50"
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
        <span className="flex flex-col justify-center text-sm font-medium leading-5 h-[21px] text-blue-950 w-[97px] ml-2">
          <span className="text-sm font-medium text-blue-950">
            Remember me
          </span>
        </span>
      </label>
    </div>
  );
};

export default RememberMeCheckbox;
