"use client";
import React from "react";
import Link from "next/link";

const SignUpPrompt: React.FC = () => {
  return (
    <div className="flex justify-center items-center gap-1 text-sm">
      <span className="text-gray-500">Don't have an account?</span>
      <Link
        href="/auth/signup"
        className="font-bold text-[#4c46b6] hover:underline focus:outline-none focus:ring-2 focus:ring-[#4c46b6] focus:ring-offset-2 rounded"
      >
        Sign Up
      </Link>
    </div>
  );
};

export default SignUpPrompt;
