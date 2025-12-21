import React from "react";

export default function HowItWorksSection() {
  const steps = [
    {
      number: 1,
      image: "/hiw1.jpg",
      title: "Sign Up & Connect",
      description:
        "Create your account and connect your calendar in seconds. Integrate with your favorite meeting platforms.",
    },
    {
      number: 2,
      image: "/hiw2.png",
      title: "Join Your Meeting",
      description:
        "Start or join meetings as usual. Our AI works silently in the background, analyzing your communication in real-time.",
    },
    {
      number: 3,
      image: "/hiw3.png",
      title: "Get Insights & Improve",
      description:
        "Receive detailed feedback, professional scores, and actionable recommendations after each meeting.",
    },
  ];

  return (
    <section
      id="how-it-works"
      className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50"
    >
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-4xl md:text-5xl font-black text-[#142241] mb-6">
            How It Works
          </h2>
          <p className="text-lg text-gray-600">
            Get started in minutes and transform your meetings with our simple
            3-step process
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connecting Lines (Desktop) */}
          <div className="hidden md:block absolute top-24 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-[#142241] via-blue-400 to-[#142241]"></div>

          {steps.map((step) => (
            <div key={step.number} className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="relative z-10 w-20 h-20 bg-gradient-to-br from-[#142241] to-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl transform hover:scale-110 transition-transform">
                  <span className="text-3xl font-black text-white">
                    {step.number}
                  </span>
                </div>
                <div className="w-full from-gray-200 to-gray-300 rounded-xl mb-6 flex items-center justify-center">
                  <img
                    className="object-cover rounded-xl bg-white"
                    style={{
                      width: "320px",
                      height: "240px",
                      maxWidth: "100%",
                      maxHeight: "240px",
                      boxShadow: "0 2px 16px #e5e7eb",
                    }}
                    src={step.image}
                    alt={step.title}
                  />
                </div>
                <h3 className="text-2xl font-bold text-[#142241] mb-3">
                  {step.title}
                </h3>
                <p className="text-gray-600">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
