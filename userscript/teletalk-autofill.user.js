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
    const c = profile.contact || {};
    if (setVal('#mobile', c.mobile || '')) count++;
    if (setVal('#confirm_mobile', c.confirm_mobile || c.mobile || '')) count++;
    if (setVal('#email', c.email || '')) count++;

    // Present Address
    const pres = profile.address?.present || {};
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

    // Permanent Address (only if different from present)
    const perm = profile.address?.permanent || {};
    const sameCheckbox = document.getElementById('same_as_present');
    if (!profile.address?.same_as_present && sameCheckbox) {
      if (sameCheckbox.checked) {
        sameCheckbox.checked = false;
        triggerEvents(sameCheckbox);
      }
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
    const ssc = profile.education?.ssc || {};
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
    const hsc = profile.education?.hsc || {};
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
    const gra = profile.education?.graduation || {};
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

    // Same as Present Address (Checked at the very end after all fields are filled)
    if (profile.address?.same_as_present) {
      const sameCheckbox = document.getElementById('same_as_present');
      if (sameCheckbox) {
        await sleep(150);

        const pres = profile.address?.present || {};
        if (pres.upazila_code || pres.upazila_name) {
          const upzEl = document.getElementById('present_upazila');
          if (upzEl && (!upzEl.value || upzEl.selectedIndex <= 0)) {
            selectOption('#present_upazila', pres.upazila_code || pres.upazila_name);
          }
        }

        // Proactively copy fields
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

        // Fallback restore if blanked
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

        count++;
      }
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
      if (el && appForm.contains(el) && el.tagName === 'INPUT' && !['hidden', 'checkbox', 'radio', 'submit', 'button'].includes(el.type) && el.id !== 'captcha') {
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

