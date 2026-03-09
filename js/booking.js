import { getPackages, getAvailableSlots, addBooking, formatTime, formatDate, todayStr, showToast } from './store.js';

const form = document.getElementById('bookingForm');
const pkgContainer = document.getElementById('servicePackages');
const vehicleSelect = document.getElementById('vehicleType');
const dateInput = document.getElementById('bookingDate');
const timeslotGroup = document.getElementById('timeslotGroup');
const timeslotGrid = document.getElementById('timeslotGrid');
const priceSummary = document.getElementById('priceSummary');
const priceDisplay = document.getElementById('priceDisplay');
const plateInput = document.getElementById('plateNumber');

let selectedPackage = null;
let selectedSlot = null;
let packagesCache = [];

// Set min date to today
dateInput.min = todayStr();
dateInput.value = todayStr();

// Auto-uppercase plate
plateInput.addEventListener('input', () => {
  plateInput.value = plateInput.value.toUpperCase();
});

// Render service packages
async function renderPackages() {
  packagesCache = (await getPackages()).filter(p => p.active);
  const vehicleType = vehicleSelect.value || 'Sedan';

  pkgContainer.innerHTML = packagesCache.map(pkg => `
    <label class="service-card ${selectedPackage === pkg.id ? 'selected' : ''}" data-pkg="${pkg.id}">
      <input type="radio" name="servicePackage" value="${pkg.id}" ${selectedPackage === pkg.id ? 'checked' : ''}>
      <div class="service-card__icon">${pkg.icon}</div>
      <div class="service-card__name">${pkg.name}</div>
      <div class="service-card__desc">${pkg.desc}</div>
      <div class="service-card__price">RM ${pkg.prices[vehicleType] || pkg.prices['Sedan']}</div>
    </label>
  `).join('');

  pkgContainer.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('click', () => {
      selectedPackage = card.dataset.pkg;
      renderPackages();
      updatePrice();
    });
  });
}

// Render time slots
async function renderSlots() {
  const date = dateInput.value;
  if (!date) return;

  const slots = await getAvailableSlots(date);
  timeslotGroup.style.display = 'block';

  timeslotGrid.innerHTML = slots.map(slot => `
    <div class="timeslot ${!slot.available ? 'timeslot--full' : ''} ${selectedSlot === slot.time ? 'selected' : ''}"
         data-time="${slot.time}" ${!slot.available ? 'data-full="true"' : ''}>
      ${slot.label}
    </div>
  `).join('');

  timeslotGrid.querySelectorAll('.timeslot:not(.timeslot--full)').forEach(el => {
    el.addEventListener('click', () => {
      selectedSlot = el.dataset.time;
      renderSlots();
    });
  });
}

// Update price
function updatePrice() {
  if (!selectedPackage || !vehicleSelect.value) {
    priceSummary.style.display = 'none';
    return;
  }
  const pkg = packagesCache.find(p => p.id === selectedPackage);
  if (!pkg) return;
  const price = pkg.prices[vehicleSelect.value] || pkg.prices['Sedan'];
  priceDisplay.textContent = `RM ${price}`;
  priceSummary.style.display = 'block';
}

// Events
vehicleSelect.addEventListener('change', () => {
  renderPackages();
  updatePrice();
});
dateInput.addEventListener('change', () => {
  selectedSlot = null;
  renderSlots();
});

// Initial render
renderPackages();
renderSlots();

// Submit
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!selectedPackage) {
    showToast('Please select a service package.', 'error');
    return;
  }
  if (!selectedSlot) {
    showToast('Please select a time slot.', 'error');
    return;
  }

  const pkg = packagesCache.find(p => p.id === selectedPackage);
  const price = pkg.prices[vehicleSelect.value] || pkg.prices['Sedan'];

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Booking...';

  const booking = await addBooking({
    plateNumber: plateInput.value.trim().toUpperCase(),
    vehicleType: vehicleSelect.value,
    packageId: pkg.id,
    packageName: pkg.name,
    date: dateInput.value,
    timeSlot: selectedSlot,
    customerName: document.getElementById('customerName').value.trim(),
    customerPhone: document.getElementById('customerPhone').value.trim(),
    price,
    status: 'Pending',
    paymentMethod: null,
  });

  submitBtn.disabled = false;
  submitBtn.textContent = 'Book Now';

  if (!booking) {
    showToast('Failed to create booking. Please try again.', 'error');
    return;
  }

  // Show confirmation modal
  const confirmBody = document.getElementById('confirmBody');
  confirmBody.innerHTML = `
    <p>Your booking has been confirmed!</p>
    <div style="margin-top:var(--space-4); padding:var(--space-4); background:var(--bg-surface); border-radius:var(--radius-md); text-align:left;">
      <div style="margin-bottom:8px;"><strong>${booking.plateNumber}</strong></div>
      <div style="font-size:var(--font-size-sm); color:var(--text-secondary);">
        ${pkg.name} · ${booking.vehicleType}<br>
        ${formatDate(booking.date)} at ${formatTime(booking.timeSlot)}<br>
        <strong>RM ${price}</strong>
      </div>
    </div>
    <p style="margin-top:var(--space-4); font-size:var(--font-size-sm); color:var(--text-muted);">
      Look up your booking anytime using your plate number.
    </p>
  `;
  document.getElementById('confirmModal').classList.add('open');

  // Reset form
  form.reset();
  selectedPackage = null;
  selectedSlot = null;
  dateInput.value = todayStr();
  dateInput.min = todayStr();
  priceSummary.style.display = 'none';
  renderPackages();
  renderSlots();
});
