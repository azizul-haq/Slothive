# Presentation Room Booking System

A comprehensive presentation room booking system for university students and teachers, built with Node.js and Oracle Database 11g.

## 🚀 **Quick Start**

### Prerequisites
- **Node.js** (Latest LTS version)
- **Oracle Database 11g** running
- **Oracle Instant Client** installed and configured

### Environment Setup
1. **Clone the repository and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Create a `.env` file in the root directory:
   ```env
   DB_USER=your_oracle_username
   DB_PASSWORD=your_oracle_password
   DB_CONNECT_STRING=your_connection_string
   PORT=3000
   ```

3. **Start the application:**
   ```bash
   npm start
   ```

4. **Access the application:**
   - Open your browser and go to `http://localhost:3000`

## ✨ **Features**

### Student Features
- ✅ User registration and login
- ✅ View available rooms and time slots
- ✅ Book presentation slots with conflict prevention
- ✅ Generate printable booking tokens
- ✅ View booking history and manage bookings
- ✅ Cancel bookings (with restrictions)

### Teacher Features
- ✅ User registration and login
- ✅ Create new rooms with custom time availability
- ✅ Auto-generate 30-minute time slots
- ✅ View all bookings across all rooms
- ✅ Manage room availability and schedules
- ✅ Edit room details (with booking restrictions)

### System Features
- ✅ Session-based authentication with secure cookies
- ✅ Responsive design for mobile and desktop
- ✅ Real-time availability checking
- ✅ Token-based booking verification
- ✅ Comprehensive error handling

## 🛠️ **Technology Stack**

### Backend Architecture
- **Runtime**: Node.js (Latest LTS)
- **Server**: Custom HTTP server (built with Node.js `http` module)
- **Database**: Oracle Database 11g with `oracledb` driver
- **Authentication**: Session-based with HTTP-only cookies
- **Security**: SHA-256 password hashing
- **Routing**: Manual URL-based routing system

### Frontend Architecture
- **Markup**: HTML5 with semantic elements
- **Styling**: CSS3 with modern features (backdrop-filter, flexbox, grid)
- **Interactivity**: Vanilla JavaScript (ES6+)
- **Responsive**: Mobile-first design with media queries

### Dependencies
```json
{
  "dotenv": "^17.2.2",
  "oracledb": "^6.9.0"
}
```

### Database Requirements
- **Oracle Database**: 11g or higher
- **Instant Client**: Version 23.9 (located at `C:\instantclient_23_9`)
- **Tables**: Students, Teachers, Rooms, Slots, Bookings, Sessions

## 📁 **Project Structure**

```
presentation-room-booking/
├── app.js                    # Main server application
├── package.json              # Node.js dependencies and scripts
├── .env                      # Environment variables (configure this)
├── TECH_STACK.md            # Detailed tech stack documentation
├── README.md                # This file
├── test-oracle-connection.js # Database connection testing
│
├── db/                      # Database layer
│   ├── oracle.js            # Oracle connection and query utilities
│   └── schema-oracle11g.sql # Database schema and setup
│
├── routes/                  # API route handlers
│   ├── auth.js              # Authentication (login/register/logout/check)
│   ├── student.js           # Student operations (bookings, slots)
│   └── teacher.js           # Teacher operations (rooms, bookings)
│
├── views/                   # HTML templates
│   ├── index.html           # Landing page
│   ├── login.html           # User authentication
│   ├── register.html        # User registration
│   ├── dashboard_student.html    # Student dashboard
│   ├── dashboard_teacher.html    # Teacher dashboard
│   ├── bookings.html        # Student bookings management
│   ├── slots.html           # Available slots browser
│   ├── rooms.html           # Teacher rooms management
│   ├── teacher_bookings.html # All bookings overview
│   └── token.html           # Booking token display
│
└── public/                  # Static assets
    ├── favicon.ico          # Website favicon
    ├── css/
    │   └── style.css        # Main stylesheet
    ├── js/
    │   └── script.js        # Client-side utilities
    └── images/              # Image assets (logo, icons)
```

## 🔧 **API Endpoints**

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User authentication
- `POST /api/auth/logout` - User logout
- `GET /api/auth/check` - Session validation

### Student Endpoints
- `GET /api/student/slots` - Get available slots
- `POST /api/student/book` - Book a slot
- `GET /api/student/bookings` - Get user's bookings
- `DELETE /api/student/bookings/:id` - Cancel booking
- `GET /api/student/token/:code` - Get booking token

### Teacher Endpoints
- `POST /api/teacher/create-room` - Create new room with slots
- `GET /api/teacher/rooms` - Get all rooms
- `PUT /api/teacher/rooms/:id` - Update room details
- `DELETE /api/teacher/delete-room` - Delete room
- `GET /api/teacher/bookings` - Get all bookings
- `DELETE /api/teacher/delete-slot` - Delete slot

## 🗄️ **Database Schema**

### Core Tables
- **Students**: Student accounts (student_id, name, email, password, batch, dept)
- **Teachers**: Teacher accounts (teacher_id, name, email, password)
- **Rooms**: Presentation rooms (room_id, room_no, date_available, time_from, time_to)
- **Slots**: Time slots (slot_id, room_id, date, time_start, time_end, status)
- **Bookings**: Room bookings (booking_id, student_id, slot_id, token_code, booking_time)
- **Sessions**: User sessions (session_id, user_id, role, created_at)

### Key Relationships
- Students → Bookings (one-to-many)
- Teachers → Rooms (one-to-many)
- Rooms → Slots (one-to-many)
- Slots → Bookings (one-to-one)

## 🚀 **Deployment & Development**

### Development Environment
- **OS**: Windows 11 (configured for Oracle Instant Client)
- **Node.js**: Latest LTS version
- **Oracle**: Database 11g with Instant Client 23.9
- **Browser**: Modern browsers with ES6+ support

### Production Considerations
- **Process Management**: Use PM2 for production deployment
- **Reverse Proxy**: Nginx recommended for static file serving
- **SSL/TLS**: HTTPS required for secure cookie transmission
- **Database**: Implement connection pooling for high traffic
- **Environment**: Use separate production .env configuration

### Security Features
- ✅ Password hashing (SHA-256)
- ✅ HTTP-only session cookies
- ✅ Session expiration (24 hours)
- ✅ SQL injection prevention (parameterized queries)
- ✅ CORS headers configuration
- ✅ Input validation and sanitization

## 📚 **Additional Resources**

### Documentation
- [Node.js HTTP Module](https://nodejs.org/api/http.html)
- [Oracle Node.js Driver](https://oracle.github.io/node-oracledb/)
- [MDN Web Docs](https://developer.mozilla.org/)

### Development Tools
- **Postman**: API testing and documentation
- **Browser DevTools**: Frontend debugging and testing
- **Oracle SQL Developer**: Database management and queries

---

## 🎉 **Ready to Use!**

Once you've configured your Oracle database connection in the `.env` file, simply run `npm start` and access `http://localhost:3000` to begin using the Presentation Room Booking System!

**Version**: 1.0.0
**Last Updated**: December 2024
# Slothive
# Slothive
