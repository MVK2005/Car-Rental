const { StreamingQuerystring } = require('formidable');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const chatSchema =new Schema({
    sender: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    receiver: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    date: {
        type: Date,
        default: Date.now
    },
    senderRead: {
        type: Boolean,
        default: false
    },  
    receiverRead: {
        type: Boolean,
        default: false
    },
    dialogue: [{
        sender: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        receiver: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        senderMessage: {
            type: String
        },
        receiverMessage: {
            type: String
        }, 
        senderRead: {
            type: Boolean,
            default: false
        },  
        receiverRead: {
            type: Boolean,
            default: false
        },
        date: {
            type: Date,
            default: Date.now
        }                
    }]
});
module.exports = mongoose.model('Chat', chatSchema);