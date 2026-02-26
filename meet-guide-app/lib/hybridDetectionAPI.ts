// Hybrid Detection API Integration Examples
// Use these examples when integrating hybrid detection into your frontend

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api').replace(/\/+$/, '');

// ========================================
// 1. Process Hybrid Detection for a Meeting
// ========================================
export async function processHybridDetection(meetingId: string, token: string) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/hybrid-detection/process-meeting/${meetingId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Hybrid detection processed:', data);
    return data;
  } catch (error) {
    console.error('Error processing hybrid detection:', error);
    throw error;
  }
}

// ========================================
// 2. Get Results for a Meeting
// ========================================
export async function getMeetingHybridResults(meetingId: string, token: string) {
  try {
    console.log('=== API Call Debug ===');
    console.log('Meeting ID:', meetingId);
    console.log('API URL:', `${API_BASE_URL}/hybrid-detection/results/${meetingId}`);
    
    const response = await fetch(
      `${API_BASE_URL}/hybrid-detection/results/${meetingId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('API Response data:', data);
    console.log('Success:', data.success);
    console.log('Data array length:', data.data?.length);
    
    if (data.success && data.data) {
      console.log('Returning results:', data.data);
      return data.data; // Array of HybridDetectionResult
    }
    
    console.warn('No results or unsuccessful response');
    return [];
  } catch (error) {
    console.error('Error fetching meeting results:', error);
    return [];
  }
}

// ========================================
// 3. Get My Professional Score for a Specific Meeting
// ========================================
export async function getMyProfessionalScore(meetingId: string, token: string) {
  try {
    console.log('=== Fetching My Professional Score ===');
    console.log('Meeting ID:', meetingId);
    console.log('API URL:', `${API_BASE_URL}/hybrid-detection/my-score/${meetingId}`);
    
    const response = await fetch(
      `${API_BASE_URL}/hybrid-detection/my-score/${meetingId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('API Response data:', data);
    
    if (data.success && data.data) {
      console.log('Professional Score:', data.data.professional_score);
      return data.data;
    }
    
    console.warn('No professional score found for this meeting');
    return null;
  } catch (error) {
    console.error('Error fetching my professional score:', error);
    return null;
  }
}

// ========================================
// 4. Get User's Result for a Meeting (by userId)
// ========================================
export async function getUserMeetingResult(
  meetingId: string, 
  userId: string, 
  token: string
) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/hybrid-detection/meeting/${meetingId}/user/${userId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();
    
    if (data.success) {
      return data.data;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching user result:', error);
    return null;
  }
}

// ========================================
// 5. Get Current User's All Results
// ========================================
export async function getMyHybridResults(token: string, limit = 50) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/hybrid-detection/user/me/results?limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();
    
    if (data.success) {
      return data.data; // Array of results
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching my results:', error);
    return [];
  }
}

// ========================================
// 6. Get Current User's Summary
// ========================================
export async function getMyHybridSummary(token: string) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/hybrid-detection/user/me/summary`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();
    
    if (data.success) {
      return data.data; // HybridDetectionSummary object
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching summary:', error);
    return null;
  }
}

// ========================================
// TypeScript Interfaces (for reference)
// ========================================

export interface SlangDetection {
  sentence: string;
  is_slang: boolean;
  term?: string;
  confidence: number;
  method: string;
  slang_type?: string;
}

export interface HybridDetectionResult {
  id: string;
  meeting_id: string;
  user_id: string;
  user_name: string;
  total_sentences: number;
  slang_detected_count: number;
  slang_frequency_ratio: number;
  professional_score: number;
  score_label: string;
  detections: SlangDetection[];
  transcript?: string;
  processed_at: string;
  frequency_penalty?: number;
  severity_penalty?: number;
  repetition_penalty?: number;
  confidence_penalty?: number;
  engagement_bonus?: number;
}

export interface HybridDetectionSummary {
  user_id: string;
  user_name: string;
  total_meetings_analyzed: number;
  average_professional_score: number;
  total_sentences_analyzed: number;
  total_slang_detected: number;
  average_slang_frequency: number;
  score_trend: Array<{
    meeting_id: string;
    processed_at: string;
    score: number;
    label: string;
  }>;
  most_common_slang: Array<{
    term: string;
    count: number;
  }>;
}

// ========================================
// React Hook Example
// ========================================
/*
import { useState, useEffect } from 'react';

export function useHybridDetection(meetingId: string) {
  const [results, setResults] = useState<HybridDetectionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchResults() {
      try {
        setLoading(true);
        const token = localStorage.getItem('token'); // Or from your auth context
        const data = await getMeetingHybridResults(meetingId, token);
        setResults(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (meetingId) {
      fetchResults();
    }
  }, [meetingId]);

  return { results, loading, error };
}
*/

// ========================================
// Usage Example in Component
// ========================================
/*
import React, { useEffect, useState } from 'react';
import { getMeetingHybridResults, processHybridDetection } from './hybridDetectionAPI';

export function MeetingAnalysisComponent({ meetingId, token }: { meetingId: string, token: string }) {
  const [results, setResults] = useState([]);
  const [processing, setProcessing] = useState(false);

  // Process hybrid detection
  const handleProcess = async () => {
    setProcessing(true);
    try {
      await processHybridDetection(meetingId, token);
      // Refresh results
      const newResults = await getMeetingHybridResults(meetingId, token);
      setResults(newResults);
    } catch (error) {
      console.error('Failed to process:', error);
    } finally {
      setProcessing(false);
    }
  };

  // Load existing results
  useEffect(() => {
    async function loadResults() {
      const data = await getMeetingHybridResults(meetingId, token);
      setResults(data);
    }
    loadResults();
  }, [meetingId, token]);

  return (
    <div>
      <button onClick={handleProcess} disabled={processing}>
        {processing ? 'Processing...' : 'Analyze Meeting'}
      </button>
      
      <div className="results">
        {results.map((result) => (
          <div key={result.id} className="result-card">
            <h3>{result.user_name}</h3>
            <div className="score">
              <div className="score-value">{result.professional_score.toFixed(1)}</div>
              <div className="score-label">{result.score_label}</div>
            </div>
            <div className="stats">
              <span>Sentences: {result.total_sentences}</span>
              <span>Slang: {result.slang_detected_count}</span>
              <span>Frequency: {(result.slang_frequency_ratio * 100).toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
*/

// ========================================
// Score Display Helper
// ========================================
export function getScoreColor(score: number): string {
  if (score >= 90) return '#10b981'; // green
  if (score >= 75) return '#3b82f6'; // blue
  if (score >= 60) return '#f59e0b'; // yellow
  if (score >= 40) return '#f97316'; // orange
  return '#ef4444'; // red
}

export function getScoreEmoji(score: number): string {
  if (score >= 90) return '🌟';
  if (score >= 75) return '👍';
  if (score >= 60) return '👌';
  if (score >= 40) return '⚠️';
  return '❌';
}
