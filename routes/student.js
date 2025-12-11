const crypto = require('crypto');

// Use real Oracle DB
const db = require('../db/oracle');

// Generate token code
function generateTokenCode(roomNo, date, time) {
    let dateStr = '';
    let timeStr = '';

    if (typeof date === 'string') {
        if (date.includes('T')) {
            // ISO string format
            dateStr = date.split('T')[0].replace(/-/g, '');
            timeStr = date.split('T')[1].substring(0, 5).replace(':', '');
        } else {
            // Already formatted string like "2025-01-31 10:00:00"
            const dateMatch = date.match(/^(\d{4}-\d{2}-\d{2})/);
            dateStr = dateMatch ? dateMatch[1].replace(/-/g, '') : '';

            const timeMatch = date.match(/(\d{2}:\d{2}):\d{2}$/);
            timeStr = timeMatch ? timeMatch[1].replace(':', '') : '';
        }
    }

    return `ROOM${roomNo}-${dateStr}-${timeStr}`;
}

// Get user from session
async function getUserFromSession(req) {
    const cookies = req.headers.cookie;
    if (!cookies) return null;

    const sessionId = cookies.split(';')
        .find(c => c.trim().startsWith('sessionId='))
        ?.split('=')[1];

    if (!sessionId) return null;

    try {
        // Check session in database
        const sessions = await db.execute(
            'SELECT * FROM Sessions WHERE session_id = :session_id',
            [sessionId]
        );

        if (sessions.length === 0) {
            return null;
        }

        const session = sessions[0];

        // Check if session is expired (24 hours)
        const now = new Date();
        const sessionTime = new Date(session.CREATED_AT);
        if (now - sessionTime > 24 * 60 * 60 * 1000) {
            // Clean up expired session
            await db.execute('DELETE FROM Sessions WHERE session_id = :session_id', [sessionId]);
            return null;
        }

        const userInfo = {
            user_id: session.USER_ID,
            role: session.ROLE
        };

        return userInfo;
    } catch (err) {
        console.error('Session verification error:', err);
        return null;
    }
}

module.exports = function(req, res, parsedUrl) {
    const pathname = parsedUrl.pathname;
    const method = req.method;

    if (pathname === '/api/student/slots' && method === 'GET') {
        (async () => {
            try {
                // Get available slots with room information
                const slots = await db.execute(`
                    SELECT s.slot_id, s.slot_start, s.slot_end, r.room_no
                    FROM Slots s
                    JOIN Rooms r ON s.room_id = r.room_id
                    WHERE s.is_booked = 'N'
                    ORDER BY s.slot_start
                `);

                const availableSlots = slots.map(slot => {
                    let date = '';
                    let time_start = '';
                    let time_end = '';

                    // Extract date and time from timestamp strings
                    if (slot.SLOT_START) {
                        if (typeof slot.SLOT_START === 'string') {
                            // Extract date part like "2025-01-31"
                            const dateMatch = slot.SLOT_START.match(/^(\d{4}-\d{2}-\d{2})/);
                            date = dateMatch ? dateMatch[1] : '';

                            // Extract time part like "10:00"
                            const timeMatch = slot.SLOT_START.match(/(\d{2}:\d{2}):\d{2}$/);
                            time_start = timeMatch ? timeMatch[1] : '';
                        } else if (slot.SLOT_START instanceof Date) {
                            date = slot.SLOT_START.toISOString().split('T')[0];
                            time_start = String(slot.SLOT_START.getHours()).padStart(2, '0') + ':' +
                                        String(slot.SLOT_START.getMinutes()).padStart(2, '0');
                        }
                    }

                    if (slot.SLOT_END) {
                        if (typeof slot.SLOT_END === 'string') {
                            // Extract time part like "10:30"
                            const timeMatch = slot.SLOT_END.match(/(\d{2}:\d{2}):\d{2}$/);
                            time_end = timeMatch ? timeMatch[1] : '';
                        } else if (slot.SLOT_END instanceof Date) {
                            time_end = String(slot.SLOT_END.getHours()).padStart(2, '0') + ':' +
                                      String(slot.SLOT_END.getMinutes()).padStart(2, '0');
                        }
                    }

                    return {
                        slot_id: slot.SLOT_ID,
                        room_no: slot.ROOM_NO,
                        date: date,
                        time_start: time_start,
                        time_end: time_end
                    };
                });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ slots: availableSlots }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Database error', details: err.message }));
            }
        })();

    } else if (pathname === '/api/student/book' && method === 'POST') {
        (async () => {
            try {
                const user = await getUserFromSession(req);
                if (!user || user.role !== 'student') {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Unauthorized' }));
                    return;
                }

                const { slot_id } = req.body;
                if (!slot_id) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Slot ID is required' }));
                    return;
                }

                // Check if slot is available
                const slots = await db.execute(
                    'SELECT * FROM Slots WHERE slot_id = :slot_id AND is_booked = :is_booked',
                    [slot_id, 'N']
                );

                if (slots.length === 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Slot not available' }));
                    return;
                }

                const slot = slots[0];

                // Get room information
                const rooms = await db.execute(
                    'SELECT * FROM Rooms WHERE room_id = :room_id',
                    [slot.ROOM_ID]
                );

                if (rooms.length === 0) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Room not found' }));
                    return;
                }

                const room = rooms[0];

                // Generate token code
                let slotStartStr = '';
                if (typeof slot.SLOT_START === 'string') {
                    slotStartStr = slot.SLOT_START;
                } else if (slot.SLOT_START instanceof Date) {
                    slotStartStr = slot.SLOT_START.toISOString();
                }

                const tokenCode = generateTokenCode(
                    room.ROOM_NO,
                    slotStartStr,
                    slotStartStr
                );

                // Create booking
                await db.execute(
                    'INSERT INTO Bookings (slot_id, student_id, token_code) VALUES (:slot_id, :student_id, :token_code)',
                    [slot_id, user.user_id, tokenCode]
                );

                // Update slot as booked
                await db.execute(
                    'UPDATE Slots SET is_booked = :is_booked WHERE slot_id = :slot_id',
                    ['Y', slot_id]
                );

                // Get booking ID
                const bookings = await db.execute(
                    'SELECT booking_id FROM Bookings WHERE slot_id = :slot_id AND student_id = :student_id',
                    [slot_id, user.user_id]
                );

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    booking_id: bookings[0].BOOKING_ID,
                    token_code: tokenCode,
                    redirect: `/token?code=${tokenCode}`
                }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Database error', details: err.message }));
            }
        })();

    } else if (pathname === '/api/student/bookings' && method === 'GET') {
        (async () => {
            try {
                const user = await getUserFromSession(req);
                if (!user || user.role !== 'student') {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Unauthorized' }));
                    return;
                }

                // Get user's bookings with student information
                // First, get student information
                const studentInfo = await db.execute(
                    'SELECT NAME, STUDENT_ID FROM STUDENTS WHERE STUDENT_ID = :student_id',
                    [user.user_id]
                );

                const bookings = await db.execute(`
                    SELECT b.BOOKING_ID, b.TOKEN_CODE, b.BOOKING_TIME,
                           r.ROOM_NO, s.SLOT_START, s.SLOT_END
                    FROM BOOKINGS b
                    JOIN SLOTS s ON b.SLOT_ID = s.SLOT_ID
                    JOIN ROOMS r ON s.ROOM_ID = r.ROOM_ID
                    WHERE b.STUDENT_ID = :student_id
                    ORDER BY b.BOOKING_TIME DESC
                `, [user.user_id]);



                const userBookings = bookings.map(booking => {
                    let date = '';
                    let time_start = '';
                    let time_end = '';

                    // Extract date and time from timestamp strings
                    if (booking.SLOT_START) {
                        if (typeof booking.SLOT_START === 'string') {
                            // Extract date part like "2025-01-31"
                            const dateMatch = booking.SLOT_START.match(/^(\d{4}-\d{2}-\d{2})/);
                            date = dateMatch ? dateMatch[1] : '';

                            // Extract time part like "10:00"
                            const timeMatch = booking.SLOT_START.match(/(\d{2}:\d{2}):\d{2}$/);
                            time_start = timeMatch ? timeMatch[1] : '';
                        } else if (booking.SLOT_START instanceof Date) {
                            date = booking.SLOT_START.toISOString().split('T')[0];
                            time_start = String(booking.SLOT_START.getHours()).padStart(2, '0') + ':' +
                                        String(booking.SLOT_START.getMinutes()).padStart(2, '0');
                        }
                    }

                    if (booking.SLOT_END) {
                        if (typeof booking.SLOT_END === 'string') {
                            // Extract time part like "10:30"
                            const timeMatch = booking.SLOT_END.match(/(\d{2}:\d{2}):\d{2}$/);
                            time_end = timeMatch ? timeMatch[1] : '';
                        } else if (booking.SLOT_END instanceof Date) {
                            time_end = String(booking.SLOT_END.getHours()).padStart(2, '0') + ':' +
                                      String(booking.SLOT_END.getMinutes()).padStart(2, '0');
                        }
                    }

                    return {
                        booking_id: booking.BOOKING_ID,
                        student_id: studentInfo[0]?.STUDENT_ID || user.user_id,
                        student_name: studentInfo[0]?.NAME || 'Student',
                        room_no: booking.ROOM_NO,
                        date: date,
                        time_start: time_start,
                        time_end: time_end,
                        token_code: booking.TOKEN_CODE,
                        booking_time: booking.BOOKING_TIME
                    };
                });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ bookings: userBookings }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Database error', details: err.message }));
            }
        })();

    } else if (pathname.startsWith('/api/student/bookings/') && method === 'DELETE') {
        (async () => {
            try {
                const user = await getUserFromSession(req);
                if (!user || user.role !== 'student') {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Unauthorized' }));
                    return;
                }

                // Parse booking_id from query parameters
                const urlParts = parsedUrl.pathname.split('/');
                const bookingId = urlParts[urlParts.length - 1];

                if (!bookingId || isNaN(bookingId)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid booking ID' }));
                    return;
                }

                const bookingIdNum = parseInt(bookingId);

                // Verify the booking belongs to the current user
                const bookingCheck = await db.execute(
                    'SELECT * FROM Bookings WHERE booking_id = :booking_id AND student_id = :student_id',
                    [bookingIdNum, user.user_id]
                );

                if (bookingCheck.length === 0) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Booking not found or does not belong to you' }));
                    return;
                }

                // Get slot_id before deleting booking
                const slotId = bookingCheck[0].SLOT_ID;

                // Delete the booking
                await db.execute(
                    'DELETE FROM Bookings WHERE booking_id = :booking_id AND student_id = :student_id',
                    [bookingIdNum, user.user_id]
                );

                // Update slot to be available again
                await db.execute(
                    'UPDATE Slots SET is_booked = :is_booked WHERE slot_id = :slot_id',
                    ['N', slotId]
                );
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Booking cancelled successfully',
                    booking_id: bookingIdNum
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