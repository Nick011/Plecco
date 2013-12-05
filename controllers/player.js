//Author Nick Hagianis
var _und = require('underscore'),
	Schema = require('../models/schema'),
	Video = Schema.Video,
	Playlist = Schema.Playlist,
	Room = Schema.Room,
	VJ = Schema.VJ,
	vj = require('./vj'),
	listCtrl = require('./playlist');

var t = {};

exports.play = function(user, socket, io) {
    var vid = _und.find(user.queue, function(v) { return parseInt(v.order) == 1; });
    if (!_und.isUndefined(vid)) {
		Video.findOne({_id: vid.video}, function(error, video) {
		    var first,
		    	timer;
		    if (error) {
				console.log(error);
		    }
		    else {
				socket.get('room', function(error, room) {
				    if (error) {
						console.log(error);
				    }
				    else {
						io.sockets.in(room).emit('play', [video, null]); 
				    }
				});
				
				//reorder users queue
				first = user.queue[0];
				user.queue[0].remove();
				user.queue.push(first);
				console.log(user.queue);		
				listCtrl.reorder({user: user.session, playlist: user.queue}, io.sockets.socket(user.socket));
				//settimeout to move to the next vj/song after current video is finished playing
				timer = t[user.room];
				if (timer) { clearTimeout(timer); }
				t[user.room] = setTimeout(function() {
						vj.next(socket, io);
				    }, video.duration);
			}
		});
    }   
};


exports.current = function(data, socket, io) {
    VJ.findOne({spinning: true, room: data.room}, function(error, vj) {
		if (error) {
		    console.log(error);
		}
		else if (vj) {
		    User.findOne({_id: vj.user}, function(error, user) {
		    	if (error) {
		    		console.log(error);
		    	}
		    	else {
		    		var vid = user.queue[user.queue.length - 1],
		    			startTime,
		    			startVideo,
		    			now,
		    			timer;
		    		Video.findOne({_id: vid.video}, function(error, video) {
		    			if (error) {
		    				console.log(error);
		    			}
		    			else {
		    				timer = t[user.room];
		    				now = Date.now();
		    				startTime = timer._idleStart.getTime();
		    				startVideo = Math.round((now - startTime) / 1000);
		    				startVideo += 2;
		    				socket.emit('play', [video, startVideo]);
		    			}
		    		})
		    	}
		    });
		}
    });
};


exports.skip = function(data, socket, io) {
	if (data.spinning) {
		vj.next(socket, io);
	}
	else {
		Room.findOne({slug: data.slug}, function(error, room) {
			var progress,
				res = {};
			if (error) {
				console.log(error);
			}
			else {
				room.skips += 1;
				progress = (room.skips / room.users.length) * 100;
				if (progress >= 50) {
					vj.next(socket, io);
					room.skips = 0;
				}
				else {
					res.progress = progress.toString() + '%';
					io.sockets.in(data.slug).emit('skip', res);
				}
				room.save(function(error) {
					if (error) {
						console.log(error);
					}
				});
			}
		});
	}
};

