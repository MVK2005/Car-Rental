const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const budgetSchema = new Schema({
    carID: {
        type: Schema.Types>mongoose.isValidObjectId,
        ref:'Car'
    },
    total: {
        type: Number
    },
    renter: {
        type: Schema.Types>mongoose.isValidObjectId,
        ref:'User'        
    },
    date: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('budget',budgetSchema);