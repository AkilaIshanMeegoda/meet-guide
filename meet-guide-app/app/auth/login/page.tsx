import React from "react";
import LoginForm from "./LoginForm";

export default function Page() {
  return (
    <div className="flex flex-col items-start w-full min-h-screen bg-white">
      <div className="flex relative flex-col items-start w-full min-h-screen bg-white">
        <div className="flex relative flex-col items-start w-full">
          {/* Inline header for testing */}
          <header className="box-border flex relative justify-between items-center px-10 py-3 w-full border-b border-solid border-b-gray-200 max-md:px-5 max-md:py-3 max-sm:px-4 max-sm:py-3">
            <div className="flex relative gap-4 items-center">
              <div className="flex relative flex-col items-start" />
              <div className="flex relative flex-col items-start">
                <h1 className="text-lg font-bold leading-6 text-neutral-900">
                  MeetGuide
                </h1>
              </div>
            </div>
          </header>

          {/* Main content with LoginForm */}
          <main className="box-border flex relative justify-center items-start px-40 py-5 w-full flex-[1_0_0] max-md:px-20 max-md:py-5 max-sm:p-5">
            <LoginForm />
          </main>
        </div>
      </div>
    </div>
  );
}
