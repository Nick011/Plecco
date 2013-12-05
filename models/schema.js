//author: Nick Hagianis
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

mongoose.connect('mongodb://localhost/db');


var Video = new Schema({
    yt_id: {type: String, index: {unique: true, sparse: true}},
    title: String,
    artist: String,
    description: String,
    duration: Number, //length of the song in miliseconds
    startTime: Number,
    plays: Number,
    likes: Number,
    hates: Number
});

var VideoQueue = new Schema({
    video: {type: ObjectId, required: true},
    order: Number
});

var User = new Schema({
    session: {type: String, unique: true},
    socket: {type: String, default: ""},
    username: {type: String, required: true, index: {unique: true}},
    name: {
    	first: String,
    	last: String
    },
    email: {type: String, required: true, index: {unique: true}},
    password: {type: String, required: true},
    twitter: String,
    facebook: String,
    image: String,
    active: Boolean,
    online: Boolean,
    date_joined: {type: Date, default: Date.now},
    last_login: Date,
    likes: Number,
    hates: Number,
    queue: [VideoQueue],
    room: {type: ObjectId}
});

var Message = new Schema({
    user: ObjectId,
    room: {type: ObjectId, required: true},
    date: {type: Date, default: Date.now},
    body: String
});

var VJ = new Schema({
    user: {type: ObjectId, required: true, index: {unique: true}},
    room: {type: ObjectId, required: true, index: true},
    order: {type: Number, required: true},
    points: Number,
    spinning: Boolean
});

var Viewer = new Schema({
    user: {type: ObjectId, required: true}
});

var Room = new Schema({
    name: {type: String, required: true},
    slug: {type: String, required: true, index: {unique: true}},
    description: {type: String},
    skips: {type: Number, default: 0},
    users: [Viewer]
});


exports.User = mongoose.model('User', User);
exports.Video = mongoose.model('Video', Video);
exports.Message = mongoose.model('Message', Message);
exports.VJ = mongoose.model('VJ', VJ);
exports.Room = mongoose.model('Room', Room);
exports.Viewer = mongoose.model('Viewer', Viewer);

//clear potential stale/stuck queues on startup
//vjs
(function() {
    exports.VJ.find({}, function(error, vjs) {
        var i = 0;
        for (i in vjs) {
            vjs[i].remove();
        }
    });
}());
//viewers (from rooms)
(function() {
    exports.Room.find({}, function(error, rooms) {
        var i = 0,
            n = 0,
            viewer;

        for (i in rooms) {
            n = rooms[i].users.length;
            while (n--) {
                viewer = rooms[i].users[n];
                if (viewer.user) {
                    viewer.remove();
                }
            }
            rooms[i].save(function(error) {
                if (error) {
                    console.log(error);
                }
            });
        }
    });
}());

