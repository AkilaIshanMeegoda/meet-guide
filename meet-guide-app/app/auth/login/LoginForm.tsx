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
    <section className="flex flex-1 justify-center items-center px-96 py-72 w-full h-screen bg-gray-50 max-md:px-5 max-md:py-10 max-md:w-full max-sm:px-4 max-sm:py-5">
      <div className="relative shrink-0 h-[502px] w-[669px] max-md:static max-md:mx-auto max-md:my-0 max-md:w-full max-md:text-center max-md:max-w-[500px] max-sm:w-full max-sm:max-w-[400px]">
        <header className="flex absolute top-0 left-0 flex-col justify-center text-4xl font-black tracking-tighter leading-10 h-[45px] text-blue-950 w-[253px]">
          <h1 className="text-4xl font-black text-blue-950 max-sm:text-3xl max-sm:leading-9">
            Welcome Back
          </h1>
        </header>

        <p className="flex absolute left-0 flex-col justify-center h-6 text-base leading-6 text-gray-500 top-[53px] w-[257px]">
          <span className="text-base text-gray-500">
            Log in to your MeetGuide account
          </span>
        </p>

        <form
          onSubmit={handleSubmit}
          className="absolute left-0 h-[325px] top-[109px] w-[669px] max-sm:w-full"
        >
          <EmailInput />
          <PasswordInput />

          <div className="flex absolute top-56 justify-between items-center w-[669px] max-sm:w-full">
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
