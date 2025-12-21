"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function HeroSection() {
  const router = useRouter();

  return (
    <section className="relative pt-20 pb-32 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#142241] via-[#1a2d5a] to-[#142241]">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Hero Content */}
          <div className="text-white space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-sm font-medium">
                AI-Powered Meeting Intelligence
              </span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black leading-tight">
              Master Your
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                Meeting Skills
              </span>
            </h1>

            <p className="text-xl text-gray-300 leading-relaxed max-w-xl">
              Transform every conversation into a learning opportunity. Get
              real-time AI feedback on your communication skills, professional
              scores, and actionable insights to excel in every meeting.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => router.push("/auth/login")}
                className="px-8 py-4 text-lg font-bold text-[#142241] bg-white hover:bg-gray-100 rounded-lg transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
              >
                Schedule a Meeting
              </button>
              <button
                onClick={() => {
                  document
                    .getElementById("features")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
                className="px-8 py-4 text-lg font-bold text-white border-2 border-white hover:bg-white hover:text-[#142241] rounded-lg transition-all"
              >
                Explore Features
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 pt-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">95%</div>
                <div className="text-sm text-gray-400 mt-1">
                  Accuracy Rate
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">10k+</div>
                <div className="text-sm text-gray-400 mt-1">
                  Meetings Analyzed
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">4.9/5</div>
                <div className="text-sm text-gray-400 mt-1">User Rating</div>
              </div>
            </div>
          </div>

          {/* Hero Image Placeholder */}
          <div className="relative rounded-2xl overflow-hidden shadow-2xl animate-fade-in">
            <video
              src="/home.webm"
              className="object-cover w-full h-full"
              autoPlay
              loop
              muted
              playsInline
              aria-label="Dashboard Preview Video"
            />
          </div>
        </div>
      </div>

      {/* Wave Divider */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg
          className="w-full h-24"
          viewBox="0 0 1440 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <path
            d="M0,80 L0,40 Q360,0 720,40 T1440,40 L1440,80 Z"
            fill="white"
          />
        </svg>
      </div>
    </section>
  );
}
