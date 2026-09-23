// Popup logic for BD Govt Job Autofill

document.addEventListener('DOMContentLoaded', async () => {
  const statusCard = document.getElementById('statusCard');
  const statusIcon = document.getElementById('statusIcon');
  const statusTitle = document.getElementById('statusTitle');
  const statusDesc = document.getElementById('statusDesc');

  const fillFormBtn = document.getElementById('fillFormBtn');
  const btnText = document.getElementById('btnText');
  const captureFormBtn = document.getElementById('captureFormBtn');
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const editProfileBtn = document.getElementById('editProfileBtn');
  const exportProfileBtn = document.getElementById('exportProfileBtn');
  const importProfileBtn = document.getElementById('importProfileBtn');
  const importFileInput = document.getElementById('importFileInput');
  const autoFillToggle = document.getElementById('autoFillToggle');

  const candidateName = document.getElementById('profileCandidateName');
  const candidateContact = document.getElementById('profileCandidateContact');
  const candidateEdu = document.getElementById('profileCandidateEdu');

  let currentProfile = null;
  let activeTab = null;
  let pageState = null;

  // 1. Detect active tab and page state
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tabs[0];

    if (activeTab && activeTab.url && activeTab.url.includes('teletalk.com.bd')) {
      chrome.tabs.sendMessage(activeTab.id, { action: 'checkStatus' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          statusCard.className = 'status-card inactive';
          statusIcon.textContent = '🟡';
          statusTitle.textContent = 'Teletalk Portal Detected';
          statusDesc.textContent = 'Open an application.php form or refresh';
        } else {
          pageState = response;
          updateStatusAndButtons();
        }
      });
    } else {
      statusCard.className = 'status-card inactive';
      statusIcon.textContent = '⚪';
      statusTitle.textContent = 'No Teletalk Page Active';
      statusDesc.textContent = 'Open a *.teletalk.com.bd job application page';
    }
  } catch (err) {
    console.error('Error detecting active tab:', err);
  }

  // 2. Load stored profile & settings
  async function loadProfileData() {
    const stored = await chrome.storage.local.get(['profiles', 'profile', 'settings']);
    let profiles = stored.profiles || [];
    currentProfile = stored.profile || (profiles.length > 0 ? profiles[0] : null);
    const settings = stored.settings || {};

    autoFillToggle.checked = !!settings.auto_fill_on_load;

    if (profiles.length > 1) {
      const names = profiles.map(p => p.personal?.name?.split(' ')[0] || 'User').slice(0, 3).join(', ');
      candidateName.textContent = `👥 ${profiles.length} Saved Profiles (${names})`;
      candidateContact.textContent = 'Autofill dropdown lets you choose user';
      candidateEdu.textContent = `Primary: ${currentProfile?.personal?.name || 'Default'}`;
    } else if (currentProfile && currentProfile.personal && currentProfile.personal.name) {
      candidateName.textContent = currentProfile.personal.name;
      candidateContact.textContent = `${currentProfile.personal.nid_no || 'NID'} | ${currentProfile.contact?.mobile || 'No Mobile'}`;
      const grad = currentProfile.education?.graduation?.exam_name || 'Graduation';
      const ssc = currentProfile.education?.ssc?.exam_name || 'SSC';
      candidateEdu.textContent = `${grad} / ${ssc}`;
    } else {
      candidateName.textContent = '⚪ Empty (Not Saved Yet)';
      candidateContact.textContent = 'Auto-saves when you submit any form';
      candidateEdu.textContent = 'Fill any Teletalk form once';
    }

    updateStatusAndButtons();
  }

  function updateStatusAndButtons() {
    const hasProfile = currentProfile && currentProfile.personal && currentProfile.personal.name;

    if (pageState && pageState.hasForm) {
      statusCard.className = 'status-card active';
      statusIcon.textContent = '🟢';

      if (hasProfile) {
        statusTitle.textContent = 'Teletalk Application Detected!';
        statusDesc.textContent = 'Ready to autofill with your saved profile';
        fillFormBtn.disabled = false;
        btnText.textContent = 'Autofill This Job Form';

        // Show update button
        captureFormBtn.style.display = 'flex';
        captureFormBtn.querySelector('span').textContent = '📥 Update Profile from This Form';
      } else {
        statusTitle.textContent = 'Teletalk Application Detected!';
        statusDesc.textContent = 'Fill form & submit to auto-save, or click below';
        fillFormBtn.disabled = true;
        btnText.textContent = 'No Profile Yet (Fill form once)';

        // Show prominent capture button
        captureFormBtn.style.display = 'flex';
        captureFormBtn.querySelector('span').textContent = '📥 Save Profile from This Form';
      }
    } else if (pageState && pageState.isPreviewPage) {
      statusCard.className = 'status-card active';
      statusIcon.textContent = '📸';
      statusTitle.textContent = 'Preview Page Detected';
      statusDesc.textContent = 'Review your data & attach photo/signature';
      fillFormBtn.disabled = true;
      captureFormBtn.style.display = 'none';
    }
  }

  await loadProfileData();

  // 3. Handle Fill Form Button
  fillFormBtn.addEventListener('click', () => {
    if (!activeTab || !activeTab.id) return;

    fillFormBtn.disabled = true;
    btnText.textContent = 'Filling Form...';

    chrome.tabs.sendMessage(activeTab.id, { action: 'triggerAutofill' }, (response) => {
      fillFormBtn.disabled = false;
      btnText.textContent = 'Autofill This Job Form';

      if (chrome.runtime.lastError) {
        alert('Could not communicate with the page. Please refresh the page and try again.');
      } else if (response && response.success) {
        window.close();
      } else if (response && response.message) {
        alert(response.message);
      }
    });
  });

  // 4. Handle Capture from Form Button
  captureFormBtn.addEventListener('click', () => {
    if (!activeTab || !activeTab.id) return;

    captureFormBtn.disabled = true;
    captureFormBtn.querySelector('span').textContent = 'Capturing Form Data...';

    chrome.tabs.sendMessage(activeTab.id, { action: 'captureFromPage' }, async (response) => {
      captureFormBtn.disabled = false;
      if (chrome.runtime.lastError) {
        alert('Failed to capture form. Please ensure the page is active and try again.');
      } else if (response && response.success) {
        alert(`✅ Profile for "${response.profile?.personal?.name}" captured and saved successfully!\n\nYou can now autofill any Teletalk job application in 1-click.`);
        await loadProfileData();
      } else {
        alert('Please fill at least your Name and essential fields on the form first before saving!');
      }
    });
  });

  // 5. Settings & Profile Buttons
  openSettingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
  editProfileBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());

  // 6. Auto-fill toggle
  autoFillToggle.addEventListener('change', async (e) => {
    const stored = await chrome.storage.local.get(['settings']);
    const settings = stored.settings || {};
    settings.auto_fill_on_load = e.target.checked;
    await chrome.storage.local.set({ settings });
  });

  // 7. Export Profile
  exportProfileBtn.addEventListener('click', async () => {
    const data = await chrome.storage.local.get(['profile']);
    if (!data.profile || !data.profile.personal) {
      alert('No profile saved yet! Fill any Teletalk form once to save.');
      return;
    }
    const blob = new Blob([JSON.stringify(data.profile, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bd_job_profile_${(data.profile.personal?.name || 'applicant').toLowerCase().replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // 8. Import Profile
  importProfileBtn.addEventListener('click', () => importFileInput.click());
  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const imported = JSON.parse(evt.target.result);
        if (!imported.personal) {
          alert('Invalid profile format! Missing personal info object.');
          return;
        }
        await chrome.storage.local.set({ profile: imported });
        alert('✅ Profile imported successfully!');
        await loadProfileData();
      } catch (err) {
        alert('Failed to parse JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
    importFileInput.value = '';
  });
});
