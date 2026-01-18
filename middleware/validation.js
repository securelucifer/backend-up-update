export const validatePaymentRequest = (req, res, next) => {
    const { amount, payType, upi } = req.body;

    const errors = [];

    // Validate amount
    if (!amount) {
        errors.push('Amount is required');
    } else {
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            errors.push('Amount must be a positive number');
        }
        if (parsedAmount > 100000) {
            errors.push('Amount exceeds maximum limit');
        }
    }

    // Validate payment type
    if (!payType) {
        errors.push('Payment type is required');
    } else if (!['phonepe', 'paytm', 'PhonePe', 'Paytm'].includes(payType)) {
        errors.push('Invalid payment type. Must be phonepe or paytm');
    }

    // Validate UPI
    if (!upi) {
        errors.push('UPI ID is required');
    } else {
        const upiRegex = /^[\w.-]+@[\w.-]+$/;
        if (!upiRegex.test(upi.trim())) {
            errors.push('Invalid UPI ID format');
        }
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            errors: errors
        });
    }

    next();
};
