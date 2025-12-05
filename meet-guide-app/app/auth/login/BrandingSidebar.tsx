import React from "react";

const BrandingSidebar: React.FC = () => {
  return (
    <aside className="relative shrink-0 h-screen bg-blue-950 w-[618px] max-md:relative max-md:w-full max-md:h-auto max-md:min-h-[300px] max-sm:hidden">
      <div className="absolute top-0 left-0 bg-black opacity-20 size-full max-md:relative max-md:w-full max-md:h-auto max-md:min-h-[300px] max-sm:hidden" />

      <div className="absolute h-[262px] left-[129px] top-[409px] w-[234px] max-md:static max-md:mx-auto max-md:my-10 max-md:text-center">
        <div>
          <div
            dangerouslySetInnerHTML={{
              __html:
                "<svg id=\"2249:326\" width=\"36\" height=\"44\" viewBox=\"0 0 36 44\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"> <path d=\"M12 22H24V19H12V22ZM13.5 27.25H22.5V24.25H13.5V27.25ZM10.5 38.5C9.675 38.5 8.96875 38.2063 8.38125 37.6187C7.79375 37.0312 7.5 36.325 7.5 35.5V8.5C7.5 7.675 7.79375 6.96875 8.38125 6.38125C8.96875 5.79375 9.675 5.5 10.5 5.5H25.5C26.325 5.5 27.0313 5.79375 27.6188 6.38125C28.2063 6.96875 28.5 7.675 28.5 8.5V13.15C28.95 13.325 29.3125 13.6 29.5875 13.975C29.8625 14.35 30 14.775 30 15.25V18.25C30 18.725 29.8625 19.15 29.5875 19.525C29.3125 19.9 28.95 20.175 28.5 20.35V35.5C28.5 36.325 28.2063 37.0312 27.6188 37.6187C27.0313 38.2063 26.325 38.5 25.5 38.5H10.5ZM10.5 35.5H25.5V8.5H10.5V35.5Z\" fill=\"#4A47A3\"></path> </svg>",
            }}
          />
        </div>

        <header className="flex absolute top-0.5 left-12 flex-col justify-center h-9 text-3xl font-bold tracking-tighter leading-9 text-white w-[156px]">
          <h1 className="text-3xl font-bold text-white">MeetGuide</h1>
        </header>

        <section className="flex absolute left-0 flex-col justify-center text-4xl font-black tracking-tighter leading-10 text-white h-[89px] top-[72px] w-[258px]">
          <h2 className="text-4xl font-black text-white">
            Clarity in Every
            <br />
            Conversation.
          </h2>
        </section>

        <p className="flex absolute left-0 flex-col justify-center text-lg leading-7 text-gray-300 h-[77px] top-[181px] w-[364px]">
          <span className="text-lg text-gray-300">
            Unlock your professional potential with AI-
            <br />
            powered feedback on your communication
            <br />
            skills.
          </span>
        </p>
      </div>

      <footer className="flex absolute left-9 flex-col justify-center h-5 text-sm leading-5 text-gray-400 top-[908px] w-[156px]">
        <p className="text-sm text-gray-400">© 2024 MeetGuide Inc.</p>
      </footer>
    </aside>
  );
};

export default BrandingSidebar;
