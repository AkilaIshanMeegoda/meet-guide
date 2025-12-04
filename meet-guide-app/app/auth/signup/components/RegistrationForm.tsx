"use client";

import React, { useState } from "react";
import FormFields from "../components/FormField";

/* ----------------------- Logo Component ----------------------- */
const Logo = () => (
  <div className="flex flex-col gap-2 items-center">
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="40" height="40" rx="8" fill="#3B32E2" />
      <path d="M20 10V17.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M20 30V22.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M27.5 15.6L21.8 18.7" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M12.5 24.3L18.1 21.2" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M27.5 24.3L21.8 21.2" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M12.5 15.6L18.1 18.7" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
    <h1 className="text-2xl font-bold text-slate-900">MeetGuide</h1>
  </div>
);

/* ----------------------- Button Component ----------------------- */
const Button = ({ children }: { children: React.ReactNode }) => (
  <button
    type="submit"
    className="flex justify-center items-center w-full h-14 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-base font-medium transition"
  >
    {children}
  </button>
);

/* ----------------------- Legal Links ----------------------- */
const LegalLinks = () => (
  <p className="text-sm text-center text-slate-500">
    By signing up, you agree to our{" "}
    <a href="/terms" className="font-medium text-indigo-700 hover:text-indigo-800">
      Terms of Service
    </a>{" "}
    and{" "}
    <a href="/privacy" className="font-medium text-indigo-700 hover:text-indigo-800">
      Privacy Policy
    </a>
    .
  </p>
);

/* ----------------------- Login Link ----------------------- */
const LoginLink = () => (
  <p className="text-sm text-center text-slate-500">
    Already have an account?{" "}
    <a href="/login" className="font-medium text-indigo-700 hover:text-indigo-800">
      Log in
    </a>
  </p>
);

/* ----------------------- Main Form Component ----------------------- */
const RegistrationForm = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form Submitted:", formData);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
        <FormFields data={formData} onChange={handleChange} />
        <div className="pt-4 w-full">
          <Button>Sign Up</Button>
        </div>
      </form>

      <div className="pt-4 w-full text-center">
        <LegalLinks />
      </div>

      <div className="pt-2 w-full text-center">
        <LoginLink />
      </div>
    </>
  );
};

RegistrationForm.Logo = Logo;

export default RegistrationForm;
