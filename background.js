// Background Service Worker for BD Govt Job Autofill

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('[BD Govt Job Autofill] Installed.');

    // Initialize with empty profile so the user can capture directly from live forms
    const stored = await chrome.storage.local.get(['profile', 'settings']);
    if (!stored.settings) {
      await chrome.storage.local.set({
        profile: stored.profile || null,
        settings: {
          auto_fill_on_load: false,
          auto_capture_on_submit: true,
          auto_check_agreement: true,
          focus_captcha: true,
          show_floating_button: true
        }
      });
    }
  }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openOptionsPage') {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
  } else if (message.action === 'profileCaptured') {
    // Notify badge or update
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#006a4e' });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 5000);
    sendResponse({ success: true });
  }
  return true;
});
