var fs = require('fs');
var express = require('express');
var serveStatic = require('serve-static');
var path = require('path');
var morgan = require('morgan');
var healthChecker = require('sc-framework-health-check');

var jwt = require("jsonwebtoken");
var secret = process.env.SECRET;

var async = require("async");
var creator = require("couchdb-creator")

var nano = require("nano")("http://" + process.env.COUCHDB_USER + ":" + process.env.COUCHDB_PASSWORD + "@couchdb:5984");

var messages;
var messages_design = {
  'views' : {
    'by_channel' : {
      'map' : function(doc){
        emit([doc.channel.group, doc.channel.channel], doc._id);
      }
    }
  }
};
creator(nano, 'messages', {name : 'messages', doc : messages_design}, function(db){
  messages = db;
});

var pms;
var pms_design = {
  'views' : {
    'by_user' : {
      'map' : function(doc){
        emit(doc.users.split('+')[0], doc.users.split('+')[1]);
        emit(doc.users.split('+')[1], doc.users.split('+')[0]);
      }
    },
    'by_users' : {
      'map' : function(doc){
        emit(doc.users, null);
      }
    }
  },
  'lists' : {
    'by_user' : function(head, req){
      var row;
      var users = [];
      while(row = getRow()){
        var is_in = false;
        for(var user in users){
          if(user == row.value){
            is_in = true;
            break;
          }
        }
        if(!is_in){
          users.push(row.value);
        }
      }
      send(JSON.stringify(users));
    }
  }
};
creator(nano, 'pms', {name : 'pms', doc : pms_design}, function(db){
  pms = db;
});

var permissions_design = {
  'views' : {
    'by_user_action' : {
      'map' : function(doc){
        emit([doc.user, doc.action], doc.value);
      }
    },
    'by_user_action_scope' : {
      'map' : function(doc){
        emit([doc.user, doc.action, doc.scope], doc.value);
      }
    },
    'by_user' : {
      'map' : function(doc){
        emit(doc.user, doc._id);
      }
    },
    'by_action_scope' : {
      'map' : function(doc){
        emit([doc.action, doc.scope], doc.value);
      }
    }
  }
};
var permissions;
creator(nano, 'permissions', {name : 'permissions', doc : permissions_design}, function(db){
  permissions = db;
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
      if(req.channel.split('+')[0] == 'pm'){
        next();
      }else{
        authToken.channels.includes(req.channel) ? next() : next("Unrecognised channel");
      }
    }else{
      next("Invalid auth token");
    }
  });

  //Message logging and metadata
  scServer.addMiddleware(scServer.MIDDLEWARE_PUBLISH_OUT, function(req, next){
    var authToken = req.socket.authToken;
    if(authToken){
      if(req.channel.split(':')[0] == 'pm'){
        next();
      }else{
        var datetime = new Date();
        //Add metadata
        req.data.datetime = datetime;
        req.data.user = authToken.userid;
        var gc = req.channel.split('+');
        req.data.channel = {group : gc[0], channel : gc[1]};
        //Log message
        messages.insert(req.data, datetime.getTime() + "&" + req.data.user, function(err, message){
          err ? next(err) : next();
        });
      }
    }else{
      next("Invalid auth token");
    }
  });

  scServer.addMiddleware(scServer.MIDDLEWARE_EMIT, function(req, next){
    if(req.event == 'pm'){
      if(req.socket.authToken){
        if(req.socket.authToken.userid == req.data.sender){
          next();
        }else{
          next("Invalid auth token");
        }
      }else{
        next("Invalid auth token");
      }
    }else{
      next();
    }
  });

  scServer.on('connection', function (socket) {
    socket.on('login', function(data, respond){
      //Verify the token first
      jwt.verify(data.token, secret, function(auth_err, decoded){
        if(auth_err){
          respond("Invalid token");
        }else{
          permissions.view('permissions', 'by_user_action', {
            key : [decoded.sub, 'send_message'],
            include_docs : true
          }, function(view_err, roles){
            if(view_err){
              err.statusCode == 404 ? respond("User not found") : respond("Error");
            }else{
              var channels = [];
              async.each(roles.rows, function(row, cb){
                channels.push(row.doc.scope.group + '+' + row.doc.scope.channel);
                cb();
              }, function(err){
                if(channels.length > 0){
                  socket.setAuthToken({
                    userid : decoded.sub,
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
    socket.on('pm', function(data, respond){
      var message = {};
      var datetime = new Date();
      message.datetime = datetime;
      message.user = data.sender;
      message.users = data.sender < data.recipient ? data.sender + '+' + data.recipient : data.recipient + '+' + data.sender;
      console.log(data.message);
      message.message = data.message;
      message.type = data.type;

      pms.insert(message, datetime.getTime() + "&" + data.sender, function(err, ins_message){
        if(err){
          respond(err.message);
        }else{
          scServer.exchange.publish('pm:' + data.recipient, message);
          respond();
        }
      });
    });
    socket.on('logout', function(data, respond){
      socket.deauthenticate();
      respond();
    });
  });
};
