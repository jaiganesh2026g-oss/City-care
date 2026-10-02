/**
 * CityCare - Authentication & Session Management Module
 * Manages Citizen Sign In / Sign Up and Admin Login with LocalStorage & Supabase sync fallback
 */

const CityCareAuth = {
  KEYS: {
    CITIZENS: 'citycare_registered_citizens',
    CURRENT_USER: 'citycare_current_user',
    ADMIN_SESSION: 'citycare_admin_session'
  },

  // Official Demo Citizen Account
  DEFAULT_CITIZEN: {
    id: 'CIT-1001',
    fullName: 'Rahul Sharma',
    phone: '+91 98765 43210',
    email: 'rahul@gmail.com',
    password: 'user123',
    address: 'Green Park Sector 4, Main Road',
    role: 'Citizen',
    registeredAt: '2026-01-15T10:00:00.000Z'
  },

  // Official Admin Credentials requested by User
  DEFAULT_ADMIN: {
    email: 'jaiganesh4028@gmail.com',
    password: 'jai@hsenag',
    name: 'Municipal Directorate',
    role: 'City Zone Oversight Admin',
    department: 'Central Urban Directorate'
  },

  init() {
    // Seed default citizen if registered users list is empty
    const users = this.getRegisteredUsers();
    if (users.length === 0) {
      localStorage.setItem(this.KEYS.CITIZENS, JSON.stringify([this.DEFAULT_CITIZEN]));
    }
  },

  getRegisteredUsers() {
    try {
      const data = localStorage.getItem(this.KEYS.CITIZENS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('Error reading registered users from LocalStorage:', e);
      return [];
    }
  },

  registerCitizen({ fullName, phone, email, password, address }) {
    if (!fullName || !fullName.trim()) {
      return { success: false, message: 'Please enter your Full Name.' };
    }
    if (!phone || !phone.trim()) {
      return { success: false, message: 'Please enter a valid Mobile Phone Number.' };
    }
    if (!email || !email.trim()) {
      return { success: false, message: 'Please enter a valid Email address.' };
    }
    if (!password || password.length < 4) {
      return { success: false, message: 'Password must be at least 4 characters long.' };
    }

    const users = this.getRegisteredUsers();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (phone || '').trim().replace(/\s+/g, '');

    // Check if user with phone or email already exists
    const existing = users.find(u => 
      (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail) || 
      (cleanPhone && u.phone && u.phone.replace(/\s+/g, '') === cleanPhone)
    );

    if (existing) {
      return { 
        success: false, 
        message: 'An account with this Email or Mobile Phone number already exists. Please Sign In instead.' 
      };
    }

    const newUser = {
      id: 'CIT-' + Math.floor(1000 + Math.random() * 9000),
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: cleanEmail,
      password: password,
      address: (address || '').trim(),
      role: 'Citizen',
      registeredAt: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem(this.KEYS.CITIZENS, JSON.stringify(users));
    
    // Auto log in after registration
    this.setCurrentUser(newUser);

    return { 
      success: true, 
      user: newUser, 
      message: 'Account registered successfully! Welcome to CityCare.' 
    };
  },

  loginCitizen(identifier, password) {
    const users = this.getRegisteredUsers();
    const query = (identifier || '').trim().toLowerCase().replace(/\s+/g, '');

    if (!query || !password) {
      return { success: false, message: 'Please provide both Email/Phone and Password.' };
    }

    // Match by email or phone number
    const user = users.find(u => {
      const uEmail = (u.email || '').toLowerCase();
      const uPhone = (u.phone || '').replace(/\s+/g, '');
      return (uEmail === query || uPhone === query) && u.password === password;
    });

    if (!user) {
      return { success: false, message: 'Invalid Email/Phone or Password. Please check your credentials.' };
    }

    this.setCurrentUser(user);
    return { success: true, user, message: `Welcome back, ${user.fullName}!` };
  },

  setCurrentUser(user) {
    localStorage.setItem(this.KEYS.CURRENT_USER, JSON.stringify(user));
  },

  getCurrentUser() {
    try {
      const data = localStorage.getItem(this.KEYS.CURRENT_USER);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  logoutCitizen() {
    localStorage.removeItem(this.KEYS.CURRENT_USER);
  },

  loginAdmin(email, password) {
    const cleanEmail = (email || '').trim().toLowerCase();
    
    if (cleanEmail === this.DEFAULT_ADMIN.email.toLowerCase() && password === this.DEFAULT_ADMIN.password) {
      const session = {
        name: this.DEFAULT_ADMIN.name,
        email: this.DEFAULT_ADMIN.email,
        role: this.DEFAULT_ADMIN.role,
        department: this.DEFAULT_ADMIN.department,
        loggedInAt: new Date().toISOString()
      };
      localStorage.setItem(this.KEYS.ADMIN_SESSION, JSON.stringify(session));
      return { success: true, session, message: 'Admin authentication successful! Access granted.' };
    }

    return { success: false, message: 'Invalid Admin Email or Security Password.' };
  },

  getCurrentAdmin() {
    try {
      const data = localStorage.getItem(this.KEYS.ADMIN_SESSION);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  logoutAdmin() {
    localStorage.removeItem(this.KEYS.ADMIN_SESSION);
  },

  // Helper to generate initials avatar (e.g. "Rahul Sharma" -> "RS")
  getInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  },

  // Helper function to toggle password field visibility
  togglePasswordVisibility(inputId, buttonEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    if (input.type === 'password') {
      input.type = 'text';
      if (buttonEl) buttonEl.innerHTML = `🙈`;
    } else {
      input.type = 'password';
      if (buttonEl) buttonEl.innerHTML = `👁️`;
    }
  }
};

// Initialize immediately
CityCareAuth.init();
