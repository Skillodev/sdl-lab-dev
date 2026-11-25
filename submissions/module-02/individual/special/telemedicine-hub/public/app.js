/**
 * MedBridge Telemedicine Hub — Low-Bandwidth 3-Screen Client Controller
 * Wired to Express API: POST /api/triage, POST /api/bookings, GET /api/bookings
 */

(() => {
  const SLOTS = [
    {
      label: 'Today, 2:15 PM (In 25m) — Dr. Amara Okafor (Urgent Care · Video)',
      time: 'Today, 2:15 PM (In 25 mins)',
      clinician: 'Dr. Amara Okafor · Urgent Care',
      modality: 'video',
      priorityMatch: ['YELLOW']
    },
    {
      label: 'Today, 3:00 PM — Dr. Samuel Adeyemi (Internal Med · Low-BW Audio)',
      time: 'Today, 3:00 PM',
      clinician: 'Dr. Samuel Adeyemi · Internal Medicine',
      modality: 'audio',
      priorityMatch: ['YELLOW', 'GREEN']
    },
    {
      label: 'Today, 1:45 PM — Dr. Priya Nair (Urgent Care · Audio)',
      time: 'Today, 1:45 PM',
      clinician: 'Dr. Priya Nair · Urgent Care',
      modality: 'audio',
      priorityMatch: ['YELLOW'],
      presetBooked: true
    },
    {
      label: 'Today, 4:30 PM — Dr. Elena Rostova (General Practice · Video)',
      time: 'Today, 4:30 PM',
      clinician: 'Dr. Elena Rostova · General Practice',
      modality: 'video',
      priorityMatch: ['GREEN', 'YELLOW']
    },
    {
      label: 'Tomorrow, 9:30 AM — Dr. David Chen (Family Med · SMS / Chat)',
      time: 'Tomorrow, 9:30 AM',
      clinician: 'Dr. David Chen · Family Medicine',
      modality: 'chat',
      priorityMatch: ['GREEN']
    }
  ];

  const PRIORITY_META = {
    RED: {
      badgeClass: 'badge--red',
      bannerClass: 'traffic-banner--red',
      pill: 'RED · EMERGENCY',
      window: 'Immediate (0 min)',
      title: 'Emergency — Seek Immediate Care or Call 911 / 112'
    },
    YELLOW: {
      badgeClass: 'badge--yellow',
      bannerClass: 'traffic-banner--yellow',
      pill: 'YELLOW · URGENT',
      window: 'Within 2 hours',
      title: 'Urgent — Priority Teleconsult Within 2 Hours'
    },
    GREEN: {
      badgeClass: 'badge--green',
      bannerClass: 'traffic-banner--green',
      pill: 'GREEN · ROUTINE',
      window: 'Standard Appointment',
      title: 'Routine — Standard Appointment Booking Available'
    }
  };

  const state = {
    step: 1,
    triage: null,
    phone: '',
    symptoms: [],
    modality: 'all',
    selectedSlot: null,
    bookings: []
  };

  // Navigation buttons & views
  const navStep1 = document.getElementById('nav-step-1');
  const navStep2 = document.getElementById('nav-step-2');
  const navStep3 = document.getElementById('nav-step-3');
  const viewIntake = document.getElementById('view-intake');
  const viewResult = document.getElementById('view-result');
  const viewBooking = document.getElementById('view-booking');

  // View 1 elements
  const triageForm = document.getElementById('triage-form');
  const intakeError = document.getElementById('intake-error');
  const patientNameInput = document.getElementById('patientName');
  const patientPhoneInput = document.getElementById('patientPhone');
  const extraNotesInput = document.getElementById('extraNotes');
  const symptomChips = Array.from(document.querySelectorAll('#symptom-chips .symptom-chip'));
  const selectedCountEl = document.getElementById('selected-count');
  const checkUrgencyBtn = document.getElementById('check-urgency-btn');
  const resetTriageBtn = document.getElementById('reset-triage-btn');

  // View 2 elements
  const resultTierBadge = document.getElementById('result-tier-badge');
  const resultBanner = document.getElementById('result-banner');
  const resultPill = document.getElementById('result-pill');
  const resultWindow = document.getElementById('result-window');
  const resultTitle = document.getElementById('result-title');
  const resultAction = document.getElementById('result-action');
  const resPatient = document.getElementById('res-patient');
  const resPhone = document.getElementById('res-phone');
  const resSymptoms = document.getElementById('res-symptoms');
  const resBookingStatus = document.getElementById('res-booking-status');
  const redActions = document.getElementById('red-actions');
  const proceedActions = document.getElementById('proceed-actions');
  const goToBookingBtn = document.getElementById('go-to-booking-btn');
  const editIntakeBtn = document.getElementById('edit-intake-btn');

  // View 3 elements
  const bookingPriorityBadge = document.getElementById('booking-priority-badge');
  const bookingSubtitle = document.getElementById('booking-subtitle');
  const bookingError = document.getElementById('booking-error');
  const filterTabs = Array.from(document.querySelectorAll('.filter-tab'));
  const slotsGrid = document.getElementById('slots-grid');
  const confirmBookingBtn = document.getElementById('confirm-booking-btn');
  const backToResultBtn = document.getElementById('back-to-result-btn');
  const selectedSlotHint = document.getElementById('selected-slot-hint');

  // Receipt & Queue elements
  const receiptCard = document.getElementById('receipt-card');
  const receiptIdBadge = document.getElementById('receipt-id-badge');
  const rcptPatient = document.getElementById('rcpt-patient');
  const rcptPriority = document.getElementById('rcpt-priority');
  const rcptSlot = document.getElementById('rcpt-slot');
  const rcptStatus = document.getElementById('rcpt-status');
  const rcptPhone = document.getElementById('rcpt-phone');
  const queueCountBadge = document.getElementById('queue-count-badge');
  const queueList = document.getElementById('queue-list');

  function showError(el, msg) {
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function clearError(el) {
    el.textContent = '';
    el.classList.add('hidden');
  }

  function setActiveStep(step) {
    state.step = step;
    viewIntake.classList.toggle('hidden', step !== 1);
    viewResult.classList.toggle('hidden', step !== 2);
    viewBooking.classList.toggle('hidden', step !== 3);

    const navs = [navStep1, navStep2, navStep3];
    navs.forEach((btn, idx) => {
      const n = idx + 1;
      btn.classList.toggle('is-done', n < step);
      if (n === step) {
        btn.setAttribute('aria-current', 'step');
      } else {
        btn.removeAttribute('aria-current');
      }
    });

    navStep2.disabled = !state.triage;
    navStep3.disabled = !(state.triage && state.triage.allowOnlineBooking);
  }

  function getSelectedChipSymptoms() {
    return symptomChips
      .filter((chip) => chip.getAttribute('aria-pressed') === 'true')
      .map((chip) => chip.dataset.symptom);
  }

  function updateChipCount() {
    const count = getSelectedChipSymptoms().length;
    selectedCountEl.textContent = `${count} selected`;
  }

  function isSlotBooked(slot) {
    return Boolean(slot.presetBooked || state.bookings.some((b) => b.slot === slot.label));
  }

  function renderResultView() {
    const triage = state.triage;
    if (!triage) return;
    const meta = PRIORITY_META[triage.priority] || PRIORITY_META.GREEN;

    resultTierBadge.className = `badge ${meta.badgeClass}`;
    resultTierBadge.textContent = triage.priority;

    resultBanner.className = `traffic-banner ${meta.bannerClass}`;
    resultPill.className = `badge ${meta.badgeClass}`;
    resultPill.textContent = meta.pill;
    resultWindow.textContent = meta.window;
    resultTitle.textContent = meta.title;
    resultAction.textContent = triage.action;

    resPatient.textContent = triage.patientName;
    resPhone.textContent = state.phone;
    resSymptoms.textContent = state.symptoms.join(', ');

    if (triage.allowOnlineBooking) {
      resBookingStatus.className = 'badge badge--green';
      resBookingStatus.textContent = 'Enabled';
      redActions.classList.add('hidden');
      proceedActions.classList.remove('hidden');
    } else {
      resBookingStatus.className = 'badge badge--red';
      resBookingStatus.textContent = 'Disabled (ER Only)';
      redActions.classList.remove('hidden');
      proceedActions.classList.add('hidden');
    }
  }

  function renderSlots() {
    slotsGrid.innerHTML = '';
    const priority = state.triage ? state.triage.priority : 'GREEN';
    const meta = PRIORITY_META[priority] || PRIORITY_META.GREEN;

    bookingPriorityBadge.className = `badge ${meta.badgeClass}`;
    bookingPriorityBadge.textContent = `${priority} Priority`;
    bookingSubtitle.textContent =
      priority === 'YELLOW'
        ? 'Priority slots within 2 hours are highlighted first for urgent care.'
        : 'Select any available video, low-bandwidth audio, or SMS/chat appointment slot.';

    const filtered = SLOTS.filter((s) =>
      state.modality === 'all' ? true : s.modality === state.modality
    ).sort((a, b) => {
      const ab = isSlotBooked(a);
      const bb = isSlotBooked(b);
      if (ab !== bb) return ab ? 1 : -1;
      const ar = a.priorityMatch.includes(priority);
      const br = b.priorityMatch.includes(priority);
      if (ar !== br) return ar ? -1 : 1;
      return 0;
    });

    filtered.forEach((slot) => {
      const booked = isSlotBooked(slot);
      const priorityMatch = slot.priorityMatch.includes(priority);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slot-card';
      btn.disabled = booked;
      btn.setAttribute('aria-pressed', String(state.selectedSlot === slot.label));

      const top = document.createElement('div');
      top.className = 'slot-card__top';

      const timeEl = document.createElement('span');
      timeEl.className = 'slot-card__time';
      timeEl.textContent = slot.time;

      const badge = document.createElement('span');
      if (booked) {
        badge.className = 'badge badge--neutral';
        badge.textContent = 'Booked';
      } else if (priorityMatch) {
        badge.className = 'badge badge--accent';
        badge.textContent = 'Priority Match';
      } else {
        badge.className = 'badge badge--green';
        badge.textContent = 'Available';
      }

      top.append(timeEl, badge);

      const metaEl = document.createElement('span');
      metaEl.className = 'slot-card__meta';
      metaEl.textContent = `${slot.clinician} · ${slot.modality.toUpperCase()}`;

      btn.append(top, metaEl);

      if (!booked) {
        btn.addEventListener('click', () => {
          state.selectedSlot = slot.label;
          clearError(bookingError);
          renderSlots();
          confirmBookingBtn.disabled = false;
          selectedSlotHint.textContent = `Selected: ${slot.label}`;
        });
      }

      slotsGrid.appendChild(btn);
    });

    if (!state.selectedSlot || SLOTS.some((s) => s.label === state.selectedSlot && isSlotBooked(s))) {
      state.selectedSlot = null;
      confirmBookingBtn.disabled = true;
      selectedSlotHint.textContent = 'Tap an available time slot above to confirm your booking.';
    }
  }

  function renderReceipt(booking) {
    const meta = PRIORITY_META[booking.priority] || PRIORITY_META.GREEN;
    receiptCard.classList.remove('hidden');
    receiptIdBadge.textContent = booking.id;
    rcptPatient.textContent = booking.patientName;
    rcptPriority.className = `badge ${meta.badgeClass}`;
    rcptPriority.textContent = booking.priority;
    rcptSlot.textContent = booking.slot;
    rcptStatus.textContent = booking.status;
    rcptPhone.textContent = booking.phone;
  }

  function renderQueue() {
    queueCountBadge.textContent = `${state.bookings.length} Booked`;
    queueList.innerHTML = '';

    if (state.bookings.length === 0) {
      const li = document.createElement('li');
      li.className = 'queue-item';
      const label = document.createElement('span');
      label.textContent = 'No appointments booked yet.';
      const dash = document.createElement('span');
      dash.className = 'mono';
      dash.textContent = '—';
      li.append(label, dash);
      queueList.appendChild(li);
      return;
    }

    state.bookings.slice().reverse().forEach((b) => {
      const li = document.createElement('li');
      li.className = 'queue-item';
      const info = document.createElement('span');
      info.textContent = `${b.id} · ${b.patientName} (${b.slot})`;
      const badge = document.createElement('span');
      const meta = PRIORITY_META[b.priority] || PRIORITY_META.GREEN;
      badge.className = `badge ${meta.badgeClass}`;
      badge.textContent = b.priority;
      li.append(info, badge);
      queueList.appendChild(li);
    });
  }

  async function refreshQueue() {
    try {
      const res = await fetch('/api/bookings');
      if (!res.ok) return;
      const data = await res.json();
      state.bookings = data.bookings || [];
      renderQueue();
      if (state.step === 3) renderSlots();
    } catch {
      // Allow graceful offline resilience
    }
  }

  // Quick-select symptom chip handlers
  symptomChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const next = chip.getAttribute('aria-pressed') !== 'true';
      chip.setAttribute('aria-pressed', String(next));
      clearError(intakeError);
      updateChipCount();
    });
  });

  // View 1 -> POST /api/triage
  triageForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError(intakeError);

    const patientName = patientNameInput.value.trim();
    const phone = patientPhoneInput.value.trim();
    const selected = getSelectedChipSymptoms();
    const extra = extraNotesInput.value.trim();
    const symptoms = extra ? [...selected, extra] : selected;

    if (patientName.length < 2) {
      showError(intakeError, 'Please enter the patient full name.');
      return;
    }
    if (phone.length < 7) {
      showError(intakeError, 'Please enter a valid mobile number for your SMS receipt.');
      return;
    }
    if (symptoms.length === 0) {
      showError(intakeError, 'Please select at least one symptom chip or enter notes.');
      return;
    }

    checkUrgencyBtn.disabled = true;
    checkUrgencyBtn.textContent = 'Checking Urgency...';

    try {
      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientName, symptoms })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not evaluate symptoms.');

      state.triage = data;
      state.phone = phone;
      state.symptoms = symptoms;
      state.selectedSlot = null;

      renderResultView();
      setActiveStep(2);
    } catch (err) {
      showError(intakeError, err.message);
    } finally {
      checkUrgencyBtn.disabled = false;
      checkUrgencyBtn.textContent = 'Check Urgency';
    }
  });

  resetTriageBtn.addEventListener('click', () => {
    triageForm.reset();
    symptomChips.forEach((c) => c.setAttribute('aria-pressed', 'false'));
    updateChipCount();
    clearError(intakeError);
    clearError(bookingError);
    state.triage = null;
    state.phone = '';
    state.symptoms = [];
    state.selectedSlot = null;
    setActiveStep(1);
  });

  // Step navigation
  navStep1.addEventListener('click', () => setActiveStep(1));
  navStep2.addEventListener('click', () => { if (state.triage) setActiveStep(2); });
  navStep3.addEventListener('click', () => {
    if (state.triage && state.triage.allowOnlineBooking) {
      renderSlots();
      setActiveStep(3);
    }
  });

  editIntakeBtn.addEventListener('click', () => setActiveStep(1));
  backToResultBtn.addEventListener('click', () => setActiveStep(2));
  goToBookingBtn.addEventListener('click', () => {
    renderSlots();
    setActiveStep(3);
  });

  // Modality filter tabs
  filterTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      state.modality = tab.dataset.modality || 'all';
      filterTabs.forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
      renderSlots();
    });
  });

  // View 3 -> POST /api/bookings
  confirmBookingBtn.addEventListener('click', async () => {
    clearError(bookingError);
    if (!state.triage || !state.triage.allowOnlineBooking || !state.selectedSlot) return;

    confirmBookingBtn.disabled = true;
    confirmBookingBtn.textContent = 'Confirming...';

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: state.triage.patientName,
          phone: state.phone,
          priority: state.triage.priority,
          slot: state.selectedSlot
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not confirm booking.');

      renderReceipt(data.booking);
      state.selectedSlot = null;
      await refreshQueue();
    } catch (err) {
      showError(bookingError, err.message);
    } finally {
      confirmBookingBtn.textContent = 'Confirm Appointment';
      confirmBookingBtn.disabled = !state.selectedSlot;
    }
  });

  updateChipCount();
  setActiveStep(1);
  refreshQueue();
})();
