const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const EmailConfig = require('../models/EmailConfig');

// Helper to create Gmail API client with service account
async function getGmailClient(config) {
  const auth = new google.auth.JWT({
    email: config.serviceAccountEmail,
    key: config.serviceAccountPrivateKey,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject: config.sendAsEmail // Impersonate this user
  });

  await auth.authorize();
  return google.gmail({ version: 'v1', auth });
}

// Helper to create email in RFC 2822 format
function createEmail(from, to, subject, htmlBody, textBody) {
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

  // Encode to base64url format
  return Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// @route   GET /api/email-config
// @desc    Get email configuration (private key masked)
router.get('/', async (req, res, next) => {
  try {
    const config = await EmailConfig.getConfig();

    if (!config) {
      return res.json({
        success: true,
        data: null
      });
    }

    // Return config but mask the private key
    res.json({
      success: true,
      data: {
        serviceAccountEmail: config.serviceAccountEmail,
        serviceAccountPrivateKey: config.serviceAccountPrivateKey ? '••••••••' : '',
        sendAsEmail: config.sendAsEmail,
        fromName: config.fromName,
        enabled: config.enabled,
        lastUpdatedBy: config.lastUpdatedBy,
        updatedAt: config.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/email-config
// @desc    Update email configuration
router.put('/', async (req, res, next) => {
  try {
    const { serviceAccountEmail, serviceAccountPrivateKey, sendAsEmail, fromName, enabled } = req.body;

    // Validate required fields
    if (!serviceAccountEmail) {
      return res.status(400).json({ success: false, error: 'Service account email is required' });
    }
    if (!sendAsEmail) {
      return res.status(400).json({ success: false, error: 'Send-as email address is required' });
    }

    // Get existing config to check if we need to keep existing private key
    const existingConfig = await EmailConfig.getConfig();

    // If private key is the masked value or empty, keep existing
    let finalPrivateKey = serviceAccountPrivateKey;
    if (!serviceAccountPrivateKey || serviceAccountPrivateKey === '••••••••') {
      if (existingConfig?.serviceAccountPrivateKey) {
        finalPrivateKey = existingConfig.serviceAccountPrivateKey;
      } else {
        return res.status(400).json({ success: false, error: 'Service account private key is required' });
      }
    }

    const updatedBy = req.oidc?.user?.email || 'unknown';

    const config = await EmailConfig.setConfig({
      serviceAccountEmail,
      serviceAccountPrivateKey: finalPrivateKey,
      sendAsEmail,
      fromName: fromName || 'Hicks Bug Hunt',
      enabled: enabled || false
    }, updatedBy);

    // Return config with masked private key
    res.json({
      success: true,
      data: {
        serviceAccountEmail: config.serviceAccountEmail,
        serviceAccountPrivateKey: '••••••••',
        sendAsEmail: config.sendAsEmail,
        fromName: config.fromName,
        enabled: config.enabled,
        lastUpdatedBy: config.lastUpdatedBy,
        updatedAt: config.updatedAt
      }
    });
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

    if (!config.serviceAccountPrivateKey) {
      return res.status(400).json({ success: false, error: 'Service account private key not configured' });
    }

    // Create Gmail client
    const gmail = await getGmailClient(config);

    const from = `"${config.fromName}" <${config.sendAsEmail}>`;
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

    const raw = createEmail(from, testRecipient, subject, htmlBody, textBody);

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw }
    });

    res.json({
      success: true,
      message: `Test email sent successfully to ${testRecipient}`
    });
  } catch (error) {
    console.error('Test email error:', error);

    let errorMessage = error.message;
    if (error.code === 403) {
      errorMessage = 'Permission denied. Make sure Domain-Wide Delegation is configured and the service account has access to Gmail API.';
    } else if (error.code === 400) {
      errorMessage = 'Invalid request. Check that the service account email and private key are correct.';
    }

    res.status(500).json({
      success: false,
      error: `Failed to send test email: ${errorMessage}`
    });
  }
});

// Export helper for use by other parts of the app
router.sendEmail = async function(to, subject, htmlBody, textBody) {
  const config = await EmailConfig.getConfig();

  if (!config || !config.enabled) {
    console.log('Email sending is disabled or not configured');
    return false;
  }

  try {
    const gmail = await getGmailClient(config);
    const from = `"${config.fromName}" <${config.sendAsEmail}>`;
    const raw = createEmail(from, to, subject, htmlBody, textBody || htmlBody.replace(/<[^>]*>/g, ''));

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw }
    });

    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
};

module.exports = router;
