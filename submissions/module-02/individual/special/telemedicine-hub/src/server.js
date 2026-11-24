/**
 * Telemedicine Triage & Patient Booking Hub — Express API Server
 */

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const {
  RED_FLAGS,
  SYMPTOM_CATEGORIES,
  DURATION_WEIGHTS,
  RISK_FACTORS,
  evaluateTriage
} = require('./triageEngine');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// In-memory clinical state store (sufficient for local triage & booking prototype)
const triageAssessments = new Map();
const bookings = new Map();

function buildInitialSlots() {
  const today = new Date();
  const formatDate = (offsetDays) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  };

  const todayStr = formatDate(0);
  const tomorrowStr = formatDate(1);

  return [
    {
      id: 'slot-01',
      clinician: 'Dr. Amara Okafor, MD',
      specialty: 'Urgent Care',
      credentials: 'Board-Certified Acute Telemedicine',
      date: todayStr,
      time: 'In 25 mins',
      modality: 'video',
      urgencyMatch: ['URGENT', 'STANDARD'],
      booked: false
    },
    {
      id: 'slot-02',
      clinician: 'Dr. Samuel Adeyemi, MD',
      specialty: 'Internal Medicine',
      credentials: 'Cardiopulmonary & Internal Medicine',
      date: todayStr,
      time: 'In 50 mins',
      modality: 'video',
      urgencyMatch: ['URGENT', 'STANDARD'],
      booked: false
    },
    {
      id: 'slot-03',
      clinician: 'Dr. Priya Nair, DO',
      specialty: 'Urgent Care',
      credentials: 'Rapid Acute Triage Clinician',
      date: todayStr,
      time: 'Today, 2:30 PM',
      modality: 'audio',
      urgencyMatch: ['URGENT', 'STANDARD'],
      booked: true // Pre-booked slot to demonstrate unavailable/disabled UI state
    },
    {
      id: 'slot-04',
      clinician: 'Dr. Elena Rostova, MD',
      specialty: 'General Practice',
      credentials: 'Primary & Family Care Physician',
      date: todayStr,
      time: 'Today, 4:00 PM',
      modality: 'video',
      urgencyMatch: ['STANDARD', 'ROUTINE'],
      booked: false
    },
    {
      id: 'slot-05',
      clinician: 'Dr. Marcus Vance, PsyD',
      specialty: 'Behavioral Health',
      credentials: 'Clinical Tele-Psychology',
      date: todayStr,
      time: 'Today, 5:15 PM',
      modality: 'audio',
      urgencyMatch: ['STANDARD', 'ROUTINE'],
      booked: false
    },
    {
      id: 'slot-06',
      clinician: 'Dr. Hannah Mensah, MD',
      specialty: 'Dermatology',
      credentials: 'Teledermatology Specialist',
      date: tomorrowStr,
      time: 'Tomorrow, 9:30 AM',
      modality: 'chat',
      urgencyMatch: ['STANDARD', 'ROUTINE'],
      booked: false
    },
    {
      id: 'slot-07',
      clinician: 'Dr. David Chen, MD',
      specialty: 'Family Medicine',
      credentials: 'Preventive Care & Refills',
      date: tomorrowStr,
      time: 'Tomorrow, 11:00 AM',
      modality: 'chat',
      urgencyMatch: ['ROUTINE', 'STANDARD'],
      booked: false
    },
    {
      id: 'slot-08',
      clinician: 'Dr. Zainab Bello, MD',
      specialty: 'General Practice',
      credentials: 'Telehealth Primary Care',
      date: tomorrowStr,
      time: 'Tomorrow, 1:30 PM',
      modality: 'video',
      urgencyMatch: ['STANDARD', 'ROUTINE'],
      booked: false
    }
  ];
}

const slots = buildInitialSlots();

function createId(prefix) {
  return `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'telemedicine-hub',
    timestamp: new Date().toISOString()
  });
});

// Triage reference metadata
app.get('/api/triage/metadata', (_req, res) => {
  res.json({
    redFlags: RED_FLAGS,
    symptomCategories: SYMPTOM_CATEGORIES,
    durations: DURATION_WEIGHTS,
    riskFactors: RISK_FACTORS
  });
});

// Evaluate patient symptoms and return urgency triage report
app.post('/api/triage', (req, res) => {
  try {
    const assessment = evaluateTriage(req.body);
    const triageId = createId('TRG');
    const record = { triageId, ...assessment };
    triageAssessments.set(triageId, record);
    return res.status(201).json(record);
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      error: err.message || 'Unable to process triage assessment.',
      details: err.details || []
    });
  }
});

// List clinician consultation slots with optional filtering
app.get('/api/slots', (req, res) => {
  const { urgency, modality, specialty } = req.query;

  let result = slots.map((slot) => ({
    ...slot,
    recommended: urgency ? slot.urgencyMatch.includes(String(urgency).toUpperCase()) : false
  }));

  if (modality && modality !== 'all') {
    result = result.filter((s) => s.modality === String(modality).toLowerCase());
  }

  if (specialty && specialty !== 'all') {
    result = result.filter(
      (s) => s.specialty.toLowerCase() === String(specialty).toLowerCase()
    );
  }

  // Sort recommended available slots first, booked slots last
  result.sort((a, b) => {
    if (a.booked !== b.booked) return a.booked ? 1 : -1;
    if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

  return res.json({ slots: result });
});

// Create a patient consultation booking linked to a triage assessment
app.post('/api/bookings', (req, res) => {
  const { triageId, slotId, patientEmail, patientPhone, notes } = req.body || {};

  if (!triageId || !triageAssessments.has(triageId)) {
    return res.status(400).json({
      error: 'A valid completed triage assessment is required before booking.'
    });
  }

  const triage = triageAssessments.get(triageId);
  if (!triage.bookingAllowed) {
    return res.status(400).json({
      error:
        'Routine telehealth booking is disabled for Emergency triage results. Please contact emergency services (911 / 112) immediately.'
    });
  }

  const email = typeof patientEmail === 'string' ? patientEmail.trim() : '';
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailValid) {
    return res.status(400).json({ error: 'Please provide a valid email address for confirmation.' });
  }

  const phone = typeof patientPhone === 'string' ? patientPhone.trim() : '';
  if (phone.length < 7) {
    return res.status(400).json({ error: 'Please provide a valid contact phone number.' });
  }

  const slot = slots.find((s) => s.id === slotId);
  if (!slot) {
    return res.status(404).json({ error: 'Selected consultation slot was not found.' });
  }

  if (slot.booked) {
    return res.status(409).json({
      error: 'That time slot has already been booked. Please select another available slot.'
    });
  }

  slot.booked = true;

  const bookingId = createId('BK');
  const booking = {
    bookingId,
    triageId,
    slotId: slot.id,
    patientName: triage.patientName,
    patientEmail: email,
    patientPhone: phone,
    urgencyLevel: triage.level,
    urgencyLabel: triage.label,
    urgencyScore: triage.score,
    clinician: slot.clinician,
    specialty: slot.specialty,
    date: slot.date,
    time: slot.time,
    modality: slot.modality,
    notes: typeof notes === 'string' ? notes.trim() : '',
    sessionUrl: `https://meet.telemedicine-hub.local/room/${bookingId.toLowerCase()}`,
    status: 'CONFIRMED',
    createdAt: new Date().toISOString()
  };

  bookings.set(bookingId, booking);

  return res.status(201).json(booking);
});

// List all confirmed bookings
app.get('/api/bookings', (_req, res) => {
  res.json({ bookings: Array.from(bookings.values()) });
});

// Cancel an existing booking and release the slot
app.delete('/api/bookings/:id', (req, res) => {
  const { id } = req.params;
  if (!bookings.has(id)) {
    return res.status(404).json({ error: 'Booking record not found.' });
  }

  const booking = bookings.get(id);
  const slot = slots.find((s) => s.id === booking.slotId);
  if (slot) {
    slot.booked = false;
  }

  bookings.delete(id);
  return res.json({ cancelled: true, bookingId: id, releasedSlotId: booking.slotId });
});

// SPA fallback to index.html for unknown non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  return res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Telemedicine Triage & Booking Hub running at http://localhost:${PORT}`);
  });
}

module.exports = { app };
