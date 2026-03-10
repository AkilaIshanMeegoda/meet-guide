'use client';

import { BarChart3, TrendingUp, Users, Clock } from 'lucide-react';

export default function AnalyticsPage() {
    return (
        <div className="max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
                <p className="text-gray-600 mt-2">Track your meeting insights and pronunciation progress</p>
            </div>

            {/* Coming Soon Card */}
            <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-200">
                <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <BarChart3 className="w-10 h-10 text-indigo-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Analytics Coming Soon</h2>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                    We're working on bringing you detailed meeting analytics, pronunciation trends, and performance insights.
                </p>
                
                {/* Feature Preview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mt-12">
                    <div className="p-6 bg-gray-50 rounded-lg">
                        <TrendingUp className="w-8 h-8 text-indigo-600 mx-auto mb-3" />
                        <h3 className="font-semibold text-gray-900 mb-2">Performance Trends</h3>
                        <p className="text-sm text-gray-600">Track your pronunciation improvement over time</p>
                    </div>
                    <div className="p-6 bg-gray-50 rounded-lg">
                        <Users className="w-8 h-8 text-indigo-600 mx-auto mb-3" />
                        <h3 className="font-semibold text-gray-900 mb-2">Team Insights</h3>
                        <p className="text-sm text-gray-600">Compare performance across team members</p>
                    </div>
                    <div className="p-6 bg-gray-50 rounded-lg">
                        <Clock className="w-8 h-8 text-indigo-600 mx-auto mb-3" />
                        <h3 className="font-semibold text-gray-900 mb-2">Meeting Stats</h3>
                        <p className="text-sm text-gray-600">View duration, participation, and engagement metrics</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
