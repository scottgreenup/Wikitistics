//==========================================================================
// :might indicate an edit summary that has been removed
// https://en.wikipedia.org/w/index.php?title=Wii&offset=20070216183012&limit=500&action=history&tagfilter=
// Refer to 19:16, 12 February 2007 on this article
//
//  "title": "Wii",
//  "timestamp": "2007-02-12T19:16:03Z",
//  "userhidden": "",
//  "revid": 107623492,
//  "parentid": 107621130,
//  "sha1hidden": "",
//  "suppressed": "",
//  "commenthidden": "",
//  "size": 48852
//
//==========================================================================

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

mongoose.Promise = global.Promise;

var app = express()

app.set('view engine', 'ejs');
app.use('/static', express.static('public'));
app.use('/overall', require('./app/routes/overall'));
app.use('/individual', require('./app/routes/individual'));

// Redirect the user straight to the overall statistics route
app.get('/', function(req, res) {
    res.redirect('/overall');

})

const PORT = 8000;

app.listen(PORT, function() {
    console.log('Running on :%d', PORT);
});

var dataDir = './data'

//------------------------------------------------------------------------------

class Article {
    constructor(filename, data) {
        this._filename = filename;
        this._data = data;
        this._revisions = null;
        this._users = null;
        this._age = null;
    }

    get revisionLen() {
        if (!this._revisions) {
            this._revisions = this._data.length;
        }

        return this._revisions;
    }

    get users() {
        if (!this._users) {
            var userSet = new Set();
            this._data.forEach(function(e, index) {
                if ('userhidden' in e || e.user === undefined) {
                    return;
                }

                userSet.add(e.user);
            });
            this._users = userSet;
        }

        return this._users;
    }

    get age() {
        if (!this._age) {
            var minTime = null;

            this._data.forEach(function(e) {
                var time = moment(e.timestamp).unix();
                if (minTime == null || minTime > time) {
                    minTime = time;
                }
            });

            this._age = minTime;
        }

        var dif = moment().unix() - this._age;
        var dur = moment.duration(dif, 'seconds');
        var age = dur.years() + ' years ' +
            dur.months() + ' months ' +
            dur.days() + ' days ' +
            dur.hours() + ':' + dur.minutes() + ':' + dur.seconds();

        return age;
    }

    get title() {
        if (!this._name) {
            // remove the file's filetype suffix
            this._name = this._filename.substring(
                0, this._filename.lastIndexOf('.'));
        }

        return this._name;
    }
}

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

function processArticleFile(data, title, RevisionModel, callback) {

    // Find all revisions in the database for this article, then see if our
    // historical data has any elements missing from the database. If it does,
    // add it.
    var addHistoricalData = function(callback) {
        RevisionModel
            .find({title: title})
            .sort({"revid": 1})
            .exec(function(err, revisions) {
                var i = 0;
                var tasks = [];

                data.forEach(function(r) {
                    while (i < revisions.length && r.revid > revisions[i].revid) {
                        i++;
                    }

                    if (i < revisions.length) {
                        if (r.revid == revisions[i].revid) {
                            return;
                        }
                    }

                    // add r to the database
                    tasks.push(function(callback) {
                        revision = new RevisionModel(r);
                        revision.save(function(error, revision) {
                            if (error) {
                                console.error(error);
                            }

                            callback(null, revision);
                        });
                    });
                });

                // Run every task in parallel, when they are all finished, execute
                // the callback for processArticleFile
                async.parallel(tasks, function(error, results) {
                    winston.info(
                        "Processed '%s': inserted %d; found %d existing.",
                        article.title, results.length, revisions.length);
                    callback(error, results.length);
                });
            });
    }

    RevisionModel
        .find({title: title, revid: data[data.length - 1].revid})
        .exec(function(err, revisions) {
            if (revisions.length == 1) {
                winston.info("Processed '%s': up to date", title);
                callback(null, null);
            } else {
                callback(null, addHistoricalData);
            }
        });

    /*
    var wikiEndpoint = "https://en.wikipedia.org/w/api.php";
    var parameters = [
        'action=query',
        'format=json',
        'prop=revisions',
        'titles=' + urlencode(article.name),
        'rvprop=sha1|parsedcomment|size|timestamp|userid|user|ids',
        'rvlimit=3'
    ];
    var url = wikiEndpoint + "?" + parameters.join("&");
    var options = {
        'url': url,
        'Accept': 'application/json',
        'Accept-Charset': 'utf-8'
    }

    request(options, function(err, res, data) {
        if (err) {
            console.error(err);
            return;
        }

        if (res.statusCode !== 200) {
            console.error("Error code was " + res.statusCode);
            console.log(data);
            return;
        }

        json = JSON.parse(data)
        pages = json.query.pages
        revisions = pages[Object.keys(pages)[0]].revisions
        console.log("There are " + revisions.length + " revisions.");
        console.log(revisions);
    });
    // */
}

var databaseAddress = 'mongodb://localhost/wikipedia_7'
mongoose.connect(databaseAddress)

function importHistoricalData(RevisionModel) {
    winston.info("Processing historical archive.");

    var files = fs.readdirSync(dataDir)
    var tasks = [];

    files.forEach(function(filename) {
        tasks.push(function(callback) {
            var rawData = fs.readFileSync(dataDir + '/' + filename, 'utf8');
            var jsonData = JSON.parse(rawData).sort(function(a, b) {
                return a.revid - b.revid;
            });
            var title = filename.substring(0, filename.lastIndexOf('.'));
            processArticleFile(jsonData, title, RevisionModel, callback);
       });
    });

    async.parallel(tasks, function(error, insertTasks) {
        insertTasks = insertTasks.filter(function(e) { return e != null });
        async.series(insertTasks);
    });
}

// Create a connection to localhost on database called temporary
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error: '));
db.once('open', function() {
    winston.info("Connected to %s", databaseAddress);

    // Create a schema in mongoDB, and compile it into a model
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

    var Revision = mongoose.model('Revision', revisionSchema);

    importHistoricalData(Revision);
});

