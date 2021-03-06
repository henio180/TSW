var http = require('http');
var express = require('express');
var app = express();
var connect = require('connect');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var socketIo = require('socket.io');
var passportSocketIo = require('passport.socketio');
var sessionStore = new connect.session.MemoryStore();

var sessionSecret = 'wielkiSekret44';
var sessionKey = 'connect.sid';
var server;
var sio;

var pokoje = [];

var id = 0;

var redis = require("redis"),
    client = redis.createClient()

var userzy = [];
var flaga = false;

// Konfiguracja passport.js
passport.serializeUser(function (user, done) {
    done(null, user);
});

passport.deserializeUser(function (obj, done) {
    done(null, obj);
});
-
passport.use(new LocalStrategy(
    function (username, password, done) {
        console.log("Sprawdzam usera " + username);

        client.get(username, function (err, reply) {
            if(reply !== null && reply.toString() === password){
                console.log("user OK");
                var d = new Date();
                userzy.push(username);
                client.rpush("LOG", username + ": " + d, function (err, reply) {
                    console.log("Zapis w logach");
                });

                return done(null, {
                username: username,
                password: password
            });
            }
            else{
                console.log("Eeeeeeee");
                flaga = false;
                return done(null, false);
            }
        });
    }
));

app.use(express.cookieParser());
app.use(express.urlencoded());
app.use(express.session({
    store: sessionStore,
    key: sessionKey,
    secret: sessionSecret
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static('public'));

app.get('/', function (req, res) {
    if (req.user) {
        res.redirect('/authorized.html');
    } else {
        res.redirect('/login.html');
    }
});

app.get('/login', function (req, res) {
    res.redirect('/login.html');
});

app.post('/login',
    passport.authenticate('local', {
        failureRedirect: '/login'
    }),
    function (req, res) {
        res.redirect('/authorized.html');
    }
);

app.get('/logout', function (req, res) {
    console.log('Wylogowanie...')
    flaga = false;
    req.logout();
    res.redirect('/login');
});

server = http.createServer(app);
sio = socketIo.listen(server);

var onAuthorizeSuccess = function (data, accept) {
    console.log('Udane połączenie z socket.io');
    accept(null, true);
};

var onAuthorizeFail = function (data, message, error, accept) {
    if (error) {
        throw new Error(message);
    }
    console.log('Nieudane połączenie z socket.io:', message);
    accept(null, false);
};

sio.set('authorization', passportSocketIo.authorize({
    passport: passport,
    cookieParser: express.cookieParser,
    key: sessionKey, // nazwa ciasteczka, w którym express/connect przechowuje identyfikator sesji
    secret: sessionSecret,
    store: sessionStore,
    success: onAuthorizeSuccess,
    fail: onAuthorizeFail
}));

sio.set('log level', 2); // 3 == DEBUG, 2 == INFO, 1 == WARN, 0 == ERROR

sio.sockets.on('connection', function (socket) {
    var myId = id;
    var chat;
    id++;
    socket.emit('p', pokoje);
    socket.emit('username', userzy[myId]);

    socket.on('nowy', function (data){
        console.log("Jest nowy pokoj: " + data);
        pokoje.push(data);
        
        chat = sio.of('/' + data).on('connection', function (socket) {
            console.log('Uruchomiłem kanał "/"' + data);
            socket.on('message', function (dataa) {
                console.log(dataa);
                chat.emit('message', '/' + data + ': ' + dataa);
            }); 
        });

        sio.sockets.emit('p', pokoje);
    });
});

server.listen(3000, function () {
    console.log('Serwer pod adresem http://localhost:3000/');
});
