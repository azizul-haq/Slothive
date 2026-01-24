// Use real Oracle DB
const db = require('../../config/oracle');

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
            'SELECT * FROM Sessions WHERE session_id = :1',
            [sessionId]
        );

        if (sessions.length === 0) return null;

        const session = sessions[0];
        // Check if session is expired (24 hours)
        const now = new Date();
        const sessionTime = new Date(session.CREATED_AT);
        if (now - sessionTime > 24 * 60 * 60 * 1000) {
            // Clean up expired session
            await db.execute('DELETE FROM Sessions WHERE session_id = :1', [sessionId]);
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

    if (pathname === '/api/teacher/create-room' && method === 'POST') {
(async () => {
    try {
        const user = await getUserFromSession(req);
        if (!user || user.role !== 'teacher') {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
        }

        const { room_no, date, time_from, time_to, course } = req.body;
         
        // Get teacher name from database using user_id
        const teacherResult = await db.execute('SELECT name FROM Teachers WHERE teacher_id = :1', [user.user_id]);
        const teacherName = teacherResult.length > 0 ? teacherResult[0].NAME : 'Unknown Teacher';
                
                // Add teacher name to user object for later use
                user.teacherName = teacherName;

                // Comprehensive form validation
                const validationErrors = [];

                // Check required fields
                if (!room_no || !date || !time_from || !time_to) {
                    validationErrors.push('All fields (room number, date, time from, time to) are required');
                }

                // Validate room number format
                if (room_no && (!/^[A-Za-z0-9\s\-_]+$/.test(room_no.trim()) || room_no.trim().length < 2 || room_no.trim().length > 20)) {
                    validationErrors.push('Room number must be 2-20 characters and contain only letters, numbers, spaces, hyphens, or underscores');
                }

                // Validate date format and ensure it's not in the past
                if (date) {
                    const requestDate = new Date(date);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    
                    if (isNaN(requestDate.getTime())) {
                        validationErrors.push('Invalid date format');
                    } else if (requestDate < today) {
                        validationErrors.push('Cannot create rooms for past dates');
                    }
                }

                // Validate time format and logic
                if (time_from && time_to) {
                    // Check time format (HH:MM)
                    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
                    if (!timeRegex.test(time_from) || !timeRegex.test(time_to)) {
                        validationErrors.push('Time must be in HH:MM format (24-hour)');
                    }

                    // Check time logic
                    const timeFrom = new Date(`${date}T${time_from}`);
                    const timeTo = new Date(`${date}T${time_to}`);
                    
                    if (isNaN(timeFrom.getTime()) || isNaN(timeTo.getTime())) {
                        validationErrors.push('Invalid time format');
                    } else if (timeFrom >= timeTo) {
                        validationErrors.push('End time must be after start time');
                    } else {
                        // Check minimum duration (at least 30 minutes)
                        const durationMinutes = (timeTo - timeFrom) / (1000 * 60);
                        if (durationMinutes < 30) {
                            validationErrors.push('Room duration must be at least 30 minutes');
                        }
                        // Check maximum duration (not more than 8 hours)
                        if (durationMinutes > 480) {
                            validationErrors.push('Room duration cannot exceed 8 hours');
                        }
                    }
                }

                // Return validation errors if any
                if (validationErrors.length > 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        error: 'Validation failed',
                        details: validationErrors
                    }));
                    return;
                }

                // Check for duplicate room on the same date
                const existingRooms = await db.execute(
                    'SELECT room_id, room_no, date_available, time_from, time_to FROM Rooms WHERE room_no = :1 AND date_available = TO_DATE(:2, \'YYYY-MM-DD\')',
                    [room_no.trim().toUpperCase(), date]
                );

                if (existingRooms.length > 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        error: 'Room already exists',
                        details: `Room ${room_no} already exists on ${date}. Please use a different room number or date.`
                    }));
                    return;
                }

                // Check for time overlap with existing rooms on the same date
                const newTimeFrom = new Date(`${date} ${time_from}:00`);
                const newTimeTo = new Date(`${date} ${time_to}:00`);

                const overlappingRooms = await db.execute(`
                    SELECT room_id, room_no, time_from, time_to
                    FROM Rooms
                    WHERE date_available = TO_DATE(:1, 'YYYY-MM-DD')
                    AND (
                        (TO_TIMESTAMP(:2, 'YYYY-MM-DD HH24:MI:SS') >= time_from AND TO_TIMESTAMP(:2, 'YYYY-MM-DD HH24:MI:SS') < time_to) OR
                        (TO_TIMESTAMP(:3, 'YYYY-MM-DD HH24:MI:SS') > time_from AND TO_TIMESTAMP(:3, 'YYYY-MM-DD HH24:MI:SS') <= time_to) OR
                        (TO_TIMESTAMP(:2, 'YYYY-MM-DD HH24:MI:SS') <= time_from AND TO_TIMESTAMP(:3, 'YYYY-MM-DD HH24:MI:SS') >= time_to)
                    )
                `, [date, `${date} ${time_from}:00`, `${date} ${time_to}:00`]);

                if (overlappingRooms.length > 0) {
                    const overlappingRoom = overlappingRooms[0];
                    // Format times for error message
                    let existingTimeFrom = '';
                    let existingTimeTo = '';
                    
                    if (overlappingRoom.TIME_FROM) {
                        if (typeof overlappingRoom.TIME_FROM === 'string') {
                            const timeMatch = overlappingRoom.TIME_FROM.match(/(\d{2}:\d{2}):\d{2}$/);
                            existingTimeFrom = timeMatch ? timeMatch[1] : '';
                        }
                    }
                    
                    if (overlappingRoom.TIME_TO) {
                        if (typeof overlappingRoom.TIME_TO === 'string') {
                            const timeMatch = overlappingRoom.TIME_TO.match(/(\d{2}:\d{2}):\d{2}$/);
                            existingTimeTo = timeMatch ? timeMatch[1] : '';
                        }
                    }

                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        error: 'Time overlap detected',
                        details: `Time conflict with existing room ${overlappingRoom.ROOM_NO} (${existingTimeFrom} - ${existingTimeTo}). Please choose a different time slot.`
                    }));
                    return;
                }

                // Insert room (room_id auto-generated by trigger)
                await db.execute(
                    `INSERT INTO Rooms (room_no, date_available, time_from, time_to, course_code, teacher_name)
                     VALUES (:1, TO_DATE(:2, 'YYYY-MM-DD'), TO_TIMESTAMP(:3, 'YYYY-MM-DD HH24:MI:SS'), TO_TIMESTAMP(:4, 'YYYY-MM-DD HH24:MI:SS'), :5, :6)`,
                    [room_no.trim().toUpperCase(), date, `${date} ${time_from}:00`, `${date} ${time_to}:00`, course, teacherName]
                );

                // Get the latest room_id
                const roomResult = await db.execute('SELECT MAX(room_id) AS room_id FROM Rooms');
                const room_id = roomResult[0].ROOM_ID;

                // Generate and insert slots
                let slotsCreated = 0;

                // Parse time strings and work with minutes since midnight
                const parseTimeToMinutes = (timeStr) => {
                    const [hours, minutes] = timeStr.split(':').map(Number);
                    return hours * 60 + minutes;
                };

                const formatMinutesToTime = (totalMinutes) => {
                    const hours = Math.floor(totalMinutes / 60);
                    const minutes = totalMinutes % 60;
                    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
                };

                let currentMinutes = parseTimeToMinutes(time_from);
                const endMinutes = parseTimeToMinutes(time_to);

                console.log('Creating slots from', time_from, 'to', time_to);

                while (currentMinutes < endMinutes) {
                    const slotStartMinutes = currentMinutes;
                    const slotEndMinutes = currentMinutes + 30; // 30 minutes

                    if (slotEndMinutes <= endMinutes) {
                        const startTimeStr = formatMinutesToTime(slotStartMinutes);
                        const endTimeStr = formatMinutesToTime(slotEndMinutes);

                        const startStr = `${date} ${startTimeStr}`;
                        const endStr = `${date} ${endTimeStr}`;

                        console.log('Creating slot:', startStr, 'to', endStr);

                        await db.execute(
                            'INSERT INTO Slots (room_id, slot_start, slot_end, is_booked) VALUES (:1, TO_TIMESTAMP(:2, \'YYYY-MM-DD HH24:MI:SS\'), TO_TIMESTAMP(:3, \'YYYY-MM-DD HH24:MI:SS\'), :4)',
                            [room_id, startStr, endStr, 'N']
                        );
                        slotsCreated++;
                    }
                    currentMinutes = slotEndMinutes;
                }

                console.log('Total slots created:', slotsCreated);

                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    room_id,
                    slots_created: slotsCreated,
                    message: 'Room created successfully with ' + slotsCreated + ' slots'
                }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Database error', details: err.message }));
            }
        })();

    } else if (pathname === '/api/teacher/bookings' && method === 'GET') {
        (async () => {
            try {
                const user = await getUserFromSession(req);
                if (!user || user.role !== 'teacher') {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Unauthorized' }));
                    return;
                }

                // Join Bookings, Slots, Rooms, Students
                const bookings = await db.execute(`
                    SELECT b.booking_id, b.student_id, s.name AS student_name, r.room_no, sl.slot_start, sl.slot_end, b.token_code, b.booking_time
                    FROM Bookings b
                    JOIN Slots sl ON b.slot_id = sl.slot_id
                    JOIN Rooms r ON sl.room_id = r.room_id
                    JOIN Students s ON b.student_id = s.student_id
                    ORDER BY b.booking_time DESC
                `);

                const allBookings = bookings.map(b => {
                    let date = '';
                    let time_start = '';
                    let time_end = '';

                    // Extract date and time from timestamp strings
                    if (b.SLOT_START) {
                        if (typeof b.SLOT_START === 'string') {
                            // Extract date part like "2025-01-31"
                            const dateMatch = b.SLOT_START.match(/^(\d{4}-\d{2}-\d{2})/);
                            date = dateMatch ? dateMatch[1] : '';

                            // Extract time part like "10:00"
                            const timeMatch = b.SLOT_START.match(/(\d{2}:\d{2}):\d{2}$/);
                            time_start = timeMatch ? timeMatch[1] : '';
                        } else if (b.SLOT_START instanceof Date) {
                            date = b.SLOT_START.toISOString().split('T')[0];
                            time_start = String(b.SLOT_START.getHours()).padStart(2, '0') + ':' +
                                        String(b.SLOT_START.getMinutes()).padStart(2, '0');
                        }
                    }

                    if (b.SLOT_END) {
                        if (typeof b.SLOT_END === 'string') {
                            // Extract time part like "10:30"
                            const timeMatch = b.SLOT_END.match(/(\d{2}:\d{2}):\d{2}$/);
                            time_end = timeMatch ? timeMatch[1] : '';
                        } else if (b.SLOT_END instanceof Date) {
                            time_end = String(b.SLOT_END.getHours()).padStart(2, '0') + ':' +
                                      String(b.SLOT_END.getMinutes()).padStart(2, '0');
                        }
                    }

                    return {
                        booking_id: b.BOOKING_ID,
                        student_id: b.STUDENT_ID,
                        student_name: b.STUDENT_NAME,
                        room_no: b.ROOM_NO,
                        date: date,
                        time_start: time_start,
                        time_end: time_end,
                        token_code: b.TOKEN_CODE,
                        booking_time: b.BOOKING_TIME,
                        status: 'Booked'
                    };
                });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ bookings: allBookings }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Database error', details: err.message }));
            }
        })();

    } else if (pathname === '/api/teacher/rooms' && method === 'GET') {
        (async () => {
            try {
                const user = await getUserFromSession(req);
                if (!user || user.role !== 'teacher') {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Unauthorized' }));
                    return;
                }

                // Query all rooms and their slots from Oracle DB
                const rooms = await db.execute('SELECT * FROM Rooms');
                const slots = await db.execute('SELECT * FROM Slots');

                const roomsWithSlots = rooms.map(room => {
                    const roomSlots = slots.filter(slot => slot.ROOM_ID === room.ROOM_ID);
                    const availableSlots = roomSlots.filter(slot => slot.IS_BOOKED === 'N').length;
                    const bookedSlots = roomSlots.filter(slot => slot.IS_BOOKED === 'Y').length;

                    // Format time_from and time_to as HH:MM (extract from timestamp string)
                    let timeFrom = '';
                    let timeTo = '';

                    if (room.TIME_FROM) {
                        if (typeof room.TIME_FROM === 'string') {
                            // Extract time part from timestamp string like "2025-01-31 10:00:00" or "10:00:00"
                            const timeMatch = room.TIME_FROM.match(/(\d{2}:\d{2}):\d{2}/);
                            timeFrom = timeMatch ? timeMatch[1] : '';

                            // If no match found, try just HH:MM format
                            if (!timeFrom) {
                                const simpleMatch = room.TIME_FROM.match(/^(\d{2}:\d{2})$/);
                                timeFrom = simpleMatch ? simpleMatch[1] : '';
                            }
                        } else if (room.TIME_FROM instanceof Date) {
                            timeFrom = String(room.TIME_FROM.getHours()).padStart(2, '0') + ':' +
                                      String(room.TIME_FROM.getMinutes()).padStart(2, '0');
                        } else {
                            // Handle Oracle timestamp type
                            try {
                                const dateObj = new Date(room.TIME_FROM);
                                if (!isNaN(dateObj.getTime())) {
                                    timeFrom = String(dateObj.getHours()).padStart(2, '0') + ':' +
                                              String(dateObj.getMinutes()).padStart(2, '0');
                                }
                            } catch (e) {
                                console.log('Error parsing TIME_FROM:', room.TIME_FROM);
                            }
                        }
                    }

                    if (room.TIME_TO) {
                        if (typeof room.TIME_TO === 'string') {
                            // Extract time part from timestamp string like "2025-01-31 11:30:00" or "11:30:00"
                            const timeMatch = room.TIME_TO.match(/(\d{2}:\d{2}):\d{2}/);
                            timeTo = timeMatch ? timeMatch[1] : '';

                            // If no match found, try just HH:MM format
                            if (!timeTo) {
                                const simpleMatch = room.TIME_TO.match(/^(\d{2}:\d{2})$/);
                                timeTo = simpleMatch ? simpleMatch[1] : '';
                            }
                        } else if (room.TIME_TO instanceof Date) {
                            timeTo = String(room.TIME_TO.getHours()).padStart(2, '0') + ':' +
                                    String(room.TIME_TO.getMinutes()).padStart(2, '0');
                        } else {
                            // Handle Oracle timestamp type
                            try {
                                const dateObj = new Date(room.TIME_TO);
                                if (!isNaN(dateObj.getTime())) {
                                    timeTo = String(dateObj.getHours()).padStart(2, '0') + ':' +
                                            String(dateObj.getMinutes()).padStart(2, '0');
                                }
                            } catch (e) {
                                console.log('Error parsing TIME_TO:', room.TIME_TO);
                            }
                        }
                    }

                    // Format date properly for frontend
                    let formattedDate = '';
                    if (room.DATE_AVAILABLE) {
                        if (typeof room.DATE_AVAILABLE === 'string') {
                            // If it's already a string, ensure it's in YYYY-MM-DD format
                            formattedDate = room.DATE_AVAILABLE.split('T')[0];
                        } else if (room.DATE_AVAILABLE instanceof Date) {
                            formattedDate = room.DATE_AVAILABLE.toISOString().split('T')[0];
                        } else {
                            // Handle Oracle date type - convert to string
                            formattedDate = room.DATE_AVAILABLE.toString().split('T')[0];
                        }
                    }

                    return {
                        room_id: room.ROOM_ID,
                        room_no: room.ROOM_NO,
                        date_available: formattedDate,
                        time_from: timeFrom,
                        time_to: timeTo,
                        teacher_name: room.TEACHER_NAME || 'Unknown Teacher',
                        course_code: room.COURSE_CODE || 'Unknown Course',
                        total_slots: roomSlots.length,
                        available_slots: availableSlots,
                        booked_slots: bookedSlots
                    };
                });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ rooms: roomsWithSlots }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Database error', details: err.message }));
            }
        })();

    } else if (pathname === '/api/teacher/delete-room' && method === 'DELETE') {
        (async () => {
            try {
                const user = await getUserFromSession(req);
                if (!user || user.role !== 'teacher') {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Unauthorized' }));
                    return;
                }

                // Get room_id from request body instead of URL search params
                const { room_id } = req.body;

                if (!room_id) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Room ID is required' }));
                    return;
                }

                // Ensure room_id is a number
                const roomIdNum = parseInt(room_id);
                if (isNaN(roomIdNum)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid room ID format' }));
                    return;
                }

                // Check if room exists and get its details
                const rooms = await db.execute('SELECT * FROM Rooms WHERE room_id = :1', [roomIdNum]);
                if (rooms.length === 0) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Room not found' }));
                    return;
                }

                // Check if there are any booked slots for this room
                const bookedSlots = await db.execute(
                    'SELECT COUNT(*) as booked_count FROM Slots WHERE room_id = :1 AND is_booked = :2',
                    [roomIdNum, 'Y']
                );

                if (bookedSlots[0].BOOKED_COUNT > 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        error: 'Cannot delete room with booked slots. Cancel all bookings first.'
                    }));
                    return;
                }

                // Delete all slots for this room first
                await db.execute('DELETE FROM Slots WHERE room_id = :1', [roomIdNum]);

                // Delete the room
                await db.execute('DELETE FROM Rooms WHERE room_id = :1', [roomIdNum]);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Room and all its slots deleted successfully'
                }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Database error', details: err.message }));
            }
        })();

    } else if (pathname === '/api/teacher/delete-slot' && method === 'DELETE') {
        (async () => {
            try {
                const user = await getUserFromSession(req);
                if (!user || user.role !== 'teacher') {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Unauthorized' }));
                    return;
                }

                // Use WHATWG URL API instead of deprecated url.parse()
                const slot_id = parsedUrl.searchParams.get('slot_id');

                if (!slot_id) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Slot ID is required' }));
                    return;
                }

                // Ensure slot_id is a number
                const slotIdNum = parseInt(slot_id);
                if (isNaN(slotIdNum)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid slot ID format' }));
                    return;
                }

                // Check if slot exists and is not booked
                const slots = await db.execute(
                    'SELECT * FROM Slots WHERE slot_id = :1',
                    [slotIdNum]
                );

                if (slots.length === 0) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Slot not found' }));
                    return;
                }

                if (slots[0].IS_BOOKED === 'Y') {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        error: 'Cannot delete a booked slot.'
                    }));
                    return;
                }

                // Delete the slot
                await db.execute('DELETE FROM Slots WHERE slot_id = :1', [slotIdNum]);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Slot deleted successfully'
                }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Database error', details: err.message }));
            }
        })();

    } else if (pathname.startsWith('/api/teacher/bookings/') && method === 'DELETE') {
        (async () => {
            try {
                const user = await getUserFromSession(req);
                if (!user || user.role !== 'teacher') {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Unauthorized' }));
                    return;
                }

                // Parse booking_id from URL
                const urlParts = parsedUrl.pathname.split('/');
                const bookingId = urlParts[urlParts.length - 1];

                console.log('Cancel booking request - URL:', req.url);
                console.log('Cancel booking request - URL parts:', urlParts);
                console.log('Cancel booking request - bookingId:', bookingId);

                if (!bookingId || isNaN(bookingId)) {
                    console.log('Invalid booking ID:', bookingId);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid booking ID' }));
                    return;
                }

                const bookingIdNum = parseInt(bookingId);
                console.log('Parsed booking ID:', bookingIdNum);

                // Get booking details and slot_id before deleting
                console.log('Getting booking details for ID:', bookingIdNum);
                const bookingDetails = await db.execute(`
                    SELECT b.slot_id, b.student_id, s.name as student_name, r.room_no
                    FROM Bookings b
                    JOIN Students s ON b.student_id = s.student_id
                    JOIN Slots sl ON b.slot_id = sl.slot_id
                    JOIN Rooms r ON sl.room_id = r.room_id
                    WHERE b.booking_id = :1
                `, [bookingIdNum]);

                if (bookingDetails.length === 0) {
                    console.log('Booking not found with ID:', bookingIdNum);
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Booking not found' }));
                    return;
                }

                const booking = bookingDetails[0];
                const slotId = booking.SLOT_ID;
                console.log('Found booking:', booking);

                // Delete the booking
                console.log('Deleting booking:', bookingIdNum);
                await db.execute('DELETE FROM Bookings WHERE booking_id = :1', [bookingIdNum]);

                // Update slot to be available again
                console.log('Updating slot to available:', slotId);
                await db.execute(
                    'UPDATE Slots SET is_booked = :1 WHERE slot_id = :2',
                    ['N', slotId]
                );

                console.log('Booking cancelled successfully');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Booking cancelled successfully (declined)',
                    booking_id: bookingIdNum,
                    student_name: booking.STUDENT_NAME,
                    room_no: booking.ROOM_NO
                }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Database error', details: err.message }));
            }
        })();

    } else if (pathname.startsWith('/api/teacher/rooms/') && method === 'PUT') {
        (async () => {
            try {
                console.log('PUT request received:', { pathname, method, body: req.body });

                const user = await getUserFromSession(req);
                if (!user || user.role !== 'teacher') {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Unauthorized' }));
                    return;
                }

                // Parse room_id from URL
                const urlParts = parsedUrl.pathname.split('/');
                const roomId = urlParts[urlParts.length - 1];

                console.log('Parsed roomId:', roomId);

                if (!roomId || isNaN(roomId)) {
                    console.log('ERROR: Invalid room ID - roomId:', roomId, 'isNaN:', isNaN(roomId));
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid room ID' }));
                    return;
                }

                console.log('req.body:', req.body);
                const { room_no, date, time_from, time_to, room_id: bodyRoomId } = req.body;
                console.log('Destructured values:', { room_no, date, time_from, time_to });
                console.log('Body contains room_id:', !!bodyRoomId, 'value:', bodyRoomId);

                if (!room_no || !date || !time_from || !time_to) {
                    console.log('ERROR: Missing required fields - room_no:', !!room_no, 'date:', !!date, 'time_from:', !!time_from, 'time_to:', !!time_to);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing required fields' }));
                    return;
                }

                // Check if room has any booked slots
                const bookedSlots = await db.execute(
                    `SELECT COUNT(*) as booked_count FROM Slots
                     WHERE room_id = :1 AND is_booked = 'Y'`,
                    [parseInt(roomId)]
                );

                if (bookedSlots[0].BOOKED_COUNT > 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        error: 'Cannot update room with active bookings. Cancel all bookings first.'
                    }));
                    return;
                }

                // Validate time format
                const timeFrom = new Date(`${date}T${time_from}`);
                const timeTo = new Date(`${date}T${time_to}`);
                if (isNaN(timeFrom.getTime()) || isNaN(timeTo.getTime())) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid time format' }));
                    return;
                }
                if (timeFrom >= timeTo) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'End time must be after start time' }));
                    return;
                }

                // Update room - use date string directly to avoid timezone conversion issues
                // HTML date inputs provide YYYY-MM-DD format which Oracle can handle directly
                const timeFromStr = `${date} ${time_from}:00`;
                const timeToStr = `${date} ${time_to}:00`;

                console.log('Updating room:', {
                    room_id: parseInt(roomId),
                    room_no,
                    date,
                    time_from: timeFromStr,
                    time_to: timeToStr
                });

                await db.execute(
                    `UPDATE Rooms SET room_no = :1, date_available = TO_DATE(:2, 'YYYY-MM-DD'),
                     time_from = TO_TIMESTAMP(:3, 'YYYY-MM-DD HH24:MI:SS'),
                     time_to = TO_TIMESTAMP(:4, 'YYYY-MM-DD HH24:MI:SS')
                     WHERE room_id = :5`,
                    [room_no, date, timeFromStr, timeToStr, parseInt(roomId)]
                );

                // Verify the update by querying the room back
                const updatedRoom = await db.execute('SELECT * FROM Rooms WHERE room_id = :1', [parseInt(roomId)]);
                console.log('Room after update:', updatedRoom[0]);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Room updated successfully',
                    room_id: roomId,
                    stored_date: updatedRoom[0]?.DATE_AVAILABLE
                }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Database error', details: err.message }));
            }
        })();

    } else if (pathname.startsWith('/api/teacher/slots/') && method === 'PUT') {
        (async () => {
            try {
                const user = await getUserFromSession(req);
                if (!user || user.role !== 'teacher') {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Unauthorized' }));
                    return;
                }

                // Parse slot_id from URL
                const urlParts = parsedUrl.pathname.split('/');
                const slotId = urlParts[urlParts.length - 1];

                if (!slotId || isNaN(slotId)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid slot ID' }));
                    return;
                }

                const { slot_start, slot_end } = req.body;

                if (!slot_start || !slot_end) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing required fields' }));
                    return;
                }

                // Validate time format
                const startTime = new Date(slot_start);
                const endTime = new Date(slot_end);
                if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid time format' }));
                    return;
                }
                if (startTime >= endTime) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'End time must be after start time' }));
                    return;
                }

                // Update slot
                await db.execute(
                    'UPDATE Slots SET slot_start = :1, slot_end = :2 WHERE slot_id = :3',
                    [startTime.toISOString().replace('T', ' ').substring(0, 19), endTime.toISOString().replace('T', ' ').substring(0, 19), slotId]
                );

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Slot updated successfully',
                    slot_id: slotId
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