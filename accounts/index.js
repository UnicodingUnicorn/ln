var express = require("express");
var bodyParser = require("body-parser");
var cors = require("cors");

var async = require("async");
var bearerToken = require("bearer-token");
var colors = require("colors");
var jwt = require("jsonwebtoken");

var nano = require("nano")("http://" + process.env.COUCHDB_USER + ":" + process.env.COUCHDB_PASSWORD + "@couchdb:5984");
var creator = require("couchdb-creator");

var redis = require("redis");
var cache = redis.createClient({
  host : 'redis',
  port : 6379,
  db : 0
});
var users_cache = redis.createClient({
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
        users_cache.hset(row.id, '_exists', '1');
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
          users_cache.hset(user, row.doc.group, 1);
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

var auth = (req, res, next) => {
  bearerToken(req, (tok_err, token) => {
    jwt.verify(token, process.env.CLIENT_SECRET, (ver_err, decoded) => {
      if(ver_err){
        res.status(403).json({
          message : "Improper token"
        });
      }else if(decoded.aud != process.env.CLIENT_ID){
        res.status(403).json({
          message : "Improper token"
        });
      }else{
        req.user = decoded.sub;
        next();
      }
    });
  });
};

app.get("/", function(req, res){
  res.status(200).json({
    message : "Received at Accounts API"
  });
});

app.get("/user", function(req, res){
  if(req.query.id){
    users.get(req.query.id, (get_err, user) => {
      if(get_err){
        res.status(500).json({
          message : get_err.reason
        });
      }else{
        res.status(200).json({
          message : "Success",
          user : {
            name : user.name,
            username : user.username,
            email : user.email,
            dob : user.dob,
            gender : user.gender,
            avatar : user.avatar
          }
        });
      }
    });
  }else if(req.query.name){
    cache.hscan('usernames', 0, 'MATCH', req.query.name.toUpperCase() + '*', (err, reply) => {
      var return_data = [];
      async.each(reply[1], (user_id, cb) => {
        cache.hget('usernames', user_id, (get_err, user) => {
          if(get_err || !user){
            cb();
          }else{
            async.each(user.split('+'), (user_id_indiv, cb2) => {
              if(user_id_indiv != '' && !return_data.includes(user_id_indiv))
                return_data.push(user_id_indiv);
              cb2();
            }, cb);
          }
        });
      }, () => {
        res.status(200).json({
          message : "Success",
          ids : return_data
        });
      });
    });
  }
});

app.post("/user", auth, function(req, res){
  users.get(req.user, (get_err, user) => {
    if(get_err){
      if(get_err.statusCode == 404){
        res.status(404).json({
          message : 'User not found'
        });
      }else{
        res.status(500).json({
          message : 'Internal database error'
        });
      }
    }else{
      if(req.body.username && user.username != req.body.username){ //Don't waste time changing the same
        var old_username = user.username;
        cache.hget("usernames", old_username.toUpperCase(), (cache_err, user_ids) => {
          user_ids = user_ids.split('+');
          var new_ids = "";
          async.each(user_ids, (user_id, cb) => {
            if(user_id != user._id && user_id != "")
              new_ids += user_id + "+";
            cb();
          }, () => {
            if(new_ids == ""){
              cache.hdel("usernames", old_username.toUpperCase());
            }else{
              cache.hset("usernames", old_username.toUpperCase(), new_ids);
            }
          });
        });
        user.username = req.body.username;
        cache.hget("usernames", req.body.username.toUpperCase(), (cache_err, user_ids) => {
          if(!user_ids){
            user_ids = user._id + '+';
          }else if(!user_ids.split('+').includes(user._id)){
            user_ids += user._id + '+';
          }
          cache.hset("usernames", req.body.username.toUpperCase(), user_ids);
        });
      }
      if(req.body.avatar)
        user.avatar = req.body.avatar;
      users.insert(user, (mod_err, mod_body) => {
        res.status(200).json({
          message : 'Success'
        });
      });
    }
  });
});

app.get('/users', auth, function(req, res){
  if(!(req.query.channel && req.query.group)){
    res.status(400).json({
      message : 'Channel not found'
    });
  }else{
    permissions.view('permissions', 'by_user_action_scope', { //Check if user can view channel in scope group-channel
      key : [req.user, 'view_channel', {group : req.query.group, channel : req.query.channel}]
    }, (view_err, channel_users) => {
      if(channel_users.rows[0]){ //If a permission is found
        var full_users = {};
        cache.get(req.query.group + '+' + req.query.channel, (get_err, channel_users) => {
          channel_users = JSON.parse(channel_users);
          //Loop through all returned permissions and add the users to final return value
          async.each(channel_users, function(user_id, cb){
            users.get(user_id, function(get_err, indiv_user){
              if(get_err){
                cb(get_err.message);
              }else{
                full_users[user_id] = {
                  name : indiv_user.name,
                  username : indiv_user.username,
                  email : indiv_user.email,
                  dob : indiv_user.dob,
                  gender : indiv_user.gender,
                  avatar : indiv_user.avatar
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
        });
      }else{
        res.status(404).json({
          message : "Group-Channel not found"
        });
      }
    });
  }
});

app.get('/usernames', function(req, res){
  cache.hkeys('usernames', (err, body) => {
    res.status(200).json({
      message : "Success",
      usernames : body
    });
  });
});

app.post('/channel', auth, function(req, res){
  if(!req.body.group){
    res.status(400).json({
      message : "No group found"
    });
  }else if(!req.body.channel){
    res.status(400).json({
      message : "No channel found"
    });
  }else if(req.body.user){ //If user object is present add user to specified gc
    channels.view('channels', 'by_group_channel', { //Cache is not referenced since _rev in original doc is needed to update
      key : [req.body.group, req.body.channel],
      include_docs : true
    }, (get_err, channel) => {
      if(get_err){
        res.status(500).json({
          message : get_err.message
        });
      }else{
        if(!channel.rows[0]){
          res.status(404).json({
            message : "Channel not found"
          });
        }else{
          channel = channel.rows[0].doc;
          if(channel.users.includes(req.body.user)){ //Success if the user is already in
            res.status(200).json({
              message : "Success"
            });
          }else{
            permissions.view('permissions', 'by_user_action_scope', {
              key : [req.user, 'add_user', {group : req.body.group, channel : req.body.channel}]
            }, (perm_err, perm) => {
              if(!perm.rows[0]){
                res.status(403).json({
                  message : "No permission"
                });
              }else{
                users_cache.exists(req.body.user, (user_err, user_exists) => { //Check if user exists
                  if(user_exists){
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
                    }]}, (ins_err, body) => {
                      if(ins_err){
                        res.status(500).json({
                          message : ins_err.message
                        });
                      }else{
                        //Add add_channel permission to user if nonexistant
                        users_cache.hexists(req.body.user, req.body.group, (exists_err, group_exists) => {
                          if(!group_exists){
                            permissions.insert({
                              user : req.body.user,
                              action : 'add_channel',
                              scope : req.body.group,
                              value : "1"
                            }, (ins_channel_err, ins_channel_body) => {
                              users_cache.hset(req.body.user, req.body.group, 1);
                            });
                          }
                        });
                        if(!channel.users.includes(req.body.user))
                          channel.users.push(req.body.user);
                        users_cache.hset(req.body.user, req.body.group + '+' + req.body.channel, 1);
                        cache.set(req.body.group + '+' + req.body.channel, JSON.stringify(channel.users));
                        channels.insert(channel, (mod_err, mod_body) => {
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
              }
            });
          }
        }
      }
    });
  }else{ //Otherwise create gc itself
    cache.exists(req.body.group + '+' + req.body.channel, (exists_err, gc_exists) => {
      if(gc_exists){
        res.status(200).json({
          message : "Success"
        });
      }else{
        permissions.view('permissions', 'by_user_action_scope', { //Check for permission to add in group
          key : [req.user, 'add_channel', req.body.group]
        }, (view_err, perm) => {
          if(perm.rows[0]){
            //Insert channel creator into channel
            permissions.bulk({docs : [{
              user : req.user,
              action : 'send_message',
              scope : {group : req.body.group, channel : req.body.channel},
              value : "1"
            },{
              user : req.user,
              action : 'view_channel',
              scope : {group : req.body.group, channel : req.body.channel},
              value : {group : req.body.group, channel : req.body.channel}
            },{
              user : req.user,
              action : 'send_file',
              scope : {group : req.body.group, channel : req.body.channel},
              value : "1"
            },{
              user : req.user,
              action : 'add_user',
              scope : {group : req.body.group, channel : req.body.channel},
              value : "1"
            }]}, (ins_err, body) => {
              if(ins_err){
                res.status(500).json({
                  message : ins_err.message
                });
              }else{
                users_cache.hset(req.user, req.body.group + '+' + req.body.channel, 1);
                channels.insert({
                  group : req.body.group,
                  channel : req.body.channel,
                  users : [ req.user ]
                }, (ins_err, ins_body) => {
                  if(ins_err){
                    res.status(500).json({
                      message : "Database error"
                    });
                  }else{
                    cache.set(req.body.group + '+' + req.body.channel, JSON.stringify([ req.user ]));
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
  err ? console.error(err) : console.log(("Accounts API up at " + process.env.ACCOUNTS_PORT).green);
});
