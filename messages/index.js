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
var colour = require("colors");
var jwt = require("jsonwebtoken");

var redis = require("redis");
var cache = redis.createClient({
  host : process.env.REDIS_HOST,
  port : process.env.REDIS_PORT,
  db : 0
});
var usersCache = redis.createClient({
  host : process.env.REDIS_HOST,
  port : process.env.REDIS_PORT,
  db : 1
});

var { Pool } = require("pg");
var db = new Pool({
  host : process.env.PG_HOST,
  port : process.env.PG_PORT,
  database : "postgres",
  user : process.env.PG_USER,
  password : process.env.PG_PASSWORD
});

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended : true}));

app.use(cors({
  "preflightContinue": false
}));

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
    message : "Received at Messages API"
  });
});

app.get("/messages/:group/:channel", auth, function(req, res){
  cache.exists(req.params.group + '+' + req.params.channel, (exists_err, gc_exists) => { //Check if gc exists
    if(!gc_exists){
      res.status(404).json({
        message : 'No channel found'
      });
    }else{
      db.query("SELECT EXISTS (SELECT 1 FROM permissions WHERE \"user\" = $1 AND scope = $2 AND action = $3)", [
        req.user,
        req.params.group + '+' + req.params.channel,
        'view_channel'
      ], (perm_err, channel_perm) => {
        if(!channel_perm.rows[0].exists){
          res.status(403).json({
            message : 'No permission'
          });
        }else{
          db.query("SELECT * FROM messages WHERE \"group\" = $1 AND channel = $2 LIMIT $3 OFFSET $4", [
            req.params.group,
            req.params.channel,
            req.query.count ? req.query.count : 'ALL',
            req.query.offset ? req.query.offset : 0
          ], (err, body) => {
            if(err){
              res.status(200).json({
                message : "Success",
                messages : {},
                timestamp : undefined
              }); //Just return an empty body
            }else{
              var messages_data = [];
              body.rows.forEach((message) => {
                var message_text;
                try{
                  message_text = JSON.parse(message.message);
                }catch (exception) {
                  message_text = message.message;
                }
                messages_data.push({
                  user : message.user,
                  datetime : message.datetime,
                  message : message_text,
                  type : message.type
                });
              });
              usersCache.hget(req.user, req.params.group + '+' + req.params.channel, (cache_err, timestamp) => {
                res.status(200).json({
                  message : "Success",
                  messages : messages_data,
                  timestamp : timestamp
                });
              });
            }
          });
        }
      });
    }
  });
});

app.get("/channels", auth, function(req, res){
  db.query("SELECT array_agg(scope) FROM permissions WHERE \"user\" = $1 AND action = $2 GROUP BY \"user\"", [
    req.user,
    'view_channel'
  ], (view_err, channels) => {
    if(!view_err){
      if(!channels.rows[0]){
        res.status(200).json([]);
      }else{
        var return_channels = [];
        async.each(channels.rows[0].array_agg, (channel, cb) => {
          var gc = channel.split('+');
          db.query("SELECT array_agg(\"user\") FROM channel_users WHERE \"group\" = $1 AND channel = $2 GROUP BY \"group\"", [
            gc[0],
            gc[1]
          ], (err2, res2) => {
            if(err2){
              console.log(err2);
              cb(err2);
            }else{
              return_channels.push({
                group : gc[0],
                channel : gc[1],
                users : res2.rows[0] ? res2.rows[0].array_agg : []
              });
              cb();
            }
          });
        }, (err) => {
          res.status(200).json(err ? [] : return_channels);
        });
      }
    }
  });
});

app.get('/pms', auth, function(req, res){
  var return_users = [];
  db.query("SELECT \"user\", recipient FROM pms WHERE recipient = $1 OR \"user\" = $2", [
    req.user,
    req.user
  ], (get_err, get_res) => {
    if(get_err){
      console.log(get_err);
      res.status(200).json({
        message : "Success",
        pms : []
      });
    }else{
      async.each(get_res.rows, (row, cb) => {
        if(!return_users.includes(row.user) && row.user != req.user)
          return_users.push(row.user);
        if(!return_users.includes(row.recipient) && row.recipient != req.user)
          return_users.push(row.recipient);
        cb();
      }, () => {
        res.status(200).json({
          message : 'Success',
          pms : return_users
        });
      });
    }
  });
});

app.get("/pms/:user", auth, function(req, res){
  //Key is userid1+userid2, where userid1 < userid2 (using the weird string metrics)
  var key = req.user < req.params.user ? req.user + '+' + req.params.user : req.params.user + '+' + req.user;
  db.query("SELECT * FROM pms WHERE users = $1 LIMIT $2 OFFSET $3", [
    key,
    req.query.count ? req.query.count : 'ALL',
    req.query.offset ? req.query.offset : 0
  ], (get_err, get_res) => {
    if(get_err){
      console.log(get_err);
      res.status(200).json({
        message : "Success",
        messages : []
      });
    }else{
      var return_pms = [];
      get_res.rows.forEach((row) => {
        var message_text;
        try{
          message_text = JSON.parse(row.message);
        }catch (exception) {
          message_text = row.message;
        }
        return_pms.push({
          user : row.user,
          users : row.users,
          datetime : row.datetime.getTime(),
          message : message_text,
          type : row.type
        });
      });
      res.status(200).json({
        message : "Success",
        messages : return_pms
      });
    }
  });
});

app.listen(process.env.MESSAGES_PORT, function(err){
  err ? console.error(err) : console.log(("Messages API up at " + process.env.MESSAGES_PORT).green);
})
