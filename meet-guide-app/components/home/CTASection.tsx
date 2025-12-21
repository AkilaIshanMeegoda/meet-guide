"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function CTASection() {
  const router = useRouter();

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#142241] via-[#1a2d5a] to-[#142241]">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <h2 className="text-4xl md:text-5xl font-black text-white">
          Ready to Master Your
          <br />
          Meeting Skills?
        </h2>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto">
          Join thousands of professionals who are already improving their
          communication and achieving better results with AI-powered insights.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => router.push("/auth/login")}
            className="px-8 py-4 text-lg font-bold text-[#142241] bg-white hover:bg-gray-100 rounded-lg transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
          >
            Get Started Free
          </button>
          <button
            onClick={() => router.push("/auth/login")}
            className="px-8 py-4 text-lg font-bold text-white border-2 border-white hover:bg-white hover:text-[#142241] rounded-lg transition-all"
          >
            Schedule a Demo
          </button>
        </div>
        <p className="text-sm text-gray-400">
          No credit card required • Free 14-day trial • Cancel anytime
        </p>
      </div>
    </section>
  );
}
