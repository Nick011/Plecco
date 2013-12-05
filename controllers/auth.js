var nodemailer = require('nodemailer'),
    bcrypt = require('bcrypt'),
	salt = bcrypt.genSaltSync(10),
	User = require('../models/schema').User;

function randomString(len, charSet) {
    charSet = charSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var randomString = '',
    i = len;
    while (i--) {
        var randomPoz = Math.floor(Math.random() * charSet.length);
        randomString += charSet.substring(randomPoz, randomPoz + 1);
    }
    return randomString;
}

exports.show_signup = function(req, res) {
    var c = {csrf_token: req.session._csrf};
    res.render('signup', c);
};

exports.process_signup = function(req, res) {
    var c = {
        twitter: req.body.twitter,
        facebook: req.body.facebook,
        image: req.body.image,
        email: req.body.email,
        username: req.body.username,
        name: {first: req.body.first_name, last: req.body.last_name},
        password: req.body.password,
		active: true,
		online: true
    };
   
    User.findOne({email: c.email}, function(error, user) {
		console.log(JSON.stringify(user));
		if (error) {
		    console.log(error);
		    res.redirect('/login/error');
		}
		else if (!user) {
		    user = new User(c);	    
		    user.session = bcrypt.hashSync(randomString(24), salt);
		    user.password = bcrypt.hashSync(user.password, salt);
		    user.save(function(error) {
				if (error) {
				    console.log(error);
				    res.redirect('/login/error');
				}
				else {
				    delete user.password;
				    delete user.email;
				    req.session.user_token = user;
				    res.redirect('/lobby');
				}
		    });
		}
		else {
            valid = bcrypt.compareSync(c.password, user.password);
            if (valid) {
                user.facebook = c.facebook;
                user.twitter = c.twitter;
                res.redirect('/lobby');
                user.save(function(error) {
                    if (error) {
                        console.log(error);
                    }
                });
            }
            else {
                res.redirect('/login/error');
            }
		}
    });
    
};

exports.login = function(req, res) {
    var c = req.body,
   		query = (c.username.indexOf('@') >= 0) ? {email: c.username} : {username: c.username};
   
    User.findOne(query, function(error, user) {
		var valid;
		if (error) {
		    console.log(error);
		    res.redirect('/500');
		}
		else if (!user) {
		    res.redirect('/signup');
		}
		else {
		    valid = bcrypt.compareSync(c.password, user.password);
		    if (valid) {
				delete user.password;
				delete user.email;
				user.session = bcrypt.hashSync(randomString(24), salt);
				user.save(function(error) {
					if (error) {
						console.log(error);
						res.redirect('/500');
					}
					else {
						req.session.user_token = user;
						res.redirect('/lobby');	
					}
				});
			}
		    else {
                var context = {
                    csrf_token: req.session._csrf,
                    error: 'Your username or password is incorrect.'
                };
				res.render('index', context);
		    }
		}
    });

};

exports.logout = function(req, res) {
    req.session.destroy();
    res.redirect('/');
};

exports.show_account = function(req, res) {
    var user = req.session.user_token;
    User.findOne({_id: user._id}, function(error, user) {
        if (error) {
            console.log(error);
            res.redirect('/500');
        }
        else if (!user) {
            res.redirect('/404');
        }
        else {
            delete user.email;
            delete user.password;
            user.edit = true;
            user.first_name = user.name.first;
            user.last_name = user.name.last;
            user.csrf_token = req.session._csrf;
            res.render('signup', user);
        }

    });
};

exports.update_account = function(req, res) {
    var user = req.session.user_token;
    User.findOne({_id: user._id}, function(error, user) {
        if (error) {
            console.log(error);
            res.redirect('/500');
        }
        else if (!user) {
            res.redirect('/404');
        }
        else {
            user.username = req.body.username;
            user.email = req.body.email;
            user.name.first = req.body.first_name;
            user.name.last = req.body.last_name;
            user.save(function(error) {
                if (error) {
                    console.log(error);
                    res.redirect('/500');
                }
                else {
                    delete user.email;
                    delete user.password;
                    user.edit = true;
                    user.updated = true;
                    user.first_name = user.name.first;
                    user.last_name = user.name.last;
                    user.csrf_token = req.session._csrf;
                    res.render('signup', user);
                }
            })
        }
    })

};

exports.check_user = function(req, res) {
    var valid;
    User.findOne({email: req.body.email}, function(error, user) {
        if (error) {
            console.log(error);
            res.json(500, {error: 'Something Broke. Sorry.'});
        }
        else if (user) {
            if (!req.twitter) {
                res.json({error: 'The email you entered is already in our system. \n Please use the password recovery.'});
            }
            else {
                valid = bcrypt.compareSync(req.password, user.password);
                if (!valid) {
                    res.json({error: 'The email you entered is already in our system. \n Please use the password recovery.'});
                }
                else {
                    res.json({error: false});
                }
            }
        }
        else {
            User.findOne({username: req.body.username}, function(error, user) {
                if (error) {
                    console.log(error);
                    res.json(500, {error: 'Something Broke. Sorry.'});
                }
                else if (user) {
                    if (!req.twitter) {
                        res.json({error: 'Someone has that username.\n Please choose another.'});
                    }
                    else {
                        valid = bcrypt.compareSync(req.password, user.password);
                        if (!valid) {
                            res.json({error: 'The username you entered is already in our system. \n Please use the password recovery.'});
                        }
                        else {
                            res.json({error: false});
                        }
                    }
                }
                else {
                    res.json({error: false});
                }
            });
        }
    });
};

exports.show_recover = function(req, res) {
    var c = {csrf_token: req.session._csrf};
    res.render('recover_password', c);
};

exports.process_recover = function(req, res) {
    var email = req.body.email.split(',')[0];
    User.findOne({email: email}, function(error, user) {
        if (error) {
            console.log(error);
        }
        else if (user) {
            var resetURL = 'http://plec.co/reset/password/'+ encodeURIComponent(user.session);
            var c = {
                message: 'Success. A password recovery email has been sent to ' + user.email
            };

            var transport = nodemailer.createTransport('sendmail', {
                path: '/usr/sbin/sendmail',
                args: ['-f admin@plec.co']
            });

            var mail = {
                to: email,
                subject: 'Plecco Password Reset',
                html: '<h2>Reset Password</h2><p>Use this link to reset your password.<br> <a href=' + resetURL +'>'+ resetURL +'</a></p>'
            };

            transport.sendMail(mail, function(error, response) {
                if (error) {
                    console.log(error);
                }
                else {
                    console.log("Email send: " + response.message);
                    res.render('recover_password', c);
                }
            });
        }
        else {
            var c = {
                csrf_token: req.session._csrf,
                error: 'The email you entered is not currently in our system!'
            };

            res.render('recover_password', c);
        }
    });
};

exports.show_reset = function(req, res) {
    var token = req.params.token;
    if (!token) {
        res.redirect('/500');
    }
    
    User.findOne({session: token}, function(error, user) {
        if (error) {
            console.log(error);
        }
        else if (user) {
            var c = {
                csrf_token: req.session._csrf,
                token: user.session
            }
            res.render('reset_password', c);
        }
        else {
            var c = {
                message: 'Error reseting password! It is likely the link you used to reset the password has expired. Please use the "forgot password" link.'
            };
            res.render('reset_password', c);
        }
    });
};

exports.process_reset = function(req, res) {
    var token = req.body.token;
    var password = req.body.password;
    User.findOne({session: token}, function(error, user) {
        if (error) {
            console.log(error);
        }
        else if (user) {
            user.password = bcrypt.hashSync(password, salt);
            user.save(function(error) {
                if (error) {
                    console.log(error);
                }
                else {
                    var c = {
                        message: 'Your password has been changed! You can now login.'
                    };
                    res.render('reset_password', c);
                }
            });
        }
        else {
            var c = {
                message: 'Error reseting password! It is likely the link you used to reset the password has expired. Please use the "forgot password" link.'
            };
            res.render('reset_password', c);
        }   
    });
};
