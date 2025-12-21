"use client";
import React from "react";
import Link from "next/link";

const ForgotPasswordLink: React.FC = () => {
  return (
    <Link
      href="/auth/forgot-password"
      className="text-sm font-medium text-[#4c46b6] hover:underline focus:outline-none focus:ring-2 focus:ring-[#4c46b6] focus:ring-offset-2 rounded"
    >
      Forgot password?
    </Link>
  );
};

export default ForgotPasswordLink;
