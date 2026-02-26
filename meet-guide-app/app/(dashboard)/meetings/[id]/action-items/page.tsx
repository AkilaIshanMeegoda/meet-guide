"use client";

import React, { useState, useEffect } from 'react';
import { Calendar, Filter, Download, User, CheckCircle2, Circle, Loader2, Clock, AlertCircle, PlayCircle } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api, ActionItem } from '@/lib/api';
import { generateActionItemsReport } from '@/lib/pdfGenerator';

const ActionItemsPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const meetingId = params?.id as string;
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    const fetchActionItems = async () => {
      try {
        setLoading(true);
        const response = await api.summarization.getActionItemsForMeeting(meetingId);
        // Response structure: { success: true, message: "...", data: { meeting_id, count, action_items } }
        const items = response.data.action_items || [];
        console.log('Fetched action items:', items);
        console.log('Current user email:', user?.email);
        setActionItems(items);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        console.error('Error fetching action items:', err);
      } finally {
        setLoading(false);
      }
    };

    if (meetingId && !authLoading && isAuthenticated) {
      fetchActionItems();
    } else if (!authLoading && !isAuthenticated) {
      setLoading(false);
    }
  }, [meetingId, authLoading, user?.email, isAuthenticated]);

  const updateStatus = async (itemId: string, newStatus: string) => {
    try {
      setUpdatingStatus(itemId);
      await api.summarization.updateActionItem(itemId, { status: newStatus });

      // Update local state
      setActionItems(items =>
        items.map(item =>
          item._id === itemId ? { ...item, status: newStatus as any } : item
        )
      );
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Export handler
  const handleExport = () => {
    if (!actionItems || actionItems.length === 0) {
      alert('No action items available to export');
      return;
    }
    
    try {
      const meetingTitle = actionItems[0]?.meeting_title || 'Unknown Meeting';
      const meetingDate = actionItems[0]?.meeting_date || new Date().toISOString();
      generateActionItemsReport(actionItems, meetingTitle, meetingDate, meetingId);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report. Please try again.');
    }
  };

  // Helper function to get priority order value
  const getPriorityOrder = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high': return 1;
      case 'medium': return 2;
      case 'low': return 3;
      default: return 2; // Default to medium
    }
  };

  const filteredItems = actionItems
    .filter(item => {
      const matchesSearch = item.task?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.assignee?.toLowerCase().includes(searchQuery.toLowerCase());
      
      // If a user is selected in sidebar, filter by that user, otherwise show all
      const matchesUser = !selectedUser || 
        item.assignee_emails?.includes(selectedUser) || 
        item.assignee_email === selectedUser;
      
      return matchesSearch && matchesUser;
    })
    .sort((a, b) => {
      // Sort by priority: high -> medium -> low
      return getPriorityOrder(a.priority) - getPriorityOrder(b.priority);
    });

  // Get all unique assignees - show ALL assignees in sidebar
  const allAssignees = new Set<string>();
  actionItems.forEach(item => {
    if (item.assignee_emails && item.assignee_emails.length > 0) {
      item.assignee_emails.forEach(email => allAssignees.add(email));
    } else if (item.assignee_email) {
      allAssignees.add(item.assignee_email);
    }
  });

  // Group action items by assignee for the right sidebar
  const itemsByAssignee: { [key: string]: ActionItem[] } = {};
  Array.from(allAssignees).forEach(email => {
    itemsByAssignee[email] = actionItems.filter(item =>
      item.assignee_emails?.includes(email) || item.assignee_email === email
    );
  });

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-orange-100 text-orange-700';
      case 'low': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'in-progress': return 'bg-blue-100 text-blue-700';
      case 'pending': return 'bg-gray-100 text-gray-700';
      case 'completed': return 'bg-green-100 text-green-700';
      case 'blocked': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'in-progress': return <PlayCircle className="w-3 h-3" />;
      case 'pending': return <Circle className="w-3 h-3" />;
      case 'completed': return <CheckCircle2 className="w-3 h-3" />;
      case 'blocked': return <AlertCircle className="w-3 h-3" />;
      default: return <Circle className="w-3 h-3" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'in-progress': return 'In Progress';
      case 'pending': return 'Not Started';
      case 'completed': return 'Completed';
      case 'blocked': return 'Blocked';
      default: return status;
    }
  };

  const formatPriority = (priority: string) => {
    return priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : 'Medium';
  };

  const canUpdateStatus = (item: ActionItem) => {
    if (!user?.email) {
      console.log('No user email found');
      return false;
    }
    const canUpdate = item.assignee_emails?.includes(user.email) || item.assignee_email === user.email;
    console.log(`Can update item ${item.task}?`, {
      userEmail: user.email,
      assigneeEmail: item.assignee_email,
      assigneeEmails: item.assignee_emails,
      canUpdate
    });
    return canUpdate;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-indigo-600" />
          <p className="text-gray-600">Loading action items...</p>
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

  const meetingTitle = actionItems.length > 0 ? actionItems[0].meeting_title : '';
  const meetingDate = actionItems.length > 0 ? new Date(actionItems[0].meeting_date).toLocaleDateString() : '';

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="w-full">
        <div className="p-8">
          <div className="flex gap-8">
            {/* Main Content Area */}
            <div className="flex-1">
              {/* Header with Title and Meeting Details */}
              <div className="mb-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <h1 className="text-3xl font-bold text-gray-900">All Action Items</h1>
                  
                  {/* Meeting Details - Horizontal */}
                  {meetingTitle && (
                    <div className="flex items-center gap-6 bg-white px-6 py-3 rounded-lg border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                        <div>
                          <div className="text-xs text-gray-500">Meeting</div>
                          <div className="font-medium text-gray-900">{meetingTitle}</div>
                        </div>
                      </div>
                      <div className="h-8 w-px bg-gray-200"></div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="text-xs text-gray-500">Date</div>
                          <div className="font-medium text-gray-900">{meetingDate}</div>
                        </div>
                      </div>
                      <div className="h-8 w-px bg-gray-200"></div>
                      <div>
                        <div className="text-xs text-gray-500">Total Items</div>
                        <div className="font-medium text-gray-900">{actionItems.length}</div>
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-gray-600 mt-3">
                  Complete list of actionable tasks extracted from the meeting with entity recognition and speaker attribution.
                </p>
              </div>

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
                  <button 
                    onClick={handleExport}
                    className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export</span>
                  </button>
                </div>
              </div>

              {/* No action items message */}
              {filteredItems.length === 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
                  <p className="text-gray-500">
                    {searchQuery || selectedUser ? 'No action items match your filters.' : 'No action items found for this meeting.'}
                  </p>
                </div>
              )}

              {/* Action Items List */}
              <div className="space-y-4">
                {filteredItems.map((item) => {
                  const isAssignee = canUpdateStatus(item);
                  
                  return (
                    <div key={item._id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-start space-x-3">
                            <div className="flex items-center space-x-3 mb-2 flex-wrap gap-2">
                              <h3 className="text-lg font-semibold text-gray-900">{item.task || 'Untitled Task'}</h3>
                              <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(item.status)}`}>
                                {getStatusIcon(item.status)}
                                <span>{getStatusLabel(item.status)}</span>
                              </span>
                              {item.priority === 'high' && (
                                <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-500 text-white">
                                  ⚡ High Priority
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="space-y-2 text-sm text-gray-600 mt-3">
                            <div className="flex items-center space-x-2">
                              <User className="w-4 h-4" />
                              <span>
                                {item.assignee === 'Team/All' 
                                  ? `Team (${item.assignee_emails?.length || 0} members)` 
                                  : item.assignee || 'Unassigned'}
                              </span>
                            </div>
                            {item.deadline && (
                              <div className="flex items-center space-x-2">
                                <Calendar className="w-4 h-4" />
                                <span>Due: {item.deadline}</span>
                              </div>
                            )}
                            {item.topic_label && (
                              <div className="flex items-center space-x-2 mt-2">
                                <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded">
                                  Topic: {item.topic_label}
                                </span>
                              </div>
                            )}
                            <div className="mt-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(item.priority)}`}>
                                {formatPriority(item.priority)}
                              </span>
                            </div>
                          </div>

                          {/* Status Update Buttons - Only for assignees */}
                          {isAssignee && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm text-gray-500 mr-2">Update Status:</span>
                                {['pending', 'in-progress', 'blocked', 'completed'].map((status) => (
                                  <button
                                    key={status}
                                    onClick={() => updateStatus(item._id, status)}
                                    disabled={updatingStatus === item._id || item.status === status}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                                      item.status === status
                                        ? 'bg-indigo-600 text-white cursor-default'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50'
                                    }`}
                                  >
                                    {updatingStatus === item._id ? (
                                      <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                                    ) : null}
                                    {getStatusLabel(status)}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Sidebar - User-wise Action Items */}
            <div className="w-80 shrink-0">
              <div className="bg-white border border-gray-200 rounded-lg p-6 sticky top-8">
                <h3 className="font-semibold text-lg mb-4">Action Items by User</h3>
                
                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Pending</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {actionItems.filter(item => item.status === 'pending').length}
                    </div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="text-xs text-blue-600 uppercase tracking-wide mb-1">In Progress</div>
                    <div className="text-2xl font-bold text-blue-700">
                      {actionItems.filter(item => item.status === 'in-progress').length}
                    </div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="text-xs text-red-600 uppercase tracking-wide mb-1">Blocked</div>
                    <div className="text-2xl font-bold text-red-700">
                      {actionItems.filter(item => item.status === 'blocked').length}
                    </div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-xs text-green-600 uppercase tracking-wide mb-1">Completed</div>
                    <div className="text-2xl font-bold text-green-700">
                      {actionItems.filter(item => item.status === 'completed').length}
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Filter by Assignee</h4>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    <button
                      onClick={() => setSelectedUser(null)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedUser === null
                          ? 'bg-indigo-50 text-indigo-700 font-medium'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>All Users</span>
                        <span className="text-xs bg-gray-200 px-2 py-1 rounded">{actionItems.length}</span>
                      </div>
                    </button>
                    
                    {Array.from(allAssignees).sort().map((email) => {
                      const userItems = itemsByAssignee[email];
                      const pendingCount = userItems.filter(i => i.status === 'pending').length;
                      const inProgressCount = userItems.filter(i => i.status === 'in-progress').length;
                      const completedCount = userItems.filter(i => i.status === 'completed').length;
                      const blockedCount = userItems.filter(i => i.status === 'blocked').length;
                      
                      return (
                        <button
                          key={email}
                          onClick={() => setSelectedUser(email)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                            selectedUser === email
                              ? 'bg-indigo-50 text-indigo-700 font-medium border border-indigo-200'
                              : 'hover:bg-gray-50 text-gray-700 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="truncate">{email.split('@')[0]}</span>
                            <span className="text-xs bg-gray-200 px-2 py-1 rounded ml-2">{userItems.length}</span>
                          </div>
                          <div className="flex gap-1 text-xs mt-1">
                            {pendingCount > 0 && (
                              <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                {pendingCount} pending
                              </span>
                            )}
                            {inProgressCount > 0 && (
                              <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">
                                {inProgressCount} active
                              </span>
                            )}
                            {blockedCount > 0 && (
                              <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                                {blockedCount} blocked
                              </span>
                            )}
                            {completedCount > 0 && (
                              <span className="bg-green-100 text-green-600 px-1.5 py-0.5 rounded">
                                {completedCount} done
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
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

export default ActionItemsPage;