/**
 * CityCare - Citizen Portal Logic (Supabase + LocalStorage Fallback Enabled)
 * Manages issue reporting, image uploading, complaint tracking, and live UI updates.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Theme Manager & Profile Controls
  initThemeManager();

  // Initialize Authentication UI & Event Listeners
  initAuthUI();

  // Initialize mock data in LocalStorage if empty & Supabase is not connected
  initLocalStorageMockData();

  // Initialize UI Features & Event Listeners
  initNavigation();
  initCategoryCards();
  initImageUpload();
  initFormSubmission();
  initTracking();
  initFaqAccordion();
  initLocationDetector();
  
  // Load dynamic stats counters
  await refreshStatsCounters();
});

let currentUploadedFile = null;
let currentUploadedImageBase64 = '';

/**
 * Initialize sample dataset in localStorage if empty (fallback mode)
 */
function initLocalStorageMockData() {
  const STORAGE_KEY = 'citycare_complaints';
  const existing = localStorage.getItem(STORAGE_KEY);
  if (!existing || JSON.parse(existing).length === 0) {
    const defaultComplaints = [
      {
        id: 'CC-2026-0101',
        fullName: 'Rahul Sharma',
        phone: '+91 98765 43210',
        category: 'Garbage',
        title: 'Uncollected Garbage Pile near Green Park Market',
        description: 'Garbage has been accumulating for 4 days near the central vegetable market gate. Needs urgent cleanup.',
        location: 'Green Park Sector 4, Main Market Road',
        image: createCategoryPlaceholderSvg('Garbage'),
        priority: 'High',
        date: '2026-09-10 10:30 AM',
        status: 'Pending',
        adminRemarks: ''
      },
      {
        id: 'CC-2026-0102',
        fullName: 'Anita Desai',
        phone: '+91 98123 45678',
        category: 'Road & Potholes',
        title: 'Dangerous Pothole on MG Road Flyover Slip Road',
        description: 'Large deep pothole causing severe traffic slowdowns and bike hazards near pillar 42.',
        location: 'MG Road Flyover Slipway, West Junction',
        image: createCategoryPlaceholderSvg('Road & Potholes'),
        priority: 'High',
        date: '2026-09-11 02:15 PM',
        status: 'In Progress',
        adminRemarks: 'Field road repair team dispatched with asphalt patcher.'
      },
      {
        id: 'CC-2026-0103',
        fullName: 'Vikram Singh',
        phone: '+91 97654 32109',
        category: 'Streetlights',
        title: 'Broken Streetlights on 5th Avenue',
        description: 'Four consecutive streetlights are non-functional, making the street unsafe at night.',
        location: '5th Avenue, Block C, near Community Center',
        image: createCategoryPlaceholderSvg('Streetlights'),
        priority: 'Medium',
        date: '2026-09-12 09:00 AM',
        status: 'Assigned',
        adminRemarks: 'Electrical engineering team assigned.'
      },
      {
        id: 'CC-2026-0104',
        fullName: 'Priya Patel',
        phone: '+91 99887 76655',
        category: 'Water Leakage',
        title: 'Major Pipeline Leakage wasting clean water',
        description: 'Underground water pipe burst leaking clean water into street drain.',
        location: 'Crossroad 12, near City Public Library',
        image: createCategoryPlaceholderSvg('Water Leakage'),
        priority: 'High',
        date: '2026-09-08 11:45 AM',
        status: 'Resolved',
        adminRemarks: 'Main valve repaired and pipe section replaced.'
      }
    ];

    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultComplaints));
  }
}

/**
 * Generate clean SVG Data URL placeholder for category preview
 */
function createCategoryPlaceholderSvg(category) {
  const bg = '#E3F2FD';
  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
    <rect width="600" height="400" fill="${bg}"/>
    <rect x="20" y="20" width="560" height="360" rx="12" fill="#FFFFFF" stroke="#1565C0" stroke-width="2" stroke-dasharray="8 8"/>
    <circle cx="300" cy="180" r="48" fill="#1565C0"/>
    <text x="300" y="188" font-family="sans-serif" font-weight="bold" font-size="28" fill="#FFFFFF" text-anchor="middle">CC</text>
    <text x="300" y="270" font-family="sans-serif" font-weight="bold" font-size="22" fill="#0D47A1" text-anchor="middle">${category} Inspection Image</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(svgString);
}

/**
 * Update Impact Stats Strip counters dynamically from DB
 */
async function refreshStatsCounters() {
  const complaints = await apiGetComplaints();
  const resolvedCount = complaints.filter(c => c.status === 'Resolved').length;
  const totalCount = complaints.length;

  const resolvedEl = document.getElementById('stat-resolved-count');
  if (resolvedEl) {
    resolvedEl.textContent = `${resolvedCount + 1840}+`;
  }

  const activeCitizensEl = document.getElementById('stat-active-citizens');
  if (activeCitizensEl) {
    activeCitizensEl.textContent = `${totalCount + 12400}+`;
  }
}

/**
 * Mobile Drawer & Nav scroll handling
 */
function initNavigation() {
  const hamburgerBtn = document.getElementById('hamburger-toggle');
  const mobileDrawer = document.getElementById('mobile-drawer');

  if (hamburgerBtn && mobileDrawer) {
    hamburgerBtn.addEventListener('click', () => {
      mobileDrawer.classList.toggle('active');
    });

    mobileDrawer.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileDrawer.classList.remove('active');
      });
    });
  }
}

/**
 * Interactive Category Cards - click pre-fills report form category
 */
function initCategoryCards() {
  const categoryCards = document.querySelectorAll('.category-card');
  const categorySelect = document.getElementById('category');
  const reportSection = document.getElementById('report');

  categoryCards.forEach(card => {
    card.addEventListener('click', () => {
      const selectedCategory = card.getAttribute('data-category');
      if (categorySelect && selectedCategory) {
        categorySelect.value = selectedCategory;
      }
      if (reportSection) {
        reportSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

/**
 * Drag and Drop & Image Upload handling
 * HTML IDs: upload-dropzone, photo-file, preview-container, image-preview, btn-remove-image
 */
function initImageUpload() {
  const dropzone = document.getElementById('upload-dropzone');
  const fileInput = document.getElementById('photo-file');
  const previewContainer = document.getElementById('preview-container');
  const previewImg = document.getElementById('image-preview');
  const removeBtn = document.getElementById('btn-remove-image');

  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) handleImageFile(files[0]);
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleImageFile(e.target.files[0]);
  });

  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      currentUploadedFile = null;
      currentUploadedImageBase64 = '';
      fileInput.value = '';
      if (previewContainer) previewContainer.classList.remove('active');
      dropzone.style.display = 'block';
    });
  }

  function handleImageFile(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Please upload a valid image file (JPG, PNG, WebP).');
      return;
    }

    currentUploadedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      currentUploadedImageBase64 = e.target.result;
      if (previewImg) previewImg.src = currentUploadedImageBase64;
      if (previewContainer) previewContainer.classList.add('active');
      dropzone.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }
}

/**
 * Geolocation Detector
 */
function initLocationDetector() {
  const locateBtn = document.getElementById('btn-detect-location');
  const locationInput = document.getElementById('location');

  if (!locateBtn || !locationInput) return;

  locateBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser.');
      return;
    }

    locateBtn.disabled = true;
    locateBtn.textContent = 'Detecting...';

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(4);
        const lng = position.coords.longitude.toFixed(4);
        locationInput.value = `Lat: ${lat}, Long: ${lng} (Detected via GPS)`;
        locateBtn.disabled = false;
        locateBtn.textContent = '📍 Auto Detect';
        showToast('📍 GPS Location detected successfully!');
      },
      (error) => {
        locateBtn.disabled = false;
        locateBtn.textContent = '📍 Auto Detect';
        showToast('Could not retrieve precise location. Please type manually.');
      }
    );
  });
}

/**
 * Handle Complaint Form Submission
 * HTML IDs: complaint-form, fullName, phoneNumber, category, title, description, location, priority
 * Modal IDs: success-modal, modal-complaint-id, btn-copy-id, btn-modal-track
 */
function initFormSubmission() {
  const form = document.getElementById('complaint-form');
  const modalOverlay = document.getElementById('success-modal');
  const modalComplaintIdEl = document.getElementById('modal-complaint-id');
  const btnCopyId = document.getElementById('btn-copy-id');
  const btnModalTrack = document.getElementById('btn-modal-track');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = document.getElementById('fullName').value.trim();
    const phone = document.getElementById('phoneNumber').value.trim();
    const category = document.getElementById('category').value;
    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('description').value.trim();
    const location = document.getElementById('location').value.trim();
    const priorityEl = document.querySelector('input[name="priority"]:checked');
    const priority = priorityEl ? priorityEl.value : 'Medium';

    if (!fullName || !category || !title || !description || !location) {
      showToast('Please fill out all required fields marked with *');
      return;
    }

    // Find the submit button inside the form
    const submitBtn = form.querySelector('button[type="submit"]');

    // Generate unique complaint ID
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const complaintId = `CC-2026-${randomNum}`;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `Submitting to Database...`;
    }

    // Upload image to Supabase Storage or get base64
    let imageUrl = '';
    if (currentUploadedFile) {
      imageUrl = await apiUploadImage(currentUploadedFile, complaintId);
    } else if (currentUploadedImageBase64) {
      imageUrl = currentUploadedImageBase64;
    } else {
      imageUrl = createCategoryPlaceholderSvg(category);
    }

    const newComplaint = {
      id: complaintId,
      fullName,
      phone: phone || 'Not Provided',
      category,
      title,
      description,
      location,
      image: imageUrl,
      priority,
      date: new Date().toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }),
      status: 'Pending',
      adminRemarks: ''
    };

    // Submit to Supabase DB or LocalStorage
    await apiCreateComplaint(newComplaint);

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `Submit Complaint &rarr;`;
    }

    // Reset Form
    form.reset();
    currentUploadedFile = null;
    currentUploadedImageBase64 = '';
    const previewContainer = document.getElementById('preview-container');
    const dropzone = document.getElementById('upload-dropzone');
    if (previewContainer) previewContainer.classList.remove('active');
    if (dropzone) dropzone.style.display = 'block';

    // Refresh stats
    refreshStatsCounters();

    // Show Success Modal with complaint ID
    if (modalComplaintIdEl) modalComplaintIdEl.textContent = complaintId;
    if (modalOverlay) modalOverlay.classList.add('active');
  });

  // Copy ID button
  if (btnCopyId) {
    btnCopyId.addEventListener('click', () => {
      const id = modalComplaintIdEl ? modalComplaintIdEl.textContent.trim() : '';
      if (id && navigator.clipboard) {
        navigator.clipboard.writeText(id).then(() => {
          showToast('✅ Complaint ID copied to clipboard!');
        });
      }
    });
  }

  // Track Now button inside success modal
  if (btnModalTrack && modalOverlay) {
    btnModalTrack.addEventListener('click', () => {
      const id = modalComplaintIdEl ? modalComplaintIdEl.textContent.trim() : '';
      modalOverlay.classList.remove('active');
      const trackInput = document.getElementById('track-id-input');
      if (trackInput) {
        trackInput.value = id;
        document.getElementById('track').scrollIntoView({ behavior: 'smooth' });
        // Auto-search after a small delay
        setTimeout(() => {
          document.getElementById('btn-track-submit').click();
        }, 500);
      }
    });
  }

  // Close modal on overlay click
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        modalOverlay.classList.remove('active');
      }
    });
  }
}

/**
 * Track Complaint Section Logic
 * HTML IDs: track-id-input, btn-track-submit, track-result-card, track-error-card
 * Sample chips: .sample-chip with data-id attribute
 */
function initTracking() {
  const trackBtn = document.getElementById('btn-track-submit');
  const trackInput = document.getElementById('track-id-input');
  const trackResultCard = document.getElementById('track-result-card');
  const trackErrorCard = document.getElementById('track-error-card');
  const sampleChips = document.querySelectorAll('.sample-chip');

  if (!trackBtn || !trackInput) return;

  const performSearch = async (query) => {
    const q = query.trim().toLowerCase();
    if (!q) {
      showToast('Please enter a Complaint ID or Mobile Number to search.');
      return;
    }

    trackBtn.disabled = true;
    trackBtn.textContent = 'Searching...';

    const complaints = await apiGetComplaints();
    const match = complaints.find(c => 
      c.id.toLowerCase() === q || 
      (q.replace(/[^0-9]/g, '').length >= 4 && c.phone.replace(/[^0-9]/g, '').includes(q.replace(/[^0-9]/g, ''))) ||
      (q.length >= 3 && c.fullName.toLowerCase().includes(q))
    );

    trackBtn.disabled = false;
    trackBtn.textContent = 'Search';

    if (match) {
      renderTrackDetails(match);
      if (trackErrorCard) trackErrorCard.classList.remove('active');
      if (trackResultCard) {
        trackResultCard.classList.add('active');
        trackResultCard.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      if (trackResultCard) trackResultCard.classList.remove('active');
      if (trackErrorCard) {
        const errorIdSpan = document.getElementById('error-input-id');
        if (errorIdSpan) errorIdSpan.textContent = query.trim();
        trackErrorCard.classList.add('active');
        trackErrorCard.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  trackBtn.addEventListener('click', () => performSearch(trackInput.value));
  trackInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') performSearch(trackInput.value);
  });

  sampleChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const sampleId = chip.getAttribute('data-id') || chip.textContent.trim();
      trackInput.value = sampleId;
      performSearch(sampleId);
    });
  });
}

/**
 * Render visual stepper timeline and complaint details
 * HTML IDs: res-id, res-date, res-priority-badge, res-status-badge, 
 *           res-category, res-title, res-location, res-description, 
 *           res-admin-remarks, res-admin-remarks-group, res-photo
 *           timeline-progress-bar, step-submitted, step-pending, step-assigned, step-in-progress, step-resolved
 */
function renderTrackDetails(complaint) {
  const trackIdTitle = document.getElementById('res-id');
  const trackDate = document.getElementById('res-date');
  const trackPriorityBadge = document.getElementById('res-priority-badge');
  const trackStatusBadge = document.getElementById('res-status-badge');
  const trackCategory = document.getElementById('res-category');
  const trackTitle = document.getElementById('res-title');
  const trackLocation = document.getElementById('res-location');
  const trackDesc = document.getElementById('res-description');
  const trackRemarks = document.getElementById('res-admin-remarks');
  const trackRemarksGroup = document.getElementById('res-admin-remarks-group');
  const trackPhoto = document.getElementById('res-photo');

  if (trackIdTitle) trackIdTitle.textContent = complaint.id;
  if (trackDate) trackDate.textContent = 'Submitted on ' + complaint.date;
  if (trackCategory) trackCategory.textContent = complaint.category;
  if (trackTitle) trackTitle.textContent = complaint.title;
  if (trackDesc) trackDesc.textContent = complaint.description;
  if (trackLocation) trackLocation.textContent = complaint.location;
  if (trackPhoto) trackPhoto.src = complaint.image || createCategoryPlaceholderSvg(complaint.category);

  // Priority badge
  if (trackPriorityBadge) {
    trackPriorityBadge.textContent = complaint.priority.toUpperCase() + ' PRIORITY';
    trackPriorityBadge.className = 'badge badge-priority-' + complaint.priority.toLowerCase();
  }

  // Status badge
  if (trackStatusBadge) {
    trackStatusBadge.textContent = complaint.status.toUpperCase();
    trackStatusBadge.className = 'badge ' + getBadgeClassForStatus(complaint.status);
  }

  // Admin Remarks section - show/hide
  if (complaint.adminRemarks && complaint.adminRemarks.trim()) {
    if (trackRemarks) trackRemarks.textContent = complaint.adminRemarks;
    if (trackRemarksGroup) trackRemarksGroup.style.display = 'block';
  } else {
    if (trackRemarksGroup) trackRemarksGroup.style.display = 'none';
  }

  // Update 5-step Timeline Stepper Progress
  // Steps: submitted(1) -> pending(2) -> assigned(3) -> in-progress(4) -> resolved(5)
  const stepMap = { 'Pending': 2, 'Assigned': 3, 'In Progress': 4, 'Resolved': 5 };
  const currentStepNum = stepMap[complaint.status] || 1;

  const stepIds = ['step-submitted', 'step-pending', 'step-assigned', 'step-in-progress', 'step-resolved'];
  stepIds.forEach((stepId, idx) => {
    const stepEl = document.getElementById(stepId);
    if (!stepEl) return;
    
    const stepNumber = idx + 1;
    stepEl.classList.remove('completed', 'current');

    if (stepNumber < currentStepNum) {
      stepEl.classList.add('completed');
    } else if (stepNumber === currentStepNum) {
      stepEl.classList.add('current');
    }
  });

  // Update progress line width
  const progressLine = document.getElementById('timeline-progress-bar');
  if (progressLine) {
    const percentageMap = { 1: '0%', 2: '25%', 3: '50%', 4: '75%', 5: '100%' };
    progressLine.style.width = percentageMap[currentStepNum] || '0%';
  }
}

function getBadgeClassForStatus(status) {
  switch (status) {
    case 'Pending': return 'badge-pending';
    case 'In Progress': return 'badge-in-progress';
    case 'Assigned': return 'badge-assigned';
    case 'Resolved': return 'badge-resolved';
    default: return 'badge-pending';
  }
}

/**
 * Accordion FAQ toggle
 */
function initFaqAccordion() {
  const faqQuestions = document.querySelectorAll('.faq-question');
  faqQuestions.forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.parentElement;
      item.classList.toggle('active');
    });
  });
}

/**
 * Toast notification banner
 */
function showToast(message) {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;

  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3500);
}

/**
 * Theme Manager & Profile Controls
 */
function initThemeManager() {
  const THEME_KEY = 'citycare_theme';

  const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(savedTheme);

  const toggleBtns = document.querySelectorAll('#theme-toggle-btn');
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(newTheme);
      localStorage.setItem(THEME_KEY, newTheme);
    });
  });

  const themeOptBtns = document.querySelectorAll('.theme-opt-btn[data-set-theme]');
  themeOptBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetTheme = btn.getAttribute('data-set-theme');
      applyTheme(targetTheme);
      localStorage.setItem(THEME_KEY, targetTheme);
    });
  });

  window.addEventListener('storage', (e) => {
    if (e.key === THEME_KEY && e.newValue) {
      applyTheme(e.newValue);
    }
  });

  const adminProfileTrigger = document.getElementById('user-profile-trigger');
  const adminProfileDropdown = document.getElementById('user-profile-dropdown');

  if (adminProfileTrigger && adminProfileDropdown) {
    adminProfileTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      adminProfileDropdown.classList.toggle('show');
    });
  }

  const citizenProfileTrigger = document.getElementById('citizen-profile-trigger');
  const citizenProfileDropdown = document.getElementById('citizen-profile-dropdown');

  if (citizenProfileTrigger && citizenProfileDropdown) {
    citizenProfileTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      citizenProfileDropdown.classList.toggle('show');
    });
  }

  document.addEventListener('click', (e) => {
    if (adminProfileDropdown && !adminProfileDropdown.contains(e.target) && !adminProfileTrigger.contains(e.target)) {
      adminProfileDropdown.classList.remove('show');
    }
    if (citizenProfileDropdown && !citizenProfileDropdown.contains(e.target) && !citizenProfileTrigger.contains(e.target)) {
      citizenProfileDropdown.classList.remove('show');
    }
  });
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
  }

  const toggleTexts = document.querySelectorAll('.theme-toggle-text');
  toggleTexts.forEach(el => {
    el.textContent = theme === 'dark' ? 'Bright Mode' : 'Dark Mode';
  });

  const activeThemeLabels = document.querySelectorAll('#active-theme-label');
  activeThemeLabels.forEach(el => {
    el.textContent = theme === 'dark' ? '🌙 Dark Mode' : '☀️ Bright Mode';
  });

  const themeOptBtns = document.querySelectorAll('.theme-opt-btn[data-set-theme]');
  themeOptBtns.forEach(btn => {
    const btnTheme = btn.getAttribute('data-set-theme');
    if (btnTheme === theme) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/**
 * Initialize Citizen & Admin Authentication UI and Modals
 */
function initAuthUI() {
  updateAuthHeaderUI();

  // Tab switching inside Auth Modal
  const tabBtnSignin = document.getElementById('tab-btn-signin');
  const tabBtnSignup = document.getElementById('tab-btn-signup');
  const tabBtnAdmin = document.getElementById('tab-btn-admin');
  
  const signinForm = document.getElementById('citizen-signin-form');
  const signupForm = document.getElementById('citizen-signup-form');
  const indexAdminForm = document.getElementById('index-admin-login-form');
  const authAlert = document.getElementById('citizen-auth-alert');

  const headerTitle = document.getElementById('auth-header-title');
  const headerSubtitle = document.getElementById('auth-header-subtitle');

  function switchAuthTab(activeTab) {
    [tabBtnSignin, tabBtnSignup, tabBtnAdmin].forEach(btn => {
      if (btn) btn.classList.remove('active');
    });

    if (signinForm) signinForm.style.display = 'none';
    if (signupForm) signupForm.style.display = 'none';
    if (indexAdminForm) indexAdminForm.style.display = 'none';
    if (authAlert) { authAlert.className = 'auth-alert'; authAlert.style.display = 'none'; }

    if (activeTab === 'signin') {
      if (tabBtnSignin) tabBtnSignin.classList.add('active');
      if (signinForm) signinForm.style.display = 'flex';
      if (headerTitle) headerTitle.textContent = 'Citizen Account Access';
      if (headerSubtitle) headerSubtitle.textContent = 'Sign in to report civic issues and track complaints';
    } else if (activeTab === 'signup') {
      if (tabBtnSignup) tabBtnSignup.classList.add('active');
      if (signupForm) signupForm.style.display = 'flex';
      if (headerTitle) headerTitle.textContent = 'Create Citizen Account';
      if (headerSubtitle) headerSubtitle.textContent = 'Register as a resident to submit & monitor civic issues';
    } else if (activeTab === 'admin') {
      if (tabBtnAdmin) tabBtnAdmin.classList.add('active');
      if (indexAdminForm) indexAdminForm.style.display = 'flex';
      if (headerTitle) headerTitle.textContent = 'Government Admin Access';
      if (headerSubtitle) headerSubtitle.textContent = 'Restricted to authorized municipal administration officers';
    }
  }

  if (tabBtnSignin) tabBtnSignin.addEventListener('click', () => switchAuthTab('signin'));
  if (tabBtnSignup) tabBtnSignup.addEventListener('click', () => switchAuthTab('signup'));
  if (tabBtnAdmin) tabBtnAdmin.addEventListener('click', () => switchAuthTab('admin'));

  const linkSwitchToSignin = document.getElementById('link-switch-to-signin');
  if (linkSwitchToSignin) {
    linkSwitchToSignin.addEventListener('click', (e) => {
      e.preventDefault();
      switchAuthTab('signin');
    });
  }

  // Trigger Citizen Auth Modal opening
  const navProfileBtn = document.getElementById('citizen-profile-trigger');
  const closeCitizenAuthBtn = document.getElementById('btn-close-citizen-auth');

  if (navProfileBtn) {
    navProfileBtn.addEventListener('click', (e) => {
      const user = CityCareAuth.getCurrentUser();
      if (!user) {
        e.stopPropagation();
        openCitizenAuthModal('signin');
      }
    });
  }

  if (closeCitizenAuthBtn) {
    closeCitizenAuthBtn.addEventListener('click', () => {
      closeCitizenAuthModal();
    });
  }

  // Handle Admin Portal button click in nav
  const navAdminBtn = document.getElementById('btn-nav-admin-portal');

  if (navAdminBtn) {
    navAdminBtn.addEventListener('click', (e) => {
      const admin = CityCareAuth.getCurrentAdmin();
      if (!admin) {
        e.preventDefault();
        openCitizenAuthModal('admin');
      }
    });
  }

  // Citizen Sign In Form Submission
  if (signinForm) {
    signinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const loginId = document.getElementById('citizen-login-id').value;
      const password = document.getElementById('citizen-login-password').value;

      const res = await CityCareAuth.loginCitizen(loginId, password);
      if (res.success) {
        showToast(`Welcome back, ${res.user.fullName}!`);
        closeCitizenAuthModal();
        updateAuthHeaderUI();
      } else {
        showAuthAlert('citizen-auth-alert', res.message, 'error');
      }
    });
  }

  // Citizen Sign Up Form Submission
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullName = document.getElementById('citizen-reg-name').value;
      const phone = document.getElementById('citizen-reg-phone').value;
      const email = document.getElementById('citizen-reg-email').value;
      const address = document.getElementById('citizen-reg-address').value;
      const password = document.getElementById('citizen-reg-password').value;

      const res = await CityCareAuth.registerCitizen({ fullName, phone, email, password, address });
      if (res.success) {
        showToast(`Account registered! Welcome ${res.user.fullName}`);
        closeCitizenAuthModal();
        updateAuthHeaderUI();
      } else {
        showAuthAlert('citizen-auth-alert', res.message, 'error');
      }
    });
  }

  // Quick Demo Citizen Button
  const quickCitizenBtn = document.getElementById('btn-quick-citizen-login');
  if (quickCitizenBtn) {
    quickCitizenBtn.addEventListener('click', async () => {
      const idInput = document.getElementById('citizen-login-id');
      const passInput = document.getElementById('citizen-login-password');
      if (idInput) idInput.value = 'rahul@gmail.com';
      if (passInput) passInput.value = 'user123';
      
      const res = await CityCareAuth.loginCitizen('rahul@gmail.com', 'user123');
      if (res.success) {
        showToast(`Demo Sign In: ${res.user.fullName}`);
        closeCitizenAuthModal();
        updateAuthHeaderUI();
      }
    });
  }

  // Index Admin Form Submission
  if (indexAdminForm) {
    indexAdminForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('index-admin-email').value;
      const password = document.getElementById('index-admin-password').value;

      const res = CityCareAuth.loginAdmin(email, password);
      if (res.success) {
        showToast('Admin Authorized: Redirecting to Dashboard...');
        setTimeout(() => { window.location.href = 'admin.html'; }, 400);
      } else {
        showAuthAlert('citizen-auth-alert', res.message, 'error');
      }
    });
  }

  const quickAdminBtn = document.getElementById('btn-quick-admin-login');
  if (quickAdminBtn) {
    quickAdminBtn.addEventListener('click', () => {
      const res = CityCareAuth.loginAdmin('jaiganesh4028@gmail.com', 'jai@hsenag');
      if (res.success) {
        showToast('Authorized Admin: Opening Dashboard...');
        setTimeout(() => { window.location.href = 'admin.html'; }, 300);
      }
    });
  }
}

function openCitizenAuthModal(tab = 'signin') {
  const modal = document.getElementById('citizen-auth-modal');
  if (modal) modal.classList.add('active');

  const tabBtn = document.getElementById(`tab-btn-${tab}`);
  if (tabBtn) tabBtn.click();
}

function closeCitizenAuthModal() {
  const modal = document.getElementById('citizen-auth-modal');
  if (modal) modal.classList.remove('active');
}

function openAdminAuthModal() {
  const modal = document.getElementById('admin-auth-modal');
  if (modal) modal.classList.add('active');
}

function closeAdminAuthModal() {
  const modal = document.getElementById('admin-auth-modal');
  if (modal) modal.classList.remove('active');
}

function showAuthAlert(alertId, message, type) {
  const alertEl = document.getElementById(alertId);
  if (!alertEl) return;
  alertEl.textContent = message;
  alertEl.className = `auth-alert ${type}`;
}

function updateAuthHeaderUI() {
  const user = CityCareAuth.getCurrentUser();
  const navLabel = document.getElementById('nav-profile-label');
  const avatarBox = document.getElementById('dropdown-avatar-box');
  const userTitle = document.getElementById('dropdown-user-title');
  const userSub = document.getElementById('dropdown-user-sub');
  const userStatus = document.getElementById('dropdown-user-status');
  const actionContainer = document.getElementById('dropdown-user-actions');

  // Pre-fill complaint report form fields if empty
  const formNameInput = document.getElementById('fullName');
  const formPhoneInput = document.getElementById('phone') || document.getElementById('phoneNumber');

  if (user) {
    if (navLabel) navLabel.textContent = user.fullName.split(' ')[0];
    if (avatarBox) avatarBox.textContent = CityCareAuth.getInitials(user.fullName);
    if (userTitle) userTitle.textContent = user.fullName;
    if (userSub) userSub.textContent = user.email || user.phone;
    if (userStatus) {
      userStatus.innerHTML = `<span class="profile-dropdown-status-dot"></span> Logged In Citizen`;
      userStatus.style.color = 'var(--status-resolved-text)';
    }

    if (formNameInput && !formNameInput.value) formNameInput.value = user.fullName;
    if (formPhoneInput && !formPhoneInput.value) formPhoneInput.value = user.phone;

    if (actionContainer) {
      actionContainer.innerHTML = `
        <button type="button" id="btn-dropdown-my-complaints" class="btn btn-secondary btn-sm" style="width:100%; text-align:center;">
          📋 Track My Complaints
        </button>
        <a href="#report" class="btn btn-outline btn-sm" style="width:100%; text-align:center;">
          ✏️ Report New Problem
        </a>
        <button type="button" id="btn-citizen-logout" class="btn btn-outline btn-sm" style="width:100%; color: #DC2626; border-color: #FCA5A5; text-align:center;">
          🚪 Sign Out
        </button>
      `;

      const myComplaintsBtn = document.getElementById('btn-dropdown-my-complaints');
      if (myComplaintsBtn) {
        myComplaintsBtn.addEventListener('click', () => {
          const trackInput = document.getElementById('track-id-input');
          const trackSection = document.getElementById('track');
          if (trackInput) {
            trackInput.value = user.phone || user.fullName;
            const btnTrackSubmit = document.getElementById('btn-track-submit');
            if (btnTrackSubmit) btnTrackSubmit.click();
          }
          if (trackSection) trackSection.scrollIntoView({ behavior: 'smooth' });
          const dropdown = document.getElementById('citizen-profile-dropdown');
          if (dropdown) dropdown.classList.remove('show');
        });
      }

      const logoutBtn = document.getElementById('btn-citizen-logout');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          CityCareAuth.logoutCitizen();
          showToast('Signed out of citizen account.');
          updateAuthHeaderUI();
          const dropdown = document.getElementById('citizen-profile-dropdown');
          if (dropdown) dropdown.classList.remove('show');
        });
      }
    }
  } else {
    if (navLabel) navLabel.textContent = 'Sign In / Register';
    if (avatarBox) avatarBox.textContent = 'CP';
    if (userTitle) userTitle.textContent = 'Citizen Guest';
    if (userSub) userSub.textContent = 'Not Logged In';
    if (userStatus) {
      userStatus.innerHTML = `<span class="profile-dropdown-status-dot" style="background-color: #94A3B8; box-shadow: none;"></span> Guest Mode`;
      userStatus.style.color = 'var(--text-muted)';
    }

    if (actionContainer) {
      actionContainer.innerHTML = `
        <button type="button" id="btn-dropdown-signin-action" class="btn btn-primary btn-sm" style="width:100%; text-align:center;">
          🔑 Sign In / Register
        </button>
        <a href="admin.html" id="btn-dropdown-admin" class="btn btn-outline btn-sm" style="width:100%; text-align:center;">Admin Portal &rarr;</a>
      `;

      const signinBtn = document.getElementById('btn-dropdown-signin-action');
      if (signinBtn) {
        signinBtn.addEventListener('click', () => {
          openCitizenAuthModal();
          const dropdown = document.getElementById('citizen-profile-dropdown');
          if (dropdown) dropdown.classList.remove('show');
        });
      }
    }
  }
}

