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

var async = require("async");
var colours = require("colors");

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
var openidCache = redis.createClient({
  host : 'redis',
  port : 6379,
  db : 2
});

db.query("SELECT \"group\", channel FROM channels", (err, res) => {
  if(err){
    console.log(err);
  }else if(res.rows[0]){
    async.each(res.rows[0].array_agg, (row, cb) => {
      db.query("SELECT array_agg(\"user\") AS users FROM channel_users WHERE \"group\" = $1 AND channel = $2 GROUP BY \"group\", channel", [
        row.group,
        row.channel
      ], (err2, res2) => {
        if(err2){
          cb(err2);
        }else{
          var val = JSON.stringify(res2.rows[0] ? res2.rows[0].users : [])
          cache.get(row.group + '+' + row.channel, (row_err, row_val) => {
            if(!row_val || (row_val != val)){
              cache.set(row.group + '+' + row.channel, val, cb);
            }else{
              cb();
            }
          })
        }
      });
    }, (cb_err) => {
      console.log(cb_err ? cb_err : "Cache updated with channel users.".green);
    });
  }
});
db.query("SELECT DISTINCT \"group\", \"user\" FROM channel_users", (err, res) => {
  if(err){
    console.error(err);
  }else{
    async.each(res.rows, (row, cb) => {
      users_cache.hexists(row.user, row.group, (exists_err, exists) => {
        exists ? cb() : users_cache.hset(row.user, row.group, 1, cb);
      })
    }, () => {
      console.log("Cache updated with user groups.".green);
    });
  }
});

db.query("SELECT id, secret FROM clients", (err, res) => {
  if(err){
    console.error(err);
  }else{
    async.each(res.rows, (row, cb) => {
      openidCache.set(row.id, row.secret, cb);
    }, () => {
      console.log("Cache update with clients.".green);
    });
  }
});

db.query("SELECT \"user\", scope FROM permissions WHERE action = 'send_message'", (err, res) => {
  if(err){
    console.error(err);
  }else{
    async.each(res.rows, (row, cb) => {
      users_cache.hexists(row.user, row.scope, (exists_err, exists) => {
        exists ? cb() : users_cache.hset(row.user, row.scope, 1, cb);
      })
    }, () => {
      console.log("Cache updated with user permissions.".green);
    });
  }
});

db.query("SELECT id, name, username FROM users", (err, res) => {
  if(err){
    console.error(err);
  }else{
    async.each(res.rows, (row, cb) => {
      users_cache.hset(row.id, '_exists', 1);
      if(row.name){
        var uname = row.name.toUpperCase();
        cache.hget('usernames', uname, (cache_err, val) => {
          if(val){
            if(!val.includes(row.id))
              cache.hset('usernames', uname, val + row.id + '+');
          }else{
            cache.hset('usernames', uname, row.id + '+');
          }
        });
      }
      if(row.username){
        var uuname = row.username.toUpperCase();
        cache.hget('usernames', uuname, function(cache_err, val){
          if(val){
            if(!val.includes(row.id))
              cache.hset('usernames', uuname, val + row.id + '+');
          }else{
            cache.hset('usernames', uuname, row.id + '+');
          }
        });
      }
      cb();
    }, () => {
      console.log("Cache updated with user's name and username.".green);
    });
  }
});
