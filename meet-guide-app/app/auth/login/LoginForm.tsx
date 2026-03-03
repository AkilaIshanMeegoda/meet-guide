"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import EmailInput from "./EmailInput";
import PasswordInput from "./PasswordInput";
import RememberMeCheckbox from "./RememberMeCheckbox";
import ForgotPasswordLink from "./ForgotPasswordLink";
import LoginButton from "./LoginButton";
import SignUpPrompt from "./SignUpPrompt";
import { useAuth } from "@/contexts/AuthContext";

const LoginForm: React.FC = () => {
  const router = useRouter();
  const { login, user, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      const destination = user.is_management ? "/management/dashboard" : "/dashboard";
      router.push(destination);
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await login(email, password);
      // Refresh user context to get updated user data
      // The redirect will be handled by the useEffect above
    } catch (err: any) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="flex flex-1 justify-center items-center w-full h-screen bg-gray-50 px-8">
      <div className="w-full max-w-[400px] flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col">
          <h1 className="text-4xl font-black text-[#142241]">
            Welcome Back
          </h1>
          <p className="text-base text-gray-500">
            Log in to your MeetGuide account
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <EmailInput value={email} onChange={setEmail} />
          <PasswordInput value={password} onChange={setPassword} />

          <div className="flex justify-between items-center">
            <RememberMeCheckbox />
            <ForgotPasswordLink />
          </div>

          <LoginButton isLoading={isLoading} />
        </form>

        <SignUpPrompt />
      </div>
    </section>
  );
};

export default LoginForm;
