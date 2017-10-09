var fs = require('fs');
var express = require('express');
var serveStatic = require('serve-static');
var path = require('path');
var morgan = require('morgan');
var healthChecker = require('sc-framework-health-check');

var jwt = require("jsonwebtoken");
var secret = process.env.SECRET;

var async = require("async");
var shortid = require("shortid");
var creator = require("couchdb-creator")

var nano = require("nano")("http://" + process.env.COUCHDB_USER + ":" + process.env.COUCHDB_PASSWORD + "@couchdb:5984");

var messages;
var messages_design = {
  'views' : {
    'by_channel' : {
      'map' : function(doc){
        emit(doc.channel, doc._id);
      }
    }
  }
};
creator(nano, 'messages', {name : 'messages', doc : messages_design}, function(db){
  messages = db;
});

var perms;
var perms_design = {
  'views' : {
    'by_perm' : {
      'map' : function(doc){
        emit([doc.user, doc.channel], doc.role);
      }
    },
    'by_user' : {
      'map' : function(doc){
        emit(doc.user, doc.channel);
      }
    }
  }
};
creator(nano, 'perms', {name : 'perms', doc : perms_design}, function(db){
  perms = db;
});

module.exports.run = function (worker) {
  console.log('   >> Worker PID:', process.pid);
  var environment = worker.options.environment;

  var app = express();

  var httpServer = worker.httpServer;
  var scServer = worker.scServer;

  if (environment == 'dev') {
    // Log every HTTP request. See https://github.com/expressjs/morgan for other
    // available formats.
    app.use(morgan('dev'));
  }
  //app.use(serveStatic(path.resolve(__dirname, 'public')));

  // Add GET /health-check express route
  healthChecker.attach(worker, app);

  httpServer.on('request', app);

  var count = 0;

  //Authentication
  scServer.addMiddleware(scServer.MIDDLEWARE_PUBLISH_IN, function(req, next){
    var authToken = req.socket.authToken;
    if(authToken){
      async.each(authToken.channels, function(channel, cb){
        if(req.channel == channel.channel){
          if(channel.role == 'w' || channel.role == 'a'){ //Admins can also send
            cb("found")
          }else{
            cb("Unauthorised to send messages")
          }
        }else{
          cb();
        }
      }, function(err){
        err ? err == 'found' ? next() : next(err) : next("Unrecognised channel");
      });
    }else{
      next("Invalid auth token");
    }
  });

  //Message logging and metadata
  scServer.addMiddleware(scServer.MIDDLEWARE_PUBLISH_OUT, function(req, next){
    var authToken = req.socket.authToken;
    if(authToken){
      var datetime = new Date();
      //Add metadata
      req.data.datetime = datetime;
      req.data.user = authToken.username;
      req.data.channel = req.channel;
      //Log message
      messages.insert(req.data, datetime.getTime() + "&" + req.data.user, function(err, message){
        err ? next(err) : next();
      });
    }else{
      next("Invalid auth token");
    }
  });

  scServer.on('connection', function (socket) {
    socket.on('login', function(data, respond){
      //Verify the token first
      jwt.verify(data.token, secret, function(auth_err, decoded){
        if(auth_err){
          respond("Invalid token");
        }else{
          perms.view("perms", "by_user", {
            key : decoded.sub,
            include_docs : true
          }, function(err, role){
            if(err){
              err.statusCode == 404 ? respond("User not found") : respond("Error");
            }else{
              var channels = [];
              async.each(role.rows, function(row, cb){
                channels.push({channel : row.doc.channel, role : row.doc.role});
                cb();
              }, function(err){
                if(channels.length > 0){
                  socket.setAuthToken({
                    username : decoded.sub,
                    channels : channels
                  });
                  respond();
                }else{
                  respond("User not found");
                }
              });
            }
          });
        }
      });
    });
  });
};
