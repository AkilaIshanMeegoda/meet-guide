"use client";

import React from "react";

interface Props {
  data: {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
  };
  onChange: (field: string, value: string) => void;
}

const FormFields: React.FC<Props> = ({ data, onChange }) => {
  return (
    <>
      {/* Full Name */}
      <div className="flex flex-col gap-2">
        <label className="text-sm text-slate-700 font-medium">Full Name</label>
        <input
          type="text"
          value={data.fullName}
          onChange={(e) => onChange("fullName", e.target.value)}
          placeholder="Enter your full name"
          className="w-full h-12 px-4 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
        />
      </div>

      {/* Email */}
      <div className="flex flex-col gap-2">
        <label className="text-sm text-slate-700 font-medium">Email</label>
        <input
          type="email"
          value={data.email}
          onChange={(e) => onChange("email", e.target.value)}
          placeholder="Enter your email"
          className="w-full h-12 px-4 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
        />
      </div>

      {/* Password */}
      <div className="flex flex-col gap-2">
        <label className="text-sm text-slate-700 font-medium">Password</label>
        <input
          type="password"
          value={data.password}
          onChange={(e) => onChange("password", e.target.value)}
          placeholder="Enter your password"
          className="w-full h-12 px-4 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
        />
      </div>

      {/* Confirm Password */}
      <div className="flex flex-col gap-2">
        <label className="text-sm text-slate-700 font-medium">Confirm Password</label>
        <input
          type="password"
          value={data.confirmPassword}
          onChange={(e) => onChange("confirmPassword", e.target.value)}
          placeholder="Confirm your password"
          className="w-full h-12 px-4 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
        />
      </div>
    </>
  );
};

export default FormFields;
