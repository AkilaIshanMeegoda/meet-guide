"use client";
import React from "react";
import EmailInput from "./EmailInput";
import PasswordInput from "./PasswordInput";
import RememberMeCheckbox from "./RememberMeCheckbox";
import ForgotPasswordLink from "./ForgotPasswordLink";
import LoginButton from "./LoginButton";
import SignUpPrompt from "./SignUpPrompt";

const LoginForm: React.FC = () => {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Handle form submission
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <EmailInput />
          <PasswordInput />

          <div className="flex justify-between items-center">
            <RememberMeCheckbox />
            <ForgotPasswordLink />
          </div>

          <LoginButton />
        </form>

        <SignUpPrompt />
      </div>
    </section>
  );
};

export default LoginForm;
