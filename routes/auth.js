const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Support for Resend (Modern API based email)
const sendEmail = async (to, subject, otp) => {
    const text = `Your verification code is ${otp}. It will expire in 10 minutes.`;
    const html = `<b>Your verification code is ${otp}</b>. It will expire in 10 minutes.`;

    if (process.env.RESEND_API_KEY) {
        try {
            const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
                },
                body: JSON.stringify({
                    from: 'Psychiki <onboarding@resend.dev>', // You can change 'onboarding' to anything like 'noreply'
                    to: [to],
                    subject: subject,
                    html: html,
                    text: text
                })
            });
            if (res.ok) {
                console.log(`Email sent via Resend to ${to}`);
                return true;
            } else {
                const errorData = await res.json();
                console.error("Resend API rejected the request:", errorData);
            }
        } catch (e) {
            console.error("Resend delivery failed:", e.message);
        }
    } else {
        console.warn("RESEND_API_KEY is not set in environment variables.");
    }

    // FALLBACK: Log to console so user can still register by checking Render logs!
    console.log('\n-----------------------------------------');
    console.log(`[VERIFICATION CODE FOR ${to}]: ${otp}`);
    console.log('-----------------------------------------\n');
    return false;
};

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// @route   POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) return res.status(400).json({ message: 'Please enter all fields' });

        let user = await User.findOne({ $or: [{ email }, { username }] });
        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        if (user) {
            if (user.isVerified) return res.status(400).json({ message: 'User already exists' });
            user.otp = otp;
            user.otpExpires = otpExpires;
            user.password = hashedPassword;
        } else {
            user = new User({ username, email, password: hashedPassword, otp, otpExpires });
        }

        await user.save();
        const sent = await sendEmail(email, "Your Verification Code", otp);

        res.status(201).json({
            message: sent ? 'Verification code sent' : 'Account created! (Email service busy, check server logs for your code)',
            isVerified: false,
            email
        });

    } catch (err) {
        console.error("Register Error:", err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email });

        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.otp !== otp) return res.status(400).json({ message: 'Invalid code' });
        if (user.otpExpires < new Date()) return res.status(400).json({ message: 'Code expired' });

        user.isVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
        res.json({ token, user: { id: user._id, username: user.username, email: user.email } });
    } catch (error) {
        console.error("Verify Error:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        if (!user.isVerified) {
            const otp = generateOTP();
            user.otp = otp;
            user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
            await user.save();
            await sendEmail(email, "Verify your account", otp);
            return res.status(403).json({ message: 'Account not verified. Code resent.', requiresVerification: true, email });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
        res.json({ token, user: { id: user._id, username: user.username, email: user.email } });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) {
        console.error("Get User Error:", err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;