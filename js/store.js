/* ============================================
   BM's Auto Spa — Data Store (Supabase)
   ============================================ */
import { supabase } from './supabase.js';

// ---- Packages ----
export async function getPackages() {
    const { data, error } = await supabase
        .from('service_packages')
        .select('*')
        .order('sort_order');
    if (error) { console.error('getPackages error:', error); return []; }
    // Map DB columns to the shape the frontend expects
    return data.map(mapPackage);
}

export async function savePackage(pkg) {
    const row = {
        name: pkg.name,
        icon: pkg.icon || '🚗',
        description: pkg.desc || pkg.description || '',
        price_sedan: pkg.prices?.Sedan ?? pkg.price_sedan ?? 0,
        price_suv: pkg.prices?.SUV ?? pkg.price_suv ?? 0,
        price_mpv: pkg.prices?.MPV ?? pkg.price_mpv ?? 0,
        price_luxury: pkg.prices?.['Luxury/Large'] ?? pkg.price_luxury ?? 0,
        is_active: pkg.active ?? pkg.is_active ?? true,
        sort_order: pkg.sort_order ?? 0,
    };
    if (pkg.id) {
        const { error } = await supabase.from('service_packages').update(row).eq('id', pkg.id);
        if (error) console.error('savePackage update error:', error);
    } else {
        const { error } = await supabase.from('service_packages').insert(row);
        if (error) console.error('savePackage insert error:', error);
    }
}

export async function togglePackageActive(id, isActive) {
    const { error } = await supabase.from('service_packages').update({ is_active: isActive }).eq('id', id);
    if (error) console.error('togglePackageActive error:', error);
}

function mapPackage(row) {
    return {
        id: row.id,
        name: row.name,
        icon: row.icon,
        desc: row.description,
        prices: {
            Sedan: row.price_sedan,
            SUV: row.price_suv,
            MPV: row.price_mpv,
            'Luxury/Large': row.price_luxury,
        },
        active: row.is_active,
        sort_order: row.sort_order,
    };
}

// ---- Settings ----
export async function getSettings() {
    const { data, error } = await supabase.from('settings').select('*');
    if (error) { console.error('getSettings error:', error); return getDefaultSettings(); }
    // Flatten key-value rows into a single object
    const settings = {};
    for (const row of data) {
        settings[row.key] = row.value;
    }
    return {
        operatingHours: settings.operating_hours || { open: '08:00', close: '18:00' },
        maxCarsPerSlot: settings.max_cars_per_slot || 4,
        slotDurationMinutes: settings.slot_duration_minutes || 60,
    };
}

function getDefaultSettings() {
    return {
        operatingHours: { open: '08:00', close: '18:00' },
        maxCarsPerSlot: 4,
        slotDurationMinutes: 60,
    };
}

export async function saveSettings(settings) {
    const updates = [
        { key: 'operating_hours', value: settings.operatingHours },
        { key: 'max_cars_per_slot', value: settings.maxCarsPerSlot },
        { key: 'slot_duration_minutes', value: settings.slotDurationMinutes },
    ];
    for (const u of updates) {
        const { error } = await supabase
            .from('settings')
            .update({ value: u.value, updated_at: new Date().toISOString() })
            .eq('key', u.key);
        if (error) console.error('saveSettings error:', error);
    }
}

// ---- Bookings ----
export async function getBookings(filters = {}) {
    let query = supabase.from('bookings').select('*');
    if (filters.date) query = query.eq('booking_date', filters.date);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.plateNumber) {
        query = query.ilike('plate_number', `%${filters.plateNumber.replace(/\s/g, '')}%`);
    }
    query = query.order('created_at', { ascending: false });
    const { data, error } = await query;
    if (error) { console.error('getBookings error:', error); return []; }
    return data.map(mapBooking);
}

export async function getBookingsByDate(date) {
    return getBookings({ date });
}

export async function getBookingByPlate(plate) {
    const cleanPlate = plate.replace(/\s/g, '');
    const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) { console.error('getBookingByPlate error:', error); return null; }
    // Client-side plate matching (ignoring spaces)
    const match = data.find(b => b.plate_number.replace(/\s/g, '') === cleanPlate);
    return match ? mapBooking(match) : null;
}

export async function addBooking(booking) {
    // Verify price server-side by looking up the actual package price
    let verifiedPrice = booking.price;
    if (booking.packageId) {
        const { data: pkg } = await supabase
            .from('service_packages')
            .select('*')
            .eq('id', booking.packageId)
            .single();
        if (pkg) {
            const priceKey = 'price_' + booking.vehicleType.toLowerCase().replace('/', '_').replace('luxury_large', 'luxury');
            const priceMap = { Sedan: pkg.price_sedan, SUV: pkg.price_suv, MPV: pkg.price_mpv, 'Luxury/Large': pkg.price_luxury };
            verifiedPrice = priceMap[booking.vehicleType] ?? booking.price;
        }
    }
    const row = {
        plate_number: booking.plateNumber,
        vehicle_type: booking.vehicleType,
        package_id: booking.packageId || null,
        package_name: booking.packageName,
        booking_date: booking.date,
        time_slot: booking.timeSlot,
        customer_name: booking.customerName || '',
        customer_phone: booking.customerPhone || '',
        price: verifiedPrice,
        status: booking.status || 'Pending',
        payment_method: booking.paymentMethod || null,
    };
    const { data, error } = await supabase.from('bookings').insert(row).select().single();
    if (error) { console.error('addBooking error:', error); return null; }
    return mapBooking(data);
}

export async function updateBooking(id, updates) {
    const row = {};
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.paymentMethod !== undefined) row.payment_method = updates.paymentMethod;
    if (updates.paidAt !== undefined) row.paid_at = updates.paidAt;
    const { data, error } = await supabase.from('bookings').update(row).eq('id', id).select().single();
    if (error) { console.error('updateBooking error:', error); return null; }
    return mapBooking(data);
}

export async function deleteBooking(id) {
    const { error } = await supabase.from('bookings').delete().eq('id', id);
    if (error) console.error('deleteBooking error:', error);
}

function mapBooking(row) {
    return {
        id: row.id,
        plateNumber: row.plate_number,
        vehicleType: row.vehicle_type,
        packageId: row.package_id,
        packageName: row.package_name,
        date: row.booking_date,
        timeSlot: row.time_slot,
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        price: row.price,
        status: row.status,
        paymentMethod: row.payment_method,
        paidAt: row.paid_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

// ---- Slot Availability ----
export async function getAvailableSlots(date) {
    const settings = await getSettings();
    const { open, close } = settings.operatingHours;
    const maxCars = settings.maxCarsPerSlot;
    const duration = settings.slotDurationMinutes;

    const [openH, openM] = open.split(':').map(Number);
    const [closeH, closeM] = close.split(':').map(Number);
    const startMin = openH * 60 + openM;
    const endMin = closeH * 60 + closeM;

    // Get bookings for that date
    const bookings = await getBookingsByDate(date);

    const slots = [];
    for (let t = startMin; t + duration <= endMin; t += duration) {
        const h = Math.floor(t / 60).toString().padStart(2, '0');
        const m = (t % 60).toString().padStart(2, '0');
        const slotTime = `${h}:${m}`;
        const count = bookings.filter(b => b.timeSlot === slotTime || b.timeSlot === `${slotTime}:00`).length;
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
export async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { console.error('login error:', error); return null; }
    // Fetch profile
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
    if (profileError) { console.error('profile fetch error:', profileError); return null; }
    return {
        id: data.user.id,
        email: data.user.email,
        username: profile.username,
        role: profile.role,
        name: profile.name,
    };
}

export async function getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return null;
    // Fetch profile
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
    if (profileError) return null;
    return {
        id: session.user.id,
        email: session.user.email,
        username: profile.username,
        role: profile.role,
        name: profile.name,
    };
}

export async function logout() {
    await supabase.auth.signOut();
}

export async function requireAuth(requiredRole) {
    const session = await getSession();
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

// HTML sanitizer — prevents XSS when rendering user data via innerHTML
export function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

// Input validation
export function isValidPlate(plate) {
    // Allow Malaysian-style plates: letters + digits, with optional spaces
    return /^[A-Z]{1,3}\s?\d{1,4}(\s?[A-Z]{0,3})?$/.test(plate.trim().toUpperCase());
}

export function isValidPhone(phone) {
    // Malaysian phone: 01x-xxxxxxx or 01x xxxxxxx (10-11 digits)
    const digits = phone.replace(/[\s\-]/g, '');
    return /^01\d{8,9}$/.test(digits);
}

export function formatTime(timeStr) {
    // Handle both "HH:MM" and "HH:MM:SS" formats
    const parts = timeStr.split(':');
    const h = parseInt(parts[0]);
    const m = parseInt(parts[1]);
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
