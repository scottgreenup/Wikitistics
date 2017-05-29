
const express = require('express');
const fs = require('fs');
const mongoose = require('mongoose');
const util = require('util');
const winston = require('winston');

var RevisionModel = require('../models/revision').model;

module.exports.showPage = function(req, res) {
    if (!req.query.article) {
        res.redirect('/individual?article=Australia');
        return;
    }

    content = {
        'title': 'Wikistats',
    }

    res.render('individual', content);
}

module.exports.articleList = function(req, res) {
    RevisionModel.aggregate([
        {

            $group: {
                _id: '$title'
            }
        }
    ], function(err, docs) {
        var articleList = [];
        docs.forEach(function(doc) {
            articleList.push(doc._id);
        });
        res.send(articleList);
    });

}

module.exports.revisionCount = function(req, res) {
    if (!req.query.article) {
        res.send("failure");
        return;
    }

    var articleTitle = req.query.article;

    RevisionModel
        .find({title: articleTitle})
        .count(function(err, count) {
            if (err) {
                res.send(err);
            } else {
                res.send("" + count);
            }
        });
}

module.exports.topFiveUsers = function(req, res) {
    if (!req.query.article) {
        res.send("failure");
        return;
    }

    var articleTitle = req.query.article;

    RevisionModel.aggregate([
        {
            $match: {
                title: articleTitle
            }
        },
        {
            $group: {
                _id: '$user',
                count: {$sum: 1}
            },
        },
        {
            $sort: {
                count: -1
            }
        },
        {
            $limit: 5
        }
    ], function(err, docs) {
        if (err) {
            res.send(err);
            return;
        }

        var array = [];
        docs.forEach(function(doc) {
            array.push({
                username: doc._id,
                count: doc.count
            });
        });

        res.send(array);
    });
}

module.exports.byYearByUser = function(req, res) {
    if (!req.query.article) {
        res.send("failure");
        return;
    }

    var articleTitle = req.query.article;

    RevisionModel.aggregate([
		{
			$match: {
				title: articleTitle,
			}
		},
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

// This needs to create a pie chart
module.exports.byUser = function(req, res) {
    if (!req.query.article) {
        res.send("failure");
        return;
    }

    var articleTitle = req.query.article;

    RevisionModel.aggregate([
		{
			$match: {
				title: articleTitle,
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

module.exports.byYearByTopFive = function(req, res) {
    if (!req.query.article) {
        res.send("failure");
        return;
    }

    var articleTitle = req.query.article;

    var promiseA = new Promise((resolve, reject) => {
		RevisionModel.aggregate([
			{
				$match: {
					title: articleTitle
				}
			},
			{
				$group: {
					_id: '$user',
					count: {$sum: 1}
				},
			},
			{
				$sort: {
					count: -1
				}
			},
			{
				$limit: 5
			}
		], function(err, docs) {
			if (err) {
				reject(err);
				return;
			}

			var array = [];
			docs.forEach(function(doc) {
				array.push({
					user: doc._id,
				});
			});

			resolve(array);
		});
	});


	var muffinProcessor = function(topFiveUsers) {


		RevisionModel.aggregate([
			{
				$match: {
					title: articleTitle,
				}
			},
			{
				$match: {
					$or: topFiveUsers
				}
			},
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
				}
			}
		], function(err, docs) {
			if (docs === undefined) {
				res.send("failure");
				return;
			}

			var bots = fs.readFileSync('./bot.txt', 'utf8');
			bots = new Set(bots.toString().split('\n'));
			var admins = fs.readFileSync('./admin.txt', 'utf8');
			admins = new Set(admins.toString().split('\n'));

			var dataTable = {
			};

			topFiveUsers.forEach(function(user) {
				dataTable[user.user] = [];
			});

			docs.forEach(function(doc) {
				dataTable[doc._id.user].push({
					label: doc._id.year.toString(),
					y: doc.count
				});
			});

			res.send(JSON.stringify(dataTable));
		});
	};

	promiseA.then(muffinProcessor).catch(function(error) {
		res.send(error);
	});
}

