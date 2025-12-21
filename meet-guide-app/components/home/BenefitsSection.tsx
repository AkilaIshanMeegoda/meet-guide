"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function BenefitsSection() {
  const router = useRouter();

  const benefits = [
    {
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      ),
      bgColor: "bg-green-100",
      iconColor: "text-green-600",
      title: "Boost Confidence",
      description:
        "Build confidence with objective feedback on your communication style and presentation skills.",
    },
    {
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      ),
      bgColor: "bg-blue-100",
      iconColor: "text-blue-600",
      title: "Save Time",
      description:
        "Eliminate manual note-taking and focus on the conversation. Get automatic summaries and transcripts.",
    },
    {
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      ),
      bgColor: "bg-purple-100",
      iconColor: "text-purple-600",
      title: "Track Progress",
      description:
        "Monitor your improvement over time with detailed analytics and historical comparisons.",
    },
    {
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
        />
      ),
      bgColor: "bg-orange-100",
      iconColor: "text-orange-600",
      title: "Personalized Coaching",
      description:
        "Receive tailored recommendations based on your unique communication patterns and goals.",
    },
  ];

  return (
    <section id="benefits" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Content */}
          <div className="space-y-8">
            <div>
              <h2 className="text-4xl md:text-5xl font-black text-[#142241] mb-6">
                Why Choose
                <br />
                <span className="bg-gradient-to-r from-[#142241] to-blue-600 bg-clip-text text-transparent">
                  MeetGuide?
                </span>
              </h2>
              <p className="text-lg text-gray-600">
                Transform your professional communication with AI-powered
                insights that help you grow and succeed.
              </p>
            </div>

            {/* Benefit Items */}
            <div className="space-y-6">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex gap-4">
                  <div
                    className={`flex-shrink-0 w-12 h-12 ${benefit.bgColor} rounded-lg flex items-center justify-center`}
                  >
                    <svg
                      className={`w-6 h-6 ${benefit.iconColor}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      {benefit.icon}
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#142241] mb-2">
                      {benefit.title}
                    </h3>
                    <p className="text-gray-600">{benefit.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => router.push("/auth/login")}
              className="px-8 py-4 text-lg font-bold text-white bg-[#142241] hover:bg-[#1a2d5a] rounded-lg transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
            >
              Start Your Journey
            </button>
          </div>

          {/* Image Placeholder */}
          <div className="relative">
            <div className="aspect-square bg-gradient-to-br from-gray-200 to-gray-300 rounded-2xl flex items-center justify-center">
              <div className="text-center text-gray-500">
                <p className="text-xs text-gray-600">
                  <img
                    className="object-cover rounded-xl bg-white"
                    style={{ boxShadow: "0 2px 16px #e5e7eb" }}
                    src="/whyus.jpg"
                    alt="Sign Up & Connect"
                  />
                </p>
              </div>
            </div>
            {/* Floating Stats Cards */}
            <div className="absolute -top-8 -right-8 bg-white p-6 rounded-xl shadow-xl border border-gray-100">
              <div className="text-3xl font-bold text-green-600 mb-1">
                +32%
              </div>
              <div className="text-sm text-gray-600">Engagement Score</div>
            </div>
            <div className="absolute -bottom-8 -left-8 bg-white p-6 rounded-xl shadow-xl border border-gray-100">
              <div className="text-3xl font-bold text-blue-600 mb-1">
                8.7/10
              </div>
              <div className="text-sm text-gray-600">Clarity Rating</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
