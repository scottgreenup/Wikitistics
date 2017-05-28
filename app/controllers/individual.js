
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
                res.send("0");
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
}

module.exports.byYearByUser = function(req, res) {
    if (!req.query.article) {
        res.send("failure");
        return;
    }
}

module.exports.byUser = function(req, res) {
    if (!req.query.article) {
        res.send("failure");
        return;
    }
}

module.exports.byYearByTopFive = function(req, res) {
    if (!req.query.article) {
        res.send("failure");
        return;
    }
}

