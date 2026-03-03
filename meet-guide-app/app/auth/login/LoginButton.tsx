"use client";
import React from "react";

interface LoginButtonProps {
  isLoading?: boolean;
}

const LoginButton: React.FC<LoginButtonProps> = ({ isLoading = false }) => {
  return (
    <button
      type="submit"
      disabled={isLoading}
      className="w-full h-12 bg-[#4c46b6] text-white text-base font-bold rounded-lg hover:bg-[#3d3890] focus:outline-none focus:ring-2 focus:ring-[#4c46b6] focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Logging in...
        </span>
      ) : (
        "Log In"
      )}
    </button>
  );
};

export default LoginButton;
