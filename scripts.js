/**
 * AI Content Analysis Platform - Professional JavaScript
 * Enterprise-grade client-side application logic
 */

// Configuration
const CONFIG = {
    API_ENDPOINT: 'http://127.0.0.1:8000/predict',
    MIN_TEXT_LENGTH: 5,
    DEBOUNCE_DELAY: 300
};

// DOM Elements
const elements = {
    textInput: document.getElementById('text-input'),
    analyzeBtn: document.getElementById('analyze-btn'),
    clearBtn: document.getElementById('clear-btn'),
    charCount: document.getElementById('char-count'),
    wordCount: document.getElementById('word-count'),
    form: document.getElementById('analysis-form'),
    
    // State containers
    initialState: document.querySelector('.initial-state'),
    loadingState: document.querySelector('.loading-state'),
    resultContent: document.querySelector('.result-content'),
    
    // Result elements
    statusBadge: document.getElementById('status-badge'),
    scoreToxicity: document.getElementById('score-toxicity'),
    scoreOffensive: document.getElementById('score-offensive'),
    labelPredicted: document.getElementById('label-predicted'),
    languageDetected: document.getElementById('language-detected'),
    confidenceInfo: document.getElementById('confidence-info')
};

// Application State
const appState = {
    isAnalyzing: false,
    lastAnalysis: null,
    currentText: ''
};

/**
 * Utility Functions
 */
const utils = {
    // Debounce function for input handling
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Count words in text
    countWords(text) {
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    },

    // Sanitize text for display
    sanitizeText(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Format percentage
    formatPercentage(value) {
        return `${(value * 100).toFixed(1)}%`;
    }
};

/**
 * UI State Management
 */
const ui = {
    setState(stateName) {
        // Hide all states
        Object.values(elements).forEach(el => {
            if (el && el.classList && el.classList.contains('state')) {
                el.style.display = 'none';
            }
        });

        // Show specific state
        const stateMap = {
            initial: elements.initialState,
            loading: elements.loadingState,
            result: elements.resultContent
        };

        if (stateMap[stateName]) {
            stateMap[stateName].style.display = 'block';
        }
    },

    updateCounts() {
        const text = elements.textInput.value;
        const charCount = text.length;
        const wordCount = utils.countWords(text);
        
        elements.charCount.textContent = `${charCount} characters`;
        elements.wordCount.textContent = `${wordCount} words`;
        
        // Update button state
        const isValidLength = charCount >= CONFIG.MIN_TEXT_LENGTH;
        elements.analyzeBtn.disabled = !isValidLength || appState.isAnalyzing;
        
        appState.currentText = text;
        
        // Show initial state if text is entered but not analyzed
        if (charCount > 0 && !appState.isAnalyzing) {
            this.setState('initial');
        }
    },

    showError(message) {
        elements.statusBadge.className = 'status-badge status-danger';
        elements.statusBadge.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Error: ${message}`;
        
        elements.scoreToxicity.textContent = 'N/A';
        elements.scoreOffensive.textContent = 'N/A';
        elements.labelPredicted.textContent = 'Error';
        elements.languageDetected.textContent = 'Unknown';
        elements.confidenceInfo.textContent = 'Analysis failed. Please try again.';
        
        this.setState('result');
    },

    displayResults(result) {
        const label = result.label ? result.label.toLowerCase() : 'unknown';
        const scores = result.scores || {};
        
        // Determine status
        let statusConfig;
        if (label === 'toxic' || scores.toxic > 0.7) {
            statusConfig = {
                class: 'status-danger',
                icon: 'fas fa-exclamation-triangle',
                text: 'High Risk Content Detected'
            };
        } else if (label === 'offensive' || scores.offensive > 0.5) {
            statusConfig = {
                class: 'status-warning',
                icon: 'fas fa-exclamation-circle',
                text: 'Potentially Offensive Content'
            };
        } else if (label === 'safe' || (scores.toxic < 0.3 && scores.offensive < 0.3)) {
            statusConfig = {
                class: 'status-safe',
                icon: 'fas fa-check-circle',
                text: 'Content Appears Safe'
            };
        } else {
            statusConfig = {
                class: 'status-neutral',
                icon: 'fas fa-info-circle',
                text: 'Neutral Content'
            };
        }

        // Update status badge
        elements.statusBadge.className = `status-badge ${statusConfig.class}`;
        elements.statusBadge.innerHTML = `<i class="${statusConfig.icon}"></i> ${statusConfig.text}`;

        // Update metrics
        elements.scoreToxicity.textContent = utils.formatPercentage(scores.toxic || 0);
        elements.scoreOffensive.textContent = utils.formatPercentage(scores.offensive || 0);
        elements.labelPredicted.textContent = label.charAt(0).toUpperCase() + label.slice(1);
        elements.languageDetected.textContent = result.language || 'Auto-detected';

        // Update confidence info
        const confidence = Math.max(scores.toxic || 0, scores.offensive || 0, scores.neutral || 0);
        const highlights = result.highlights || [];
        let confidenceText = `Analysis confidence: ${utils.formatPercentage(confidence)}`;
        
        if (highlights.length > 0) {
            confidenceText += `\nFlagged terms: ${highlights.join(', ')}`;
        }
        
        elements.confidenceInfo.textContent = confidenceText;

        // Store result
        appState.lastAnalysis = {
            ...result,
            timestamp: new Date(),
            text: appState.currentText
        };

        this.setState('result');
    }
};

/**
 * API Communication
 */
const api = {
    async analyzeText(text) {
        const url = `${CONFIG.API_ENDPOINT}?text=${encodeURIComponent(text)}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    }
};

/**
 * Event Handlers
 */
const handlers = {
    async handleFormSubmit(event) {
        event.preventDefault();
        
        const text = elements.textInput.value.trim();
        if (text.length < CONFIG.MIN_TEXT_LENGTH || appState.isAnalyzing) {
            return;
        }

        appState.isAnalyzing = true;
        elements.analyzeBtn.disabled = true;
        elements.analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
        
        ui.setState('loading');

        try {
            const result = await api.analyzeText(text);
            ui.displayResults(result);
        } catch (error) {
            console.error('Analysis failed:', error);
            ui.showError(error.message || 'Analysis service unavailable');
        } finally {
            appState.isAnalyzing = false;
            elements.analyzeBtn.disabled = false;
            elements.analyzeBtn.innerHTML = '<i class="fas fa-search"></i> Analyze Content';
            ui.updateCounts(); // Refresh button state
        }
    },

    handleClearClick() {
        elements.textInput.value = '';
        elements.textInput.focus();
        ui.updateCounts();
        ui.setState('initial');
        appState.lastAnalysis = null;
    },

    handleTextInput: utils.debounce(() => {
        ui.updateCounts();
    }, CONFIG.DEBOUNCE_DELAY)
};

/**
 * Application Initialization
 */
function initializeApp() {
    // Validate required elements
    const requiredElements = ['textInput', 'analyzeBtn', 'clearBtn', 'form'];
    const missingElements = requiredElements.filter(key => !elements[key]);
    
    if (missingElements.length > 0) {
        console.error('Missing required elements:', missingElements);
        return;
    }

    // Attach event listeners
    elements.form.addEventListener('submit', handlers.handleFormSubmit);
    elements.clearBtn.addEventListener('click', handlers.handleClearClick);
    elements.textInput.addEventListener('input', handlers.handleTextInput);

    // Initial UI state
    ui.setState('initial');
    ui.updateCounts();
    
    // Focus on text input
    elements.textInput.focus();

    console.log('AI Content Analysis Platform initialized successfully');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
