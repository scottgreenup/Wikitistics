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

const fs = require('fs')
const ejs = require('ejs')
const express = require('express')
const moment = require('moment')
const mongoose = require('mongoose')
const path = require('path')
const request = require('request')
const urlencode = require('urlencode')

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

var articleMap = new Map();

function processArticleFile(filename, RevisionCls) {

    // TODO read in all data asynchronously and then process
    var data = JSON.parse(fs.readFileSync(dataDir + '/' + filename, 'utf8'));
    var article = new Article(filename, data)

    //articleMap.set(article.name, article);

    data.forEach(function(rev) {
        revision = new RevisionCls(rev);

        /*
        x = {
            minor: 'minor' in rev ? rev.minor : false,
            revid: 'revid' in rev ? rev.revid : null,
            parentid: 'parentid' in rev ? rev.parentid : null,
            size: 'size' in rev ? rev.size : null,
            suppressed: 'suppressed' in rev,
            title: article.title,
            timestamp: rev.timestamp,
        };

        if ('userhidden' in rev) {
            revision.anon = null;
            revision.user = null;
            revision.userhidden = true;
        } else if ('anon' in rev) {
            revision.anon = true;
            revision.user = rev.user;
            revision.userhidden = false;
        } else {
            revision.anon = false;
            revision.user = rev.user;
            revision.userhidden = false;
        }

        if ('commenthidden' in rev) {
            revision.commenthidden = true;
            revision.parsedcomment = null;
        } else {
            revision.commenthidden = false;
            revision.parsedcomment = (
                'parsedcomment' in rev ? rev.parsedcomment : null);
        }

        if ('sha1hidden' in rev) {
            revision.sha1 = null;
            revision.sha1hidden = true;
        } else {
            revision.sha1 = rev.sha1;
            revision.sha1hidden = false;
        }
        */
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

    console.log("Processed: " + article.title);
}

var dataDir = './data'
var files = fs.readdirSync(dataDir)
files = files.slice(0, 20);

// sync

mongoose.connect('mongodb://localhost/wikipedia_2')

// Create a connection to localhost on database called temporary
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error: '));
db.once('open', function() {
    console.log("We are now connected to the database...");

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

    // Go through all the files and load each and everyone of them into the
    // database, and show that we are awesome...

    files.forEach(function(filename) {
        processArticleFile(filename, Revision);
    });

});

