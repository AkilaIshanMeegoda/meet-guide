import React from "react";

export default function TestimonialsSection() {
  const testimonials = [
    {
      quote:
        "MeetGuide has completely transformed how I approach meetings. The AI feedback is incredibly insightful!",
      name: "Sarah Johnson",
      role: "Product Manager",
      image: "https://randomuser.me/api/portraits/women/44.jpg",
    },
    {
      quote:
        "The professional score feature helped me identify areas for improvement I never knew existed. Highly recommended!",
      name: "Michael Chen",
      role: "Sales Director",
      image: "https://randomuser.me/api/portraits/men/32.jpg",
    },
    {
      quote:
        "MeetGuide helps me and my team communicate more effectively. The intent highlights are a game-changer!",
      name: "Emily Rodriguez",
      role: "Engineering Lead",
      image: "https://randomuser.me/api/portraits/women/65.jpg",
    },
  ];

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl md:text-5xl font-black text-[#142241] mb-6">
            Loved by Professionals
          </h2>
          <p className="text-lg text-gray-600">
            See what our users say about their experience with MeetGuide
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-white p-8 rounded-2xl shadow-lg">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className="w-5 h-5 text-yellow-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-gray-600 mb-6">{testimonial.quote}</p>
              <div className="flex items-center gap-3">
                <img
                  src={testimonial.image}
                  alt={testimonial.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <div className="font-bold text-[#142241]">
                    {testimonial.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {testimonial.role}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
