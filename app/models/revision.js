const mongoose = require('mongoose')
mongoose.Promise = global.Promise;

var revisionSchema = mongoose.Schema({
    anon: Boolean,
    commenthidden: Boolean,
    minor: Boolean,
    parentid: Number,
    parsedcomment: String,
    revid: Number,
    sha1: String,
    sha1hidden: Boolean,
    size: Number,
    suppressed: Boolean,
    timestamp: String,
    title: String,
    user: String,
    userhidden: Boolean
});

module.exports.model = mongoose.model('Revision', revisionSchema);
