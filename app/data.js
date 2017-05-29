
const async = require('async')
const fs = require('fs')
const ejs = require('ejs')
const express = require('express')
const moment = require('moment')
const mongoose = require('mongoose')
const path = require('path')
const request = require('request')
const urlencode = require('urlencode')
const winston = require('winston')

const config = require('../config');

var RevisionModel = require('./models/revision').model;

function latestTimestamp(revisions) {
    var latest = 0;
    var revid = null;
    revisions.forEach(function(r) {
        var unixTime = moment(r.timestamp).unix();
        if (unixTime > latest) {
            latest = unixTime;
            revid = r.revid;
        }
    });
    return {latest: latest, revid: revid}
}

function removeFileType(fileName) {
    return fileName.substring(0, fileName.lastIndexOf('.'));
}


// Adds the historical data stored in fileName to the database. Validates that
// a revision doesn't already exist in the database first. This avoids
// duplicates at all costs; this is a performance hit.
function addHistoricalData(title, jsonData, callback) {
    RevisionModel.find(
        {title: title}
    ).sort(
        {'revid': 1}
    ).exec(function(error, revisions) {
        var i = 0;
        var tasks = [];

        // Create tasks for adding missing historical data to the database.
        jsonData.forEach(function(r) {

            // Move our cursor in the revision dataset forward
            while (i < revisions.length && r.revid > revisions[i].revid) {
                i++;
            }

            // Is r already in the database?
            if (i < revisions.length && r.revid == revisions[i].revid) {
                return;
            }

            // Create the task to add it, so we can run them together.
            tasks.push(function(callback) {
                //r.timestamp = new Date(r.timestamp);
                var revision = new RevisionModel(r);
                revision.save(function(error, revision) {
                    if (error) {
                        console.error(error);
                    }

                    callback(null, revision);
                });
            });
        });

        // Run all the tasks and get the list of newly added revisions back
        async.parallel(tasks, function(error, results) {
            winston.info(
                "Processed '%s': inserted %d; found %d existing.",
                title, results.length, revisions.length);
            callback(error, null);
        });
    });
}

function filterHistoricalData(title, jsonData, callback) {
    RevisionModel
        .find({title: title, revid: jsonData[jsonData.length - 1].revid})
        .exec(function(err, revisions) {
            if (revisions.length == 1) {
                winston.info("Processed '%s': up to date", title);
                callback(null, null);
            } else {
                callback(null, title);
            }
        });
}

module.exports.importHistoricalData = function() {
    winston.info("Processing historical archive.");

    return new Promise((resolve, reject) => {
		fileData = new Map();

		fs.readdirSync(config.dataDir).forEach(function(fileName) {
			var rawData = fs.readFileSync(config.dataDir + '/' + fileName, 'utf8');
			var jsonData = JSON.parse(rawData);
			jsonData.sort(function(a, b) {
				return a.revid - b.revid;
			});
			var title = removeFileType(fileName);
			fileData.set(title, jsonData);
		});

		var tasks = [];

		fileData.forEach(function(value, key) {
			tasks.push(function(callback) {
				filterHistoricalData(key, value, callback);
			});
		});

		async.parallel(tasks, function(error, titles) {
			titles = titles.filter(function(e) { return e !== null; });
			tasks = [];

            // For each title, check if 
			titles.forEach(function(title) {
				tasks.push(function(callback) {
					addHistoricalData(title, fileData.get(title), callback);
				});
			});

            winston.info("Created import tasks...");

			async.series(tasks, function(error, results) {
				winston.info("Finished importing historical data.");
				resolve("done");
			});
		});
	});
}

function getLatestRevisionInDatabase(title) {
    return new Promise((resolve, reject) => {
        RevisionModel
            .find({title:title})
            .sort({revid: -1})
            .limit(1)
            .exec(function(err, revisions) {
                if (err) {
                    reject(err);
                } else if (revisions.length == 0) {
                    resolve({title: title, timestamp: 0});
                } else {
                    winston.info("%s: %s", title, revisions[0].timestamp);
                    resolve({
                        revision: revisions[0],
                        title: title,
                        timestamp: revisions[0].timestamp
                    });
                }
            });
    });
}

function createQuery(title, timestamp) {
    const wikiEndpoint = "https://en.wikipedia.org/w/api.php";
    var parameters = [
        'action=query',
        'format=json',
        'prop=revisions',
        'titles=' + urlencode(title),
        'rvprop=sha1|parsedcomment|size|timestamp|userid|user|ids',
        'rvlimit=max',
        'rvstart=' + new Date(timestamp).toISOString(),
        'rvdir=newer'
    ];

    return {
        'url': wikiEndpoint + "?" + parameters.join("&"),
        'Accept': 'application/json',
        'Accept-Charset': 'utf-8'
    }
}

function getLatestRevisionsOnWikipedia(data) {
    return new Promise((resolve, reject) => {

        var currTimestamp = data.timestamp;
        var allRevisions = [];

        function requestSeries(err, res, body) {
            if (err) {
                reject("Me: " + err);
                return;
            }

            if (res.statusCode !== 200) {
                reject(new Error("Status code was " + res.statusCode));
                return;
            }

            json = JSON.parse(body);
            pages = json.query.pages;
            revisions = pages[Object.keys(pages)[0]].revisions;

            if (revisions == undefined) {
                resolve({
                    revisions: []
                });
                return
            }

            allRevisions = allRevisions.concat(
                revisions.slice(1, revisions.length));

            if (revisions.length < 500) {
                if (allRevisions.length > 0) {
                    winston.info('%s: %s - %s: There are %d revisions.',
                        data.title,
                        allRevisions[0].timestamp,
                        allRevisions[allRevisions.length - 1].timestamp,
                        allRevisions.length);
                }
                data.revisions = allRevisions;
                resolve(data);
                return;
            }

            options = createQuery(
                data.title,
                revisions[revisions.length - 1].timestamp);
            request(options, requestSeries);
        }

        var options = createQuery(data.title, currTimestamp);

        request(options, requestSeries);
    });
}

function insertRevisionsIntoDatabase(data) {
    return new Promise((resolve, reject) => {

        if (data.revisions.length == 0) {
            resolve(null);
            return;
        }

        var tasks = [];

        data.revisions.forEach(function(revision) {
            tasks.push(function(callback) {
                revision.title = data.title;
                //revision.timestamp = new Date(revision.timestamp);
                (new RevisionModel(revision)).save(function(error, r) {
                    if (error) {
                        winston.error(error);
                        callback(null, null);
                    } else {
                        callback(null, revision);
                    }
                });
            });
        });

        async.parallel(tasks, function(error, results) {
            results = results.filter(function(e) { return e !== null; });
            winston.info("%s: inserted %d new revisions.",
                data.title, results.length);
            resolve(results);
        });
    });
}

module.exports.getLatestRevisions = function(title) {
    return getLatestRevisionInDatabase(title)
        .then(getLatestRevisionsOnWikipedia)
        .then(insertRevisionsIntoDatabase);
}

