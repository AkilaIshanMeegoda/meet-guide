"use client";
import React, { useState } from "react";

const EmailInput: React.FC = () => {
  const [email, setEmail] = useState<string>("");

  return (
    <div className="flex flex-col gap-2">
      <label className="text-base font-medium text-[#1e3a5f]">
        Email Address
      </label>

      <div className="relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <svg
            width="18"
            height="18"
            viewBox="0 0 25 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4.23155 21.7773C3.69683 21.7773 3.23908 21.587 2.85829 21.2062C2.4775 20.8254 2.28711 20.3676 2.28711 19.8329V8.16623C2.28711 7.63151 2.4775 7.17376 2.85829 6.79297C3.23908 6.41218 3.69683 6.22179 4.23155 6.22179H19.7871C20.3218 6.22179 20.7796 6.41218 21.1604 6.79297C21.5412 7.17376 21.7316 7.63151 21.7316 8.16623V19.8329C21.7316 20.3676 21.5412 20.8254 21.1604 21.2062C20.7796 21.587 20.3218 21.7773 19.7871 21.7773H4.23155ZM12.0093 14.9718L4.23155 10.1107V19.8329H19.7871V10.1107L12.0093 14.9718ZM12.0093 13.0273L19.7871 8.16623H4.23155L12.0093 13.0273Z"
              fill="#6C757D"
            />
          </svg>
        </div>
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setEmail(e.target.value)
          }
          className="w-full h-12 pl-10 pr-4 text-base text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4c46b6] focus:border-transparent"
          required
        />
      </div>
    </div>
  );
};

export default EmailInput;
