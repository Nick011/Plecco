//Author: Nick Hagianis
var schema = require('../models/schema');
var VJ = schema.VJ;
var User = schema.User;
var Video = schema.Video;
var player = require('./player');
var _und = require('underscore');


function Controller(socket, io) {
    this.socket = socket;
    this.io = io;
    this.user = null;
    this.errHandle = function(error) {
		if (error) {
		    console.log(error);
		    this.io.sockets.emit('error', error);
		    return true;
		}
		return false;
    };
    this.publish = function() {
		var self = this;
		VJ.find({room: self.user.room}).sort('order', 1).exec(function(error, doc) {
		    if (!self.errHandle(error)) {
				var uids = _und.pluck(doc, 'user');
				User.find({}).where('_id').in(uids).exec(function(error, users) {
				    var vjs = [];
				    var i;
				    users = JSON.parse(JSON.stringify(users));
				    if (!self.errHandle(error)) {
						for (i in doc) {
						    vjs[i] = _und.find(users, function(usr) {
						    	return usr._id.toString() === uids[i].toString(); 
						    });
						    vjs[i]['spinning'] = doc[i].spinning;
						    delete vjs[i].email;
						    delete vjs[i].password;
						}
						Room.findOne({_id: self.user.room}, function(error, room) {
						    if (error) {
								console.log(error);
						    }
						    else {
								self.io.sockets.in(room.slug).emit('video_jokey', vjs);
						    }
						});
				    }
				});
		    }
		});	
    }; 
    this.append = function(usr, count) {
		var vj, song, ordr;
		var self = this;
		if (count < 5) {
		    ordr = count + 1;
		    vj = new VJ({user: usr, room: usr.room, spinning: false, order: ordr});
		    if (ordr <= 1) {
				if (usr.queue.length >= 1) {
				    vj.spinning = true;
				    vj.save(function(error) {
						if (!self.errHandle(error)) {
						    self.publish();
						    player.play(usr, self.socket, self.io);   
						}
				    });
				}
				else {
				    self.socket.emit('error', 'No songs in queue');
				}
		    }
		    else {
				vj.save(function(error) {
				    if (!self.errHandle(error)) {
						self.publish(usr); 
				    }
				});
		    }
		}
		else {
		    self.socket.emit('error', 'Sorry, no DJ spots available');
		}	
    };
    this.reorder = function() {
		var self = this;
		VJ.find({room: self.user.room}).sort('order', 1).exec(function(error, doc) {
		    var vjs = doc;
		    var i = 1;
		    for (x in vjs) {
				vjs[x].order = i;
				console.log(JSON.stringify(vjs[x]));
				vjs[x].save(function(error) {
				    if (error) {
						console.log(error);
				    }
			    });
				i += 1;
		    }
		    self.publish();
		});
    };
}
Controller.prototype = {
    add: function(data) {
		var self = this;
		User.findOne({session: data}, function(error, user) {
		    if (!self.errHandle(error)) {
		    	self.user = user;
				if (user.queue.length <= 0) {
				    self.socket.emit('error', 'No songs in queue');
				}
				else if (!user) {
				    self.socket.emit('error', 'you\'re account could not be found!');
				}
				else {
				    VJ.find({room: user.room}).count(function(error, count) {
						if (!self.errHandle(error)) {
						    self.append(user, count);
						}
				    });
				}
		    }
		});
    },
    remove: function(data) {
		var self = this;
		User.findOne({session: data.session}, function(error, user) {
		    if (!self.errHandle(error)) {
				if (user) {
					self.user = user;
				    VJ.findOne({user: user._id}, function(error, doc) {		    
						if (!self.errHandle(error) && !_und.isNull(doc)) {
						    if (doc.spinning) {
								self.next(function() {
								    doc.remove();
								    self.reorder();
								});				    
						    }
						    else {
								doc.remove();
								self.reorder();
						    }
						}
						else {
						    self.reorder();
						}
				    });
				}
		    }
		});
    },
    next: function(callback) {
		var self = this;
		VJ.find({room: self.user.room}, function(error, docs) {
		    if (error) {
				console.log(error);
		    }
		    else {
				var next;
				var currentVJ;
				console.log(JSON.stringify(docs));
				
				currentVJ = _und.find(docs, function(vj) { return vj.spinning === true; });
			    
				//reorder the user's video queue so the video that just played is last.
				User.findById(currentVJ.user, function(error, user) {					
				    if (docs.length >= 2) {
						currentVJ.spinning = false;
						currentVJ.save(function(error) {
						    if (error) {
								console.log(error);
						    }
						});

						if (currentVJ.order >= docs.length) {
						    next = _und.find(docs, function(vj) { return vj.order == 1; });
						}
						else {			    
						    next = _und.find(docs, function(vj) { return vj.order == currentVJ.order + 1; });
						}

						next.spinning = true;	    	    

						next.save(function(error) {
						    if (!self.errHandle(error)) {				
								self.publish();
						    }
						});
						User.findById(next.user, function(error, nextUser) {
						    player.play(nextUser, self.io.sockets.socket(nextUser.socket), self.io); 
						});	
				    }
				    else if (!callback) {
						player.play(user, self.io.sockets.socket(user.socket), self.io);
				    }
				    
				    if (callback) {
						callback();
				    }

				});
		    }
		});
	}
};


exports.add = function (data, socket, io) {
    var ctrl = new Controller(socket,io);
    ctrl.add(data);
};

exports.remove = function (data, socket, io) {
    var ctrl = new Controller(socket, io);
    ctrl.remove(data);
};

exports.publish = function (data, socket, io) {
    var ctrl = new Controller(socket, io);
    ctrl.user = data;
    ctrl.publish();

};

exports.next = function (socket, io) {
	socket.get('session', function(error, data) {
		if (error) {
			console.log(error);
		}
		else if (data) {
			console.log(data);
			data = JSON.parse(data);
			User.findOne({session: data.session}, function(error, user) {
				if (error) {
					console.log(error);
				}
				else {
					var ctrl = new Controller(socket, io);
					ctrl.user = user;
		    		ctrl.next();

		    		Room.findOne({_id: user.room}, function(error, room) {
		    			if (error) {
		    				console.log(error);
		    			}
		    			else {
		    				io.sockets.in(room.slug).emit('skip', {progress: '0%'});
		    			}
		    		});
	    		}
			});		
		}
	});    
};

exports.like = function (data) {

};

exports.Controller = Controller;

