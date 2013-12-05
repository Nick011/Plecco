/**
 * Created by Nick Hagianis
 * Date: 8/9/11
 * Time: 6:28 PM
 */
var OAuth = require("oauth").OAuth2,
User = require("../models/schema").User,
url = require("url"),
Handlebars = require("handlebars");

//check for twitter token, request connection if not available
exports.connect = function(req, res) {
    //if not logged in, redirect to login
    if (req.session.facebook_access_token) {
		res.redirect("/lobby");
    }
    else {
        var oa = new OAuth("416037728445152",
                "256fb8cd5141a20ab5a429e126f1d320",
                "https://www.facebook.com",
                "/dialog/oauth",
                "/oauth/access_token");

        var authUrl = oa.getAuthorizeUrl({
                            redirect_uri: 'http://plec.co/facebook-cb',
                            scope: 'email, user_about_me'
                        });
        res.redirect(authUrl);
    }
};

//receive callback from twitter to confirm connection
exports.callback = function(req, res) {
    
    var oa = new OAuth("416037728445152",
                "256fb8cd5141a20ab5a429e126f1d320",
                "https://graph.facebook.com",
                "/dialog/oauth",
                "/oauth/access_token");

    var parsedUrl = url.parse(req.url, true);
    console.log(parsedUrl.query.code);

    oa.getOAuthAccessToken(
        parsedUrl.query.code, 
        {redirect_uri: 'http://plec.co/facebook-cb'}, 
        function(error, access_token, refresh_token) {

            if (error) {
                console.log('error');
                console.log(error);
            }
            else {
                // store the tokens in the session
                req.session.oa = oa;
                req.session.facebook_access_token = access_token;
                req.session.facebook_refresh_token = refresh_token;

                oa.get(
                    'https://graph.facebook.com/me',
                    access_token,
                    function (error, data, response) {
                        if (error) {
                            console.log(error);
                        }
                        else {
                            data = JSON.parse(data);
                		    //determine the user's current state and update data as necessary
                            var token = req.session.user_token;
                            var query = token ? {id: token.id} : {facebook: data.id};
                            
                			User.findOne(query, function(error, user) {
                			    if (error) {
                				    console.log(error);
                			    }
                			    else {
                    				if (user) {
                                        user.facebook = data.id;
                                        user.save(function(error) {
                                            if (error) {
                                                console.log(error);
                                            }
                                        })

                    				    delete user.password;
                    				    delete user.email;
                    				    req.session.user_token = user;
                        				res.redirect('/lobby');
                    				}
                    				else {
                                        User.findOne({email: data.email}, function(error, user) {
                                            var c;
                                            if (error) {
                                                console.log(error);
                                            }
                                            else if (!user) {
                                                c = {
                                                    email: data.email,
                                                    first_name: data.first_name,
                                                    last_name: data.last_name,
                                                    facebook: data.id,
                                                    csrf_token: req.session._csrf
                                                };
                                                res.render('signup', c);
                                            }
                                            else {
                                                delete user.password;
                                                delete user.email;
                                                req.session.user_token = user;
                                                res.redirect('/lobby');
                                                user.facebook = data.id;
                                                user.save(function(error) {
                                                    if (error) {
                                                        console.log(error);
                                                    }
                                                })
                                            }
                                        });                                                
                    				    
                    				}
                			    }
                			});
                        }
                });
            }
    });
};
