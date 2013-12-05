//Author: Nick Hagianis
var schema = require('../models/schema')
	vj = require('./vj')
	playlist = require('./playlist')
	player = require('./player')
	Message = schema.Message
	User = schema.User
	Room = schema.Room
	_und = require('underscore')


exports.lobby = function(req, res) {
    Room.find({}, function(error, rooms) {
        var c = {
            rooms: rooms,
            csrf_token: req.session._csrf
        };
		res.render('lobby', c);
    });
};


exports.createRoom = function(req, res) {
    function sluggify(words) {
		return words
                .trim()
                .replace('-', ' ')
                .replace(/[^\w]+/, '')
                .replace(/\s+/g, '-')
                .toLowerCase();
    }

    var url, 
        user = req.session.user_token,
    	room = new Room(req.body);

    room.slug = sluggify(room.name);
    url = '/room/' + room.slug;
    Room.findOne({slug: room.slug}, function(error, doc) {
    	if (error) {
    		console.log(error)
    	}
    	else if (doc) {
    		res.redirect(url);
    	}
    	else {
    		//room.vjs = [];
		    //room.users = [];
		    //room.messages = [];

		    room.save(function(error) {				
				if (error) {
				    console.log(error);
				}
				else {	    
				    res.redirect(url);
				}
		    });
    	}
    });
};


exports.joinRoom = function(req, res) {
    var user = req.session.user_token,
    	slug = req.params.slug,
    	context = {
            username: user.username,
            session: user.session,
            slug: slug
        };
    	res.render('room', context);
};


exports.post = function(data, socket, io) {
    var msg = new Message(data);
    //should be split into 2 async calls
    User.findOne({session: data.session}, function(error, user) {
        if (error) {
            console.log(error);
        }
        else {
            msg.user = user;
            socket.get('room', function(error, room) {
                if (error) {
                    console.log(error);
                }
                else {
                    var res = {
                        body: msg.body,
                        username: user.username
                    };
                    io.sockets.in(room).emit('message', res);
                }
            });

            Room.findOne({slug: data.slug}, function(error, doc) {
            	if (error) {
            		console.log(error);
            	}
            	else {                
        	    	msg.room = doc;
        	    	msg.save(function(error) {
        				if (error) {
        				    console.log(error);
        				    socket.emit('error', error);
        				}
        			});
        		}
            });            
        }
    });
};

exports.connect = function(data, socket, io) {
    User.findOne({session: data.session}, function(error, usr) {
		if (error) {
		    console.log(error);
		    socket.emit('error', error);
		}
		else if (usr) {
		    usr.online = true;
		    usr.socket = socket.id;
            usr.last_login = Date.now();	    
		    Room.findOne({slug: data.slug}, function(error, room) {
		    	if (error) {
		    		console.log(error);
		    	}
		    	else {
                    data.room = room.id;
                    player.current(data, socket, io);

                    room.users.push({user: usr._id});
                    room.save(function(error) {
                        if (error) {
                            console.log(error);
                        }
                        console.log(JSON.stringify(room));
                    });
		    		usr.room = room;
		    		usr.save(function(error) {
						if (error) {
						    console.log(error);
						    socket.emit('error', error);
						}
				    
						socket.get('room', function(error, room) {
						    if (error) {
								console.log(error);
						    }
						    else {
								if (room) {
								    socket.leave(room);
								}
							    socket.set('room', data.slug, function(error) {
								    if (error) {
										console.log(error);
										socket.emit('error', error);
								    }
								});
						    }
						});
						User.find({room: room}, function(error, users) {
							if (error) {
								console.log(error);
							}
							else {
                                var i = 0;
                                for (i in users) {
                                    delete users[i].email;
                                    delete users[i].password;
                                }
								io.sockets.in(room.slug).emit('users', users);
							}
						});
					});
                    
				}
			
				socket.join(room.slug);				
				playlist.get(usr, socket);
				vj.publish(usr, socket, io);
		    });
		}
		else {
		    console.log('user not found');
		}
    });
};

exports.disconnect = function(data, socket, io) {
	console.log(data);
    User.findOne({session: data.session}, function(error, doc) {
		var usr,
			room;
		if (error) {
		    console.log(error);
		}
		else {		  
			console.log('DISCONNECT'); 
		    if (doc) {
		    	console.log('ROOM ' + JSON.stringify(doc));
		    	room = doc.room;  	
		    	usr = doc;
			    usr.online = false;
				usr.room = null;
				usr.save(function(error) {
					if (error) {
						console.log(error);
					}
					else {						
						User.find({room: room}, function(error, docs) {
							if (error) {
								console.log(error);
							}
							else {
								io.sockets.in(data.slug).emit('users', docs);
							}
				    	});
					}
				});
                Room.findOne({_id: room}, function(error, room) {
                    var user = _und.find(room.users, function(u) { return u.user == usr.id });
                    user.remove();
                    room.save(function(error) {
                        if (error) {
                            console.log(error);
                        }
                    })
                });
		    }
		}
    });
};
