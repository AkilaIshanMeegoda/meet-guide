"use client";
import React from "react";

const LoginButton: React.FC = () => {
  return (
    <button
      type="submit"
      className="w-full h-12 bg-[#4c46b6] text-white text-base font-bold rounded-lg hover:bg-[#3d3890] focus:outline-none focus:ring-2 focus:ring-[#4c46b6] focus:ring-offset-2 transition-colors"
    >
      Log In
    </button>
  );
};

export default LoginButton;
