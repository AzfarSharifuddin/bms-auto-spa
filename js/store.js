/* ============================================
   BM's Auto Spa — Shared Data Store & Utilities
   ============================================ */

// ---- Default Service Packages ----
const DEFAULT_PACKAGES = [
    {
        id: 'basic',
        name: 'Basic Wash',
        icon: '💧',
        desc: 'Exterior wash, rinse & dry',
        prices: { Sedan: 25, SUV: 35, MPV: 35, 'Luxury/Large': 45 },
        active: true,
    },
    {
        id: 'standard',
        name: 'Standard Wash',
        icon: '🚿',
        desc: 'Exterior + interior vacuum & wipe-down',
        prices: { Sedan: 40, SUV: 55, MPV: 55, 'Luxury/Large': 70 },
        active: true,
    },
    {
        id: 'premium',
        name: 'Premium Detail',
        icon: '✨',
        desc: 'Full detail: wash, vacuum, polish & tyre shine',
        prices: { Sedan: 80, SUV: 100, MPV: 100, 'Luxury/Large': 130 },
        active: true,
    },
    {
        id: 'interior',
        name: 'Interior Only',
        icon: '🧹',
        desc: 'Deep interior vacuum, dashboard & seats',
        prices: { Sedan: 50, SUV: 65, MPV: 65, 'Luxury/Large': 80 },
        active: true,
    },
];

// ---- Default Settings ----
const DEFAULT_SETTINGS = {
    operatingHours: { open: '08:00', close: '18:00' },
    slotDurationMinutes: 60,
    maxCarsPerSlot: 4,
};

// ---- Default Users ----
const DEFAULT_USERS = [
    { username: 'admin', password: 'admin123', role: 'admin', name: 'Boss Man' },
    { username: 'worker', password: 'worker123', role: 'worker', name: 'Ali' },
];

// ---- Storage Keys ----
const KEYS = {
    bookings: 'bms_bookings',
    packages: 'bms_packages',
    settings: 'bms_settings',
    users: 'bms_users',
    session: 'bms_session',
};

// ---- Init Defaults ----
export function initDefaults() {
    if (!localStorage.getItem(KEYS.packages)) {
        localStorage.setItem(KEYS.packages, JSON.stringify(DEFAULT_PACKAGES));
    }
    if (!localStorage.getItem(KEYS.settings)) {
        localStorage.setItem(KEYS.settings, JSON.stringify(DEFAULT_SETTINGS));
    }
    if (!localStorage.getItem(KEYS.users)) {
        localStorage.setItem(KEYS.users, JSON.stringify(DEFAULT_USERS));
    }
    if (!localStorage.getItem(KEYS.bookings)) {
        localStorage.setItem(KEYS.bookings, JSON.stringify([]));
    }
}

// ---- CRUD Helpers ----
export function getPackages() {
    return JSON.parse(localStorage.getItem(KEYS.packages) || '[]');
}
export function savePackages(packages) {
    localStorage.setItem(KEYS.packages, JSON.stringify(packages));
}

export function getSettings() {
    return JSON.parse(localStorage.getItem(KEYS.settings) || '{}');
}
export function saveSettings(settings) {
    localStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

export function getBookings() {
    return JSON.parse(localStorage.getItem(KEYS.bookings) || '[]');
}
export function saveBookings(bookings) {
    localStorage.setItem(KEYS.bookings, JSON.stringify(bookings));
}

export function addBooking(booking) {
    const bookings = getBookings();
    booking.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    booking.createdAt = new Date().toISOString();
    bookings.push(booking);
    saveBookings(bookings);
    return booking;
}

export function updateBooking(id, updates) {
    const bookings = getBookings();
    const idx = bookings.findIndex(b => b.id === id);
    if (idx !== -1) {
        bookings[idx] = { ...bookings[idx], ...updates };
        saveBookings(bookings);
        return bookings[idx];
    }
    return null;
}

export function deleteBooking(id) {
    const bookings = getBookings().filter(b => b.id !== id);
    saveBookings(bookings);
}

// ---- Slot Availability ----
export function getAvailableSlots(date) {
    const settings = getSettings();
    const { open, close } = settings.operatingHours;
    const maxCars = settings.maxCarsPerSlot;
    const duration = settings.slotDurationMinutes;

    const slots = [];
    const [openH, openM] = open.split(':').map(Number);
    const [closeH, closeM] = close.split(':').map(Number);
    const startMin = openH * 60 + openM;
    const endMin = closeH * 60 + closeM;

    const bookings = getBookings().filter(b => b.date === date);

    for (let t = startMin; t + duration <= endMin; t += duration) {
        const h = Math.floor(t / 60).toString().padStart(2, '0');
        const m = (t % 60).toString().padStart(2, '0');
        const slotTime = `${h}:${m}`;
        const count = bookings.filter(b => b.timeSlot === slotTime).length;
        slots.push({
            time: slotTime,
            label: formatTime(slotTime),
            booked: count,
            max: maxCars,
            available: count < maxCars,
        });
    }
    return slots;
}

// ---- Auth ----
export function login(username, password) {
    const users = JSON.parse(localStorage.getItem(KEYS.users) || '[]');
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        const session = { username: user.username, role: user.role, name: user.name };
        localStorage.setItem(KEYS.session, JSON.stringify(session));
        return session;
    }
    return null;
}

export function getSession() {
    const raw = localStorage.getItem(KEYS.session);
    return raw ? JSON.parse(raw) : null;
}

export function logout() {
    localStorage.removeItem(KEYS.session);
}

export function requireAuth(requiredRole) {
    const session = getSession();
    if (!session) {
        window.location.href = '/pages/login.html';
        return null;
    }
    if (requiredRole === 'admin' && session.role !== 'admin') {
        window.location.href = '/pages/dashboard.html';
        return null;
    }
    return session;
}

// ---- Utility ----
export function formatTime(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease-out forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Status flow
export const STATUS_FLOW = ['Pending', 'Arrived', 'Washing', 'Completed', 'Paid'];

export function getNextStatus(current) {
    const idx = STATUS_FLOW.indexOf(current);
    if (idx === -1 || idx >= STATUS_FLOW.length - 1) return null;
    return STATUS_FLOW[idx + 1];
}

export function statusToClass(status) {
    return status ? status.toLowerCase() : '';
}
