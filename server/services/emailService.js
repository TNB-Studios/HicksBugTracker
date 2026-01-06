const { google } = require('googleapis');
const EmailConfig = require('../models/EmailConfig');
const EmailRule = require('../models/EmailRule');
const Column = require('../models/Column');

// Helper to create Gmail API client with service account
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

  return Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Evaluate a single condition against context
function evaluateCondition(condition, context) {
  const { field, operator, value } = condition;
  const fieldValue = context[field] || '';

  switch (operator) {
    case 'equals':
      return fieldValue.toLowerCase() === value.toLowerCase();
    case 'not_equals':
      return fieldValue.toLowerCase() !== value.toLowerCase();
    case 'contains':
      return fieldValue.toLowerCase().includes(value.toLowerCase());
    case 'is_empty':
      return !fieldValue || fieldValue.trim() === '';
    case 'is_not_empty':
      return fieldValue && fieldValue.trim() !== '';
    default:
      return false;
  }
}

// Evaluate all conditions for a rule
function evaluateConditions(conditions, context) {
  if (!conditions.rules || conditions.rules.length === 0) {
    return true; // No conditions = always match
  }

  const results = conditions.rules.map(rule => evaluateCondition(rule, context));

  if (conditions.logic === 'OR') {
    return results.some(r => r);
  }
  return results.every(r => r); // AND
}

// Process template variables in subject/body
function processTemplate(template, context) {
  return template
    .replace(/\{task\.name\}/g, context.taskName || '')
    .replace(/\{task\.description\}/g, context.taskDescription || '')
    .replace(/\{task\.priority\}/g, context.priority || '')
    .replace(/\{task\.type\}/g, context.taskType || '')
    .replace(/\{task\.assignee\}/g, context.assignee || '')
    .replace(/\{task\.reporter\}/g, context.reporter || '')
    .replace(/\{task\.state\}/g, context.toState || '')
    .replace(/\{task\.previousState\}/g, context.fromState || '')
    .replace(/\{task\.newAssignee\}/g, context.newAssignee || '')
    .replace(/\{task\.previousAssignee\}/g, context.previousAssignee || '')
    .replace(/\{comment\.text\}/g, context.commentText || '')
    .replace(/\{comment\.author\}/g, context.commentAuthor || '')
    .replace(/\{board\.name\}/g, context.boardName || '');
}

// Get recipient email based on rule config
async function getRecipientEmail(emailConfig, context, boardUsers) {
  switch (emailConfig.recipientType) {
    case 'assignee':
      // Find user by name in boardUsers
      const assigneeUser = boardUsers.find(u =>
        u.name === context.assignee || u.username === context.assignee
      );
      return assigneeUser?.email || null;

    case 'reporter':
      const reporterUser = boardUsers.find(u =>
        u.name === context.reporter || u.username === context.reporter
      );
      return reporterUser?.email || null;

    case 'specific':
      return emailConfig.specificEmail || null;

    default:
      return null;
  }
}

// Fetch board users from Authentik
async function fetchBoardUsers(boardId) {
  try {
    const apiUrl = process.env.AUTHENTIK_API_URL;
    const apiToken = process.env.AUTHENTIK_API_TOKEN;

    const response = await fetch(`${apiUrl}/api/v3/core/users/?page_size=500`, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) return [];

    const data = await response.json();
    const boardIdStr = boardId.toString();

    return data.results
      .filter(user => {
        if (!user.is_active) return false;
        const userGroups = user.groups_obj?.map(g => g.name.toLowerCase().replace(/\s+/g, '-')) || [];
        const isAdmin = userGroups.includes('hicks-admins');
        const allowedBoards = user.attributes?.hicks_allowed_boards || [];
        const hasAccess = allowedBoards.some(b => b.toString() === boardIdStr);
        return isAdmin || hasAccess;
      })
      .map(user => ({
        id: user.pk,
        name: user.name || user.username,
        username: user.username,
        email: user.email
      }));
  } catch (error) {
    console.error('Error fetching board users:', error);
    return [];
  }
}

// Send a single email
async function sendEmail(to, subject, htmlBody) {
  const config = await EmailConfig.getConfig();

  if (!config || !config.enabled) {
    console.log('Email sending is disabled or not configured');
    return false;
  }

  try {
    const gmail = await getGmailClient(config);
    const from = `"${config.fromName}" <${config.sendAsEmail}>`;
    const textBody = htmlBody.replace(/<[^>]*>/g, '');
    const raw = createEmail(from, to, subject, htmlBody, textBody);

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw }
    });

    console.log(`Email sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error('Failed to send email:', error.message);
    return false;
  }
}

// Main function: Process email rules for a trigger event
async function processEmailRules(triggerType, task, context, board) {
  try {
    // Check if email is configured and enabled
    const emailConfig = await EmailConfig.getConfig();
    if (!emailConfig || !emailConfig.enabled) {
      return;
    }

    // Get all enabled rules for this board and trigger type
    const rules = await EmailRule.find({
      boardId: task.boardId,
      enabled: true,
      'trigger.type': triggerType
    });

    if (rules.length === 0) {
      return;
    }

    // Get board users for recipient lookup
    const boardUsers = await fetchBoardUsers(task.boardId);

    // Build context for rule evaluation
    const evalContext = {
      // Task fields
      taskName: task.name,
      taskDescription: task.description || '',
      priority: task.priority || 'Medium',
      taskType: task.taskType || 'Task',
      assignee: task.assignedTo || '',
      reporter: task.reportedBy || '',
      // State change fields
      fromState: context.fromState || '',
      toState: context.toState || task.state || '',
      // Assignee change fields
      previousAssignee: context.previousAssignee || '',
      newAssignee: context.newAssignee || task.assignedTo || '',
      // Comment fields
      commentText: context.commentText || '',
      commentAuthor: context.commentAuthor || '',
      // Board
      boardName: board?.name || ''
    };

    // Evaluate each rule
    for (const rule of rules) {
      if (!evaluateConditions(rule.conditions, evalContext)) {
        continue;
      }

      // Get recipient email
      const recipientEmail = await getRecipientEmail(rule.email, evalContext, boardUsers);
      if (!recipientEmail) {
        continue;
      }

      // Process templates
      const subject = processTemplate(rule.email.subject, evalContext);
      const bodyText = processTemplate(rule.email.body, evalContext);

      // Convert body to HTML (preserve line breaks)
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          ${bodyText.split('\n').map(line => `<p style="margin: 8px 0;">${line || '&nbsp;'}</p>`).join('')}
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            This email was sent automatically by Hicks Bug Hunt based on the rule: "${rule.name}"
          </p>
        </div>
      `;

      // Send the email
      await sendEmail(recipientEmail, subject, htmlBody);
    }
  } catch (error) {
    console.error('Error processing email rules:', error);
  }
}

// Export functions for use in routes
module.exports = {
  processEmailRules,
  sendEmail
};
