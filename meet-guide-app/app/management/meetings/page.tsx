'use client';

import { useState } from 'react';
import Card from '@/components/ManagementMeetingCard';

const meetings = [
  {
    id: '1',
    title: 'Project Kickoff - Q3',
    date: '2025-10-25',
    time: '10:00 AM',
    duration: '45 min',
    participants: 8,
    flags: 0,
    status: 'past' as const,
    bgColor: 'bg-orange-100'
  },
];

const MeetingsPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const filteredMeetings = meetings.filter(meeting => {
    const matchesSearch = meeting.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || meeting.status === activeTab;
    return matchesSearch && matchesTab;
  });

  return (
    <div className="flex h-screen bg-slate-50">
      <div className="flex-1">
        <main className="px-8 flex justify-center">
          <div className="w-full max-w-4xl">
            <h1 className="text-2xl font-semibold mb-6">
              Your Meetings
            </h1>

            {/* Search */}
            <div className="max-w-4xl mb-6">
              <input
                type="text"
                placeholder="Search by host, participant, room..."
                className="w-full px-4 py-2 rounded-md bg-indigo-50 text-sm outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Tabs */}
            <div className="flex gap-6 text-sm mb-8">
              <span
                className={`font-medium pb-1 cursor-pointer ${
                  activeTab === 'all'
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-slate-500'
                }`}
                onClick={() => setActiveTab('all')}
              >
                All
              </span>
              <span
                className={`font-medium pb-1 cursor-pointer ${
                  activeTab === 'upcoming'
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-slate-500'
                }`}
                onClick={() => setActiveTab('upcoming')}
              >
                Upcoming
              </span>
              <span
                className={`font-medium pb-1 cursor-pointer ${
                  activeTab === 'past'
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-slate-500'
                }`}
                onClick={() => setActiveTab('past')}
              >
                Past
              </span>
            </div>

            {/* Meeting Cards */}
            <div className="space-y-4">
              {filteredMeetings.map((meeting) => (
                <Card key={meeting.id} meeting={meeting} />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default MeetingsPage;