/**
 * CityCare - High Performance Node.js Backend Server & REST API
 * Integrated with MongoDB (configured via config.py) + Persistent JSON Database fallback.
 * 
 * Configured in config.py:
 *   MONGODB_URI = "mongodb://localhost:27017/citycare_db" or MongoDB Atlas URI
 *   DB_NAME = "citycare_db"
 *   USERS_COLLECTION = "users"
 *   COMPLAINTS_COLLECTION = "complaints"
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8000;
const DB_DIR = path.join(__dirname, 'database');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const COMPLAINTS_FILE = path.join(DB_DIR, 'complaints.json');
const USERS_FILE = path.join(DB_DIR, 'users.json');

// Ensure directories exist
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Parse variables from config.py
function loadMongoConfigFromPy() {
  try {
    const pyContent = fs.readFileSync(path.join(__dirname, 'config.py'), 'utf8');
    const uriMatch = pyContent.match(/MONGODB_URI\s*=\s*["']([^"']+)["']/);
    const dbMatch = pyContent.match(/DB_NAME\s*=\s*["']([^"']+)["']/);
    return {
      mongoUri: uriMatch ? uriMatch[1] : 'mongodb://localhost:27017/citycare_db',
      dbName: dbMatch ? dbMatch[1] : 'citycare_db'
    };
  } catch (e) {
    return {
      mongoUri: 'mongodb://localhost:27017/citycare_db',
      dbName: 'citycare_db'
    };
  }
}

const mongoConfig = loadMongoConfigFromPy();
console.log(`📌 Loaded config.py -> MongoDB URI: ${mongoConfig.mongoUri}`);

// MongoDB Client Initialization
let mongoDb = null;
let mongoUsersCol = null;
let mongoComplaintsCol = null;

try {
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(mongoConfig.mongoUri, { serverSelectionTimeoutMS: 3000 });
  client.connect().then(() => {
    mongoDb = client.db(mongoConfig.dbName);
    mongoUsersCol = mongoDb.collection('users');
    mongoComplaintsCol = mongoDb.collection('complaints');
    console.log(`✅ Connected to MongoDB Database: "${mongoConfig.dbName}"`);
  }).catch(err => {
    console.info(`ℹ️ MongoDB connection notice: ${err.message}. Operating in hybrid database mode.`);
  });
} catch (e) {
  console.info('ℹ️ MongoDB npm driver loading fallback. Operating in hybrid JSON database mode.');
}

// Helpers for reading & writing fallback JSON database
function readDb(file) {
  try {
    const content = fs.readFileSync(file, 'utf8');
    return JSON.parse(content || '[]');
  } catch (err) {
    return [];
  }
}

function writeDb(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    return false;
  }
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', err => reject(err));
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // -------------------------------------------------------------
  // REST API ENDPOINTS
  // -------------------------------------------------------------

  // 1. GET /api/complaints - Fetch complaints from MongoDB or JSON
  if (pathname === '/api/complaints' && method === 'GET') {
    if (mongoComplaintsCol) {
      try {
        const mongoData = await mongoComplaintsCol.find({}, { projection: { _id: 0 } }).sort({ created_at: -1 }).toArray();
        if (mongoData && mongoData.length > 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, count: mongoData.length, data: mongoData, source: 'MongoDB' }));
        }
      } catch (e) {
        console.warn('MongoDB query error, falling back to JSON DB:', e.message);
      }
    }

    const complaints = readDb(COMPLAINTS_FILE);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, count: complaints.length, data: complaints, source: 'JSON DB' }));
  }

  // 2. POST /api/complaints - Save new complaint in MongoDB & JSON
  if (pathname === '/api/complaints' && method === 'POST') {
    const body = await parseRequestBody(req);
    
    if (!body.title || !body.category || !body.location) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, message: 'Missing required fields (title, category, location).' }));
    }

    const randomId = Math.floor(1000 + Math.random() * 9000);
    const newComplaint = {
      id: body.id || `CC-2026-${randomId}`,
      full_name: body.fullName || body.full_name || 'Anonymous Citizen',
      phone: body.phone || 'Not Provided',
      category: body.category,
      title: body.title,
      description: body.description || '',
      location: body.location,
      image_url: body.image || body.image_url || '',
      priority: body.priority || 'Medium',
      status: body.status || 'Pending',
      admin_remarks: body.adminRemarks || body.admin_remarks || '',
      created_at: new Date().toISOString()
    };

    // Save to MongoDB
    if (mongoComplaintsCol) {
      try {
        await mongoComplaintsCol.insertOne({ ...newComplaint });
        console.log(`✅ Complaint ${newComplaint.id} saved to MongoDB collection "complaints"`);
      } catch (e) {
        console.warn('MongoDB insert warning:', e.message);
      }
    }

    // Save to JSON DB
    const complaints = readDb(COMPLAINTS_FILE);
    complaints.unshift(newComplaint);
    writeDb(COMPLAINTS_FILE, complaints);

    res.writeHead(201, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, message: 'Complaint saved to MongoDB & Backend Database.', data: newComplaint }));
  }

  // 3. PUT /api/complaints/:id - Update status & admin remarks
  if (pathname.startsWith('/api/complaints/') && method === 'PUT') {
    const complaintId = pathname.replace('/api/complaints/', '');
    const body = await parseRequestBody(req);

    const updates = {};
    if (body.status !== undefined) updates.status = body.status;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.adminRemarks !== undefined) updates.admin_remarks = body.adminRemarks;
    if (body.admin_remarks !== undefined) updates.admin_remarks = body.admin_remarks;

    // Update in MongoDB
    if (mongoComplaintsCol) {
      try {
        await mongoComplaintsCol.updateOne({ id: complaintId }, { $set: updates });
        console.log(`✅ Request ${complaintId} updated in MongoDB`);
      } catch (e) {}
    }

    // Update in JSON DB
    const complaints = readDb(COMPLAINTS_FILE);
    const idx = complaints.findIndex(c => c.id === complaintId);
    if (idx !== -1) {
      if (updates.status) complaints[idx].status = updates.status;
      if (updates.priority) complaints[idx].priority = updates.priority;
      if (updates.admin_remarks !== undefined) complaints[idx].admin_remarks = updates.admin_remarks;
      writeDb(COMPLAINTS_FILE, complaints);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, message: 'Complaint record updated.' }));
  }

  // 4. POST /api/auth/register - Register user in MongoDB & JSON DB
  if (pathname === '/api/auth/register' && method === 'POST') {
    const body = await parseRequestBody(req);
    const { fullName, phone, email, password, address } = body;

    if (!fullName || !phone || !email || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, message: 'Please provide all required fields.' }));
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim().replace(/\s+/g, '');

    // Check existing in MongoDB
    if (mongoUsersCol) {
      try {
        const existingMongo = await mongoUsersCol.findOne({
          $or: [{ email: cleanEmail }, { phone: cleanPhone }]
        });
        if (existingMongo) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, message: 'An account with this Email or Phone already exists in MongoDB.' }));
        }
      } catch (e) {}
    }

    const users = readDb(USERS_FILE);
    const existingJson = users.find(u => 
      (u.email && u.email.toLowerCase() === cleanEmail) || 
      (u.phone && u.phone.replace(/\s+/g, '') === cleanPhone)
    );

    if (existingJson) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, message: 'An account with this Email or Mobile Phone already exists.' }));
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

    // Save to MongoDB users collection
    if (mongoUsersCol) {
      try {
        await mongoUsersCol.insertOne({ ...newUser });
        console.log(`✅ User ${newUser.email} saved to MongoDB collection "users"`);
      } catch (e) {
        console.warn('MongoDB user insert warning:', e.message);
      }
    }

    users.push(newUser);
    writeDb(USERS_FILE, users);

    res.writeHead(201, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, user: newUser, message: 'User registered in MongoDB & Backend DB.' }));
  }

  // 5. POST /api/auth/login - Authenticate user against MongoDB & JSON DB
  if (pathname === '/api/auth/login' && method === 'POST') {
    const body = await parseRequestBody(req);
    const { identifier, password } = body;

    const query = (identifier || '').trim().toLowerCase().replace(/\s+/g, '');

    // Check MongoDB
    if (mongoUsersCol) {
      try {
        const mongoUser = await mongoUsersCol.findOne({
          $and: [
            { $or: [{ email: query }, { phone: query }] },
            { password: password }
          ]
        }, { projection: { _id: 0 } });

        if (mongoUser) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, user: mongoUser, message: `Welcome back, ${mongoUser.fullName}!` }));
        }
      } catch (e) {}
    }

    const users = readDb(USERS_FILE);
    const user = users.find(u => {
      const uEmail = (u.email || '').toLowerCase();
      const uPhone = (u.phone || '').replace(/\s+/g, '');
      return (uEmail === query || uPhone === query) && u.password === password;
    });

    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, message: 'Invalid Email/Phone or Password.' }));
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, user, message: `Welcome back, ${user.fullName}!` }));
  }

  // 6. POST /api/upload - Base64 image upload
  if (pathname === '/api/upload' && method === 'POST') {
    const body = await parseRequestBody(req);
    const { imageBase64, complaintId } = body;

    if (!imageBase64) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, message: 'No image payload provided.' }));
    }

    try {
      const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, message: 'Invalid base64 format.' }));
      }

      const mimeType = matches[1];
      const imageBuffer = Buffer.from(matches[2], 'base64');
      const ext = mimeType.split('/')[1] || 'png';
      const fileName = `${complaintId || 'img'}_${Date.now()}.${ext}`;
      const filePath = path.join(UPLOADS_DIR, fileName);

      fs.writeFileSync(filePath, imageBuffer);
      const publicUrl = `/uploads/${fileName}`;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, imageUrl: publicUrl }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, message: 'Failed to save image file.' }));
    }
  }

  // STATIC FILE SERVING
  let reqPath = pathname === '/' ? '/index.html' : pathname;
  let filePath = path.join(__dirname, reqPath);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Access Denied');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      return res.end('<h1>404 Not Found</h1><p>The requested page or file does not exist.</p>');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 CityCare Backend & MongoDB Database Server running at:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`📌 Config file: config.py (MongoDB URI: ${mongoConfig.mongoUri})`);
  console.log(`=======================================================`);
});
