/*
Copyright (C) 2018 Daniel Lim Hai

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License along
with this program; if not, write to the Free Software Foundation, Inc.,
51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
*/

var express = require("express");
var bodyParser = require("body-parser");
var cors = require("cors");

var async = require("async");
var bearerToken = require("bearer-token");
var colors = require("colors");
var jwt = require("jsonwebtoken");

var { Pool } = require("pg");
var db = new Pool({
  host : process.env.PG_HOST,
  port : process.env.PG_PORT,
  database : "postgres",
  user : process.env.PG_USER,
  password : process.env.PG_PASSWORD
});

var redis = require("redis");
var cache = redis.createClient({
  host : process.env.REDIS_HOST,
  port : process.env.REDIS_PORT,
  db : 0
});
var users_cache = redis.createClient({
  host : process.env.REDIS_HOST,
  port : process.env.REDIS_PORT,
  db : 1
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
    db.query("SELECT name, username, email, dob, gender, avatar FROM users WHERE id = $1", [req.query.id], (get_err, user) => {
      if(get_err){
        console.log(get_err);
        res.status(500).json({
          message : "Internal database error"
        });
      }else if(user.rows[0]){
        res.status(200).json({
          message : "Success",
          user : user
        });
      }else{
        res.status(404).json({
          message : "User not found"
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
  db.query("SELECT * FROM users WHERE id = $1", [req.user], (get_err, user) => {
    if(get_err){
      res.status(500).json({
        message : 'Internal database error'
      });
    }else if(!user.rows[0]){
      res.status(404).json({
        message : 'User not found'
      });
    }else{
      var user = user.rows[0];
      if(req.body.username && user.username != req.body.username){ //Don't waste time changing the same thing
        var old_username = user.username;
        cache.hget("usernames", old_username.toUpperCase(), (cache_err, user_ids) => {
          user_ids = user_ids.split('+');
          var new_ids = "";
          async.each(user_ids, (user_id, cb) => {
            if(user_id != user.id && user_id != "")
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
            user_ids = user.id + '+';
          }else if(!user_ids.split('+').includes(user.id)){
            user_ids += user.id + '+';
          }
          cache.hset("usernames", req.body.username.toUpperCase(), user_ids);
        });
      }
      if(req.body.avatar)
        user.avatar = req.body.avatar;
      db.query("UPDATE users SET username = $1, avatar = $2 WHERE id = $3", [
        user.username,
        user.avatar,
        user.id
      ], (mod_err, mod_res) => {
        res.status(200).json({
          message : 'Success'
        });
      })
    }
  });
});

app.get('/users', auth, function(req, res){
  if(!(req.query.channel && req.query.group)){
    res.status(400).json({
      message : 'Channel not found'
    });
  }else{
    db.query("SELECT EXISTS (SELECT 1 FROM permissions WHERE \"user\" = $1 AND scope = $2 AND action = $3)", [
      req.user,
      req.query.group + '+' + req.query.channel,
      'view_channel'
    ], (perm_err, has_perm) => {
      if(!has_perm.rows[0]){
        res.status(404).json({
          message : "Group-Channel not found"
        });
      }else{
        var full_users = {};
        cache.get(req.query.group + '+' + req.query.channel, (get_err, channel_users) => {
          channel_users = JSON.parse(channel_users);
          //Loop through all returned permissions and add the users to final return value
          async.each(channel_users, (user_id, cb) => {
            db.query("SELECT * FROM users WHERE id = $1", [user_id], (get_err, indiv_user) => {
              if(get_err){
                cb("Internal database error");
              }else if(indiv_user.rows[0]){
                indiv_user = indiv_user.rows[0];
                full_users[user_id] = {
                  name : indiv_user.name,
                  username : indiv_user.username,
                  email : indiv_user.email,
                  dob : indiv_user.dob,
                  gender : indiv_user.gender,
                  avatar : indiv_user.avatar
                };
                cb();
              }else{
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
    cache.get(req.body.group + '+' + req.body.channel, (get_err, channel_users) => {
      if(!channel_users){
        res.status(404).json({
          message : "Channel not found"
        });
      }else{
        channel_users = JSON.parse(channel_users);
        if(channel_users.includes(req.body.user)){ //Success if the user is already in
          res.status(200).json({
            message : "Success"
          });
        }else{
          db.query("SELECT EXISTS (SELECT 1 FROM permissions WHERE \"user\" = $1 AND scope = $2 AND action = $3)", [
            req.user,
            req.body.group + '+' + req.body.channel,
            'add_channel'
          ], (perm_err, perm_exists) => {
            if(!perm_exists.rows[0]){
              res.status(403).json({
                message : "No permission"
              });
            }else{
              users_cache.exists(req.body.user, (user_err, user_exists) => { //Check if user exists
                if(user_exists){
                  db.query("INSERT INTO permissions (\"user\", scope, action) VALUES ($1, $2, $3), ($4, $5, $6), ($7, $8, $9), ($10, $11, $12)", [
                    req.body.user,
                    req.body.group + '+' + req.body.channel,
                    'send_message',
                    req.body.user,
                    req.body.group + '+' + req.body.channel,
                    'view_channel',
                    req.body.user,
                    req.body.group + '+' + req.body.channel,
                    'send_file',
                    req.body.user,
                    req.body.group + '+' + req.body.channel,
                    'add_user'
                  ], (ins_err, ins_body) => {
                    //Add add_channel permission to user if nonexistant
                    users_cache.hexists(req.body.user, req.body.group, (exists_err, group_exists) => {
                      if(!group_exists){
                        db.query("INSERT INTO permissions (\"user\", scope, action) VALUES ($1, $2, $3)", [
                          req.body.user,
                          req.body.group,
                          'add_channel'
                        ], (ins_channel_err, ins_channel_body) => {
                          users_cache.hset(req.body.user, req.body.group, 1);
                        });
                      }
                    });
                    if(!channel_users.includes(req.body.user)){
                      channel_users.push(req.body.user);
                      db.query("INSERT INTO channel_users (\"group\", channel, \"user\") VALUES ($1, $2, $3)", [
                        req.body.group,
                        req.body.channel,
                        req.body.user
                      ], (ins_user_err, ins_user_res) => {
                        cache.set(req.body.group + '+' + req.body.channel, JSON.stringify(channel_users));
                      });
                    }
                    users_cache.hset(req.body.user, req.body.group + '+' + req.body.channel, 1);
                    res.status(200).json({
                      message : "Success"
                    });
                  });
                }
              });
            }
          });
        };
      }
    });
  }else{ //Otherwise create gc itself
    cache.exists(req.body.group + '+' + req.body.channel, (exists_err, gc_exists) => {
      if(gc_exists){
        res.status(200).json({
          message : "Success"
        });
      }else{
        db.query("SELECT EXISTS (SELECT 1 FROM permissions WHERE \"user\" = $1 AND scope = $2 AND action = $3)", [
          req.user,
          req.body.group,
          'add_channel'
        ], (perm_err, perm) => {
          if(!perm.rows[0]){
            res.status(403).json({
              message : "No permission"
            });
          }else{
            //Insert channel creator into channel
            db.query("INSERT INTO permissions (\"user\", scope, action) VALUES ($1, $2, $3), ($4, $5, $6), ($7, $8, $9), ($10, $11, $12)", [
              req.user,
              req.body.group + '+' + req.body.channel,
              'send_message',
              req.user,
              req.body.group + '+' + req.body.channel,
              'view_channel',
              req.user,
              req.body.group + '+' + req.body.channel,
              'send_file',
              req.user,
              req.body.group + '+' + req.body.channel,
              'add_user'
            ], (ins_err, ins_body) => {
              if(ins_err){
                res.status(500).json({
                  message : "Internal database error"
                });
              }else{
                users_cache.hset(req.user, req.body.group + '+' + req.body.channel, 1);
                db.query("INSERT INTO channels (\"group\", channel) VALUES ($1, $2)", [
                  req.body.group,
                  req.body.channel
                ], (ins_err, ins_body) => {
                  if(!ins_err){
                    db.query("INSERT INTO channel_users (\"group\", channel, \"user\") VALUES ($1, $2, $3)", [
                      req.body.group,
                      req.body.channel,
                      req.user
                    ], (ins_user_err, ins_user_res) => {
                      if(!ins_user_err){
                        cache.set(req.body.group + '+' + req.body.channel, JSON.stringify([ req.user ]));
                        res.status(200).json({
                          message : "Success"
                        });
                      }
                    });
                  }
                });
              }
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
