"use client";
import React from "react";

const LoginButton: React.FC = () => {
  return (
    <button
      type="submit"
      className="flex absolute left-0 justify-center items-center px-0 py-4 h-14 bg-indigo-800 rounded-lg shadow-sm cursor-pointer top-[269px] w-[669px] max-sm:w-full hover:bg-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-800 focus:ring-offset-2 transition-colors"
    >
      <div className="flex shrink-0 justify-center items-center px-0 py-0.5 h-6 w-[49px] max-md:static max-md:mx-auto max-md:my-0 max-md:w-full max-md:text-center max-md:max-w-[500px] max-sm:w-full max-sm:max-w-[400px]">
        <span className="flex flex-col shrink-0 justify-center h-5 text-base font-bold tracking-wide leading-6 text-center text-white w-[49px]">
          <span className="text-base font-bold text-white">Log In</span>
        </span>
      </div>
    </button>
  );
};

export default LoginButton;
