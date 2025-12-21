import React from "react";

export default function StatsSection() {
  const stats = [
    { value: "10k+", label: "Active Users" },
    { value: "50k+", label: "Meetings Analyzed" },
    { value: "95%", label: "Accuracy Rate" },
    { value: "4.9/5", label: "User Satisfaction" },
  ];

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-[#142241]">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((stat, index) => (
            <div key={index} className="space-y-2">
              <div className="text-5xl font-black text-white">{stat.value}</div>
              <div className="text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
