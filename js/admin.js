import {
    initDefaults, requireAuth, logout,
    getBookings, saveBookings, updateBooking, deleteBooking,
    getPackages, savePackages,
    getSettings, saveSettings,
    todayStr, formatDate, formatTime, showToast, generateId
} from './store.js';

initDefaults();
const session = requireAuth('admin');
if (!session) throw new Error('Not authenticated');

// --- Elements ---
const hamburger = document.getElementById('hamburger');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const adminName = document.getElementById('adminName');
const adminAvatar = document.getElementById('adminAvatar');

adminName.textContent = session.name;
adminAvatar.textContent = session.name.charAt(0).toUpperCase();

// --- Sidebar Toggle ---
hamburger.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('open');
});
sidebarOverlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('open');
});

// --- Page Navigation ---
const navLinks = document.querySelectorAll('.sidebar__link');
const pages = document.querySelectorAll('.admin-page');
let currentPage = 'overview';

navLinks.forEach(link => {
    link.addEventListener('click', () => {
        const page = link.dataset.page;
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        pages.forEach(p => p.style.display = 'none');
        document.getElementById(`page-${page}`).style.display = 'block';
        currentPage = page;
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('open');
        renderCurrentPage();
    });
});

// --- Helper ---
function getWeekDates() {
    const dates = [];
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    for (let i = 0; i < 7; i++) {
        const date = new Date(d);
        date.setDate(diff + i);
        dates.push(date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0'));
    }
    return dates;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ==========================================
// OVERVIEW
// ==========================================
function renderOverview() {
    const today = todayStr();
    document.getElementById('overviewDate').textContent = formatDate(today);

    const allBookings = getBookings();
    const todayBookings = allBookings.filter(b => b.date === today);
    const paidToday = todayBookings.filter(b => b.status === 'Paid');
    const revenueToday = paidToday.reduce((s, b) => s + (b.price || 0), 0);
    const pendingToday = todayBookings.filter(b => b.status !== 'Paid').length;

    document.getElementById('overviewStats').innerHTML = `
    <div class="stat-card">
      <span class="stat-card__label">Today's Cars</span>
      <span class="stat-card__value">${todayBookings.length}</span>
    </div>
    <div class="stat-card">
      <span class="stat-card__label">Revenue Today</span>
      <span class="stat-card__value" style="color:var(--accent-green);">RM ${revenueToday}</span>
    </div>
    <div class="stat-card">
      <span class="stat-card__label">Completed</span>
      <span class="stat-card__value">${paidToday.length}</span>
    </div>
    <div class="stat-card">
      <span class="stat-card__label">In Progress</span>
      <span class="stat-card__value" style="color:var(--accent-primary);">${pendingToday}</span>
    </div>
  `;

    // Weekly chart
    const weekDates = getWeekDates();
    const weekData = weekDates.map(date => {
        const dayBookings = allBookings.filter(b => b.date === date && b.status === 'Paid');
        return dayBookings.reduce((s, b) => s + (b.price || 0), 0);
    });
    const maxVal = Math.max(...weekData, 1);

    document.getElementById('overviewChart').innerHTML = weekDates.map((date, i) => `
    <div class="chart-bar-wrapper">
      <div class="chart-bar" style="height:${Math.max((weekData[i] / maxVal) * 100, 2)}%;">
        <span class="chart-bar__value">RM ${weekData[i]}</span>
      </div>
      <span class="chart-bar__label">${DAY_NAMES[i]}</span>
    </div>
  `).join('');
}

// ==========================================
// REPORTS
// ==========================================
function renderReports() {
    const from = document.getElementById('reportFrom').value;
    const to = document.getElementById('reportTo').value;

    let bookings = getBookings().filter(b => b.status === 'Paid');
    if (from) bookings = bookings.filter(b => b.date >= from);
    if (to) bookings = bookings.filter(b => b.date <= to);

    bookings.sort((a, b) => b.date.localeCompare(a.date));

    const totalRevenue = bookings.reduce((s, b) => s + (b.price || 0), 0);
    const cashTotal = bookings.filter(b => b.paymentMethod === 'Cash').reduce((s, b) => s + (b.price || 0), 0);
    const ewalletTotal = bookings.filter(b => b.paymentMethod === 'E-Wallet').reduce((s, b) => s + (b.price || 0), 0);

    document.getElementById('reportStats').innerHTML = `
    <div class="stat-card">
      <span class="stat-card__label">Total Revenue</span>
      <span class="stat-card__value" style="color:var(--accent-green);">RM ${totalRevenue}</span>
    </div>
    <div class="stat-card">
      <span class="stat-card__label">Total Washes</span>
      <span class="stat-card__value">${bookings.length}</span>
    </div>
    <div class="stat-card">
      <span class="stat-card__label">Cash</span>
      <span class="stat-card__value">RM ${cashTotal}</span>
    </div>
    <div class="stat-card">
      <span class="stat-card__label">E-Wallet</span>
      <span class="stat-card__value">RM ${ewalletTotal}</span>
    </div>
  `;

    document.getElementById('reportTable').innerHTML = bookings.length === 0
        ? '<tr><td colspan="6" style="text-align:center; padding:var(--space-8); color:var(--text-muted);">No records found</td></tr>'
        : bookings.map(b => `
    <tr>
      <td><strong>${b.plateNumber}</strong></td>
      <td>${b.packageName}</td>
      <td>RM ${b.price}</td>
      <td>${b.paymentMethod || '-'}</td>
      <td>${formatDate(b.date)}</td>
      <td><span class="badge badge--paid">Paid</span></td>
    </tr>
  `).join('');
}

document.getElementById('reportFilter').addEventListener('click', renderReports);

// Set default report range (this month)
const now = new Date();
document.getElementById('reportFrom').value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01';
document.getElementById('reportTo').value = todayStr();

// ==========================================
// SERVICES
// ==========================================
function renderServices() {
    const packages = getPackages();
    document.getElementById('servicesTable').innerHTML = packages.map(pkg => `
    <tr>
      <td>${pkg.icon}</td>
      <td><strong>${pkg.name}</strong><br><span style="font-size:var(--font-size-xs); color:var(--text-muted);">${pkg.desc}</span></td>
      <td>RM ${pkg.prices.Sedan}</td>
      <td>RM ${pkg.prices.SUV}</td>
      <td>RM ${pkg.prices.MPV}</td>
      <td>RM ${pkg.prices['Luxury/Large']}</td>
      <td><span class="badge ${pkg.active ? 'badge--completed' : 'badge--pending'}">${pkg.active ? 'Active' : 'Inactive'}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn btn--ghost btn--sm" onclick="window.editService('${pkg.id}')">Edit</button>
          <button class="btn btn--ghost btn--sm" style="color:var(--accent-red);" onclick="window.toggleService('${pkg.id}')">
            ${pkg.active ? 'Disable' : 'Enable'}
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Service CRUD
const serviceModal = document.getElementById('serviceModal');
const serviceForm = document.getElementById('serviceForm');

document.getElementById('addServiceBtn').addEventListener('click', () => {
    document.getElementById('serviceModalTitle').textContent = 'Add Package';
    document.getElementById('svcEditId').value = '';
    serviceForm.reset();
    serviceModal.classList.add('open');
});

window.editService = function (id) {
    const pkg = getPackages().find(p => p.id === id);
    if (!pkg) return;
    document.getElementById('serviceModalTitle').textContent = 'Edit Package';
    document.getElementById('svcEditId').value = id;
    document.getElementById('svcName').value = pkg.name;
    document.getElementById('svcIcon').value = pkg.icon;
    document.getElementById('svcDesc').value = pkg.desc;
    document.getElementById('svcSedan').value = pkg.prices.Sedan;
    document.getElementById('svcSUV').value = pkg.prices.SUV;
    document.getElementById('svcMPV').value = pkg.prices.MPV;
    document.getElementById('svcLuxury').value = pkg.prices['Luxury/Large'];
    serviceModal.classList.add('open');
};

window.toggleService = function (id) {
    const packages = getPackages();
    const idx = packages.findIndex(p => p.id === id);
    if (idx !== -1) {
        packages[idx].active = !packages[idx].active;
        savePackages(packages);
        renderServices();
        showToast(`Package ${packages[idx].active ? 'enabled' : 'disabled'}`, 'success');
    }
};

serviceForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const editId = document.getElementById('svcEditId').value;
    const packages = getPackages();
    const data = {
        name: document.getElementById('svcName').value.trim(),
        icon: document.getElementById('svcIcon').value.trim() || '🚗',
        desc: document.getElementById('svcDesc').value.trim(),
        prices: {
            Sedan: parseInt(document.getElementById('svcSedan').value) || 0,
            SUV: parseInt(document.getElementById('svcSUV').value) || 0,
            MPV: parseInt(document.getElementById('svcMPV').value) || 0,
            'Luxury/Large': parseInt(document.getElementById('svcLuxury').value) || 0,
        },
        active: true,
    };

    if (editId) {
        const idx = packages.findIndex(p => p.id === editId);
        if (idx !== -1) {
            packages[idx] = { ...packages[idx], ...data };
        }
    } else {
        data.id = generateId();
        packages.push(data);
    }
    savePackages(packages);
    serviceModal.classList.remove('open');
    renderServices();
    showToast('Package saved ✓', 'success');
});

// ==========================================
// SETTINGS
// ==========================================
function renderSettings() {
    const settings = getSettings();
    document.getElementById('settOpen').value = settings.operatingHours.open;
    document.getElementById('settClose').value = settings.operatingHours.close;
    document.getElementById('settMaxCars').value = settings.maxCarsPerSlot;
    document.getElementById('settSlotDuration').value = settings.slotDurationMinutes;
}

document.getElementById('saveSettingsBtn').addEventListener('click', () => {
    saveSettings({
        operatingHours: {
            open: document.getElementById('settOpen').value,
            close: document.getElementById('settClose').value,
        },
        maxCarsPerSlot: parseInt(document.getElementById('settMaxCars').value) || 4,
        slotDurationMinutes: parseInt(document.getElementById('settSlotDuration').value) || 60,
    });
    showToast('Settings saved ✓', 'success');
});

// ==========================================
// HISTORY
// ==========================================
let pendingDeleteId = null;
const deleteModal = document.getElementById('deleteModal');

function renderHistory() {
    let bookings = getBookings();
    const search = document.getElementById('historySearch').value.trim().toUpperCase();
    if (search) {
        bookings = bookings.filter(b => b.plateNumber.replace(/\s/g, '').includes(search.replace(/\s/g, '')));
    }
    bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    document.getElementById('historyTable').innerHTML = bookings.length === 0
        ? '<tr><td colspan="7" style="text-align:center; padding:var(--space-8); color:var(--text-muted);">No records found</td></tr>'
        : bookings.map(b => `
    <tr>
      <td><strong>${b.plateNumber}</strong></td>
      <td>${b.customerName || '-'}</td>
      <td>${b.packageName}</td>
      <td>RM ${b.price}</td>
      <td>${formatDate(b.date)}</td>
      <td><span class="badge badge--${b.status.toLowerCase()}">${b.status}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn btn--ghost btn--sm" style="color:var(--accent-red);" onclick="window.deleteRecord('${b.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

document.getElementById('historySearch')?.addEventListener('input', function () {
    this.value = this.value.toUpperCase();
    renderHistory();
});

window.deleteRecord = function (id) {
    pendingDeleteId = id;
    deleteModal.classList.add('open');
};

document.getElementById('confirmDelete').addEventListener('click', () => {
    if (pendingDeleteId) {
        deleteBooking(pendingDeleteId);
        pendingDeleteId = null;
        deleteModal.classList.remove('open');
        renderHistory();
        renderOverview();
        showToast('Record deleted', 'success');
    }
});

// --- Logout ---
document.getElementById('logoutBtn').addEventListener('click', () => {
    logout();
    window.location.href = '/pages/login.html';
});

// --- Render Current Page ---
function renderCurrentPage() {
    switch (currentPage) {
        case 'overview': renderOverview(); break;
        case 'reports': renderReports(); break;
        case 'services': renderServices(); break;
        case 'settings': renderSettings(); break;
        case 'history': renderHistory(); break;
    }
}

// Initial render
renderCurrentPage();
