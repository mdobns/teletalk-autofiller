// BD Govt Job Autofill - Content Script
// Handles intelligent form filling and AUTOMATIC FORM CAPTURE on submit

(function () {
  'use strict';

  console.log('[BD Govt Job Autofill] Content script initialized on:', window.location.href);

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Determine page type
  const applicationForm = document.getElementById('applicationForm');
  const isApplicationPage = !!applicationForm;
  const isPreviewPage = window.location.pathname.includes('preview.php');

  let currentProfile = null;
  let currentSettings = {
    auto_fill_on_load: false,
    auto_capture_on_submit: true,
    auto_check_agreement: true,
    focus_captcha: true,
    show_floating_button: true
  };

  // Sync temporary captured profile from localStorage if any
  try {
    const tempSaved = localStorage.getItem('bd_job_profile_captured');
    if (tempSaved) {
      const parsed = JSON.parse(tempSaved);
      if (parsed && parsed.personal && parsed.personal.name) {
        chrome.storage.local.set({ profile: parsed });
        console.log('[BD Govt Job Autofill] Synced captured profile from localStorage to storage.local');
      }
      localStorage.removeItem('bd_job_profile_captured');
    }
  } catch (e) {}

  // Initialize
  async function init() {
    try {
      const data = await chrome.storage.local.get(['profile', 'settings']);
      currentProfile = data.profile || null;
      if (data.settings) currentSettings = { ...currentSettings, ...data.settings };

      if (isApplicationPage) {
        if (currentSettings.show_floating_button !== false) {
          injectFloatingWidget();
        }

        // Attach automatic form capture on submission
        setupAutoCaptureOnSubmit();

        // Auto-fill on page load if profile exists and setting is enabled
        if (currentSettings.auto_fill_on_load && currentProfile && currentProfile.personal && currentProfile.personal.name) {
          console.log('[BD Govt Job Autofill] Auto-filling on page load...');
          await sleep(600);
          await fillApplicationForm(currentProfile);
        }
      } else if (isPreviewPage) {
        setupPreviewHelper();
      }
    } catch (e) {
      console.error('[BD Govt Job Autofill] Init error:', e);
    }
  }

  // ==========================================
  // FORM EXTRACTION & CAPTURE LOGIC
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

  // Extract all fields currently entered on the Teletalk form
  function extractProfileFromForm() {
    if (!applicationForm) return null;

    const name = getVal('name');
    if (!name || name.length < 2) {
      return null; // Not filled enough to capture
    }

    const sameAddress = isChecked('same_as_present');

    const presDistName = getOptText('present_district').replace(/\s*\(.*\)/, '').trim();
    const presUpzName = getOptText('present_upazila').trim();

    const permDistName = sameAddress ? presDistName : getOptText('permanent_district').replace(/\s*\(.*\)/, '').trim();
    const permUpzName = sameAddress ? presUpzName : getOptText('permanent_upazila').trim();

    // Retain existing media (photo/signature) if already saved
    const existingMedia = (currentProfile && currentProfile.media) ? currentProfile.media : { photo_base64: '', signature_base64: '' };

    const captured = {
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
      settings: currentSettings,
      media: existingMedia
    };

    return captured;
  }

  // Save captured profile to local and chrome storage
  async function saveExtractedProfile(source = 'submit') {
    const extracted = extractProfileFromForm();
    if (!extracted) {
      if (source === 'manual') {
        showToast('Please enter at least your Name before saving!', 'warning');
      }
      return false;
    }

    try {
      // 1. Synchronous localStorage save (guaranteed before navigation)
      localStorage.setItem('bd_job_profile_captured', JSON.stringify(extracted));
      
      // 2. Chrome Extension local storage
      await chrome.storage.local.set({ profile: extracted });
      currentProfile = extracted;

      // 3. Notify background worker
      chrome.runtime.sendMessage({ action: 'profileCaptured' });

      console.log(`[BD Govt Job Autofill] Profile successfully captured via ${source}:`, extracted);

      showToast(`💾 Profile for "${extracted.personal.name}" saved! Future Teletalk applications will autofill automatically.`, 'success');
      updateWidgetUI();
      return true;
    } catch (err) {
      console.error('[BD Govt Job Autofill] Failed to save captured profile:', err);
      return false;
    }
  }

  // Setup auto-capture on form submit
  function setupAutoCaptureOnSubmit() {
    if (!applicationForm) return;

    // Listen on submit event in capture phase
    applicationForm.addEventListener('submit', () => {
      saveExtractedProfile('form_submit');
    }, true);

    // Also listen on submit button click
    const submitBtn = document.getElementById('submit') || applicationForm.querySelector('button[type="submit"], input[type="submit"]');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        saveExtractedProfile('submit_button_click');
      });
    }

    // Auto-save draft on input change when user leaves field
    applicationForm.addEventListener('change', () => {
      const name = getVal('name');
      if (name && name.length >= 3) {
        // Debounced or direct draft capture in background
        const draft = extractProfileFromForm();
        if (draft) {
          localStorage.setItem('bd_job_profile_captured', JSON.stringify(draft));
        }
      }
    });
  }

  // ==========================================
  // FLOATING WIDGET UI
  // ==========================================

  function injectFloatingWidget() {
    if (document.getElementById('bd-job-autofill-widget')) return;

    const widget = document.createElement('div');
    widget.id = 'bd-job-autofill-widget';
    document.body.appendChild(widget);

    updateWidgetUI();
  }

  function updateWidgetUI() {
    const widget = document.getElementById('bd-job-autofill-widget');
    if (!widget) return;

    const hasSavedProfile = currentProfile && currentProfile.personal && currentProfile.personal.name;

    if (hasSavedProfile) {
      // Profile exists: Primary action is Autofill, with secondary Capture/Update button
      widget.innerHTML = `
        <button type="button" class="bd-job-widget-btn" id="bd-job-fill-btn" title="Autofill this form with saved profile">
          <span>⚡ Autofill Job Form</span>
          <span class="bd-job-widget-badge green">Ready</span>
        </button>
        <button type="button" class="bd-job-widget-action" id="bd-job-update-btn" title="Capture & update saved profile with this form's current values">
          <span>💾 Save Form</span>
        </button>
        <button type="button" class="bd-job-widget-gear" id="bd-job-gear-btn" title="Edit Profile & Settings">⚙️</button>
      `;

      document.getElementById('bd-job-fill-btn').addEventListener('click', async () => {
        const btn = document.getElementById('bd-job-fill-btn');
        btn.disabled = true;
        btn.querySelector('span').innerText = '⏳ Filling Form...';
        await fillApplicationForm(currentProfile);
        btn.disabled = false;
        btn.querySelector('span').innerText = '⚡ Autofill Job Form';
      });

      document.getElementById('bd-job-update-btn').addEventListener('click', async () => {
        await saveExtractedProfile('manual');
      });
    } else {
      // Profile is empty: Guide the user to fill and capture
      widget.innerHTML = `
        <button type="button" class="bd-job-widget-btn capture-mode" id="bd-job-capture-btn" title="Save this form's data as your profile">
          <span>💾 Save Profile from Form</span>
          <span class="bd-job-widget-badge">1st Setup</span>
        </button>
        <button type="button" class="bd-job-widget-gear" id="bd-job-gear-btn" title="Profile Settings">⚙️</button>
      `;

      document.getElementById('bd-job-capture-btn').addEventListener('click', async () => {
        await saveExtractedProfile('manual');
      });
    }

    document.getElementById('bd-job-gear-btn').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openOptionsPage' });
    });
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
    }, 5000);
  }

  // ==========================================
  // AUTOFILL ENGINE (FILLS FORM USING PROFILE)
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

    // Pass 1: Exact match on option.value
    for (let i = 0; i < el.options.length; i++) {
      const opt = el.options[i];
      if (opt.value && opt.value.trim().toLowerCase() === target) {
        el.selectedIndex = i;
        triggerEvents(el);
        if (typeof el.onchange === 'function') el.onchange();
        return true;
      }
    }

    // Pass 2: Exact match on option text
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

    // Pass 3: Fuzzy / contains match
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

    // Present District -> Upazila Cascade
    if (pres.district_code || pres.district_name) {
      const distVal = pres.district_code || pres.district_name;
      if (selectOption('#present_district', distVal)) {
        filledCount++;
        const distEl = document.getElementById('present_district');
        if (window.onChangeDistrict && distEl) {
          window.onChangeDistrict(distEl, 'present_upazila');
        }
        await waitForOptions('#present_upazila', 1);

        if (pres.upazila_code || pres.upazila_name) {
          const upzVal = pres.upazila_code || pres.upazila_name;
          if (selectOption('#present_upazila', upzVal)) filledCount++;
        }
      }
    }

    if (setVal('#present_post', pres.post || '')) filledCount++;
    if (setVal('#present_postcode', pres.postcode || '')) filledCount++;

    // --- 4. PERMANENT ADDRESS ---
    const perm = addr.permanent || {};
    const sameCheckbox = document.getElementById('same_as_present');
    if (addr.same_as_present) {
      if (sameCheckbox) {
        sameCheckbox.checked = true;
        sameCheckbox.setAttribute('checked', 'checked');
        triggerEvents(sameCheckbox);
        if (sameCheckbox.onclick) sameCheckbox.onclick();
        if (window.onOffSameAsBtn) window.onOffSameAsBtn(sameCheckbox);
        filledCount++;
      }
    } else {
      if (sameCheckbox && sameCheckbox.checked) {
        sameCheckbox.checked = false;
        triggerEvents(sameCheckbox);
        if (sameCheckbox.onclick) sameCheckbox.onclick();
        if (window.onOffSameAsBtn) window.onOffSameAsBtn(sameCheckbox);
      }
      if (setVal('#permanent_careof', perm.careof || '')) filledCount++;
      if (setVal('#permanent_village', perm.village || '')) filledCount++;

      // Permanent District -> Upazila Cascade
      if (perm.district_code || perm.district_name) {
        const pDistVal = perm.district_code || perm.district_name;
        if (selectOption('#permanent_district', pDistVal)) {
          filledCount++;
          const permDistEl = document.getElementById('permanent_district');
          if (window.onChangeDistrict && permDistEl) {
            window.onChangeDistrict(permDistEl, 'permanent_upazila');
          }
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

    // --- 10. PHOTO & SIGNATURE HIDDEN INJECTION ---
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

    // --- 11. DECLARATION & CAPTCHA FOCUS ---
    if (currentSettings.auto_check_agreement !== false) {
      const agreeEl = document.getElementById('agree');
      if (agreeEl && !agreeEl.checked) {
        agreeEl.checked = true;
        triggerEvents(agreeEl);
        filledCount++;
      }
    }

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

  // ==========================================
  // PREVIEW PAGE HELPER & MEDIA CAPTURE
  // ==========================================

  function setupPreviewHelper() {
    if (document.getElementById('bd-job-preview-bar')) return;

    const bar = document.createElement('div');
    bar.id = 'bd-job-preview-bar';
    bar.innerHTML = `
      <div class="info">
        <strong>🇧🇩 BD Govt Job Helper (Preview Step)</strong><br>
        <span>Your application data is saved. If you select photo and signature files below, they will also be saved for future autofills!</span>
      </div>
      <div class="actions" id="previewMediaActions"></div>
    `;

    const form = document.querySelector('form') || document.body;
    form.parentNode.insertBefore(bar, form);

    updatePreviewBarButtons();

    // Auto-check declaration checkbox if present on preview page
    const agree = document.querySelector('input[type="checkbox"][name*="agree"], input[type="checkbox"][name*="declaration"], #agree');
    if (agree && !agree.checked) {
      agree.checked = true;
      triggerEvents(agree);
    }

    // Automatically capture photo & signature when user selects file inputs on preview page!
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
          const base64 = evt.target.result;
          const stored = await chrome.storage.local.get(['profile']);
          const prof = stored.profile || {};
          if (!prof.media) prof.media = {};

          // Detect whether photo or signature based on input name/id or image dimensions
          const isSignature = /sig|sign/i.test(input.name) || /sig|sign/i.test(input.id);
          if (isSignature) {
            prof.media.signature_base64 = base64;
            showToast('✍️ Signature file captured and saved to profile!', 'info');
          } else {
            prof.media.photo_base64 = base64;
            showToast('📷 Photo file captured and saved to profile!', 'info');
          }

          await chrome.storage.local.set({ profile: prof });
          currentProfile = prof;
          updatePreviewBarButtons();
        };
        reader.readAsDataURL(file);
      });
    });
  }

  function updatePreviewBarButtons() {
    const actions = document.getElementById('previewMediaActions');
    if (!actions) return;
    const media = (currentProfile && currentProfile.media) ? currentProfile.media : {};

    actions.innerHTML = `
      ${media.photo_base64 ? `<a href="${media.photo_base64}" download="applicant_photo_300x300.jpg" class="bd-preview-btn">📥 Download Photo</a>` : ''}
      ${media.signature_base64 ? `<a href="${media.signature_base64}" download="applicant_signature_300x80.jpg" class="bd-preview-btn">📥 Download Signature</a>` : ''}
    `;
  }

  // ==========================================
  // POPUP & BACKGROUND COMMUNICATION
  // ==========================================

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
          sendResponse({ success: false, message: 'No profile configured yet! Please fill the form and click "Save Profile from Form".' });
          return;
        }
        const result = await fillApplicationForm(res.profile);
        sendResponse(result);
      });
      return true;
    }

    if (request.action === 'captureFromPage') {
      saveExtractedProfile('popup_manual').then(success => {
        sendResponse({ success, profile: currentProfile });
      });
      return true;
    }
  });

  // Start
  init();
})();
