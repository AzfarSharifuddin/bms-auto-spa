import { initDefaults, getBookings, formatDate, formatTime, STATUS_FLOW } from './store.js';

initDefaults();

const searchInput = document.getElementById('plateSearch');
const searchBtn = document.getElementById('searchBtn');
const resultDiv = document.getElementById('statusResult');

searchInput.addEventListener('input', () => {
    searchInput.value = searchInput.value.toUpperCase();
});

function search() {
    const plate = searchInput.value.trim().toUpperCase();
    if (!plate) return;

    const bookings = getBookings().filter(b =>
        b.plateNumber.replace(/\s/g, '') === plate.replace(/\s/g, '')
    );

    // Get the most recent booking
    const booking = bookings.length > 0
        ? bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
        : null;

    if (!booking) {
        resultDiv.innerHTML = `
      <div class="status-empty">
        <div class="status-empty__icon">🔍</div>
        <p class="status-empty__text">No booking found for <strong>${plate}</strong></p>
        <a href="/" class="btn btn--primary" style="margin-top: var(--space-2);">Book Now</a>
      </div>
    `;
        return;
    }

    const currentIdx = STATUS_FLOW.indexOf(booking.status);

    const trackerHTML = STATUS_FLOW.map((s, i) => {
        let dotClass = '';
        let nameClass = '';
        if (i < currentIdx) { dotClass = 'done'; nameClass = 'done'; }
        else if (i === currentIdx) { dotClass = 'active'; nameClass = 'active'; }
        return `
      <div class="status-tracker__step">
        <div class="status-tracker__dot ${dotClass}"></div>
        <div class="status-tracker__name ${nameClass}">${s}</div>
      </div>
    `;
    }).join('');

    resultDiv.innerHTML = `
    <div class="status-result">
      <div class="card">
        <div class="status-result__header">
          <div class="status-result__plate">${booking.plateNumber}</div>
          <span class="badge badge--${booking.status.toLowerCase()}">${booking.status}</span>
        </div>
        <div class="status-result__details">
          <div class="status-result__detail">
            <span class="status-result__label">Service</span>
            <span class="status-result__value">${booking.packageName}</span>
          </div>
          <div class="status-result__detail">
            <span class="status-result__label">Vehicle</span>
            <span class="status-result__value">${booking.vehicleType}</span>
          </div>
          <div class="status-result__detail">
            <span class="status-result__label">Date</span>
            <span class="status-result__value">${formatDate(booking.date)}</span>
          </div>
          <div class="status-result__detail">
            <span class="status-result__label">Time</span>
            <span class="status-result__value">${formatTime(booking.timeSlot)}</span>
          </div>
        </div>
        <div class="status-tracker">${trackerHTML}</div>
      </div>
    </div>
  `;
}

searchBtn.addEventListener('click', search);
searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') search();
});

// Auto-search if URL has ?plate= param
const params = new URLSearchParams(window.location.search);
if (params.get('plate')) {
    searchInput.value = params.get('plate').toUpperCase();
    search();
}
