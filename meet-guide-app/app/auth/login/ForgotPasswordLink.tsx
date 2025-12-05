"use client";
import React from "react";

const ForgotPasswordLink: React.FC = () => {
  const handleForgotPassword = () => {
    // Handle forgot password logic
    console.log("Forgot password clicked");
  };

  return (
    <button
      type="button"
      onClick={handleForgotPassword}
      className="flex justify-center items-center px-0 pt-px pb-0.5 h-5 w-[120px] max-sm:w-full"
    >
      <span className="flex flex-col shrink-0 justify-center text-sm font-medium leading-5 text-center text-indigo-800 cursor-pointer h-[17px] w-[120px]">
        <span className="text-sm font-medium text-indigo-800">
          Forgot password?
        </span>
      </span>
    </button>
  );
};

export default ForgotPasswordLink;
