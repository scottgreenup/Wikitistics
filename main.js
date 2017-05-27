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

app.listen(8000, function() {
    console.log('Running on :8000');
});

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

function processArticleFile(filename, RevisionCls, callback) {

    // Load and sort the historical data by revid
    var data = JSON.parse(fs.readFileSync(dataDir + '/' + filename, 'utf8'));
    data.sort(function(a, b) {
        return a.revid - b.revid;
    });

    var article = new Article(filename, data)
    var tasks = [];

    // Find all revisions in the database for this article, then see if our
    // historical data has any elements missing from the database. If it does,
    // add it.
    RevisionCls
        .find({title: article.title})
        .sort({"revid": 1})
        .exec(function(err, revisions) {
            var i = 0;

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
                    revision = new RevisionCls(r);
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

    /*
    var count = 1;
    var tasks = [];

    data.forEach(function(rev) {
        if ('suppressed' in rev) {
            return;
        }

        revision = new RevisionCls(rev);
        tasks.push(function(callback) {
            revision.save(function(error, revision) {
                if (error) {
                    console.error(error);
                }

                callback(null, revision);
            });
        });
    });

    async.parallel(tasks, function(error, results) {
        console.log("Processed " + article.title + ": inserted " + results.length + " documents.");
        callback(error, results.length);
    });
    // */

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

var dataDir = './data'
var files = fs.readdirSync(dataDir)
var databaseAddress = 'mongodb://localhost/wikipedia_6'

mongoose.connect(databaseAddress)

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


    winston.info("Processing historical archive.");

    // Processing in series otherwise to many asynchronous callbacks are waiting
    // to run, causing an OOM error.
    var tasks = [];
    files.forEach(function(filename) {
        tasks.push(function(callback) {
            processArticleFile(filename, Revision, callback);
       });
    });
    async.series(tasks);
});

