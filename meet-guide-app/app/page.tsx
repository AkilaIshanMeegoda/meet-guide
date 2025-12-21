import React from "react";
import Header from "@/components/home/Header";
import HeroSection from "@/components/home/HeroSection";
import FeaturesSection from "@/components/home/FeaturesSection";
import HowItWorksSection from "@/components/home/HowItWorksSection";
import BenefitsSection from "@/components/home/BenefitsSection";
import StatsSection from "@/components/home/StatsSection";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import CTASection from "@/components/home/CTASection";
import Footer from "@/components/home/Footer";
import ScrollToTop from "@/components/home/ScrollToTop";

export default function HomePage() {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white">
      <Header />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <BenefitsSection />
      <StatsSection />
      <TestimonialsSection />
      <CTASection />
      <Footer />
      <ScrollToTop />
    </div>
  );
}
