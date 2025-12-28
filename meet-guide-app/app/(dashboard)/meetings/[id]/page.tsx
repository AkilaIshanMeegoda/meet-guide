'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import MeetingCard from '@/components/MeetingCard';

interface PageProps {
    params: Promise<{ id: string }>;
}

const MeetingDetailsPage = ({ params }: PageProps) => {
    const resolvedParams = React.use(params);
    const id = resolvedParams.id;

    const cards = [
        {
            title: "Topic wise Intent Highlights",
            description: "Get AI-generated summaries and jump to important moments in your meeting with tagged highlights.",
            image: "/intent_highlights.png",
            href: `/meetings/${id}/intent-highlights`
        },
        {
            title: "Action items",
            description: "Automatically capture action items from your meeting transcripts...",
            image: "/action_items.png",
            href: "#"
        },
        {
            title: "Pronunciation Coaching",
            description: "Improve your clarity and confidence with real-time pronunciation feedback...",
            image: "/pronunciation_coaching.png",
            href: `/meetings/${id}/professional-scores`
        },
        {
            title: "Meeting Effectiveness",
            description: "Analyze meeting dynamics with an effectiveness score...",
            image: "/meeting_effectiveness.png",
            href: "#"
        }
    ];

    return (
        <div className="max-w-7xl mx-auto">
            <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
                <Link href="/meetings" className="hover:text-indigo-600 transition-colors">
                    All Meetings
                </Link>
                <ChevronRight className="w-4 h-4" />
                <span className="text-gray-900 font-medium">{id}</span>
                <ChevronRight className="w-4 h-4" />
                <span className="text-gray-400">Details</span>
            </nav>

            <h1 className="text-3xl font-bold text-gray-900 mb-8">Meeting Analysis Overview</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {cards.map((card, index) => (
                    <MeetingCard
                        key={index}
                        title={card.title}
                        description={card.description}
                        image={card.image}
                        href={card.href}
                    />
                ))}
            </div>
        </div>
    );
};

export default MeetingDetailsPage;