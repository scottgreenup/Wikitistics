
const express = require('express');
const fs = require('fs');
const mongoose = require('mongoose');
const util = require('util');
const winston = require('winston');

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

module.exports.byYearByUser = function(req, res) {
    var yearToUser = new Map();

    RevisionModel.aggregate([
        {
            $addFields: {
                year: {
                    $year: "$timestamp"
                }
            }
        },
        {
            $group: {
                _id: { user: "$user", year: "$year" },
                count: { $sum: 1 },
                anon: { $addToSet: "$anon" }
            }
        }
    ], function(err, docs) {

        if (docs === undefined) {
            res.send("failure");
            return;
        }

        var map = new Map();

        map.set('admin', new Map())
        map.set('anon', new Map())
        map.set('bot', new Map())
        map.set('user', new Map())

        var bots = fs.readFileSync('./bot.txt', 'utf8');
        bots = new Set(bots.toString().split('\n'));
        var admins = fs.readFileSync('./admin.txt', 'utf8');
        admins = new Set(admins.toString().split('\n'));

        docs.forEach(function(doc) {

            var key = 'user';

            if (doc.anon.length == 1) {
                key = 'anon'
            } else if (bots.has(doc._id.user)) {
                key = 'bot'
            } else if (admins.has(doc._id.user)) {
                key = 'admin'
            }

            var yearMap = map.get(key);
            if (yearMap.has(doc._id.year) == false) {
                yearMap.set(doc._id.year, 1)
            } else {
                yearMap.set(doc._id.year, yearMap.get(doc._id.year) + 1);
            }
            map.set(key, yearMap);

        });

        var dataTable = {
            admin: [],
            anon: [],
            bot: [],
            users: []
        };

        function createObj(count, year) {
            return {
                label: year.toString(),
                y: count
            }
        }

        map.get('admin').forEach(function(count, year) {
            dataTable.admin.push(createObj(count, year));
        });

        map.get('anon').forEach(function(count, year) {
            dataTable.anon.push(createObj(count, year));
        });

        map.get('bot').forEach(function(count, year) {
            dataTable.bot.push(createObj(count, year));
        });

        map.get('user').forEach(function(count, year) {
            dataTable.users.push(createObj(count, year));
        });

        res.send(JSON.stringify(dataTable));
    });

}

module.exports.byUser = function(req, res) {
    RevisionModel.aggregate([
        {
            $group: {
                _id: { user: "$user", year: "$year" },
                count: { $sum: 1 },
                anon: { $addToSet: "$anon" }
            }
        }
    ], function(err, docs) {

        if (docs === undefined) {
            res.send("failure");
            return;
        }


        var dataTable = {
            admin: 0,
            anon: 0,
            bot: 0,
            user: 0
        }

        var bots = fs.readFileSync('./bot.txt', 'utf8');
        bots = new Set(bots.toString().split('\n'));
        var admins = fs.readFileSync('./admin.txt', 'utf8');
        admins = new Set(admins.toString().split('\n'));

        docs.forEach(function(doc) {
            if (doc.anon.length == 1) {
                dataTable.anon += 1;
            } else if (bots.has(doc._id.user)) {
                dataTable.bot += 1;
            } else if (admins.has(doc._id.user)) {
                dataTable.admin += 1;
            } else {
                dataTable.user += 1;
            }
        });

        dataTable = [
            {y: dataTable.admin, indexLabel: "admin" },
            {y: dataTable.anon, indexLabel: "anon" },
            {y: dataTable.bot, indexLabel: "bot" },
            {y: dataTable.user, indexLabel: "user" }
        ];

        res.send(JSON.stringify(dataTable));
    });

}
