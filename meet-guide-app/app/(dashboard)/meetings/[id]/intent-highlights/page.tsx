"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { summarizationApi } from '@/lib/api';
import { generateIntentHighlightsReport } from '@/lib/pdfGenerator';
import { 
  Loader2, 
  Calendar, 
  MessageSquare, 
  CheckCircle, 
  HelpCircle, 
  AlertCircle, 
  FileText,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  Target,
  User
} from 'lucide-react';

type Conversation = {
  content: string;
  speaker?: string;
};

type Topic = {
  topic_id: number;
  label: string;
  utterances: Array<{
    speaker: string;
    sentence: string;
    intent: string;
  }>;
};

type IntentCounts = {
  'action-item'?: number;
  'decision'?: number;
  'question'?: number;
  'concern'?: number;
  'inform'?: number;
};

type SummarizationData = {
  meeting_id: string;
  meeting_title: string;
  meeting_date: string;
  topics: Topic[];
  intent_counts: IntentCounts;
  total_utterances: number;
};

const IntentHighlightsPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const meetingId = params?.id as string;
  
  const [summarization, setSummarization] = useState<SummarizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIntent, setSelectedIntent] = useState<string | null>(null);
  const [expandedTopics, setExpandedTopics] = useState<Set<number>>(new Set([0])); // First topic expanded by default

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    const fetchSummarization = async () => {
      try {
        setLoading(true);
        const data = await summarizationApi.getSummarization(meetingId as string);
        setSummarization(data);
        setError(null);
      } catch (err: any) {
        // Check if it's a 404 (no summarization found)
        if (err.message?.includes('not found') || err.message?.includes('404')) {
          setSummarization(null);
          setError(null);
        } else {
          setError(err.message || 'An error occurred');
          console.error('Error fetching summarization:', err);
        }
      } finally {
        setLoading(false);
      }
    };

    if (meetingId && !authLoading && isAuthenticated) {
      fetchSummarization();
    } else if (!authLoading && !isAuthenticated) {
      setLoading(false);
    }
  }, [meetingId, authLoading, isAuthenticated]);

  // Export handler
  const handleExport = () => {
    if (!summarization) {
      alert('No data available to export');
      return;
    }
    
    try {
      generateIntentHighlightsReport(summarization);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report. Please try again.');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-indigo-600" />
          <p className="text-gray-600">Loading intent highlights...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error: {error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!summarization) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No intent highlights found for this meeting.</p>
            <p className="text-gray-400 text-sm mt-2">The meeting may not have been processed yet.</p>
          </div>
        </main>
      </div>
    );
  }

  // Helper functions
  const getIntentIcon = (intent: string) => {
    switch (intent?.toLowerCase()) {
      case 'action-item': return <Target className="w-4 h-4" />;
      case 'decision': return <CheckCircle className="w-4 h-4" />;
      case 'question': return <HelpCircle className="w-4 h-4" />;
      case 'concern': return <AlertCircle className="w-4 h-4" />;
      case 'inform': return <FileText className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getIntentColor = (intent: string) => {
    switch (intent?.toLowerCase()) {
      case 'action-item': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'decision': return 'bg-green-50 text-green-700 border-green-200';
      case 'question': return 'bg-red-50 text-red-700 border-red-200';
      case 'concern': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'inform': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getIntentLabel = (intent: string) => {
    switch (intent?.toLowerCase()) {
      case 'action-item': return 'Action Item';
      case 'decision': return 'Decision';
      case 'question': return 'Question';
      case 'concern': return 'Concern';
      case 'inform': return 'Information';
      default: return intent;
    }
  };

  const toggleTopic = (topicId: number) => {
    const newExpanded = new Set(expandedTopics);
    if (newExpanded.has(topicId)) {
      newExpanded.delete(topicId);
    } else {
      newExpanded.add(topicId);
    }
    setExpandedTopics(newExpanded);
  };

  // Group utterances by intent within a topic
  const groupByIntent = (utterances: Topic['utterances']) => {
    const grouped: Record<string, Conversation[]> = {};
    utterances.forEach(utt => {
      if (!grouped[utt.intent]) {
        grouped[utt.intent] = [];
      }
      grouped[utt.intent].push({
        content: utt.sentence,
        speaker: utt.speaker
      });
    });
    return grouped;
  };

  // Filter topics based on search and selected intent
  const filteredTopics = summarization.topics.filter(topic => {
    const matchesSearch = searchQuery === '' || 
      topic.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      topic.utterances.some(utt => utt.sentence.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesIntent = !selectedIntent || 
      topic.utterances.some(utt => utt.intent === selectedIntent);
    
    return matchesSearch && matchesIntent;
  });

  const meetingDate = summarization.meeting_date ? new Date(summarization.meeting_date) : new Date();

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="w-full">
        <div className="p-8">
          <div className="flex gap-8">
            {/* Main Content Area */}
            <div className="flex-1">
              {/* Header */}
              <div className="mb-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <h1 className="text-3xl font-bold text-gray-900">Intent Highlights</h1>
                  
                  {/* Meeting Details - Horizontal */}
                  <div className="flex items-center gap-6 bg-white px-6 py-3 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                      <div>
                        <div className="text-xs text-gray-500">Meeting</div>
                        <div className="font-medium text-gray-900">{summarization.meeting_title}</div>
                      </div>
                    </div>
                    <div className="h-8 w-px bg-gray-200"></div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-xs text-gray-500">Date</div>
                        <div className="font-medium text-gray-900">{meetingDate.toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="h-8 w-px bg-gray-200"></div>
                    <div>
                      <div className="text-xs text-gray-500">Utterances</div>
                      <div className="font-medium text-gray-900">{summarization.total_utterances}</div>
                    </div>
                  </div>
                </div>
                <p className="text-gray-600 mt-3">
                  AI-detected key moments and categorized insights from your meeting
                </p>
              </div>

              {/* Search and Export */}
              <div className="flex items-center justify-between mb-6">
                <div className="relative flex-1 max-w-md">
                  <input
                    type="text"
                    placeholder="Search by topics..."
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
                  <button 
                    onClick={handleExport}
                    className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export</span>
                  </button>
                </div>
              </div>

              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Topics</p>
                      <p className="text-2xl font-bold text-indigo-600">{summarization.topics.length}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Action Items</p>
                      <p className="text-2xl font-bold text-orange-600">{summarization.intent_counts['action-item'] || 0}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Decisions</p>
                      <p className="text-2xl font-bold text-green-600">{summarization.intent_counts['decision'] || 0}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Questions</p>
                      <p className="text-2xl font-bold text-red-600">{summarization.intent_counts['question'] || 0}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Concerns</p>
                      <p className="text-2xl font-bold text-yellow-600">{summarization.intent_counts['concern'] || 0}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Topics List */}
              {filteredTopics.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
                  <p className="text-gray-500">No topics match your search criteria.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTopics.map((topic, index) => {
                    const intentGroups = groupByIntent(topic.utterances);
                    const isExpanded = expandedTopics.has(topic.topic_id);
                    
                    return (
                      <div key={topic.topic_id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                        {/* Topic Header */}
                        <button
                          onClick={() => toggleTopic(topic.topic_id)}
                          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                              <span className="font-bold text-indigo-600">#{index + 1}</span>
                            </div>
                            <div className="text-left">
                              <h3 className="text-lg font-semibold text-gray-900">{topic.label}</h3>
                              <p className="text-sm text-gray-500 mt-1">
                                {topic.utterances.length} utterances across {Object.keys(intentGroups).length} intent types
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {/* Intent badges */}
                            <div className="flex gap-2 mr-4">
                              {Object.entries(intentGroups).map(([intent, items]) => (
                                <span 
                                  key={intent}
                                  className={`px-2 py-1 rounded text-xs font-medium ${getIntentColor(intent)}`}
                                >
                                  {items.length} {getIntentLabel(intent)}
                                </span>
                              ))}
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        </button>

                        {/* Topic Content */}
                        {isExpanded && (
                          <div className="border-t border-gray-200 p-6 bg-gray-50">
                            <div className="space-y-6">
                              {Object.entries(intentGroups).map(([intent, conversations]) => {
                                // Skip if filtering by intent and this isn't it
                                if (selectedIntent && intent !== selectedIntent) return null;
                                
                                return (
                                  <div key={intent} className="bg-white rounded-lg border border-gray-200 p-4">
                                    <div className="flex items-center space-x-2 mb-4">
                                      <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${getIntentColor(intent)}`}>
                                        {getIntentIcon(intent)}
                                        <span className="font-medium text-sm">{getIntentLabel(intent)}</span>
                                        <span className="text-xs opacity-75">({conversations.length})</span>
                                      </div>
                                    </div>
                                    
                                    <div className="space-y-3">
                                      {conversations.map((conv, idx) => (
                                        <div key={idx} className="pl-4 border-l-2 border-gray-200 hover:border-indigo-400 transition-colors">
                                          <div className="flex items-start space-x-3">
                                            <div className="flex-1">
                                              <p className="text-gray-800">{conv.content}</p>
                                              {conv.speaker && (
                                                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                                  <User className="w-3 h-3" />
                                                  {conv.speaker}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Sidebar - Intent Filter */}
            <div className="w-80 shrink-0">
              <div className="bg-white border border-gray-200 rounded-lg p-6 sticky top-8">
                <h3 className="font-semibold text-lg mb-4">Filter by Intent</h3>
                
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedIntent(null)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                      selectedIntent === null
                        ? 'bg-indigo-50 text-indigo-700 font-medium border border-indigo-200'
                        : 'hover:bg-gray-50 text-gray-700 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>All Intents</span>
                      <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                        {summarization.total_utterances}
                      </span>
                    </div>
                  </button>
                  
                  {summarization.intent_counts['action-item'] !== undefined && summarization.intent_counts['action-item'] > 0 && (
                    <button
                      onClick={() => setSelectedIntent('action-item')}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        selectedIntent === 'action-item'
                          ? 'bg-orange-50 text-orange-700 font-medium border border-orange-200'
                          : 'hover:bg-orange-50 text-gray-700 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4" />
                          <span>Action Items</span>
                        </div>
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                          {summarization.intent_counts['action-item']}
                        </span>
                      </div>
                    </button>
                  )}
                  
                  {summarization.intent_counts['decision'] !== undefined && summarization.intent_counts['decision'] > 0 && (
                    <button
                      onClick={() => setSelectedIntent('decision')}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        selectedIntent === 'decision'
                          ? 'bg-green-50 text-green-700 font-medium border border-green-200'
                          : 'hover:bg-green-50 text-gray-700 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          <span>Decisions</span>
                        </div>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                          {summarization.intent_counts['decision']}
                        </span>
                      </div>
                    </button>
                  )}
                  
                  {summarization.intent_counts['question'] !== undefined && summarization.intent_counts['question'] > 0 && (
                    <button
                      onClick={() => setSelectedIntent('question')}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        selectedIntent === 'question'
                          ? 'bg-red-50 text-red-700 font-medium border border-red-200'
                          : 'hover:bg-red-50 text-gray-700 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <HelpCircle className="w-4 h-4" />
                          <span>Questions</span>
                        </div>
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                          {summarization.intent_counts['question']}
                        </span>
                      </div>
                    </button>
                  )}
                  
                  {summarization.intent_counts['concern'] !== undefined && summarization.intent_counts['concern'] > 0 && (
                    <button
                      onClick={() => setSelectedIntent('concern')}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        selectedIntent === 'concern'
                          ? 'bg-yellow-50 text-yellow-700 font-medium border border-yellow-200'
                          : 'hover:bg-yellow-50 text-gray-700 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          <span>Concerns</span>
                        </div>
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                          {summarization.intent_counts['concern']}
                        </span>
                      </div>
                    </button>
                  )}
                  
                  {summarization.intent_counts['inform'] !== undefined && summarization.intent_counts['inform'] > 0 && (
                    <button
                      onClick={() => setSelectedIntent('inform')}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        selectedIntent === 'inform'
                          ? 'bg-blue-50 text-blue-700 font-medium border border-blue-200'
                          : 'hover:bg-blue-50 text-gray-700 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          <span>Information</span>
                        </div>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          {summarization.intent_counts['inform']}
                        </span>
                      </div>
                    </button>
                  )}
                </div>

                {/* Quick Stats */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Quick Stats</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Total Topics</span>
                      <span className="font-medium text-gray-900">{summarization.topics.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Utterances</span>
                      <span className="font-medium text-gray-900">{summarization.total_utterances}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg. per Topic</span>
                      <span className="font-medium text-gray-900">
                        {summarization.topics.length > 0 
                          ? Math.round(summarization.total_utterances / summarization.topics.length)
                          : 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default IntentHighlightsPage;
