//Author: Nick Hagianis
var schema = require('../models/schema');
var User = schema.User;
var Video = schema.Video;
var _und = require('underscore');
var youtube = require('./youtube');

exports.get = function(user, socket) {
    var videoIds = _und.pluck(user.queue, 'video');
    videos = Video.find({});
    videos.where('_id').in(videoIds);
    videos.run(function(error, docs) {
	var playlist = [];
	docs = JSON.parse(JSON.stringify(docs));
	if (error) {
	    console.log(error);
	    socket.emit('error', error);
	}
	else {
	    for (var i in user.queue) {	
		if (!_und.isUndefined(user.queue[i].video)) {	
		    playlist[i] = _und.find(docs, function(vid) { return vid._id.toString() === user.queue[i].video.toString(); });
		    playlist[i].order = user.queue[i].order;
		}
	    }
	    socket.emit('playlist', playlist);
	}
    }); 
};

exports.add = function(data, socket) {
	function prependRecord(user, video) {
		var order = user.queue.length + 1
		user.queue = user.queue.reverse();
		user.queue.push({video: video, order: order});
		user.queue = user.queue.reverse();

		user.save(function(error) {
		    if (error) {
				console.log(error);
				socket.emit('error', error);
		    }
		    else {
				exports.reorder({user:user.session, playlist:user.queue}, socket);
		    }
		});
	}

    User.findOne({session: data.session}, function(error, user) {
		if (error) {
	    	console.log(error);
	    	socket.emit('error', error);
		}
		else {
		    Video.findOne({yt_id: data.song}, function(error, video) {				
				if (error) {
				    console.log(error);
				    socket.emit('error');
				}
				else if (!video) {
				    youtube.find(data.song, function(error, data) {
				    	var video = new Video(data);

						video.save(function(error) {
						    if (error) {
								console.log(error);
						    }
						    else {
								prependRecord(user, video);
						    }
						});
				    });
				}
				else {
					prependRecord(user, video);
				}		    
		    });
		}
    });
};

exports.remove = function(data, socket) {
    User.findOne({session: data.user}, function(error, user) {
		if (error) {
		    console.log(error);
		    socket.emit('error', error);
		}
		else {
		    var video = _und.find(user.queue, function(vid) { return vid.video == data.song });
		    video.remove();
		    user.save(function(error) {
				if (error) {
				    console.log(error);
				    socket.emit('error', error);
				}
				else {
				    exports.reorder({user: user.session, playlist: user.queue}, socket);
				}
		    });
		}
    });
};

exports.reorder = function(data, socket) {
    User.findOne({session: data.user}, function(error, user) {
	var i = 0;
	if (error) {
	    console.log(error);
	    socket.emit('error', error);
	}
	else {
	    while (i < data.playlist.length) {
		data.playlist[i].order = i + 1;
		i += 1;
	    }
	    console.log(JSON.stringify(data.playlist));
	    User.update(user, {queue: data.playlist}, function (error) {
		if (error) {
		    console.log(error);
		}
	    });
	    user.queue = data.playlist;
	    console.log(JSON.stringify(user));
	    exports.get(user, socket);
	}
    });
};

