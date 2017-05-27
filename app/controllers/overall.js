
const mongoose = require('mongoose');
const express = require('express');

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

