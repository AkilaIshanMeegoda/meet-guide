import React from "react";

const BrandingSidebar: React.FC = () => {
  return (
    <aside className="relative flex flex-col justify-center w-[38%] min-w-[400px] h-screen bg-[#142241] px-16 py-12 max-lg:hidden">
      {/* Top Section - Logo and Tagline */}
      <div className="flex flex-col gap-12">
        {/* Logo and Brand Name */}
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="MeetGuide logo" className="w-8 h-8 object-contain" />
          <h1 className="text-2xl font-bold text-white">MeetGuide</h1>
        </div>

        {/* Main Headline */}
        <div className="flex flex-col gap-6">
          <h2 className="text-4xl font-black text-white leading-tight">
            Clarity in Every
            <br />
            Conversation.
          </h2>
          <p className="text-lg text-gray-300 leading-relaxed">
            Unlock your professional potential with AI-
            <br />
            powered feedback on your communication
            <br />
            skills.
          </p>
        </div>
      </div>

      {/* Bottom Section - Copyright (pinned bottom-left) */}
      <footer className="absolute left-6 bottom-6">
        <p className="text-sm text-gray-400">© 2025 MeetGuide Inc.</p>
      </footer>
    </aside>
  );
};

export default BrandingSidebar;
