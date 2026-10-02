/**
 * CityCare - Supabase Client & Backend REST API Data Abstraction Layer
 * Communicates with backend REST API (/api/complaints), Supabase DB, and LocalStorage.
 */

let supabaseClient = null;

// Initialize Supabase Client if credentials exist and CDN SDK is loaded
if (typeof supabase !== 'undefined' && isSupabaseConfigured()) {
  try {
    supabaseClient = supabase.createClient(
      SUPABASE_CONFIG.SUPABASE_URL,
      SUPABASE_CONFIG.SUPABASE_ANON_KEY
    );
    console.log('✅ Supabase Client initialized successfully.');
  } catch (err) {
    console.warn('⚠️ Supabase init failed:', err);
  }
}

/**
 * Fetch all complaints (sorted by creation date descending)
 */
async function apiGetComplaints() {
  // 1. Try Local Backend Server API (/api/complaints)
  try {
    const res = await fetch('/api/complaints');
    if (res.ok) {
      const result = await res.json();
      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        console.log('✅ Complaints loaded from Backend Database.');
        return result.data.map(transformFromDb);
      }
    }
  } catch (e) {
    console.info('ℹ️ Local Backend API fetch skipped, trying Supabase Cloud / LocalStorage fallback.');
  }

  // 2. Try Supabase Cloud DB
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('complaints')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        console.log('✅ Complaints loaded from Supabase Cloud.');
        return data.map(transformFromDb);
      }
    } catch (err) {
      console.warn('Supabase Cloud fetch error:', err);
    }
  }

  // 3. Fallback to LocalStorage
  return getLocalStorageComplaints();
}

/**
 * Create a new complaint record
 */
async function apiCreateComplaint(complaintData) {
  // 1. Save to Local Backend Database Server API
  let savedToBackend = null;
  try {
    const res = await fetch('/api/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(complaintData)
    });
    if (res.ok) {
      const result = await res.json();
      if (result.success && result.data) {
        console.log('✅ Complaint saved to Backend REST Database.');
        savedToBackend = transformFromDb(result.data);
      }
    }
  } catch (e) {
    console.warn('Backend REST DB unavailable:', e);
  }

  // 2. Sync to Supabase Cloud DB
  if (supabaseClient) {
    try {
      const dbRow = transformToDb(complaintData);
      await supabaseClient.from('complaints').insert([dbRow]);
      console.log('✅ Complaint synced to Supabase Cloud.');
    } catch (err) {
      console.warn('Supabase Cloud insert warning:', err);
    }
  }

  // 3. Also persist to LocalStorage for offline speed
  saveToLocalStorage(complaintData);

  return savedToBackend || complaintData;
}

/**
 * Update complaint status and admin remarks
 */
async function apiUpdateComplaint(id, updateFields) {
  // 1. Update in Backend REST Database Server
  try {
    await fetch(`/api/complaints/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateFields)
    });
    console.log(`✅ Request ${id} updated in Backend REST Database.`);
  } catch (e) {
    console.warn('Backend REST update warning:', e);
  }

  // 2. Update in Supabase Cloud DB
  if (supabaseClient) {
    try {
      const dbUpdates = {};
      if (updateFields.status !== undefined) dbUpdates.status = updateFields.status;
      if (updateFields.priority !== undefined) dbUpdates.priority = updateFields.priority;
      if (updateFields.adminRemarks !== undefined) dbUpdates.admin_remarks = updateFields.adminRemarks;

      await supabaseClient.from('complaints').update(dbUpdates).eq('id', id);
    } catch (err) {
      console.warn('Supabase update warning:', err);
    }
  }

  // 3. Update in LocalStorage
  return updateLocalStorage(id, updateFields);
}

/**
 * Upload image to Backend / Supabase Storage (or return Base64 Data URL)
 */
async function apiUploadImage(file, complaintId) {
  if (!file) return '';

  // 1. Convert file to Base64
  const base64 = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });

  if (!base64) return '';

  // 2. Try Backend Server Upload Endpoint
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64, complaintId })
    });
    if (res.ok) {
      const result = await res.json();
      if (result.success && result.imageUrl) {
        console.log('✅ Image uploaded to Backend Storage:', result.imageUrl);
        return result.imageUrl;
      }
    }
  } catch (e) {
    console.info('Backend image upload endpoint skipped, returning Data URL.');
  }

  // 3. Try Supabase Cloud Storage
  if (supabaseClient) {
    try {
      const fileExt = file.name ? file.name.split('.').pop() : 'png';
      const fileName = `${complaintId}_${Date.now()}.${fileExt}`;
      const filePath = `reports/${fileName}`;

      const { data, error } = await supabaseClient
        .storage
        .from(SUPABASE_CONFIG.STORAGE_BUCKET)
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (!error) {
        const { data: urlData } = supabaseClient.storage.from(SUPABASE_CONFIG.STORAGE_BUCKET).getPublicUrl(filePath);
        if (urlData && urlData.publicUrl) return urlData.publicUrl;
      }
    } catch (err) {
      console.warn('Supabase storage upload error:', err);
    }
  }

  // Fallback: Return Base64 Data URL
  return base64;
}

// -------------------------------------------------------------
// Data Transform Helpers (Database Snake Case <-> JS Camel Case)
// -------------------------------------------------------------

function transformFromDb(row) {
  if (!row) return {};
  return {
    id: row.id,
    fullName: row.full_name || row.fullName || 'Anonymous',
    phone: row.phone || 'Not Provided',
    category: row.category || 'General',
    title: row.title || 'Civic Problem',
    description: row.description || '',
    location: row.location || '',
    image: row.image_url || row.image || '',
    priority: row.priority || 'Medium',
    status: row.status || 'Pending',
    adminRemarks: row.admin_remarks || row.adminRemarks || '',
    date: row.created_at ? formatTimestamp(row.created_at) : (row.date || new Date().toLocaleString())
  };
}

function transformToDb(item) {
  return {
    id: item.id,
    full_name: item.fullName,
    phone: item.phone,
    category: item.category,
    title: item.title,
    description: item.description,
    location: item.location,
    image_url: item.image || '',
    priority: item.priority || 'Medium',
    status: item.status || 'Pending',
    admin_remarks: item.adminRemarks || ''
  };
}

function formatTimestamp(isoStr) {
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return isoStr;
  }
}

// -------------------------------------------------------------
// LocalStorage Persistence Helper Functions
// -------------------------------------------------------------

const STORAGE_KEY = 'citycare_complaints';

function getLocalStorageComplaints() {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    return existing ? JSON.parse(existing) : [];
  } catch (e) {
    return [];
  }
}

function saveToLocalStorage(item) {
  const list = getLocalStorageComplaints();
  list.unshift(item);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('LocalStorage save error:', e);
  }
  return item;
}

function updateLocalStorage(id, updateFields) {
  const list = getLocalStorageComplaints();
  const idx = list.findIndex(c => c.id === id);
  if (idx !== -1) {
    if (updateFields.status !== undefined) list[idx].status = updateFields.status;
    if (updateFields.priority !== undefined) list[idx].priority = updateFields.priority;
    if (updateFields.adminRemarks !== undefined) list[idx].adminRemarks = updateFields.adminRemarks;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {}
    return list[idx];
  }
  return null;
}
