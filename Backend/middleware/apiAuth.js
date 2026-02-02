const Settings = require('../models/Settings');
const User = require('../models/User');

/**
 * @desc    Verify API Key and Secret for external access
 * @header  x-api-key
 * @header  x-api-secret
 */
exports.verifyApiKey = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const apiSecret = req.headers['x-api-secret'];

    // If no API headers, just move to next (standard auth will pick it up)
    if (!apiKey || !apiSecret) {
        return next();
    }

    try {
        const settings = await Settings.findOne({ apiKey, apiSecret });

        if (!settings) {
            return res.status(401).json({
                success: false,
                message: 'Invalid API Key or Secret'
            });
        }

        // Set a "System API" user in req.user to bypass standard auth
        // We fetch a real admin user or create a virtual one
        // Using an admin user ensures it passes all 'authorize' and 'adminAccess' checks
        let adminUser = await User.findOne({ role: 'admin', isActive: true });

        if (adminUser) {
            req.user = adminUser;
        } else {
            // Fallback to virtual user if no real admin exists (unlikely)
            req.user = {
                _id: settings.createdBy,
                role: 'admin',
                isActive: true,
                isApiAccess: true
            };
        }

        next();
    } catch (err) {
        console.error('API Verification Error:', err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
