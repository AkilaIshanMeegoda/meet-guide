"use client";

import React, { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    console.log("Request password reset for:", email);
  }

  return (
    <section className="flex relative flex-col justify-center items-center px-0 py-10 min-h-[640px] w-full">
      <div className="w-full max-w-[960px] px-4">
        <h1 className="text-3xl font-bold leading-9 text-center text-neutral-900 mb-4">
          Forgot your password?
        </h1>
        <p className="text-sm text-center text-slate-500 max-w-2xl mx-auto mb-6">
          Enter the email address associated with your account and we'll send you a
          link to reset your password.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mx-auto w-full max-w-md flex flex-col items-center"
        >
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 mb-4 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
          />

          <button
            type="submit"
            className="mt-2 w-40 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Reset Password
          </button>

          {submitted && (
            <p className="mt-4 text-sm text-green-600">If an account exists, a reset link has been sent.</p>
          )}
        </form>
      </div>
    </section>
  );
}
