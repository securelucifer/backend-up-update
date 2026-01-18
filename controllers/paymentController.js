import crypto from 'crypto';
import Transaction from '../models/Transaction.js';
import Settings from '../models/Setting.js';
import Order from '../models/Order.js';

const MERCHANT_SECRET = process.env.MERCHANT_SECRET || 'my_super_secret_key';

// Generate unique transaction ID
const generateTransactionId = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return `cw${timestamp}${random}`;
};

// Generate random note
const generateNote = () => {
    return `s${Math.floor(Math.random() * 900) + 100}`;
};

// Create HMAC signature
const createSignature = (payload) => {
    return crypto
        .createHmac('sha256', MERCHANT_SECRET)
        .update(payload)
        .digest('hex');
};

/**
 * @desc    Create payment transaction
 * @route   POST /api/payment/create
 * @access  Public
 */
export const createPayment = async (req, res) => {
    try {
        const { amount, payType, orderId, userId } = req.body;

        // Validation
        if (!amount || !payType) {
            return res.status(400).json({
                error: 'Invalid payload'
            });
        }

        const paymentAmount = parseFloat(amount);
        const paymentType = payType.toLowerCase().trim();

        // Validate payment type
        if (!['phonepe', 'paytm'].includes(paymentType)) {
            return res.status(400).json({
                error: 'Unsupported payment type'
            });
        }

        // Fetch merchant UPI from database
        const settings = await Settings.getSettings();
        const MERCHANT_UPI = settings.merchantUPI;

        console.log('💳 Using Merchant UPI:', MERCHANT_UPI);

        // Generate transaction details
        const tid = generateTransactionId();
        const expires = Math.floor(Date.now() / 1000) + 600; // 10 minutes
        const note = generateNote();

        // Detect device from User-Agent
        const userAgent = req.headers['user-agent'] || '';
        const isIOS = /iPad|iPhone|iPod/.test(userAgent);
        const isAndroid = /Android/.test(userAgent);

        console.log(`📱 Device detected: ${isIOS ? 'iOS' : isAndroid ? 'Android' : 'Desktop'}`);

        let response;
        let payloadB64;
        let signature;
        let redirectUrl;
        let iosUrl;
        let androidUrl;

        if (paymentType === 'phonepe') {
            // PhonePe payment
            const payloadJson = {
                contact: {
                    cbsName: "",
                    nickName: "",
                    vpa: MERCHANT_UPI,
                    type: "VPA"
                },
                p2pPaymentCheckoutParams: {
                    note: note,
                    isByDefaultKnownContact: true,
                    initialAmount: Math.floor(paymentAmount * 100),
                    currency: "INR",
                    checkoutType: "DEFAULT",
                    transactionContext: "p2p"
                }
            };

            const payloadStr = JSON.stringify(payloadJson);
            payloadB64 = Buffer.from(payloadStr).toString('base64');
            signature = createSignature(payloadB64);
            const payloadUrlenc = encodeURIComponent(payloadB64);

            // Android deep link
            androidUrl = `phonepe://native?data=${payloadUrlenc}&id=p2ppayment`;

            // iOS universal link (UPI Intent format)
            iosUrl = `phonepe://pay?pa=${encodeURIComponent(MERCHANT_UPI)}&pn=Merchant&am=${paymentAmount}&tn=${encodeURIComponent(note)}&cu=INR`;

            // Choose appropriate URL based on device
            if (isIOS) {
                redirectUrl = iosUrl;
            } else {
                redirectUrl = androidUrl;
            }

            response = {
                redirect_url: redirectUrl,
                ios_url: iosUrl,
                android_url: androidUrl,
                payload: payloadB64,
                sig: signature,
                expires: expires,
                tid: tid,
                amount: paymentAmount.toString(),
                device: isIOS ? 'iOS' : isAndroid ? 'Android' : 'Desktop'
            };

        } else if (paymentType === 'paytm') {
            // Paytm payment
            const queryParams = new URLSearchParams({
                pa: MERCHANT_UPI,
                am: paymentAmount,
                tn: note,
                pn: MERCHANT_UPI,
                mc: '',
                cu: 'INR',
                url: '',
                mode: '',
                purpose: '',
                orgid: '',
                sign: '',
                featuretype: 'money_transfer'
            });

            redirectUrl = `paytmmp://cash_wallet?${queryParams.toString()}`;
            iosUrl = `paytm://pay?${queryParams.toString()}`;

            const payloadJson = {
                redirect: redirectUrl,
                tid: tid,
                exp: expires
            };

            const payloadStr = JSON.stringify(payloadJson);
            payloadB64 = Buffer.from(payloadStr).toString('base64');
            signature = createSignature(payloadB64);

            response = {
                redirect_url: redirectUrl,
                ios_url: iosUrl,
                android_url: redirectUrl,
                payload: payloadB64,
                sig: signature,
                expires: expires,
                tid: tid,
                amount: paymentAmount.toString(),
                device: isIOS ? 'ios' : isAndroid ? 'android' : 'desktop'
            };
        }

        // Save transaction to database
        const transaction = new Transaction({
            tid: tid,
            userId: userId || null,
            orderId: orderId || null,
            amount: paymentAmount,
            payType: paymentType,
            upi: MERCHANT_UPI,
            status: 'pending',
            payload: payloadB64,
            signature: signature,
            redirectUrl: redirectUrl,
            note: note,
            expires: new Date(expires * 1000)
        });

        await transaction.save();

        console.log(`✅ Transaction created: ${tid} for ₹${paymentAmount}`);

        // Return response
        res.status(200).json(response);

    } catch (error) {
        console.error('Error creating payment:', error);
        res.status(500).json({
            error: 'Failed to create payment',
            message: error.message
        });
    }
};

/**
 * @desc    Check payment status
 * @route   GET /api/payment/status/:tid
 * @access  Public
 */
export const checkPaymentStatus = async (req, res) => {
    try {
        const { tid } = req.params;

        if (!tid) {
            return res.status(400).json({
                error: 'Transaction ID is required'
            });
        }

        const transaction = await Transaction.findOne({ tid });

        if (!transaction) {
            return res.status(404).json({
                error: 'Transaction not found'
            });
        }

        // Check if transaction expired
        if (transaction.status === 'pending' && new Date() > transaction.expires) {
            transaction.status = 'expired';
            await transaction.save();

            // Update order if exists
            if (transaction.orderId) {
                await Order.findByIdAndUpdate(transaction.orderId, {
                    paymentStatus: 'failed',
                    orderStatus: 'cancelled'
                });
            }
        }

        res.status(200).json({
            tid: transaction.tid,
            status: transaction.status,
            amount: transaction.amount,
            payType: transaction.payType,
            upi: transaction.upi,
            createdAt: transaction.createdAt,
            completedAt: transaction.completedAt
        });

    } catch (error) {
        console.error('Error checking payment status:', error);
        res.status(500).json({
            error: 'Failed to check payment status',
            message: error.message
        });
    }
};

/**
 * @desc    Verify payment (Manual or Auto)
 * @route   POST /api/payment/verify
 * @access  Public
 */
export const verifyPayment = async (req, res) => {
    try {
        const { tid, status, signature } = req.body;

        if (!tid || !status) {
            return res.status(400).json({
                error: 'Transaction ID and status are required'
            });
        }

        const transaction = await Transaction.findOne({ tid });

        if (!transaction) {
            return res.status(404).json({
                error: 'Transaction not found'
            });
        }

        // Verify signature if provided
        if (signature) {
            const expectedSig = createSignature(transaction.payload);
            if (signature !== expectedSig) {
                return res.status(400).json({
                    error: 'Invalid signature'
                });
            }
        }

        if (transaction.status !== 'pending') {
            return res.status(400).json({
                error: `Transaction already ${transaction.status}`
            });
        }

        // Update transaction
        transaction.status = status;
        transaction.completedAt = new Date();
        await transaction.save();

        console.log(`💳 Transaction ${tid} marked as ${status.toUpperCase()}`);

        // Update order if exists
        if (transaction.orderId) {
            const order = await Order.findById(transaction.orderId);
            if (order) {
                order.paymentStatus = status === 'success' ? 'paid' : 'failed';
                order.status = status === 'success' ? 'confirmed' : 'cancelled';
                await order.save();
            }
        }

        res.status(200).json({
            success: true,
            message: `Payment ${status}`,
            tid: transaction.tid,
            status: transaction.status,
            amount: transaction.amount
        });

    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({
            error: 'Failed to verify payment',
            message: error.message
        });
    }
};

/**
 * @desc    Webhook for automatic payment detection
 * @route   POST /api/payment/webhook
 * @access  Public (secured with signature)
 */
export const paymentWebhook = async (req, res) => {
    try {
        console.log('📥 Webhook received:', JSON.stringify(req.body));

        const { tid, status, amount, upi_ref, signature } = req.body;

        if (!tid || !status) {
            console.error('❌ Invalid webhook data');
            return res.status(400).json({
                error: 'Invalid webhook data'
            });
        }

        // Find transaction
        const transaction = await Transaction.findOne({ tid });

        if (!transaction) {
            console.error('❌ Transaction not found:', tid);
            return res.status(404).json({
                error: 'Transaction not found'
            });
        }

        // Verify webhook signature (optional but recommended)
        if (signature) {
            const expectedSig = crypto
                .createHmac('sha256', MERCHANT_SECRET)
                .update(`${tid}${status}${amount}`)
                .digest('hex');
            if (signature !== expectedSig) {
                console.error('❌ Invalid webhook signature');
                return res.status(400).json({
                    error: 'Invalid signature'
                });
            }
        }

        // Only update if currently pending
        if (transaction.status === 'pending') {
            transaction.status = status;
            transaction.completedAt = new Date();

            if (upi_ref) {
                transaction.upiRef = upi_ref;
            }

            await transaction.save();

            console.log(`✅ Webhook: Transaction ${tid} → ${status.toUpperCase()}`);

            // Update order
            if (transaction.orderId) {
                const order = await Order.findById(transaction.orderId);
                if (order) {
                    order.paymentStatus = status === 'success' ? 'paid' : 'failed';
                    order.status = status === 'success' ? 'confirmed' : 'cancelled';
                    await order.save();
                }
            }
        } else {
            console.log(`⚠️ Transaction ${tid} already ${transaction.status}`);
        }

        res.status(200).json({
            success: true,
            message: 'Webhook processed successfully'
        });

    } catch (error) {
        console.error('❌ Webhook error:', error);
        res.status(500).json({
            error: 'Webhook processing failed',
            message: error.message
        });
    }
};

/**
 * @desc    Get merchant UPI
 * @route   GET /api/payment/merchant-upi
 * @access  Public
 */
export const getMerchantUPI = async (req, res) => {
    try {
        const settings = await Settings.getSettings();
        res.status(200).json({
            upi: settings.merchantUPI
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get merchant UPI'
        });
    }
};

/**
 * @desc    Simulate payment (TESTING ONLY)
 * @route   POST /api/payment/simulate
 * @access  Public
 */
export const simulatePayment = async (req, res) => {
    try {
        const { tid, status } = req.body;

        if (!tid || !status) {
            return res.status(400).json({
                error: 'TID and status required'
            });
        }

        const transaction = await Transaction.findOne({ tid });

        if (!transaction) {
            return res.status(404).json({
                error: 'Transaction not found'
            });
        }

        if (transaction.status !== 'pending') {
            return res.status(400).json({
                error: `Transaction already ${transaction.status}`
            });
        }

        // Simulate payment
        transaction.status = status;
        transaction.completedAt = new Date();
        transaction.upiRef = `SIM${Date.now()}`;
        await transaction.save();

        // Update order
        if (transaction.orderId) {
            await Order.findByIdAndUpdate(transaction.orderId, {
                paymentStatus: status === 'success' ? 'paid' : 'failed',
                orderStatus: status === 'success' ? 'confirmed' : 'cancelled'
            });
        }

        console.log(`🧪 SIMULATION: Transaction ${tid} → ${status.toUpperCase()}`);

        res.json({
            success: true,
            message: `Payment simulated as ${status}`,
            tid,
            status,
            amount: transaction.amount
        });

    } catch (error) {
        console.error('Simulation error:', error);
        res.status(500).json({
            error: 'Simulation failed'
        });
    }
};
