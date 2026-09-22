// Options page controller for BD Govt Job Autofill Profile Manager

document.addEventListener('DOMContentLoaded', async () => {
  let geoData = { districts: [], upazilas: [] };
  let refData = { universities: [] };
  let photoBase64 = '';
  let sigBase64 = '';

  // Tab switching
  const tabs = document.querySelectorAll('.tab-btn');
  const panes = document.querySelectorAll('.tab-pane');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const targetPane = document.getElementById(tab.dataset.tab);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Load Geographic Data and Reference Data
  try {
    const geoRes = await fetch(chrome.runtime.getURL('data/bd_geo.json'));
    geoData = await geoRes.json();
    populateDistricts();
  } catch (e) {
    console.error('Failed to load bd_geo.json:', e);
  }

  try {
    const refRes = await fetch(chrome.runtime.getURL('data/reference_lists.json'));
    refData = await refRes.json();
    populateUniversities();
  } catch (e) {
    console.error('Failed to load reference_lists.json:', e);
  }

  function populateDistricts() {
    const presDist = document.getElementById('addr_pres_district');
    const permDist = document.getElementById('addr_perm_district');
    
    // Sort districts alphabetically
    const sorted = [...geoData.districts].sort((a, b) => a.dist_name.localeCompare(b.dist_name));

    sorted.forEach(d => {
      const opt1 = document.createElement('option');
      opt1.value = d.dist_code;
      opt1.textContent = `${d.dist_name} (${d.div_name})`;
      presDist.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = d.dist_code;
      opt2.textContent = `${d.dist_name} (${d.div_name})`;
      permDist.appendChild(opt2);
    });
  }

  function updateUpazilas(districtCode, selectEl, selectedUpzCode = '') {
    selectEl.innerHTML = '<option value="">Select Upazila / Thana</option>';
    if (!districtCode) return;

    const filtered = geoData.upazilas.filter(u => String(u.dist_code) === String(districtCode));
    filtered.sort((a, b) => a.thana.localeCompare(b.thana));

    filtered.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.thana_code;
      opt.textContent = u.thana;
      if (selectedUpzCode && (String(u.thana_code) === String(selectedUpzCode) || u.thana.toLowerCase() === selectedUpzCode.toLowerCase())) {
        opt.selected = true;
      }
      selectEl.appendChild(opt);
    });
  }

  document.getElementById('addr_pres_district').addEventListener('change', (e) => {
    updateUpazilas(e.target.value, document.getElementById('addr_pres_upazila'));
  });

  document.getElementById('addr_perm_district').addEventListener('change', (e) => {
    updateUpazilas(e.target.value, document.getElementById('addr_perm_upazila'));
  });

  function populateUniversities() {
    const graUni = document.getElementById('edu_gra_institute');
    const masUni = document.getElementById('edu_mas_institute');

    refData.universities.forEach(u => {
      const opt1 = document.createElement('option');
      opt1.value = u.code;
      opt1.textContent = u.name;
      graUni.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = u.code;
      opt2.textContent = u.name;
      masUni.appendChild(opt2);
    });
  }

  // Conditional field event listeners
  document.getElementById('p_nid').addEventListener('change', (e) => {
    document.getElementById('nid_no_group').style.display = e.target.value === '1' ? 'flex' : 'none';
  });

  document.getElementById('p_breg').addEventListener('change', (e) => {
    document.getElementById('breg_no_group').style.display = e.target.value === '1' ? 'flex' : 'none';
  });

  document.getElementById('p_passport').addEventListener('change', (e) => {
    document.getElementById('passport_no_group').style.display = e.target.value === '1' ? 'flex' : 'none';
  });

  document.getElementById('p_marital_status').addEventListener('change', (e) => {
    document.getElementById('spouse_group').style.display = e.target.value === 'Married' ? 'flex' : 'none';
  });

  document.getElementById('p_quota').addEventListener('change', (e) => {
    const val = e.target.value;
    document.getElementById('quota_details_group').style.display = ['1', '2', '3', '6'].includes(val) ? 'flex' : 'none';
  });

  document.getElementById('addr_same_as_present').addEventListener('change', (e) => {
    document.getElementById('permanentAddressFields').style.display = e.target.checked ? 'none' : 'grid';
  });

  document.getElementById('edu_mas_enabled').addEventListener('change', (e) => {
    document.getElementById('mastersFields').style.display = e.target.checked ? 'grid' : 'none';
  });

  document.getElementById('exp_enabled').addEventListener('change', (e) => {
    document.getElementById('experienceFields').style.display = e.target.checked ? 'grid' : 'none';
  });

  // Image resize helper using canvas to guarantee Teletalk requirements:
  // Photo: 300x300 JPG
  // Signature: 300x80 JPG
  function resizeImage(file, targetWidth, targetHeight, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        
        // Fill white background (useful for transparent png signatures)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        // Draw image scaled to exact dimensions
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Convert to JPG
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        callback(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // Photo Upload & Preview
  const photoFileInput = document.getElementById('photoFileInput');
  const photoPreview = document.getElementById('photoPreview');
  const photoPlaceholder = document.getElementById('photoPlaceholder');
  const removePhotoBtn = document.getElementById('removePhotoBtn');

  document.getElementById('uploadPhotoBtn').addEventListener('click', () => photoFileInput.click());
  photoFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    resizeImage(file, 300, 300, (dataUrl) => {
      photoBase64 = dataUrl;
      photoPreview.src = dataUrl;
      photoPreview.style.display = 'block';
      photoPlaceholder.style.display = 'none';
      removePhotoBtn.style.display = 'inline-flex';
    });
  });

  removePhotoBtn.addEventListener('click', () => {
    photoBase64 = '';
    photoPreview.src = '';
    photoPreview.style.display = 'none';
    photoPlaceholder.style.display = 'block';
    removePhotoBtn.style.display = 'none';
    photoFileInput.value = '';
  });

  // Signature Upload & Preview
  const sigFileInput = document.getElementById('sigFileInput');
  const sigPreview = document.getElementById('sigPreview');
  const sigPlaceholder = document.getElementById('sigPlaceholder');
  const removeSigBtn = document.getElementById('removeSigBtn');

  document.getElementById('uploadSigBtn').addEventListener('click', () => sigFileInput.click());
  sigFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    resizeImage(file, 300, 80, (dataUrl) => {
      sigBase64 = dataUrl;
      sigPreview.src = dataUrl;
      sigPreview.style.display = 'block';
      sigPlaceholder.style.display = 'none';
      removeSigBtn.style.display = 'inline-flex';
    });
  });

  removeSigBtn.addEventListener('click', () => {
    sigBase64 = '';
    sigPreview.src = '';
    sigPreview.style.display = 'none';
    sigPlaceholder.style.display = 'block';
    removeSigBtn.style.display = 'none';
    sigFileInput.value = '';
  });

  // Load Profile to Form
  function populateForm(profile, settings = {}) {
    if (!profile) return;
    const p = profile.personal || {};
    document.getElementById('p_name').value = p.name || '';
    document.getElementById('p_name_bn').value = p.name_bn || '';
    document.getElementById('p_father').value = p.father || '';
    document.getElementById('p_father_bn').value = p.father_bn || '';
    document.getElementById('p_mother').value = p.mother || '';
    document.getElementById('p_mother_bn').value = p.mother_bn || '';
    document.getElementById('p_dob').value = p.dob || '';
    document.getElementById('p_gender').value = p.gender || 'Male';
    document.getElementById('p_religion').value = p.religion || '1';
    document.getElementById('p_nationality').value = p.nationality || 'Bangladeshi';

    document.getElementById('p_nid').value = p.nid || '1';
    document.getElementById('p_nid_no').value = p.nid_no || '';
    document.getElementById('nid_no_group').style.display = p.nid === '1' ? 'flex' : 'none';

    document.getElementById('p_breg').value = p.breg || '0';
    document.getElementById('p_breg_no').value = p.breg_no || '';
    document.getElementById('breg_no_group').style.display = p.breg === '1' ? 'flex' : 'none';

    document.getElementById('p_passport').value = p.passport || '0';
    document.getElementById('p_passport_no').value = p.passport_no || '';
    document.getElementById('passport_no_group').style.display = p.passport === '1' ? 'flex' : 'none';

    document.getElementById('p_marital_status').value = p.marital_status || 'Single';
    document.getElementById('p_spouse_name').value = p.spouse_name || '';
    document.getElementById('spouse_group').style.display = p.marital_status === 'Married' ? 'flex' : 'none';

    document.getElementById('p_quota').value = p.quota || '8';
    document.getElementById('p_quota_details').value = p.quota_details || '';
    document.getElementById('quota_details_group').style.display = ['1', '2', '3', '6'].includes(p.quota) ? 'flex' : 'none';

    document.getElementById('p_dep_status').value = p.dep_status || '5';

    // Contact
    const c = profile.contact || {};
    document.getElementById('c_mobile').value = c.mobile || '';
    document.getElementById('c_email').value = c.email || '';

    // Present Address
    const addr = profile.address || {};
    const pres = addr.present || {};
    document.getElementById('addr_pres_careof').value = pres.careof || '';
    document.getElementById('addr_pres_village').value = pres.village || '';
    document.getElementById('addr_pres_district').value = pres.district_code || '';
    if (pres.district_code) {
      updateUpazilas(pres.district_code, document.getElementById('addr_pres_upazila'), pres.upazila_code);
    }
    document.getElementById('addr_pres_post').value = pres.post || '';
    document.getElementById('addr_pres_postcode').value = pres.postcode || '';

    // Permanent Address
    const same = addr.same_as_present !== false;
    document.getElementById('addr_same_as_present').checked = same;
    document.getElementById('permanentAddressFields').style.display = same ? 'none' : 'grid';

    const perm = addr.permanent || {};
    document.getElementById('addr_perm_careof').value = perm.careof || '';
    document.getElementById('addr_perm_village').value = perm.village || '';
    document.getElementById('addr_perm_district').value = perm.district_code || '';
    if (perm.district_code) {
      updateUpazilas(perm.district_code, document.getElementById('addr_perm_upazila'), perm.upazila_code);
    }
    document.getElementById('addr_perm_post').value = perm.post || '';
    document.getElementById('addr_perm_postcode').value = perm.postcode || '';

    // Education: SSC
    const edu = profile.education || {};
    const ssc = edu.ssc || {};
    document.getElementById('edu_ssc_exam').value = ssc.exam || '1';
    document.getElementById('edu_ssc_board').value = ssc.board || '14';
    document.getElementById('edu_ssc_roll').value = ssc.roll || '';
    document.getElementById('edu_ssc_result_type').value = ssc.result_type || '5';
    document.getElementById('edu_ssc_result').value = ssc.result || '';
    document.getElementById('edu_ssc_group').value = ssc.group || '1';
    document.getElementById('edu_ssc_year').value = ssc.year || '2014';

    // Education: HSC
    const hsc = edu.hsc || {};
    document.getElementById('edu_hsc_exam').value = hsc.exam || '1';
    document.getElementById('edu_hsc_board').value = hsc.board || '14';
    document.getElementById('edu_hsc_roll').value = hsc.roll || '';
    document.getElementById('edu_hsc_result_type').value = hsc.result_type || '5';
    document.getElementById('edu_hsc_result').value = hsc.result || '';
    document.getElementById('edu_hsc_group').value = hsc.group || '1';
    document.getElementById('edu_hsc_year').value = hsc.year || '2016';

    // Education: Graduation
    const gra = edu.graduation || {};
    document.getElementById('edu_gra_exam').value = gra.exam || '1';
    document.getElementById('edu_gra_institute').value = gra.institute || '';
    document.getElementById('edu_gra_subject').value = gra.subject_name || gra.subject || '';
    document.getElementById('edu_gra_result_type').value = gra.result_type || '4';
    document.getElementById('edu_gra_result').value = gra.result || '';
    document.getElementById('edu_gra_duration').value = gra.duration || '04';
    document.getElementById('edu_gra_year').value = gra.year || '2021';

    // Education: Masters
    const mas = edu.masters || {};
    document.getElementById('edu_mas_enabled').checked = !!mas.enabled;
    document.getElementById('mastersFields').style.display = mas.enabled ? 'grid' : 'none';
    document.getElementById('edu_mas_exam').value = mas.exam || '3';
    document.getElementById('edu_mas_institute').value = mas.institute || '';
    document.getElementById('edu_mas_subject').value = mas.subject_name || mas.subject || '';
    document.getElementById('edu_mas_result_type').value = mas.result_type || '4';
    document.getElementById('edu_mas_result').value = mas.result || '';
    document.getElementById('edu_mas_duration').value = mas.duration || '02';
    document.getElementById('edu_mas_year').value = mas.year || '2023';

    // Experience
    const exp = profile.experience || {};
    document.getElementById('exp_enabled').checked = !!exp.enabled;
    document.getElementById('experienceFields').style.display = exp.enabled ? 'grid' : 'none';
    if (exp.jobs && exp.jobs[0]) {
      const j = exp.jobs[0];
      document.getElementById('exp_employment_type').value = j.employment_type || '8';
      document.getElementById('exp_designation').value = j.designation || '';
      document.getElementById('exp_organization').value = j.organization || '';
      document.getElementById('exp_office_address').value = j.office_address || '';
      document.getElementById('exp_start_date').value = j.job_start_date || '';
      document.getElementById('exp_end_date').value = j.job_end_date || '';
      document.getElementById('exp_currently_working').checked = !!j.currently_working;
      document.getElementById('exp_last_salary').value = j.last_salary || '';
      document.getElementById('exp_description').value = j.job_description || '';
    }

    // Media
    const media = profile.media || {};
    if (media.photo_base64) {
      photoBase64 = media.photo_base64;
      photoPreview.src = media.photo_base64;
      photoPreview.style.display = 'block';
      photoPlaceholder.style.display = 'none';
      removePhotoBtn.style.display = 'inline-flex';
    } else {
      removePhotoBtn.click();
    }

    if (media.signature_base64) {
      sigBase64 = media.signature_base64;
      sigPreview.src = media.signature_base64;
      sigPreview.style.display = 'block';
      sigPlaceholder.style.display = 'none';
      removeSigBtn.style.display = 'inline-flex';
    } else {
      removeSigBtn.click();
    }

    // Settings
    const set = settings || profile.settings || {};
    document.getElementById('set_auto_fill_on_load').checked = !!set.auto_fill_on_load;
    document.getElementById('set_auto_check_agreement').checked = set.auto_check_agreement !== false;
    document.getElementById('set_focus_captcha').checked = set.focus_captcha !== false;
    document.getElementById('set_show_floating_button').checked = set.show_floating_button !== false;
  }

  // Collect Profile Data from Form
  function collectProfileData() {
    const presDistEl = document.getElementById('addr_pres_district');
    const presUpzEl = document.getElementById('addr_pres_upazila');
    const permDistEl = document.getElementById('addr_perm_district');
    const permUpzEl = document.getElementById('addr_perm_upazila');

    const sscBoardEl = document.getElementById('edu_ssc_board');
    const sscExamEl = document.getElementById('edu_ssc_exam');
    const hscBoardEl = document.getElementById('edu_hsc_board');
    const hscExamEl = document.getElementById('edu_hsc_exam');
    const graUniEl = document.getElementById('edu_gra_institute');
    const graExamEl = document.getElementById('edu_gra_exam');
    const masUniEl = document.getElementById('edu_mas_institute');
    const masExamEl = document.getElementById('edu_mas_exam');

    return {
      personal: {
        name: document.getElementById('p_name').value.trim().toUpperCase(),
        name_bn: document.getElementById('p_name_bn').value.trim(),
        father: document.getElementById('p_father').value.trim().toUpperCase(),
        father_bn: document.getElementById('p_father_bn').value.trim(),
        mother: document.getElementById('p_mother').value.trim().toUpperCase(),
        mother_bn: document.getElementById('p_mother_bn').value.trim(),
        dob: document.getElementById('p_dob').value,
        gender: document.getElementById('p_gender').value,
        religion: document.getElementById('p_religion').value,
        nationality: document.getElementById('p_nationality').value || 'Bangladeshi',
        nid: document.getElementById('p_nid').value,
        nid_no: document.getElementById('p_nid_no').value.trim(),
        breg: document.getElementById('p_breg').value,
        breg_no: document.getElementById('p_breg_no').value.trim(),
        passport: document.getElementById('p_passport').value,
        passport_no: document.getElementById('p_passport_no').value.trim(),
        marital_status: document.getElementById('p_marital_status').value,
        spouse_name: document.getElementById('p_spouse_name').value.trim().toUpperCase(),
        quota: document.getElementById('p_quota').value,
        quota_details: document.getElementById('p_quota_details').value.trim(),
        dep_status: document.getElementById('p_dep_status').value
      },
      contact: {
        mobile: document.getElementById('c_mobile').value.trim(),
        confirm_mobile: document.getElementById('c_mobile').value.trim(),
        email: document.getElementById('c_email').value.trim()
      },
      address: {
        present: {
          careof: document.getElementById('addr_pres_careof').value.trim().toUpperCase(),
          village: document.getElementById('addr_pres_village').value.trim().toUpperCase(),
          district_code: presDistEl.value,
          district_name: presDistEl.options[presDistEl.selectedIndex]?.text?.replace(/\s*\(.*\)/, '') || '',
          upazila_code: presUpzEl.value,
          upazila_name: presUpzEl.options[presUpzEl.selectedIndex]?.text || '',
          post: document.getElementById('addr_pres_post').value.trim().toUpperCase(),
          postcode: document.getElementById('addr_pres_postcode').value.trim()
        },
        same_as_present: document.getElementById('addr_same_as_present').checked,
        permanent: {
          careof: document.getElementById('addr_perm_careof').value.trim().toUpperCase(),
          village: document.getElementById('addr_perm_village').value.trim().toUpperCase(),
          district_code: permDistEl.value,
          district_name: permDistEl.options[permDistEl.selectedIndex]?.text?.replace(/\s*\(.*\)/, '') || '',
          upazila_code: permUpzEl.value,
          upazila_name: permUpzEl.options[permUpzEl.selectedIndex]?.text || '',
          post: document.getElementById('addr_perm_post').value.trim().toUpperCase(),
          postcode: document.getElementById('addr_perm_postcode').value.trim()
        }
      },
      education: {
        ssc: {
          enabled: true,
          exam: sscExamEl.value,
          exam_name: sscExamEl.options[sscExamEl.selectedIndex]?.text || 'S.S.C',
          board: sscBoardEl.value,
          board_name: sscBoardEl.options[sscBoardEl.selectedIndex]?.text || 'Dhaka',
          roll: document.getElementById('edu_ssc_roll').value.trim(),
          result_type: document.getElementById('edu_ssc_result_type').value,
          result: document.getElementById('edu_ssc_result').value.trim(),
          group: document.getElementById('edu_ssc_group').value,
          group_name: document.getElementById('edu_ssc_group').options[document.getElementById('edu_ssc_group').selectedIndex]?.text || 'Science',
          year: document.getElementById('edu_ssc_year').value.trim()
        },
        hsc: {
          enabled: true,
          exam: hscExamEl.value,
          exam_name: hscExamEl.options[hscExamEl.selectedIndex]?.text || 'H.S.C',
          board: hscBoardEl.value,
          board_name: hscBoardEl.options[hscBoardEl.selectedIndex]?.text || 'Dhaka',
          roll: document.getElementById('edu_hsc_roll').value.trim(),
          result_type: document.getElementById('edu_hsc_result_type').value,
          result: document.getElementById('edu_hsc_result').value.trim(),
          group: document.getElementById('edu_hsc_group').value,
          group_name: document.getElementById('edu_hsc_group').options[document.getElementById('edu_hsc_group').selectedIndex]?.text || 'Science',
          year: document.getElementById('edu_hsc_year').value.trim()
        },
        graduation: {
          enabled: true,
          exam: graExamEl.value,
          exam_name: graExamEl.options[graExamEl.selectedIndex]?.text || 'B.Sc Engineering',
          institute: graUniEl.value,
          institute_name: graUniEl.options[graUniEl.selectedIndex]?.text || '',
          subject: document.getElementById('edu_gra_subject').value.trim(),
          subject_name: document.getElementById('edu_gra_subject').value.trim(),
          result_type: document.getElementById('edu_gra_result_type').value,
          result: document.getElementById('edu_gra_result').value.trim(),
          duration: document.getElementById('edu_gra_duration').value,
          year: document.getElementById('edu_gra_year').value.trim()
        },
        masters: {
          enabled: document.getElementById('edu_mas_enabled').checked,
          exam: masExamEl.value,
          exam_name: masExamEl.options[masExamEl.selectedIndex]?.text || 'M.Sc',
          institute: masUniEl.value,
          institute_name: masUniEl.options[masUniEl.selectedIndex]?.text || '',
          subject: document.getElementById('edu_mas_subject').value.trim(),
          subject_name: document.getElementById('edu_mas_subject').value.trim(),
          result_type: document.getElementById('edu_mas_result_type').value,
          result: document.getElementById('edu_mas_result').value.trim(),
          duration: document.getElementById('edu_mas_duration').value,
          year: document.getElementById('edu_mas_year').value.trim()
        }
      },
      experience: {
        enabled: document.getElementById('exp_enabled').checked,
        jobs: [
          {
            employment_type: document.getElementById('exp_employment_type').value,
            designation: document.getElementById('exp_designation').value.trim(),
            organization: document.getElementById('exp_organization').value.trim(),
            office_address: document.getElementById('exp_office_address').value.trim(),
            job_start_date: document.getElementById('exp_start_date').value,
            job_end_date: document.getElementById('exp_end_date').value,
            currently_working: document.getElementById('exp_currently_working').checked,
            last_salary: document.getElementById('exp_last_salary').value.trim(),
            job_description: document.getElementById('exp_description').value.trim()
          }
        ]
      },
      media: {
        photo_base64: photoBase64,
        signature_base64: sigBase64
      }
    };
  }

  function collectSettingsData() {
    return {
      auto_fill_on_load: document.getElementById('set_auto_fill_on_load').checked,
      auto_check_agreement: document.getElementById('set_auto_check_agreement').checked,
      focus_captcha: document.getElementById('set_focus_captcha').checked,
      show_floating_button: document.getElementById('set_show_floating_button').checked
    };
  }

  // Save Profile Handler
  async function saveProfile() {
    const profile = collectProfileData();
    const settings = collectSettingsData();

    await chrome.storage.local.set({ profile, settings });
    showAlert('✅ Profile and settings saved successfully! You are ready to autofill BD government jobs.', 'success');
  }

  document.getElementById('saveTopBtn').addEventListener('click', saveProfile);
  document.getElementById('saveBottomBtn').addEventListener('click', saveProfile);

  // Alert Banner
  function showAlert(msg, type = 'success') {
    const banner = document.getElementById('alertBanner');
    banner.className = `alert-banner ${type}`;
    banner.textContent = msg;
    banner.style.display = 'flex';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => { banner.style.display = 'none'; }, 4000);
  }

  // Load Initial Data
  const stored = await chrome.storage.local.get(['profile', 'settings']);
  if (stored.profile && stored.profile.personal && stored.profile.personal.name) {
    populateForm(stored.profile, stored.settings);
  } else {
    console.log('[BD Govt Job Autofill] Profile is empty. Fill any Teletalk form to auto-capture, or load demo profile.');
  }


  // Load Demo Profile Button
  document.getElementById('loadDemoBtn').addEventListener('click', async () => {
    if (confirm('Load demo candidate profile? (This will overwrite unsaved fields)')) {
      try {
        const demoRes = await fetch(chrome.runtime.getURL('data/sample_profile.json'));
        const demo = await demoRes.json();
        populateForm(demo, demo.settings);
        showAlert('Demo profile loaded into form. Click "Save Profile" to apply.', 'success');
      } catch (err) {
        showAlert('Failed to load demo profile: ' + err.message, 'error');
      }
    }
  });

  // Export Profile
  document.getElementById('exportBtn').addEventListener('click', () => {
    const profile = collectProfileData();
    const settings = collectSettingsData();
    const dataToExport = { ...profile, settings };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bd_job_profile_${(profile.personal?.name || 'candidate').toLowerCase().replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Import Profile
  const importFileInput = document.getElementById('importFileInput');
  document.getElementById('importBtn').addEventListener('click', () => importFileInput.click());
  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const imported = JSON.parse(evt.target.result);
        if (!imported.personal) {
          showAlert('Invalid profile file! Missing "personal" details.', 'error');
          return;
        }
        populateForm(imported, imported.settings);
        await saveProfile();
        showAlert('Profile imported and saved successfully!', 'success');
      } catch (err) {
        showAlert('Failed to parse JSON file: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
    importFileInput.value = '';
  });
});
