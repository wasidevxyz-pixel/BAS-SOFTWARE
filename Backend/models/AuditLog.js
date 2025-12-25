const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: ['create', 'update', 'delete', 'login', 'logout', 'approve', 'reject', 'export', 'import', 'other']
  },
  entity: {
    type: String,
    required: true,
    enum: [
      'user', 'item', 'party', 'sale', 'purchase', 'payment', 'receipt', 
      'expense', 'income', 'stock_adjustment', 'company', 'settings', 'other'
    ]
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  changes: {
    type: mongoose.Schema.Types.Mixed
  },
  ipAddress: {
    type: String,
    trim: true
  },
  userAgent: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'pending'],
    default: 'success'
  },
  error: {
    message: String,
    stack: String
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for common queries
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, entity: 1 });
auditLogSchema.index({ performedBy: 1 });

// Static method to log an action
auditLogSchema.statics.log = async function(data) {
  try {
    const log = new this({
      action: data.action || 'other',
      entity: data.entity || 'other',
      entityId: data.entityId,
      changes: data.changes,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      status: data.status || 'success',
      error: data.error,
      performedBy: data.performedBy
    });
    await log.save();
    return log;
  } catch (error) {
    console.error('Error saving audit log:', error);
  }
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
