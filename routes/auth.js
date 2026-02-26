require('dns').setDefaultResultOrder('ipv4first');

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const auth = require('../middleware/auth');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Use STARTTLS
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

transporter.verify(function (error, success) {
    if (error) {
        console.error(error);
    } else {
        console.log("ready");
    }
});

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Please enter all fields' });
        }

        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            if (!existingUser.isVerified) {
                const newOtp = generateOTP();
                existingUser.otp = newOtp;
                existingUser.otpExpires = new Date(Date.now() + 10 * 60 * 1000);

                const salt = await bcrypt.genSalt(10);
                existingUser.password = await bcrypt.hash(password, salt);

                await existingUser.save();

                if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
                    await transporter.sendMail({
                        from: `"Psychiki" <${process.env.EMAIL_USER}>`,
                        to: email,
                        subject: "Your Verification Code",
                        text: `Your verification code is ${newOtp}. It will expire in 10 minutes.`,
                        html: `<b>Your verification code is ${newOtp}</b>. It will expire in 10 minutes.`
                    });
                } else {
                    console.log(`\n\n[DEV MODE] Simulate OTP Email to ${email}: CODE is ${newOtp}\n\n`);
                }

                return res.status(200).json({ message: 'Verification code resent', isVerified: false, email });
            }
            return res.status(400).json({ message: 'User already exists and is verified' });
        }

        const newUser = new User({
            username,
            email,
            password
        });

        const salt = await bcrypt.genSalt(10);
        newUser.password = await bcrypt.hash(password, salt);

        const otp = generateOTP();
        newUser.otp = otp;
        newUser.otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        await newUser.save();

        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            await transporter.sendMail({
                from: `"Psychiki" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: "Welcome to Psychiki - Verification Code",
                text: `Your verification code is ${otp}. It will expire in 10 minutes.`,
                html: `<b>Your verification code is ${otp}</b>. It will expire in 10 minutes.`
            });
        } else {
            console.log(`\n\n[DEV MODE] Simulate OTP Email to ${email}: CODE is ${otp}\n\n`);
        }

        res.status(201).json({
            message: 'Verification code sent',
            isVerified: false,
            email: newUser.email
        });
    } catch (err) {
        console.error("Register Error:", err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ message: 'Please provide email and code' });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.isVerified) {
            return res.status(400).json({ message: 'Account is already verified' });
        }

        if (user.otp !== otp) {
            return res.status(400).json({ message: 'Invalid verification code' });
        }

        if (user.otpExpires < new Date()) {
            return res.status(400).json({ message: 'Verification code has expired. Please register again to receive a new one.' });
        }

        user.isVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        const token = jwt.sign(
            { id: user._id, username: user.username },
            process.env.JWT_SECRET || 'fallback_secret_for_dev',
            { expiresIn: '7d' }
        );

        res.status(200).json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                primaryFocus: user.primaryFocus,
                interests: user.interests
            }
        });

    } catch (error) {
        console.error("Verify Error:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Please enter all fields' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        if (!user.isVerified) {
            const otp = generateOTP();
            user.otp = otp;
            user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
            await user.save();

            if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
                await transporter.sendMail({
                    from: `"Psychiki" <${process.env.EMAIL_USER}>`,
                    to: email,
                    subject: "Your Verification Code",
                    text: `Your new verification code is ${otp}. It will expire in 10 minutes.`,
                    html: `<b>Your new verification code is ${otp}</b>. It will expire in 10 minutes.`
                });
            } else {
                console.log(`\n\n[DEV MODE] Simulate OTP Email to ${email}: CODE is ${otp}\n\n`);
            }

            return res.status(403).json({
                message: 'Account not verified. A new verification code has been sent to your email.',
                requiresVerification: true,
                email: user.email
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user._id, username: user.username },
            process.env.JWT_SECRET || 'fallback_secret_for_dev',
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                primaryFocus: user.primaryFocus,
                interests: user.interests
            }
        });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        console.error("Get User Error:", err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;