'use client';

import Link from 'next/link';
import { Calendar, ChevronRight } from 'lucide-react';

const meetings = [
    {
        id: '1',
        title: 'Project Kickoff - Q3',
        date: '2023-10-25',
        time: '10:00 AM',
    },
    {
        id: '2',
        title: 'Weekly Sync',
        date: '2023-10-26',
        time: '02:00 PM',
    },
    {
        id: '3',
        title: 'Design Review',
        date: '2023-10-27',
        time: '11:30 AM',
    },
    {
        id: '4',
        title: 'Client Presentation',
        date: '2023-10-28',
        time: '03:00 PM',
    },
];

export default function ManagementMeetingsPage() {
    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Meetings</h1>
                <p className="text-gray-500">View and manage your past and upcoming meetings.</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="divide-y divide-gray-100">
                    {meetings.map((meeting) => (
                        <Link
                            key={meeting.id}
                            href={`/management/meetings/${meeting.id}`}
                            className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                                    <Calendar className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">{meeting.title}</h3>
                                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                        <span>{meeting.date}</span>
                                        <span>•</span>
                                        <span>{meeting.time}</span>
                                    </div>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
};
