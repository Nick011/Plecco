//import libraries
var connect = require('connect'),
    express = require('express'),
    http = require('http'),
    querystring = require('querystring'),
    hbs = require('hbs'),

//create session storage and cookie parsing
    ExStore = require('connect-redis')(express),
    exStore = new ExStore,
    cookieParser = express.cookieParser('jin976jefejf23oaoi6fhio234eahnwe'),

//file sys obj to pull handlebars templates
    fs = require('fs'),
    nav = fs.readFileSync(__dirname + '/views/nav.hbs', 'utf8'),
    footer = fs.readFileSync(__dirname + '/views/footer.hbs', 'utf8'),
    log = fs.createWriteStream('/var/log/node/plecco.log', {flags: 'a'}),

//import controllers
    facebook = require('./controllers/facebook'),
    twitter = require('./controllers/twitter'),
    auth = require('./controllers/auth'),
    youtube = require('./controllers/youtube'),
    chat = require('./controllers/chat'),
    vj = require('./controllers/vj'),
    playlist = require('./controllers/playlist'),
    content = require('./controllers/content'),

//to pass port option on start
    argv = require('optimist').argv,

//create a server, set io listener
    app = express(),
    server = app.listen(parseInt(argv.port || 8010)),

//initiate socket io and set the redis store
    sio = require('socket.io'),
    SessionSocket = require('session.socket.io'),
    io = sio.listen(8000),
    RedisStore = sio.RedisStore;


//middleware
//decorator for protected pages
function login_required(req, res, next) {
    if (req.session.user_token){
        next();
    }
    else {
        res.redirect('/');
    }
}

function pageNotFound(req, res, next) {
    res.status(404);
    res.render('404');
}

function errorHandler(err, req, res, next) {
    console.log(err);
    res.status(500);
    res.render('500');
}

//configure settings needed
app.configure(function() {
    app.use(express.logger({stream: log}));
    //app.use(express.logger());
    app.use(express.favicon('static/img/favicon.ico'));
    app.use(express.bodyParser());
    app.use(cookieParser);
    app.use(express.session({
        store: exStore
    }));
    app.use(express.csrf());
    app.use(app.router);
    app.use(pageNotFound);
    app.use(errorHandler);
});


//enable debug mode for development
app.configure('development', function () {
    app.use(express.errorHandler({
        dumpExceptions: true,
        showStack: true
    }));
});


//set the view engine, in this case handlebars
app.set('views', __dirname + '/views');
app.set('view engine', 'hbs');

//register handlebars partials
hbs.registerPartial('nav', nav);
hbs.registerPartial('footer', footer);


//serve http requests to controllers
//static content page request handlers
app.get('/', content.home);
app.get('/privacy', content.privacy);
app.get('/terms', content.terms);
app.get('/about', content.about);

//dynamic http request handlers
app.get('/signup', auth.show_signup);
app.post('/signup', auth.process_signup);
app.get('/recover/password', auth.show_recover);
app.post('/recover/password', auth.process_recover);
app.get('/reset/password/:token', auth.show_reset);
app.post('/reset/password', auth.process_reset);
app.post('/check/user', auth.check_user);
app.get('/contact', content.show_contact);
app.post('/contact', content.process_contact);
app.post('/login', auth.login);
app.get('/logout', login_required, auth.logout);
app.get('/account', login_required, auth.show_account);
app.post('/account', login_required, auth.update_account);
app.get('/twitter', twitter.connect);
app.get('/twitter-cb', twitter.callback);
app.get('/twitter-signup', twitter.signup);
app.get('/twitter-confirm', twitter.confirm);
app.get('/facebook', facebook.connect);
app.get('/facebook-cb', facebook.callback);
app.get('/lobby', login_required, chat.lobby);
app.post('/room/create', login_required, chat.createRoom);
app.get('/room/:slug', login_required, chat.joinRoom);

//error pages
app.get('/404', function(req, res, next) {
    next();
});
app.get('/403', function(req, res, next){
  var err = new Error('Bad Request.');
  err.status = 403;
  next(err);
});
app.get('/500', function(req, res, next){
  next(new Error('Error page called.'));
});


//BEGIN WEBSOCKET CODE
io.configure(function() {
    var opts = {host: '127.0.0.1', port: '6379'},
        redisStore = new RedisStore({redisPub:opts, redisSub:opts, redisClient:opts});
        
    io.set('store', redisStore);
    io.set('transports', ['websocket']);
    
    //authorize socket connection
    /*
    io.set('authorization', function(handshakeData, callback) {
        console.log(JSON.stringify(handshakeData));
        var referer = handshakeData.headers.referer;
        if (referer.indexOf('plec.co') < 0) {
            callback(null, false);
        }
        else {
            callback(null, true);
        }
    });
*/
});

var sessionSocket = new SessionSocket(io, exStore, cookieParser);

sessionSocket.on('connection', function (error, socket, session) {
    if (!session.user_token) {
        socket.disconnect();
    }

    //chat requests
    socket.on('announce', function(data) {
        var session = JSON.stringify(data);
    	socket.set('session', session, function(error) {
    	    if (error) {
                console.log(error);
            }
    	});
    	chat.connect(data, socket, io); 
    });

    socket.on('disconnect', function() {
    	socket.get('session', function(error, session) {
            if (error) {
                console.log(error);
            }
            else if (session) {  
                session = JSON.parse(session);                    
        	    chat.disconnect(session, socket, io);
                vj.remove(session, socket, io);    	    
            }
    	});
    });

    socket.on('post', function(data) {
	   chat.post(data, socket, io);
    });

    //vj requests
    socket.on('vj_add', function(data) {
	   vj.add(data, socket, io);
    }); 

    socket.on('vj_remove', function(data) {
	   vj.remove(data, socket, io);
    });

    //playlist request
    socket.on('playlist_add', function(data) {
	   playlist.add(data, socket);
    });

    socket.on('playlist_remove', function(data) {
	   playlist.remove(data, socket);
    });

    socket.on('playlist_reorder', function(data) {
	   playlist.reorder(data, socket);
    });

    socket.on('player_current', function(data) {
	   player.current(data, socket);
    });

    socket.on('player_skip', function(data) {
        player.skip(data, socket, io);
    });

    //youtube requests
    socket.on('search', function (data) {
    	var query = {q:data.query};
    	youtube.search(query, function (error, results) {
    	    var res = {};
    	    if (error) {
        		res.status = 0;
        		res.message = JSON.stringify(error);
    	    }
    	    else {
        		res.status = 1;
        		res.message = 'Success';
    	    }
    	    res.q = query.q;
    	    res.results = results;
    	    socket.emit('search', res);
    	});
    });

});

//console.log('Express server started on port %s', app.address().port);
