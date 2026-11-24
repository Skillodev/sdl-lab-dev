/**
 * Clinical Triage Engine — Red-Flag Screening & Urgency Scoring
 *
 * Evaluates patient-reported symptoms, red-flag indicators, severity,
 * duration, vital temperature, and clinical risk factors to assign a
 * deterministic urgency tier and recommended clinical pathway.
 */

const RED_FLAGS = [
  {
    id: 'chest_pain',
    label: 'Chest pain, pressure, or tightness',
    guidance: 'Possible acute coronary or cardiopulmonary emergency.'
  },
  {
    id: 'shortness_of_breath',
    label: 'Severe shortness of breath or gasping',
    guidance: 'Possible acute respiratory distress or hypoxia.'
  },
  {
    id: 'stroke_signs',
    label: 'Facial drooping, arm weakness, or slurred speech',
    guidance: 'Possible acute stroke (FAST emergency protocol).'
  },
  {
    id: 'uncontrolled_bleeding',
    label: 'Severe or uncontrolled bleeding',
    guidance: 'Requires immediate emergency hemorrhage control.'
  },
  {
    id: 'altered_consciousness',
    label: 'Fainting, severe confusion, or unresponsiveness',
    guidance: 'Possible acute neurological or hemodynamic compromise.'
  },
  {
    id: 'anaphylaxis',
    label: 'Swelling of lips, tongue, or throat',
    guidance: 'Possible anaphylaxis requiring immediate airway care.'
  }
];

const RED_FLAG_KEYWORDS = [
  { pattern: /\bchest\s+pain\b/i, label: 'Chest pain mentioned in notes' },
  { pattern: /\b(can'?t|cannot|unable\s+to)\s+breathe\b/i, label: 'Inability to breathe mentioned in notes' },
  { pattern: /\b(slurred\s+speech|face\s+droop)/i, label: 'Stroke warning sign mentioned in notes' },
  { pattern: /\b(suicid|self[-\s]?harm|end\s+my\s+life)\b/i, label: 'Acute mental health crisis mentioned in notes' },
  { pattern: /\b(seizure|convulsion|unconscious|passed\s+out)\b/i, label: 'Loss of consciousness or seizure mentioned in notes' },
  { pattern: /\bcoughing\s+(up\s+)?blood\b/i, label: 'Hemoptysis (coughing blood) mentioned in notes' }
];

const SYMPTOM_CATEGORIES = {
  cardiovascular_mild: {
    label: 'Palpitations or Lightheadedness',
    weight: 28,
    specialty: 'Internal Medicine'
  },
  fever_infection: {
    label: 'Fever, Chills, or Suspected Infection',
    weight: 22,
    specialty: 'Urgent Care'
  },
  respiratory: {
    label: 'Cough, Sore Throat, or Mild Wheezing',
    weight: 20,
    specialty: 'Urgent Care'
  },
  neurological: {
    label: 'Headache, Migraine, or Dizziness',
    weight: 20,
    specialty: 'Internal Medicine'
  },
  gastrointestinal: {
    label: 'Nausea, Vomiting, or Abdominal Discomfort',
    weight: 18,
    specialty: 'General Practice'
  },
  mental_health: {
    label: 'Anxiety, Stress, or Sleep Disturbance',
    weight: 16,
    specialty: 'Behavioral Health'
  },
  musculoskeletal: {
    label: 'Joint Pain, Backache, or Minor Sprain',
    weight: 12,
    specialty: 'General Practice'
  },
  dermatological: {
    label: 'Skin Rash, Hives (Mild), or Irritation',
    weight: 10,
    specialty: 'Dermatology'
  },
  general_followup: {
    label: 'Prescription Refill or Routine Follow-Up',
    weight: 6,
    specialty: 'Family Medicine'
  }
};

const DURATION_WEIGHTS = {
  sudden_hours: { label: 'Sudden onset (< 24 hours)', weight: 16 },
  days_1_3: { label: '1 to 3 days', weight: 12 },
  days_4_7: { label: '4 to 7 days', weight: 10 },
  chronic_over_week: { label: 'More than 7 days', weight: 8 }
};

const RISK_FACTORS = {
  immunocompromised: { label: 'Immunocompromised', weight: 12 },
  pregnancy: { label: 'Currently pregnant', weight: 12 },
  chronic_heart_lung: { label: 'Chronic heart or lung disease', weight: 10 },
  diabetes: { label: 'Diabetes', weight: 8 }
};

const URGENCY_TIERS = {
  EMERGENCY: {
    level: 'EMERGENCY',
    tier: 1,
    label: 'Emergency Escalation',
    targetWindow: 'Immediate (0 min — Call 911 / 112)',
    recommendedAction:
      'Red-flag indicators detected. Do not wait for a teleconsultation. Call emergency services (911 / 112) or proceed to the nearest emergency department immediately.',
    bookingAllowed: false
  },
  URGENT: {
    level: 'URGENT',
    tier: 2,
    label: 'Urgent Priority Telehealth',
    targetWindow: 'Within 2 hours (Same-Day Priority)',
    recommendedAction:
      'Prompt clinical evaluation is recommended. Please book a same-day Urgent Care or Internal Medicine telehealth slot below.',
    bookingAllowed: true
  },
  STANDARD: {
    level: 'STANDARD',
    tier: 3,
    label: 'Standard Teleconsultation',
    targetWindow: 'Within 24 hours',
    recommendedAction:
      'Your symptoms warrant a structured clinician review within 24 hours. Select an available General Practice or specialist slot below.',
    bookingAllowed: true
  },
  ROUTINE: {
    level: 'ROUTINE',
    tier: 4,
    label: 'Routine Care & Guided Follow-Up',
    targetWindow: 'Within 24–48 hours',
    recommendedAction:
      'Low acute urgency detected. Book a convenient routine video, audio, or chat consultation and monitor for any worsening symptoms.',
    bookingAllowed: true
  }
};

/**
 * Validates incoming triage payload and returns field-level error details.
 * @param {object} payload
 * @returns {string[]} Array of validation error messages
 */
function validateTriageInput(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object') {
    return ['Request body must be a valid JSON object.'];
  }

  const name = typeof payload.patientName === 'string' ? payload.patientName.trim() : '';
  if (name.length < 2) {
    errors.push('Patient full name must be at least 2 characters.');
  }

  const age = Number(payload.age);
  if (!Number.isFinite(age) || age < 0 || age > 120) {
    errors.push('Patient age must be a valid number between 0 and 120.');
  }

  if (!payload.symptomCategory || !SYMPTOM_CATEGORIES[payload.symptomCategory]) {
    errors.push('Please select a valid primary symptom category.');
  }

  const severity = Number(payload.severity);
  if (!Number.isFinite(severity) || severity < 1 || severity > 10) {
    errors.push('Symptom severity must be a number between 1 and 10.');
  }

  if (!payload.duration || !DURATION_WEIGHTS[payload.duration]) {
    errors.push('Please select a valid symptom duration.');
  }

  if (payload.temperature !== undefined && payload.temperature !== null && payload.temperature !== '') {
    const temp = Number(payload.temperature);
    if (!Number.isFinite(temp) || temp < 30 || temp > 45) {
      errors.push('Body temperature must be between 30.0 °C and 45.0 °C.');
    }
  }

  return errors;
}

/**
 * Evaluates patient triage data for red flags and computes an urgency score.
 * @param {object} payload
 * @returns {object} Triage assessment report
 */
function evaluateTriage(payload) {
  const validationErrors = validateTriageInput(payload);
  if (validationErrors.length > 0) {
    const err = new Error(validationErrors.join(' '));
    err.statusCode = 400;
    err.details = validationErrors;
    throw err;
  }

  const patientName = payload.patientName.trim();
  const age = Number(payload.age);
  const severity = Number(payload.severity);
  const symptomCategory = payload.symptomCategory;
  const duration = payload.duration;
  const notes = typeof payload.notes === 'string' ? payload.notes.trim() : '';
  const selectedRedFlags = Array.isArray(payload.redFlags) ? payload.redFlags : [];
  const selectedRiskFactors = Array.isArray(payload.riskFactors) ? payload.riskFactors : [];
  const hasTemperature =
    payload.temperature !== undefined && payload.temperature !== null && payload.temperature !== '';
  const temperature = hasTemperature ? Number(payload.temperature) : null;

  const factors = [];
  const triggeredRedFlags = [];

  // 1. Explicit red-flag checklist screening
  for (const flagId of selectedRedFlags) {
    const matched = RED_FLAGS.find((rf) => rf.id === flagId);
    if (matched) {
      triggeredRedFlags.push({
        source: 'checklist',
        id: matched.id,
        label: matched.label,
        guidance: matched.guidance
      });
    }
  }

  // 2. Free-text safety net keyword screening
  if (notes) {
    for (const rule of RED_FLAG_KEYWORDS) {
      if (rule.pattern.test(notes)) {
        triggeredRedFlags.push({
          source: 'notes_scan',
          id: 'keyword_match',
          label: rule.label,
          guidance: 'Safety keyword scan detected high-risk emergency language.'
        });
      }
    }
  }

  const categoryMeta = SYMPTOM_CATEGORIES[symptomCategory];
  const durationMeta = DURATION_WEIGHTS[duration];

  // Immediate emergency bypass if any red flag is triggered
  if (triggeredRedFlags.length > 0) {
    return {
      patientName,
      age,
      symptomCategory,
      symptomLabel: categoryMeta.label,
      severity,
      duration: durationMeta.label,
      temperature,
      score: 100,
      ...URGENCY_TIERS.EMERGENCY,
      recommendedSpecialty: 'Emergency Medicine (ER)',
      redFlagsTriggered: triggeredRedFlags,
      factors: triggeredRedFlags.map((rf) => ({
        label: rf.label,
        impact: 'IMMEDIATE ESCALATION',
        detail: rf.guidance
      })),
      evaluatedAt: new Date().toISOString()
    };
  }

  // 3. Weighted clinical urgency score (0–100)
  let score = 0;

  score += categoryMeta.weight;
  factors.push({
    label: `Primary symptom: ${categoryMeta.label}`,
    impact: `+${categoryMeta.weight} pts`
  });

  let severityPoints = 2;
  if (severity >= 8) {
    severityPoints = 30;
  } else if (severity >= 5) {
    severityPoints = 18;
  } else if (severity >= 3) {
    severityPoints = 8;
  }
  score += severityPoints;
  factors.push({
    label: `Self-reported severity (${severity}/10)`,
    impact: `+${severityPoints} pts`
  });

  score += durationMeta.weight;
  factors.push({
    label: `Symptom duration: ${durationMeta.label}`,
    impact: `+${durationMeta.weight} pts`
  });

  if (temperature !== null) {
    if (temperature >= 39.5) {
      score += 22;
      factors.push({ label: `High fever (${temperature.toFixed(1)} °C)`, impact: '+22 pts' });
    } else if (temperature >= 38.0) {
      score += 12;
      factors.push({ label: `Elevated temperature (${temperature.toFixed(1)} °C)`, impact: '+12 pts' });
    } else if (temperature < 35.0) {
      score += 20;
      factors.push({ label: `Low body temperature (${temperature.toFixed(1)} °C)`, impact: '+20 pts' });
    } else {
      factors.push({ label: `Normal temperature (${temperature.toFixed(1)} °C)`, impact: '+0 pts' });
    }
  }

  if (age < 5 || age >= 65) {
    score += 12;
    factors.push({ label: `High-priority age group (${age} yrs)`, impact: '+12 pts' });
  } else if (age >= 50) {
    score += 5;
    factors.push({ label: `Age risk modifier (${age} yrs)`, impact: '+5 pts' });
  }

  for (const rfKey of selectedRiskFactors) {
    const risk = RISK_FACTORS[rfKey];
    if (risk) {
      score += risk.weight;
      factors.push({ label: `Risk factor: ${risk.label}`, impact: `+${risk.weight} pts` });
    }
  }

  const clampedScore = Math.min(100, Math.max(0, score));

  let tierMeta = URGENCY_TIERS.ROUTINE;
  if (clampedScore >= 85) {
    tierMeta = URGENCY_TIERS.EMERGENCY;
  } else if (clampedScore >= 55) {
    tierMeta = URGENCY_TIERS.URGENT;
  } else if (clampedScore >= 30) {
    tierMeta = URGENCY_TIERS.STANDARD;
  }

  const recommendedSpecialty =
    tierMeta.level === 'EMERGENCY'
      ? 'Emergency Medicine (ER)'
      : tierMeta.level === 'URGENT'
        ? 'Urgent Care'
        : categoryMeta.specialty;

  return {
    patientName,
    age,
    symptomCategory,
    symptomLabel: categoryMeta.label,
    severity,
    duration: durationMeta.label,
    temperature,
    score: clampedScore,
    ...tierMeta,
    recommendedSpecialty,
    redFlagsTriggered: [],
    factors,
    evaluatedAt: new Date().toISOString()
  };
}

module.exports = {
  RED_FLAGS,
  SYMPTOM_CATEGORIES,
  DURATION_WEIGHTS,
  RISK_FACTORS,
  URGENCY_TIERS,
  evaluateTriage
};
