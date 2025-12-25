const dotenv = require('dotenv');
const path = require('path');

// Load env vars
const envPath = path.join(__dirname, '.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.log('Error loading .env file:', result.error);
} else {
  console.log('.env file loaded successfully');
}

console.log('Environment Debug Check:');
console.log('------------------------');
console.log('JWT_SECRET present:', !!process.env.JWT_SECRET);
console.log('JWT_SECRET type:', typeof process.env.JWT_SECRET);
console.log('JWT_SECRET length:', process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0);
console.log('JWT_EXPIRE present:', !!process.env.JWT_EXPIRE);
console.log('JWT_EXPIRE value:', process.env.JWT_EXPIRE);
