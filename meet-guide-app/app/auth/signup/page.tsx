"use client";
import * as React from "react";
import { RegistrationForm } from "./components/RegistrationForm";

export default function SignupPage() {
  // Local Header (only used here)
  const Header = () => (
    <header className="flex justify-between items-center px-10 py-3 w-full border-b border-gray-200 max-md:px-5 max-sm:px-4">
      <h1 className="text-lg font-bold text-neutral-900">MeetGuide</h1>
    </header>
  );

  return (
    <div className="flex flex-col w-full min-h-screen bg-white">
      <Header />
      <RegistrationForm />
    </div>
  );
}
