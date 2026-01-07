const mongoose = require('mongoose');

// EmailConfig stores email credentials for sending emails
// Supports both OAuth2 (Google Workspace) and SMTP (Gmail, Outlook, Yahoo, etc.)
// Only one config document should exist (singleton pattern)
const EmailConfigSchema = new mongoose.Schema({
  // Email method: 'oauth2' for Google Workspace, 'smtp' for regular email accounts
  method: {
    type: String,
    enum: ['oauth2', 'smtp'],
    default: 'smtp'
  },

  // ========== OAuth2 Settings (Google Workspace) ==========
  serviceAccountEmail: {
    type: String,
    trim: true
  },
  serviceAccountPrivateKey: {
    type: String
  },
  // The email address to send from (must be a user in your Workspace domain)
  sendAsEmail: {
    type: String,
    trim: true
  },

  // ========== SMTP Settings (Gmail, Outlook, Yahoo, etc.) ==========
  smtpProvider: {
    type: String,
    enum: ['gmail', 'outlook', 'yahoo', 'custom'],
    default: 'gmail'
  },
  smtpHost: {
    type: String,
    trim: true
  },
  smtpPort: {
    type: Number
  },
  smtpSecure: {
    type: Boolean,
    default: false
  },
  smtpUser: {
    type: String,
    trim: true
  },
  smtpPassword: {
    type: String
  },

  // ========== Common Settings ==========
  fromName: {
    type: String,
    default: 'Hicks Bug Hunt'
  },
  // Is email sending enabled?
  enabled: {
    type: Boolean,
    default: false
  },
  // Last updated by (for audit)
  lastUpdatedBy: {
    type: String
  }
}, {
  timestamps: true
});

// Static method to get the singleton config
EmailConfigSchema.statics.getConfig = async function() {
  let config = await this.findOne();
  return config;
};

// Static method to update or create the singleton config
EmailConfigSchema.statics.setConfig = async function(data, updatedBy) {
  let config = await this.findOne();
  if (config) {
    Object.assign(config, data, { lastUpdatedBy: updatedBy });
    await config.save();
  } else {
    config = await this.create({ ...data, lastUpdatedBy: updatedBy });
  }
  return config;
};

module.exports = mongoose.model('EmailConfig', EmailConfigSchema);
