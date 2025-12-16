// Additional teacher routes for monthly reporting and counseling history
// These routes should be integrated into routes/teacher.js

// Monthly Report Route
const monthlyReportRoute = `
    } else if (pathname === '/api/teacher/monthly-report' && method === 'GET') {
        (async () => {
            try {
                const user = await getUserFromSession(req);
                if (!user || user.role !== 'teacher') {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Unauthorized' }));
                    return;
                }

                const query = parsedUrl.query;
                const month = query.month || new Date().toISOString().substring(0, 7); // YYYY-MM format
                const year = query.year || new Date().getFullYear();

                // Get monthly booking statistics
                const monthlyBookings = await db.execute(\`
                    SELECT 
                        COUNT(*) as total_bookings,
                        COUNT(CASE WHEN b.booking_status = 'ACTIVE' THEN 1 END) as active_bookings,
                        COUNT(CASE WHEN b.booking_status = 'CANCELLED' THEN 1 END) as cancelled_bookings,
                        COUNT(CASE WHEN b.booking_status = 'COMPLETED' THEN 1 END) as completed_bookings,
                        NVL(SUM(b.view_count), 0) as total_views,
                        COUNT(DISTINCT b.student_id) as unique_students
                    FROM Bookings b
                    JOIN Slots s ON b.slot_id = s.slot_id
                    JOIN Rooms r ON s.room_id = r.room_id
                    WHERE EXTRACT(YEAR FROM s.slot_start) = :year
                    AND EXTRACT(MONTH FROM s.slot_start) = :month
                \`, [year, month]);

                // Get daily booking breakdown
                const dailyBreakdown = await db.execute(\`
                    SELECT 
                        TO_CHAR(s.slot_start, 'YYYY-MM-DD') as date,
                        COUNT(*) as bookings_count,
                        COUNT(CASE WHEN b.booking_status = 'ACTIVE' THEN 1 END) as active_count,
                        COUNT(CASE WHEN b.booking_status = 'CANCELLED' THEN 1 END) as cancelled_count
                    FROM Bookings b
                    JOIN Slots s ON b.slot_id = s.slot_id
                    WHERE EXTRACT(YEAR FROM s.slot_start) = :year
                    AND EXTRACT(MONTH FROM s.slot_start) = :month
                    GROUP BY TO_CHAR(s.slot_start, 'YYYY-MM-DD')
                    ORDER BY date
                \`, [year, month]);

                // Get room utilization
                const roomUtilization = await db.execute(\`
                    SELECT 
                        r.room_no,
                        COUNT(b.booking_id) as total_bookings,
                        COUNT(CASE WHEN b.booking_status = 'ACTIVE' THEN 1 END) as active_bookings,
                        COUNT(CASE WHEN b.booking_status = 'COMPLETED' THEN 1 END) as completed_bookings,
                        NVL(SUM(b.view_count), 0) as total_views
                    FROM Rooms r
                    LEFT JOIN Slots s ON r.room_id = s.room_id
                    LEFT JOIN Bookings b ON s.slot_id = b.slot_id
                    WHERE EXTRACT(YEAR FROM s.slot_start) = :year
                    AND EXTRACT(MONTH FROM s.slot_start) = :month
                    GROUP BY r.room_id, r.room_no
                    ORDER BY r.room_no
                \`, [year, month]);

                // Get top students by booking activity
                const topStudents = await db.execute(\`
                    SELECT 
                        s.name as student_name,
                        s.student_id,
                        COUNT(b.booking_id) as booking_count,
                        NVL(SUM(b.view_count), 0) as total_views
                    FROM Students s
                    JOIN Bookings b ON s.student_id = b.student_id
                    JOIN Slots sl ON b.slot_id = sl.slot_id
                    WHERE EXTRACT(YEAR FROM sl.slot_start) = :year
                    AND EXTRACT(MONTH FROM sl.slot_start) = :month
                    GROUP BY s.student_id, s.name
                    ORDER BY booking_count DESC, total_views DESC
                    FETCH FIRST 10 ROWS ONLY
                \`, [year, month]);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    report_period: {
                        month: month,
                        year: year,
                        month_name: new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                    },
                    summary: monthlyBookings[0] || {
                        total_bookings: 0,
                        active_bookings: 0,
                        cancelled_bookings: 0,
                        completed_bookings: 0,
                        total_views: 0,
                        unique_students: 0
                    },
                    daily_breakdown: dailyBreakdown,
                    room_utilization: roomUtilization,
                    top_students: topStudents
                }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Database error', details: err.message }));
            }
        })();

`;

// Counseling History GET Route
const counselingHistoryGetRoute = `
    } else if (pathname === '/api/teacher/counseling-history' && method === 'GET') {
        (async () => {
            try {
                const user = await getUserFromSession(req);
                if (!user || user.role !== 'teacher') {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Unauthorized' }));
                    return;
                }

                const query = parsedUrl.query;
                const limit = parseInt(query.limit) || 50;
                const offset = parseInt(query.offset) || 0;

                // Get counseling history for this teacher
                const counselingHistory = await db.execute(\`
                    SELECT 
                        c.counseling_id,
                        c.student_id,
                        s.name as student_name,
                        c.session_date,
                        c.session_duration,
                        c.meeting_notes,
                        c.outcome,
                        c.follow_up_required,
                        c.created_at,
                        c.updated_at,
                        b.token_code,
                        r.room_no
                    FROM Counseling_History c
                    JOIN Students s ON c.student_id = s.student_id
                    LEFT JOIN Bookings b ON c.booking_id = b.booking_id
                    LEFT JOIN Slots sl ON b.slot_id = sl.slot_id
                    LEFT JOIN Rooms r ON sl.room_id = r.room_id
                    WHERE c.teacher_id = :teacher_id
                    ORDER BY c.session_date DESC, c.created_at DESC
                    OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
                \`, [user.user_id, offset, limit]);

                // Get total count for pagination
                const totalCount = await db.execute(
                    'SELECT COUNT(*) as total FROM Counseling_History WHERE teacher_id = :teacher_id',
                    [user.user_id]
                );

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    counseling_history: counselingHistory,
                    pagination: {
                        total: totalCount[0]?.TOTAL || 0,
                        limit: limit,
                        offset: offset,
                        has_more: (offset + limit) < (totalCount[0]?.TOTAL || 0)
                    }
                }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Database error', details: err.message }));
            }
        })();

`;

// Counseling History POST Route
const counselingHistoryPostRoute = `
    } else if (pathname === '/api/teacher/counseling-history' && method === 'POST') {
        (async () => {
            try {
                const user = await getUserFromSession(req);
                if (!user || user.role !== 'teacher') {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Unauthorized' }));
                    return;
                }

                const { student_id, booking_id, session_date, session_duration, meeting_notes, outcome, follow_up_required } = req.body;

                // Validate required fields
                if (!student_id || !session_date) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Student ID and session date are required' }));
                    return;
                }

                // Insert new counseling record
                await db.execute(\`
                    INSERT INTO Counseling_History (
                        teacher_id, student_id, booking_id, session_date, session_duration,
                        meeting_notes, outcome, follow_up_required
                    ) VALUES (
                        :teacher_id, :student_id, :booking_id, TO_DATE(:session_date, 'YYYY-MM-DD'),
                        :session_duration, :meeting_notes, :outcome, :follow_up_required
                    )
                \`, [
                    user.user_id,
                    student_id,
                    booking_id || null,
                    session_date,
                    session_duration || 30,
                    meeting_notes || null,
                    outcome || null,
                    follow_up_required || 'N'
                ]);

                // Get the created record
                const newRecord = await db.execute(\`
                    SELECT c.*, s.name as student_name
                    FROM Counseling_History c
                    JOIN Students s ON c.student_id = s.student_id
                    WHERE c.teacher_id = :teacher_id
                    AND c.student_id = :student_id
                    AND c.session_date = TO_DATE(:session_date, 'YYYY-MM-DD')
                    ORDER BY c.created_at DESC
                    FETCH FIRST 1 ROWS ONLY
                \`, [user.user_id, student_id, session_date]);

                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    counseling_record: newRecord[0],
                    message: 'Counseling session recorded successfully'
                }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Database error', details: err.message }));
            }
        })();

`;

module.exports = {
    monthlyReportRoute,
    counselingHistoryGetRoute,
    counselingHistoryPostRoute
};