
exports.home = function(req, res) {
    var c = {csrf_token: req.session._csrf};
    res.render('index', c);
};

exports.privacy = function(req, res) {
    res.render('privacy');
};

exports.terms = function(req, res) {
    res.render('terms');
};

exports.about = function(req, res) {
    res.render('about');
};

exports.show_contact = function(req, res) {
    res.render('contact');
};

exports.process_contact = function(req, res) {
    //write contact form handler
    res.render('contact');
};
