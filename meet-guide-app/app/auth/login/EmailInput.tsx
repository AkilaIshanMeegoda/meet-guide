"use client";
import React, { useState } from "react";

const EmailInput: React.FC = () => {
  const [email, setEmail] = useState<string>("");

  return (
    <div className="absolute top-0 left-0 h-[88px] w-[669px] max-sm:w-full">
      <label className="flex absolute left-0 top-0.5 flex-col justify-center h-5 text-base font-medium leading-6 text-blue-950 w-[109px]">
        <span className="text-base font-medium text-blue-950">
          Email Address
        </span>
      </label>

      <div className="relative left-0 top-8 h-14 bg-gray-50 rounded-lg border border-gray-300 border-solid w-[669px] max-sm:w-full">
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setEmail(e.target.value)
          }
          className="px-12 py-5 text-base text-gray-500 border-[none] size-full max-sm:px-12 max-sm:py-5 bg-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-800"
          required
        />
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
          <div
            dangerouslySetInnerHTML={{
              __html:
                "<svg id=\"2249:343\" width=\"25\" height=\"28\" viewBox=\"0 0 25 28\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"> <path d=\"M4.23155 21.7773C3.69683 21.7773 3.23908 21.587 2.85829 21.2062C2.4775 20.8254 2.28711 20.3676 2.28711 19.8329V8.16623C2.28711 7.63151 2.4775 7.17376 2.85829 6.79297C3.23908 6.41218 3.69683 6.22179 4.23155 6.22179H19.7871C20.3218 6.22179 20.7796 6.41218 21.1604 6.79297C21.5412 7.17376 21.7316 7.63151 21.7316 8.16623V19.8329C21.7316 20.3676 21.5412 20.8254 21.1604 21.2062C20.7796 21.587 20.3218 21.7773 19.7871 21.7773H4.23155ZM12.0093 14.9718L4.23155 10.1107V19.8329H19.7871V10.1107L12.0093 14.9718ZM12.0093 13.0273L19.7871 8.16623H4.23155L12.0093 13.0273Z\" fill=\"#6C757D\"></path> </svg>",
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default EmailInput;
