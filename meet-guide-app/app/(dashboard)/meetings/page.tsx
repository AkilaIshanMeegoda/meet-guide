'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Card from '@/components/meetings/Card';
import { meetingsApi, Meeting } from '@/lib/api';

const MeetingsPage = () => {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Fetch meetings from backend
  useEffect(() => {
    const fetchMeetings = async () => {
      if (!isAuthenticated) return;
      
      try {
        setLoading(true);
        const response = await meetingsApi.getAll();
        
        if (response.success) {
          // Transform backend data to match Card component format
          const transformedMeetings = response.data.map((meeting: Meeting) => {
            const scheduledDate = meeting.scheduled_start ? new Date(meeting.scheduled_start) : null;
            const actualDate = meeting.actual_start ? new Date(meeting.actual_start) : null;
            const endDate = meeting.actual_end ? new Date(meeting.actual_end) : null;
            const now = new Date();
            
            // Determine status (upcoming or past)
            const isPast = meeting.status === 'ended' || 
                          (meeting.actual_end && new Date(meeting.actual_end) < now);
            
            // Calculate duration
            let duration = 'N/A';
            if (meeting.actual_start && meeting.actual_end) {
              const durationMs = new Date(meeting.actual_end).getTime() - new Date(meeting.actual_start).getTime();
              const durationMin = Math.round(durationMs / 60000);
              duration = `${durationMin} min`;
            } else if (meeting.scheduled_start && meeting.scheduled_end) {
              const durationMs = new Date(meeting.scheduled_end).getTime() - new Date(meeting.scheduled_start).getTime();
              const durationMin = Math.round(durationMs / 60000);
              duration = `${durationMin} min`;
            }
            
            // Format date and time
            const dateToUse = actualDate || scheduledDate || new Date();
            const date = dateToUse.toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            });
            const time = dateToUse.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            });
            
            // Assign colors based on status
            const bgColors = ['bg-blue-100', 'bg-emerald-100', 'bg-orange-100', 'bg-purple-100'];
            const bgColor = bgColors[Math.floor(Math.random() * bgColors.length)];
            
            return {
              id: meeting.meeting_id,
              title: meeting.title,
              date,
              time,
              duration,
              participants: meeting.participants?.length || 0,
              score: null, // Will be updated when pronunciation data is available
              flags: 0, // Will be updated when pronunciation data is available
              status: isPast ? 'past' as const : 'upcoming' as const,
              bgColor
            };
          });
          
          setMeetings(transformedMeetings);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load meetings');
      } finally {
        setLoading(false);
      }
    };

    fetchMeetings();
  }, [isAuthenticated]);

  const filteredMeetings = meetings.filter(meeting => {
    const matchesSearch = meeting.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || meeting.status === activeTab;
    return matchesSearch && matchesTab;
  });

  // Show loading state
  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Meetings</h1>
          <p className="text-gray-600 mt-1">View and join your meetings</p>
        </div>
        <button
          onClick={() => router.push('/schedule-meeting')}
          className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Schedule Meeting
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search meetings..."
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-6 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-3 px-1 font-medium transition border-b-2 ${
            activeTab === 'all'
              ? 'text-indigo-600 border-indigo-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`pb-3 px-1 font-medium transition border-b-2 ${
            activeTab === 'upcoming'
              ? 'text-indigo-600 border-indigo-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`pb-3 px-1 font-medium transition border-b-2 ${
            activeTab === 'past'
              ? 'text-indigo-600 border-indigo-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          Past
        </button>
      </div>

      {/* Meeting Cards */}
      <div className="space-y-4">
        {filteredMeetings.length > 0 ? (
          filteredMeetings.map((meeting) => (
            <Card key={meeting.id} meeting={meeting} />
          ))
        ) : (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-200">
            <p className="text-gray-500">
              {searchQuery ? 'No meetings found matching your search.' : 'No meetings yet.'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => router.push('/schedule-meeting')}
                className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition"
              >
                Create Your First Meeting
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingsPage;