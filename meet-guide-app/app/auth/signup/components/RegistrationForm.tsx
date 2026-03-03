"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
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
    <a href="/auth/login" className="font-medium text-indigo-700 hover:text-indigo-800">
      Log in
    </a>
  </p>
);

/* ----------------------- Main Form Component ----------------------- */
const RegistrationForm = () => {
  const router = useRouter();
  const { signup, user, isLoading: authLoading } = useAuth();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      const destination = user.is_management ? "/management/dashboard" : "/dashboard";
      router.push(destination);
    }
  }, [user, authLoading, router]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      await signup({
        email: formData.email,
        username: formData.email.split("@")[0],
        password: formData.password,
        confirm_password: formData.confirmPassword,
        full_name: formData.fullName
      });
      // The redirect will be handled by the useEffect above
    } catch (err: any) {
      setError(err.message || "Signup failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
        <FormFields data={formData} onChange={handleChange} />
        <div className="pt-4 w-full">
          <button
            type="submit"
            disabled={isLoading}
            className="flex justify-center items-center w-full h-14 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-base font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Signing up..." : "Sign Up"}
          </button>
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
