"use client";
import React from "react";

const SignUpPrompt: React.FC = () => {
  const handleSignUp = () => {
    // Handle sign up navigation
    console.log("Sign up clicked");
  };

  return (
    <div className="flex absolute left-2/4 gap-1 justify-center items-center -translate-x-2/4 top-[482px]">
      <p className="flex flex-col justify-center w-40 h-5 text-sm leading-5 text-center text-gray-500">
        <span className="text-sm text-gray-500">Don't have an account?</span>
      </p>
      <button
        type="button"
        onClick={handleSignUp}
        className="flex justify-center items-center cursor-pointer h-[17px] w-[53px] focus:outline-none focus:ring-2 focus:ring-indigo-800 focus:ring-offset-2 rounded"
      >
        <span className="flex flex-col shrink-0 justify-center text-sm font-bold leading-5 text-center text-indigo-800 h-[17px] w-[53px]">
          <span className="text-sm font-bold text-indigo-800">Sign Up</span>
        </span>
      </button>
    </div>
  );
};

export default SignUpPrompt;
