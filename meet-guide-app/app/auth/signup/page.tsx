"use client";

import RegistrationForm from "./components/RegistrationForm";

export default function SignupPage() {
  return (
    <main className="min-h-screen flex justify-center items-center bg-gray-50 px-4">
      <div className="max-w-md w-full flex flex-col items-center gap-6">
        {/* Logo comes from RegistrationForm.Logo */}
        <RegistrationForm.Logo />

        {/* Form */}
        <div className="w-full bg-white shadow-lg rounded-xl p-8">
          <RegistrationForm />
        </div>
      </div>
    </main>
  );
}
