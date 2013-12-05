var querystring = require('querystring');
var request = require('request');
var _und = require('underscore');

exports.search = function(query, callback) {
    query.alt = 'json';
    var baseUrl = 'https://gdata.youtube.com/feeds/api/videos?';
    var qUrl = baseUrl + querystring.stringify(query);
    request(qUrl, function(error, response, body) {
		var data;
		var entryId;
		var results = [];
		if (error) { 
		    console.log(error);
		    callback(error, null);
		}
		else {
		    data = JSON.parse(body);
		    _und.each(data.feed.entry, function(entry) {
				entryId = entry.id.$t.toString();
				entry.id = entryId.substring(entryId.lastIndexOf('/')+1);
				results.push({
				    id: entry.id,
				    title: entry.title.$t,
				    thumbnail: entry.media$group.media$thumbnail[0].url,
				    author: entry.author[0].name.$t,
				    content: entry.content.$t
				});
		    });
		    callback(null, results);
		}
    });
};

exports.find = function(videoID, callback) {
    var baseUrl = 'https://gdata.youtube.com/feeds/api/videos/'+videoID+'?v=2&alt=json';
    request(baseUrl, function(error, response, body) {
		var data;
		var video = {};
		if (error) {
		    console.log(error);
		    callback(error, null);
		}
		else {
		    data = JSON.parse(body);
		    
		    video.yt_id = videoID;
		    video.title = data.entry.title.$t;
		    video.author = data.entry.author[0].name.$t;
		    video.description = data.entry.media$group.media$description.$t;
		    video.duration = parseInt(data.entry.media$group.media$content[0].duration) * 1000;
		    console.log(data.entry.media$group.media$content[0].duration);
		    callback(null, video);
		}
    });
};
