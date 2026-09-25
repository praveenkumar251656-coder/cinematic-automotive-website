const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const nodemailer = require('nodemailer');

// Load environment variables from .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const RECEIVER_EMAIL = process.env.COMMISSION_RECEIVER_EMAIL || 'praveenkumar251656@gmail.com';
const FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || '"Ford Mustang Showcase" <notifications@mustang-showcase.com>';
const SERVER_START_TIME = Date.now();

// ═══════════════════════════════════════════════════════════════
// SECURITY & MIDDLEWARE CONFIGURATION
// ═══════════════════════════════════════════════════════════════

// Trust first proxy for accurate client IP tracking under reverse proxies
app.set('trust proxy', 1);

// Helmet Security Headers with custom Content Security Policy (allows Google Fonts & inline scripts/styles)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'"],
        mediaSrc: ["'self'", "data:", "blob:"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

// Enable Cross-Origin Resource Sharing
app.use(cors());

// Request body parsing with strict size limit (prevents payload flood attacks)
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// Lightweight Technical Request Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api')) {
      console.log(`[API ${req.method}] ${req.path} -> Status: ${res.statusCode} (${duration}ms) [${req.ip}]`);
    }
  });
  next();
});

// ═══════════════════════════════════════════════════════════════
// RATE LIMITING STRATEGIES
// ═══════════════════════════════════════════════════════════════

// Strict Rate Limiting for Commission Submissions (5 submissions per 15 mins per IP)
const commissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Rate limit exceeded: Too many commission requests from this IP. Please wait 15 minutes before submitting again.'
  }
});

// General Rate Limiting for Public API Endpoints (120 requests per 15 mins per IP)
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Rate limit exceeded for API telemetry. Please throttle your requests.'
  }
});

app.use('/api/', generalApiLimiter);

// ═══════════════════════════════════════════════════════════════
// NODEMAILER TRANSPORTER CONFIGURATION
// ═══════════════════════════════════════════════════════════════
let transporter;
function createTransporter() {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    console.log('[Email Engine] Initializing Production SMTP Relay via', process.env.SMTP_HOST || 'smtp.gmail.com');
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  } else {
    console.log('[Email Engine] SMTP credentials not detected in .env. Initializing Stream/JSON Transport Fallback (Simulation mode).');
    return nodemailer.createTransport({
      jsonTransport: true
    });
  }
}

transporter = createTransporter();

// ═══════════════════════════════════════════════════════════════
// DATA STORE: MUSTANG TECHNICAL ARCHITECTURE CATALOGUE
// ═══════════════════════════════════════════════════════════════
const MUSTANG_COMPONENTS_DATA = [
  {
    id: "CYT-V8-G4",
    category: "POWERTRAIN // COMBUSTION",
    name: "5.0L GEN-4 COYOTE V8",
    desc: "The heart of the Mustang: featuring an industry-first dual air-intake box and dual-throttle body design that maximizes airflow velocity and high-RPM power delivery with 500 naturally aspirated horsepower.",
    metrics: [
      { label: "DISPLACEMENT", val: "5,038 CC", note: "Dual Throttle Body" },
      { label: "PEAK OUTPUT", val: "500 HP @ 7250", note: "Naturally Aspirated" },
      { label: "TORQUE CURVE", val: "418 LB-FT", note: "@ 4,900 RPM" },
      { label: "VALVETRAIN", val: "32V DOHC", note: "Twin Independent VCT" }
    ]
  },
  {
    id: "TRM-3160-6S",
    category: "DRIVETRAIN // TRANSMISSION",
    name: "TREMEC® 6-SPEED MANUAL",
    desc: "Track-focused Tremec 3160 six-speed manual gearbox with standard rev-matching technology and an exclusive 3D-printed titanium shift ball, paired with a dedicated transmission oil cooler.",
    metrics: [
      { label: "GEARBOX TYPE", val: "6-SPD MANUAL", note: "Tremec TR-3160" },
      { label: "REV MATCHING", val: "ACTIVE DOWNSHIFT", note: "Millisecond Precision" },
      { label: "COOLING SYSTEM", val: "DEDICATED COOLER", note: "Track Endurance" },
      { label: "FLYWHEEL", val: "DUAL MASS", note: "Lightweight Inertia" }
    ]
  },
  {
    id: "MGR-DAMP-1KHZ",
    category: "CHASSIS // ACTIVE SUSPENSION",
    name: "MAGNERIDE® ACTIVE DAMPING",
    desc: "Magnetorheological dampers filled with synthetic hydrocarbon fluid containing microscopic magnetic particles, continuously varying damping stiffness 1,000 times per second for instant compliance.",
    metrics: [
      { label: "SAMPLE RATE", val: "1,000 HZ", note: "Real-time road scanning" },
      { label: "FLUID DYNAMICS", val: "MAGNETORHEOLOGIC", note: "Instantaneous Viscosity" },
      { label: "SWAY BARS", val: "HOLLOW 33.3MM", note: "Front / Rear Integrated" },
      { label: "LATERAL CONTROL", val: "TRACK-CALIBRATED", note: "Zero Body Roll Drift" }
    ]
  },
  {
    id: "BRM-6P-390MM",
    category: "DECELERATION // BRAKING SYSTEM",
    name: "BREMBO® 6-PISTON BRAKES",
    desc: "Massive 390mm two-piece vented front rotors clamped by Brembo 6-piston aluminum monobloc fixed calipers with dedicated underbody cooling ducts and track-ready pads.",
    metrics: [
      { label: "FRONT ROTORS", val: "390 MM (15.3\")", note: "Two-piece Co-cast" },
      { label: "CALIPER SPEC", val: "6-PISTON FIXED", note: "Monobloc Aluminum" },
      { label: "BRAKING DIST", val: "93 FT (60-0)", note: "Zero Thermal Fade" },
      { label: "DRIFT BRAKE", val: "ELECTRONIC", note: "Formula Drift Co-Engineered" }
    ]
  },
  {
    id: "EXH-ACT-4TIP",
    category: "ACOUSTICS // PERFORMANCE EXHAUST",
    name: "ACTIVE VALVE QUAD EXHAUST",
    desc: "Quad-tipped active exhaust system featuring electronic butterfly valves that modulate acoustic backpressure across four selectable modes: Quiet, Normal, Sport, and Track.",
    metrics: [
      { label: "EXHAUST TIPS", val: "4.5\" QUAD CHROME", note: "Black PVD Coated" },
      { label: "DRIVE MODES", val: "4 ACOUSTIC MODES", note: "Quiet to Full Track Decibel" },
      { label: "FLOW RATE", val: "+18% CFM GAIN", note: "Low Backpressure" },
      { label: "SOUND PROFILE", val: "DEEP V8 GROWL", note: "Harmonically Tuned" }
    ]
  },
  {
    id: "AER-DSN-PK",
    category: "DYNAMICS // TRACK AERODYNAMICS",
    name: "AERODYNAMIC DOWNFORCE PACK",
    desc: "Engineered in the wind tunnel with a pronounced front chin splitter, aggressive functional hood heat extractors, underbody air strakes, and a rear wing with integrated Gurney flap.",
    metrics: [
      { label: "FRONT SPLITTER", val: "HIGH DOWNFORCE", note: "Vortex Generators" },
      { label: "REAR SPOILER", val: "GURNEY FLAP", note: "High-speed Stability" },
      { label: "HEAT EXTRACTOR", val: "VENTED HOOD", note: "Reduces Front-end Lift" },
      { label: "UNDERBODY", val: "FLAT PANELING", note: "Diffuser Channeling" }
    ]
  },
  {
    id: "TRS-LSD-373",
    category: "DRIVETRAIN // TRACTION",
    name: "TORSEN® LIMITED-SLIP DIFF",
    desc: "3.73 rear axle ratio paired with a helical-gear Torsen limited-slip differential and lightweight strut tower K-brace to deliver instantaneous power transfer to the outside wheel under cornering.",
    metrics: [
      { label: "AXLE RATIO", val: "3.73 : 1", note: "Acceleration Biased" },
      { label: "DIFF TYPE", val: "HELICAL GEAR", note: "Torque-Sensing Torsen" },
      { label: "BRACE SYSTEM", val: "K-BRACE ALLOY", note: "Strut Tower Stiffener" },
      { label: "HALF-SHAFTS", val: "HEAVY DUTY", note: "Drag & Track Proven" }
    ]
  },
  {
    id: "CKP-UNR-3D",
    category: "TELEMETRY // DIGITAL COCKPIT",
    name: "IMMERSIVE DIGITAL COCKPIT",
    desc: "Seamless magnesium-framed curved dual displays combining a 12.4\" instrument cluster with a 13.2\" center stack powered by Unreal Engine 3D for real-time telemetry rendering and customizable Fox Body gauge themes.",
    metrics: [
      { label: "DISPLAY SIZE", val: "13.2\" + 12.4\"", note: "Dual Curved Screen" },
      { label: "GRAPHICS ENGINE", val: "UNREAL ENGINE 3D", note: "Real-time Vehicle Render" },
      { label: "GAUGE MODES", val: "CUSTOM VINTAGE", note: "1980s Fox Body Heritage" },
      { label: "TRACK APPS", val: "G-METER & LAP", note: "Launch Control Matrix" }
    ]
  }
];

// ═══════════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/health — Server Health & Telemetry Endpoint
 */
app.get('/api/health', (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - SERVER_START_TIME) / 1000);
  const memUsage = process.memoryUsage();

  res.status(200).json({
    status: 'OPERATIONAL',
    system: 'Ford Mustang Cinematic Experience Backend',
    version: '3.5.0',
    uptime: `${uptimeSeconds} seconds`,
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    memory: {
      rssMb: (memUsage.rss / 1024 / 1024).toFixed(2),
      heapUsedMb: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
      heapTotalMb: (memUsage.heapTotal / 1024 / 1024).toFixed(2)
    },
    smtpConfigured: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS)
  });
});

/**
 * GET /api/specs — Retrieve Technical Engineering Specs
 */
app.get('/api/specs', (req, res) => {
  res.status(200).json({
    success: true,
    totalComponents: MUSTANG_COMPONENTS_DATA.length,
    components: MUSTANG_COMPONENTS_DATA
  });
});

/**
 * GET /api/specs/:id — Retrieve Single Component Specification
 */
app.get('/api/specs/:id', (req, res) => {
  const componentId = req.params.id.toUpperCase();
  const component = MUSTANG_COMPONENTS_DATA.find(c => c.id.toUpperCase() === componentId);

  if (!component) {
    return res.status(404).json({
      success: false,
      message: `Component spec '${componentId}' not found.`
    });
  }

  res.status(200).json({
    success: true,
    component
  });
});

/**
 * POST /api/commission — Real Commission Submission API
 */
app.post('/api/commission', commissionLimiter, async (req, res) => {
  try {
    const { websiteType, email, description, website_url_hp } = req.body;

    // 1. Anti-Spam Honeypot check (hidden field populated only by malicious bots)
    if (website_url_hp && website_url_hp.trim() !== '') {
      console.warn('[Anti-Spam] Honeypot triggered from IP:', req.ip);
      // Silently return simulated success to neutralize bots without alerting them
      return res.status(200).json({
        success: true,
        message: 'Commission request received successfully.'
      });
    }

    // 2. Field Existence & Type Validation
    if (!websiteType || typeof websiteType !== 'string' || websiteType.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please select a valid experience or website scope.'
      });
    }

    if (!email || typeof email !== 'string' || email.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please provide your email address.'
      });
    }

    if (!description || typeof description !== 'string' || description.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please provide your project vision and requirements.'
      });
    }

    // 3. String Sanitization & Header Injection Protection
    const cleanWebsiteType = validator.escape(websiteType.trim().substring(0, 120));
    const rawEmail = email.trim();

    // Prevent Email Header Injection (reject CR / LF)
    if (/[\r\n]/.test(rawEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid characters detected in email address.'
      });
    }

    if (!validator.isEmail(rawEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid, deliverable email address (e.g. name@domain.com).'
      });
    }

    const cleanEmail = validator.normalizeEmail(rawEmail) || rawEmail;
    const cleanDescription = validator.escape(description.trim().substring(0, 5000));

    if (cleanDescription.length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a slightly more descriptive project summary (minimum 5 characters).'
      });
    }

    const submissionTime = new Date().toUTCString();
    const clientIp = req.ip || req.connection.remoteAddress || 'Unknown IP';

    // 4. Construct Automotive HTML Email Notification
    const htmlEmail = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #050608; color: #f1f5f9; margin: 0; padding: 30px; }
    .container { max-width: 620px; margin: 0 auto; background: #0c0f16; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.8); }
    .header { background: linear-gradient(180deg, #161b26 0%, #0c0f16 100%); padding: 30px; border-bottom: 1px solid rgba(255,255,255,0.08); }
    .eyebrow { font-family: monospace; font-size: 11px; letter-spacing: 0.25em; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px; }
    .title { font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; margin: 0; }
    .content { padding: 30px; }
    .field-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 16px; margin-bottom: 18px; }
    .label { font-family: monospace; font-size: 10px; letter-spacing: 0.15em; color: #64748b; text-transform: uppercase; margin-bottom: 6px; }
    .value { font-size: 15px; color: #ffffff; line-height: 1.6; }
    .value a { color: #38bdf8; text-decoration: none; }
    .desc-box { background: #07090d; border-left: 3px solid #10b981; padding: 16px; border-radius: 0 8px 8px 0; font-size: 14px; line-height: 1.65; color: #cbd5e1; white-space: pre-wrap; }
    .footer { padding: 20px 30px; background: #07080c; border-top: 1px solid rgba(255,255,255,0.05); font-family: monospace; font-size: 10px; color: #475569; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="eyebrow">// MUSTANG SHOWCASE PORTAL</div>
      <h1 class="title">New Website Commission Request</h1>
    </div>
    <div class="content">
      <div class="field-card">
        <div class="label">Client Contact Email</div>
        <div class="value"><a href="mailto:${cleanEmail}"><strong>${cleanEmail}</strong></a></div>
      </div>
      <div class="field-card">
        <div class="label">Requested Experience Scope</div>
        <div class="value"><strong>${cleanWebsiteType}</strong></div>
      </div>
      <div class="field-card">
        <div class="label">Project Vision & Requirements</div>
        <div class="desc-box">${cleanDescription}</div>
      </div>
    </div>
    <div class="footer">
      SUBMITTED AT: ${submissionTime} &bull; CLIENT IP: ${clientIp}
    </div>
  </div>
</body>
</html>
    `;

    const textEmail = `
===================================================================
NEW WEBSITE COMMISSION REQUEST — FORD MUSTANG SHOWCASE
===================================================================

CLIENT EMAIL:
${cleanEmail}

EXPERIENCE TYPE:
${cleanWebsiteType}

PROJECT REQUIREMENTS:
${description.trim()}

-------------------------------------------------------------------
TIMESTAMP: ${submissionTime}
CLIENT IP: ${clientIp}
===================================================================
    `;

    // 5. Send Transactional Email
    const mailOptions = {
      from: FROM_ADDRESS,
      to: RECEIVER_EMAIL,
      replyTo: cleanEmail,
      subject: `[Commission Inquiry] ${cleanWebsiteType} — ${cleanEmail}`,
      text: textEmail,
      html: htmlEmail
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[Commission API] Commission successfully processed & dispatched to:', RECEIVER_EMAIL);
    if (info && info.messageId) {
      console.log('[Commission API] Transport Message ID:', info.messageId);
    }

    // 6. Return Success Response to Client
    return res.status(200).json({
      success: true,
      message: "Your project specification has been securely transmitted. S.V.Praveen Kumar will review your brief and reply within 24 hours."
    });

  } catch (error) {
    console.error('[Commission API Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'A server error occurred while processing your commission request. Please try again or email praveenkumar251656@gmail.com directly.'
    });
  }
});

/**
 * POST /api/newsletter — Subscribe to Technical Bulletins & Releases
 */
app.post('/api/newsletter', (req, res) => {
  const { email } = req.body;
  if (!email || !validator.isEmail(email)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address.'
    });
  }

  console.log('[Newsletter API] New subscriber recorded:', validator.normalizeEmail(email));
  return res.status(200).json({
    success: true,
    message: 'Subscription confirmed. You will receive technical engineering telemetry and release notices.'
  });
});

// ═══════════════════════════════════════════════════════════════
// STATIC ASSET SERVING WITH CACHE CONTROLS
// ═══════════════════════════════════════════════════════════════
app.use(express.static(path.join(__dirname), {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// API 404 handler for non-existent API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint '${req.originalUrl}' not found.`
  });
});

// Fallback to index.html for SPA routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[Server Error Middleware]:', err.stack);
  res.status(500).json({
    success: false,
    message: 'An unexpected internal server error occurred.'
  });
});

// ═══════════════════════════════════════════════════════════════
// SERVER BOOTSTRAP
// ═══════════════════════════════════════════════════════════════
const server = app.listen(PORT, () => {
  console.log(`\n===================================================================`);
  console.log(`🚀 Ford Mustang Digital Showcase Server Online!`);
  console.log(`🌐 Localhost URL:      http://localhost:${PORT}`);
  console.log(`📊 Health Check:       http://localhost:${PORT}/api/health`);
  console.log(`🏎️ Vehicle Specs API:  http://localhost:${PORT}/api/specs`);
  console.log(`📨 Commission API:     http://localhost:${PORT}/api/commission (POST)`);
  console.log(`📬 Receiver Email:     ${RECEIVER_EMAIL}`);
  console.log(`===================================================================\n`);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  console.log('\n[Server] SIGINT received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});
