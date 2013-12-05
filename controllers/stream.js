/**
 * Created by .
 * User: nick
 * Date: 8/28/11
 * Time: 7:50 PM
 * To change this template use File | Settings | File Templates.
 */
var OAuth = require('oauth').OAuth,
User = require('../models/user').User;


exports.home = function(req, res) {
    User.get('id='+req.session.user_token.id, function(user) {
	context = user;
	res.render('home', context);
    });
};

