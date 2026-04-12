import HeroSection          from "@/components/home/HeroSection";
import HowItWorks           from "@/components/home/HowItWorks";
import FeaturesSection      from "@/components/home/FeaturesSection";
import StatsSection         from "@/components/home/StatsSection";
import TestimonialsSection  from "@/components/home/TestimonialsSection";
import CTABanner            from "@/components/home/CTABanner";

export default function HomePage() {
  return (
    <>
      <HeroSection />

      {/* Thin gold divider */}
      <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, #D4AF37 30%, #D4AF37 70%, transparent)" }} />

      <HowItWorks />

      <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, #2a2a2a 30%, #2a2a2a 70%, transparent)" }} />

      <FeaturesSection />

      <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, #2a2a2a 30%, #2a2a2a 70%, transparent)" }} />

      <StatsSection />

      <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, #2a2a2a 30%, #2a2a2a 70%, transparent)" }} />

      <TestimonialsSection />

      <CTABanner />
    </>
  );
}
