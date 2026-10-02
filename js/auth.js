/**
 * CityCare - Authentication & Session Management Module
 * Connects Citizen Sign In / Sign Up and Admin Login with Backend REST Database & LocalStorage
 */

const CityCareAuth = {
  KEYS: {
    CITIZENS: 'citycare_registered_citizens',
    CURRENT_USER: 'citycare_current_user',
    ADMIN_SESSION: 'citycare_admin_session'
  },

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

  DEFAULT_ADMIN: {
    email: 'jaiganesh4028@gmail.com',
    password: 'jai@hsenag',
    name: 'Municipal Directorate',
    role: 'City Zone Oversight Admin',
    department: 'Central Urban Directorate'
  },

  init() {
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
      return [];
    }
  },

  async registerCitizen({ fullName, phone, email, password, address }) {
    if (!fullName || !fullName.trim()) return { success: false, message: 'Please enter your Full Name.' };
    if (!phone || !phone.trim()) return { success: false, message: 'Please enter a valid Mobile Phone Number.' };
    if (!email || !email.trim()) return { success: false, message: 'Please enter a valid Email address.' };
    if (!password || password.length < 4) return { success: false, message: 'Password must be at least 4 characters long.' };

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim().replace(/\s+/g, '');

    // 1. Try Backend REST API (/api/auth/register)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, phone, email: cleanEmail, password, address })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.setCurrentUser(data.user);
        this.saveUserToLocalStorage(data.user);
        return { success: true, user: data.user, message: 'Account registered successfully in Backend DB!' };
      } else if (data.message) {
        return { success: false, message: data.message };
      }
    } catch (e) {
      console.info('Backend auth endpoint unreachable, operating in LocalStorage mode.');
    }

    // 2. Fallback to LocalStorage
    const users = this.getRegisteredUsers();
    const existing = users.find(u => 
      (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail) || 
      (cleanPhone && u.phone && u.phone.replace(/\s+/g, '') === cleanPhone)
    );

    if (existing) {
      return { success: false, message: 'An account with this Email or Mobile Phone number already exists. Please Sign In instead.' };
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
    this.setCurrentUser(newUser);

    return { success: true, user: newUser, message: 'Account registered successfully! Welcome to CityCare.' };
  },

  async loginCitizen(identifier, password) {
    const query = (identifier || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!query || !password) return { success: false, message: 'Please provide both Email/Phone and Password.' };

    // 1. Try Backend REST API (/api/auth/login)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: query, password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.setCurrentUser(data.user);
        return { success: true, user: data.user, message: `Welcome back, ${data.user.fullName}!` };
      }
    } catch (e) {
      console.info('Backend auth API skipped, using LocalStorage.');
    }

    // 2. Fallback to LocalStorage
    const users = this.getRegisteredUsers();
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

  saveUserToLocalStorage(user) {
    const users = this.getRegisteredUsers();
    if (!users.some(u => u.id === user.id || u.email === user.email)) {
      users.push(user);
      localStorage.setItem(this.KEYS.CITIZENS, JSON.stringify(users));
    }
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

  getInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  },

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

CityCareAuth.init();
