import {
  requireAuth, logout,
  getBookings, getBookingsByDate, deleteBooking, updateBooking,
  getPackages, savePackage, togglePackageActive,
  getSettings, saveSettings,
  todayStr, formatDate, formatTime, showToast, escapeHtml,
} from './store.js';

(async () => {
  const session = await requireAuth('admin');
  if (!session) return;

  // --- Elements ---
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const adminName = document.getElementById('adminName');
  const adminAvatar = document.getElementById('adminAvatar');

  adminName.textContent = session.name || session.username;
  adminAvatar.textContent = (session.name || session.username).charAt(0).toUpperCase();

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
    link.addEventListener('click', async () => {
      const page = link.dataset.page;
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      pages.forEach(p => p.style.display = 'none');
      document.getElementById(`page-${page}`).style.display = 'block';
      currentPage = page;
      sidebar.classList.remove('open');
      sidebarOverlay.classList.remove('open');
      await renderCurrentPage();
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
  async function renderOverview() {
    const today = todayStr();
    document.getElementById('overviewDate').textContent = formatDate(today);

    const allBookings = await getBookings();
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
  async function renderReports() {
    const from = document.getElementById('reportFrom').value;
    const to = document.getElementById('reportTo').value;

    let bookings = (await getBookings()).filter(b => b.status === 'Paid');
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
        <td><strong>${escapeHtml(b.plateNumber)}</strong></td>
        <td>${escapeHtml(b.packageName)}</td>
        <td>RM ${b.price}</td>
        <td>${escapeHtml(b.paymentMethod || '-')}</td>
        <td>${formatDate(b.date)}</td>
        <td><span class="badge badge--paid">Paid</span></td>
      </tr>
    `).join('');
  }

  document.getElementById('reportFilter').addEventListener('click', () => renderReports());

  const now = new Date();
  document.getElementById('reportFrom').value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01';
  document.getElementById('reportTo').value = todayStr();

  // ==========================================
  // SERVICES
  // ==========================================
  async function renderServices() {
    const packages = await getPackages();
    document.getElementById('servicesTable').innerHTML = packages.map(pkg => `
      <tr>
        <td>${escapeHtml(pkg.icon)}</td>
        <td><strong>${escapeHtml(pkg.name)}</strong><br><span style="font-size:var(--font-size-xs); color:var(--text-muted);">${escapeHtml(pkg.desc)}</span></td>
        <td>RM ${pkg.prices.Sedan}</td>
        <td>RM ${pkg.prices.SUV}</td>
        <td>RM ${pkg.prices.MPV}</td>
        <td>RM ${pkg.prices['Luxury/Large']}</td>
        <td><span class="badge ${pkg.active ? 'badge--completed' : 'badge--pending'}">${pkg.active ? 'Active' : 'Inactive'}</span></td>
        <td>
          <div class="table-actions">
            <button class="btn btn--ghost btn--sm svc-edit-btn" data-id="${pkg.id}">Edit</button>
            <button class="btn btn--ghost btn--sm svc-toggle-btn" style="color:var(--accent-red);" data-id="${pkg.id}" data-active="${pkg.active}">
              ${pkg.active ? 'Disable' : 'Enable'}
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    // Attach handlers
    document.querySelectorAll('.svc-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => editService(btn.dataset.id));
    });
    document.querySelectorAll('.svc-toggle-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const isActive = btn.dataset.active === 'true';
        await togglePackageActive(btn.dataset.id, !isActive);
        showToast(`Package ${!isActive ? 'enabled' : 'disabled'}`, 'success');
        await renderServices();
      });
    });
  }

  // Service CRUD
  const serviceModal = document.getElementById('serviceModal');
  const serviceForm = document.getElementById('serviceForm');
  let packagesCache = [];

  document.getElementById('addServiceBtn').addEventListener('click', () => {
    document.getElementById('serviceModalTitle').textContent = 'Add Package';
    document.getElementById('svcEditId').value = '';
    serviceForm.reset();
    serviceModal.classList.add('open');
  });

  async function editService(id) {
    packagesCache = await getPackages();
    const pkg = packagesCache.find(p => p.id === id);
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
  }

  serviceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('svcEditId').value;
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
    if (editId) data.id = editId;
    await savePackage(data);
    serviceModal.classList.remove('open');
    await renderServices();
    showToast('Package saved ✓', 'success');
  });

  // ==========================================
  // SETTINGS
  // ==========================================
  async function renderSettings() {
    const settings = await getSettings();
    document.getElementById('settOpen').value = settings.operatingHours.open;
    document.getElementById('settClose').value = settings.operatingHours.close;
    document.getElementById('settMaxCars').value = settings.maxCarsPerSlot;
    document.getElementById('settSlotDuration').value = settings.slotDurationMinutes;
  }

  document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    await saveSettings({
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

  async function renderHistory() {
    let bookings = await getBookings();
    const search = document.getElementById('historySearch').value.trim().toUpperCase();
    if (search) {
      bookings = bookings.filter(b => b.plateNumber.replace(/\s/g, '').includes(search.replace(/\s/g, '')));
    }
    bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    document.getElementById('historyTable').innerHTML = bookings.length === 0
      ? '<tr><td colspan="7" style="text-align:center; padding:var(--space-8); color:var(--text-muted);">No records found</td></tr>'
      : bookings.map(b => `
      <tr>
        <td><strong>${escapeHtml(b.plateNumber)}</strong></td>
        <td>${escapeHtml(b.customerName || '-')}</td>
        <td>${escapeHtml(b.packageName)}</td>
        <td>RM ${b.price}</td>
        <td>${formatDate(b.date)}</td>
        <td><span class="badge badge--${b.status.toLowerCase()}">${b.status}</span></td>
        <td>
          <div class="table-actions">
            <button class="btn btn--ghost btn--sm history-delete-btn" style="color:var(--accent-red);" data-id="${b.id}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');

    // Attach delete handlers
    document.querySelectorAll('.history-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        pendingDeleteId = btn.dataset.id;
        deleteModal.classList.add('open');
      });
    });
  }

  document.getElementById('historySearch')?.addEventListener('input', function () {
    this.value = this.value.toUpperCase();
    renderHistory();
  });

  document.getElementById('confirmDelete').addEventListener('click', async () => {
    if (pendingDeleteId) {
      await deleteBooking(pendingDeleteId);
      pendingDeleteId = null;
      deleteModal.classList.remove('open');
      await renderHistory();
      await renderOverview();
      showToast('Record deleted', 'success');
    }
  });

  // --- Logout ---
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await logout();
    window.location.href = '/pages/login.html';
  });

  // --- Render Current Page ---
  async function renderCurrentPage() {
    switch (currentPage) {
      case 'overview': await renderOverview(); break;
      case 'reports': await renderReports(); break;
      case 'services': await renderServices(); break;
      case 'settings': await renderSettings(); break;
      case 'history': await renderHistory(); break;
    }
  }

  // Initial render
  await renderCurrentPage();
})();
