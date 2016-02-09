var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt-nodejs');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.static(__dirname + '/public'));

var session = require('express-session');
app.use(session({
    secret: "123456789",
    resave: false,
    saveUninitialized: true
}));

app.get('/', util.checkUser, function(request, response) {
    response.render('index');
});

app.get('/create', util.checkUser, function(request, response) {
    response.render('index');
});

app.get('/links', util.checkUser, function(request, response) {
    Links.reset().fetch().then(function(links) {
        response.send(200, links.models);
    });
});

app.post('/links',
    function(request, response) {
        var uri = request.body.url;

        if (!util.isValidUrl(uri)) {
            console.log('Not a valid url: ', uri);
            return response.send(404);
        }

        new Link({
            url: uri
        }).fetch().then(function(found) {
            if (found) {
                response.send(200, found.attributes);
            } else {
                util.getUrlTitle(uri, function(err, title) {
                    if (err) {
                        console.log('Error reading URL heading: ', err);
                        return response.send(404);
                    }

                    var link = new Link({
                        url: uri,
                        title: title,
                        base_url: request.headers.origin
                    });

                    link.save().then(function(newLink) {
                        Links.add(newLink);
                        response.send(200, newLink);
                    });
                });
            }
        });
    });

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/login', function(request, response) {
    response.render('login');
});

app.get('/signup', function(request, response) {
    response.render('signup');
});

app.post('/login', function(request, response) {
    var username = request.body.username;
    var password = request.body.password;

    //check if username is present in the database
    new User({
        username: username
    }).fetch().then(function(user) {
        //if no
        if (!user) {
            //redirect to login page
            return response.redirect('/login');
        } else {
            // //if yes
            // //compare passwords
            //   bcrypt.compare(password, user.get('password'), function(err, match){
            //     //if they match
            //     if (match){
            //       //create a session
            //       util.createSession(request, response, user);
            //     } else {
            //       //else redirect to login
            //       response.redirect('/login');
            //     }
            //   });

            //ADVANCED VERSION
            user.comparePassword(password, function(match) {
                if (match) {
                    util.createSession(request, response, user);
                } else {
                    response.redirect('/login');
                }
            });
        }
    });
});

app.post('/signup', function(request, response) {
    var username = request.body.username;
    var password = request.body.password;

    //check if username is present in the database
    new User({
            username: username
        })
        .fetch()
        .then(function(user) {
            if (!user) {
                // bcrypt.hash(password, null, null, function(err, hash) {
                //     Users.create({
                //         username: username,
                //         password: hash
                //     }).then(function(user) {
                //         util.createSession(request, response, user);
                //     });
                // });

        //ADVANCED VERSION
                var newUser = new User({
                  username: username,
                  password: password
                });
                newUser.save().then(function(savedUser){
                  util.createSession(request, response, savedUser);
                });
            } else {
                console.log('Account already exists');
                response.redirect('/signup');
            }
        });
});


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
    new Link({
        code: req.params[0]
    }).fetch().then(function(link) {
        if (!link) {
            res.redirect('/');
        } else {
            var click = new Click({
                link_id: link.get('id')
            });

            click.save().then(function() {
                db.knex('urls')
                    .where('code', '=', link.get('code'))
                    .update({
                        visits: link.get('visits') + 1,
                    }).then(function() {
                        return res.redirect(link.get('url'));
                    });
            });
        }
    });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
