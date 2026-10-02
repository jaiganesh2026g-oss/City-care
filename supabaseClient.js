/**
 * CityCare - Supabase Client & Data Abstraction Layer
 * Handles Database operations and image uploads to Supabase Storage,
 * with a fallback to LocalStorage if Supabase credentials are not set yet.
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
    console.warn('⚠️ Supabase init failed, falling back to LocalStorage:', err);
  }
} else {
  console.info('ℹ️ Supabase credentials not set or SDK loading fallback. Operating in LocalStorage hybrid mode.');
}

/**
 * Fetch all complaints (sorted by creation date descending)
 */
async function apiGetComplaints() {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('complaints')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform snake_case columns to camelCase for frontend compatibility
      return data.map(transformFromDb);
    } catch (err) {
      console.error('Error fetching complaints from Supabase:', err);
      return getLocalStorageComplaints();
    }
  } else {
    return getLocalStorageComplaints();
  }
}

/**
 * Create a new complaint record
 */
async function apiCreateComplaint(complaintData) {
  if (supabaseClient) {
    try {
      const dbRow = transformToDb(complaintData);
      const { data, error } = await supabaseClient
        .from('complaints')
        .insert([dbRow])
        .select();

      if (error) throw error;
      return transformFromDb(data[0]);
    } catch (err) {
      console.error('Error inserting complaint into Supabase:', err);
      return saveToLocalStorage(complaintData);
    }
  } else {
    return saveToLocalStorage(complaintData);
  }
}

/**
 * Update complaint status and admin remarks
 */
async function apiUpdateComplaint(id, updateFields) {
  if (supabaseClient) {
    try {
      const dbUpdates = {};
      if (updateFields.status !== undefined) dbUpdates.status = updateFields.status;
      if (updateFields.priority !== undefined) dbUpdates.priority = updateFields.priority;
      if (updateFields.adminRemarks !== undefined) dbUpdates.admin_remarks = updateFields.adminRemarks;

      const { data, error } = await supabaseClient
        .from('complaints')
        .update(dbUpdates)
        .eq('id', id)
        .select();

      if (error) throw error;
      return data && data.length > 0 ? transformFromDb(data[0]) : null;
    } catch (err) {
      console.error('Error updating complaint in Supabase:', err);
      return updateLocalStorage(id, updateFields);
    }
  } else {
    return updateLocalStorage(id, updateFields);
  }
}

/**
 * Delete a complaint record
 */
async function apiDeleteComplaint(id) {
  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('complaints')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error deleting complaint from Supabase:', err);
      return deleteFromLocalStorage(id);
    }
  } else {
    return deleteFromLocalStorage(id);
  }
}

/**
 * Upload image to Supabase Storage bucket (or return Base64 as fallback)
 */
async function apiUploadImage(file, complaintId) {
  if (!file) return '';

  if (supabaseClient) {
    try {
      const fileExt = file.name ? file.name.split('.').pop() : 'png';
      const fileName = `${complaintId}_${Date.now()}.${fileExt}`;
      const filePath = `reports/${fileName}`;

      const { data, error } = await supabaseClient
        .storage
        .from(SUPABASE_CONFIG.STORAGE_BUCKET)
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabaseClient
        .storage
        .from(SUPABASE_CONFIG.STORAGE_BUCKET)
        .getPublicUrl(filePath);

      return urlData ? urlData.publicUrl : '';
    } catch (err) {
      console.warn('Supabase storage upload failed/not configured, returning local data URL:', err);
    }
  }

  // Fallback: Read as Data URL
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

// -------------------------------------------------------------
// Data Transform Helpers (Database Snake Case <-> JS Camel Case)
// -------------------------------------------------------------

function transformFromDb(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    category: row.category,
    title: row.title,
    description: row.description,
    location: row.location,
    image: row.image_url || '',
    priority: row.priority || 'Medium',
    status: row.status || 'Pending',
    adminRemarks: row.admin_remarks || '',
    date: row.created_at ? formatTimestamp(row.created_at) : new Date().toLocaleString()
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
// LocalStorage Fallback Helper Functions
// -------------------------------------------------------------

const STORAGE_KEY = 'citycare_complaints';

function getLocalStorageComplaints() {
  const existing = localStorage.getItem(STORAGE_KEY);
  return existing ? JSON.parse(existing) : [];
}

function saveToLocalStorage(item) {
  const list = getLocalStorageComplaints();
  list.unshift(item);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return item;
}

function updateLocalStorage(id, updateFields) {
  const list = getLocalStorageComplaints();
  const idx = list.findIndex(c => c.id === id);
  if (idx !== -1) {
    if (updateFields.status !== undefined) list[idx].status = updateFields.status;
    if (updateFields.priority !== undefined) list[idx].priority = updateFields.priority;
    if (updateFields.adminRemarks !== undefined) list[idx].adminRemarks = updateFields.adminRemarks;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return list[idx];
  }
  return null;
}

function deleteFromLocalStorage(id) {
  const list = getLocalStorageComplaints();
  const filtered = list.filter(c => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return true;
}
