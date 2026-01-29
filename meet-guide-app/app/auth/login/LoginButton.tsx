"use client";
import React from "react";

interface LoginButtonProps {
  loading?: boolean;
}

const LoginButton: React.FC<LoginButtonProps> = ({ loading = false }) => {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full h-12 bg-[#4c46b6] text-white text-base font-bold rounded-lg hover:bg-[#3d3890] focus:outline-none focus:ring-2 focus:ring-[#4c46b6] focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? "Logging in..." : "Log In"}
    </button>
  );
};

export default LoginButton;
