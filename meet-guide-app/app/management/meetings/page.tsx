"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import ManagementCard from "@/components/meetings/ManagementCard";
import { meetingsApi, Meeting, PaginatedMeetings } from "@/lib/api";

const PAGE_SIZE = 12;

type TabFilter = "all" | "upcoming" | "past";

/** Map UI tab values to backend status values */
const TAB_TO_STATUS: Record<TabFilter, string | undefined> = {
  all: undefined,
  upcoming: "scheduled",
  past: "ended",
};

interface TransformedMeeting {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: string;
  participants: number;
  flags: number;
  status: "upcoming" | "past";
  bgColor: string;
  hostName: string;
}

const BG_COLORS = [
  "bg-blue-100",
  "bg-emerald-100",
  "bg-orange-100",
  "bg-purple-100",
];

function transformMeeting(meeting: Meeting, index: number): TransformedMeeting {
  const scheduledDate = meeting.scheduled_start
    ? new Date(meeting.scheduled_start)
    : null;
  const actualDate = meeting.actual_start
    ? new Date(meeting.actual_start)
    : null;
  const now = new Date();

  const isPast =
    meeting.status === "ended" ||
    (meeting.actual_end ? new Date(meeting.actual_end) < now : false);

  let duration = "N/A";
  if (meeting.actual_start && meeting.actual_end) {
    const mins = Math.round(
      (new Date(meeting.actual_end).getTime() -
        new Date(meeting.actual_start).getTime()) /
        60000
    );
    duration = `${mins} min`;
  } else if (meeting.scheduled_start && meeting.scheduled_end) {
    const mins = Math.round(
      (new Date(meeting.scheduled_end).getTime() -
        new Date(meeting.scheduled_start).getTime()) /
        60000
    );
    duration = `${mins} min`;
  }

  const dateToUse = actualDate || scheduledDate || new Date();

  return {
    id: meeting.meeting_id,
    title: meeting.title,
    date: dateToUse.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    time: dateToUse.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
    duration,
    participants: meeting.participants?.length ?? 0,
    flags: 0,
    status: isPast ? "past" : "upcoming",
    bgColor: BG_COLORS[index % BG_COLORS.length],
    hostName: meeting.host_name,
  };
}

const ManagementMeetingsPage = () => {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useAuth();

  const [meetings, setMeetings] = useState<TransformedMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMeetings, setTotalMeetings] = useState(0);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1); // Reset to first page on new search
    }, 400);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Reset page when tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  // Fetch meetings from management endpoint
  const fetchMeetings = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setLoading(true);
      setError("");

      const response = await meetingsApi.getAllForManagement({
        page: currentPage,
        page_size: PAGE_SIZE,
        status: TAB_TO_STATUS[activeTab],
        search: searchQuery || undefined,
      });

      if (response.success) {
        const { items, total, total_pages } = response.data;
        setMeetings(items.map((m, i) => transformMeeting(m, i)));
        setTotalPages(total_pages);
        setTotalMeetings(total);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load meetings");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, currentPage, activeTab, searchQuery]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // Pagination helpers
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = start + maxVisible - 1;
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">All Meetings</h1>
          <p className="text-gray-600 mt-1">
            {totalMeetings} meeting{totalMeetings !== 1 ? "s" : ""} across all
            users
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search meetings by title..."
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-6 mb-6 border-b border-gray-200">
        {(["all", "upcoming", "past"] as TabFilter[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 px-1 font-medium capitalize transition border-b-2 ${
              activeTab === tab
                ? "text-indigo-600 border-indigo-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        </div>
      ) : (
        <>
          {/* Meeting cards */}
          <div className="space-y-4">
            {meetings.length > 0 ? (
              meetings.map((meeting) => (
                <ManagementCard key={meeting.id} meeting={meeting} />
              ))
            ) : (
              <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-200">
                <p className="text-gray-500">
                  {searchQuery
                    ? "No meetings found matching your search."
                    : "No meetings yet."}
                </p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="flex items-center justify-between mt-8">
              <p className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </p>

              <div className="flex items-center gap-1">
                {/* Previous */}
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-sm rounded-md border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                >
                  Previous
                </button>

                {/* First page + ellipsis */}
                {pageNumbers[0] > 1 && (
                  <>
                    <button
                      onClick={() => setCurrentPage(1)}
                      className="px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50 transition"
                    >
                      1
                    </button>
                    {pageNumbers[0] > 2 && (
                      <span className="px-2 text-gray-400">…</span>
                    )}
                  </>
                )}

                {/* Page numbers */}
                {pageNumbers.map((num) => (
                  <button
                    key={num}
                    onClick={() => setCurrentPage(num)}
                    className={`px-3 py-2 text-sm rounded-md border transition ${
                      num === currentPage
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {num}
                  </button>
                ))}

                {/* Last page + ellipsis */}
                {pageNumbers[pageNumbers.length - 1] < totalPages && (
                  <>
                    {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                      <span className="px-2 text-gray-400">…</span>
                    )}
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      className="px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50 transition"
                    >
                      {totalPages}
                    </button>
                  </>
                )}

                {/* Next */}
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 text-sm rounded-md border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                >
                  Next
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
};

export default ManagementMeetingsPage;
