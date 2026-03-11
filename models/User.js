const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' } // Hum 'admin' bhi rakh sakte hain baad mein
});

module.exports = mongoose.model('User', userSchema);