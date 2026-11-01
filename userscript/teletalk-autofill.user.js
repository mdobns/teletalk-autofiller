// ==UserScript==
// @name         Teletalk Autofiller - BD Govt Job Application Autofill
// @namespace    https://github.com/mdobns/teletalk-autofiller
// @version      2.0.0-beta
// @description  Autofill Bangladesh government job application forms on all Teletalk portals (*.teletalk.com.bd)
// @author       mdobns
// @match        *://*.teletalk.com.bd/*
// @icon         https://raw.githubusercontent.com/mdobns/teletalk-autofiller/main/icons/icon48.png
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

  function getAppForm() {
    return document.getElementById('applicationForm') ||
      document.getElementById('app_form') ||
      document.querySelector('form[name="app_form"], form[name="applicationForm"], form[action*="preview.php"]');
  }

  function isBpscForm() {
    const form = getAppForm();
    if (!form) return false;
    return form.id === 'app_form' ||
      form.getAttribute('name') === 'app_form' ||
      !!document.getElementById('menu_one') ||
      !!document.getElementById('b_day') ||
      !!document.getElementById('fathername');
  }

  function parseDob(dobStr) {
    if (!dobStr) return null;
    const str = String(dobStr).trim();
    let m = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (m) {
      return {
        year: m[1],
        month: m[2].padStart(2, '0'),
        day: m[3].padStart(2, '0')
      };
    }
    m = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (m) {
      return {
        year: m[3],
        month: m[2].padStart(2, '0'),
        day: m[1].padStart(2, '0')
      };
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return {
        year: String(d.getFullYear()),
        month: String(d.getMonth() + 1).padStart(2, '0'),
        day: String(d.getDate()).padStart(2, '0')
      };
    }
    return null;
  }

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

  let userProfiles = Storage.get('profiles', null);
  let userProfile = Storage.get('profile', null);

  if (!userProfiles || !Array.isArray(userProfiles) || userProfiles.length === 0) {
    if (userProfile && userProfile.personal && userProfile.personal.name) {
      if (!userProfile.id) userProfile.id = 'prof_' + Date.now();
      userProfiles = [userProfile];
    } else {
      defaultProfile.id = 'prof_demo';
      userProfiles = [defaultProfile];
      userProfile = defaultProfile;
    }
    Storage.set('profiles', userProfiles);
    Storage.set('profile', userProfile);
  } else {
    if (!userProfile || !userProfile.personal) {
      userProfile = userProfiles[0];
      Storage.set('profile', userProfile);
    }
  }

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

    // Pass 1: Exact match on option value (preferred)
    for (let i = 0; i < el.options.length; i++) {
      const opt = el.options[i];
      if (opt.value && opt.value.trim().toLowerCase() === target) {
        el.selectedIndex = i;
        triggerEvents(el);
        if (el.onchange) el.onchange();
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
        if (el.onchange) el.onchange();
        return true;
      }
    }

    // Pass 3: Substring match — ONLY for longer, distinctive strings
    // to prevent short codes like "1", "2" from matching wrong options
    if (target.length >= 3) {
      for (let i = 0; i < el.options.length; i++) {
        const opt = el.options[i];
        const txt = (opt.textContent || '').trim().toLowerCase();
        if (txt && (txt.includes(target) || target.includes(txt))) {
          el.selectedIndex = i;
          triggerEvents(el);
          if (el.onchange) el.onchange();
          return true;
        }
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
  async function fillForm(profileToFill) {
    const profile = profileToFill || userProfile || {};
    const p = profile.personal || {};
    let count = 0;
    const isBpsc = isBpscForm();

    if (setVal('#name', p.name ? p.name.toUpperCase().trim() : '')) count++;
    if (setVal('#name_bn, #bn_name, input[name="bn_name"]', p.name_bn || '')) count++;
    if (setVal('#father, #fathername, input[name="fathername"]', p.father ? p.father.toUpperCase().trim() : '')) count++;
    if (setVal('#father_bn, #bn_father, input[name="bn_father"]', p.father_bn || '')) count++;
    if (setVal('#mother, #mothername, input[name="mothername"]', p.mother ? p.mother.toUpperCase().trim() : '')) count++;
    if (setVal('#mother_bn, #bn_mother, input[name="bn_mother"]', p.mother_bn || '')) count++;

    if (p.dob) {
      const dobEl = document.getElementById('dob');
      if (dobEl) {
        dobEl.value = p.dob;
        try { dobEl.valueAsDate = new Date(p.dob); } catch (e) {}
        triggerEvents(dobEl);
        count++;
      } else {
        const parsedDob = parseDob(p.dob);
        if (parsedDob) {
          if (selectOption('#b_day', parsedDob.day)) count++;
          if (selectOption('#b_month', parsedDob.month)) count++;
          if (selectOption('#b_year', parsedDob.year)) count++;
        }
      }
    }

    if (selectOption('#nationality', p.nationality || 'Bangladeshi')) count++;
    if (selectOption('#religion', p.religion || '1')) count++;
    if (selectOption('#gender, #sex', p.gender || 'Male')) count++;

    // NID
    const nidVal = p.nid === '1' || p.nid === 1 || p.nid === true || p.nid === 'Yes' ? '1' : '0';
    const nidSelect = document.getElementById('nid');
    if (nidSelect && nidSelect.tagName.toLowerCase() === 'select') {
      if (selectOption('#nid', nidVal)) {
        count++;
        if (window.onChangeId && nidSelect) window.onChangeId(nidSelect, 'nidElm');
        if (p.nid_no) { await sleep(50); if (setVal('#nid_no', p.nid_no)) count++; }
      }
    } else {
      const hasNid = !!(p.nid_no && p.nid_no.trim().length > 0);
      const radio = document.getElementById(hasNid ? 'nid_01' : 'nid_02');
      if (radio) {
        radio.checked = true;
        triggerEvents(radio);
        radio.click();
        count++;
        if (hasNid) {
          await sleep(50);
          if (setVal('#nid_no, input[name="nid_no"]', p.nid_no)) count++;
        }
      }
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

    // Marital Status
    const msSelect = document.getElementById('marital_status');
    if (msSelect && msSelect.tagName.toLowerCase() === 'select') {
      if (p.marital_status && selectOption('#marital_status', p.marital_status)) {
        count++;
        const msEl = document.getElementById('marital_status');
        if (window.onChangeId && msEl) window.onChangeId(msEl, 'maritalElm');
        if (p.marital_status === 'Married' && p.spouse_name) {
          await sleep(50);
          if (setVal('#spouse_name', p.spouse_name)) count++;
        }
      }
    } else {
      const isMarried = (p.marital_status || '').toLowerCase() === 'married';
      const mRadio = document.getElementById(isMarried ? 'mstatus_01' : 'mstatus_02');
      if (mRadio) {
        mRadio.checked = true;
        triggerEvents(mRadio);
        mRadio.click();
        count++;
        if (isMarried && p.spouse_name) {
          await sleep(50);
          if (setVal('#s_name, input[name="s_name"]', p.spouse_name)) count++;
        }
      }
    }

    // Quota
    if (document.getElementById('quota')) {
      if (p.quota && selectOption('#quota', p.quota)) {
        count++;
        const quotaEl = document.getElementById('quota');
        if (window.onChangeQuota && quotaEl) window.onChangeQuota(quotaEl);
        if (window.onChangeId && quotaEl) window.onChangeId(quotaEl, 'quotaDetailsElm');
        if (p.quota_details) { await sleep(50); if (setVal('#quota_details', p.quota_details)) count++; }
      }
    } else if (document.getElementById('ffq')) {
      const qVal = p.quota_name || p.quota || 'Non Freedom Fighter';
      if (selectOption('#ffq', qVal.toLowerCase().includes('freedom') ? qVal : 'Non Freedom Fighter')) count++;

      const trqRadio = document.getElementById('tribal2');
      if (trqRadio && !document.getElementById('tribal1').checked) {
        trqRadio.checked = true;
        triggerEvents(trqRadio);
      }
      const phcRadio = document.getElementById('phc2');
      if (phcRadio && !document.getElementById('phc1').checked) {
        phcRadio.checked = true;
        triggerEvents(phcRadio);
      }
    }

    if (p.dep_status && selectOption('#dep_status', p.dep_status)) count++;

    // Contact
    const c = profile.contact || {};
    if (setVal('#mobile, #mobileno, input[name="mobileno"]', c.mobile || '')) count++;
    if (setVal('#confirm_mobile, #confirmmobile, input[name="confirmmobile"]', c.confirm_mobile || c.mobile || '')) count++;
    if (setVal('#email', c.email || '')) count++;

    // Present Address
    const pres = profile.address?.present || {};
    if (setVal('#present_careof, #present_care', pres.careof || '')) count++;
    if (setVal('#present_village, #present_vill', pres.village || '')) count++;

    const presDistSelector = document.getElementById('present_district') ? '#present_district' : '#menu_one';
    const presUpzSelector = document.getElementById('present_upazila') ? '#present_upazila' : '#menu_one_list';

    if (pres.district_code || pres.district_name) {
      const distVal = pres.district_name || pres.district_code;
      if (selectOption(presDistSelector, distVal)) {
        count++;
        const distEl = document.querySelector(presDistSelector);
        if (window.onChangeDistrict && distEl) window.onChangeDistrict(distEl, 'present_upazila');
        if (typeof window.get_one_list === 'function' && distEl) window.get_one_list(distEl);

        await waitForOptions(presUpzSelector, 1);

        if (pres.upazila_code || pres.upazila_name) {
          const upzVal = pres.upazila_name || pres.upazila_code;
          if (selectOption(presUpzSelector, upzVal)) count++;
        }
      }
    }

    if (setVal('#present_post', pres.post || '')) count++;
    if (setVal('#present_postcode, #present_pcode', pres.postcode || '')) count++;

    // Permanent Address (only if different from present)
    const perm = profile.address?.permanent || {};
    const sameCheckbox = document.getElementById('same_as_present') || document.getElementById('copy');
    if (!profile.address?.same_as_present && sameCheckbox) {
      if (sameCheckbox.checked) {
        sameCheckbox.checked = false;
        triggerEvents(sameCheckbox);
        if (sameCheckbox.onclick) sameCheckbox.onclick();
        if (typeof window.fd === 'function') window.fd();
      }
      if (setVal('#permanent_careof, #permanent_care', perm.careof || '')) count++;
      if (setVal('#permanent_village, #permanent_vill', perm.village || '')) count++;

      const permDistSelector = document.getElementById('permanent_district') ? '#permanent_district' : '#menu_two';
      const permUpzSelector = document.getElementById('permanent_upazila') ? '#permanent_upazila' : '#menu_two_list';

      if (perm.district_code || perm.district_name) {
        const pDistVal = perm.district_name || perm.district_code;
        if (selectOption(permDistSelector, pDistVal)) {
          count++;
          const pDist = document.querySelector(permDistSelector);
          if (window.onChangeDistrict && pDist) window.onChangeDistrict(pDist, 'permanent_upazila');
          if (typeof window.get_two_list === 'function' && pDist) window.get_two_list(pDist);

          await waitForOptions(permUpzSelector, 1);

          if (perm.upazila_code || perm.upazila_name) {
            const pUpzVal = perm.upazila_name || perm.upazila_code;
            if (selectOption(permUpzSelector, pUpzVal)) count++;
          }
        }
      }
      if (setVal('#permanent_post', perm.post || '')) count++;
      if (setVal('#permanent_postcode, #permanent_pcode', perm.postcode || '')) count++;
    }

    // SSC
    const ssc = profile.education?.ssc || {};
    const hasSsc = document.getElementById('ssc_exam') || document.getElementById('exam1');
    if (ssc.enabled !== false && hasSsc) {
      const ifSsc = document.getElementById('if_applicable_ssc');
      if (ifSsc && !ifSsc.checked) { ifSsc.click(); await sleep(100); }

      const sscExamSelector = document.getElementById('ssc_exam') ? '#ssc_exam' : '#exam1';
      const sscBoardSelector = document.getElementById('ssc_board') ? '#ssc_board' : '#institute1';
      const sscRollSelector = document.getElementById('ssc_roll') ? '#ssc_roll' : '#roll1';
      const sscRegSelector = document.getElementById('ssc_reg') ? '#ssc_reg' : '#reg1';
      const sscResultTypeSelector = document.getElementById('ssc_result_type') ? '#ssc_result_type' : '#result1';
      const sscResultSelector = document.getElementById('ssc_result') ? '#ssc_result' : '#result_gpa1';
      const sscGroupSelector = document.getElementById('ssc_group') ? '#ssc_group' : '#subject1';
      const sscYearSelector = document.getElementById('ssc_year') ? '#ssc_year' : '#year1';

      if (selectOption(sscExamSelector, ssc.exam_name || ssc.exam || '1')) {
        count++;
        const sscEl = document.querySelector(sscExamSelector);
        if (window.onChangeExamTypeSSC && sscEl) window.onChangeExamTypeSSC(sscEl);
        if (document.getElementById('ssc_group')) await waitForOptions('#ssc_group', 1);
      }
      if (selectOption(sscBoardSelector, ssc.board_name || ssc.board || '14')) count++;
      if (setVal(sscRollSelector, ssc.roll || '')) count++;
      if (ssc.reg && setVal(sscRegSelector, ssc.reg)) count++;

      if (selectOption(sscResultTypeSelector, ssc.result_type || '5')) {
        count++;
        const rEl = document.querySelector(sscResultTypeSelector);
        if (window.onChangeResult && rEl) window.onChangeResult(rEl);
        if (typeof window.Show_GpaTextBox === 'function' && rEl) window.Show_GpaTextBox(rEl.id, 'result_gpa1');
      }
      if (ssc.result && setVal(sscResultSelector, ssc.result)) count++;
      if (selectOption(sscGroupSelector, ssc.group_name || ssc.group || '1')) count++;
      if (selectOption(sscYearSelector, ssc.year || '2014')) count++;
    }

    // HSC
    const hsc = profile.education?.hsc || {};
    const hasHsc = document.getElementById('hsc_exam') || document.getElementById('exam2');
    if (hsc.enabled !== false && hasHsc) {
      const ifHsc = document.getElementById('if_applicable_hsc');
      if (ifHsc && !ifHsc.checked) { ifHsc.click(); await sleep(100); }

      const hscExamSelector = document.getElementById('hsc_exam') ? '#hsc_exam' : '#exam2';
      const hscBoardSelector = document.getElementById('hsc_board') ? '#hsc_board' : '#institute2';
      const hscRollSelector = document.getElementById('hsc_roll') ? '#hsc_roll' : '#roll2';
      const hscRegSelector = document.getElementById('hsc_reg') ? '#hsc_reg' : '#reg2';
      const hscResultTypeSelector = document.getElementById('hsc_result_type') ? '#hsc_result_type' : '#result2';
      const hscResultSelector = document.getElementById('hsc_result') ? '#hsc_result' : '#result_gpa2';
      const hscGroupSelector = document.getElementById('hsc_group') ? '#hsc_group' : '#subject2';
      const hscYearSelector = document.getElementById('hsc_year') ? '#hsc_year' : '#year2';

      if (selectOption(hscExamSelector, hsc.exam_name || hsc.exam || '1')) {
        count++;
        const hscEl = document.querySelector(hscExamSelector);
        if (window.onChangeExamTypeHSC && hscEl) window.onChangeExamTypeHSC(hscEl);
        if (typeof window.get_sub_hsc === 'function' && hscEl) window.get_sub_hsc(hscEl);
        await waitForOptions(hscGroupSelector, 1);
      }
      if (selectOption(hscBoardSelector, hsc.board_name || hsc.board || '14')) count++;
      if (setVal(hscRollSelector, hsc.roll || '')) count++;
      if (hsc.reg && setVal(hscRegSelector, hsc.reg)) count++;

      if (selectOption(hscResultTypeSelector, hsc.result_type || '5')) {
        count++;
        const rEl = document.querySelector(hscResultTypeSelector);
        if (window.onChangeResult && rEl) window.onChangeResult(rEl);
        if (typeof window.Show_GpaTextBox === 'function' && rEl) window.Show_GpaTextBox(rEl.id, 'result_gpa2');
      }
      if (hsc.result && setVal(hscResultSelector, hsc.result)) count++;
      if (selectOption(hscGroupSelector, hsc.group_name || hsc.group || '1')) count++;
      if (selectOption(hscYearSelector, hsc.year || '2016')) count++;
    }

    // Graduation
    const gra = profile.education?.graduation || {};
    const hasGra = document.getElementById('gra_exam') || document.getElementById('exam3');
    if (gra.enabled !== false && hasGra) {
      const ifGra = document.getElementById('if_applicable_gra');
      if (ifGra && !ifGra.checked) { ifGra.click(); await sleep(100); }

      const graExamSelector = document.getElementById('gra_exam') ? '#gra_exam' : '#exam3';
      const graInstSelector = document.getElementById('gra_institute') ? '#gra_institute' : '#institute3';
      const graRollSelector = document.getElementById('gra_roll') ? '#gra_roll' : '#roll3';
      const graResultTypeSelector = document.getElementById('gra_result_type') ? '#gra_result_type' : '#result3';
      const graResultSelector = document.getElementById('gra_result') ? '#gra_result' : '#result_gpa3';
      const graSubjectSelector = document.getElementById('gra_subject') ? '#gra_subject' : '#subject3';
      const graDurationSelector = document.getElementById('gra_duration') ? '#gra_duration' : '#duration3';
      const graYearSelector = document.getElementById('gra_year') ? '#gra_year' : '#year3';

      if (selectOption(graExamSelector, gra.exam_name || gra.exam || '1')) {
        count++;
        const graEl = document.querySelector(graExamSelector);
        if (window.onChangeExamTypeGRA && graEl) window.onChangeExamTypeGRA(graEl);
        if (typeof window.get_sub_gra === 'function' && graEl) window.get_sub_gra(graEl);
        await waitForOptions(graSubjectSelector, 1);
      }
      if (selectOption(graInstSelector, gra.institute_name || gra.institute || '')) count++;
      if (setVal(graRollSelector, gra.roll || '')) count++;

      if (selectOption(graResultTypeSelector, gra.result_type || '4')) {
        count++;
        const rEl = document.querySelector(graResultTypeSelector);
        if (window.onChangeResult && rEl) window.onChangeResult(rEl);
        if (typeof window.Show_GpaTextBox === 'function' && rEl) window.Show_GpaTextBox(rEl.id, 'result_gpa3');
      }
      if (gra.result && setVal(graResultSelector, gra.result)) count++;

      if (selectOption(graSubjectSelector, gra.subject_name || gra.subject || '')) count++;
      if (selectOption(graDurationSelector, gra.duration ? String(parseInt(gra.duration, 10)) : '4')) count++;
      if (selectOption(graYearSelector, gra.year || '2021')) count++;
    }

    // Agreement
    const agree = document.getElementById('agree') || document.getElementById('agreement') || document.getElementById('info_yes');
    if (agree && !agree.checked) {
      agree.checked = true;
      triggerEvents(agree);
      if (typeof agree.onclick === 'function') {
        try { agree.onclick(); } catch (e) {}
      }
      if (typeof window.agreesubmit === 'function') {
        try { window.agreesubmit(agree); } catch (e) {}
      }
      count++;
    }

    // Same as Present Address (Checked at the very end after all fields are filled)
    if (profile.address?.same_as_present) {
      const sameCheckbox = document.getElementById('same_as_present') || document.getElementById('copy');
      if (sameCheckbox) {
        await sleep(150);

        const pres = profile.address?.present || {};
        if (pres.upazila_code || pres.upazila_name) {
          const upzEl = document.querySelector(presUpzSelector);
          if (upzEl && (!upzEl.value || upzEl.selectedIndex <= 0)) {
            selectOption(presUpzSelector, pres.upazila_name || pres.upazila_code);
          }
        }

        const pairs = [
          ['#present_careof, #present_care', '#permanent_careof, #permanent_care'],
          ['#present_village, #present_vill', '#permanent_village, #permanent_vill'],
          ['#present_post', '#permanent_post'],
          ['#present_postcode, #present_pcode', '#permanent_postcode, #permanent_pcode']
        ];
        for (const [presSel, permSel] of pairs) {
          const pEl = document.querySelector(presSel);
          const mEl = document.querySelector(permSel);
          if (pEl && mEl && pEl.value) {
            mEl.value = pEl.value;
            triggerEvents(mEl);
          }
        }

        const presDist = document.querySelector(presDistSelector);
        const permDist = document.querySelector(document.getElementById('permanent_district') ? '#permanent_district' : '#menu_two');
        if (presDist && permDist && presDist.value) {
          permDist.value = presDist.value;
          triggerEvents(permDist);
        }

        const presUpz = document.querySelector(presUpzSelector);
        const permUpz = document.querySelector(document.getElementById('permanent_upazila') ? '#permanent_upazila' : '#menu_two_list');
        if (presUpz && permUpz && presUpz.value) {
          if (permUpz.options && permUpz.options.length <= 1 && presUpz.options && presUpz.options.length > 1) {
            permUpz.innerHTML = presUpz.innerHTML;
          }
          permUpz.value = presUpz.value;
          triggerEvents(permUpz);
        }

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
        if (typeof window.fd === 'function') {
          try { window.fd(); } catch (e) {}
        }

        await sleep(100);

        count++;
      }
    }

    // Focus Captcha
    const captcha = document.getElementById('captcha') ||
      document.getElementById('validation') ||
      document.querySelector('input[name="validation"], input[name="captcha"]');
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
    const form = getAppForm();
    if (!form) return null;
    const name = document.getElementById('name')?.value?.trim();
    if (!name || name.length < 2) return null;

    const isBpsc = isBpscForm();

    const getVal = (...ids) => {
      for (const id of ids) {
        const el = document.getElementById(id) || document.querySelector(`[name="${id}"]`);
        if (el && el.value !== undefined && el.value.trim() !== '') return el.value.trim();
      }
      return '';
    };

    const getOptText = (...ids) => {
      for (const id of ids) {
        const el = document.getElementById(id) || document.querySelector(`select[name="${id}"]`);
        if (el && el.selectedIndex >= 0 && el.options && el.options[el.selectedIndex]) {
          return el.options[el.selectedIndex].text.trim();
        }
      }
      return '';
    };

    const isChecked = (...ids) => {
      for (const id of ids) {
        const el = document.getElementById(id) || document.querySelector(`[name="${id}"]`);
        if (el && el.checked) return true;
      }
      return false;
    };

    const same = isChecked('same_as_present', 'copy');

    const presDistName = isBpsc
      ? getOptText('menu_one')
      : getOptText('present_district').replace(/\s*\(.*\)/, '').trim();
    const presUpzName = isBpsc
      ? getOptText('menu_one_list')
      : getOptText('present_upazila').trim();

    const permDistName = same
      ? presDistName
      : (isBpsc ? getOptText('menu_two') : getOptText('permanent_district').replace(/\s*\(.*\)/, '').trim());
    const permUpzName = same
      ? presUpzName
      : (isBpsc ? getOptText('menu_two_list') : getOptText('permanent_upazila').trim());

    let dob = getVal('dob');
    if (!dob && getVal('b_year') && getVal('b_month') && getVal('b_day')) {
      const y = getVal('b_year');
      const m = String(getVal('b_month')).padStart(2, '0');
      const d = String(getVal('b_day')).padStart(2, '0');
      dob = `${y}-${m}-${d}`;
    }

    let gender = getVal('gender') || getOptText('gender');
    if (!gender && (getVal('sex') || getOptText('sex'))) {
      const sVal = getVal('sex');
      const sText = getOptText('sex');
      if (sVal === '1' || sText.toLowerCase() === 'male') gender = 'Male';
      else if (sVal === '2' || sText.toLowerCase() === 'female') gender = 'Female';
      else if (sVal === '3' || sText.toLowerCase().includes('third')) gender = 'Third Gender';
      else gender = sText || 'Male';
    }

    const nidNo = getVal('nid_no');
    const nidVal = isBpsc
      ? (isChecked('nid_01') || !!nidNo ? '1' : '0')
      : (getVal('nid') || (nidNo ? '1' : '0'));

    let maritalStatus = getVal('marital_status');
    let spouseName = getVal('spouse_name', 's_name').toUpperCase();
    if (isBpsc) {
      if (isChecked('mstatus_01')) maritalStatus = 'Married';
      else if (isChecked('mstatus_02')) maritalStatus = 'Single';
    }

    const captured = {
      personal: {
        name: name.toUpperCase(),
        name_bn: getVal('name_bn', 'bn_name'),
        father: getVal('father', 'fathername').toUpperCase(),
        father_bn: getVal('father_bn', 'bn_father'),
        mother: getVal('mother', 'mothername').toUpperCase(),
        mother_bn: getVal('mother_bn', 'bn_mother'),
        dob: dob,
        nationality: getVal('nationality') || 'Bangladeshi',
        religion: getVal('religion') || '1',
        gender: gender || 'Male',
        nid: nidVal,
        nid_no: nidNo,
        breg: getVal('breg') || (getVal('breg_no') ? '1' : '0'),
        breg_no: getVal('breg_no'),
        passport: getVal('passport') || (getVal('passport_no') ? '1' : '0'),
        passport_no: getVal('passport_no'),
        marital_status: maritalStatus || 'Single',
        spouse_name: spouseName,
        quota: getVal('quota', 'ffq') || '8',
        quota_details: getVal('quota_details'),
        dep_status: getVal('dep_status') || '5'
      },
      contact: {
        mobile: getVal('mobile', 'mobileno'),
        confirm_mobile: getVal('confirm_mobile', 'confirmmobile') || getVal('mobile', 'mobileno'),
        email: getVal('email')
      },
      address: {
        present: {
          careof: getVal('present_careof', 'present_care').toUpperCase(),
          village: getVal('present_village', 'present_vill').toUpperCase(),
          district_code: getVal('present_district', 'menu_one'),
          district_name: presDistName,
          upazila_code: getVal('present_upazila', 'menu_one_list'),
          upazila_name: presUpzName,
          post: getVal('present_post').toUpperCase(),
          postcode: getVal('present_postcode', 'present_pcode')
        },
        same_as_present: same,
        permanent: {
          careof: same ? getVal('present_careof', 'present_care').toUpperCase() : getVal('permanent_careof', 'permanent_care').toUpperCase(),
          village: same ? getVal('present_village', 'present_vill').toUpperCase() : getVal('permanent_village', 'permanent_vill').toUpperCase(),
          district_code: same ? getVal('present_district', 'menu_one') : getVal('permanent_district', 'menu_two'),
          district_name: permDistName,
          upazila_code: same ? getVal('present_upazila', 'menu_one_list') : getVal('permanent_upazila', 'menu_two_list'),
          upazila_name: permUpzName,
          post: same ? getVal('present_post').toUpperCase() : getVal('permanent_post').toUpperCase(),
          postcode: same ? getVal('present_postcode', 'present_pcode') : getVal('permanent_postcode', 'permanent_pcode')
        }
      },
      education: {
        ssc: {
          enabled: !!getVal('ssc_exam', 'exam1') || !!getVal('ssc_roll', 'roll1'),
          exam: getVal('ssc_exam', 'exam1') || '1',
          board: getVal('ssc_board', 'institute1') || '14',
          roll: getVal('ssc_roll', 'roll1'),
          result_type: getVal('ssc_result_type', 'result1') || '5',
          result: getVal('ssc_result', 'result_gpa1'),
          group: getVal('ssc_group', 'subject1') || '1',
          year: getVal('ssc_year', 'year1') || '2014'
        },
        hsc: {
          enabled: !!getVal('hsc_exam', 'exam2') || !!getVal('hsc_roll', 'roll2'),
          exam: getVal('hsc_exam', 'exam2') || '1',
          board: getVal('hsc_board', 'institute2') || '14',
          roll: getVal('hsc_roll', 'roll2'),
          result_type: getVal('hsc_result_type', 'result2') || '5',
          result: getVal('hsc_result', 'result_gpa2'),
          group: getVal('hsc_group', 'subject2') || '1',
          year: getVal('hsc_year', 'year2') || '2016'
        },
        graduation: {
          enabled: !!getVal('gra_exam', 'exam3') || !!getVal('gra_institute', 'institute3'),
          exam: getVal('gra_exam', 'exam3') || '1',
          institute: getVal('gra_institute', 'institute3'),
          subject: getVal('gra_subject', 'subject3'),
          subject_name: getOptText('gra_subject', 'subject3') || '',
          result_type: getVal('gra_result_type', 'result3') || '4',
          result: getVal('gra_result', 'result_gpa3'),
          duration: getVal('gra_duration', 'duration3') || '04',
          year: getVal('gra_year', 'year3') || '2021'
        }
      }
    };
    // Check matching profile
    const existing = findMatchingProfile(userProfiles, captured);
    if (existing) {
      // Smart Diff Check
      const changed = [];
      const added = [];

      const checkField = (label, oldV, newV) => {
        const o = (oldV || '').trim().toUpperCase();
        const n = (newV || '').trim().toUpperCase();
        if (!n) return;
        if (!o && n) added.push({ label, newVal: newV });
        else if (o && n && o !== n) changed.push({ label, oldVal: oldV, newVal: newV });
      };

      checkField("Name", existing.personal?.name, captured.personal?.name);
      checkField("Father's Name", existing.personal?.father, captured.personal?.father);
      checkField("Mother's Name", existing.personal?.mother, captured.personal?.mother);
      checkField("DOB", existing.personal?.dob, captured.personal?.dob);
      checkField("NID", existing.personal?.nid_no, captured.personal?.nid_no);
      checkField("Mobile", existing.contact?.mobile, captured.contact?.mobile);
      checkField("Email", existing.contact?.email, captured.contact?.email);
      checkField("Present District", existing.address?.present?.district_name, captured.address?.present?.district_name);
      checkField("SSC Roll", existing.education?.ssc?.roll, captured.education?.ssc?.roll);
      checkField("HSC Roll", existing.education?.hsc?.roll, captured.education?.hsc?.roll);

      if (changed.length > 0) {
        const diffText = changed.map(c => `• ${c.label}: "${c.oldVal}" ➔ "${c.newVal}"`).join('\n');
        const overwrite = confirm(`⚠️ [BD Govt Job Autofill]\n\nYou modified existing saved information for ${existing.personal?.name}:\n\n${diffText}\n\nDo you want to accept these updates in your saved profile?\n(Click Cancel to keep your existing saved values)`);
        if (!overwrite) {
          console.log('[BD Govt Job Userscript] User denied updates. Keeping existing profile.');
          return null;
        }
      } else if (added.length > 0) {
        console.log('[BD Govt Job Userscript] Auto-updated extra fields silently:', added);
      }

      captured.id = existing.id || ('prof_' + Date.now());
      userProfiles = userProfiles.map(p => p.id === existing.id ? captured : p);
      userProfile = captured;
    } else {
      // Brand new candidate detected!
      const saveAsNew = confirm(`✨ [BD Govt Job Autofill]\n\nNew candidate detected: "${captured.personal.name}".\n\nDo you want to save this candidate as an additional profile for 1-click autofill in future applications?`);
      if (saveAsNew) {
        captured.id = 'prof_' + Date.now();
        userProfiles.push(captured);
        userProfile = captured;
      } else {
        return null;
      }
    }

    Storage.set('profiles', userProfiles);
    Storage.set('profile', userProfile);
    console.log('[BD Govt Job Userscript] Profiles updated:', userProfiles);
    return captured;
  }

  // Setup auto-capture on form submit
  const appForm = getAppForm();
  if (appForm) {
    appForm.addEventListener('submit', () => {
      extractProfileFromForm();
    }, true);

    const submitBtn = document.getElementById('submit') ||
      document.getElementById('button01') ||
      appForm.querySelector('button[type="submit"], input[type="submit"], input[name="button"]');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        extractProfileFromForm();
      });
    }
  }

  // In-Field Autofill popup on input select/focus
  if (appForm) {
    let hasAutofilledOnThisPage = false; // Requirement 1: once clicked, never appears again on this page

    const style = document.createElement('style');
    style.textContent = `
      .bd-autofill-popup {
        position: absolute;
        z-index: 2147483647;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        cursor: pointer;
        min-width: 280px;
        max-width: 420px;
        overflow: hidden;
        color: #1e293b;
        animation: bdFade 0.15s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .bd-popup-header {
        padding: 8px 14px 6px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #475569;
        border-bottom: 1px solid #f1f5f9;
        background: #f8fafc;
      }
      .bd-popup-list {
        max-height: 250px;
        overflow-y: auto;
      }
      .bd-popup-item {
        display: flex;
        align-items: center;
        padding: 9px 12px;
        gap: 10px;
        border-bottom: 1px solid #f1f5f9;
        transition: background 0.15s ease;
      }
      .bd-popup-item:last-child { border-bottom: none; }
      .bd-popup-item:hover { background: #f0fdf4; }
      .bd-popup-icon {
        background: linear-gradient(135deg, #006a4e 0%, #004d38 100%);
        color: #fff;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: bold;
        flex-shrink: 0;
      }
      .bd-popup-content { flex: 1; min-width: 0; }
      .bd-popup-title { font-size: 12.5px; font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .bd-popup-title strong { color: #006a4e; }
      .bd-popup-sub { font-size: 11px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .bd-popup-badge { font-size: 10.5px; font-weight: 600; background: #e0f2fe; color: #0369a1; padding: 2px 7px; border-radius: 4px; flex-shrink: 0; }
      .bd-popup-item:hover .bd-popup-badge { background: #006a4e; color: #ffffff; }
      .bd-popup-dismiss {
        padding: 8px 14px 10px;
        text-align: center;
        border-top: 1px solid #f1f5f9;
        background: #f8fafc;
        font-size: 11px;
        cursor: pointer;
        user-select: none;
        transition: background 0.15s ease;
        color: #94a3b8;
      }
      .bd-popup-dismiss:hover {
        background: #f1f5f9;
        color: #64748b;
      }
      @keyframes bdFade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    `;
    document.head.appendChild(style);

    let popupEl = null;

    function removePopup() {
      if (popupEl) { popupEl.remove(); popupEl = null; }
    }

    function showPopup(inputEl) {
      if (hasAutofilledOnThisPage) return;
      removePopup();

      const profiles = (userProfiles && userProfiles.length > 0) ? userProfiles : (userProfile && userProfile.personal?.name ? [userProfile] : []);
      if (!profiles || profiles.length === 0) return;

      const p = document.createElement('div');
      p.className = 'bd-autofill-popup';

      if (profiles.length === 1) {
        const single = profiles[0];
        const name = single.personal?.name || 'Saved Candidate';
        const mobile = single.contact?.mobile;
        const sub = mobile || 'Click to fill all form fields';

        p.innerHTML = `
          <div class="bd-popup-item" data-id="${single.id || '0'}" title="Click to autofill the entire form with ${name}">
            <div class="bd-popup-icon">⚡</div>
            <div class="bd-popup-content">
              <div class="bd-popup-title">Autofill as <strong>${name}</strong></div>
              <div class="bd-popup-sub">${sub} • Click to fill</div>
            </div>
            <div class="bd-popup-badge">Autofill</div>
          </div>
          <div class="bd-popup-dismiss" title="Dismiss this popup. It will not reappear until you reload the page.">
            <span>✕ Don't fill anymore today</span>
          </div>
        `;

        p.onmousedown = (e) => e.preventDefault();
        p.onclick = (e) => {
          const dismiss = e.target.closest('.bd-popup-dismiss');
          if (dismiss) {
            e.preventDefault();
            e.stopPropagation();
            removePopup();
            hasAutofilledOnThisPage = true; // User chose to dismiss — never show again until page reload
            return;
          }
          removePopup();
          hasAutofilledOnThisPage = true; // Never show again on this page!
          fillForm(single);
        };
      } else {
        // Multi candidate list!
        let itemsHtml = `
          <div class="bd-popup-header">
            <span>⚡ Select Candidate to Autofill (${profiles.length}):</span>
          </div>
          <div class="bd-popup-list">
        `;

        profiles.forEach(prof => {
          const name = prof.personal?.name || 'Unnamed Candidate';
          const mobile = prof.contact?.mobile || '';
          const nid = prof.personal?.nid_no ? `NID: ${prof.personal.nid_no}` : '';
          const sub = [mobile, nid].filter(Boolean).join(' • ') || 'Saved Candidate';

          itemsHtml += `
            <div class="bd-popup-item" data-id="${prof.id}" title="Click to autofill as ${name}">
              <div class="bd-popup-icon">👤</div>
              <div class="bd-popup-content">
                <div class="bd-popup-title"><strong>${name}</strong></div>
                <div class="bd-popup-sub">${sub}</div>
              </div>
              <div class="bd-popup-badge">Select</div>
            </div>
          `;
        });

        itemsHtml += `</div>`;
        p.innerHTML = itemsHtml + `
          <div class="bd-popup-dismiss" title="Dismiss this popup. It will not reappear until you reload the page.">
            <span>✕ Don't fill anymore today</span>
          </div>
        `;

        p.onmousedown = (e) => e.preventDefault();
        p.onclick = (e) => {
          const dismiss = e.target.closest('.bd-popup-dismiss');
          if (dismiss) {
            e.preventDefault();
            e.stopPropagation();
            removePopup();
            hasAutofilledOnThisPage = true; // User chose to dismiss — never show again until page reload
            return;
          }

          const item = e.target.closest('.bd-popup-item');
          if (!item) return;

          e.preventDefault();
          e.stopPropagation();
          const profId = item.getAttribute('data-id');
          const selected = profiles.find(x => String(x.id) === String(profId)) || profiles[0];

          removePopup();
          hasAutofilledOnThisPage = true; // Never show again on this page!
          userProfile = selected;
          Storage.set('profile', selected);
          fillForm(selected);
        };
      }

      document.body.appendChild(p);
      popupEl = p;

      const rect = inputEl.getBoundingClientRect();
      p.style.top = `${rect.bottom + window.scrollY + 4}px`;
      p.style.left = `${rect.left + window.scrollX}px`;
    }

    document.addEventListener('focusin', (e) => {
      if (hasAutofilledOnThisPage) return;
      const el = e.target;
      const isInputOrTextarea = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
      const isNotControl = !['hidden', 'checkbox', 'radio', 'submit', 'button', 'file', 'image'].includes((el.type || '').toLowerCase());
      const isNotCaptcha = !['captcha', 'validation'].includes(el.id) && !['captcha', 'validation'].includes(el.name);
      if (el && appForm.contains(el) && isInputOrTextarea && isNotControl && isNotCaptcha) {
        showPopup(el);
      } else {
        removePopup();
      }
    }, true);

    document.addEventListener('click', (e) => {
      if (hasAutofilledOnThisPage) return;
      if (popupEl && !popupEl.contains(e.target) && e.target.tagName !== 'INPUT') removePopup();
    });

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') removePopup(); });
  }

  // Userscript Menu Command
  if (typeof GM_registerMenuCommand !== 'undefined') {
    GM_registerMenuCommand('⚡ Autofill Teletalk Application', () => fillForm(userProfile));
  }
})();

