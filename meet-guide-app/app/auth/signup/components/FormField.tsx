"use client";
import * as React from "react";

interface FormFieldProps {
  label: string;
  placeholder: string;
  type?: string;
}

export function FormField({ label, placeholder, type = "text" }: FormFieldProps) {
  return (
    <div className="flex flex-col w-full mb-4">
      <label className="mb-2 text-base font-medium text-neutral-900">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
      />
    </div>
  );
}
