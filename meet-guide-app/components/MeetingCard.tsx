'use client';

import Link from 'next/link';
import Image from 'next/image';

interface MeetingCardProps {
    title: string;
    description: string;
    image: string;
    href: string;
}

const MeetingCard: React.FC<MeetingCardProps> = ({ title, description, image, href }) => {
    return (
        <Link
            href={href}
            className="bg-white rounded-md border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col group"
        >
            <div className="relative h-48 w-full overflow-hidden">
                <Image
                    src={image}
                    alt={title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
            </div>
            <div className="p-6 flex flex-col flex-1">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed flex-1">
                    {description}
                </p>
            </div>
        </Link>
    );
};

export default MeetingCard;
