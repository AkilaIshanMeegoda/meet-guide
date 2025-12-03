"use client";

import React from "react";

export default function LoginForm() {
  return (
    <section className="flex relative flex-col justify-center items-center px-0 py-5 h-[695px] max-w-[960px] w-[960px] max-sm:w-full max-sm:max-w-full">
      <div className="box-border flex relative flex-col items-center px-4 pt-5 pb-3 w-full">
        <h2 className="text-3xl font-bold leading-9 text-center text-neutral-900 max-sm:text-2xl max-sm:leading-8">
          Welcome back
        </h2>
      </div>

      <form className="w-full max-w-[480px] max-sm:w-full max-sm:max-w-full">
        {/* Email field */}
        <div className="box-border flex relative flex-wrap gap-4 content-end items-end px-4 py-3 w-full">
          <div className="flex relative flex-col items-start flex-[1_0_0] min-w-40">
            <div className="flex relative flex-col items-start pb-2 w-full">
              <label className="text-base font-medium leading-6 text-neutral-900">
                Email
              </label>
            </div>
            <div className="box-border flex relative items-center p-4 w-full h-14 bg-white rounded-lg border border-solid border-zinc-200">
              <input
                type="email"
                placeholder="Email"
                className="w-full text-base leading-6 border-[none] text-slate-500"
              />
            </div>
          </div>
        </div>

        {/* Password field */}
        <div className="box-border flex relative flex-wrap gap-4 content-end items-end px-4 py-3 w-full">
          <div className="flex relative flex-col items-start flex-[1_0_0] min-w-40">
            <div className="flex relative flex-col items-start pb-2 w-full">
              <label className="text-base font-medium leading-6 text-neutral-900">
                Password
              </label>
            </div>
            <div className="box-border flex relative items-center p-4 w-full h-14 bg-white rounded-lg border border-solid border-zinc-200">
              <input
                type="password"
                placeholder="Password"
                className="w-full text-base leading-6 border-[none] text-slate-500"
              />
            </div>
          </div>
        </div>

        {/* Forgot password */}
        <div className="box-border flex relative flex-col items-start px-4 pt-1 pb-3 max-w-full w-[464px] max-sm:w-full max-sm:max-w-full">
          <button
            type="button"
            className="text-sm leading-5 cursor-pointer text-slate-500 bg-transparent border-none p-0"
          >
            Forgot password?
          </button>
        </div>

        {/* Submit button */}
        <div className="box-border flex relative items-start px-4 py-3 max-w-full w-[464px] max-sm:w-full max-sm:max-w-full">
          <button
            type="submit"
            className="flex relative justify-center items-center px-4 py-0 h-10 bg-blue-700 rounded-lg cursor-pointer border-[none] flex-[1_0_0] max-w-[480px] min-w-[84px]"
          >
            <div className="flex relative flex-col items-center">
              <span className="overflow-hidden text-sm font-bold leading-5 text-center text-white text-ellipsis">
                Log in
              </span>
            </div>
          </button>
        </div>

        {/* Sign up link */}
        <div className="box-border flex relative flex-col items-center px-4 pt-1 pb-3 max-w-full w-[464px] max-sm:w-full max-sm:max-w-full">
          <button
            type="button"
            className="text-sm leading-5 text-center cursor-pointer text-slate-500 bg-transparent border-none p-0"
          >
            Don&apos;t have an account? Sign up
          </button>
        </div>
      </form>
    </section>
  );
}
