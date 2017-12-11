var SCWorker = require('socketcluster/scworker');
var fs = require('fs');
var express = require('express');
var serveStatic = require('serve-static');
var path = require('path');
var morgan = require('morgan');
var healthChecker = require('sc-framework-health-check');

var jwt = require("jsonwebtoken");
var secret = process.env.SECRET;

var async = require("async");
var creator = require("couchdb-creator");
var redis = require("redis");
var cache = redis.createClient({
  host : 'redis',
  port : 6379,
  db : 0
});
var user_cache = redis.createClient({
  host : 'redis',
  port : 6379,
  db : 1
});

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
    'by_action' : {
      'map' : function(doc){
        emit(doc.action, doc.value);
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
  permissions.view('permissions', 'by_action', {
    key : 'send_message',
    include_docs : true
  }, function(get_err, perms){
    if(get_err){
      console.error(get_err);
    }else{
      async.each(perms.rows, (row, cb) => {
        user_cache.hset(row.doc.user, row.doc.scope.group + '+' + row.doc.scope.channel, 1);
        cb();
      }, () => {});
    }
  });
});

class Worker extends SCWorker {
  run() {
    console.log('   >> Worker PID:', process.pid);
    var environment = this.options.environment;

    var app = express();

    var httpServer = this.httpServer;
    var scServer = this.scServer;

    if (environment == 'dev') {
      // Log every HTTP request. See https://github.com/expressjs/morgan for other
      // available formats.
      app.use(morgan('dev'));
    }

    app.get('/', function(req, res){
      res.status(200).json({
        message : "Received at chat socketcluster."
      });
    });

    // Add GET /health-check express route
    healthChecker.attach(this, app);

    httpServer.on('request', app);

    scServer.addMiddleware(scServer.MIDDLEWARE_PUBLISH_IN, function(req, next){
      var authToken = req.socket.authToken;
      if(authToken){
        var identifier = req.channel.split(':')[0]; //Get channel type
        if(identifier == 'pm'){ //PMs have their own route
          next();
        }else if(identifier == 'chat'){
          user_cache.hexists(authToken.userid, req.channel.split(':')[1], (err, perm) => {
            if(perm){
              var datetime = new Date();
              //Add metadata
              req.data.datetime = datetime;
              req.data.user = authToken.userid;
              var gc = req.channel.split(':')[1].split('+');
              req.data.channel = {group : gc[0], channel : gc[1]};
              //Log message
              messages.insert(req.data, datetime.getTime() + "&" + req.data.user, (err, message) => {
                err ? next(err) : next();
              });
            }else{
              next("Unrecognised channel");
            }
          });
        }else if(identifier == 'update'){
          next();
        }
      }else{
        next("Invalid auth token");
      }
    });

    //Authentication for pm route
    scServer.addMiddleware(scServer.MIDDLEWARE_EMIT, function(req, next){
      if(req.event == 'pm'){
        if(req.socket.authToken && req.socket.authToken.userid == req.data.sender){
          next();
        }else{
          next("Invalid auth token");
        }
      }else{
        next();
      }
    });

    /*
      In here we handle our incoming realtime connections and listen for events.
    */
    scServer.on('connection', function (socket) {
      socket.on('login', function(data, respond){
        //Verify the token first
        jwt.verify(data.token, secret, function(auth_err, decoded){ //TODO:Verify via request to openid
          if(auth_err){
            respond("Invalid token");
          }else{
            user_cache.exists(decoded.sub, (err, exists) => { //Make sure user exists
              if(exists){
                socket.setAuthToken({
                  userid : decoded.sub
                });
                respond();
              }else{
                respond("User not found");
              }
            });
          }
        });
      });

      socket.on('pm', function(data, respond){
        //Add metadata
        var message = {};
        var datetime = new Date();
        message.datetime = datetime;
        message.user = data.sender;
        message.users = data.sender < data.recipient ? data.sender + '+' + data.recipient : data.recipient + '+' + data.sender;
        message.message = data.message;
        message.type = data.type;

        pms.insert(message, datetime.getTime() + "&" + data.sender, (err, ins_message) => { //Log message
          if(err){
            respond(err.reason);
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
  }
}

new Worker();
