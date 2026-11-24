/**
 * Telemedicine Triage & Patient Booking Hub — Express API Server
 */

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { evaluateTriage } = require('./triageEngine');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// In-memory store for triage assessments and bookings
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
      priorityMatch: ['YELLOW'],
      booked: false
    },
    {
      id: 'slot-02',
      clinician: 'Dr. Samuel Adeyemi, MD',
      specialty: 'Internal Medicine',
      credentials: 'Acute & Internal Medicine',
      date: todayStr,
      time: 'In 50 mins',
      modality: 'video',
      priorityMatch: ['YELLOW', 'GREEN'],
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
      priorityMatch: ['YELLOW'],
      booked: true // Pre-booked slot demonstrating Disabled UI state
    },
    {
      id: 'slot-04',
      clinician: 'Dr. Elena Rostova, MD',
      specialty: 'General Practice',
      credentials: 'Primary & Family Care Physician',
      date: todayStr,
      time: 'Today, 4:00 PM',
      modality: 'video',
      priorityMatch: ['GREEN', 'YELLOW'],
      booked: false
    },
    {
      id: 'slot-05',
      clinician: 'Dr. Marcus Vance, MD',
      specialty: 'Family Medicine',
      credentials: 'Telehealth Primary Care',
      date: todayStr,
      time: 'Today, 5:15 PM',
      modality: 'audio',
      priorityMatch: ['GREEN'],
      booked: false
    },
    {
      id: 'slot-06',
      clinician: 'Dr. Hannah Mensah, MD',
      specialty: 'Dermatology & General Care',
      credentials: 'Telemedicine Clinician',
      date: tomorrowStr,
      time: 'Tomorrow, 9:30 AM',
      modality: 'chat',
      priorityMatch: ['GREEN'],
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
      priorityMatch: ['GREEN'],
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
      priorityMatch: ['GREEN', 'YELLOW'],
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

// Evaluate patient symptoms using RED / YELLOW / GREEN triage logic
app.post('/api/triage', (req, res) => {
  const { patientName, age, symptoms, notes } = req.body || {};

  const symptomList = Array.isArray(symptoms)
    ? symptoms.map((s) => String(s).trim()).filter(Boolean)
    : typeof symptoms === 'string'
      ? symptoms.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

  const trimmedNotes = typeof notes === 'string' ? notes.trim() : '';
  const combinedSymptoms = trimmedNotes ? [...symptomList, trimmedNotes] : [...symptomList];

  if (combinedSymptoms.length === 0) {
    return res.status(400).json({
      error: 'Please select at least one symptom or describe your concern in the notes field.'
    });
  }

  const parsedAge =
    age !== undefined && age !== null && age !== '' ? Number(age) : null;
  if (parsedAge !== null && (!Number.isFinite(parsedAge) || parsedAge < 0 || parsedAge > 120)) {
    return res.status(400).json({
      error: 'Patient age must be a valid number between 0 and 120.'
    });
  }

  const result = evaluateTriage(combinedSymptoms);
  const triageId = createId('TRG');

  const record = {
    triageId,
    patientName: typeof patientName === 'string' && patientName.trim() ? patientName.trim() : 'Guest Patient',
    age: parsedAge,
    symptoms: symptomList,
    notes: trimmedNotes,
    ...result,
    evaluatedAt: new Date().toISOString()
  };

  triageAssessments.set(triageId, record);
  return res.status(201).json(record);
});

// List clinician consultation slots with optional priority & modality filtering
app.get('/api/slots', (req, res) => {
  const { priority, modality, specialty } = req.query;
  const normalizedPriority = priority ? String(priority).toUpperCase() : null;

  let result = slots.map((slot) => ({
    ...slot,
    recommended: normalizedPriority ? slot.priorityMatch.includes(normalizedPriority) : false
  }));

  if (modality && modality !== 'all') {
    result = result.filter((s) => s.modality === String(modality).toLowerCase());
  }

  if (specialty && specialty !== 'all') {
    result = result.filter(
      (s) => s.specialty.toLowerCase() === String(specialty).toLowerCase()
    );
  }

  // Sort available & recommended slots first, booked slots last
  result.sort((a, b) => {
    if (a.booked !== b.booked) return a.booked ? 1 : -1;
    if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

  return res.json({ slots: result });
});

// Create a consultation booking linked to an evaluated triage record
app.post('/api/bookings', (req, res) => {
  const { triageId, slotId, patientName, patientEmail, patientPhone, notes } = req.body || {};

  if (!triageId || !triageAssessments.has(triageId)) {
    return res.status(400).json({
      error: 'A valid completed triage assessment is required before booking.'
    });
  }

  const triage = triageAssessments.get(triageId);
  if (!triage.allowOnlineBooking) {
    return res.status(400).json({
      error:
        'Online booking is disabled for RED priority emergencies. Please seek immediate in-person care or call emergency services.'
    });
  }

  const email = typeof patientEmail === 'string' ? patientEmail.trim() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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
    patientName:
      typeof patientName === 'string' && patientName.trim()
        ? patientName.trim()
        : triage.patientName,
    patientEmail: email,
    patientPhone: phone,
    priority: triage.priority,
    action: triage.action,
    clinician: slot.clinician,
    specialty: slot.specialty,
    date: slot.date,
    time: slot.time,
    modality: slot.modality,
    notes: typeof notes === 'string' ? notes.trim() : triage.notes,
    sessionUrl: `https://meet.telemedicine-hub.local/room/${bookingId.toLowerCase()}`,
    status: 'CONFIRMED',
    createdAt: new Date().toISOString()
  };

  bookings.set(bookingId, booking);
  return res.status(201).json(booking);
});

// List confirmed bookings
app.get('/api/bookings', (_req, res) => {
  res.json({ bookings: Array.from(bookings.values()) });
});

// Cancel an existing booking and release its slot
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

// SPA fallback to index.html for non-API routes
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
