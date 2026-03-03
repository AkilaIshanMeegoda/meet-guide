import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SlangDetection {
  sentence: string;
  slang_term?: string; // Newer format
  detected_slang?: string[]; // Older format
  detection_method?: string;
  confidence_score?: number; // Newer format
  confidence?: number; // Older format
  severity_weight?: number;
  type?: string;
}

interface PenaltiesBreakdown {
  total_penalty_applied?: number;
}

interface UserInfo {
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface HybridDetectionResult {
  _id: string;
  user_id?: UserInfo | string; // Can be object or string
  user_name?: string; // Older format
  meeting_id: string;
  professional_score: number;
  score_label?: string;
  total_slang_count?: number;
  unique_slang_terms?: string[];
  slang_detections?: SlangDetection[];
  penalties_breakdown?: PenaltiesBreakdown; // Newer format
  confidence_penalty?: number; // Older format
  frequency_penalty?: number; // Older format
  severity_penalty?: number; // Older format
  repetition_penalty?: number; // Older format
  processed_at?: string;
}

export const generatePDF = (results: HybridDetectionResult[], meetingId: string) => {
  const doc = new jsPDF();
  let yPosition = 20;

  // Helper function to add text with word wrapping
  const addText = (text: string, x: number, y: number, maxWidth?: number) => {
    if (maxWidth) {
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, x, y);
      return y + (lines.length * 7);
    } else {
      doc.text(text, x, y);
      return y + 7;
    }
  };

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Professional Score Report', 105, yPosition, { align: 'center' });
  yPosition += 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Meeting ID: ${meetingId}`, 105, yPosition, { align: 'center' });
  yPosition += 10;

  // Average Score
  const averageScore = results.length > 0 
    ? Math.round(results.reduce((sum, r) => sum + r.professional_score, 0) / results.length)
    : 0;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Average Professionalism Score: ${averageScore}%`, 105, yPosition, { align: 'center' });
  yPosition += 15;

  // Each Participant
  results.forEach((result, index) => {
    // Check if we need a new page
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    // Handle both user_name (string) and user_id (object) formats
    let participantName = 'Unknown';
    if (result.user_name) {
      participantName = result.user_name;
    } else if (result.user_id) {
      if (typeof result.user_id === 'object') {
        participantName = `${result.user_id.firstName || ''} ${result.user_id.lastName || ''}`.trim() 
          || result.user_id.email 
          || 'Unknown';
      } else {
        participantName = result.user_id;
      }
    }

    // Participant Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 240, 240);
    doc.rect(10, yPosition - 5, 190, 12, 'F');
    doc.text(`${index + 1}. ${participantName}`, 15, yPosition + 3);
    yPosition += 15;

    // Score
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Professional Score: ${result.professional_score}%`, 15, yPosition);
    yPosition += 7;

    if (result.score_label) {
      doc.text(`Score Label: ${result.score_label}`, 15, yPosition);
      yPosition += 7;
    }

    // Statistics
    doc.text(`Total Slang Count: ${result.total_slang_count || 0}`, 15, yPosition);
    yPosition += 7;

    doc.text(`Unique Slang Terms: ${result.unique_slang_terms?.length || 0}`, 15, yPosition);
    yPosition += 7;

    // Calculate total penalties from individual penalty fields
    const totalPenalty = (
      (result.confidence_penalty || 0) + 
      (result.frequency_penalty || 0) + 
      (result.severity_penalty || 0) + 
      (result.repetition_penalty || 0)
    ).toFixed(2);
    doc.text(`Total Penalties: ${totalPenalty}`, 15, yPosition);
    yPosition += 10;

    // Unique Slang Terms List
    if (result.unique_slang_terms && result.unique_slang_terms.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Slang Terms Used:', 15, yPosition);
      yPosition += 7;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const termsText = result.unique_slang_terms.join(', ');
      yPosition = addText(termsText, 15, yPosition, 180);
      yPosition += 5;
      doc.setFontSize(12);
    }

    // Flagged Instances
    if (result.slang_detections && result.slang_detections.length > 0) {
      // Check if we need a new page for the table
      if (yPosition > 200) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.text('Flagged Slang Instances:', 15, yPosition);
      yPosition += 7;

      // Create table data
      const tableData = result.slang_detections.map((detection) => {
        // Handle both detected_slang (array) and slang_term (string) formats
        const slangTerms = detection.detected_slang || [detection.slang_term];
        const slangText = slangTerms.filter(Boolean).join(', ');
        
        // Handle both confidence and confidence_score
        const confidence = detection.confidence || detection.confidence_score;
        const confidenceText = confidence ? `${(confidence * 100).toFixed(1)}%` : 'N/A';
        
        return [
          detection.sentence.substring(0, 60) + (detection.sentence.length > 60 ? '...' : ''),
          slangText,
          detection.detection_method || 'N/A',
          confidenceText
        ];
      });

      autoTable(doc, {
        startY: yPosition,
        head: [['Sentence', 'Slang Term', 'Method', 'Confidence']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [100, 100, 100] },
        margin: { left: 15, right: 15 },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 40 },
          2: { cellWidth: 35 },
          3: { cellWidth: 25 }
        }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;
    }

    yPosition += 5;
  });

  // Footer on last page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150);
    doc.text(
      `Generated on ${new Date().toLocaleDateString()} | Page ${i} of ${pageCount}`,
      105,
      285,
      { align: 'center' }
    );
  }

  // Save the PDF
  const fileName = `Professional_Score_Report_${meetingId}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};

// Intent Highlights Report Generator
interface IntentHighlightsData {
  meeting_id: string;
  meeting_title: string;
  meeting_date: string;
  total_utterances: number;
  topics: Array<{
    topic_id: number;
    label: string;
    utterances: Array<{
      speaker: string;
      sentence: string;
      intent: string;
    }>;
  }>;
  intent_counts: {
    'action-item'?: number;
    'decision'?: number;
    'question'?: number;
    'concern'?: number;
    'inform'?: number;
  };
}

export const generateIntentHighlightsReport = (data: IntentHighlightsData) => {
  const doc = new jsPDF();
  let yPosition = 20;

  const PRIMARY_COLOR = [79, 70, 229] as [number, number, number]; // Indigo-600
  const TEXT_DARK = [31, 41, 55] as [number, number, number]; // Gray-800
  const TEXT_MEDIUM = [107, 114, 128] as [number, number, number]; // Gray-500
  const TEXT_LIGHT = [156, 163, 175] as [number, number, number]; // Gray-400

  const checkNewPage = (requiredSpace: number = 40) => {
    if (yPosition > 270 - requiredSpace) {
      doc.addPage();
      yPosition = 20;
      return true;
    }
    return false;
  };

  // ========== HEADER ==========
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.text('Intent Highlights Report', 105, yPosition, { align: 'center' });
  yPosition += 12;

  // Meeting Information
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.text(data.meeting_title, 105, yPosition, { align: 'center' });
  yPosition += 6;

  doc.setFontSize(10);
  doc.setTextColor(TEXT_MEDIUM[0], TEXT_MEDIUM[1], TEXT_MEDIUM[2]);
  doc.text(new Date(data.meeting_date).toLocaleDateString('en-US', { 
    year: 'numeric', month: 'long', day: 'numeric' 
  }), 105, yPosition, { align: 'center' });
  yPosition += 15;

  // Separator line
  doc.setDrawColor(220, 220, 225);
  doc.setLineWidth(0.5);
  doc.line(15, yPosition, 195, yPosition);
  yPosition += 15;

  // ========== SUMMARY STATS ==========
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.text('Meeting Summary', 15, yPosition);
  yPosition += 10;

  const totalIntents = Object.values(data.intent_counts).reduce((sum, count) => sum + (count || 0), 0);

  // Summary boxes
  const summaryBoxes = [
    { label: 'Total Utterances', value: data.total_utterances.toString() },
    { label: 'Topics Discussed', value: data.topics.length.toString() },
    { label: 'Key Moments', value: totalIntents.toString() }
  ];

  summaryBoxes.forEach((box, index) => {
    const x = 15 + (index * 60);
    
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(x, yPosition, 58, 22, 2, 2, 'F');
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(x, yPosition, 58, 22, 2, 2);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_MEDIUM[0], TEXT_MEDIUM[1], TEXT_MEDIUM[2]);
    doc.text(box.label, x + 29, yPosition + 7, { align: 'center' });

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.text(box.value, x + 29, yPosition + 17, { align: 'center' });
  });

  yPosition += 30;

  // ========== INTENT BREAKDOWN ==========
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.text('Intent Breakdown', 15, yPosition);
  yPosition += 8;

  const intentData = [
    { label: 'Action Items', count: data.intent_counts['action-item'] || 0, color: [249, 115, 22] },
    { label: 'Decisions', count: data.intent_counts['decision'] || 0, color: [34, 197, 94] },
    { label: 'Questions', count: data.intent_counts['question'] || 0, color: [239, 68, 68] },
    { label: 'Concerns', count: data.intent_counts['concern'] || 0, color: [234, 179, 8] },
    { label: 'Information', count: data.intent_counts['inform'] || 0, color: [59, 130, 246] }
  ];

  const maxCount = Math.max(...intentData.map(d => d.count), 1);
  const chartWidth = 120;

  intentData.forEach((item, index) => {
    const barWidth = (item.count / maxCount) * chartWidth;
    const barY = yPosition + (index * 11);
    const percentage = totalIntents > 0 ? Math.round((item.count / totalIntents) * 100) : 0;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
    doc.text(item.label, 15, barY + 6);

    // Background bar
    doc.setFillColor(240, 240, 242);
    doc.roundedRect(65, barY, chartWidth, 8, 1, 1, 'F');
    
    // Colored bar
    if (barWidth > 0) {
      doc.setFillColor(item.color[0], item.color[1], item.color[2]);
      doc.roundedRect(65, barY, barWidth, 8, 1, 1, 'F');
    }

    // Count and percentage
    doc.setFont('helvetica', 'bold');
    doc.text(`${item.count} (${percentage}%)`, 188, barY + 6);
  });

  yPosition += 62;

  // ========== TOPICS ==========
  checkNewPage(40);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.text('Topics Discussed', 15, yPosition);
  yPosition += 10;

  data.topics.forEach((topic, index) => {
    checkNewPage(50);

    // Topic header
    doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.roundedRect(15, yPosition, 180, 9, 1.5, 1.5, 'F');
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`${index + 1}. ${topic.label}`, 20, yPosition + 6);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`${topic.utterances.length} utterances`, 175, yPosition + 6, { align: 'right' });
    yPosition += 12;

    // Sample utterances (top 8)
    const sampleUtterances = topic.utterances.slice(0, 8).map(utt => [
      utt.speaker || 'Unknown',
      utt.intent.charAt(0).toUpperCase() + utt.intent.slice(1).replace('-', ' '),
      utt.sentence.substring(0, 90) + (utt.sentence.length > 90 ? '...' : '')
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['Speaker', 'Intent', 'Statement']],
      body: sampleUtterances,
      theme: 'plain',
      headStyles: { 
        fillColor: [249, 250, 251],
        textColor: [75, 85, 99],
        fontSize: 8,
        fontStyle: 'bold',
        cellPadding: 2
      },
      styles: { 
        fontSize: 8, 
        cellPadding: 2,
        lineColor: [229, 231, 235],
        lineWidth: 0.1
      },
      columnStyles: {
        0: { cellWidth: 30, fontStyle: 'bold' },
        1: { cellWidth: 28 },
        2: { cellWidth: 122 }
      }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 8;
  });

  // ========== FOOTER ==========
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_LIGHT[0], TEXT_LIGHT[1], TEXT_LIGHT[2]);
    
    doc.text('MeetGuide', 15, 285);
    doc.text(new Date().toLocaleDateString('en-US'), 105, 285, { align: 'center' });
    doc.text(`Page ${i} of ${pageCount}`, 195, 285, { align: 'right' });
  }

  const fileName = `Intent_Highlights_${data.meeting_id}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};

// Action Items Report Generator
interface ActionItemData {
  _id: string;
  task: string;
  sentence: string;
  assignee: string;
  assignee_email: string;
  assignee_emails?: string[];
  deadline?: string;
  priority: string;
  status: string;
  meeting_title: string;
  meeting_date: string;
  topic_label?: string;
  meeting_id: string;
}

export const generateActionItemsReport = (actionItems: ActionItemData[], meetingTitle: string, meetingDate: string, meetingId: string) => {
  const doc = new jsPDF();
  let yPosition = 20;

  const PRIMARY_COLOR = [99, 102, 241] as [number, number, number]; // Indigo-500
  const TEXT_DARK = [31, 41, 55] as [number, number, number]; // Gray-800
  const TEXT_MEDIUM = [107, 114, 128] as [number, number, number]; // Gray-500
  const TEXT_LIGHT = [156, 163, 175] as [number, number, number]; // Gray-400
  
  const HIGH_PRIORITY = [239, 68, 68] as [number, number, number]; // Red
  const MEDIUM_PRIORITY = [251, 146, 60] as [number, number, number]; // Orange
  const LOW_PRIORITY = [34, 197, 94] as [number, number, number]; // Green

  const checkNewPage = (requiredSpace: number = 40) => {
    if (yPosition > 270 - requiredSpace) {
      doc.addPage();
      yPosition = 20;
      return true;
    }
    return false;
  };

  // Sort by priority
  const sortedItems = [...actionItems].sort((a, b) => {
    const priorityOrder: { [key: string]: number } = { high: 1, medium: 2, low: 3 };
    return (priorityOrder[a.priority?.toLowerCase()] || 2) - (priorityOrder[b.priority?.toLowerCase()] || 2);
  });

  // ========== HEADER ==========
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.text('Action Items Report', 105, yPosition, { align: 'center' });
  yPosition += 12;

  // Meeting Information
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.text(meetingTitle, 105, yPosition, { align: 'center' });
  yPosition += 6;

  doc.setFontSize(10);
  doc.setTextColor(TEXT_MEDIUM[0], TEXT_MEDIUM[1], TEXT_MEDIUM[2]);
  doc.text(new Date(meetingDate).toLocaleDateString('en-US', { 
    year: 'numeric', month: 'long', day: 'numeric' 
  }), 105, yPosition, { align: 'center' });
  yPosition += 15;

  // Separator line
  doc.setDrawColor(220, 220, 225);
  doc.setLineWidth(0.5);
  doc.line(15, yPosition, 195, yPosition);
  yPosition += 15;

  // ========== SUMMARY STATS ==========
  const statusCounts = {
    pending: actionItems.filter(i => i.status === 'pending').length,
    'in-progress': actionItems.filter(i => i.status === 'in-progress').length,
    completed: actionItems.filter(i => i.status === 'completed').length,
    blocked: actionItems.filter(i => i.status === 'blocked').length
  };

  const priorityCounts = {
    high: actionItems.filter(i => i.priority?.toLowerCase() === 'high').length,
    medium: actionItems.filter(i => i.priority?.toLowerCase() === 'medium').length,
    low: actionItems.filter(i => i.priority?.toLowerCase() === 'low').length
  };

  const completionRate = actionItems.length > 0 ? Math.round((statusCounts.completed / actionItems.length) * 100) : 0;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.text('Overview', 15, yPosition);
  yPosition += 10;

  // Overview boxes
  const overviewBoxes = [
    { label: 'Total Items', value: actionItems.length.toString(), color: PRIMARY_COLOR },
    { label: 'Completed', value: statusCounts.completed.toString(), color: LOW_PRIORITY },
    { label: 'In Progress', value: statusCounts['in-progress'].toString(), color: [59, 130, 246] },
    { label: 'High Priority', value: priorityCounts.high.toString(), color: HIGH_PRIORITY }
  ];

  overviewBoxes.forEach((box, index) => {
    const x = 15 + (index * 45);
    
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(x, yPosition, 43, 22, 2, 2, 'F');
    doc.setDrawColor(box.color[0], box.color[1], box.color[2]);
    doc.setLineWidth(0.8);
    doc.roundedRect(x, yPosition, 43, 22, 2, 2);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_MEDIUM[0], TEXT_MEDIUM[1], TEXT_MEDIUM[2]);
    doc.text(box.label, x + 21.5, yPosition + 7, { align: 'center' });

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(box.color[0], box.color[1], box.color[2]);
    doc.text(box.value, x + 21.5, yPosition + 17, { align: 'center' });
  });

  yPosition += 30;

  // ========== COMPLETION PROGRESS ==========
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.text('Completion Progress', 15, yPosition);
  
  doc.setFontSize(14);
  doc.setTextColor(LOW_PRIORITY[0], LOW_PRIORITY[1], LOW_PRIORITY[2]);
  doc.text(`${completionRate}%`, 175, yPosition, { align: 'right' });
  yPosition += 8;

  const progressBarWidth = 180;
  const completedWidth = (completionRate / 100) * progressBarWidth;

  doc.setFillColor(240, 240, 242);
  doc.roundedRect(15, yPosition, progressBarWidth, 10, 2, 2, 'F');
  
  if (completedWidth > 0) {
    doc.setFillColor(LOW_PRIORITY[0], LOW_PRIORITY[1], LOW_PRIORITY[2]);
    doc.roundedRect(15, yPosition, completedWidth, 10, 2, 2, 'F');
  }

  yPosition += 20;

  // ========== HIGH PRIORITY ITEMS ==========
  const highPriorityItems = sortedItems.filter(i => i.priority?.toLowerCase() === 'high');
  if (highPriorityItems.length > 0) {
    checkNewPage(50);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(HIGH_PRIORITY[0], HIGH_PRIORITY[1], HIGH_PRIORITY[2]);
    doc.text('HIGH PRIORITY ITEMS', 15, yPosition);
    yPosition += 10;

    highPriorityItems.forEach((item, index) => {
      checkNewPage(20);
      
      doc.setFillColor(254, 242, 242);
      doc.roundedRect(15, yPosition, 180, 16, 2, 2, 'F');
      doc.setDrawColor(HIGH_PRIORITY[0], HIGH_PRIORITY[1], HIGH_PRIORITY[2]);
      doc.setLineWidth(0.3);
      doc.roundedRect(15, yPosition, 180, 16, 2, 2);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
      const taskText = `${index + 1}. ${item.task.substring(0, 80)}${item.task.length > 80 ? '...' : ''}`;
      doc.text(taskText, 20, yPosition + 6);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(TEXT_MEDIUM[0], TEXT_MEDIUM[1], TEXT_MEDIUM[2]);
      const details = `${item.assignee} • ${item.status.replace('-', ' ')}${item.deadline ? ' • Due: ' + item.deadline : ''}`;
      doc.text(details, 20, yPosition + 12);

      yPosition += 20;
    });

    yPosition += 5;
  }

  // ========== ALL ACTION ITEMS BY ASSIGNEE ==========
  checkNewPage(40);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.text('All Action Items', 15, yPosition);
  yPosition += 10;

  // Group by assignee
  const itemsByAssignee: { [key: string]: ActionItemData[] } = {};
  sortedItems.forEach(item => {
    const assignee = item.assignee || 'Unassigned';
    if (!itemsByAssignee[assignee]) {
      itemsByAssignee[assignee] = [];
    }
    itemsByAssignee[assignee].push(item);
  });

  Object.entries(itemsByAssignee).forEach(([assignee, items]) => {
    checkNewPage(45);

    // Assignee header
    doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.roundedRect(15, yPosition, 180, 9, 1.5, 1.5, 'F');
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(assignee, 20, yPosition + 6);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`${items.length} item${items.length !== 1 ? 's' : ''}`, 175, yPosition + 6, { align: 'right' });
    yPosition += 11;

    // Create table
    const itemData = items.map(item => {
      let prioritySymbol = '[M]';
      if (item.priority?.toLowerCase() === 'high') prioritySymbol = '[H]';
      else if (item.priority?.toLowerCase() === 'low') prioritySymbol = '[L]';

      return [
        item.task.substring(0, 75) + (item.task.length > 75 ? '...' : ''),
        prioritySymbol + ' ' + (item.priority?.charAt(0).toUpperCase() + item.priority?.slice(1) || 'Medium'),
        item.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        item.deadline || '-'
      ];
    });

    autoTable(doc, {
      startY: yPosition,
      head: [['Task', 'Priority', 'Status', 'Deadline']],
      body: itemData,
      theme: 'plain',
      headStyles: { 
        fillColor: [249, 250, 251],
        textColor: [75, 85, 99],
        fontSize: 8,
        fontStyle: 'bold',
        cellPadding: 2
      },
      styles: { 
        fontSize: 8, 
        cellPadding: 2.5,
        lineColor: [229, 231, 235],
        lineWidth: 0.1
      },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 28, halign: 'center' },
        2: { cellWidth: 28, halign: 'center' },
        3: { cellWidth: 24, halign: 'center' }
      },
      didParseCell: (data) => {
        if (data.column.index === 1 && data.section === 'body') {
          const cellText = data.cell.text[0];
          if (cellText.includes('[H]') || cellText.toLowerCase().includes('high')) {
            data.cell.styles.textColor = HIGH_PRIORITY;
            data.cell.styles.fontStyle = 'bold';
          } else if (cellText.toLowerCase().includes('medium')) {
            data.cell.styles.textColor = MEDIUM_PRIORITY;
          } else {
            data.cell.styles.textColor = LOW_PRIORITY;
          }
        }
        if (data.column.index === 2 && data.section === 'body') {
          const cellText = data.cell.text[0].toLowerCase();
          if (cellText.includes('completed')) {
            data.cell.styles.textColor = LOW_PRIORITY;
            data.cell.styles.fontStyle = 'bold';
          } else if (cellText.includes('progress')) {
            data.cell.styles.textColor = [59, 130, 246] as [number, number, number];
          } else if (cellText.includes('blocked')) {
            data.cell.styles.textColor = HIGH_PRIORITY;
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 10;
  });

  // ========== FOOTER ==========
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_LIGHT[0], TEXT_LIGHT[1], TEXT_LIGHT[2]);
    
    doc.text('MeetGuide', 15, 285);
    doc.text(new Date().toLocaleDateString('en-US'), 105, 285, { align: 'center' });
    doc.text(`Page ${i} of ${pageCount}`, 195, 285, { align: 'right' });
  }

  const fileName = `Action_Items_${meetingId}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};

export interface CultureAnalysisExportData {
  meetingId: string;
  meetingTitle?: string;
  analyzedAt?: string | null;
  analysis: {
    meeting_summary: string;
    cultural_strengths: string[];
    cultural_risks: string[];
    core_cultural_problem: string;
    core_problem_evidence: string[];
    problem_chain_explanation: string;
    recommendations_for_management: string[];
    evidence_notes: string[];
    limitations: string;
  };
}

export interface TrendAnalyticsExportData {
  analysis_window: {
    start_date: string;
    end_date: string;
    meeting_count: number;
    label: string;
  };
  analysis: {
    overall_trend_summary: string;
    dimension_trends: {
      [key: string]: {
        trend: string;
        summary: string;
        confidence: string;
        top_signals: string[];
      };
    };
    recurring_strengths: string[];
    recurring_risks: string[];
    recommendations_for_management: string[];
    limitations?: string;
  };
}

export const generateCultureAnalysisReport = (data: CultureAnalysisExportData) => {
  const doc = new jsPDF();
  let yPosition = 20;

  const ensurePageSpace = (requiredSpace: number = 40) => {
    if (yPosition > 270 - requiredSpace) {
      doc.addPage();
      yPosition = 20;
    }
  };

  const addParagraph = (title: string, content: string) => {
    if (!content?.trim()) return;
    ensurePageSpace(30);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text(title, 15, yPosition);
    yPosition += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    const lines = doc.splitTextToSize(content, 180);
    doc.text(lines, 15, yPosition);
    yPosition += lines.length * 5 + 5;
  };

  const addBulletSection = (title: string, items: string[]) => {
    if (!items?.length) return;
    ensurePageSpace(35);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text(title, 15, yPosition);
    yPosition += 6;

    autoTable(doc, {
      startY: yPosition,
      head: [['#', 'Detail']],
      body: items.map((item, index) => [String(index + 1), item]),
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229], fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 3, textColor: [31, 41, 55] },
      margin: { left: 15, right: 15 },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 168 }
      }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 6;
  };

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text('Meeting Cultural Analysis Report', 105, yPosition, { align: 'center' });
  yPosition += 12;

  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(229, 231, 235);
  doc.rect(15, yPosition - 4, 180, 24, 'FD');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(75, 85, 99);
  doc.text('Meeting ID:', 20, yPosition + 3);
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.text(data.meetingId, 45, yPosition + 3);

  if (data.meetingTitle) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(75, 85, 99);
    doc.text('Meeting Title:', 20, yPosition + 10);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text(data.meetingTitle.substring(0, 70), 45, yPosition + 10);
  }

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(75, 85, 99);
  doc.text('Analyzed At:', 20, yPosition + 17);
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.text(
    data.analyzedAt ? new Date(data.analyzedAt).toLocaleString() : 'N/A',
    45,
    yPosition + 17,
  );

  yPosition += 30;

  addParagraph('Meeting Summary', data.analysis.meeting_summary);
  addBulletSection('Cultural Strengths', data.analysis.cultural_strengths);
  addBulletSection('Cultural Risks', data.analysis.cultural_risks);
  addParagraph('Core Cultural Problem', data.analysis.core_cultural_problem);
  addBulletSection('Core Cultural Evidence', data.analysis.core_problem_evidence);
  addParagraph('Problem Chain Explanation', data.analysis.problem_chain_explanation);
  addBulletSection('Recommendations for Management', data.analysis.recommendations_for_management);
  addBulletSection('Evidence Notes', data.analysis.evidence_notes);
  addParagraph('Limitations', data.analysis.limitations);

  const pageCount = doc.getNumberOfPages();
  const generatedOn = new Date().toLocaleDateString();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      `MeetGuide Cultural Analysis Report | Generated on ${generatedOn} | Page ${i} of ${pageCount}`,
      105,
      285,
      { align: 'center' }
    );
  }

  doc.save(`Cultural_Analysis_${data.meetingId}_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const generateTrendAnalyticsReport = (data: TrendAnalyticsExportData) => {
  const doc = new jsPDF();
  let yPosition = 20;

  const ensurePageSpace = (requiredSpace: number = 40) => {
    if (yPosition > 270 - requiredSpace) {
      doc.addPage();
      yPosition = 20;
    }
  };

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text('Cultural Trend Analytics Report', 105, yPosition, { align: 'center' });
  yPosition += 12;

  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(229, 231, 235);
  doc.rect(15, yPosition - 4, 180, 20, 'FD');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(75, 85, 99);
  doc.text('Analysis Window:', 20, yPosition + 3);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text(
    `${new Date(data.analysis_window.start_date).toLocaleDateString()} - ${new Date(data.analysis_window.end_date).toLocaleDateString()}`,
    55,
    yPosition + 3
  );

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(75, 85, 99);
  doc.text('Meetings Included:', 20, yPosition + 10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text(String(data.analysis_window.meeting_count), 55, yPosition + 10);

  yPosition += 26;

  ensurePageSpace(40);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text('Overall Trend Summary', 15, yPosition);
  yPosition += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  const summaryLines = doc.splitTextToSize(data.analysis.overall_trend_summary || 'N/A', 180);
  doc.text(summaryLines, 15, yPosition);
  yPosition += summaryLines.length * 5 + 6;

  ensurePageSpace(50);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text('Dimension Trends', 15, yPosition);
  yPosition += 6;

  const dimensionRows = Object.entries(data.analysis.dimension_trends || {}).map(
    ([name, trendData]) => [
      name.replace(/_/g, ' '),
      trendData.trend || 'unknown',
      trendData.confidence || 'N/A',
      trendData.summary || 'N/A',
      (trendData.top_signals || []).slice(0, 3).join(' | ') || 'N/A'
    ]
  );

  autoTable(doc, {
    startY: yPosition,
    head: [['Dimension', 'Trend', 'Confidence', 'Summary', 'Top Signals']],
    body: dimensionRows,
    theme: 'striped',
    headStyles: { fillColor: [79, 70, 229], fontSize: 9 },
    styles: { fontSize: 8.5, cellPadding: 3, textColor: [31, 41, 55] },
    margin: { left: 15, right: 15 },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 20 },
      2: { cellWidth: 24 },
      3: { cellWidth: 55 },
      4: { cellWidth: 53 }
    }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 8;

  const addListSection = (title: string, items: string[]) => {
    if (!items?.length) return;
    ensurePageSpace(35);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text(title, 15, yPosition);
    yPosition += 6;

    autoTable(doc, {
      startY: yPosition,
      head: [['#', 'Detail']],
      body: items.map((item, index) => [String(index + 1), item]),
      theme: 'striped',
      headStyles: { fillColor: [99, 102, 241], fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 3, textColor: [31, 41, 55] },
      margin: { left: 15, right: 15 },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 168 }
      }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 6;
  };

  addListSection('Management Recommendations', data.analysis.recommendations_for_management || []);
  addListSection('Recurring Strengths', data.analysis.recurring_strengths || []);
  addListSection('Recurring Risks', data.analysis.recurring_risks || []);

  if (data.analysis.limitations) {
    ensurePageSpace(25);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(146, 64, 14);
    doc.text('Limitations', 15, yPosition);
    yPosition += 6;

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 53, 15);
    const limitationLines = doc.splitTextToSize(data.analysis.limitations, 180);
    doc.text(limitationLines, 15, yPosition);
    yPosition += limitationLines.length * 5 + 4;
  }

  const pageCount = doc.getNumberOfPages();
  const generatedOn = new Date().toLocaleDateString();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      `MeetGuide Trend Analytics Report | Generated on ${generatedOn} | Page ${i} of ${pageCount}`,
      105,
      285,
      { align: 'center' }
    );
  }

  doc.save(`Trend_Analytics_${new Date().toISOString().split('T')[0]}.pdf`);
};
