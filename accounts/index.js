var express = require("express");
var bodyParser = require("body-parser");
var cors = require("cors");

var async = require("async");
var colors = require("colors");
var secret = process.env.SECRET;

var nano = require("nano")("http://" + process.env.COUCHDB_USER + ":" + process.env.COUCHDB_PASSWORD + "@couchdb:5984");
var creator = require("couchdb-creator");

var redis = require("redis");
var cache = redis.createClient({
  host : 'redis',
  port : 6379
});
var perms_cache = redis.createClient({
  host : 'redis',
  port : 6379,
  db : 1
});

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
  users.list({include_docs : true}, function(err, body){
    async.each(body.rows, function(row, cb){
      if(row.id != '_design/email'){
        cache.hset('users', row.id, '1', redis.print);
        if(row.doc.name){
          var uname = row.doc.name.toUpperCase();
          cache.hget('usernames', uname, function(cache_err, val){
            if(val){
              if(!val.includes(row.id))
                cache.hset('usernames', uname, val + row.id + '+', redis.print);
            }else{
              cache.hset('usernames', uname, row.id + '+', redis.print);
            }
          });
        }
        if(row.doc.username){
          var uuname = row.doc.username.toUpperCase();
          cache.hget('usernames', uuname, function(cache_err, val){
            if(val){
              if(!val.includes(row.id))
                cache.hset('usernames', uuname, val + row.id + '+', redis.print);
            }else{
              cache.hset('usernames', uuname, row.id + '+', redis.print);
            }
          });
        }
      }
      cb();
    }, function(err){
      console.log("Cache updated with user's name and username.".green);
    });
  });
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
  channels.list({include_docs : true}, function(err, body){
    async.each(body.rows, function(row, cb){
      if(row.id != '_design/channels'){
        cache.set(row.doc.group + '+' + row.doc.channel, JSON.stringify(row.doc.users));
        async.each(row.doc.users, (user, cb2) => {
          perms_cache.hset(user, row.doc.group, 1);
          cb2();
        }, () => {});
      }
      cb();
    }, function(){
      console.log("Cache updated with user channels.".green);
    });
  });
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
                console.log(err);
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

app.get('/user/by_name/:name', function(req, res){
  cache.hscan('usernames', 0, 'MATCH', req.params.name.toUpperCase() + '*', function(err, reply){
    if(err){
      res.status(500).json({
        message : "Error accessing cache"
      });
    }else{
      var return_data = [];
      async.each(reply[1], function(user_id, cb){
        cache.hget('usernames', user_id, function(get_err, user){
          if(get_err || !user){
            cb();
          }else{
            async.each(user.split('+'), function(user_id_indiv, cb2){
              if(user_id_indiv != '' && !return_data.includes(user_id_indiv))
                return_data.push(user_id_indiv);
              cb2();
            }, function(){
              cb();
            });
          }
        });
      }, function(){
        res.status(200).json({
          message : "Success",
          ids : return_data
        });
      });
    }
  });
});

app.get('/usernames', function(req, res){
  cache.hkeys('usernames', function(err, body){
    res.status(200).json({
      message : "Success",
      usernames : body
    });
  });
});

app.post('/channel/adduser', function(req, res){
  cache.get(req.body.group + '+' + req.body.channel, function(cache_err, channel_cache){
    if(channel_cache && JSON.parse(channel_cache).includes(req.body.user)){
      res.status(200).json({
        message : "Success"
      });
    }else{
      permissions.view('permissions', 'by_user_action_scope', {
        key : [req.get('User'), 'add_user', {group : req.body.group, channel : req.body.channel}]
      }, function(perm_err, perm){
        if(perm.rows[0]){
          channels.view('channels', 'by_group_channel', { //TODO:Remove redundant call
            key : [req.body.group, req.body.channel],
            include_docs : true
          }, function(get_err, channel){
            if(get_err){
              res.status(500).json({
                message : get_err.message
              });
            }else{
              if(channel.rows[0]){
                channel = channel.rows[0].doc;
                cache.hget('users', req.body.user, function(user_err, user){
                  if(user){
                    permissions.bulk({docs : [{
                      user : req.body.user,
                      action : 'send_message',
                      scope : {group : req.body.group, channel : req.body.channel},
                      value : "1"
                    },{
                      user : req.body.user,
                      action : 'view_channel',
                      scope : {group : req.body.group, channel : req.body.channel},
                      value : {group : req.body.group, channel : req.body.channel}
                    },{
                      user : req.body.user,
                      action : 'send_file',
                      scope : {group : req.body.group, channel : req.body.channel},
                      value : "1"
                    },{
                      user : req.body.user,
                      action : 'add_user',
                      scope : {group : req.body.group, channel : req.body.channel},
                      value : "1"
                    }]}, function(ins_err, body){
                      if(ins_err){
                        res.status(500).json({
                          message : ins_err.message
                        });
                      }else{
                        perms_cache.hexists(req.body.user, req.body.group, (exists_err, group_exists) => {
                          if(!group_exists){
                            permissions.insert({
                              user : req.body.user,
                              action : 'add_channel',
                              scope : req.body.group,
                              value : "1"
                            }, (ins_channel_err, ins_channel_body) => {
                              perms_cache.hset(req.body.user, req.body.group, 1);
                            });
                          }
                        });
                        if(!channel.users.includes(req.body.user))
                          channel.users.push(req.body.user);
                        perms_cache.hset(req.body.user, req.body.group + '+' + req.body.channel, 1);
                        cache.set(req.body.group + '+' + req.body.channel, JSON.stringify(channel.users));
                        channels.insert(channel, function(mod_err, mod_bod){
                          if(mod_err){
                            res.status(500).json({
                              message : mod_err.message
                            });
                          }else{
                            res.status(200).json({
                              message : "Success"
                            });
                          }
                        });
                      }
                    });
                  }else{
                    res.status(404).json({
                      message : "User not found"
                    });
                  }
                });
              }else{
                res.status(404).json({
                  message : "Channel not found"
                });
              }
            }
          });
        }else{
          res.status(403).json({
            message : "No permission"
          });
        }
      });
    }
  });
});

app.post('/channel', function(req, res){
  if(!req.body.group){
    res.status(400).json({
      message : "No group found"
    });
  }else if(!req.body.channel){
    res.status(400).json({
      message : "No channel found"
    });
  }else{
    cache.exists(req.body.group + '+' + req.body.channel, (exists_err, gc_exists) => {
      if(gc_exists){
        res.status(200).json({
          message : "Success"
        });
      }else{
        permissions.view('permissions', 'by_user_action_scope', {
          key : [req.get('User'), 'add_channel', req.body.group]
        }, (view_err, perm) => {
          if(perm.rows[0]){
            permissions.bulk({docs : [{
              user : req.get('User'),
              action : 'send_message',
              scope : {group : req.body.group, channel : req.body.channel},
              value : "1"
            },{
              user : req.get('User'),
              action : 'view_channel',
              scope : {group : req.body.group, channel : req.body.channel},
              value : {group : req.body.group, channel : req.body.channel}
            },{
              user : req.get('User'),
              action : 'send_file',
              scope : {group : req.body.group, channel : req.body.channel},
              value : "1"
            },{
              user : req.get('User'),
              action : 'add_user',
              scope : {group : req.body.group, channel : req.body.channel},
              value : "1"
            }]}, (ins_err, body) => {
              if(ins_err){
                res.status(500).json({
                  message : ins_err.message
                });
              }else{
                perms_cache.hset(req.get('User'), req.body.group + '+' + req.body.channel, 1);
                channels.insert({
                  group : req.body.group,
                  channel : req.body.channel,
                  users : [ req.get('User') ]
                }, (ins_err, ins_body) => {
                  if(ins_err){
                    res.status(500).json({
                      message : "Database error"
                    });
                  }else{
                    cache.set(req.body.group + '+' + req.body.channel, JSON.stringify([ req.get('User') ]));
                    res.status(200).json({
                      message : "Success"
                    });
                  }
                });
              }
            });
          }else{
            res.status(403).json({
              message : "No permission"
            });
          }
        });
      }
    });
  }
});

app.listen(process.env.ACCOUNTS_PORT, function(err){
  err ? console.error(err) : console.log(("Accounts API up at " + process.env.ACCOUNTS_PORT).rainbow);
});
