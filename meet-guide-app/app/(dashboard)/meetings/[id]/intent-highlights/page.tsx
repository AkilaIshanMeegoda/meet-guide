import SearchBar from "@/app/(dashboard)/meetings/[id]/intent-highlights/components/SearchBar";
import FilterButton from "@/components/FilterButton";
import ExportButton from "@/components/ExportButton";
import StatsCard from "@/app/(dashboard)/meetings/[id]/intent-highlights/components/StatsCard";
import {TopicSection} from "@/app/(dashboard)/meetings/[id]/intent-highlights/components/TopicSection";

type PageProps = {
  params: Promise<{
    id: string; // /meetings/[id]/intent-highlights -> "id" from URL
  }>;
};

type StatCardData = {
  title: string;
  value: string;
  valueColor: string;
};

type Conversation = {
  content: string;
};

type MeetingMeta = {
  title: string;
  duration: string;
  participants: number;
  date: string;
};

// DEMO meeting data keyed by id
const MEETINGS: Record<string, MeetingMeta> = {
  "q4-planning": {
    title: "Q4 Product Planning Review",
    duration: "45 min",
    participants: 4,
    date: "Dec 6, 2025",
  },
  "kickoff-q3": {
    title: "Project Kickoff - Q3",
    duration: "60 min",
    participants: 6,
    date: "Nov 28, 2025",
  },
};

// Stats + conversations (same for all meetings in the demo)
const statsData: StatCardData[] = [
  { title: "Topics Identified", value: "4", valueColor: "#3b32e2" },
  { title: "Action Items", value: "8", valueColor: "#FF9000" },
  { title: "Decisions Made", value: "3", valueColor: "#18C13D" },
  { title: "Informs", value: "5", valueColor: "#121417" },
];

const decisionConversations: Conversation[] = [
  {
    
    content: "“Let’s prioritize mobile optimization for Q4 release.”",
  },
  {
    
    content:
      "“We’ll move forward with the advanced analytics dashboard as our second priority.”",
  },
];

const actionItemConversations: Conversation[] = [
  {
    
    content:
      "“Lisa, can you conduct a user research survey for mobile features by Friday?”",
  },
  
];

const concernConversations: Conversation[] = [
  {
    
    content:
      "“I’m concerned about the lack of resources for this initiative.”",
  },
];

export default async function IntentHighlightsPage({ params }: PageProps) {
  // unwrap the promise Next.js gives us
  const { id } = await params;

  // get meta for the current meeting id, or fallback demo if not found
  const meeting: MeetingMeta =
    MEETINGS[id] ?? {
      title: `Meeting ${id}`,
      duration: "10 min",
      participants: 4,
      date: "Dec 6, 2025",
    };

  return (
    <div className="min-h-full bg-[#f7f8fc]">
      <div className="mx-auto max-w-7xl py-6">
        {/* Breadcrumb + meta */}
        <div className="mb-4">
          <nav
            className="text-sm font-medium text-slate-600"
            aria-label="Breadcrumb"
          >
            Meetings / {meeting.title} / Topic wise Intent Highlights
          </nav>

          <div className="mt-4 flex flex-wrap items-center gap-6 text-sm font-medium text-slate-600">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[14px]">
                ⏱
              </span>
              <span>{meeting.duration}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[14px]">
                👥
              </span>
              <span>{meeting.participants} participants</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[14px]">
                📅
              </span>
              <span>{meeting.date}</span>
            </div>
          </div>
        </div>

        {/* Search + buttons */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <SearchBar className="flex-1 min-w-[240px]" />
          <FilterButton />
          <ExportButton />
        </div>

        {/* Stats cards */}
        <div className="mb-10 flex flex-wrap gap-4">
          {statsData.map((stat, index) => (
            <StatsCard
              key={index}
              title={stat.title}
              value={stat.value}
              valueColor={stat.valueColor}
            />
          ))}
        </div>

        {/* Topic header */}
        <div className="mb-8">
          <h2 className="mb-2 text-3xl font-black tracking-tight text-slate-900 md:text-[26px]">
            Topic 1: Product Feature Prioritization
          </h2>
          <p className="max-w-4xl  leading-6 text-base text-slate-500">
            This section summarizes discussions around prioritizing features for
            the upcoming Q4 release, specifically focusing on mobile
            optimization and an advanced analytics dashboard.
          </p>
        </div>

        {/* Intent sections */}
        <div className="max-w-4xl space-y-10">
          <TopicSection title="Decision" conversations={decisionConversations} />
          <TopicSection
            title="Action Item"
            conversations={actionItemConversations}
          />
          <TopicSection title="Concern" conversations={concernConversations} />
        </div>
      </div>
    </div>
  );
}