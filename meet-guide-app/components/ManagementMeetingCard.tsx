import Link from 'next/link';

interface MeetingCardProps {
  meeting: {
    id: string;
    title: string;
    date: string;
    time: string;
    duration: string;
    participants: number;
    flags: number;
    status: 'upcoming' | 'past';
    bgColor: string;
  };
}

const ManagementMeetingCard = ({ meeting }: MeetingCardProps) => {
  return (
    <div className="flex items-center bg-white rounded-lg shadow-sm p-4 gap-4">
      {/* Meeting Icon */}
      <div className={`w-20 h-14 rounded-md ${meeting.bgColor} flex items-center justify-center text-xs text-slate-500`}>
        MEETING
      </div>

      {/* Meeting Details */}
      <div className="flex-1">
        <h3 className="font-medium">{meeting.title}</h3>
        
        {meeting.flags > 0 && (
          <p className={`text-xs mt-1 ${meeting.flags >= 4 ? 'text-red-500' : 'text-indigo-600'}`}>
            {meeting.flags} pronunciation flag{meeting.flags > 1 ? 's' : ''}
          </p>
        )}
        
        <p className="text-xs text-slate-500 mt-1">
          {meeting.date}, {meeting.time} • {meeting.duration}
        </p>
        
        <p className="text-xs text-slate-400">
          {meeting.participants} Participants
        </p>
      </div>

      {/* Action Button */}
      <Link href={`/management/meetings/${meeting.id}`}>
        <button
          className={`text-xs px-4 py-2 rounded-md cursor-pointer ${
            meeting.status === 'upcoming'
              ? 'bg-indigo-600 text-white'
              : 'bg-indigo-100 text-indigo-600'
          }`}
        >
          {meeting.status === 'upcoming' ? 'Join Meeting' : 'View Details'}
        </button>
      </Link>
    </div>
  );
};

export default ManagementMeetingCard;