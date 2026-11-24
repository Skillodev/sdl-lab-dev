/**
 * Telemedicine Triage & Patient Booking Hub — Client Controller
 * Integrates with RED / YELLOW / GREEN triage engine and booking API.
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

  const step1 = document.getElementById('step-1');
  const step2 = document.getElementById('step-2');
  const step3 = document.getElementById('step-3');

  const resultTierBadge = document.getElementById('result-tier-badge');
  const triageEmptyState = document.getElementById('triage-empty-state');
  const triageResultPanel = document.getElementById('triage-result-panel');
  const triageAlertBox = document.getElementById('triage-alert-box');
  const triageActionTitle = document.getElementById('triage-action-title');
  const triageActionBody = document.getElementById('triage-action-body');
  const triageBookingStatus = document.getElementById('triage-booking-status');
  const triageRefText = document.getElementById('triage-ref-text');
  const triageSymptomsList = document.getElementById('triage-symptoms-list');

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

  const PRIORITY_STYLE = {
    RED: { classSuffix: 'emergency', title: 'RED Priority — Emergency Escalation' },
    YELLOW: { classSuffix: 'urgent', title: 'YELLOW Priority — Urgent Teleconsultation' },
    GREEN: { classSuffix: 'standard', title: 'GREEN Priority — Routine Care' }
  };

  function updateStepper(activeStep) {
    [step1, step2, step3].forEach((el, index) => {
      const stepNum = index + 1;
      el.classList.remove('is-current', 'is-complete');
      if (stepNum < activeStep) {
        el.classList.add('is-complete');
      } else if (stepNum === activeStep) {
        el.classList.add('is-current');
      }
    });
  }

  function showAlert(el, message) {
    el.textContent = message;
    el.classList.remove('hidden');
  }

  function clearAlert(el) {
    el.textContent = '';
    el.classList.add('hidden');
  }

  function renderTriageResult(triage) {
    const meta = PRIORITY_STYLE[triage.priority] || PRIORITY_STYLE.GREEN;

    triageEmptyState.classList.add('hidden');
    triageResultPanel.classList.remove('hidden');

    resultTierBadge.className = `badge badge--${meta.classSuffix}`;
    resultTierBadge.textContent = triage.priority;

    triageAlertBox.className = `alert alert--${meta.classSuffix}`;
    triageActionTitle.textContent = meta.title;
    triageActionBody.textContent = triage.action;

    triageBookingStatus.className = triage.allowOnlineBooking
      ? 'badge badge--standard'
      : 'badge badge--emergency';
    triageBookingStatus.textContent = triage.allowOnlineBooking ? 'Enabled' : 'Locked (ER Only)';

    triageRefText.textContent = `Reference: ${triage.triageId} · Patient: ${triage.patientName}`;

    triageSymptomsList.innerHTML = '';
    const displayed = [...(triage.symptoms || [])];
    if (triage.notes) {
      displayed.push(`Note: ${triage.notes}`);
    }

    displayed.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'factor-list__item';

      const textSpan = document.createElement('span');
      textSpan.textContent = item;

      const tagSpan = document.createElement('span');
      tagSpan.className = 'factor-list__impact';
      tagSpan.textContent = triage.priority;

      li.append(textSpan, tagSpan);
      triageSymptomsList.appendChild(li);
    });
  }

  function updateBookingButtonState() {
    const hasSlot = Boolean(state.selectedSlotId);
    const hasEmail = patientEmailInput.value.trim().length > 3;
    const hasPhone = patientPhoneInput.value.trim().length >= 7;
    const allowed = Boolean(state.triage && state.triage.allowOnlineBooking);

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
    if (!state.triage || !state.triage.allowOnlineBooking) return;

    const params = new URLSearchParams({
      priority: state.triage.priority,
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
      ['Triage Reference', `${booking.triageId} (${booking.priority})`],
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
    const patientName = String(formData.get('patientName') || '').trim();
    const age = formData.get('age');
    const symptoms = formData.getAll('symptoms').map(String);
    const notes = String(formData.get('notes') || '').trim();

    if (patientName.length < 2) {
      showAlert(triageError, 'Please enter the patient full name (at least 2 characters).');
      return;
    }

    if (symptoms.length === 0 && !notes) {
      showAlert(triageError, 'Please select at least one symptom or enter notes before evaluating triage.');
      return;
    }

    triageSubmitBtn.disabled = true;
    triageSubmitBtn.textContent = 'Evaluating Symptoms...';

    try {
      const response = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientName, age, symptoms, notes })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to evaluate triage.');
      }

      state.triage = data;
      state.selectedSlotId = null;

      renderTriageResult(data);
      bookingLockedBanner.classList.add('hidden');

      if (!data.allowOnlineBooking) {
        updateStepper(2);
        bookingEmergencyBanner.classList.remove('hidden');
        bookingControls.classList.add('hidden');
        bookingStepBadge.className = 'badge badge--emergency';
        bookingStepBadge.textContent = 'RED Escalation';
        bookingSubtitle.textContent = 'Emergency symptoms detected — online booking is locked for safety.';
      } else {
        updateStepper(3);
        bookingEmergencyBanner.classList.add('hidden');
        bookingControls.classList.remove('hidden');
        bookingStepBadge.className =
          data.priority === 'YELLOW' ? 'badge badge--urgent' : 'badge badge--standard';
        bookingStepBadge.textContent = `${data.priority} Priority`;
        bookingSubtitle.textContent =
          data.priority === 'YELLOW'
            ? 'Urgent priority unlocked — same-day teleconsultation slots within 2 hours are highlighted.'
            : 'Routine booking unlocked — choose any convenient consultation slot below.';
        await loadSlots();
      }
    } catch (err) {
      showAlert(triageError, err.message);
    } finally {
      triageSubmitBtn.disabled = false;
      triageSubmitBtn.textContent = 'Evaluate Triage Priority';
    }
  });

  // Handle Reset Assessment
  triageResetBtn.addEventListener('click', () => {
    triageForm.reset();
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

  patientEmailInput.addEventListener('input', updateBookingButtonState);
  patientPhoneInput.addEventListener('input', updateBookingButtonState);

  // Handle Booking Submission
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
          patientName: state.triage.patientName,
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

  updateStepper(1);
})();
