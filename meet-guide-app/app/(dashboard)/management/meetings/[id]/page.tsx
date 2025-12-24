'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import MeetingCard from '@/components/MeetingCard';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function ManagementMeetingDetailsPage({ params }: PageProps) {
    const resolvedParams = React.use(params);
    const id = resolvedParams.id;

    const cards = [
        {
            title: "Meeting Culture Analysis",
            description: "Analyze meeting dynamics with an effectiveness score...",
            image: "/meeting_effectiveness.png",
            href: `/management/meetings/${id}/cultural-analysis`
        },
    ];

    return (
        <div className="max-w-7xl mx-auto">
            <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
                <Link href="/management/meetings" className="hover:text-indigo-600 transition-colors">
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