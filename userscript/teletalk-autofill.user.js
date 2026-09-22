// ==UserScript==
// @name         BD Govt Job Autofill (Teletalk)
// @namespace    https://github.com/bangladesh-gov-jobs/teletalk-autofill
// @version      1.0.0
// @description  Autofill Bangladesh government job application forms on all Teletalk portals (*.teletalk.com.bd)
// @author       BD Job Assistant
// @match        *://*.teletalk.com.bd/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  console.log('[BD Govt Job Userscript] Loaded on:', window.location.href);

  // Storage helper (GM storage with localStorage fallback)
  const Storage = {
    get: (key, defVal) => {
      try {
        if (typeof GM_getValue !== 'undefined') return GM_getValue(key, defVal);
        const val = localStorage.getItem('bd_job_' + key);
        return val ? JSON.parse(val) : defVal;
      } catch (e) {
        return defVal;
      }
    },
    set: (key, val) => {
      try {
        if (typeof GM_setValue !== 'undefined') return GM_setValue(key, val);
        localStorage.setItem('bd_job_' + key, JSON.stringify(val));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const sleep = (ms) => new Promise(res => setTimeout(res, ms));

  // Default demo profile if empty
  const defaultProfile = {
    personal: {
      name: "MD. RAHIM AHMED",
      name_bn: "মোঃ রহিম আহমেদ",
      father: "MD. KARIM AHMED",
      father_bn: "মোঃ করিম আহমেদ",
      mother: "RAHIMA BEGUM",
      mother_bn: "রহিমা বেগম",
      dob: "1998-05-15",
      nationality: "Bangladeshi",
      religion: "1",
      gender: "Male",
      nid: "1",
      nid_no: "19981234567890123",
      breg: "0",
      breg_no: "",
      passport: "0",
      passport_no: "",
      marital_status: "Single",
      spouse_name: "",
      quota: "8",
      quota_details: "",
      dep_status: "5"
    },
    contact: {
      mobile: "01712345678",
      confirm_mobile: "01712345678",
      email: "rahim.job.bd@gmail.com"
    },
    address: {
      present: {
        careof: "MD. KARIM AHMED",
        village: "House 12, Road 4, Sector 10",
        district_code: "40",
        district_name: "Dhaka",
        upazila_code: "323",
        upazila_name: "Uttara",
        post: "Uttara",
        postcode: "1230"
      },
      same_as_present: true,
      permanent: {
        careof: "MD. KARIM AHMED",
        village: "House 12, Road 4, Sector 10",
        district_code: "40",
        district_name: "Dhaka",
        upazila_code: "323",
        upazila_name: "Uttara",
        post: "Uttara",
        postcode: "1230"
      }
    },
    education: {
      ssc: {
        enabled: true,
        exam: "1",
        board: "14",
        roll: "123456",
        result_type: "5",
        result: "5.00",
        group: "1",
        year: "2014"
      },
      hsc: {
        enabled: true,
        exam: "1",
        board: "14",
        roll: "654321",
        result_type: "5",
        result: "4.80",
        group: "1",
        year: "2016"
      },
      graduation: {
        enabled: true,
        exam: "1",
        institute: "105",
        year: "2021",
        subject: "112",
        subject_name: "Computer Science & Engineering",
        result_type: "4",
        result: "3.65",
        duration: "04"
      }
    }
  };

  let userProfile = Storage.get('profile', defaultProfile);

  // Helper functions
  function triggerEvents(el) {
    if (!el) return;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function setVal(sel, val) {
    const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (el && val !== undefined && val !== null && val !== '') {
      el.value = val;
      triggerEvents(el);
      return true;
    }
    return false;
  }

  function selectOption(sel, valOrTxt) {
    const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!el || !valOrTxt) return false;
    const target = String(valOrTxt).trim().toLowerCase();

    for (let i = 0; i < el.options.length; i++) {
      const opt = el.options[i];
      if (opt.value && opt.value.trim().toLowerCase() === target) {
        el.selectedIndex = i;
        triggerEvents(el);
        if (el.onchange) el.onchange();
        return true;
      }
    }

    for (let i = 0; i < el.options.length; i++) {
      const opt = el.options[i];
      const txt = (opt.textContent || '').trim().toLowerCase();
      if (txt === target || (txt && (txt.includes(target) || target.includes(txt)))) {
        el.selectedIndex = i;
        triggerEvents(el);
        if (el.onchange) el.onchange();
        return true;
      }
    }
    return false;
  }

  async function waitForOptions(sel, minCount = 1) {
    const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!el) return;
    const start = Date.now();
    while (Date.now() - start < 1500) {
      if (el.options && el.options.length > minCount) return;
      await sleep(60);
    }
  }

  // Form fill routine
  async function fillForm() {
    const p = userProfile.personal || {};
    let count = 0;

    if (setVal('#name', p.name ? p.name.toUpperCase().trim() : '')) count++;
    if (setVal('#name_bn', p.name_bn || '')) count++;
    if (setVal('#father', p.father ? p.father.toUpperCase().trim() : '')) count++;
    if (setVal('#father_bn', p.father_bn || '')) count++;
    if (setVal('#mother', p.mother ? p.mother.toUpperCase().trim() : '')) count++;
    if (setVal('#mother_bn', p.mother_bn || '')) count++;

    if (p.dob) {
      const dobEl = document.getElementById('dob');
      if (dobEl) {
        dobEl.value = p.dob;
        try { dobEl.valueAsDate = new Date(p.dob); } catch (e) {}
        triggerEvents(dobEl);
        count++;
      }
    }

    if (selectOption('#nationality', p.nationality || 'Bangladeshi')) count++;
    if (selectOption('#religion', p.religion || '1')) count++;
    if (selectOption('#gender', p.gender || 'Male')) count++;

    if (selectOption('#nid', p.nid || '1')) {
      count++;
      const nidEl = document.getElementById('nid');
      if (window.onChangeId && nidEl) window.onChangeId(nidEl, 'nidElm');
      if (p.nid_no) { await sleep(50); if (setVal('#nid_no', p.nid_no)) count++; }
    }

    if (selectOption('#breg', p.breg || '0')) {
      count++;
      const bregEl = document.getElementById('breg');
      if (window.onChangeId && bregEl) window.onChangeId(bregEl, 'bregElm');
      if (p.breg_no) { await sleep(50); if (setVal('#breg_no', p.breg_no)) count++; }
    }

    if (selectOption('#passport', p.passport || '0')) {
      count++;
      const passEl = document.getElementById('passport');
      if (window.onChangeId && passEl) window.onChangeId(passEl, 'passportElm');
      if (p.passport_no) { await sleep(50); if (setVal('#passport_no', p.passport_no)) count++; }
    }

    if (p.marital_status && selectOption('#marital_status', p.marital_status)) {
      count++;
      const msEl = document.getElementById('marital_status');
      if (window.onChangeId && msEl) window.onChangeId(msEl, 'maritalElm');
      if (p.marital_status === 'Married' && p.spouse_name) {
        await sleep(50);
        if (setVal('#spouse_name', p.spouse_name)) count++;
      }
    }

    if (p.quota && selectOption('#quota', p.quota)) {
      count++;
      const quotaEl = document.getElementById('quota');
      if (window.onChangeQuota && quotaEl) window.onChangeQuota(quotaEl);
      if (window.onChangeId && quotaEl) window.onChangeId(quotaEl, 'quotaDetailsElm');
      if (p.quota_details) { await sleep(50); if (setVal('#quota_details', p.quota_details)) count++; }
    }

    if (p.dep_status && selectOption('#dep_status', p.dep_status)) count++;

    // Contact
    const c = userProfile.contact || {};
    if (setVal('#mobile', c.mobile || '')) count++;
    if (setVal('#confirm_mobile', c.confirm_mobile || c.mobile || '')) count++;
    if (setVal('#email', c.email || '')) count++;

    // Present Address
    const pres = userProfile.address?.present || {};
    if (setVal('#present_careof', pres.careof || '')) count++;
    if (setVal('#present_village', pres.village || '')) count++;

    if (pres.district_code || pres.district_name) {
      if (selectOption('#present_district', pres.district_code || pres.district_name)) {
        count++;
        const distEl = document.getElementById('present_district');
        if (window.onChangeDistrict && distEl) window.onChangeDistrict(distEl, 'present_upazila');
        await waitForOptions('#present_upazila', 1);
        if (pres.upazila_code || pres.upazila_name) {
          if (selectOption('#present_upazila', pres.upazila_code || pres.upazila_name)) count++;
        }
      }
    }

    if (setVal('#present_post', pres.post || '')) count++;
    if (setVal('#present_postcode', pres.postcode || '')) count++;

    // Permanent Address
    const perm = userProfile.address?.permanent || {};
    const sameCheckbox = document.getElementById('same_as_present');
    if (userProfile.address?.same_as_present && sameCheckbox) {
      sameCheckbox.checked = true;
      triggerEvents(sameCheckbox);
      if (sameCheckbox.onclick) sameCheckbox.onclick();
      if (window.onOffSameAsBtn) window.onOffSameAsBtn(sameCheckbox);
      count++;
    } else if (sameCheckbox) {
      if (setVal('#permanent_careof', perm.careof || '')) count++;
      if (setVal('#permanent_village', perm.village || '')) count++;
      if (perm.district_code || perm.district_name) {
        if (selectOption('#permanent_district', perm.district_code || perm.district_name)) {
          count++;
          const pDist = document.getElementById('permanent_district');
          if (window.onChangeDistrict && pDist) window.onChangeDistrict(pDist, 'permanent_upazila');
          await waitForOptions('#permanent_upazila', 1);
          if (perm.upazila_code || perm.upazila_name) {
            if (selectOption('#permanent_upazila', perm.upazila_code || perm.upazila_name)) count++;
          }
        }
      }
      if (setVal('#permanent_post', perm.post || '')) count++;
      if (setVal('#permanent_postcode', perm.postcode || '')) count++;
    }

    // SSC
    const ssc = userProfile.education?.ssc || {};
    if (ssc.enabled !== false && document.getElementById('ssc_exam')) {
      const ifSsc = document.getElementById('if_applicable_ssc');
      if (ifSsc && !ifSsc.checked) { ifSsc.click(); await sleep(100); }
      if (selectOption('#ssc_exam', ssc.exam || '1')) {
        count++;
        const sscEl = document.getElementById('ssc_exam');
        if (window.onChangeExamTypeSSC && sscEl) window.onChangeExamTypeSSC(sscEl);
        await waitForOptions('#ssc_group', 1);
      }
      if (selectOption('#ssc_board', ssc.board || '14')) count++;
      if (setVal('#ssc_roll', ssc.roll || '')) count++;
      if (selectOption('#ssc_result_type', ssc.result_type || '5')) {
        count++;
        const rEl = document.getElementById('ssc_result_type');
        if (window.onChangeResult && rEl) window.onChangeResult(rEl);
      }
      if (ssc.result && setVal('#ssc_result', ssc.result)) count++;
      if (selectOption('#ssc_group', ssc.group || '1')) count++;
      if (selectOption('#ssc_year', ssc.year || '2014')) count++;
    }

    // HSC
    const hsc = userProfile.education?.hsc || {};
    if (hsc.enabled !== false && document.getElementById('hsc_exam')) {
      const ifHsc = document.getElementById('if_applicable_hsc');
      if (ifHsc && !ifHsc.checked) { ifHsc.click(); await sleep(100); }
      if (selectOption('#hsc_exam', hsc.exam || '1')) {
        count++;
        const hscEl = document.getElementById('hsc_exam');
        if (window.onChangeExamTypeHSC && hscEl) window.onChangeExamTypeHSC(hscEl);
        await waitForOptions('#hsc_group', 1);
      }
      if (selectOption('#hsc_board', hsc.board || '14')) count++;
      if (setVal('#hsc_roll', hsc.roll || '')) count++;
      if (selectOption('#hsc_result_type', hsc.result_type || '5')) {
        count++;
        const rEl = document.getElementById('hsc_result_type');
        if (window.onChangeResult && rEl) window.onChangeResult(rEl);
      }
      if (hsc.result && setVal('#hsc_result', hsc.result)) count++;
      if (selectOption('#hsc_group', hsc.group || '1')) count++;
      if (selectOption('#hsc_year', hsc.year || '2016')) count++;
    }

    // Graduation
    const gra = userProfile.education?.graduation || {};
    if (gra.enabled !== false && document.getElementById('gra_exam')) {
      const ifGra = document.getElementById('if_applicable_gra');
      if (ifGra && !ifGra.checked) { ifGra.click(); await sleep(100); }
      if (selectOption('#gra_exam', gra.exam || '1')) {
        count++;
        const graEl = document.getElementById('gra_exam');
        if (window.onChangeExamTypeGRA && graEl) window.onChangeExamTypeGRA(graEl);
        await waitForOptions('#gra_subject', 1);
      }
      if (selectOption('#gra_institute', gra.institute || '')) count++;
      if (selectOption('#gra_subject', gra.subject || '')) count++;
      if (selectOption('#gra_result_type', gra.result_type || '4')) {
        count++;
        const rEl = document.getElementById('gra_result_type');
        if (window.onChangeResult && rEl) window.onChangeResult(rEl);
      }
      if (gra.result && setVal('#gra_result', gra.result)) count++;
      if (selectOption('#gra_duration', gra.duration || '04')) count++;
      if (selectOption('#gra_year', gra.year || '2021')) count++;
    }

    // Agreement
    const agree = document.getElementById('agree');
    if (agree && !agree.checked) {
      agree.checked = true;
      triggerEvents(agree);
      count++;
    }

    // Focus Captcha
    const captcha = document.getElementById('captcha');
    if (captcha) {
      captcha.style.border = '2px solid #f42a41';
      captcha.style.boxShadow = '0 0 10px rgba(244, 42, 65, 0.5)';
      captcha.scrollIntoView({ behavior: 'smooth', block: 'center' });
      captcha.focus();
    }

    alert(`✅ Filled ${count} fields successfully! Please type the Captcha code.`);
  }

  // Auto-capture profile from form
  function extractProfileFromForm() {
    const form = document.getElementById('applicationForm');
    if (!form) return null;
    const name = document.getElementById('name')?.value?.trim();
    if (!name || name.length < 2) return null;

    const getVal = (id) => document.getElementById(id)?.value?.trim() || '';
    const getOptText = (id) => {
      const el = document.getElementById(id);
      return el && el.selectedIndex >= 0 ? el.options[el.selectedIndex]?.text?.trim() : '';
    };
    const isChecked = (id) => !!document.getElementById(id)?.checked;
    const same = isChecked('same_as_present');

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
          district_name: getOptText('present_district').replace(/\s*\(.*\)/, '').trim(),
          upazila_code: getVal('present_upazila'),
          upazila_name: getOptText('present_upazila').trim(),
          post: getVal('present_post').toUpperCase(),
          postcode: getVal('present_postcode')
        },
        same_as_present: same,
        permanent: {
          careof: same ? getVal('present_careof').toUpperCase() : getVal('permanent_careof').toUpperCase(),
          village: same ? getVal('present_village').toUpperCase() : getVal('permanent_village').toUpperCase(),
          district_code: same ? getVal('present_district') : getVal('permanent_district'),
          district_name: same ? getOptText('present_district').replace(/\s*\(.*\)/, '').trim() : getOptText('permanent_district').replace(/\s*\(.*\)/, '').trim(),
          upazila_code: same ? getVal('present_upazila') : getVal('permanent_upazila'),
          upazila_name: same ? getOptText('present_upazila').trim() : getOptText('permanent_upazila').trim(),
          post: same ? getVal('present_post').toUpperCase() : getVal('permanent_post').toUpperCase(),
          postcode: same ? getVal('present_postcode') : getVal('permanent_postcode')
        }
      },
      education: {
        ssc: {
          enabled: !!getVal('ssc_exam') || !!getVal('ssc_roll'),
          exam: getVal('ssc_exam') || '1',
          board: getVal('ssc_board') || '14',
          roll: getVal('ssc_roll'),
          result_type: getVal('ssc_result_type') || '5',
          result: getVal('ssc_result'),
          group: getVal('ssc_group') || '1',
          year: getVal('ssc_year') || '2014'
        },
        hsc: {
          enabled: !!getVal('hsc_exam') || !!getVal('hsc_roll'),
          exam: getVal('hsc_exam') || '1',
          board: getVal('hsc_board') || '14',
          roll: getVal('hsc_roll'),
          result_type: getVal('hsc_result_type') || '5',
          result: getVal('hsc_result'),
          group: getVal('hsc_group') || '1',
          year: getVal('hsc_year') || '2016'
        },
        graduation: {
          enabled: !!getVal('gra_exam') || !!getVal('gra_institute'),
          exam: getVal('gra_exam') || '1',
          institute: getVal('gra_institute'),
          subject: getVal('gra_subject'),
          subject_name: getOptText('gra_subject') || '',
          result_type: getVal('gra_result_type') || '4',
          result: getVal('gra_result'),
          duration: getVal('gra_duration') || '04',
          year: getVal('gra_year') || '2021'
        }
      }
    };

    // Check if profile already exists before overwriting
    const existing = Storage.get('profile', null);
    if (existing && existing.personal && existing.personal.name) {
      const overwrite = confirm(`⚠️ [BD Govt Job Autofill]\n\nA profile for "${existing.personal.name}" already exists.\n\nDo you want to overwrite it with this form's details (${captured.personal.name})?`);
      if (!overwrite) return null;
    }

    Storage.set('profile', captured);
    userProfile = captured;
    console.log('[BD Govt Job Userscript] Profile auto-saved:', captured);
    return captured;
  }

  // Setup auto-capture on form submit
  const appForm = document.getElementById('applicationForm');
  if (appForm) {
    appForm.addEventListener('submit', () => {
      extractProfileFromForm();
    }, true);

    const submitBtn = document.getElementById('submit') || appForm.querySelector('button[type="submit"], input[type="submit"]');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        extractProfileFromForm();
      });
    }
  }

  // In-Field Autofill popup on input select/focus
  if (appForm) {
    // Inject CSS
    const style = document.createElement('style');
    style.textContent = `
      .bd-autofill-popup {
        position: absolute;
        z-index: 2147483647;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.18);
        font-family: Arial, sans-serif;
        cursor: pointer;
        padding: 8px 12px;
        display: flex;
        align-items: center;
        gap: 10px;
        color: #1e293b;
        animation: bdFade 0.15s ease-out;
      }
      .bd-autofill-popup:hover { background: #f0fdf4; border-color: #006a4e; }
      .bd-popup-icon { background: #006a4e; color: #fff; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: bold; }
      .bd-popup-title { font-size: 12.5px; font-weight: bold; color: #006a4e; }
      .bd-popup-sub { font-size: 11px; color: #64748b; }
      @keyframes bdFade { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: translateY(0); } }
    `;
    document.head.appendChild(style);

    let popupEl = null;

    function removePopup() {
      if (popupEl) { popupEl.remove(); popupEl = null; }
    }

    function showPopup(inputEl) {
      removePopup();
      if (!userProfile || !userProfile.personal || !userProfile.personal.name) return;

      const p = document.createElement('div');
      p.className = 'bd-autofill-popup';
      p.innerHTML = `
        <div class="bd-popup-icon">⚡</div>
        <div>
          <div class="bd-popup-title">Autofill as ${userProfile.personal.name}</div>
          <div class="bd-popup-sub">Click to fill all form fields</div>
        </div>
      `;

      p.onmousedown = (e) => e.preventDefault();
      p.onclick = () => {
        removePopup();
        fillForm();
      };

      document.body.appendChild(p);
      popupEl = p;

      const rect = inputEl.getBoundingClientRect();
      p.style.top = `${rect.bottom + window.scrollY + 4}px`;
      p.style.left = `${rect.left + window.scrollX}px`;
    }

    document.addEventListener('focusin', (e) => {
      const el = e.target;
      if (el && appForm.contains(el) && el.tagName === 'INPUT' && !['hidden', 'checkbox', 'radio', 'submit', 'button'].includes(el.type) && el.id !== 'captcha') {
        showPopup(el);
      } else {
        removePopup();
      }
    }, true);

    document.addEventListener('click', (e) => {
      if (popupEl && !popupEl.contains(e.target) && e.target.tagName !== 'INPUT') removePopup();
    });

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') removePopup(); });
  }

  // Userscript Menu Command
  if (typeof GM_registerMenuCommand !== 'undefined') {
    GM_registerMenuCommand('⚡ Autofill Teletalk Application', fillForm);
  }
})();

