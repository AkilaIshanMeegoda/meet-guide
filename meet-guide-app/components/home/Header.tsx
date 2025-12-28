"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function Header() {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-lg bg-white/80 border-b border-gray-200">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="MeetGuide" className="w-8 h-8" />
            <span className="text-xl font-bold text-[#142241]">
              MeetGuide
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              className="text-md font-medium text-gray-700 transition-all duration-50 hover:font-bold"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-md font-medium text-gray-700 transition-all duration-50 hover:font-bold"
            >
              How It Works
            </a>
            <a
              href="#benefits"
              className="text-md font-medium text-gray-700 transition-all duration-50 hover:font-bold"
            >
              Benefits
            </a>
            <a
              href="#about"
              className="text-md font-medium text-gray-700 transition-all duration-50 hover:font-bold"
            >
              About
            </a>
          </div>

          {/* CTA Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/auth/login")}
              className="hidden sm:block px-4 py-2 text-sm font-semibold text-[#142241] hover:bg-gray-100 rounded-lg transition-all"
            >
              Login
            </button>
            <button
              onClick={() => router.push("/auth/login")}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#142241] hover:bg-[#1a2d5a] rounded-lg transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
}
