'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar, Clock, Users, X } from 'lucide-react';
import { api } from '@/lib/api';

export default function ScheduleMeetingPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [formData, setFormData] = useState({
        title: '',
        date: '',
        time: '10:00',
        duration: '30',
        participants: [] as string[],
        agenda: ''
    });
    const [participantEmail, setParticipantEmail] = useState('');
    const [creating, setCreating] = useState(false);

    const addParticipantEmail = (email: string) => {
        const trimmed = email.trim();
        if (trimmed && !formData.participants.includes(trimmed)) {
            setFormData({
                ...formData,
                participants: [...formData.participants, trimmed]
            });
        }
        setParticipantEmail('');
    };

    const handleAddParticipant = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && participantEmail.trim()) {
            e.preventDefault();
            addParticipantEmail(participantEmail);
        }
    };

    const handleRemoveParticipant = (email: string) => {
        setFormData({
            ...formData,
            participants: formData.participants.filter(p => p !== email)
        });
    };

    const handleSubmit = async (e: React.FormEvent, isDraft: boolean = false) => {
        e.preventDefault();
        if (!formData.title.trim()) return;

        try {
            setCreating(true);

            // Auto-add any pending email from the input field before submitting
            let finalParticipants = [...formData.participants];
            if (participantEmail.trim()) {
                const pendingEmail = participantEmail.trim();
                if (!finalParticipants.includes(pendingEmail)) {
                    finalParticipants.push(pendingEmail);
                }
                setParticipantEmail('');
                setFormData(prev => ({ ...prev, participants: finalParticipants }));
            }

            // Calculate scheduled_start and scheduled_end
            const scheduledStart = formData.date && formData.time 
                ? new Date(`${formData.date}T${formData.time}`).toISOString()
                : undefined;
            
            let scheduledEnd: string | undefined;
            if (scheduledStart && formData.duration) {
                const endDate = new Date(`${formData.date}T${formData.time}`);
                endDate.setMinutes(endDate.getMinutes() + parseInt(formData.duration));
                scheduledEnd = endDate.toISOString();
            }

            const res = await api.meetings.create({
                title: formData.title,
                description: formData.agenda,
                scheduled_start: scheduledStart,
                scheduled_end: scheduledEnd,
                invited_emails: finalParticipants.length > 0 ? finalParticipants : undefined
            });

            if (res.success) {
                router.push('/meetings');
            }
        } catch (error) {
            console.error('Error creating meeting:', error);
        } finally {
            setCreating(false);
        }
    };

    const getPreviewDate = () => {
        if (!formData.date) return 'Select date';
        const date = new Date(formData.date);
        return date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric' 
        });
    };

    const getPreviewTime = () => {
        if (!formData.time) return 'Select time';
        const [hours, minutes] = formData.time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    };

    const getDurationText = () => {
        const minutes = parseInt(formData.duration);
        if (minutes < 60) return `${minutes} minutes`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours} hour${hours > 1 ? 's' : ''}`;
    };

    // Generate calendar for current month
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const calendarDays = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
        calendarDays.push(null);
    }
    
    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
        calendarDays.push(day);
    }

    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Schedule a New Meeting</h1>
                <p className="text-gray-600 mt-2">Fill in the details below to schedule your new meeting.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form Section */}
                <div className="lg:col-span-2">
                    <form onSubmit={(e) => handleSubmit(e, false)} className="bg-white rounded-xl shadow-sm border border-gray-200">
                        <div className="p-6 border-b border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-900">Meeting Details</h2>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Meeting Title */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Meeting Title
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="e.g., Q4 Project Kickoff"
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                                    required
                                />
                            </div>

                            {/* Date, Time, Duration */}
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Date
                                    </label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="date"
                                            value={formData.date}
                                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Time
                                    </label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="time"
                                            value={formData.time}
                                            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Duration
                                    </label>
                                    <select
                                        value={formData.duration}
                                        onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                                    >
                                        <option value="15">15 minutes</option>
                                        <option value="30">30 minutes</option>
                                        <option value="45">45 minutes</option>
                                        <option value="60">1 hour</option>
                                        <option value="90">1.5 hours</option>
                                        <option value="120">2 hours</option>
                                    </select>
                                </div>
                            </div>

                            {/* Participants */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Participants
                                </label>
                                <div className="relative flex gap-2">
                                    <div className="relative flex-1">
                                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="email"
                                            value={participantEmail}
                                            onChange={(e) => setParticipantEmail(e.target.value)}
                                            onKeyDown={handleAddParticipant}
                                            onBlur={() => {
                                                if (participantEmail.trim()) {
                                                    addParticipantEmail(participantEmail);
                                                }
                                            }}
                                            placeholder="Enter participant email address..."
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => addParticipantEmail(participantEmail)}
                                        className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium text-sm whitespace-nowrap"
                                    >
                                        + Add
                                    </button>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">Press Enter, click Add, or just type and continue — emails are added automatically</p>
                                {formData.participants.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {formData.participants.map((email) => {
                                            const initials = email.substring(0, 2).toUpperCase();
                                            const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500'];
                                            const color = colors[email.length % colors.length];
                                            
                                            return (
                                                <div key={email} className="flex items-center gap-2 bg-gray-100 rounded-full pl-1 pr-3 py-1">
                                                    <div className={`w-6 h-6 ${color} rounded-full flex items-center justify-center text-white text-xs font-medium`}>
                                                        {initials}
                                                    </div>
                                                    <span className="text-sm text-gray-700">{email}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveParticipant(email)}
                                                        className="text-gray-400 hover:text-gray-600"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Agenda */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Agenda (Optional)
                                </label>
                                <textarea
                                    value={formData.agenda}
                                    onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
                                    placeholder="What's the purpose of this meeting?"
                                    rows={3}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 resize-none"
                                />
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="p-6 border-t border-gray-200 flex justify-between">
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="px-6 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition font-medium"
                            >
                                Cancel
                            </button>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={(e) => handleSubmit(e, true)}
                                    className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                                >
                                    Save as Draft
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating || !formData.title.trim()}
                                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50"
                                >
                                    {creating ? 'Scheduling...' : 'Schedule Meeting'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Preview Section */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 sticky top-8">
                        <div className="p-6 border-b border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-900">Invitation Preview</h2>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Meeting Title */}
                            <div>
                                <h3 className="text-xl font-semibold text-indigo-600">
                                    {formData.title || 'Meeting Title'}
                                </h3>
                            </div>

                            {/* Date & Time */}
                            <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                    <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                                    <div className="text-sm text-gray-700">
                                        {getPreviewDate()}
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                                    <div className="text-sm text-gray-700">
                                        {getPreviewTime()} - {formData.time && formData.duration ? 
                                            (() => {
                                                const [hours, minutes] = formData.time.split(':').map(Number);
                                                const endMinutes = hours * 60 + minutes + parseInt(formData.duration);
                                                const endHours = Math.floor(endMinutes / 60) % 24;
                                                const endMins = endMinutes % 60;
                                                const ampm = endHours >= 12 ? 'PM' : 'AM';
                                                const displayHour = endHours % 12 || 12;
                                                return `${displayHour}:${endMins.toString().padStart(2, '0')} ${ampm}`;
                                            })() : ''}
                                    </div>
                                </div>
                            </div>

                            {/* Participants */}
                            <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-3">Participants</h4>
                                <div className="flex -space-x-2">
                                    {user && (
                                        <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white">
                                            {user.full_name?.substring(0, 2).toUpperCase() || user.username?.substring(0, 2).toUpperCase()}
                                        </div>
                                    )}
                                    {formData.participants.slice(0, 3).map((email, idx) => {
                                        const initials = email.substring(0, 2).toUpperCase();
                                        const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500'];
                                        const color = colors[idx % colors.length];
                                        return (
                                            <div key={email} className={`w-8 h-8 ${color} rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white`}>
                                                {initials}
                                            </div>
                                        );
                                    })}
                                    {formData.participants.length > 3 && (
                                        <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white">
                                            +{formData.participants.length - 3}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Mini Calendar */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <button type="button" className="p-1 hover:bg-gray-100 rounded">
                                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                    </button>
                                    <span className="text-sm font-semibold text-gray-900">{monthName}</span>
                                    <button type="button" className="p-1 hover:bg-gray-100 rounded">
                                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="grid grid-cols-7 gap-1 text-center">
                                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                                        <div key={idx} className="text-xs font-medium text-gray-500 py-1">{day}</div>
                                    ))}
                                    {calendarDays.map((day, idx) => {
                                        const selectedDate = formData.date ? new Date(formData.date).getDate() : null;
                                        const isToday = day === now.getDate();
                                        const isSelected = day === selectedDate;
                                        
                                        return (
                                            <div key={idx} className="aspect-square">
                                                {day ? (
                                                    <button
                                                        type="button"
                                                      className={`w-full h-full text-xs rounded-lg transition ${
                                                            isSelected ? 'bg-indigo-600 text-white font-semibold' :
                                                            isToday ? 'bg-indigo-100 text-indigo-600 font-semibold' :
                                                            'text-gray-700 hover:bg-gray-100'
                                                        }`}
                                                    >
                                                        {day}
                                                    </button>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
