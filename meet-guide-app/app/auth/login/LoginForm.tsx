"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/auth";
import EmailInput from "./EmailInput";
import PasswordInput from "./PasswordInput";
import RememberMeCheckbox from "./RememberMeCheckbox";
import ForgotPasswordLink from "./ForgotPasswordLink";
import LoginButton from "./LoginButton";
import SignUpPrompt from "./SignUpPrompt";

const LoginForm: React.FC = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await auth.signIn(email, password);
      
      if (result.success && result.isSignedIn) {
        // Login successful - redirect to dashboard
        router.push("/dashboard");
      } else {
        setError(result.error || "Login failed. Please try again.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during login");
    } finally {
      setLoading(false);
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
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
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

          <LoginButton loading={loading} />
        </form>

        <SignUpPrompt />
      </div>
    </section>
  );
};

export default LoginForm;
