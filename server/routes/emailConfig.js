const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const EmailConfig = require('../models/EmailConfig');

// SMTP provider presets
const SMTP_PRESETS = {
  gmail: { host: 'smtp.gmail.com', port: 587, secure: false },
  outlook: { host: 'smtp-mail.outlook.com', port: 587, secure: false },
  yahoo: { host: 'smtp.mail.yahoo.com', port: 587, secure: false },
  custom: { host: '', port: 587, secure: false }
};

// Helper to create Gmail API client with service account (OAuth2 method)
async function getGmailClient(config) {
  const auth = new google.auth.JWT({
    email: config.serviceAccountEmail,
    key: config.serviceAccountPrivateKey,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject: config.sendAsEmail
  });

  await auth.authorize();
  return google.gmail({ version: 'v1', auth });
}

// Helper to create email in RFC 2822 format (for OAuth2)
function createRawEmail(from, to, subject, htmlBody, textBody) {
  const boundary = 'boundary_' + Date.now();

  const email = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    textBody,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    htmlBody,
    '',
    `--${boundary}--`
  ].join('\r\n');

  return Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Helper to mask sensitive fields
function maskConfig(config) {
  if (!config) return null;

  return {
    method: config.method,
    // OAuth2 fields
    serviceAccountEmail: config.serviceAccountEmail || '',
    serviceAccountPrivateKey: config.serviceAccountPrivateKey ? '••••••••' : '',
    sendAsEmail: config.sendAsEmail || '',
    // SMTP fields
    smtpProvider: config.smtpProvider || 'gmail',
    smtpHost: config.smtpHost || '',
    smtpPort: config.smtpPort || 587,
    smtpSecure: config.smtpSecure || false,
    smtpUser: config.smtpUser || '',
    smtpPassword: config.smtpPassword ? '••••••••' : '',
    // Common fields
    fromName: config.fromName || 'Hicks Bug Hunt',
    enabled: config.enabled || false,
    lastUpdatedBy: config.lastUpdatedBy,
    updatedAt: config.updatedAt
  };
}

// @route   GET /api/email-config
// @desc    Get email configuration (sensitive fields masked)
router.get('/', async (req, res, next) => {
  try {
    const config = await EmailConfig.getConfig();
    res.json({ success: true, data: maskConfig(config) });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/email-config/smtp-presets
// @desc    Get SMTP provider presets
router.get('/smtp-presets', (req, res) => {
  res.json({ success: true, data: SMTP_PRESETS });
});

// @route   PUT /api/email-config
// @desc    Update email configuration
router.put('/', async (req, res, next) => {
  try {
    const {
      method,
      // OAuth2 fields
      serviceAccountEmail,
      serviceAccountPrivateKey,
      sendAsEmail,
      // SMTP fields
      smtpProvider,
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPassword,
      // Common fields
      fromName,
      enabled
    } = req.body;

    // Get existing config to preserve masked passwords
    const existingConfig = await EmailConfig.getConfig();

    // Build update data
    const updateData = {
      method: method || 'smtp',
      fromName: fromName || 'Hicks Bug Hunt',
      enabled: enabled || false
    };

    // OAuth2 fields
    if (method === 'oauth2') {
      if (!serviceAccountEmail) {
        return res.status(400).json({ success: false, error: 'Service account email is required' });
      }
      if (!sendAsEmail) {
        return res.status(400).json({ success: false, error: 'Send-as email is required' });
      }

      updateData.serviceAccountEmail = serviceAccountEmail;
      updateData.sendAsEmail = sendAsEmail;

      // Keep existing private key if masked value sent
      if (serviceAccountPrivateKey && serviceAccountPrivateKey !== '••••••••') {
        updateData.serviceAccountPrivateKey = serviceAccountPrivateKey;
      } else if (existingConfig?.serviceAccountPrivateKey) {
        updateData.serviceAccountPrivateKey = existingConfig.serviceAccountPrivateKey;
      } else {
        return res.status(400).json({ success: false, error: 'Service account private key is required' });
      }
    }

    // SMTP fields
    if (method === 'smtp') {
      if (!smtpUser) {
        return res.status(400).json({ success: false, error: 'Email address is required' });
      }

      updateData.smtpProvider = smtpProvider || 'gmail';
      updateData.smtpUser = smtpUser;
      updateData.smtpSecure = smtpSecure || false;

      // Set host/port from preset or custom values
      if (smtpProvider === 'custom') {
        updateData.smtpHost = smtpHost;
        updateData.smtpPort = smtpPort || 587;
      } else {
        const preset = SMTP_PRESETS[smtpProvider] || SMTP_PRESETS.gmail;
        updateData.smtpHost = preset.host;
        updateData.smtpPort = preset.port;
      }

      // Keep existing password if masked value sent
      if (smtpPassword && smtpPassword !== '••••••••') {
        updateData.smtpPassword = smtpPassword;
      } else if (existingConfig?.smtpPassword) {
        updateData.smtpPassword = existingConfig.smtpPassword;
      } else {
        return res.status(400).json({ success: false, error: 'App password is required' });
      }
    }

    const updatedBy = req.oidc?.user?.email || 'unknown';
    const config = await EmailConfig.setConfig(updateData, updatedBy);

    res.json({ success: true, data: maskConfig(config) });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/email-config/test
// @desc    Send a test email to verify configuration
router.post('/test', async (req, res, next) => {
  try {
    const { testRecipient } = req.body;

    if (!testRecipient) {
      return res.status(400).json({ success: false, error: 'Test recipient email is required' });
    }

    const config = await EmailConfig.getConfig();

    if (!config) {
      return res.status(400).json({ success: false, error: 'Email configuration not set up' });
    }

    const subject = 'Hicks Bug Hunt - Test Email';
    const textBody = 'This is a test email from Hicks Bug Hunt. If you received this, your email configuration is working correctly!';
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Hicks Bug Hunt - Test Email</h2>
        <p>This is a test email from Hicks Bug Hunt.</p>
        <p style="color: #28a745; font-weight: bold;">If you received this, your email configuration is working correctly!</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Sent at: ${new Date().toLocaleString()}</p>
      </div>
    `;

    if (config.method === 'oauth2') {
      // OAuth2 method (Google Workspace)
      if (!config.serviceAccountPrivateKey) {
        return res.status(400).json({ success: false, error: 'Service account private key not configured' });
      }

      const gmail = await getGmailClient(config);
      const from = `"${config.fromName}" <${config.sendAsEmail}>`;
      const raw = createRawEmail(from, testRecipient, subject, htmlBody, textBody);

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw }
      });
    } else {
      // SMTP method
      if (!config.smtpPassword) {
        return res.status(400).json({ success: false, error: 'App password not configured' });
      }

      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPassword
        }
      });

      await transporter.sendMail({
        from: `"${config.fromName}" <${config.smtpUser}>`,
        to: testRecipient,
        subject,
        text: textBody,
        html: htmlBody
      });
    }

    res.json({
      success: true,
      message: `Test email sent successfully to ${testRecipient}`
    });
  } catch (error) {
    console.error('Test email error:', error);

    let errorMessage = error.message;
    if (error.code === 403) {
      errorMessage = 'Permission denied. Make sure Domain-Wide Delegation is configured and the service account has access to Gmail API.';
    } else if (error.code === 'EAUTH') {
      errorMessage = 'Authentication failed. Check your email address and app password.';
    }

    res.status(500).json({
      success: false,
      error: `Failed to send test email: ${errorMessage}`
    });
  }
});

module.exports = router;
