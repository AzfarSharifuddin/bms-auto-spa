import {
    initDefaults, requireAuth, logout,
    getBookings, addBooking, updateBooking, getPackages,
    todayStr, formatDate, formatTime, showToast,
    STATUS_FLOW, getNextStatus, statusToClass
} from './store.js';

initDefaults();
const session = requireAuth('worker');
if (!session) throw new Error('Not authenticated');

// Elements
const dashDate = document.getElementById('dashDate');
const dashCount = document.getElementById('dashCount');
const searchInput = document.getElementById('searchInput');
const queueTabs = document.getElementById('queueTabs');
const queueList = document.getElementById('queueList');
const fabBtn = document.getElementById('fabBtn');
const walkinOverlay = document.getElementById('walkinOverlay');
const walkinForm = document.getElementById('walkinForm');
const walkinPlate = document.getElementById('walkinPlate');
const walkinPackage = document.getElementById('walkinPackage');
const paymentModal = document.getElementById('paymentModal');
const paymentInfo = document.getElementById('paymentInfo');
const logoutBtn = document.getElementById('logoutBtn');

let activeFilter = 'All';
let pendingPaymentId = null;

// Set date
const today = todayStr();
dashDate.textContent = formatDate(today);

// Populate walk-in package dropdown
function populatePackages() {
    const packages = getPackages().filter(p => p.active);
    walkinPackage.innerHTML = packages.map(p =>
        `<option value="${p.id}">${p.name}</option>`
    ).join('');
}
populatePackages();

// Auto-uppercase
walkinPlate.addEventListener('input', () => {
    walkinPlate.value = walkinPlate.value.toUpperCase();
});
searchInput.addEventListener('input', () => {
    searchInput.value = searchInput.value.toUpperCase();
    renderQueue();
});

// Get today's bookings
function getTodayBookings() {
    return getBookings().filter(b => b.date === today);
}

// Render tabs
function renderTabs() {
    const bookings = getTodayBookings();
    const counts = { All: bookings.length };
    STATUS_FLOW.forEach(s => {
        counts[s] = bookings.filter(b => b.status === s).length;
    });

    const tabs = ['All', ...STATUS_FLOW];
    queueTabs.innerHTML = tabs.map(tab => `
    <button class="queue-tab ${activeFilter === tab ? 'active' : ''}" data-filter="${tab}">
      ${tab}
      <span class="queue-tab__count">${counts[tab] || 0}</span>
    </button>
  `).join('');

    queueTabs.querySelectorAll('.queue-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            activeFilter = btn.dataset.filter;
            renderTabs();
            renderQueue();
        });
    });
}

// Render queue cards
function renderQueue() {
    let bookings = getTodayBookings();

    // Filter by status
    if (activeFilter !== 'All') {
        bookings = bookings.filter(b => b.status === activeFilter);
    }

    // Filter by search
    const search = searchInput.value.trim();
    if (search) {
        bookings = bookings.filter(b =>
            b.plateNumber.replace(/\s/g, '').includes(search.replace(/\s/g, ''))
        );
    }

    // Sort: active first, then by creation
    const statusOrder = { Pending: 0, Arrived: 1, Washing: 2, Completed: 3, Paid: 4 };
    bookings.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    // Count
    dashCount.innerHTML = `<strong>${getTodayBookings().length}</strong> cars today`;

    if (bookings.length === 0) {
        queueList.innerHTML = `
      <div class="queue-empty">
        <div class="queue-empty__icon">🚗</div>
        <div class="queue-empty__text">${search ? 'No results found.' : 'No cars in the queue yet.'}</div>
      </div>
    `;
        return;
    }

    queueList.innerHTML = bookings.map(b => {
        const nextStatus = getNextStatus(b.status);
        const nextBtnClass = nextStatus ? `status-btn--${statusToClass(nextStatus)}` : '';

        return `
      <div class="queue-card" data-id="${b.id}">
        <div class="queue-card__top">
          <div>
            <div class="queue-card__plate">${b.plateNumber}</div>
            <div class="queue-card__service"><strong>${b.packageName}</strong> · RM ${b.price}</div>
          </div>
          <div class="queue-card__meta">
            <span class="queue-card__tag">${b.vehicleType}</span>
            <span class="badge badge--${statusToClass(b.status)}">${b.status}</span>
          </div>
        </div>
        <div class="queue-card__info">
          <span class="queue-card__info-item">🕐 ${formatTime(b.timeSlot)}</span>
          ${b.customerName ? `<span class="queue-card__info-item">👤 ${b.customerName}</span>` : ''}
          ${b.customerPhone ? `<span class="queue-card__info-item">📞 ${b.customerPhone}</span>` : ''}
        </div>
        ${nextStatus ? `
          <div class="queue-card__actions">
            <button class="status-btn ${nextBtnClass}" onclick="window.advanceStatus('${b.id}', '${nextStatus}')">
              → ${nextStatus}
            </button>
          </div>
        ` : `
          <div class="queue-card__actions">
            <span style="font-size:var(--font-size-sm); color:var(--accent-green); font-weight:600;">✓ Closed</span>
          </div>
        `}
      </div>
    `;
    }).join('');
}

// Advance status
window.advanceStatus = function (id, newStatus) {
    if (newStatus === 'Paid') {
        // Show payment method modal
        pendingPaymentId = id;
        const booking = getBookings().find(b => b.id === id);
        paymentInfo.innerHTML = `<strong>${booking.plateNumber}</strong> — ${booking.packageName}<br>Amount: <strong>RM ${booking.price}</strong>`;
        paymentModal.classList.add('open');

        // Payment card selection
        paymentModal.querySelectorAll('.service-card').forEach(card => {
            card.addEventListener('click', () => {
                paymentModal.querySelectorAll('.service-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                card.querySelector('input').checked = true;
            });
        });
        return;
    }

    updateBooking(id, { status: newStatus });
    showToast(`Updated to ${newStatus}`, 'success');
    renderTabs();
    renderQueue();
};

// Payment modal handlers
document.getElementById('cancelPayment').addEventListener('click', () => {
    paymentModal.classList.remove('open');
    pendingPaymentId = null;
});

document.getElementById('confirmPayment').addEventListener('click', () => {
    if (!pendingPaymentId) return;
    const method = paymentModal.querySelector('input[name="paymentMethod"]:checked')?.value || 'Cash';
    updateBooking(pendingPaymentId, {
        status: 'Paid',
        paymentMethod: method,
        paidAt: new Date().toISOString()
    });
    paymentModal.classList.remove('open');
    pendingPaymentId = null;
    showToast('Payment confirmed ✓', 'success');
    renderTabs();
    renderQueue();
});

// Walk-in
function openWalkin() {
    walkinOverlay.classList.add('open');
}
function closeWalkin() {
    walkinOverlay.classList.remove('open');
}

fabBtn.addEventListener('click', openWalkin);
walkinOverlay.addEventListener('click', (e) => {
    if (e.target === walkinOverlay) closeWalkin();
});
document.getElementById('bottomNavWalkin')?.addEventListener('click', openWalkin);

walkinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const packages = getPackages();
    const pkg = packages.find(p => p.id === walkinPackage.value);
    const vehicleType = document.getElementById('walkinVehicle').value;
    const price = pkg.prices[vehicleType] || pkg.prices['Sedan'];

    // Find current time slot (round to nearest hour)
    const now = new Date();
    const h = now.getHours().toString().padStart(2, '0');
    const timeSlot = `${h}:00`;

    addBooking({
        plateNumber: walkinPlate.value.trim().toUpperCase(),
        vehicleType,
        packageId: pkg.id,
        packageName: pkg.name,
        date: today,
        timeSlot,
        customerName: document.getElementById('walkinName').value.trim() || 'Walk-in',
        customerPhone: '',
        price,
        status: 'Arrived',
        paymentMethod: null,
    });

    showToast('Walk-in added ✓', 'success');
    walkinForm.reset();
    closeWalkin();
    renderTabs();
    renderQueue();
});

// Logout
logoutBtn.addEventListener('click', () => { logout(); window.location.href = '/pages/login.html'; });
document.getElementById('bottomNavLogout')?.addEventListener('click', () => { logout(); window.location.href = '/pages/login.html'; });

// Initial render
renderTabs();
renderQueue();

// Auto refresh every 15s
setInterval(() => { renderTabs(); renderQueue(); }, 15000);
