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

const config = require('./config');
const appData = require('./app/data');

var RevisionModel = require('./app/models/revision').model;
var app = express()

app.set('view engine', 'ejs');
app.use('/static', express.static('public'));
app.use('/overall', require('./app/routes/overall'));
app.use('/individual', require('./app/routes/individual'));

// Redirect the user straight to the overall statistics route
app.get('/', function(req, res) {
    res.redirect('/overall');
})

app.listen(config.port, function() {
    console.log('Running on :%d', config.port);
});



mongoose.connect(config.database.hostname)
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error: '));
db.once('open', function() {
    winston.info("Connected to %s", config.database.hostname);

    /*
	appData.importHistoricalData().then(function(done) {
		winston.info("Updating dataset.");
		RevisionModel.find({}).distinct('title', function(error, titles) {
			function perform(index) {
				if (index < titles.length) {
					appData.getLatestRevisions(titles[index]).then(function(results) {
						perform(index + 1);
					});
				}
			}
			perform(0);
		});
	});
    */
});

