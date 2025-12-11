const crypto = require('crypto');

// Use real Oracle DB
const db = require('../db/oracle');

// Generate session ID
function generateSessionId() {
    return crypto.randomBytes(16).toString('hex'); // 32 characters instead of 64
}

// Hash password (simple hash for demo)
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Verify session
async function verifySession(sessionId) {
    try {
        const sessions = await db.execute(
            'SELECT * FROM Sessions WHERE session_id = :session_id',
            [sessionId]
        );

        if (sessions.length === 0) return null;

        const session = sessions[0];
        // Check if session is expired (24 hours)
        const now = new Date();
        const sessionTime = new Date(session.CREATED_AT);
        if (now - sessionTime > 24 * 60 * 60 * 1000) {
            // Clean up expired session
            await db.execute('DELETE FROM Sessions WHERE session_id = :session_id', [sessionId]);
            return null;
        }

        return {
            user_id: session.USER_ID,
            role: session.ROLE
        };
    } catch (err) {
        console.error('Session verification error:', err);
        return null;
    }
}

module.exports = function(req, res, parsedUrl) {
    const pathname = parsedUrl.pathname;
    const method = req.method;

    if (pathname === '/api/auth/login' && method === 'POST') {
        const { email, password, role } = req.body;

        if (!email || !password || !role) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing required fields' }));
            return;
        }

        let user = null;
        (async () => {
            try {
                const hashedPassword = hashPassword(password);
                console.log('LOGIN:', { email, hashedPassword, role });
                if (role === 'student') {
                    const rows = await db.execute('SELECT * FROM Students WHERE email = :email AND password = :password', [email, hashedPassword]);
                    console.log('Student login query result:', rows);
                    if (rows.length > 0) user = rows[0];
                } else if (role === 'teacher') {
                    const rows = await db.execute('SELECT * FROM Teachers WHERE email = :email AND password = :password', [email, hashedPassword]);
                    console.log('Teacher login query result:', rows);
                    if (rows.length > 0) user = rows[0];
                }
                if (!user) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid credentials' }));
                    return;
                }

                // Create session in database
                const sessionId = generateSessionId();
                const userId = role === 'student' ? user.STUDENT_ID : user.TEACHER_ID.toString();

                await db.execute(
                    'INSERT INTO Sessions (session_id, user_id, role) VALUES (:session_id, :user_id, :role)',
                    [sessionId, userId, role]
                );

                // Set cookie
                res.setHeader('Set-Cookie', `sessionId=${sessionId}; HttpOnly; Path=/; Max-Age=86400`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    role: role,
                    redirect: role === 'student' ? '/dashboard_student' : '/dashboard_teacher'
                }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Database error', details: err.message }));
            }
    })();

    } else if (pathname === '/api/auth/register' && method === 'POST') {
        const { name, email, password, role, student_id, batch, dept } = req.body;

        if (!name || !email || !password || !role) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing required fields' }));
            return;
        }

        (async () => {
            try {
                // Check if user already exists
                let exists = false;
                if (role === 'student') {
                    const rows = await db.execute('SELECT * FROM Students WHERE email = :email', [email]);
                    if (rows.length > 0) exists = true;
                } else if (role === 'teacher') {
                    const rows = await db.execute('SELECT * FROM Teachers WHERE email = :email', [email]);
                    if (rows.length > 0) exists = true;
                }
                if (exists) {
                    res.writeHead(409, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'User already exists' }));
                    return;
                }

                if (role === 'student') {
                    if (!student_id || !batch || !dept) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Missing student information' }));
                        return;
                    }
                    const hashed = hashPassword(password);
                    console.log('REGISTER student:', { student_id, name, batch, dept, email, hashed });
                    await db.execute(
                        'INSERT INTO Students (student_id, name, batch, dept, email, password) VALUES (:student_id, :name, :batch, :dept, :email, :password)',
                        [student_id, name, batch, dept, email, hashed]
                    );
                } else if (role === 'teacher') {
                    const hashed = hashPassword(password);
                    console.log('REGISTER teacher:', { name, email, hashed });
                    await db.execute(
                        'INSERT INTO Teachers (name, email, password) VALUES (:name, :email, :password)',
                        [name, email, hashed]
                    );
                }
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Registration successful' }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Database error', details: err.message }));
            }
    })();

    } else if (pathname === '/api/auth/logout' && method === 'POST') {
        (async () => {
            try {
                const cookies = req.headers.cookie;
                if (cookies) {
                    const sessionId = cookies.split(';')
                        .find(c => c.trim().startsWith('sessionId='))
                        ?.split('=')[1];

                    if (sessionId) {
                        await db.execute('DELETE FROM Sessions WHERE session_id = :session_id', [sessionId]);
                    }
                }

                res.setHeader('Set-Cookie', 'sessionId=; HttpOnly; Path=/; Max-Age=0');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Logged out successfully' }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Database error', details: err.message }));
            }
        })();

    } else if (pathname === '/api/auth/check' && method === 'GET') {
        (async () => {
            try {
                const cookies = req.headers.cookie;
                if (!cookies) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'No session' }));
                    return;
                }

                const sessionId = cookies.split(';')
                    .find(c => c.trim().startsWith('sessionId='))
                    ?.split('=')[1];

                if (!sessionId) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'No session' }));
                    return;
                }

                const session = await verifySession(sessionId);
                if (!session) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid session' }));
                    return;
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    user_id: session.user_id,
                    role: session.role
                }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Database error', details: err.message }));
            }
        })();

    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Route not found' }));
    }
};