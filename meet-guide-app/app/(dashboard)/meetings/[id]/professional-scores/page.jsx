'use client';

import React from 'react';
import { Bell, HelpCircle, Download } from 'lucide-react';

const ProfessionalScorePage = () => {
  const handleExport = () => {
    console.log('Exporting report...');
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">
              Meetings /Q3 Product Planning Review / Action Items
            </p>
            <h1 className="text-3xl font-bold text-gray-900">Professional Score</h1>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell className="w-5 h-5 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <HelpCircle className="w-5 h-5 text-gray-600" />
            </button>
            <div className="w-8 h-8 bg-orange-400 rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        {/* Score Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">
                Meeting: Q4 Product Planning · Date: July 15, 2024
              </p>
            </div>
            <button 
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm font-medium">Export</span>
            </button>
          </div>
          
          <div className="mb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Professionalism Score</span>
              <span className="text-sm font-bold text-gray-900">85%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-gray-900 h-2 rounded-full" style={{ width: '85%' }}></div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Summary</h2>
          <p className="text-gray-700 leading-relaxed">
            This report analyzes your communication style in meetings, focusing on clarity, 
            engagement, and professionalism. Your overall score is excellent, indicating strong 
            communication skills. Key strengths include clear articulation and active listening. 
            Areas for improvement include managing interruptions and maintaining consistent eye contact.
          </p>
        </div>

        {/* Detailed Analysis */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Detailed Analysis</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Clarity */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-600 mb-2">Clarity</h3>
              <div className="text-4xl font-bold text-gray-900 mb-1">90%</div>
              <div className="text-sm font-medium text-green-600">+3%</div>
            </div>

            {/* Engagement */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-600 mb-2">Engagement</h3>
              <div className="text-4xl font-bold text-gray-900 mb-1">80%</div>
              <div className="text-sm font-medium text-red-600">-2%</div>
            </div>

            {/* Professionalism */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-600 mb-2">Professionalism</h3>
              <div className="text-4xl font-bold text-gray-900 mb-1">85%</div>
              <div className="text-sm font-medium text-green-600">+3%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfessionalScorePage;