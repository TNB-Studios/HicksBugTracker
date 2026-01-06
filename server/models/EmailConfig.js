const mongoose = require('mongoose');

// EmailConfig stores Gmail OAuth2 Service Account credentials for sending emails
// Only one config document should exist (singleton pattern)
const EmailConfigSchema = new mongoose.Schema({
  // Service Account credentials (from Google Cloud Console JSON key file)
  serviceAccountEmail: {
    type: String,
    required: [true, 'Service account email is required'],
    trim: true
  },
  serviceAccountPrivateKey: {
    type: String,
    required: [true, 'Service account private key is required']
  },
  // The email address to send from (must be a user in your Workspace domain)
  sendAsEmail: {
    type: String,
    required: [true, 'Send-as email address is required'],
    trim: true
  },
  // Default "from" name
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
