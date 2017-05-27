
const express = require('express');

module.exports.showPage = function(req, res) {
    content = {
        'title': 'Wikistats',
    }

    res.render('overall', content);
}
