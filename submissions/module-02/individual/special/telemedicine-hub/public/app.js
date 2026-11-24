/**
 * Telemedicine Triage & Patient Booking Hub — Client Controller
 * Handles triage form submission, red-flag handling, slot filtering/selection,
 * booking confirmation, and cancellation.
 */

(() => {
  const state = {
    triage: null,
    slots: [],
    selectedModality: 'all',
    selectedSlotId: null,
    booking: null
  };

  // DOM References
  const triageForm = document.getElementById('triage-form');
  const triageSubmitBtn = document.getElementById('triage-submit-btn');
  const triageResetBtn = document.getElementById('triage-reset-btn');
  const triageError = document.getElementById('triage-error');

  const severityInput = document.getElementById('severity');
  const severityBadge = document.getElementById('severity-badge');

  const step1 = document.getElementById('step-1');
  const step2 = document.getElementById('step-2');
  const step3 = document.getElementById('step-3');

  const resultTierBadge = document.getElementById('result-tier-badge');
  const triageEmptyState = document.getElementById('triage-empty-state');
  const triageResultPanel = document.getElementById('triage-result-panel');
  const triageAlertBox = document.getElementById('triage-alert-box');
  const triageActionTitle = document.getElementById('triage-action-title');
  const triageActionBody = document.getElementById('triage-action-body');
  const triageScoreValue = document.getElementById('triage-score-value');
  const triageScoreBar = document.getElementById('triage-score-bar');
  const triageScoreFill = document.getElementById('triage-score-fill');
  const triageWindowText = document.getElementById('triage-window-text');
  const triageSpecialtyText = document.getElementById('triage-specialty-text');
  const triageFactorsList = document.getElementById('triage-factors-list');

  const bookingSubtitle = document.getElementById('booking-subtitle');
  const bookingStepBadge = document.getElementById('booking-step-badge');
  const bookingLockedBanner = document.getElementById('booking-locked-banner');
  const bookingEmergencyBanner = document.getElementById('booking-emergency-banner');
  const bookingControls = document.getElementById('booking-controls');
  const filterTabs = Array.from(document.querySelectorAll('.filter-tab'));
  const slotsGrid = document.getElementById('slots-grid');

  const bookingForm = document.getElementById('booking-form');
  const bookingError = document.getElementById('booking-error');
  const patientEmailInput = document.getElementById('patientEmail');
  const patientPhoneInput = document.getElementById('patientPhone');
  const confirmBookingBtn = document.getElementById('confirm-booking-btn');
  const selectedSlotHint = document.getElementById('selected-slot-hint');

  const receiptCard = document.getElementById('receipt-card');
  const receiptDetails = document.getElementById('receipt-details');
  const cancelBookingBtn = document.getElementById('cancel-booking-btn');

  function updateStepper(activeStep) {
    const items = [step1, step2, step3];
    items.forEach((el, index) => {
      const stepNum = index + 1;
      el.classList.remove('is-current', 'is-complete');
      if (stepNum < activeStep) {
        el.classList.add('is-complete');
      } else if (stepNum === activeStep) {
        el.classList.add('is-current');
      }
    });
  }

  function updateSeverityBadge() {
    const val = Number(severityInput.value);
    severityBadge.className = 'badge';
    if (val >= 8) {
      severityBadge.classList.add('badge--emergency');
      severityBadge.textContent = `${val} / 10 — Severe`;
    } else if (val >= 5) {
      severityBadge.classList.add('badge--urgent');
      severityBadge.textContent = `${val} / 10 — Moderate-High`;
    } else if (val >= 3) {
      severityBadge.classList.add('badge--standard');
      severityBadge.textContent = `${val} / 10 — Moderate`;
    } else {
      severityBadge.classList.add('badge--routine');
      severityBadge.textContent = `${val} / 10 — Mild`;
    }
  }

  function showAlert(el, message) {
    el.textContent = message;
    el.classList.remove('hidden');
  }

  function clearAlert(el) {
    el.textContent = '';
    el.classList.add('hidden');
  }

  function tierKey(level) {
    return String(level || 'ROUTINE').toLowerCase();
  }

  function renderTriageResult(triage) {
    const key = tierKey(triage.level);

    triageEmptyState.classList.add('hidden');
    triageResultPanel.classList.remove('hidden');

    resultTierBadge.className = `badge badge--${key}`;
    resultTierBadge.textContent = triage.level;

    triageAlertBox.className = `alert alert--${key}`;
    triageActionTitle.textContent = triage.label;
    triageActionBody.textContent = triage.recommendedAction;

    triageScoreValue.textContent = `${triage.score} / 100`;
    triageScoreBar.setAttribute('aria-valuenow', String(triage.score));
    triageScoreFill.className = `score-bar__fill score-bar__fill--${key}`;
    triageScoreFill.style.width = `${triage.score}%`;

    triageWindowText.textContent = `Target Window: ${triage.targetWindow}`;
    triageSpecialtyText.textContent = `Recommended Pathway: ${triage.recommendedSpecialty}`;

    triageFactorsList.innerHTML = '';
    (triage.factors || []).forEach((factor) => {
      const li = document.createElement('li');
      li.className = 'factor-list__item';

      const labelSpan = document.createElement('span');
      labelSpan.textContent = factor.label;

      const impactSpan = document.createElement('span');
      impactSpan.className = 'factor-list__impact';
      impactSpan.textContent = factor.impact;

      li.append(labelSpan, impactSpan);
      triageFactorsList.appendChild(li);
    });
  }

  function updateBookingButtonState() {
    const hasSlot = Boolean(state.selectedSlotId);
    const hasEmail = patientEmailInput.value.trim().length > 3;
    const hasPhone = patientPhoneInput.value.trim().length >= 7;
    const allowed = Boolean(state.triage && state.triage.bookingAllowed);

    confirmBookingBtn.disabled = !(allowed && hasSlot && hasEmail && hasPhone);

    if (!hasSlot) {
      selectedSlotHint.textContent = 'Select an available slot above to enable booking.';
    } else {
      const slot = state.slots.find((s) => s.id === state.selectedSlotId);
      if (slot) {
        selectedSlotHint.textContent = `Selected: ${slot.clinician} — ${slot.time} (${slot.modality.toUpperCase()})`;
      }
    }
  }

  function renderSlots() {
    slotsGrid.innerHTML = '';

    if (state.slots.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'card__desc';
      emptyMsg.textContent = 'No consultation slots match this modality filter. Try switching to All Modalities.';
      slotsGrid.appendChild(emptyMsg);
      return;
    }

    state.slots.forEach((slot) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slot-card';
      btn.dataset.slotId = slot.id;
      btn.disabled = Boolean(slot.booked);
      btn.setAttribute('aria-pressed', String(state.selectedSlotId === slot.id));

      const topRow = document.createElement('div');
      topRow.className = 'slot-card__top';

      const docTitle = document.createElement('p');
      docTitle.className = 'slot-card__doc';
      docTitle.textContent = slot.clinician;

      const statusBadge = document.createElement('span');
      if (slot.booked) {
        statusBadge.className = 'badge badge--neutral';
        statusBadge.textContent = 'Booked';
      } else if (slot.recommended) {
        statusBadge.className = 'badge badge--accent';
        statusBadge.textContent = 'Priority Match';
      } else {
        statusBadge.className = 'badge badge--standard';
        statusBadge.textContent = 'Available';
      }

      topRow.append(docTitle, statusBadge);

      const meta = document.createElement('p');
      meta.className = 'slot-card__meta';
      meta.textContent = `${slot.specialty} · ${slot.credentials}`;

      const footer = document.createElement('div');
      footer.className = 'slot-card__footer';

      const timeSpan = document.createElement('span');
      timeSpan.textContent = `${slot.time} (${slot.date})`;

      const modalitySpan = document.createElement('span');
      modalitySpan.className = 'badge badge--neutral';
      modalitySpan.textContent = slot.modality.toUpperCase();

      footer.append(timeSpan, modalitySpan);
      btn.append(topRow, meta, footer);

      if (!slot.booked) {
        btn.addEventListener('click', () => {
          state.selectedSlotId = slot.id;
          clearAlert(bookingError);
          renderSlots();
          updateBookingButtonState();
        });
      }

      slotsGrid.appendChild(btn);
    });
  }

  async function loadSlots() {
    if (!state.triage || !state.triage.bookingAllowed) return;

    const params = new URLSearchParams({
      urgency: state.triage.level,
      modality: state.selectedModality
    });

    try {
      const response = await fetch(`/api/slots?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load consultation slots.');
      }

      state.slots = data.slots || [];
      if (
        state.selectedSlotId &&
        !state.slots.some((s) => s.id === state.selectedSlotId && !s.booked)
      ) {
        state.selectedSlotId = null;
      }
      renderSlots();
      updateBookingButtonState();
    } catch (err) {
      showAlert(bookingError, err.message);
    }
  }

  function renderBookingReceipt(booking) {
    receiptCard.classList.remove('hidden');
    receiptDetails.innerHTML = '';

    const entries = [
      ['Booking Code', booking.bookingId],
      ['Triage Reference', `${booking.triageId} (${booking.urgencyLevel})`],
      ['Patient', booking.patientName],
      ['Clinician', `${booking.clinician} (${booking.specialty})`],
      ['Scheduled Time', `${booking.time} · ${booking.date}`],
      ['Consultation Mode', booking.modality.toUpperCase()],
      ['Contact Sent To', `${booking.patientEmail} · ${booking.patientPhone}`],
      ['Telehealth Room', booking.sessionUrl]
    ];

    entries.forEach(([label, value]) => {
      const box = document.createElement('div');
      box.className = 'receipt-item';

      const labelEl = document.createElement('span');
      labelEl.className = 'receipt-item__label';
      labelEl.textContent = label;

      const valueEl = document.createElement('span');
      valueEl.className = 'receipt-item__value';
      valueEl.textContent = value;

      box.append(labelEl, valueEl);
      receiptDetails.appendChild(box);
    });
  }

  // Handle Step 1: Triage Submission
  triageForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert(triageError);
    clearAlert(bookingError);

    const formData = new FormData(triageForm);
    const payload = {
      patientName: String(formData.get('patientName') || '').trim(),
      age: formData.get('age'),
      temperature: formData.get('temperature'),
      symptomCategory: formData.get('symptomCategory'),
      severity: Number(formData.get('severity')),
      duration: formData.get('duration'),
      redFlags: formData.getAll('redFlags'),
      riskFactors: formData.getAll('riskFactors'),
      notes: String(formData.get('notes') || '').trim()
    };

    triageSubmitBtn.disabled = true;
    triageSubmitBtn.textContent = 'Evaluating Symptoms...';

    try {
      const response = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Please verify all required triage fields.');
      }

      state.triage = data;
      state.selectedSlotId = null;

      renderTriageResult(data);
      bookingLockedBanner.classList.add('hidden');

      if (!data.bookingAllowed) {
        updateStepper(2);
        bookingEmergencyBanner.classList.remove('hidden');
        bookingControls.classList.add('hidden');
        bookingStepBadge.className = 'badge badge--emergency';
        bookingStepBadge.textContent = 'ER Escalation';
        bookingSubtitle.textContent = 'Emergency symptoms detected — online booking is locked for safety.';
      } else {
        updateStepper(3);
        bookingEmergencyBanner.classList.add('hidden');
        bookingControls.classList.remove('hidden');
        bookingStepBadge.className = 'badge badge--accent';
        bookingStepBadge.textContent = 'Step 3 of 3';
        bookingSubtitle.textContent = `Showing clinicians prioritized for ${data.label} (${data.recommendedSpecialty}).`;
        await loadSlots();
      }
    } catch (err) {
      showAlert(triageError, err.message);
    } finally {
      triageSubmitBtn.disabled = false;
      triageSubmitBtn.textContent = 'Run Clinical Triage';
    }
  });

  // Handle Reset Assessment
  triageResetBtn.addEventListener('click', () => {
    triageForm.reset();
    updateSeverityBadge();
    clearAlert(triageError);
    clearAlert(bookingError);

    state.triage = null;
    state.selectedSlotId = null;
    state.selectedModality = 'all';

    updateStepper(1);
    resultTierBadge.className = 'badge badge--neutral';
    resultTierBadge.textContent = 'Pending';
    triageEmptyState.classList.remove('hidden');
    triageResultPanel.classList.add('hidden');

    bookingLockedBanner.classList.remove('hidden');
    bookingEmergencyBanner.classList.add('hidden');
    bookingControls.classList.add('hidden');
    bookingStepBadge.className = 'badge badge--neutral';
    bookingStepBadge.textContent = 'Awaiting Triage';
    bookingSubtitle.textContent =
      'Complete Step 1 triage first to unlock priority slot recommendations and booking.';

    filterTabs.forEach((tab) => {
      tab.setAttribute('aria-selected', String(tab.dataset.modality === 'all'));
    });

    updateBookingButtonState();
  });

  // Handle Modality Filter Tabs
  filterTabs.forEach((tab) => {
    tab.addEventListener('click', async () => {
      state.selectedModality = tab.dataset.modality || 'all';
      filterTabs.forEach((t) => {
        t.setAttribute('aria-selected', String(t === tab));
      });
      await loadSlots();
    });
  });

  // Live validation for booking CTA enablement
  patientEmailInput.addEventListener('input', updateBookingButtonState);
  patientPhoneInput.addEventListener('input', updateBookingButtonState);

  // Handle Step 3: Booking Submission
  bookingForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert(bookingError);

    if (!state.triage || !state.selectedSlotId) {
      showAlert(bookingError, 'Please select an available consultation slot first.');
      return;
    }

    confirmBookingBtn.disabled = true;
    confirmBookingBtn.textContent = 'Confirming Booking...';

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triageId: state.triage.triageId,
          slotId: state.selectedSlotId,
          patientEmail: patientEmailInput.value.trim(),
          patientPhone: patientPhoneInput.value.trim(),
          notes: document.getElementById('notes').value.trim()
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not confirm your appointment.');
      }

      state.booking = data;
      state.selectedSlotId = null;

      renderBookingReceipt(data);
      bookingForm.reset();
      await loadSlots();
    } catch (err) {
      showAlert(bookingError, err.message);
    } finally {
      confirmBookingBtn.textContent = 'Confirm Consultation Slot';
      updateBookingButtonState();
    }
  });

  // Handle Appointment Cancellation
  cancelBookingBtn.addEventListener('click', async () => {
    if (!state.booking) return;

    cancelBookingBtn.disabled = true;
    cancelBookingBtn.textContent = 'Cancelling...';

    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(state.booking.bookingId)}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel appointment.');
      }

      state.booking = null;
      receiptCard.classList.add('hidden');
      await loadSlots();
    } catch (err) {
      showAlert(bookingError, err.message);
    } finally {
      cancelBookingBtn.disabled = false;
      cancelBookingBtn.textContent = 'Cancel Appointment';
    }
  });

  // Initialize UI
  severityInput.addEventListener('input', updateSeverityBadge);
  updateSeverityBadge();
  updateStepper(1);
})();
