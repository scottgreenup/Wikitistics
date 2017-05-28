
const express = require('express');
const mongoose = require('mongoose');
const util = require('util');

var RevisionModel = require('../models/revision').model;

module.exports.showPage = function(req, res) {
    content = {
        'title': 'Wikistats',
    }

    res.render('overall', content);
}

module.exports.mostRevisions = function(req, res) {
    RevisionModel.aggregate([
        {
            $group: {
                _id: '$title',
                count: {$sum: 1}
            },
        }
    ], function(err, counts) {
        counts.sort(function(a, b) {
            return a.count - b.count;
        });

        res.send(counts[counts.length - 1]._id);
    });
}

module.exports.leastRevisions = function(req, res) {
    RevisionModel.aggregate([
        {
            $group: {
                _id: '$title',
                count: {$sum: 1}
            },
        }
    ], function(err, counts) {
        counts.sort(function(a, b) {
            return a.count - b.count;
        });

        res.send(counts[0]._id);
    });
}

module.exports.mostUsers = function(req, res) {
    RevisionModel.aggregate([
        {
            $match: {
                anon: { $exists: false },
                user: { $exists: true },
            }
        },
        {
            $group: {
                _id: "$title",
                users: {$addToSet: "$user"}
            },
        }
    ], function(err, counts) {

        var maxCount = 0;
        var maxTitle = null;

        counts.forEach(function(count) {
            if (count.users.length >= maxCount) {
                maxCount = count.users.length;
                maxTitle = count._id;
            }
        });

        res.send(
            util.format(
                "%s has %d registered users who've edited it.",
                maxTitle,
                maxCount
        ));

    });
}

module.exports.leastUsers = function(req, res) {
    RevisionModel.aggregate([
        {
            $match: {
                anon: { $exists: false },
                user: { $exists: true },
            }
        },
        {
            $group: {
                _id: "$title",
                users: {$addToSet: "$user"}
            },
        }
    ], function(err, counts) {

        var minCount = counts[0].users.length;
        var minTitle = counts[0]._id;

        var skipFirst = true;

        counts.forEach(function(count) {
            if (skipFirst) {
                skipFirst = false;
                return;
            }
            if (count.users.length <= minCount) {
                minCount = count.users.length;
                minTitle = count._id;
            }
        });

        res.send(
            util.format(
                "%s has %d registered users who've edited it.",
                minTitle,
                minCount
        ));
    });
}

module.exports.oldestTimestamp = function(req, res) {
    RevisionModel.aggregate([
        {
            $match: {
                title: { $exists: true },
            }
        },
        {
            $sort: {
                timestamp: 1
            }
        },
        {
            $limit: 1
        }
    ], function(err, doc) {
        res.send(util.format(
            "%s is the oldest article (%s)",
            doc[0].title,
            doc[0].timestamp
        ));
    });
}

module.exports.youngestTimestamp = function(req, res) {
    RevisionModel.aggregate([
        {
            $match: {
                title: { $exists: true },
            }
        },
        {
            $group : {
                _id: "$title",
                timestamp: { $min: '$timestamp' },
            }
        },
        {
            $sort: {
                timestamp: -1
            }
        }
    ], function(err, docs) {

        res.send(util.format(
            "%s is the newest article (%s)",
            docs[0]._id,
            docs[0].timestamp
        ));
    });
}
