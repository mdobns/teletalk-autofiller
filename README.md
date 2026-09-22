<p align="center">
  <img src="icons/icon128.png" width="128" height="128" alt="Teletalk Autofiller Logo" style="border-radius: 24px;">
</p>

<h1 align="center">⚡ Teletalk Autofiller</h1>
<p align="center">
  <b>One-Click Intelligent Form Filler for Bangladesh Government Jobs (*.teletalk.com.bd)</b><br>
  <code>Version: Beta 2.0</code>
</p>

---

## 📌 Problem & Investigation

In Bangladesh, virtually all government ministries, directorates, authorities, and autonomous bodies use **Teletalk** portals for recruitment (e.g., `bhtpa.teletalk.com.bd`, `jobs.teletalk.com.bd`, `dpe.teletalk.com.bd`, `railway.teletalk.com.bd`, etc.).

### Key Challenges with Teletalk Forms:
1. **Dynamic Dependent Cascades:**
   - Standard browser autofill fails because Teletalk dropdowns depend on JavaScript event handlers:
     - Selecting a **District** triggers `onChangeDistrict()` to load **Upazilas/Thanas**.
     - Selecting **SSC / HSC Exam Type** loads specific **Group / Subject** options.
     - Selecting **Graduation Exam** loads related majors/subjects.
     - Selecting **National ID (NID)** or **Marital Status** executes `onChangeId()` to dynamically reveal text fields.
2. **Strict Validation:**
   - Name and addresses must be strictly UPPERCASE (English) or strictly Bengali characters (`bangla_only_string`).
   - Photos must be **300 × 300 px** (under 100 KB) and signatures must be **300 × 80 px** (under 60 KB).
3. **Repetition:**
   - Job seekers have to fill out the exact same 50+ fields over and over again for every post they apply to.

---

## ⚡ The Solution: BD Govt Job Autofill

This project provides a **one-click autofill solution** that handles all cascading dropdowns, triggers Teletalk's native JavaScript events, formats values accurately, and directs focus straight to the Captcha field.

### ✨ Key Features:
- **In-Field Autofill (Zero Floating Clutter):** Simply click or focus on any input field (like Applicant's Name), and an autofill suggestion appears directly attached to the field. Click it to autofill all 50+ fields in ~0.3s.
- **Automatic Silent Save on Submit:** Fill any Teletalk form once and click Submit. The extension silently extracts and saves your entire profile for all future jobs.
- **Overwrite Warning:** If a profile is already saved, the extension warns you before overwriting it if you submit another form.
- **Smart Cascade Pipeline:** Automatically waits for dynamic selects (e.g., District ➔ Upazila, SSC ➔ Group, Graduation ➔ Subject) before selecting values.
- **Bangladesh Geo-Data Built-In:** Complete database of all **64 Districts** and **569 Upazilas/Thanas** pre-loaded.
- **240+ Universities Indexed:** Pre-loaded university index for seamless Graduation and Masters institute selection.
- **Canvas Photo & Signature Auto-Resizer:** Automatically formats any uploaded photo to **300 × 300 px** and signature to **300 × 80 px** JPG.
- **Automatic Captcha Highlighting:** Smoothly scrolls to the Captcha field and pulses with a glowing ring for instant submission.
- **100% Offline & Private:** All your personal data is saved locally inside your browser's `chrome.storage.local`. Nothing is ever sent to external servers.

---

## 🚀 How to Install & Use (Chrome Extension)

### Step 1: Load into Chrome / Edge / Brave
1. Open Google Chrome (or Edge / Brave).
2. Navigate to `chrome://extensions/` in your address bar.
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click the **Load unpacked** button in the top-left corner.
5. Select the folder:
   ```
   D:\job extension
   ```
6. The extension **BD Govt Job Autofill (Teletalk)** is now installed!

---

### Step 2: Auto-Capture on Submit (Zero-Typing Setup)
You do **NOT** need to manually type everything into the extension!
1. Open any Teletalk job application form (e.g. BHTPA, ADLGM, or any government circular).
2. Fill out the application form once normally.
3. When you click **Submit / Next**, the extension **silently extracts all 50+ fields and automatically saves your profile**!
4. *(Optional)* On the **Preview** page, when you upload your Photo and Signature files, the extension captures and saves them too.
5. If a profile already exists when you submit another form, the extension will display a prompt asking whether you want to overwrite it or keep your existing profile.

---

### Step 3: In-Field Autofill for All Future Jobs!
1. Open ANY Bangladesh government job application on Teletalk:
   - [BHTPA Assistant Maintenance Engineer](https://bhtpa.teletalk.com.bd/bhtpa2026/application.php?post_code=xZ4N&info=kcwFY2XMOjACV2CrFJEf5EXXnXFMupH0J7bvwTEq8fq4xCdb&alljobs_id=&nid=2&submitPremium=)
   - [ADLGM Assistant Manager (Technical)](https://jobs.teletalk.com.bd/jobs_adlgm_am/application.php?post_code=xZgN&info=lZJcOGXMPTICAjX8QZEf50fTnSpJ6JL0Lb%2FkxjEm96aww3Rc&alljobs_id=&nid=2&submitPremium=)
2. **Click or focus on any input field** (e.g., *Applicant's Name*).
3. A sleek autocomplete dropdown appears right under your cursor:
   > ⚡ **Autofill as [Your Name]** (Click to fill all fields)
4. Click the suggestion. Watch all 50+ fields (including dynamic districts, thanas, boards, and subjects) cascade and fill in ~0.3s!
5. Type the 5-letter Captcha and submit!


---

## 🌐 Alternative: Tampermonkey Userscript

If you prefer using Tampermonkey / Violentmonkey (or on mobile via Kiwi Browser):
1. Install the [Tampermonkey extension](https://www.tampermonkey.net/).
2. Open Tampermonkey Dashboard ➔ **Add a new script**.
3. Copy and paste the code from [teletalk-autofill.user.js](file:///D:/job%20extension/userscript/teletalk-autofill.user.js).
4. Save the script. It will now automatically appear on all `*.teletalk.com.bd` application pages.

---

## 📂 Project Structure

```
D:\job extension\
├── manifest.json                  # Chrome Extension Manifest V3
├── background.js                  # Service worker lifecycle
├── content.js                     # Smart cascading autofill engine
├── content.css                    # Floating quick-fill button & notification toasts
├── popup/
│   ├── popup.html                 # Extension popup interface
│   ├── popup.css                  # Popup styling
│   └── popup.js                   # Extension popup logic & status detector
├── options/
│   ├── options.html               # Profile Manager GUI
│   ├── options.css                # Options stylesheet
│   └── options.js                 # Profile management & canvas image auto-resizer
├── data/
│   ├── bd_geo.json                # All 64 BD districts and 569 upazilas
│   ├── reference_lists.json       # 243 BD universities and educational subjects
│   └── sample_profile.json        # Default template profile
├── icons/                         # Extension icons (16px, 48px, 128px)
├── userscript/
│   └── teletalk-autofill.user.js  # Standalone Tampermonkey script version
└── README.md                      # Documentation
```
