const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Import route handlers
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/student');
const teacherRoutes = require('./routes/teacher');

// Using Oracle DB for data persistence
console.log('🚀 Starting presentation room booking system with Oracle DB');

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon'
};

// Parse POST body
function parseBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                if (req.headers['content-type'] === 'application/json') {
                    resolve(JSON.parse(body));
                } else {
                    // Parse form data
                    const formData = {};
                    body.split('&').forEach(pair => {
                        const [key, value] = pair.split('=');
                        formData[decodeURIComponent(key)] = decodeURIComponent(value);
                    });
                    resolve(formData);
                }
            } catch (error) {
                resolve({});
            }
        });
    });
}

// Serve static files
function serveStaticFile(res, filePath) {
    const extname = path.extname(filePath);
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    
    fs.readFile(filePath, (error, content) => {
        if (error) {
            res.writeHead(404);
            res.end('File not found');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
}

// Main request handler
async function handleRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Parse body for POST, PUT and DELETE requests
    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
        req.body = await parseBody(req);
    }

    // Route handling
    if (pathname.startsWith('/api/auth')) {
        return authRoutes(req, res, parsedUrl);
    } else if (pathname.startsWith('/api/student')) {
        return studentRoutes(req, res, parsedUrl);
    } else if (pathname.startsWith('/api/teacher')) {
        return teacherRoutes(req, res, parsedUrl);
    }

    // Serve static files
    let filePath;
    if (pathname === '/') {
        filePath = path.join(__dirname, 'views', 'login.html');
    } else if (pathname === '/home' || pathname === '/index') {
        filePath = path.join(__dirname, 'views', 'index.html');
    } else if (pathname === '/favicon.ico') {
        filePath = path.join(__dirname, 'public', 'favicon.ico');
    } else if (pathname.startsWith('/views/')) {
        filePath = path.join(__dirname, pathname);
    } else if (pathname.startsWith('/css/') || pathname.startsWith('/js/') || pathname.startsWith('/images/')) {
        filePath = path.join(__dirname, 'public', pathname);
    } else {
        filePath = path.join(__dirname, 'views', pathname + '.html');
    }

    serveStaticFile(res, filePath);
}

// Create HTTP server
const server = http.createServer(handleRequest);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Presentation Room Booking System');
    console.log('Available routes:');
    console.log('- / (Home page)');
    console.log('- /login (Login page)');
    console.log('- /register (Registration page)');
    console.log('- /dashboard_student (Student dashboard)');
    console.log('- /dashboard_teacher (Teacher dashboard)');
    console.log('- /token (Token page)');
});

// Handle server errors
server.on('error', (error) => {
    console.error('Server error:', error);
});

process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
}); 