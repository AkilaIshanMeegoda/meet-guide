/**
 * Meeting Pronunciation Analysis Web App
 * Displays user-wise mispronunciation errors with audio playback
 * Updated: 2026-01-05 - Fixed spoken_as to show actual mispronunciation
 */

class PronunciationApp {
    constructor() {
        this.meetingData = null;
        this.currentParticipant = null;
        this.participants = {};
        this.initElements();
        this.initEventListeners();
        this.loadMeetingList();
    }

    initElements() {
        // Selectors
        this.meetingSelect = document.getElementById('meetingSelect');
        this.loadMeetingBtn = document.getElementById('loadMeetingBtn');
        this.refreshBtn = document.getElementById('refreshBtn');
        
        // Sections
        this.summarySection = document.getElementById('summarySection');
        this.summaryCards = document.getElementById('summaryCards');
        this.participantsSection = document.getElementById('participantsSection');
        this.participantTabs = document.getElementById('participantTabs');
        this.mainContent = document.getElementById('mainContent');
        
        // Participant info
        this.participantName = document.getElementById('participantName');
        this.participantStats = document.getElementById('participantStats');
        this.participantAvatar = document.getElementById('participantAvatar');
        
        // Content panels
        this.transcriptPanel = document.getElementById('transcriptPanel');
        this.transcriptContent = document.getElementById('transcriptContent');
        this.mispronouncedPanel = document.getElementById('mispronouncedPanel');
        this.mispronouncedWordList = document.getElementById('mispronouncedWordList');
        this.mispronounceCount = document.getElementById('mispronounceCount');
        
        // Word detail elements
        this.detailPlaceholder = document.getElementById('detailPlaceholder');
        this.wordDetailCard = document.getElementById('wordDetailCard');
        this.detailCorrectWord = document.getElementById('detailCorrectWord');
        this.detailPhonemes = document.getElementById('detailPhonemes');
        this.detailListenBtn = document.getElementById('detailListenBtn');
        this.detailErrorType = document.getElementById('detailErrorType');
        this.detailSeverity = document.getElementById('detailSeverity');
        this.detailAccuracy = document.getElementById('detailAccuracy');
        this.detailTime = document.getElementById('detailTime');
        
        // Modal
        this.wordModal = document.getElementById('wordModal');
        this.modalClose = document.getElementById('modalClose');
        this.expectedWord = document.getElementById('expectedWord');
        this.expectedPhonemes = document.getElementById('expectedPhonemes');
        this.playExpected = document.getElementById('playExpected');
        this.errorType = document.getElementById('errorType');
        this.errorSeverity = document.getElementById('errorSeverity');
        this.errorAccuracy = document.getElementById('errorAccuracy');
        this.errorTime = document.getElementById('errorTime');
        
        // Loading
        this.loadingOverlay = document.getElementById('loadingOverlay');
        
        // Track current filter
        this.currentSeverityFilter = 'all';
    }

    initEventListeners() {
        // Load meeting button
        this.loadMeetingBtn.addEventListener('click', () => this.loadMeeting());
        
        // Refresh button
        this.refreshBtn.addEventListener('click', () => this.loadMeetingList());
        
        // Content tabs
        document.querySelectorAll('.content-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchContentTab(e.target));
        });
        
        // Severity filter buttons
        document.querySelectorAll('.severity-filter').forEach(btn => {
            btn.addEventListener('click', (e) => this.filterBySeverity(e.target.dataset.severity));
        });
        
        // Listen button in detail panel
        if (this.detailListenBtn) {
            this.detailListenBtn.addEventListener('click', () => {
                const word = this.detailCorrectWord.textContent;
                this.playWord(word);
            });
        }
        
        // Modal close
        this.modalClose.addEventListener('click', () => this.closeModal());
        this.wordModal.addEventListener('click', (e) => {
            if (e.target === this.wordModal) this.closeModal();
        });
        
        // Play button
        this.playExpected.addEventListener('click', () => this.playWord(this.expectedWord.textContent));
        
        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });
    }

    showLoading() {
        this.loadingOverlay.classList.add('active');
    }

    hideLoading() {
        this.loadingOverlay.classList.remove('active');
    }

    async loadMeetingList() {
        // Get available meetings from data folder
        // For now, we'll use a predefined list. In production, this would be an API call.
        const meetings = await this.scanMeetings();
        
        this.meetingSelect.innerHTML = '<option value="">-- Choose a meeting --</option>';
        meetings.forEach(meeting => {
            const option = document.createElement('option');
            option.value = meeting.folder;
            option.textContent = meeting.name;
            this.meetingSelect.appendChild(option);
        });
    }

    async scanMeetings() {
        // Try to load from config or scan directories
        // This simulates what would be returned from a backend
        try {
            const response = await fetch('/meetings.json');
            if (response.ok) {
                return await response.json();
            }
        } catch (e) {
            console.log('No meetings.json found, using defaults');
        }
        
        // Default meetings - adjust paths as needed
        return [
            { folder: 'meet6', name: 'Meeting 6' },
            { folder: 'test1', name: 'Test Meeting 1' },
            { folder: 'test3', name: 'Test Meeting 3' },
            { folder: 'lastmeeting3', name: 'Last Meeting 3' }
        ];
    }

    async loadMeeting() {
        const meetingFolder = this.meetingSelect.value;
        if (!meetingFolder) {
            alert('Please select a meeting first');
            return;
        }

        this.showLoading();
        
        try {
            // Load summary file - try both paths
            let summaryPath = `/${meetingFolder}/participant_transcripts/mispronunciation_summary.json`;
            let summaryResponse = await fetch(summaryPath);
            
            // Fallback to old path
            if (!summaryResponse.ok) {
                summaryPath = `/${meetingFolder}/output/participant_transcripts/mispronunciation_summary.json`;
                summaryResponse = await fetch(summaryPath);
            }
            
            if (!summaryResponse.ok) {
                throw new Error(`Summary file not found. Please run pronunciation detection first.\nExpected: ${summaryPath}`);
            }
            
            const summaryData = await summaryResponse.json();
            this.meetingData = summaryData;
            this.participants = {};
            
            // Determine base path
            const basePath = summaryPath.includes('/output/') 
                ? `/${meetingFolder}/output/participant_transcripts`
                : `/${meetingFolder}/participant_transcripts`;
            
            // Load individual participant data
            for (const [name, data] of Object.entries(summaryData.participants)) {
                if (data.status === 'success') {
                    try {
                        // Load mispronunciation details
                        const detailsPath = `${basePath}/${name}_mispronunciation.json`;
                        const detailsResponse = await fetch(detailsPath);
                        if (detailsResponse.ok) {
                            this.participants[name] = await detailsResponse.json();
                        }
                        
                        // Load transcript
                        const transcriptPath = `${basePath}/${name}.txt`;
                        const transcriptResponse = await fetch(transcriptPath);
                        if (transcriptResponse.ok) {
                            this.participants[name].rawTranscript = await transcriptResponse.text();
                        }
                    } catch (e) {
                        console.warn(`Could not load data for ${name}:`, e);
                    }
                }
            }
            
            this.displayMeetingData();
            
        } catch (error) {
            console.error('Error loading meeting:', error);
            alert(`Error loading meeting data:\n${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    displayMeetingData() {
        // Show sections
        this.summarySection.style.display = 'block';
        this.participantsSection.style.display = 'block';
        this.mainContent.style.display = 'block';
        
        // Calculate overall stats
        let totalWords = 0;
        let totalErrors = 0;
        let participantCount = 0;
        
        for (const [name, data] of Object.entries(this.meetingData.participants)) {
            if (data.status === 'success') {
                totalWords += data.total_words || 0;
                totalErrors += data.errors_detected || data.mispronounced || 0;
                participantCount++;
            }
        }
        
        const avgErrorRate = totalWords > 0 ? ((totalErrors / totalWords) * 100).toFixed(1) : 0;
        
        // Display summary cards
        this.summaryCards.innerHTML = `
            <div class="summary-card">
                <div class="card-icon users"><i class="fas fa-users"></i></div>
                <div class="card-value">${participantCount}</div>
                <div class="card-label">Participants</div>
            </div>
            <div class="summary-card">
                <div class="card-icon words"><i class="fas fa-font"></i></div>
                <div class="card-value">${totalWords.toLocaleString()}</div>
                <div class="card-label">Total Words</div>
            </div>
            <div class="summary-card">
                <div class="card-icon errors"><i class="fas fa-exclamation-circle"></i></div>
                <div class="card-value">${totalErrors}</div>
                <div class="card-label">Mispronunciations</div>
            </div>
            <div class="summary-card">
                <div class="card-icon rate"><i class="fas fa-percentage"></i></div>
                <div class="card-value">${avgErrorRate}%</div>
                <div class="card-label">Avg Error Rate</div>
            </div>
        `;
        
        // Display participant tabs
        this.participantTabs.innerHTML = '';
        for (const [name, data] of Object.entries(this.meetingData.participants)) {
            if (data.status === 'success') {
                const tab = document.createElement('button');
                tab.className = 'participant-tab';
                tab.dataset.participant = name;
                tab.innerHTML = `
                    <i class="fas fa-user"></i>
                    ${name}
                    <span class="error-badge">${data.errors_detected || data.mispronounced || 0}</span>
                `;
                tab.addEventListener('click', () => this.selectParticipant(name));
                this.participantTabs.appendChild(tab);
            }
        }
        
        // Select first participant
        const firstParticipant = Object.keys(this.participants)[0];
        if (firstParticipant) {
            this.selectParticipant(firstParticipant);
        }
    }

    selectParticipant(name) {
        this.currentParticipant = name;
        const data = this.participants[name];
        const summaryData = this.meetingData.participants[name];
        
        console.log('selectParticipant called:', name);
        console.log('Participant data:', data);
        
        if (!data) {
            console.error(`No data for participant: ${name}`);
            return;
        }
        
        // Update tab active state
        document.querySelectorAll('.participant-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.participant === name);
        });
        
        // Update participant info
        this.participantName.textContent = name;
        this.participantAvatar.innerHTML = `<span>${name.charAt(0).toUpperCase()}</span>`;
        
        const stats = data.statistics || data;
        const errorCount = stats.mispronounced_words || stats.errors_detected || 0;
        
        this.participantStats.innerHTML = `
            <div class="stat-item">
                <i class="fas fa-font"></i>
                <span>${stats.total_reference_words || stats.total_words || 0} words</span>
            </div>
            <div class="stat-item">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${errorCount} errors</span>
            </div>
            <div class="stat-item">
                <i class="fas fa-percentage"></i>
                <span>${stats.error_rate_percent || ((1 - (stats.accuracy || 0)) * 100).toFixed(1)}% error rate</span>
            </div>
        `;
        
        // Update mispronounce count badge
        this.mispronounceCount.textContent = errorCount;
        
        // Display transcript with highlighted errors
        this.displayTranscript(data);
        
        // Also prepare mispronounced words list (will be shown when tab is clicked)
        this.displayMispronouncedWordsList(data);
        
        // Reset detail panel
        this.detailPlaceholder.classList.remove('hidden');
        this.wordDetailCard.classList.add('hidden');
    }

    displayTranscript(data) {
        const transcript = data.transcription?.reference || data.rawTranscript || '';
        const errors = data.errors || data.mispronounced_words || [];
        
        // Create a map of mispronounced words by position
        const errorMap = new Map();
        errors.forEach(error => {
            errorMap.set(error.position, error);
        });
        
        // Parse transcript and highlight errors
        const words = transcript.split(/\s+/);
        let html = '<div class="transcript-sentence">';
        
        words.forEach((word, index) => {
            const error = errorMap.get(index);
            if (error) {
                const severityClass = error.severity || 'severe';
                html += `<span class="word mispronounced ${severityClass}" 
                              data-error='${JSON.stringify(error).replace(/'/g, "&#39;")}'
                              title="Click for details">${word}</span> `;
            } else {
                html += `<span class="word">${word}</span> `;
            }
        });
        
        html += '</div>';
        
        // If transcript is from raw file, format it better
        if (data.rawTranscript) {
            const lines = data.rawTranscript.split('\n').filter(l => 
                l.trim() && !l.startsWith('Speaker:') && !l.startsWith('===')
            );
            html = lines.map(line => `<div class="transcript-sentence">${this.highlightErrors(line, errors)}</div>`).join('');
        }
        
        this.transcriptContent.innerHTML = html;
        
        // Add click handlers for mispronounced words
        this.transcriptContent.querySelectorAll('.mispronounced').forEach(el => {
            el.addEventListener('click', () => {
                const error = JSON.parse(el.dataset.error);
                this.showWordDetails(error);
            });
        });
    }

    highlightErrors(text, errors) {
        // Create maps for error words - both original and transcribed versions
        const errorMap = new Map();
        const transcribedMap = new Map();  // For words that were "corrected" by ASR
        const multiWordPatterns = [];  // For multi-word patterns like "team line"
        
        errors.forEach(e => {
            // Store by lowercase word, cleaned of punctuation
            const cleanWord = e.word.toLowerCase().replace(/[^\w'-]/g, '');
            if (cleanWord) {
                errorMap.set(cleanWord, e);
            }
            
            // Also extract "Transcribed as 'X'" from context for confusables
            if (e.context && e.context.includes("Transcribed as '")) {
                const match = e.context.match(/Transcribed as '([^']+)'/);
                if (match) {
                    const transcribedWord = match[1].toLowerCase();
                    // Check if it's a multi-word pattern
                    if (transcribedWord.includes(' ')) {
                        multiWordPatterns.push({
                            pattern: transcribedWord,
                            error: e
                        });
                    } else {
                        const cleaned = transcribedWord.replace(/[^\w'-]/g, '');
                        if (cleaned) {
                            transcribedMap.set(cleaned, e);
                        }
                    }
                }
            }
        });
        
        // First, handle multi-word patterns by replacing in the full text
        let processedText = text;
        multiWordPatterns.forEach(({pattern, error}) => {
            const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            let severity = error.severity || 'severe';
            if (severity === 'low') severity = 'mild';
            else if (severity === 'medium') severity = 'moderate';
            else if (severity === 'high') severity = 'severe';
            
            processedText = processedText.replace(regex, (match) => {
                return `<span class="mispronounced ${severity}" 
                              data-error='${JSON.stringify(error).replace(/'/g, "&#39;")}'
                              title="Click for pronunciation details">${match}</span>`;
            });
        });
        
        // If we processed multi-word patterns, we might have already added spans
        // Now process individual words that weren't already in spans
        if (multiWordPatterns.length > 0) {
            // Return the processed text with multi-word highlights
            // Then process remaining single words
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = processedText;
            
            // Process text nodes only (not already-highlighted spans)
            const walkTextNodes = (node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    const words = node.textContent.split(/(\s+)/);
                    const newHtml = words.map(word => {
                        const cleanWord = word.toLowerCase().replace(/[^\w'-]/g, '');
                        let error = null;
                        if (cleanWord && errorMap.has(cleanWord)) {
                            error = errorMap.get(cleanWord);
                        } else if (cleanWord && transcribedMap.has(cleanWord)) {
                            error = transcribedMap.get(cleanWord);
                        }
                        
                        if (error) {
                            let severity = error.severity || 'severe';
                            if (severity === 'low') severity = 'mild';
                            else if (severity === 'medium') severity = 'moderate';
                            else if (severity === 'high') severity = 'severe';
                            
                            return `<span class="mispronounced ${severity}" 
                                          data-error='${JSON.stringify(error).replace(/'/g, "&#39;")}'
                                          title="Click for pronunciation details">${word}</span>`;
                        }
                        return word;
                    }).join('');
                    
                    const span = document.createElement('span');
                    span.innerHTML = newHtml;
                    node.parentNode.replaceChild(span, node);
                } else if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('mispronounced')) {
                    Array.from(node.childNodes).forEach(walkTextNodes);
                }
            };
            
            Array.from(tempDiv.childNodes).forEach(walkTextNodes);
            return tempDiv.innerHTML;
        }
        
        // Simple case: no multi-word patterns, just process words
        const words = text.split(/(\s+)/);
        
        return words.map(word => {
            const cleanWord = word.toLowerCase().replace(/[^\w'-]/g, '');
            
            let error = null;
            if (cleanWord && errorMap.has(cleanWord)) {
                error = errorMap.get(cleanWord);
            } else if (cleanWord && transcribedMap.has(cleanWord)) {
                error = transcribedMap.get(cleanWord);
            }
            
            if (error) {
                let severity = error.severity || 'severe';
                if (severity === 'low') severity = 'mild';
                else if (severity === 'medium') severity = 'moderate';
                else if (severity === 'high') severity = 'severe';
                
                return `<span class="mispronounced ${severity}" 
                              data-error='${JSON.stringify(error).replace(/'/g, "&#39;")}'
                              title="Click for pronunciation details">${word}</span>`;
            }
            return word;
        }).join('');
    }

    switchContentTab(tab) {
        // Get tab type
        const tabType = tab.dataset.tab;
        
        // Update tab states
        document.querySelectorAll('.content-tab').forEach(t => {
            t.classList.toggle('active', t === tab);
        });
        
        // Show/hide panels
        if (tabType === 'transcript') {
            this.transcriptPanel.classList.remove('hidden');
            this.mispronouncedPanel.classList.add('hidden');
        } else if (tabType === 'mispronounced') {
            this.transcriptPanel.classList.add('hidden');
            this.mispronouncedPanel.classList.remove('hidden');
            // Refresh the mispronounced list
            if (this.currentParticipant) {
                this.displayMispronouncedWordsList(this.participants[this.currentParticipant]);
            }
        }
    }

    displayMispronouncedWordsList(data) {
        const errors = data.errors || data.mispronounced_words || [];
        
        // Update count badge
        this.mispronounceCount.textContent = errors.length;
        
        // Reset detail view
        this.detailPlaceholder.classList.remove('hidden');
        this.wordDetailCard.classList.add('hidden');
        
        if (errors.length === 0) {
            this.mispronouncedWordList.innerHTML = `
                <div class="empty-word-list">
                    <i class="fas fa-check-circle"></i>
                    <p>No mispronunciations detected!</p>
                </div>
            `;
            return;
        }
        
        // Filter errors based on current filter
        let filteredErrors = errors;
        if (this.currentSeverityFilter !== 'all') {
            filteredErrors = errors.filter(e => {
                const severity = this.normalizeSeverity(e.severity);
                return severity === this.currentSeverityFilter;
            });
        }
        
        // Generate word list HTML
        let html = '';
        filteredErrors.forEach((error, index) => {
            const severity = this.normalizeSeverity(error.severity);
            const word = error.word || error.expected || '-';
            
            html += `
                <div class="word-list-item ${severity}" data-index="${index}" data-error='${JSON.stringify(error).replace(/'/g, "&#39;")}'>
                    <span class="word-text">${word}</span>
                    <span class="word-severity ${severity}">${severity}</span>
                </div>
            `;
        });
        
        this.mispronouncedWordList.innerHTML = html;
        
        // Add click handlers
        this.mispronouncedWordList.querySelectorAll('.word-list-item').forEach(item => {
            item.addEventListener('click', () => {
                // Remove active from all items
                this.mispronouncedWordList.querySelectorAll('.word-list-item').forEach(i => {
                    i.classList.remove('active');
                });
                // Add active to clicked item
                item.classList.add('active');
                
                const error = JSON.parse(item.dataset.error);
                this.showWordDetailPanel(error);
            });
        });
    }

    filterBySeverity(severity) {
        this.currentSeverityFilter = severity;
        
        // Update filter button states
        document.querySelectorAll('.severity-filter').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.severity === severity);
        });
        
        // Refresh list
        if (this.currentParticipant) {
            this.displayMispronouncedWordsList(this.participants[this.currentParticipant]);
        }
    }

    normalizeSeverity(severity) {
        if (!severity) return 'medium';
        const s = severity.toLowerCase();
        if (s === 'high' || s === 'severe') return 'high';
        if (s === 'medium' || s === 'moderate') return 'medium';
        if (s === 'low' || s === 'mild') return 'low';
        return 'medium';
    }

    showWordDetailPanel(error) {
        // Hide placeholder, show card
        this.detailPlaceholder.classList.add('hidden');
        this.wordDetailCard.classList.remove('hidden');
        
        const expected = error.expected || error.word || '-';
        const severity = this.normalizeSeverity(error.severity);
        const phonemes = error.expected_phonemes || [];
        
        // Update correct word
        this.detailCorrectWord.textContent = expected;
        
        // Update phonemes
        const phonemesStr = Array.isArray(phonemes) ? phonemes.join(' ') : (phonemes || '-');
        this.detailPhonemes.textContent = phonemesStr;
        
        // Update error info
        this.detailErrorType.textContent = error.error_type || 'pronunciation';
        this.detailSeverity.textContent = severity;
        
        // Set severity color
        this.detailSeverity.className = 'error-info-value';
        if (severity === 'severe' || severity === 'high') {
            this.detailSeverity.style.color = 'var(--danger-color)';
        } else if (severity === 'moderate' || severity === 'medium') {
            this.detailSeverity.style.color = 'var(--warning-color)';
        } else {
            this.detailSeverity.style.color = 'var(--success-color)';
        }
        
        // Update accuracy
        const accuracy = error.accuracy ? 
            `${(error.accuracy * 100).toFixed(1)}%` : 
            (error.confidence ? `${(error.confidence * 100).toFixed(1)}%` : '-');
        this.detailAccuracy.textContent = accuracy;
        
        // Update time
        const timeStr = error.start_time ? 
            `${error.start_time.toFixed(2)}s - ${error.end_time?.toFixed(2) || '?'}s` : 
            (error.time_start ? `${error.time_start.toFixed(2)}s - ${error.time_end?.toFixed(2) || '?'}s` : '-');
        this.detailTime.textContent = timeStr;
    }

    phonemesToReadable(phonemes) {
        if (!phonemes || !Array.isArray(phonemes) || phonemes.length === 0) {
            return '';
        }
        
        const mapping = {
            'AA': 'ah', 'AE': 'a', 'AH': 'uh', 'AO': 'aw', 'AW': 'ow',
            'AY': 'eye', 'B': 'b', 'CH': 'ch', 'D': 'd', 'DH': 'th',
            'EH': 'eh', 'ER': 'er', 'EY': 'ay', 'F': 'f', 'G': 'g',
            'HH': 'h', 'IH': 'ih', 'IY': 'ee', 'JH': 'j', 'K': 'k',
            'L': 'l', 'M': 'm', 'N': 'n', 'NG': 'ng', 'OW': 'oh',
            'OY': 'oy', 'P': 'p', 'R': 'r', 'S': 's', 'SH': 'sh',
            'T': 't', 'TH': 'th', 'UH': 'uh', 'UW': 'oo', 'V': 'v',
            'W': 'w', 'Y': 'y', 'Z': 'z', 'ZH': 'zh'
        };
        
        const readable = phonemes.map(p => {
            const base = p.replace(/[0-9]/g, '').toUpperCase();
            return mapping[base] || base.toLowerCase();
        });
        
        return readable.join('-');
    }

    showWordDetails(error) {
        // Extract expected info
        const expectedPhonemes = error.expected_phonemes || error.phonemes?.expected || [];
        
        this.expectedWord.textContent = error.expected || error.word || '-';
        this.expectedPhonemes.textContent = expectedPhonemes.join(' ') || '-';
        
        // Map severity for display
        let severity = error.severity || 'unknown';
        if (severity === 'low') severity = 'mild';
        else if (severity === 'medium') severity = 'moderate';
        else if (severity === 'high') severity = 'severe';
        
        this.errorType.textContent = error.error_type || error.mispronunciation_type || 'pronunciation';
        this.errorSeverity.textContent = severity;
        this.errorAccuracy.textContent = error.accuracy ? 
            `${(error.accuracy * 100).toFixed(1)}%` : 
            (error.phoneme_accuracy ? `${(error.phoneme_accuracy * 100).toFixed(1)}%` : '-');
        this.errorTime.textContent = error.start_time ? 
            `${error.start_time.toFixed(2)}s - ${error.end_time?.toFixed(2) || '?'}s` : 
            (error.time_start ? `${error.time_start.toFixed(2)}s - ${error.time_end?.toFixed(2) || '?'}s` : '-');
        
        this.wordModal.classList.add('active');
    }

    closeModal() {
        this.wordModal.classList.remove('active');
    }

    playWord(word) {
        if (!word || word === '-') return;
        
        // Use Web Speech API or Google Translate TTS
        // Option 1: Web Speech API (works offline)
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(word);
            utterance.lang = 'en-US';
            utterance.rate = 0.8; // Slightly slower for clarity
            speechSynthesis.speak(utterance);
            return;
        }
        
        // Option 2: Google Translate TTS (requires internet)
        const audio = new Audio(
            `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(word)}&tl=en&client=tw-ob`
        );
        audio.play().catch(err => {
            console.error('Could not play audio:', err);
            alert('Could not play pronunciation audio. Please try again.');
        });
    }
}

// Initialize app
const app = new PronunciationApp();
