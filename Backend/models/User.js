const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide a login id'],
    unique: true
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 5,
    select: false
  },
  role: {
    type: String,
    enum: ['admin', 'manager', 'sales', 'accounts'],
    default: 'sales'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  groupId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Group'
  },
  branch: {
    type: [String],
    default: []
  },
  department: {
    type: String,
    default: ''
  },
  zakat: {
    type: String,
    default: ''
  },
  userType: {
    type: String,
    default: ''
  },
  saleDeleteLimit: {
    type: String,
    default: ''
  },
  permissions: {
    type: [String],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  profilePicture: {
    type: String,
    default: ''
  }
});

// Encrypt password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return; // Early return for async hooks
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
