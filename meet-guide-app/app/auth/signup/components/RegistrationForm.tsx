"use client";
import * as React from "react";
import { FormField } from "./FormField";

export function RegistrationForm() {
  return (
    <div className="flex flex-col items-center w-full max-w-md p-5 mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center">Sign up for an account</h2>

      <form className="w-full flex flex-col">
        <FormField label="Email" placeholder="Enter your email" type="email" />
        <FormField label="Password" placeholder="Enter your password" type="password" />
        <FormField label="Confirm Password" placeholder="Confirm your password" type="password" />

        <button
          type="submit"
          className="mt-4 w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
        >
          Sign Up
        </button>

        <p className="mt-4 text-center text-sm text-gray-500 hover:text-gray-700 cursor-pointer">
          Already have an account? Log in
        </p>
      </form>
    </div>
  );
}
