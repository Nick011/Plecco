var OAuth = require('oauth').OAuth,
    schema = require('../models/schema'),
    User = schema.User;

//check for twitter token, request connection if not available
exports.connect = function(req, res) {
    //if not logged in, redirect to login
    if (req.session.twitter_access_token) {
		res.redirect("/lobby");
    }
    else {
        var getRequestTokenUrl = "https://api.twitter.com/oauth/request_token";

        var oa = new OAuth(getRequestTokenUrl,
                          "https://api.twitter.com/oauth/access_token",
                          "UX9p3uhoFjajOonrMNXMTg",
                          "Ar74zXN4mWmmXPj3HtP9aHfZdOzMHJbU5PbppHHZr4",
                          "1.0",
                          "http://plec.co/twitter-cb",
                          "HMAC-SHA1");

        oa.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, results) {
            if (error) {
                console.log('error');
                console.log(error);
            }
            else {
                // store the tokens in the session
                req.session.oa = oa;
                req.session.tw_oauth_token = oauth_token;
                req.session.tw_oauth_token_secret = oauth_token_secret;

                // redirect the user to authorize the token
                res.redirect("https://api.twitter.com/oauth/authorize?oauth_token="+oauth_token);
            }
        });   
    }
};

//receive callback from twitter to confirm connection
exports.callback = function(req, res) {
    var oa = new OAuth(req.session.oa._requestUrl,
	                  req.session.oa._accessUrl,
	                  req.session.oa._consumerKey,
	                  req.session.oa._consumerSecret,
	                  req.session.oa._version,
	                  req.session.oa._authorize_callback,
	                  req.session.oa._signatureMethod);

    oa.getOAuthAccessToken(
        req.session.tw_oauth_token,
        req.session.tw_oauth_token_secret,
    	req.param('oauth_verifier'),
    	function(error, oauth_access_token, oauth_access_token_secret, results2) {
    		if (error) {
    			console.log('error');
    			console.log(error);
    		}
    		else {
                req.session.twitter_access_token = oauth_access_token;
        		oa.getProtectedResource(
                    "http://api.twitter.com/1/account/verify_credentials.json",
                    "GET",
        		    oauth_access_token,
        		    oauth_access_token_secret,
        		    function (error, data, response) {
                        if (error) {
                            console.log(error);
                        }
                        else {
                            data = JSON.parse(data);
                            var token = req.session.user_token;
                            var query = token ? {id: token.id} : {twitter: data.id};
                            
            			    User.findOne(query, function(error, user) {
                                var c;
                				if (error) {
                				    console.log(error);
                				    res.redirect('/login/error');
                				}
                                else if (!user) {
                                    User.findOne({username: data.screen_name}, function(error, user) {
                                        var c;
                                        if (user) {
                                            c = {
                                                'email': user.email,
                                                'username': user.username,
                                                'first_name': user.name.first_name,
                                                'last_name': user.name.last_name,
                                                'image': user.image || data.profile_image_url,
                                                'twitter': data.id,
                                                'facebook': user.facebook
                                            };
                                        }
                                        else {
                                            c = {
                                                'username': data.screen_name,
                                                'first_name': data.name.split(' ')[0],
                                                'last_name': data.name.split(' ')[1],
                                                'image': data.profile_image_url,
                                                'twitter': data.id
                                            };
                                        }
                                        c.csrf_token = req.session._csrf;
                                        res.render('signup', c);
                                    });
                                }
                				else {
                                    user.twitter = data.id;
                                    user.save(function(error) {
                                        if (error) {
                                            console.log(error);
                                        }
                                    });

                                    delete user.email;
                                    delete user.password;
                                    req.session.user_token = user
                                    res.redirect('/lobby');
                				}
            			    });
            			}
        		});
    		}
	});
};
