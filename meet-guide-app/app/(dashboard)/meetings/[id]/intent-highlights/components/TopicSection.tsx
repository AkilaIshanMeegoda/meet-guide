import React from "react";

type Conversation = {
  timestamp: string;
  content: string;
};

type TopicSectionProps = {
  title: "Decision" | "Action Item" | "Concern" | string;
  conversations: Conversation[];
};

const META: Record<
  string,
  { icon: React.ReactNode; color: string; accent: string }
> = {
  Decision: {
    icon: (
      <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />
    ),
    color: "text-emerald-700",
    accent: "border-emerald-100",
  },
  "Action Item": {
    icon: <span className="mr-1">📋</span>,
    color: "text-amber-700",
    accent: "border-amber-100",
  },
  Concern: {
    icon: (
      <span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />
    ),
    color: "text-red-700",
    accent: "border-red-100",
  },
};

export const TopicSection: React.FC<TopicSectionProps> = ({
  title,
  conversations,
}) => {
  const meta = META[title] ?? {
    icon: null,
    color: "text-slate-800",
    accent: "border-slate-100",
  };

  return (
    <section>
      <h3
        className={`mb-3 flex items-center text-sm font-semibold ${meta.color}`}
      >
        {meta.icon}
        <span>{title}</span>
      </h3>

      <div className="space-y-2">
        {conversations.map((item, idx) => (
          <div
            key={idx}
            className={`flex items-stretch gap-4 rounded-xl bg-white px-4 py-2 text-sm text-slate-700 shadow-sm border ${meta.accent}`}
          >
            <span className="mt-0.5 w-14 text-[11px] font-mono text-slate-400">
              {item.timestamp}
            </span>
            <div className="flex-1">
              <p>{item.content}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
