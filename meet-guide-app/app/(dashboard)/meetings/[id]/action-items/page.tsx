"use client";

import React, { useState } from 'react';
import { Calendar, Filter, Download, Bell, User, ChevronRight, CheckCircle2, Circle } from 'lucide-react';

interface ActionItem {
  id: string;
  title: string;
  owner: string;
  dueDate: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Not started' | 'In progress' | 'Completed';
}

const MeetGuideApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState('meetings');
  const [searchQuery, setSearchQuery] = useState('');

  const actionItems: ActionItem[] = [
    {
      id: '1',
      title: 'Finalize presentation slides',
      owner: 'Dmitri',
      dueDate: 'Thursday at 5pm (2025-12-18 17:00)',
      priority: 'High',
      status: 'Not started'
    },
    {
      id: '2',
      title: 'Finalize presentation slides',
      owner: 'Dmitri',
      dueDate: 'Thursday at 5pm',
      priority: 'High',
      status: 'Not started'
    },
    {
      id: '3',
      title: 'Prepare marketing campaign for Q4 product launch',
      owner: 'James Wilson',
      dueDate: '2025-12-14',
      priority: 'High',
      status: 'In progress'
    },
    {
      id: '4',
      title: 'Finalize UI/UX mockups for mobile optimization',
      owner: 'Lisa Park',
      dueDate: 'Next week (2025-12-01)',
      priority: 'Medium',
      status: 'Not started'
    }
  ];

  const filteredItems = actionItems.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-700';
      case 'Medium': return 'bg-orange-100 text-orange-700';
      case 'Low': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In progress': return 'bg-blue-100 text-blue-700';
      case 'Not started': return 'bg-gray-100 text-gray-700';
      case 'Completed': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <main className="w-full">
        {/* Content */}
        <div className="p-8">
          <div className="flex gap-8">
            {/* Main Content Area */}
            <div className="flex-1">
              {/* Search and Actions */}
              <div className="flex items-center justify-between mb-6">
                <div className="relative flex-1 max-w-md">
                  <input
                    type="text"
                    placeholder="Search by action items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="absolute left-3 top-2.5">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
                <div className="flex space-x-3 ml-4">
                  <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                    <Filter className="w-4 h-4" />
                    <span>Filter</span>
                  </button>
                  <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                    <Download className="w-4 h-4" />
                    <span>Export</span>
                  </button>
                </div>
              </div>

              {/* Title and Description */}
              <h1 className="text-3xl font-bold mb-3">All Action Items</h1>
              <p className="text-gray-600 mb-8">
                Complete list of actionable tasks extracted from the meeting with entity recognition and speaker attribution.
              </p>

              {/* Action Items List */}
              <div className="space-y-4">
            {filteredItems.map((item, index) => (
              <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-start space-x-3">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                          {item.status === 'Not started' ? (
                            <span className="flex items-center space-x-1">
                              <Circle className="w-3 h-3" />
                              <span>Not started</span>
                            </span>
                          ) : (
                            item.status
                          )}
                        </span>
                        {index === 1 && (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-500 text-white">
                            ⚡ High Priority
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600 mt-3">
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4" />
                        <span>{item.owner}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4" />
                        <span>Due: {item.dueDate}</span>
                      </div>
                      <div className="mt-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(item.priority)}`}>
                          {item.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
              </div>
            </div>

            {/* Right Sidebar - User Info */}
            <div className="w-80 flex-shrink-0">
              <div className="bg-white border border-gray-200 rounded-lg p-6 sticky top-8">
                <div className="mb-6">
                  <p className="text-sm text-gray-600 mb-2">
                    Extracted from meeting discussion by{' '}
                    <span className="text-indigo-600 font-medium cursor-pointer">Dmitri</span>
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <User className="w-5 h-5 text-gray-600" />
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">Owner</div>
                      <div className="font-medium text-gray-900">Dmitri</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Calendar className="w-5 h-5 text-gray-600" />
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">Due Date</div>
                      <div className="font-medium text-gray-900">Thursday at 5pm</div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <button className="w-full bg-indigo-600 text-white py-2.5 px-4 rounded-lg hover:bg-indigo-700 text-sm font-medium flex items-center justify-center space-x-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Mark as complete</span>
                  </button>
                  <button className="w-full border border-gray-300 bg-white py-2.5 px-4 rounded-lg hover:bg-gray-50 text-sm font-medium flex items-center justify-center space-x-2">
                    <Calendar className="w-4 h-4" />
                    <span>Add to calendar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MeetGuideApp;