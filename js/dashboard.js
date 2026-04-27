import {
  requireAuth, logout,
  getBookings, getBookingsByDate, addBooking, updateBooking, getPackages,
  todayStr, formatDate, formatTime, showToast,
  STATUS_FLOW, getNextStatus, statusToClass, escapeHtml
} from './store.js';

(async () => {
  const session = await requireAuth('worker');
  if (!session) return;

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
  let todayBookings = [];

  const today = todayStr();
  dashDate.textContent = formatDate(today);

  // Populate walk-in package dropdown
  async function populatePackages() {
    const packages = (await getPackages()).filter(p => p.active);
    walkinPackage.innerHTML = packages.map(p =>
      `<option value="${p.id}">${p.name}</option>`
    ).join('');
  }
  await populatePackages();

  // Auto-uppercase
  walkinPlate.addEventListener('input', () => {
    walkinPlate.value = walkinPlate.value.toUpperCase();
  });
  searchInput.addEventListener('input', () => {
    searchInput.value = searchInput.value.toUpperCase();
    renderQueue();
  });

  // Fetch today's bookings from DB
  async function fetchTodayBookings() {
    todayBookings = await getBookingsByDate(today);
  }

  // Render tabs
  function renderTabs() {
    const counts = { All: todayBookings.length };
    STATUS_FLOW.forEach(s => {
      counts[s] = todayBookings.filter(b => b.status === s).length;
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
    let bookings = [...todayBookings];

    if (activeFilter !== 'All') {
      bookings = bookings.filter(b => b.status === activeFilter);
    }

    const search = searchInput.value.trim();
    if (search) {
      bookings = bookings.filter(b =>
        b.plateNumber.replace(/\s/g, '').includes(search.replace(/\s/g, ''))
      );
    }

    const statusOrder = { Pending: 0, Arrived: 1, Washing: 2, Completed: 3, Paid: 4 };
    bookings.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    dashCount.innerHTML = `<strong>${todayBookings.length}</strong> cars today`;

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
              <div class="queue-card__plate">${escapeHtml(b.plateNumber)}</div>
              <div class="queue-card__service"><strong>${escapeHtml(b.packageName)}</strong> · RM ${b.price}</div>
            </div>
            <div class="queue-card__meta">
              <span class="queue-card__tag">${escapeHtml(b.vehicleType)}</span>
              <span class="badge badge--${statusToClass(b.status)}">${b.status}</span>
            </div>
          </div>
          <div class="queue-card__info">
            <span class="queue-card__info-item">🕐 ${formatTime(b.timeSlot)}</span>
            ${b.customerName ? `<span class="queue-card__info-item">👤 ${escapeHtml(b.customerName)}</span>` : ''}
            ${b.customerPhone ? `<span class="queue-card__info-item">📞 ${escapeHtml(b.customerPhone)}</span>` : ''}
          </div>
          ${nextStatus ? `
            <div class="queue-card__actions">
              <button class="status-btn ${nextBtnClass}" data-id="${b.id}" data-next="${nextStatus}">
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

    // Attach status button handlers
    queueList.querySelectorAll('.status-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const nextStatus = btn.dataset.next;
        await advanceStatus(id, nextStatus);
      });
    });
  }

  // Advance status
  async function advanceStatus(id, newStatus) {
    if (newStatus === 'Paid') {
      pendingPaymentId = id;
      const booking = todayBookings.find(b => b.id === id);
      paymentInfo.innerHTML = `<strong>${escapeHtml(booking.plateNumber)}</strong> — ${escapeHtml(booking.packageName)}<br>Amount: <strong>RM ${booking.price}</strong>`;
      paymentModal.classList.add('open');

      paymentModal.querySelectorAll('.service-card').forEach(card => {
        card.addEventListener('click', () => {
          paymentModal.querySelectorAll('.service-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          card.querySelector('input').checked = true;
        });
      });
      return;
    }

    await updateBooking(id, { status: newStatus });
    showToast(`Updated to ${newStatus}`, 'success');
    await fetchTodayBookings();
    renderTabs();
    renderQueue();
  }

  // Payment modal handlers
  document.getElementById('cancelPayment').addEventListener('click', () => {
    paymentModal.classList.remove('open');
    pendingPaymentId = null;
  });

  document.getElementById('confirmPayment').addEventListener('click', async () => {
    if (!pendingPaymentId) return;
    const method = paymentModal.querySelector('input[name="paymentMethod"]:checked')?.value || 'Cash';
    await updateBooking(pendingPaymentId, {
      status: 'Paid',
      paymentMethod: method,
      paidAt: new Date().toISOString()
    });
    paymentModal.classList.remove('open');
    pendingPaymentId = null;
    showToast('Payment confirmed ✓', 'success');
    await fetchTodayBookings();
    renderTabs();
    renderQueue();
  });

  // Walk-in
  function openWalkin() { walkinOverlay.classList.add('open'); }
  function closeWalkin() { walkinOverlay.classList.remove('open'); }

  fabBtn.addEventListener('click', openWalkin);
  walkinOverlay.addEventListener('click', (e) => {
    if (e.target === walkinOverlay) closeWalkin();
  });
  document.getElementById('bottomNavWalkin')?.addEventListener('click', openWalkin);

  walkinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const packages = await getPackages();
    const pkg = packages.find(p => p.id === walkinPackage.value);
    const vehicleType = document.getElementById('walkinVehicle').value;
    const price = pkg.prices[vehicleType] || pkg.prices['Sedan'];

    const now = new Date();
    const h = now.getHours().toString().padStart(2, '0');
    const timeSlot = `${h}:00`;

    await addBooking({
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
    await fetchTodayBookings();
    renderTabs();
    renderQueue();
  });

  // Logout
  logoutBtn.addEventListener('click', async () => { await logout(); window.location.href = '/pages/login.html'; });
  document.getElementById('bottomNavLogout')?.addEventListener('click', async () => { await logout(); window.location.href = '/pages/login.html'; });

  // Initial render
  await fetchTodayBookings();
  renderTabs();
  renderQueue();

  // Auto refresh every 15s
  setInterval(async () => {
    await fetchTodayBookings();
    renderTabs();
    renderQueue();
  }, 15000);
})();
