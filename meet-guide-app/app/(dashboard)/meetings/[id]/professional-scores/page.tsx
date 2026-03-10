'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Calendar, Download, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getMyProfessionalScore, HybridDetectionResult } from '@/lib/hybridDetectionAPI';
import { api, getAccessToken, Meeting } from '@/lib/api';
import { generatePDF } from '@/lib/pdfGenerator';

interface SlangDetection {
  sentence: string;
  slang_term?: string;
  detected_slang?: string[];
  confidence?: number;
  confidence_score?: number;
  detection_method?: string;
  severity?: 'high' | 'medium' | 'low';
}

interface ProfessionalScoreResult {
  id?: string;
  _id?: string;
  meeting_id: string;
  user_id: string;
  user_name: string;
  total_sentences: number;
  slang_detected_count?: number;
  slang_frequency_ratio?: number;
  professional_score: number;
  score_label: string;
  transcript?: string;
  processed_at: string;
  frequency_penalty?: number;
  severity_penalty?: number;
  repetition_penalty?: number;
  confidence_penalty?: number;
  engagement_bonus?: number;
  slang_detections?: SlangDetection[];
  unique_slang_terms?: string[];
  total_slang_count?: number;
  detections?: SlangDetection[];
}

const ProfessionalScorePage: React.FC = () => {
  const params = useParams();
  const meetingId = params.id as string;
  const { user } = useAuth();
  
  const [result, setResult] = useState<ProfessionalScoreResult | null>(null);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch hybrid detection results when page loads
  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = getAccessToken();
        
        console.log('=== Professional Score Page Debug ===');
        console.log('Meeting ID from params:', meetingId);
        console.log('Token available:', !!token);
        console.log('User email:', user?.email);
        
        if (!token) {
          setError('Please login to view results');
          setLoading(false);
          return;
        }
        
        if (!meetingId || meetingId === '${id}' || meetingId.includes('%7B')) {
          setError('Invalid meeting ID. Please navigate from the meetings list.');
          setLoading(false);
          return;
        }
        
        // Fetch meeting details
        try {
          const meetingResponse = await api.meetings.getById(meetingId);
          if (meetingResponse.success) {
            setMeeting(meetingResponse.data);
          }
        } catch (err) {
          console.warn('Could not fetch meeting details:', err);
        }
        
        // Fetch MY professional score for this meeting
        console.log('Fetching my professional score for meeting:', meetingId);
        const data = await getMyProfessionalScore(meetingId, token);
        
        console.log('Received result:', data);
        setResult(data);
        
        if (!data) {
          setError('No professional score found for you in this meeting');
        }
      } catch (err: any) {
        console.error('Error fetching results:', err);
        setError(err.message || 'Failed to load results');
      } finally {
        setLoading(false);
      }
    };

    if (meetingId) {
      fetchResults();
    } else {
      setError('No meeting ID provided');
      setLoading(false);
    }
  }, [meetingId, user]);

  const handleExport = (): void => {
    if (!result) {
      alert('No results to export');
      return;
    }
    
    try {
      console.log('Generating PDF report...');
      // Ensure _id is set for PDF generation
      const resultWithId = { 
        ...result, 
        _id: result._id || result.id || meetingId 
      };
      generatePDF([resultWithId as any], meetingId);
      console.log('PDF generated successfully!');
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF report');
    }
  };

  // Get score from the single result
  const score: number = result?.professional_score || 0;

  // Get score color based on value
  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-blue-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="w-full">
        <div className="p-8">
          {/* Header with Title and Meeting Details */}
          <div className="mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h1 className="text-3xl font-bold text-gray-900">My Professional Score</h1>
              
              {/* Meeting Details - Horizontal */}
              {meeting && (
                <div className="flex items-center gap-6 bg-white px-6 py-3 rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    <div>
                      <div className="text-xs text-gray-500">Meeting</div>
                      <div className="font-medium text-gray-900">{meeting.title}</div>
                    </div>
                  </div>
                  <div className="h-8 w-px bg-gray-200"></div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <div>
                      <div className="text-xs text-gray-500">Date</div>
                      <div className="font-medium text-gray-900">
                        {meeting.actual_start 
                          ? new Date(meeting.actual_start).toLocaleDateString()
                          : meeting.scheduled_start 
                            ? new Date(meeting.scheduled_start).toLocaleDateString()
                            : 'N/A'
                        }
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <p className="text-gray-600 mt-3">
              Your comprehensive behavioral professionalism assessment based on hybrid detection analysis including slang usage, confidence, and engagement.
            </p>
          </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <span className="ml-3 text-gray-600">Loading your professional score...</span>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-600 font-medium">Error: {error}</p>
          </div>
        )}

        {/* No Results */}
        {!loading && !error && !result && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <p className="text-yellow-800 font-medium">
              No professional score found for you in this meeting.
            </p>
            <p className="text-yellow-700 text-sm mt-2">
              The system may still be processing. Please check back later.
            </p>
          </div>
        )}

        {/* Result */}
        {!loading && !error && result && (
          <>
            {/* Score Overview */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">
                    Meeting ID: {meetingId}
                  </p>
                </div>
                <button 
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-sm font-medium">Export Report</span>
                </button>
              </div>
              
              <div className="mb-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Your Professionalism Score</span>
                  <span className="text-sm font-bold text-gray-900">{score}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-gray-900 h-2 rounded-full" style={{ width: `${score}%` }}></div>
                </div>
              </div>
            </div>

            {/* User's Result */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              {/* Participant Header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{result.user_name || user?.email || 'You'}</h2>
                  <p className="text-sm text-gray-500">
                    Score Label: {result.score_label || 'N/A'}
                  </p>
                </div>
                <div className="text-right">
                  <div className={`text-4xl font-bold ${getScoreColor(result.professional_score)}`}>
                    {result.professional_score}%
                  </div>
                </div>
              </div>

              {/* Score Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-xs font-medium text-gray-600 mb-2">Frequency Penalty</h3>
                  <div className="text-2xl font-bold text-red-600">-{result.frequency_penalty || 0}</div>
                  <p className="text-xs text-gray-500 mt-1">35% weight</p>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-xs font-medium text-gray-600 mb-2">Severity Penalty</h3>
                  <div className="text-2xl font-bold text-red-600">-{result.severity_penalty || 0}</div>
                  <p className="text-xs text-gray-500 mt-1">25% weight</p>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-xs font-medium text-gray-600 mb-2">Repetition Penalty</h3>
                  <div className="text-2xl font-bold text-red-600">-{result.repetition_penalty || 0}</div>
                  <p className="text-xs text-gray-500 mt-1">15% weight</p>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-xs font-medium text-gray-600 mb-2">Confidence Penalty</h3>
                  <div className="text-2xl font-bold text-red-600">-{result.confidence_penalty || 0}</div>
                  <p className="text-xs text-gray-500 mt-1">15% weight</p>
                </div>

                <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                  <h3 className="text-xs font-medium text-gray-600 mb-2">Engagement Bonus</h3>
                  <div className="text-2xl font-bold text-green-600">+{result.engagement_bonus || 0}</div>
                  <p className="text-xs text-gray-500 mt-1">10% weight</p>
                </div>
              </div>

              {/* Slang Analysis */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Total Slang Count</h3>
                  <div className="text-3xl font-bold text-gray-900">{result.total_slang_count || 0}</div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Unique Slang Terms</h3>
                  <div className="text-3xl font-bold text-gray-900">{result.unique_slang_terms?.length || 0}</div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Total Sentences</h3>
                  <div className="text-3xl font-bold text-gray-900">{result.total_sentences || 0}</div>
                </div>
              </div>

              {/* Transcript */}
              {result.transcript && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Your Transcript</h3>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-gray-800">{result.transcript}</p>
                  </div>
                </div>
              )}

              {/* Slang Detections */}
              {result.slang_detections && result.slang_detections.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Flagged Slang Instances</h3>
                  <div className="space-y-3">
                    {result.slang_detections.map((detection, idx) => {
                      // Handle both slang_term (string) and detected_slang (array) formats
                      const slangTerms = detection.detected_slang || (detection.slang_term ? [detection.slang_term] : []);
                      const confidence = detection.confidence || detection.confidence_score;
                      
                      return (
                        <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <p className="text-gray-800 mb-2">"{detection.sentence}"</p>
                          <div className="flex flex-wrap gap-2">
                            {slangTerms.filter(Boolean).map((term, termIdx) => (
                              <span key={termIdx} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                                {term}
                              </span>
                            ))}
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                              Method: {detection.detection_method || 'N/A'}
                            </span>
                            {confidence && (
                              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                                Confidence: {(confidence * 100).toFixed(1)}%
                              </span>
                            )}
                            {detection.severity && (
                              <span className={`px-3 py-1 rounded-full text-sm ${
                                detection.severity === 'high' ? 'bg-red-100 text-red-700' :
                                detection.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                Severity: {detection.severity}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Unique Slang Terms */}
              {result.unique_slang_terms && result.unique_slang_terms.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Unique Slang Terms Used</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.unique_slang_terms.map((term, idx) => (
                      <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                        {term}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Processing Timestamp */}
              {result.processed_at && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    Processed at: {new Date(result.processed_at).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
        </div>
      </main>
    </div>
  );
};

export default ProfessionalScorePage;
