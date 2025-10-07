// Background Service Worker for AI Toxicity Shield
class BackgroundService {
  constructor() {
    this.init();
  }

  init() {
    // Set up installation handler
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstallation(details);
    });

    // Set up context menu (right-click menu)
    this.setupContextMenu();

    // Set up badge update system
    this.setupBadgeSystem();
  }

  handleInstallation(details) {
    if (details.reason === 'install') {
      console.log('AI Toxicity Shield installed');
      
      // Set default settings
      chrome.storage.sync.set({
        'autoScan': true,
        'notificationLevel': 'medium',
        'language': 'auto'
      });

      // Show welcome notification
      this.showNotification('welcome', {
        title: '🛡️ AI Toxicity Shield Installed',
        message: 'Your web browsing is now protected by AI-powered toxicity detection!'
      });
    } else if (details.reason === 'update') {
      console.log('AI Toxicity Shield updated to version', chrome.runtime.getManifest().version);
    }
  }

  setupContextMenu() {
    chrome.contextMenus.create({
      id: 'analyzePage',
      title: '🛡️ Analyze Page for Toxicity',
      contexts: ['page']
    });

    chrome.contextMenus.create({
      id: 'analyzeSelection',
      title: '🔍 Analyze Selected Text',
      contexts: ['selection']
    });

    // Handle context menu clicks
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      this.handleContextMenuClick(info, tab);
    });
  }

  setupBadgeSystem() {
    // Update badge when tab changes
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.updateBadge(activeInfo.tabId);
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete') {
        this.updateBadge(tabId);
      }
    });
  }

  async handleContextMenuClick(info, tab) {
    try {
      if (info.menuItemId === 'analyzePage') {
        // Open popup programmatically
        chrome.action.openPopup();
      } else if (info.menuItemId === 'analyzeSelection' && info.selectionText) {
        // Analyze selected text directly
        await this.analyzeSelectedText(info.selectionText, tab.id);
      }
    } catch (error) {
      console.error('Context menu action failed:', error);
    }
  }

  async analyzeSelectedText(text, tabId) {
    try {
      const encodedText = encodeURIComponent(text);
      const response = await fetch(`http://127.0.0.1:8000/predict?text=${encodedText}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });

      if (response.ok) {
        const result = await response.json();
        this.showAnalysisNotification(result, text.substring(0, 50) + '...');
      } else {
        throw new Error('Analysis failed');
      }
    } catch (error) {
      this.showNotification('error', {
        title: '❌ Analysis Failed',
        message: 'Could not analyze selected text. Make sure the AI service is running.'
      });
    }
  }

  showAnalysisNotification(result, textPreview) {
    const label = result.label || 'unknown';
    const scores = result.scores || {};
    
    // Calculate toxicity score
    let toxicityScore = 0;
    if (label === 'toxic') {
      toxicityScore = Math.round((scores.toxic || 0) * 100);
    } else if (label === 'offensive') {
      toxicityScore = Math.round((scores.offensive || 0) * 100);
    } else {
      toxicityScore = Math.round(Math.max(scores.toxic || 0, scores.offensive || 0) * 100);
    }
    
    let icon, title;
    if (label === 'neutral' || label === 'safe') {
      icon = '✅';
      title = 'Content appears safe';
    } else if (label === 'offensive') {
      icon = '⚠️';
      title = 'Potentially offensive content detected';
    } else if (label === 'toxic') {
      icon = '❌';
      title = 'Toxic content detected!';
    } else {
      icon = '🔍';
      title = 'Analysis complete';
    }

    this.showNotification('analysis', {
      title: `${icon} ${title}`,
      message: `"${textPreview}" - Toxicity: ${toxicityScore}%`
    });
  }

  showNotification(type, options) {
    if (chrome.notifications) {
      chrome.notifications.create(type, {
        type: 'basic',
        iconUrl: 'icon48.png',
        title: options.title,
        message: options.message
      });
    }
  }

  async updateBadge(tabId) {
    try {
      // Get tab info
      const tab = await chrome.tabs.get(tabId);
      
      // Only update for http/https pages
      if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
        // Set badge to show shield is active
        chrome.action.setBadgeText({
          text: '🛡️',
          tabId: tabId
        });
        
        chrome.action.setBadgeBackgroundColor({
          color: '#4CAF50',
          tabId: tabId
        });
      } else {
        // Clear badge for non-web pages
        chrome.action.setBadgeText({
          text: '',
          tabId: tabId
        });
      }
    } catch (error) {
      // Silently handle errors (tab might be closed)
      console.debug('Badge update failed:', error);
    }
  }
}

// Initialize the background service
new BackgroundService();

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
  console.log('AI Toxicity Shield service worker started');
});