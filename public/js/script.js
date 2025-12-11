// Main JavaScript file for the Room Booking System

// Utility function to show messages
function showMessage(message, type = 'info', duration = 5000) {
    // Create message element if it doesn't exist
    let messageContainer = document.getElementById('message-container');
    if (!messageContainer) {
        messageContainer = document.createElement('div');
        messageContainer.id = 'message-container';
        messageContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            max-width: 400px;
        `;
        document.body.appendChild(messageContainer);
    }

    // Create message element
    const messageElement = document.createElement('div');
    messageElement.className = `message message-${type}`;
    messageElement.style.cssText = `
        margin-bottom: 10px;
        padding: 15px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease-out;
    `;

    // Set background color based on type
    switch (type) {
        case 'success':
            messageElement.style.background = '#48bb78';
            break;
        case 'error':
            messageElement.style.background = '#f56565';
            break;
        case 'warning':
            messageElement.style.background = '#ed8936';
            break;
        default:
            messageElement.style.background = '#4299e1';
    }

    messageElement.textContent = message;
    messageContainer.appendChild(messageElement);

    // Auto-remove after duration
    setTimeout(() => {
        messageElement.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.parentNode.removeChild(messageElement);
            }
        }, 300);
    }, duration);
}

// Utility function to format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Utility function to format time
function formatTime(timeString) {
    const date = new Date(`2000-01-01T${timeString}`);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

// Utility function to validate email
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Utility function to validate password strength
function validatePassword(password) {
    const minLength = 6;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);

    if (password.length < minLength) {
        return { valid: false, message: `Password must be at least ${minLength} characters long` };
    }

    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
        return { valid: false, message: 'Password must contain uppercase, lowercase, and numbers' };
    }

    return { valid: true, message: 'Password is strong' };
}

// Utility function to debounce function calls
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Utility function to check if user is authenticated
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/check');
        if (response.ok) {
            const result = await response.json();
            return result;
        }
        return null;
    } catch (error) {
        return null;
    }
}

// Utility function to redirect if not authenticated
async function requireAuth(requiredRole = null) {
    const auth = await checkAuth();
    if (!auth) {
        window.location.href = '/login';
        return null;
    }
    
    if (requiredRole && auth.role !== requiredRole) {
        window.location.href = '/';
        return null;
    }
    
    return auth;
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Global error handler
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    showMessage('An unexpected error occurred. Please refresh the page.', 'error');
});

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    showMessage('An unexpected error occurred. Please refresh the page.', 'error');
});

// Export utility functions for use in other scripts
window.RoomBookingUtils = {
    showMessage,
    formatDate,
    formatTime,
    isValidEmail,
    validatePassword,
    debounce,
    checkAuth,
    requireAuth
}; 