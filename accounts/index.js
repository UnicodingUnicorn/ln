var express = require("express");
var bodyParser = require("body-parser");
var cors = require("cors");

var async = require("async");
var colors = require("colors");
var secret = process.env.SECRET;

var nano = require("nano")("http://" + process.env.COUCHDB_USER + ":" + process.env.COUCHDB_PASSWORD + "@couchdb:5984");
var creator = require("couchdb-creator");

var users_design = {
  'views' : {
    'by_email' : {
      'map' : function(doc){
        emit(doc.email, doc._id);
      }
    }
  }
};
var users;
creator(nano, 'users', {name : 'email', doc : users_design}, function(db){
  users = db;
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
var channels_design = {
  'views' : {
    'by_group_channel' : {
      'map' : function(doc){
        emit([doc.group, doc.channel], doc._id);
      }
    }
  }
}
var channels;
creator(nano, 'channels', {name : 'channels', doc : channels_design}, function(db){
  channels = db;
});

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended : true}));
app.use(cors());

/**
 * @api {get} / Ping API
 * @apiName Ping
 * @apiGroup General
 *
 * @apiSuccess {String} message Received at Accounts API
 */
app.get("/", function(req, res){
  res.status(200).json({
    message : "Received at Accounts API"
  });
});

/**
 * @api {get} /user/:id Get a user by ID
 * @apiName GetUser
 * @apiGroup User
 *
 * @apiParam {String} id User's ID.
 *
 * @apiSuccess {String} message Success
 * @apiSuccess {Object} user User object
 *
 * @apiError {String} 500 Database error. Message is included in 'message'
 */
app.get("/user/:id", function(req, res){
  users.get(req.params.id, function(get_err, user){
    if(get_err){
      res.status(500).json({
        message : get_err.message
      });
    }else{
      res.status(200).json({
        message : "Success",
        user : {
          name : user.name,
          username : user.username,
          email : user.email,
          dob : user.dob,
          gender : user.gender
        }
      });
    }
  });
});

/**
 * @api {get} /users/:channel Get the users in a channel.
 * @apiName GetUsersChannel
 * @apiGroup User
 *
 * @apiHeader {String} User User id passed from the openid service
 * @apiParam {String} channel Channel to query. Pass as stringified json {group : <group>, channel : <channel>}
 *
 * @apiSuccess {String} message Success
 * @apiSuccess {Object} users Object containing users in channel, {<user_id> : <rest of basic user information}
 *
 * @apiError {String} 500 Database error. Exact error message in message.
 * @apiError {String} 404 User or channel not found. See message for exact details.
 */
app.get('/users/:channel', function(req, res){
  if(req.get('User')){
    var gc = JSON.parse(req.params.channel);
    permissions.view('permissions', 'by_user_action_scope', {
      key : [req.get('User'), 'view_channel', gc]
    }, function(view_err, channel_users){
      if(channel_users.rows[0]){
        channels.view('channels', 'by_group_channel', {
          key : [gc.group, gc.channel],
          include_docs : true
        }, function(chan_err, channel){
          if(channel.rows[0]){
            var full_users = {};
            async.each(channel.rows[0].doc.users, function(user_id, cb){
              users.get(user_id, function(get_err, indiv_user){
                if(get_err){
                  cb(get_err.message);
                }else{
                  full_users[user_id] = {
                    name : indiv_user.name,
                    username : indiv_user.username,
                    email : indiv_user.email,
                    dob : indiv_user.dob,
                    gender : indiv_user.gender
                  };
                  cb();
                }
              });
            }, function(err){
              if(err){
                res.status(500).json({
                  message : err.message
                });
              }else{
                res.status(200).json({
                  message : 'Success',
                  users : full_users
                });
              }
            });
          }else{
            res.status(404).json({
              message : "Channel not found"
            });
          }
        });
      }else{
        res.status(404).json({
          message : "Channel not found"
        });
      }
    });
  }else{
    res.status(404).json({
      message : 'User not found'
    });
  }
});

app.listen(process.env.ACCOUNTS_PORT, function(err){
  err ? console.error(err) : console.log(("Accounts API up at " + process.env.ACCOUNTS_PORT).rainbow);
});
