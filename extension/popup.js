// Modern Popup Script for AI Toxicity Shield
class ToxicityAnalyzer {
  constructor() {
    this.apiBaseUrl = 'http://127.0.0.1:8000';
    this.elements = {
      loadingState: document.getElementById('loadingState'),
      resultState: document.getElementById('resultState'),
      errorState: document.getElementById('errorState'),
      resultIcon: document.getElementById('resultIcon'),
      resultLabel: document.getElementById('resultLabel'),
      resultSublabel: document.getElementById('resultSublabel'),
      toxicityScore: document.getElementById('toxicityScore'),
      languageDetected: document.getElementById('languageDetected'),
      progressFill: document.getElementById('progressFill'),
      rescanBtn: document.getElementById('rescanBtn'),
      retryBtn: document.getElementById('retryBtn'),
      errorMessage: document.getElementById('errorMessage'),
      connectionStatus: document.getElementById('connectionStatus'),
      scanIcon: document.getElementById('scanIcon')
    };
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.startAnalysis();
  }

  setupEventListeners() {
    this.elements.rescanBtn.addEventListener('click', () => {
      this.startAnalysis();
    });

    this.elements.retryBtn.addEventListener('click', () => {
      this.startAnalysis();
    });
  }

  showState(state) {
    // Hide all states
    this.elements.loadingState.style.display = 'none';
    this.elements.resultState.style.display = 'none';
    this.elements.errorState.style.display = 'none';

    // Show requested state
    if (this.elements[state]) {
      this.elements[state].style.display = 'block';
    }
  }

  startAnalysis() {
    this.showState('loadingState');
    this.animateScanIcon();
    
    // Get page text and analyze
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        this.getPageText(tabs[0].id);
      } else {
        this.showError('Unable to access current tab');
      }
    });
  }

  animateScanIcon() {
    this.elements.scanIcon.style.animation = 'none';
    setTimeout(() => {
      this.elements.scanIcon.style.animation = 'scan 2s ease-in-out infinite';
    }, 10);
  }

  getPageText(tabId) {
    try {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('Script injection failed:', chrome.runtime.lastError);
          this.showError('Unable to analyze this page');
          return;
        }

        chrome.tabs.sendMessage(tabId, {action: "getPageText"}, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Message sending failed:', chrome.runtime.lastError);
            this.showError('Communication error');
            return;
          }

          console.log('Received response from content script:', response);

          if (response && response.text) {
            console.log('Analyzing text:', {
              length: response.text.length,
              preview: response.text.substring(0, 200) + '...',
              pageInfo: response.pageInfo
            });
            this.analyzeText(response.text);
          } else {
            this.showError('No text content found on this page');
          }
        });
      });
    } catch (error) {
      console.error('Error in getPageText:', error);
      this.showError('Unable to analyze page content');
    }
  }

  async analyzeText(text) {
    if (!text || text.trim().length === 0) {
      this.showError('No text content to analyze');
      return;
    }

    try {
      // Truncate text if too long to avoid API issues
      const truncatedText = text.length > 1000 ? text.substring(0, 1000) + '...' : text;
      
      // Use GET request with query parameter to match backend
      const encodedText = encodeURIComponent(truncatedText);
      const response = await fetch(`${this.apiBaseUrl}/predict?text=${encodedText}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.displayResult(data);
      
    } catch (error) {
      console.error('Analysis failed:', error);
      
      if (error.message.includes('Failed to fetch')) {
        this.showError('Cannot connect to AI service. Make sure the backend is running.');
      } else {
        this.showError(`Analysis failed: ${error.message}`);
      }
    }
  }

  displayResult(data) {
    this.showState('resultState');
    
    // Extract data with fallbacks - adapting to backend's response format
    const label = data.label || 'unknown';
    const scores = data.scores || {};
    const language = data.language || 'unknown';
    const highlights = data.highlights || [];
    
    // Calculate toxicity score from the scores object
    let toxicityScore = 0;
    let category, message;
    
    if (label === 'toxic') {
      toxicityScore = scores.toxic || 0;
      category = 'Toxic';
      message = 'Toxic content detected!';
    } else if (label === 'offensive') {
      toxicityScore = scores.offensive || 0;
      category = 'Toxic';  // Treat offensive as toxic for user clarity
      message = 'Offensive content detected!';
    } else if (label === 'neutral' || label === 'safe') {
      // For neutral, show the highest non-neutral score if it exists
      const maxToxic = Math.max(scores.toxic || 0, scores.offensive || 0);
      toxicityScore = maxToxic;
      
      if (maxToxic > 0.3) {
        category = 'Neutral';
        message = 'Some concerning language detected';
      } else {
        category = 'Safe';
        message = 'Content appears clean';
      }
    } else {
      toxicityScore = Math.max(scores.toxic || 0, scores.offensive || 0);
      category = 'Unknown';
      message = 'Analysis complete';
    }

    // Update result elements
    this.elements.toxicityScore.textContent = `${Math.round(toxicityScore * 100)}%`;
    this.elements.languageDetected.textContent = this.formatLanguage(language);
    this.elements.resultLabel.textContent = category;
    this.elements.resultSublabel.textContent = message;

    // Update progress bar
    this.elements.progressFill.style.width = `${toxicityScore * 100}%`;

    // Set icon and color scheme based on category
    this.updateResultAppearance(category, null, toxicityScore);
    
    // Add entrance animation
    this.elements.resultState.style.animation = 'bounce-in 0.6s ease-out';
    
    // Log for debugging
    console.log('Analysis result:', {
      originalLabel: label,
      scores: scores,
      finalCategory: category,
      toxicityScore: toxicityScore
    });
  }

  updateResultAppearance(category, color, score) {
    let icon, colorClass;
    
    // Determine icon and color class based on category and score
    if (category === 'Safe') {
      icon = '✅';
      colorClass = 'safe';
    } else if (category === 'Neutral') {
      icon = '⚠️';
      colorClass = 'warning';
    } else if (category === 'Toxic') {
      icon = '❌';
      colorClass = 'danger';
    } else {
      icon = '🔍';
      colorClass = 'neutral';
    }

    // Override based on score thresholds for more accurate representation
    if (score >= 0.7) {
      icon = '❌';
      colorClass = 'danger';
    } else if (score >= 0.4) {
      icon = '⚠️';
      colorClass = 'warning';
    } else if (score < 0.2) {
      icon = '✅';
      colorClass = 'safe';
    }

    // Update icon
    this.elements.resultIcon.textContent = icon;
    
    // Update color classes
    this.elements.resultState.className = `result-state ${colorClass}`;
    
    // Update connection status
    this.updateConnectionStatus(true);
  }

  showError(message) {
    this.showState('errorState');
    this.elements.errorMessage.textContent = message;
    this.updateConnectionStatus(false);
  }

  updateConnectionStatus(isConnected) {
    const dot = this.elements.connectionStatus.querySelector('.pulse-dot');
    if (isConnected) {
      dot.style.background = '#00ff88';
      dot.style.boxShadow = '0 0 0 0 rgba(0, 255, 136, 0.7)';
    } else {
      dot.style.background = '#ff4444';
      dot.style.boxShadow = '0 0 0 0 rgba(255, 68, 68, 0.7)';
    }
  }

  formatLanguage(langCode) {
    const languages = {
      'en': 'English',
      'hi': 'Hindi',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh': 'Chinese',
      'ar': 'Arabic',
      'mr': 'Marathi',
      'bn': 'Bengali',
      'ta': 'Tamil',
      'te': 'Telugu',
      'gu': 'Gujarati',
      'kn': 'Kannada',
      'pa': 'Punjabi',
      'unknown': 'Unknown'
    };
    
    return languages[langCode] || langCode.toUpperCase();
  }
}

// Initialize the analyzer when the popup loads
document.addEventListener('DOMContentLoaded', () => {
  new ToxicityAnalyzer();
});

// Add some visual feedback for button interactions
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('action-btn') || e.target.classList.contains('retry-btn')) {
    e.target.style.transform = 'scale(0.95)';
    setTimeout(() => {
      e.target.style.transform = '';
    }, 150);
  }
});

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    const analyzer = new ToxicityAnalyzer();
    analyzer.startAnalysis();
  }
});
