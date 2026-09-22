// BD Govt Job Autofill - Content Script
// - In-Field Autofill Popup (appears when input selected, never reappears after click)
// - Silent auto-update when extra fields are added
// - Accept / Deny popup ONLY when existing saved data is being modified

(function () {
  'use strict';

  console.log('[BD Govt Job Autofill] Engine loaded on:', window.location.href);

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const applicationForm = document.getElementById('applicationForm');
  const isApplicationPage = !!applicationForm;
  const isPreviewPage = window.location.pathname.includes('preview.php');

  let currentProfile = null;
  let currentSettings = {
    auto_check_agreement: true,
    focus_captcha: true
  };

  let activePopupEl = null;
  let activeModalEl = null;
  let hasAutofilledOnThisPage = false; // Requirement 1: once clicked, never appears again on this page
  let isSubmittingProgrammatically = false;

  function syncProfileCache(profile) {
    currentProfile = profile;
    try {
      if (profile && profile.personal && profile.personal.name) {
        localStorage.setItem('bd_job_profile_active', JSON.stringify(profile));
      } else {
        localStorage.removeItem('bd_job_profile_active');
      }
    } catch (e) {}
  }

  function getSyncProfile() {
    if (currentProfile && currentProfile.personal && currentProfile.personal.name) {
      return currentProfile;
    }
    try {
      const raw = localStorage.getItem('bd_job_profile_active') || localStorage.getItem('bd_job_profile_captured');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.personal && parsed.personal.name) {
          currentProfile = parsed;
          return parsed;
        }
      }
    } catch (e) {}
    return null;
  }

  // Pre-load profile from synchronous cache if available
  try {
    const activeSaved = localStorage.getItem('bd_job_profile_active') || localStorage.getItem('bd_job_profile_captured');
    if (activeSaved) {
      const parsed = JSON.parse(activeSaved);
      if (parsed && parsed.personal && parsed.personal.name) {
        currentProfile = parsed;
      }
    }
  } catch (e) {}

  // Listen for storage changes across tabs/windows
  try {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.profile) {
        syncProfileCache(changes.profile.newValue || null);
      }
    });
  } catch (e) {}

  // Initialize
  async function init() {
    try {
      const data = await chrome.storage.local.get(['profile', 'settings']);
      if (data.profile && data.profile.personal && data.profile.personal.name) {
        syncProfileCache(data.profile);
      } else if (currentProfile) {
        // If storage was empty but synchronous cache had it, restore storage
        chrome.storage.local.set({ profile: currentProfile });
      }
      if (data.settings) currentSettings = { ...currentSettings, ...data.settings };

      if (isApplicationPage) {
        // 1. Setup in-field autofill suggestion when user selects an input field
        setupInFieldAutofill();

        // 2. Setup smart submission listener (auto-updates extra fields, asks if modifying existing)
        setupSmartSubmitCapture();
      } else if (isPreviewPage) {
        setupPreviewMediaCapture();
      }
    } catch (e) {
      console.error('[BD Govt Job Autofill] Init error:', e);
    }
  }

  // ==========================================
  // IN-FIELD AUTOFILL POPUP (INPUT SELECTED)
  // ==========================================

  function setupInFieldAutofill() {
    if (!applicationForm) return;

    // Listen to focusin on inputs
    document.addEventListener('focusin', (e) => {
      // Requirement 1: If user already clicked autofill on this page, NEVER show again!
      if (hasAutofilledOnThisPage) return;
      handleFieldFocus(e.target);
    }, true);

    // Also handle direct click
    document.addEventListener('click', (e) => {
      // Requirement 1: If already autofilled, ignore
      if (hasAutofilledOnThisPage) {
        removeAutofillPopup();
        return;
      }

      if (activePopupEl && activePopupEl.contains(e.target)) return;

      if (e.target && isEligibleInput(e.target)) {
        handleFieldFocus(e.target);
      } else {
        removeAutofillPopup();
      }
    });

    // Dismiss on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') removeAutofillPopup();
    });

    window.addEventListener('resize', () => removeAutofillPopup());
  }

  function isEligibleInput(el) {
    if (!el || !applicationForm.contains(el)) return false;
    const tag = el.tagName.toLowerCase();
    if (tag !== 'input' && tag !== 'textarea') return false;

    // Exclude captcha, buttons, checkboxes, radio, hidden
    if (el.id === 'captcha' || el.name === 'captcha') return false;
    const type = (el.type || 'text').toLowerCase();
    if (['hidden', 'checkbox', 'radio', 'submit', 'button', 'file', 'image'].includes(type)) return false;

    return true;
  }

  async function handleFieldFocus(inputEl) {
    // Requirement 1: Never show again once clicked on this page
    if (hasAutofilledOnThisPage) {
      removeAutofillPopup();
      return;
    }

    if (!isEligibleInput(inputEl)) {
      removeAutofillPopup();
      return;
    }

    if (!currentProfile) {
      const data = await chrome.storage.local.get(['profile']);
      currentProfile = data.profile || null;
    }

    if (!currentProfile || !currentProfile.personal || !currentProfile.personal.name) {
      removeAutofillPopup();
      return;
    }

    showAutofillPopup(inputEl);
  }

  function showAutofillPopup(inputEl) {
    removeAutofillPopup();

    const candidateName = currentProfile.personal.name;
    const sscRoll = currentProfile.education?.ssc?.roll;
    const mobile = currentProfile.contact?.mobile;
    const extraInfo = mobile || (sscRoll ? `SSC: ${sscRoll}` : 'Teletalk Application');

    const popup = document.createElement('div');
    popup.id = 'bd-job-autofill-popup';
    popup.className = 'bd-autofill-popup';
    popup.innerHTML = `
      <div class="bd-popup-item" title="Click to autofill the entire form with this profile">
        <div class="bd-popup-icon">⚡</div>
        <div class="bd-popup-content">
          <div class="bd-popup-title">Autofill as <strong>${candidateName}</strong></div>
          <div class="bd-popup-sub">${extraInfo} • Click to fill all fields</div>
        </div>
        <div class="bd-popup-badge">Autofill</div>
      </div>
    `;

    popup.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });

    // On click: execute autofill AND permanently disable popup for this page!
    popup.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeAutofillPopup();

      // Requirement 1: Never show again on this page after clicking autofill!
      hasAutofilledOnThisPage = true;

      await fillApplicationForm(currentProfile);
    });

    document.body.appendChild(popup);
    activePopupEl = popup;

    positionPopup(inputEl, popup);
  }

  function positionPopup(inputEl, popup) {
    const rect = inputEl.getBoundingClientRect();
    const popupHeight = 55;
    const margin = 4;

    let top = rect.bottom + window.scrollY + margin;
    if (rect.bottom + popupHeight > window.innerHeight && rect.top - popupHeight > 0) {
      top = rect.top + window.scrollY - popupHeight - margin;
    }

    let left = rect.left + window.scrollX;
    const maxLeft = window.innerWidth - 320;
    if (left > maxLeft) left = Math.max(10, maxLeft);

    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
  }

  function removeAutofillPopup() {
    if (activePopupEl) {
      activePopupEl.remove();
      activePopupEl = null;
    }
  }

  // ==========================================
  // PROFILE COMPARISON & DIFF ENGINE
  // ==========================================

  const FIELD_LABELS = {
    'personal.name': "Applicant's Name",
    'personal.name_bn': "Applicant's Name (Bangla)",
    'personal.father': "Father's Name",
    'personal.father_bn': "Father's Name (Bangla)",
    'personal.mother': "Mother's Name",
    'personal.mother_bn': "Mother's Name (Bangla)",
    'personal.dob': "Date of Birth",
    'personal.gender': "Gender",
    'personal.religion': "Religion",
    'personal.nationality': "Nationality",
    'personal.nid_no': "National ID Number",
    'personal.breg_no': "Birth Registration No",
    'personal.passport_no': "Passport Number",
    'personal.marital_status': "Marital Status",
    'personal.spouse_name': "Spouse Name",
    'personal.quota': "Quota",
    'personal.quota_details': "Quota Details",
    'personal.dep_status': "Departmental Status",

    'contact.mobile': "Mobile Number",
    'contact.email': "Email Address",

    'address.present.careof': "Present Care Of",
    'address.present.village': "Present Village/Road",
    'address.present.district_code': "Present District",
    'address.present.upazila_code': "Present Upazila/Thana",
    'address.present.post': "Present Post Office",
    'address.present.postcode': "Present Post Code",

    'address.permanent.careof': "Permanent Care Of",
    'address.permanent.village': "Permanent Village/Road",
    'address.permanent.district_code': "Permanent District",
    'address.permanent.upazila_code': "Permanent Upazila/Thana",
    'address.permanent.post': "Permanent Post Office",
    'address.permanent.postcode': "Permanent Post Code",

    'education.ssc.exam': "SSC Exam",
    'education.ssc.board': "SSC Board",
    'education.ssc.roll': "SSC Roll",
    'education.ssc.result': "SSC GPA",
    'education.ssc.group': "SSC Group",
    'education.ssc.year': "SSC Passing Year",

    'education.hsc.exam': "HSC Exam",
    'education.hsc.board': "HSC Board",
    'education.hsc.roll': "HSC Roll",
    'education.hsc.result': "HSC GPA",
    'education.hsc.group': "HSC Group",
    'education.hsc.year': "HSC Passing Year",

    'education.graduation.exam': "Graduation Degree",
    'education.graduation.institute': "Graduation University",
    'education.graduation.subject': "Graduation Subject",
    'education.graduation.result': "Graduation Result / CGPA",
    'education.graduation.year': "Graduation Passing Year",
    'education.graduation.duration': "Graduation Duration",

    'education.masters.exam': "Masters Degree",
    'education.masters.institute': "Masters University",
    'education.masters.subject': "Masters Subject",
    'education.masters.result': "Masters Result / CGPA",
    'education.masters.year': "Masters Passing Year",
    'education.masters.duration': "Masters Duration",

    'experience': "Work Experience"
  };

  function getNested(obj, path) {
    if (!obj) return '';
    return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : ''), obj);
  }

  function setNested(obj, path, val) {
    const parts = path.split('.');
    let curr = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!curr[parts[i]]) curr[parts[i]] = {};
      curr = curr[parts[i]];
    }
    curr[parts[parts.length - 1]] = val;
  }

  function norm(val) {
    if (val === undefined || val === null || val === false) return '';
    return String(val).trim().toUpperCase();
  }

  function compareProfiles(existing, current) {
    const added = [];
    const changed = [];

    for (const [path, label] of Object.entries(FIELD_LABELS)) {
      if (path === 'experience') {
        const oldExp = existing?.experience?.enabled && existing?.experience?.jobs?.length;
        const newExp = current?.experience?.enabled && current?.experience?.jobs?.length;
        if (!oldExp && newExp) {
          added.push({ path, label, newVal: 'Work Experience Added' });
        } else if (oldExp && newExp) {
          const oldOrg = norm(existing.experience.jobs[0]?.organization);
          const newOrg = norm(current.experience.jobs[0]?.organization);
          if (newOrg && oldOrg && oldOrg !== newOrg) {
            changed.push({
              path,
              label,
              oldVal: existing.experience.jobs[0]?.organization,
              newVal: current.experience.jobs[0]?.organization
            });
          }
        }
        continue;
      }

      const oldVal = getNested(existing, path);
      const newVal = getNested(current, path);

      const oldNorm = norm(oldVal);
      const newNorm = norm(newVal);

      // If new form didn't fill this field, it's not a change
      if (!newNorm) continue;

      if (!oldNorm && newNorm) {
        // Extra field added! (previously empty, now has value)
        added.push({ path, label, newVal });
      } else if (oldNorm && newNorm && oldNorm !== newNorm) {
        // Existing saved data is updating/changing!
        changed.push({ path, label, oldVal, newVal });
      }
    }

    return { added, changed };
  }

  function deepMergeProfile(target, source) {
    const result = JSON.parse(JSON.stringify(target || {}));

    function merge(t, s) {
      for (const key in s) {
        if (s[key] === null || s[key] === undefined) continue;

        if (typeof s[key] === 'object' && !Array.isArray(s[key])) {
          if (!t[key] || typeof t[key] !== 'object') t[key] = {};
          merge(t[key], s[key]);
        } else if (Array.isArray(s[key])) {
          if (s[key].length > 0) t[key] = JSON.parse(JSON.stringify(s[key]));
        } else if (s[key] !== '' && s[key] !== false) {
          t[key] = s[key];
        }
      }
    }

    merge(result, source);
    return result;
  }

  function mergeOnlyAddedFields(existing, source, addedList) {
    const result = JSON.parse(JSON.stringify(existing));
    for (const item of addedList) {
      setNested(result, item.path, getNested(source, item.path));
    }
    return result;
  }

  // ==========================================
  // FORM EXTRACTION & SMART SUBMIT HANDLER
  // ==========================================

  function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function getOptText(id) {
    const el = document.getElementById(id);
    if (!el || el.selectedIndex < 0) return '';
    const opt = el.options[el.selectedIndex];
    return opt ? opt.text.trim() : '';
  }

  function isChecked(id) {
    const el = document.getElementById(id);
    return !!(el && el.checked);
  }

  function extractProfileFromForm() {
    if (!applicationForm) return null;

    const name = getVal('name');
    if (!name || name.length < 2) return null;

    const sameAddress = isChecked('same_as_present');
    const presDistName = getOptText('present_district').replace(/\s*\(.*\)/, '').trim();
    const presUpzName = getOptText('present_upazila').trim();

    const permDistName = sameAddress ? presDistName : getOptText('permanent_district').replace(/\s*\(.*\)/, '').trim();
    const permUpzName = sameAddress ? presUpzName : getOptText('permanent_upazila').trim();

    const existingMedia = (currentProfile && currentProfile.media) ? currentProfile.media : { photo_base64: '', signature_base64: '' };

    return {
      personal: {
        name: name.toUpperCase(),
        name_bn: getVal('name_bn'),
        father: getVal('father').toUpperCase(),
        father_bn: getVal('father_bn'),
        mother: getVal('mother').toUpperCase(),
        mother_bn: getVal('mother_bn'),
        dob: getVal('dob'),
        nationality: getVal('nationality') || 'Bangladeshi',
        religion: getVal('religion') || '1',
        gender: getVal('gender') || 'Male',
        nid: getVal('nid') || (getVal('nid_no') ? '1' : '0'),
        nid_no: getVal('nid_no'),
        breg: getVal('breg') || (getVal('breg_no') ? '1' : '0'),
        breg_no: getVal('breg_no'),
        passport: getVal('passport') || (getVal('passport_no') ? '1' : '0'),
        passport_no: getVal('passport_no'),
        marital_status: getVal('marital_status') || 'Single',
        spouse_name: getVal('spouse_name').toUpperCase(),
        quota: getVal('quota') || '8',
        quota_details: getVal('quota_details'),
        dep_status: getVal('dep_status') || '5'
      },
      contact: {
        mobile: getVal('mobile'),
        confirm_mobile: getVal('confirm_mobile') || getVal('mobile'),
        email: getVal('email')
      },
      address: {
        present: {
          careof: getVal('present_careof').toUpperCase(),
          village: getVal('present_village').toUpperCase(),
          district_code: getVal('present_district'),
          district_name: presDistName,
          upazila_code: getVal('present_upazila'),
          upazila_name: presUpzName,
          post: getVal('present_post').toUpperCase(),
          postcode: getVal('present_postcode')
        },
        same_as_present: sameAddress,
        permanent: {
          careof: sameAddress ? getVal('present_careof').toUpperCase() : getVal('permanent_careof').toUpperCase(),
          village: sameAddress ? getVal('present_village').toUpperCase() : getVal('permanent_village').toUpperCase(),
          district_code: sameAddress ? getVal('present_district') : getVal('permanent_district'),
          district_name: permDistName,
          upazila_code: sameAddress ? getVal('present_upazila') : getVal('permanent_upazila'),
          upazila_name: permUpzName,
          post: sameAddress ? getVal('present_post').toUpperCase() : getVal('permanent_post').toUpperCase(),
          postcode: sameAddress ? getVal('present_postcode') : getVal('permanent_postcode')
        }
      },
      education: {
        ssc: {
          enabled: !!getVal('ssc_exam') || !!getVal('ssc_roll'),
          exam: getVal('ssc_exam') || '1',
          exam_name: getOptText('ssc_exam') || 'S.S.C',
          board: getVal('ssc_board') || '14',
          board_name: getOptText('ssc_board') || 'Dhaka',
          roll: getVal('ssc_roll'),
          result_type: getVal('ssc_result_type') || '5',
          result: getVal('ssc_result'),
          group: getVal('ssc_group') || '1',
          group_name: getOptText('ssc_group') || 'Science',
          year: getVal('ssc_year') || '2014'
        },
        hsc: {
          enabled: !!getVal('hsc_exam') || !!getVal('hsc_roll'),
          exam: getVal('hsc_exam') || '1',
          exam_name: getOptText('hsc_exam') || 'H.S.C',
          board: getVal('hsc_board') || '14',
          board_name: getOptText('hsc_board') || 'Dhaka',
          roll: getVal('hsc_roll'),
          result_type: getVal('hsc_result_type') || '5',
          result: getVal('hsc_result'),
          group: getVal('hsc_group') || '1',
          group_name: getOptText('hsc_group') || 'Science',
          year: getVal('hsc_year') || '2016'
        },
        graduation: {
          enabled: !!getVal('gra_exam') || !!getVal('gra_institute'),
          exam: getVal('gra_exam') || '1',
          exam_name: getOptText('gra_exam') || 'B.Sc Engineering',
          institute: getVal('gra_institute'),
          institute_name: getOptText('gra_institute'),
          subject: getVal('gra_subject'),
          subject_name: getOptText('gra_subject') || getVal('gra_subject_other') || '',
          result_type: getVal('gra_result_type') || '4',
          result: getVal('gra_result'),
          duration: getVal('gra_duration') || '04',
          year: getVal('gra_year') || '2021'
        },
        masters: {
          enabled: isChecked('if_applicable_mas') || !!getVal('mas_exam'),
          exam: getVal('mas_exam') || '3',
          exam_name: getOptText('mas_exam') || 'M.Sc',
          institute: getVal('mas_institute'),
          institute_name: getOptText('mas_institute'),
          subject: getVal('mas_subject'),
          subject_name: getOptText('mas_subject') || getVal('mas_subject_other') || '',
          result_type: getVal('mas_result_type') || '4',
          result: getVal('mas_result'),
          duration: getVal('mas_duration') || '02',
          year: getVal('mas_year') || '2023'
        }
      },
      experience: {
        enabled: isChecked('if_applicable_exp'),
        jobs: [
          {
            employment_type: getVal('employment_type') || '8',
            designation: getVal('designation'),
            organization: getVal('organization'),
            office_address: getVal('office_address'),
            job_start_date: getVal('job_start_date'),
            job_end_date: getVal('job_end_date'),
            currently_working: isChecked('currently_working'),
            last_salary: getVal('last_salary'),
            job_description: getVal('job_description')
          }
        ]
      },
      media: existingMedia
    };
  }

  // Setup smart submission capture:
  // - Extra fields added: auto-updates silently!
  // - Existing data changed: stops submit synchronously and shows Accept/Deny popup!
  function setupSmartSubmitCapture() {
    if (!applicationForm) return;

    const submitBtn = document.getElementById('submit') || applicationForm.querySelector('button[type="submit"], input[type="submit"]');

    function handleSubmitCapture(e) {
      if (isSubmittingProgrammatically) return;

      const extracted = extractProfileFromForm();
      if (!extracted) return;

      const existing = getSyncProfile();

      // Case 1: First time install / empty profile
      if (!existing || !existing.personal || !existing.personal.name) {
        // Automatically save silently!
        syncProfileCache(extracted);
        chrome.storage.local.set({ profile: extracted });
        chrome.runtime.sendMessage({ action: 'profileCaptured' });
        console.log('[BD Govt Job Autofill] Initial profile automatically saved:', extracted);
        return; // Form continues normal submission to preview.php!
      }

      // Case 2: Compare existing profile with newly submitted form
      const { added, changed } = compareProfiles(existing, extracted);

      // Sub-case 2A: No existing fields were modified (only extra fields added or identical)
      if (changed.length === 0) {
        if (added.length > 0) {
          // Requirement 2: Auto-update extra fields silently without popup!
          const merged = deepMergeProfile(existing, extracted);
          syncProfileCache(merged);
          chrome.storage.local.set({ profile: merged });
          chrome.runtime.sendMessage({ action: 'profileCaptured' });
          console.log('[BD Govt Job Autofill] Extra fields auto-updated silently:', added);
        }
        return; // Form continues normal submission!
      }

      // Sub-case 2B: Existing saved data is being modified!
      // Requirement 2: Give an Accept or Deny popup!
      // CRITICAL: Stop submission SYNCHRONOUSLY before any async operations!
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log('[BD Govt Job Autofill] Submit intercepted for update review:', { added, changed });

      showUpdateModal(existing, extracted, added, changed, async (accepted) => {
        if (accepted) {
          // User accepted updates: merge all changed and added fields
          const updated = deepMergeProfile(existing, extracted);
          syncProfileCache(updated);
          await chrome.storage.local.set({ profile: updated });
          chrome.runtime.sendMessage({ action: 'profileCaptured' });
          console.log('[BD Govt Job Autofill] Profile changes accepted and saved:', updated);
        } else {
          // User denied updates: keep existing values, only save any extra added fields
          if (added.length > 0) {
            const preserved = mergeOnlyAddedFields(existing, extracted, added);
            syncProfileCache(preserved);
            await chrome.storage.local.set({ profile: preserved });
            console.log('[BD Govt Job Autofill] Changes denied, but extra fields merged.');
          } else {
            console.log('[BD Govt Job Autofill] Changes denied, existing profile kept intact.');
          }
        }

        // Programmatically submit the form to continue to preview.php
        isSubmittingProgrammatically = true;

        // Ensure submit button name/value is sent if present
        if (submitBtn && submitBtn.name) {
          let btnInput = applicationForm.querySelector(`input[name="${submitBtn.name}"]`);
          if (!btnInput) {
            btnInput = document.createElement('input');
            btnInput.type = 'hidden';
            btnInput.name = submitBtn.name;
            btnInput.value = submitBtn.value || 'Submit';
            applicationForm.appendChild(btnInput);
          }
        }

        try {
          HTMLFormElement.prototype.submit.call(applicationForm);
        } catch (err) {
          console.error('[BD Govt Job Autofill] Form submission fallback error:', err);
          if (submitBtn) submitBtn.click();
        }
      });
    }

    applicationForm.addEventListener('submit', handleSubmitCapture, true);
    if (submitBtn) {
      submitBtn.addEventListener('click', handleSubmitCapture, true);
    }
  }

  // Accept / Deny Modal
  function showUpdateModal(existing, extracted, added, changed, callback) {
    if (activeModalEl) activeModalEl.remove();

    const modal = document.createElement('div');
    modal.className = 'bd-job-modal-overlay';

    let diffHtml = '';
    changed.forEach(item => {
      diffHtml += `
        <div class="bd-diff-item">
          <span class="bd-diff-label">${item.label}</span>
          <div class="bd-diff-vals">
            <span class="bd-val-old">${item.oldVal || '(empty)'}</span>
            <span class="bd-arrow">➔</span>
            <span class="bd-val-new">${item.newVal}</span>
          </div>
        </div>
      `;
    });

    let extraHtml = '';
    if (added.length > 0) {
      extraHtml = `
        <div class="bd-extra-section">
          <span class="bd-extra-tag">✨ Also adding new fields:</span>
          ${added.map(a => a.label).join(', ')}
        </div>
      `;
    }

    modal.innerHTML = `
      <div class="bd-job-modal-card">
        <div class="bd-modal-header">
          <div class="bd-modal-icon">⚠️</div>
          <div>
            <h3 class="bd-modal-title">Update Saved Profile?</h3>
            <p class="bd-modal-sub">You modified existing saved information in this application form.</p>
          </div>
        </div>
        <div class="bd-modal-body">
          <div class="bd-diff-heading">Modified Information:</div>
          <div class="bd-diff-list">
            ${diffHtml}
          </div>
          ${extraHtml}
        </div>
        <div class="bd-modal-footer">
          <button type="button" class="bd-modal-btn bd-btn-deny" id="bd-modal-deny-btn">
            ✕ Deny (Keep Existing)
          </button>
          <button type="button" class="bd-modal-btn bd-btn-accept" id="bd-modal-accept-btn">
            ✓ Accept & Update Profile
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    activeModalEl = modal;

    document.getElementById('bd-modal-accept-btn').addEventListener('click', () => {
      modal.remove();
      activeModalEl = null;
      callback(true);
    });

    document.getElementById('bd-modal-deny-btn').addEventListener('click', () => {
      modal.remove();
      activeModalEl = null;
      callback(false);
    });
  }

  // ==========================================
  // SILENT PREVIEW MEDIA CAPTURE
  // ==========================================

  function setupPreviewMediaCapture() {
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
      input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
          const base64 = evt.target.result;
          const stored = await chrome.storage.local.get(['profile']);
          const prof = stored.profile || {};
          if (!prof.media) prof.media = {};

          const isSignature = /sig|sign/i.test(input.name) || /sig|sign/i.test(input.id);
          if (isSignature) {
            prof.media.signature_base64 = base64;
          } else {
            prof.media.photo_base64 = base64;
          }

          await chrome.storage.local.set({ profile: prof });
          currentProfile = prof;
        };
        reader.readAsDataURL(file);
      });
    });
  }

  // ==========================================
  // AUTOFILL EXECUTION ENGINE
  // ==========================================

  function triggerEvents(element) {
    if (!element) return;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function setVal(selectorOrEl, val) {
    const el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
    if (el && val !== undefined && val !== null && val !== '') {
      el.value = val;
      triggerEvents(el);
      return true;
    }
    return false;
  }

  function selectOption(selectorOrEl, valueOrText) {
    const el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
    if (!el || valueOrText === undefined || valueOrText === null || valueOrText === '') return false;

    const target = String(valueOrText).trim().toLowerCase();

    for (let i = 0; i < el.options.length; i++) {
      const opt = el.options[i];
      if (opt.value && opt.value.trim().toLowerCase() === target) {
        el.selectedIndex = i;
        triggerEvents(el);
        if (typeof el.onchange === 'function') el.onchange();
        return true;
      }
    }

    for (let i = 0; i < el.options.length; i++) {
      const opt = el.options[i];
      const txt = (opt.textContent || '').trim().toLowerCase();
      if (txt === target) {
        el.selectedIndex = i;
        triggerEvents(el);
        if (typeof el.onchange === 'function') el.onchange();
        return true;
      }
    }

    for (let i = 0; i < el.options.length; i++) {
      const opt = el.options[i];
      const txt = (opt.textContent || '').trim().toLowerCase();
      if (txt && (txt.includes(target) || target.includes(txt))) {
        el.selectedIndex = i;
        triggerEvents(el);
        if (typeof el.onchange === 'function') el.onchange();
        return true;
      }
    }

    return false;
  }

  async function waitForOptions(selectorOrEl, minCount = 1, maxWaitMs = 1500) {
    const el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
    if (!el) return;
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      if (el.options && el.options.length > minCount) return;
      await sleep(60);
    }
  }

  async function fillApplicationForm(profile) {
    if (!profile) return;
    console.log('[BD Govt Job Autofill] Filling form with profile:', profile);

    const startTime = performance.now();
    let filledCount = 0;

    // --- 1. PERSONAL INFORMATION ---
    const p = profile.personal || {};

    if (setVal('#name', p.name ? p.name.toUpperCase().trim() : '')) filledCount++;
    if (setVal('#name_bn', p.name_bn || '')) filledCount++;
    if (setVal('#father', p.father ? p.father.toUpperCase().trim() : '')) filledCount++;
    if (setVal('#father_bn', p.father_bn || '')) filledCount++;
    if (setVal('#mother', p.mother ? p.mother.toUpperCase().trim() : '')) filledCount++;
    if (setVal('#mother_bn', p.mother_bn || '')) filledCount++;

    if (p.dob) {
      const dobEl = document.getElementById('dob');
      if (dobEl) {
        dobEl.value = p.dob;
        try { dobEl.valueAsDate = new Date(p.dob); } catch (e) {}
        triggerEvents(dobEl);
        filledCount++;
      }
    }

    if (selectOption('#nationality', p.nationality || 'Bangladeshi')) filledCount++;
    if (selectOption('#religion', p.religion || '1')) filledCount++;
    if (selectOption('#gender', p.gender || 'Male')) filledCount++;

    // NID
    const nidVal = p.nid === '1' || p.nid === 1 || p.nid === true || p.nid === 'Yes' ? '1' : '0';
    if (selectOption('#nid', nidVal)) {
      filledCount++;
      const nidEl = document.getElementById('nid');
      if (window.onChangeId && nidEl) window.onChangeId(nidEl, 'nidElm');
      if (nidVal === '1' && p.nid_no) {
        await sleep(50);
        if (setVal('#nid_no', p.nid_no)) filledCount++;
      }
    }

    // Birth Registration
    const bregVal = p.breg === '1' || p.breg === 1 || p.breg === true || p.breg === 'Yes' ? '1' : '0';
    if (selectOption('#breg', bregVal)) {
      filledCount++;
      const bregEl = document.getElementById('breg');
      if (window.onChangeId && bregEl) window.onChangeId(bregEl, 'bregElm');
      if (bregVal === '1' && p.breg_no) {
        await sleep(50);
        if (setVal('#breg_no', p.breg_no)) filledCount++;
      }
    }

    // Passport
    const passVal = p.passport === '1' || p.passport === 1 || p.passport === true || p.passport === 'Yes' ? '1' : '0';
    if (selectOption('#passport', passVal)) {
      filledCount++;
      const passEl = document.getElementById('passport');
      if (window.onChangeId && passEl) window.onChangeId(passEl, 'passportElm');
      if (passVal === '1' && p.passport_no) {
        await sleep(50);
        if (setVal('#passport_no', p.passport_no)) filledCount++;
      }
    }

    // Marital Status
    if (p.marital_status && selectOption('#marital_status', p.marital_status)) {
      filledCount++;
      const msEl = document.getElementById('marital_status');
      if (window.onChangeId && msEl) window.onChangeId(msEl, 'maritalElm');
      if (p.marital_status === 'Married' && p.spouse_name) {
        await sleep(50);
        if (setVal('#spouse_name', p.spouse_name)) filledCount++;
      }
    }

    // Quota
    if (p.quota && selectOption('#quota', p.quota)) {
      filledCount++;
      const quotaEl = document.getElementById('quota');
      if (window.onChangeQuota && quotaEl) window.onChangeQuota(quotaEl);
      if (window.onChangeId && quotaEl) window.onChangeId(quotaEl, 'quotaDetailsElm');
      if (p.quota_details) {
        await sleep(50);
        if (setVal('#quota_details', p.quota_details)) filledCount++;
      }
    }

    // Departmental Status
    if (p.dep_status && selectOption('#dep_status', p.dep_status)) filledCount++;

    // --- 2. CONTACT INFORMATION ---
    const c = profile.contact || {};
    if (setVal('#mobile', c.mobile || '')) filledCount++;
    if (setVal('#confirm_mobile', c.confirm_mobile || c.mobile || '')) filledCount++;
    if (setVal('#email', c.email || '')) filledCount++;

    // --- 3. PRESENT ADDRESS ---
    const addr = profile.address || {};
    const pres = addr.present || {};
    if (setVal('#present_careof', pres.careof || '')) filledCount++;
    if (setVal('#present_village', pres.village || '')) filledCount++;

    if (pres.district_code || pres.district_name) {
      const distVal = pres.district_code || pres.district_name;
      if (selectOption('#present_district', distVal)) {
        filledCount++;
        const distEl = document.getElementById('present_district');
        if (window.onChangeDistrict && distEl) window.onChangeDistrict(distEl, 'present_upazila');
        await waitForOptions('#present_upazila', 1);

        if (pres.upazila_code || pres.upazila_name) {
          const upzVal = pres.upazila_code || pres.upazila_name;
          if (selectOption('#present_upazila', upzVal)) filledCount++;
        }
      }
    }

    if (setVal('#present_post', pres.post || '')) filledCount++;
    if (setVal('#present_postcode', pres.postcode || '')) filledCount++;

    // --- 4. PERMANENT ADDRESS (IF DIFFERENT FROM PRESENT) ---
    const perm = addr.permanent || {};
    const sameCheckbox = document.getElementById('same_as_present');
    if (!addr.same_as_present) {
      if (sameCheckbox && sameCheckbox.checked) {
        sameCheckbox.checked = false;
        triggerEvents(sameCheckbox);
        if (sameCheckbox.onclick) sameCheckbox.onclick();
        if (window.onOffSameAsBtn) window.onOffSameAsBtn(sameCheckbox);
      }
      if (setVal('#permanent_careof', perm.careof || '')) filledCount++;
      if (setVal('#permanent_village', perm.village || '')) filledCount++;

      if (perm.district_code || perm.district_name) {
        const pDistVal = perm.district_code || perm.district_name;
        if (selectOption('#permanent_district', pDistVal)) {
          filledCount++;
          const permDistEl = document.getElementById('permanent_district');
          if (window.onChangeDistrict && permDistEl) window.onChangeDistrict(permDistEl, 'permanent_upazila');
          await waitForOptions('#permanent_upazila', 1);

          if (perm.upazila_code || perm.upazila_name) {
            const pUpzVal = perm.upazila_code || perm.upazila_name;
            if (selectOption('#permanent_upazila', pUpzVal)) filledCount++;
          }
        }
      }
      if (setVal('#permanent_post', perm.post || '')) filledCount++;
      if (setVal('#permanent_postcode', perm.postcode || '')) filledCount++;
    }

    // --- 5. EDUCATION: SSC ---
    const edu = profile.education || {};
    const ssc = edu.ssc || {};
    if (ssc.enabled !== false && document.getElementById('ssc_exam')) {
      const ifSsc = document.getElementById('if_applicable_ssc');
      if (ifSsc && !ifSsc.checked) {
        ifSsc.click();
        await sleep(100);
      }

      if (selectOption('#ssc_exam', ssc.exam || ssc.exam_name || '1')) {
        filledCount++;
        const sscExamEl = document.getElementById('ssc_exam');
        if (window.onChangeExamTypeSSC && sscExamEl) window.onChangeExamTypeSSC(sscExamEl);
        await waitForOptions('#ssc_group', 1);
      }

      if (selectOption('#ssc_board', ssc.board || ssc.board_name || '14')) filledCount++;
      if (setVal('#ssc_roll', ssc.roll || '')) filledCount++;

      if (selectOption('#ssc_result_type', ssc.result_type || '5')) {
        filledCount++;
        const resEl = document.getElementById('ssc_result_type');
        if (window.onChangeResult && resEl) window.onChangeResult(resEl);
      }
      if (ssc.result && setVal('#ssc_result', ssc.result)) filledCount++;

      if (selectOption('#ssc_group', ssc.group || ssc.group_name || '1')) filledCount++;
      if (selectOption('#ssc_year', ssc.year || '2014')) filledCount++;
    }

    // --- 6. EDUCATION: HSC ---
    const hsc = edu.hsc || {};
    if (hsc.enabled !== false && document.getElementById('hsc_exam')) {
      const ifHsc = document.getElementById('if_applicable_hsc');
      if (ifHsc && !ifHsc.checked) {
        ifHsc.click();
        await sleep(100);
      }

      if (selectOption('#hsc_exam', hsc.exam || hsc.exam_name || '1')) {
        filledCount++;
        const hscExamEl = document.getElementById('hsc_exam');
        if (window.onChangeExamTypeHSC && hscExamEl) window.onChangeExamTypeHSC(hscExamEl);
        await waitForOptions('#hsc_group', 1);
      }

      if (selectOption('#hsc_board', hsc.board || hsc.board_name || '14')) filledCount++;
      if (setVal('#hsc_roll', hsc.roll || '')) filledCount++;

      if (selectOption('#hsc_result_type', hsc.result_type || '5')) {
        filledCount++;
        const resEl = document.getElementById('hsc_result_type');
        if (window.onChangeResult && resEl) window.onChangeResult(resEl);
      }
      if (hsc.result && setVal('#hsc_result', hsc.result)) filledCount++;

      if (selectOption('#hsc_group', hsc.group || hsc.group_name || '1')) filledCount++;
      if (selectOption('#hsc_year', hsc.year || '2016')) filledCount++;
    }

    // --- 7. EDUCATION: GRADUATION ---
    const gra = edu.graduation || {};
    if (gra.enabled !== false && document.getElementById('gra_exam')) {
      const ifGra = document.getElementById('if_applicable_gra');
      if (ifGra && !ifGra.checked) {
        ifGra.click();
        await sleep(100);
      }

      if (selectOption('#gra_exam', gra.exam || gra.exam_name)) {
        filledCount++;
        const graExamEl = document.getElementById('gra_exam');
        if (window.onChangeExamTypeGRA && graExamEl) window.onChangeExamTypeGRA(graExamEl);
        await waitForOptions('#gra_subject', 1);
      }

      if (selectOption('#gra_institute', gra.institute || gra.institute_name)) filledCount++;
      if (selectOption('#gra_subject', gra.subject || gra.subject_name)) filledCount++;

      if (selectOption('#gra_result_type', gra.result_type)) {
        filledCount++;
        const resEl = document.getElementById('gra_result_type');
        if (window.onChangeResult && resEl) window.onChangeResult(resEl);
      }
      if (gra.result && setVal('#gra_result', gra.result)) filledCount++;

      if (selectOption('#gra_duration', gra.duration)) filledCount++;
      if (selectOption('#gra_year', gra.year)) filledCount++;
    }

    // --- 8. EDUCATION: MASTERS ---
    const mas = edu.masters || {};
    if (mas.enabled && (document.getElementById('mas_exam') || document.getElementById('if_applicable_mas'))) {
      const ifMas = document.getElementById('if_applicable_mas');
      if (ifMas && !ifMas.checked) {
        ifMas.click();
        await sleep(100);
      }

      if (selectOption('#mas_exam', mas.exam || mas.exam_name)) filledCount++;
      if (selectOption('#mas_institute', mas.institute || mas.institute_name)) filledCount++;
      if (selectOption('#mas_subject', mas.subject || mas.subject_name)) filledCount++;

      if (selectOption('#mas_result_type', mas.result_type)) {
        filledCount++;
        const resEl = document.getElementById('mas_result_type');
        if (window.onChangeResult && resEl) window.onChangeResult(resEl);
      }
      if (mas.result && setVal('#mas_result', mas.result)) filledCount++;

      if (selectOption('#mas_duration', mas.duration)) filledCount++;
      if (selectOption('#mas_year', mas.year)) filledCount++;
    }

    // --- 9. JOB EXPERIENCE ---
    const exp = profile.experience || {};
    if (exp.enabled && exp.jobs && exp.jobs.length && document.getElementById('if_applicable_exp')) {
      const ifExp = document.getElementById('if_applicable_exp');
      if (ifExp && !ifExp.checked) {
        ifExp.click();
        await sleep(150);
      }

      const job0 = exp.jobs[0];
      if (job0) {
        if (selectOption('#employment_type', job0.employment_type)) filledCount++;
        if (setVal('#designation', job0.designation)) filledCount++;
        if (setVal('#organization', job0.organization)) filledCount++;
        if (setVal('#office_address', job0.office_address)) filledCount++;
        if (setVal('#job_start_date', job0.job_start_date)) filledCount++;
        if (job0.currently_working) {
          const cwEl = document.getElementById('currently_working');
          if (cwEl && !cwEl.checked) {
            cwEl.checked = true;
            triggerEvents(cwEl);
            if (cwEl.onclick) cwEl.onclick();
            filledCount++;
          }
        } else if (job0.job_end_date) {
          if (setVal('#job_end_date', job0.job_end_date)) filledCount++;
        }
        if (setVal('#last_salary', job0.last_salary)) filledCount++;
        if (setVal('#job_description', job0.job_description)) filledCount++;
      }
    }

    // --- 10. PHOTO & SIGNATURE ---
    const media = profile.media || {};
    if (media.photo_base64 || media.signature_base64) {
      const form = document.getElementById('applicationForm');
      if (form) {
        if (media.photo_base64) {
          const cleanPhoto = media.photo_base64.replace(/^data:image\/[a-z]+;base64,/, '');
          let photoInput = form.querySelector('input[name="image"]');
          if (!photoInput) {
            photoInput = document.createElement('input');
            photoInput.type = 'hidden';
            photoInput.name = 'image';
            form.prepend(photoInput);
          }
          photoInput.value = cleanPhoto;

          const photoView = document.getElementById('photo_view');
          const photoWrapper = document.getElementById('photo_view_wrapper');
          if (photoView) photoView.src = 'data:image/jpeg;base64,' + cleanPhoto;
          if (photoWrapper) photoWrapper.style.display = 'block';
        }

        if (media.signature_base64) {
          const cleanSig = media.signature_base64.replace(/^data:image\/[a-z]+;base64,/, '');
          let sigInput = form.querySelector('input[name="signature"]');
          if (!sigInput) {
            sigInput = document.createElement('input');
            sigInput.type = 'hidden';
            sigInput.name = 'signature';
            form.prepend(sigInput);
          }
          sigInput.value = cleanSig;

          const sigView = document.getElementById('signature_view');
          if (sigView) {
            sigView.src = 'data:image/jpeg;base64,' + cleanSig;
            sigView.style.display = 'block';
          }
        }
      }
    }

    // --- 11. DECLARATION ---
    if (currentSettings.auto_check_agreement !== false) {
      const agreeEl = document.getElementById('agree');
      if (agreeEl && !agreeEl.checked) {
        agreeEl.checked = true;
        triggerEvents(agreeEl);
        filledCount++;
      }
    }

    // --- 12. SAME AS PRESENT ADDRESS (CHECKED AT THE VERY END) ---
    // Requirement: Check "same as present" after all fields are filled up, else it keeps empty
    if (addr.same_as_present) {
      const sameCheckbox = document.getElementById('same_as_present');
      if (sameCheckbox) {
        await sleep(150);

        // Ensure present upazila is selected if options finished loading late
        if (pres.upazila_code || pres.upazila_name) {
          const upzEl = document.getElementById('present_upazila');
          if (upzEl && (!upzEl.value || upzEl.selectedIndex <= 0)) {
            selectOption('#present_upazila', pres.upazila_code || pres.upazila_name);
          }
        }

        // Proactively copy all fields from present to permanent to guarantee values are never empty
        const pairs = [
          ['#present_careof', '#permanent_careof'],
          ['#present_village', '#permanent_village'],
          ['#present_post', '#permanent_post'],
          ['#present_postcode', '#permanent_postcode']
        ];
        for (const [presSel, permSel] of pairs) {
          const pEl = document.querySelector(presSel);
          const mEl = document.querySelector(permSel);
          if (pEl && mEl && pEl.value) {
            mEl.value = pEl.value;
            triggerEvents(mEl);
          }
        }

        const presDist = document.getElementById('present_district');
        const permDist = document.getElementById('permanent_district');
        if (presDist && permDist && presDist.value) {
          permDist.value = presDist.value;
          triggerEvents(permDist);
        }

        const presUpz = document.getElementById('present_upazila');
        const permUpz = document.getElementById('permanent_upazila');
        if (presUpz && permUpz && presUpz.value) {
          if (permUpz.options.length <= 1 && presUpz.options.length > 1) {
            permUpz.innerHTML = presUpz.innerHTML;
          }
          permUpz.value = presUpz.value;
          triggerEvents(permUpz);
        }

        // Trigger the checkbox click to invoke Teletalk's native handler
        if (!sameCheckbox.checked) {
          sameCheckbox.click();
        } else {
          sameCheckbox.checked = true;
          triggerEvents(sameCheckbox);
        }

        if (typeof sameCheckbox.onclick === 'function') {
          try { sameCheckbox.onclick(); } catch (e) {}
        }
        if (window.onOffSameAsBtn) {
          try { window.onOffSameAsBtn(sameCheckbox); } catch (e) {}
        }

        await sleep(100);

        // Fallback check: if any permanent field was blanked out by Teletalk's handler, restore it
        for (const [presSel, permSel] of pairs) {
          const pEl = document.querySelector(presSel);
          const mEl = document.querySelector(permSel);
          if (pEl && mEl && !mEl.value && pEl.value) {
            mEl.value = pEl.value;
            triggerEvents(mEl);
          }
        }
        if (presDist && permDist && !permDist.value && presDist.value) {
          permDist.value = presDist.value;
          triggerEvents(permDist);
        }
        if (presUpz && permUpz && !permUpz.value && presUpz.value) {
          if (permUpz.options.length <= 1 && presUpz.options.length > 1) {
            permUpz.innerHTML = presUpz.innerHTML;
          }
          permUpz.value = presUpz.value;
          triggerEvents(permUpz);
        }

        filledCount++;
      }
    }

    // --- 13. FOCUS CAPTCHA ---
    if (currentSettings.focus_captcha !== false) {
      const captchaEl = document.getElementById('captcha');
      if (captchaEl) {
        captchaEl.classList.add('bd-job-captcha-highlight');
        captchaEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        captchaEl.focus();
      }
    }

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    console.log(`[BD Govt Job Autofill] Completed! Filled ${filledCount} fields in ${elapsed}s.`);
    showToast(`✅ Successfully filled ${filledCount} fields in ${elapsed}s! Please enter Captcha code to finish.`, 'success');

    return { success: true, count: filledCount, time: elapsed };
  }

  // Toast Notification
  function showToast(message, type = 'success') {
    const existing = document.querySelector('.bd-job-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `bd-job-toast ${type}`;
    const icon = type === 'success' ? '✅' : (type === 'warning' ? '⚠️' : (type === 'info' ? 'ℹ️' : '❌'));
    toast.innerHTML = `<div>${icon}</div><div>${message}</div>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkStatus') {
      const hasForm = !!document.getElementById('applicationForm');
      const candidateName = getVal('name');
      sendResponse({
        isApplicationPage,
        isPreviewPage,
        hasForm,
        hasValuesOnPage: !!(candidateName && candidateName.length >= 2),
        hasSavedProfile: !!(currentProfile && currentProfile.personal && currentProfile.personal.name),
        url: window.location.href
      });
      return true;
    }

    if (request.action === 'triggerAutofill') {
      chrome.storage.local.get(['profile'], async (res) => {
        if (!res.profile || !res.profile.personal || !res.profile.personal.name) {
          sendResponse({ success: false, message: 'No profile saved yet! Fill any Teletalk form once to save.' });
          return;
        }
        hasAutofilledOnThisPage = true;
        const result = await fillApplicationForm(res.profile);
        sendResponse(result);
      });
      return true;
    }
  });

  // Start initialization
  init();
})();
