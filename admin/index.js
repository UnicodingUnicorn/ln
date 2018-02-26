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
var expresshbs = require("express-handlebars");
var session = require("express-session");

var async = require("async");
var basicauth = require("basic-auth");
var bcrypt = require("bcryptjs");
var salt_rounds = 10;
var colors = require("colors");
var crypto = require("crypto");
var split = require("split");
var streamifier = require("streamifier");
var uniqid = require("uniqid");

var multer = require("multer");
var storage = multer.memoryStorage();
var upload = multer({
  storage : storage
});

var ALPHANUMERIC = 'ABCEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890';

var redis = require("redis");
var cache = redis.createClient({
  host : process.env.REDIS_HOST,
  port : process.env.REDIS_PORT,
  db : 0
});
var user_cache = redis.createClient({
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
app.use(bodyParser.urlencoded({extended : true}));
app.use(cors());

var handlebars = expresshbs.create({
  defaultLayout : 'main',
  helpers : {
    uniqid : () => {
      return uniqid();
    },
    isMale : (gender) => {
      return gender == 'm' || gender == 'M';
    },
    isFemale : (gender) => {
      return gender == 'f' || gender == 'F';
    }
  }
});
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');

app.use(session({
  secret : crypto.createHmac('sha256', uniqid()).update(uniqid()).digest('hex'),
  cookie : { maxAge : 1000 * 60 * 60 * 24},
  resave : false,
  saveUninitialized : false
}));

var getAuth = function(req, res, next){
  var user = basicauth(req);
  if(user){
    req.auth = {};
    req.auth.username = user.name;
    req.auth.pass = user.pass;
    next();
  }else{
    res.status(401).json({
      message : "No auth header"
    });
  }
}

var auth = (req, res, next) => {
  if(req.session){
    next();
  }else{
    res.redirect('/login');
  }
};

app.use(express.static(__dirname + "/assets"));
app.use((req, res, next) => {
  res.data = {};
  next();
});

app.get("/", function(req, res){
  res.redirect(req.session.username ? '/clients' : '/login');
});

app.get('/login', function(req, res){
  res.render('login');
});

app.post("/login", function(req, res){
  if(!req.body.username){
    res.data.message = "Missing username";
    res.render('login', res.data);
  }else if(!req.body.password){
    res.data.message = "Missing password";
    res.render('login', res.data);
  }else{
    db.query("SELECT password FROM admins WHERE username = $1", [req.body.username], (err, auth_res) => {
      if(!auth_res.rows[0]){
        res.data.message = "Username not found";
        res.render('login', res.data);
      }else{
        if(auth_res.rows[0].password == req.body.password){
          req.session.username = req.body.username;
          req.session.password = req.body.password;
          res.redirect('/');
        }else{
          res.data.message = "Invalid password";
          res.render('login', res.data);
        }
      }
    });
  }
});

app.get('/logout', function(req, res){
  req.session.destroy((err) => {
    res.redirect('/');
  });
});

app.get('/clients', auth, function(req, res){
  if(req.session.success){
    res.data.success = req.session.success;
    delete req.session.success;
  }
  if(req.session.client_id){
    res.data.client_id = req.session.client_id;
    delete req.session.client_id;
  }
  if(req.session.client_secret){
    res.data.client_secret = req.session.client_secret;
    delete req.session.client_secret;
  }
  if(req.session.error){
    res.data.error = req.session.error;
    delete req.session.error;
  }
  db.query("select cl.id, cl.name, cl.secret, array_agg(cru.uri) AS redirect_uris FROM clients cl, client_redirect_uris cru WHERE cl.id = cru.client_id GROUP BY cl.id, cl.name, cl.secret;", (list_err, list_res) => {
    if(list_err){
      console.log(list_err);
      res.data.error = "Database error";
      res.render('clients', res.data);
    }else{
      res.data.clients = list_res.rows;
      res.render('clients', res.data);
    }
  });
});

app.post("/client", auth, function(req, res){
  if(req.body.id){
    var cb = () => {
      if(req.body.name){
        db.query("UPDATE clients SET name = $1 WHERE id = $2", [
          req.body.name,
          req.body.id
        ], (ins_name_err, ins_name_res) => {
          if(ins_name_err){
            console.log(ins_name_err);
          }else{
            req.session.success = "Success!";
            res.redirect('/clients');
          }
        })
      }else{
        req.session.success = "Success!";
        res.redirect('/clients');
      }
    };
    if(req.body.last_uri){
      db.query("INSERT INTO client_redirect_uris (client_id, uri) VALUES ($1, $2)", [
        req.body.id,
        req.body.last_uri
      ], (ins_uri_err, ins_res) => {
        if(ins_uri_err){
          req.session.error = "Database error";
          res.redirect('/clients');
        }else{
          cb();
        }
      });
    }else{
      cb();
    }
  }else{
    var client = {
      id : uniqid(),
      name : req.body.name,
      secret : crypto.createHmac('sha256', uniqid()).update(uniqid()).digest('hex')
    };
    db.query("INSERT INTO clients (id, name, secret) VALUES ($1, $2, $3)", [
      client.id,
      client.name,
      client.secret
    ], (ins_err, ins_res) => {
      if(ins_err){
        console.log(ins_err);
        req.session.error = "Database error";
        res.redirect('/clients');
      }else{
        db.query("INSERT INTO client_redirect_uris (client_id, uri) VALUES ($1, $2)", [
          client.id,
          req.body.redirect_uri
        ], (ins_uri_err, ins_uri_body) => {
          if(ins_uri_err){
            console.log(ins_err);
            req.session.error = "Database error";
            res.redirect('/clients');
          }else{
            req.session.success = "Success!";
            req.session.client_id = client.id;
            req.session.client_secret = client.secret;
            res.redirect('/clients');
          }
        });
      }
    });
  }
});

app.get('/users', auth, function(req, res){
  if(req.session.success){
    res.data.success = req.session.success;
    delete req.session.success;
  }
  if(req.session.error){
    res.data.error = req.session.error;
    delete req.session.error;
  }
  if(req.session.user){
    res.data.user = req.session.user;
    delete req.session.user;
  }
  res.render('users', res.data);
});

app.get('/user', auth, function(req, res){
  db.query("SELECT * FROM users WHERE id = $1", [req.query.id], (get_err, user_res) => {
    if(get_err){
      req.session.error = get_err.reason;
    }else if(!user_res.rows[0]){
      console.log(user_res);
      req.session.error = req.query.id + " not found";
    }else{
      var user = user_res.rows[0];
      req.session.user = {
        id : user.id,
        name : user.name,
        username : user.username,
        email : user.email,
        dob : user.dob,
        gender : user.gender
      };
    }
    res.redirect('/users');
  });
});

app.post("/user", auth, function(req, res){
  if(!req.body.id){
    req.session.error = "ID not found";
    res.redirect("/users");
  }else{
    db.query("SELECT * FROM users WHERE id = $1", [req.body.id], (get_err, user) => {
      if(get_err){
        req.session.error = "Database error";
        res.redirect("/users");
      }else{
        var userid = user.rows[0].id || req.body.id;
        var cb = (ins_err, ins_res, name) => {
          if(ins_err){
            console.log(ins_err);
            req.session.error = "Database error";
            res.redirect("/users");
          }else{
            console.log(ins_res);
            cache.hget('usernames', name.toUpperCase(), (cache_err, val) => {
              cache.hset('usernames', name.toUpperCase(), (val && !val.includes(userid)) ? val + userid + '+' : userid + '+');
            });
            user_cache.hset(userid, "_exists", 1);

            req.session.success = "Success!";
            if(req.body.autogenpass)
              req.session.success += " Auto-generated password is " + req.body.password;
            res.redirect("/user?id=" + userid);
          }
        };
        if(!user.rows[0]){
          var password = "";
          if(!req.body.name){
            req.session.error = "Missing name field";
            res.redirect("/users");
          }else if(!req.body.username){
            req.session.error = "Missing username field";
            res.redirect("/users");
          }else if(!req.body.email){
            req.session.error = "Missing email field";
            res.redirect("/users");
          }else if(!req.body.password && !req.body.autogenpass){
            req.session.error = "Missing password field";
            res.redirect("/users");
          }else if(!req.body.gender){
            req.session.error = "Missing gender field";
            res.redirect("/users");
          }else if(!req.body.dob){
            req.session.error = "Missing D.O.B. field";
            res.redirect("/users");
          }else{
            if(req.body.autogenpass){
              req.body.password = "";
              for(var i = 0; i < 8; i++)
                req.body.password += ALPHANUMERIC.charAt(Math.floor(Math.random() * ALPHANUMERIC.length));
            }
            password = bcrypt.hashSync(req.body.password, 8);
          }
          db.query("INSERT INTO users (id, name, username, email, password, gender, dob) VALUES ($1, $2, $3, $4, $5, $6, $7)", [
            userid,
            req.body.name,
            req.body.username,
            req.body.email,
            password,
            req.body.gender,
            req.body.dob
          ], (ins_err, ins_res) => {
            cb(ins_err, ins_res, req.body.name);
          });
        }else{
          user = user.rows[0];
          if(req.body.name)
            user.name = req.body.name;
          if(req.body.username)
            user.username = req.body.username;
          if(req.body.email)
            user.email = req.body.email;
          if(req.body.gender)
            user.gender = req.body.gender;
          if(req.body.dob)
            user.dob = new Date(req.body.dob).getTime();
          db.query("UPDATE users SET name = $1, username = $2, email = $3, gender = $4, dob = $5 WHERE id = $6", [
            user.name,
            user.username,
            user.email,
            user.gender,
            user.dob,
            userid
          ], (ins_err, ins_res) => {
            cb(ins_err, ins_res, user.name);
          });
        }
      }
    });
  }
});

app.post("/user/file", auth, upload.single("file"), function(req, res){
  var rs = streamifier.createReadStream(req.file.buffer).pipe(split());
  var promises = [];
  req.session.success = "";
  var handle_line = (line, line_num) => {
    return new Promise((resolve, reject) => {
      var fields = line.split(",");
      if(fields[0] != ""){
        if(!fields[0]){
          reject("Missing id field on line " + line_num);
        }else if(!fields[1]){
          reject("Missing name field on line " + line_num);
        }else if(!fields[2]){
          reject("Missing username field on line " + line_num);
        }else if(!fields[3]){
          reject("Missing email field on line " + line_num);
        }else if(!fields[4]){
          reject("Missing password field on line " + line_num);
        }else if(!fields[5]){
          reject("Missing gender field on line " + line_num);
        }else if(!fields[6]){
          reject("Missing D.O.B field on line " + line_num);
        }else{
          var password = "";
          if(fields[4] == "_autogenpass"){
            for(var i = 0; i < 8; i++)
              password += ALPHANUMERIC.charAt(Math.floor(Math.random() * ALPHANUMERIC.length));
            req.session.success += "Auto-generated password " + password + " for user " + fields[0] + ".\n";
          }else{
            password = fields[4];
          }
          password = bcrypt.hashSync(password, salt_rounds);
          db.query("SELECT * FROM users WHERE id = $1", [
            fields[0]
          ], (get_err, get_res) => {
            if(get_err){
              console.log(get_err);
              reject("Database error");
            }else{
              if(get_res.rows[0]){
                var user = get_res.rows[0];
                if(fields[1])
                  user.name = fields[1];
                if(fields[2])
                  user.username = fields[2];
                if(fields[3])
                  user.email = fields[3];
                if(fields[5])
                  user.gender = fields[5];
                if(fields[6])
                  user.dob = new Date(fields[6]).getTime();
                db.query("UPDATE users SET name = $1, username = $2, email = $3, gender = $4, dob = $5 WHERE id = $6", [
                  user.name,
                  user.username,
                  user.email,
                  user.gender,
                  user.dob,
                  fields[0]
                ], (ins_err, ins_res) => {
                  if(ins_err){
                    console.log(ins_err);
                    reject("Database error");
                  }else{
                    cache.hget('usernames', user.name.toUpperCase(), (cache_err, val) => {
                      cache.hset('usernames', user.name.toUpperCase(), (val && !val.split('+').includes(fields[0])) ? val + fields[0] + '+' : fields[0] + '+');
                    });
                    user_cache.hset(fields[0], "_exists", 1);
                    resolve();
                  }
                });
              }else{
                db.query("INSERT INTO users (id, name, username, email, password, gender, dob) VALUES ($1, $2, $3, $4, $5, $6, $7)", [
                  fields[0],
                  fields[1],
                  fields[2],
                  fields[3],
                  password,
                  fields[5],
                  new Date(fields[6]).getTime()
                ], (ins_err, ins_res) => {
                  if(ins_err){
                    console.log(ins_err);
                    reject("Database error");
                  }else{
                    cache.hget('usernames', fields[1].toUpperCase(), (cache_err, val) => {
                      cache.hset('usernames', fields[1].toUpperCase(), (val && !val.split('+').includes(fields[0])) ? val + fields[0] + '+' : fields[0] + '+');
                    });
                    user_cache.hset(fields[0], "_exists", 1);
                    resolve();
                  }
                });
              }
            }
          });
        }
      }else{
        resolve();
      }
    });
  };
  var line_num = 0;
  rs.on("data", (line) => {
    promises.push(handle_line(line, line_num));
    line_num++;
  });
  rs.on("end", () => {
    Promise.all(promises).then(() => {
      req.session.success += "Success"
      res.redirect("/users");
    }, (err) => {
      req.session.error = err;
      res.redirect("/users");
    });
  });
});

app.get("/channels", auth, function(req, res){
  if(req.session.success){
    res.data.success = req.session.success;
    delete req.session.success;
  }
  if(req.session.error){
    res.data.error = req.session.error;
    delete req.session.error;
  }
  var gcs_tmp = {};
  db.query("SELECT \"group\", array_agg(channel) AS channels FROM channels GROUP BY \"group\"", (get_err, get_res) => {
    res.data.gcs = [];
    if(get_err){
      console.log(get_err);
      res.data.error = "Database error";
      res.render('channels', res.data);
    }else{
      async.each(get_res.rows, (row, cb) => {
        res.data.gcs.push({
          group : row.group,
          channels : row.channels
        });
        cb();
      }, () => {
          res.render('channels', res.data);
      });
    }
  });
});

app.post("/channel", auth, function(req, res){
  if(!req.body.group){
    req.session.error = "Missing group";
    res.redirect("/channels");
  }else if(!req.body.channel){
    req.session.error = "Missing channel";
    res.redirect("/channels");
  }else{
    cache.exists(req.body.group + '+' + req.body.channel, (exists_err, exists) => {
      if(exists){
        req.session.error = "Channel already exists";
        res.redirect("/channels");
      }else{
        db.query("INSERT INTO channels (\"group\", channel) VALUES ($1, $2)", [
          req.body.group,
          req.body.channel
        ], (ins_err, ins_body) => {
          if(ins_err){
            console.log(ins_err);
            req.session.error = "Database error";
            res.redirect("/channels");
          }else{
            cache.set(req.body.group + '+' + req.body.channel, JSON.stringify([]));
            req.session.success = 'Success';
            res.redirect("/channels");
          }
        });
      }
    });
  }
});

app.post("/channels/file", auth, upload.single("file"), function(req, res){
  var rs = streamifier.createReadStream(req.file.buffer).pipe(split());
  var promises = [];
  req.session.success = "";
  var handle_line = (line, line_num) => {
    return new Promise((resolve, reject) => {
      var fields = line.split(",");
      if(fields[0] != ""){
        if(!fields[0]){
          reject("Missing group field on line " + line_num);
        }else if(!fields[1]){
          reject("Missing channel field on line " + line_num);
        }else{
          cache.exists(fields[0] + '+' + fields[1], (exists_err, exists) => {
            var update_users = () => {
              async.each(fields.slice(2, fields.length), (userid, cb) => {
                user_cache.exists(userid, (user_exists_err, user_exists) => {
                  if(user_exists){
                    cache.get(fields[0] + '+' + fields[1], (get_err, channel_users) => {
                      if(!channel_users){
                        cb(fields[0] + ":" + fields[1] + " not found when adding users.");
                      }else{
                        channel_users = JSON.parse(channel_users);
                        if(channel_users.includes(userid)){
                          cb();
                        }else{
                          db.query("INSERT INTO permissions (\"user\", scope, action) VALUES ($1, $2, $3), ($4, $5, $6), ($7, $8, $9), ($10, $11, $12)", [
                            userid,
                            fields[0] + '+' + fields[1],
                            'send_message',
                            userid,
                            fields[0] + '+' + fields[1],
                            'view_channel',
                            userid,
                            fields[0] + '+' + fields[1],
                            'send_file',
                            userid,
                            fields[0] + '+' + fields[1],
                            'add_user'
                          ], (ins_err, ins_body) => {
                            if(ins_err){
                              console.log(ins_err);
                              cb("Database error");
                            }else{
                              user_cache.hexists(userid, fields[0], (group_exists_err, group_exists) => {
                                if(!group_exists){
                                  db.query("INSERT INTO permissions (\"user\", scope, action) VALUES ($1, $2, $3)", [
                                    userid,
                                    fields[0],
                                    'add_channel'
                                  ], (ins_channel_err, ins_channel_body) => {
                                    user_cache.hset(userid, fields[0], 1);
                                  });
                                }
                              });
                              //channel_users.push(userid);

                              user_cache.hset(userid, fields[0] + '+' + fields[1], 1);
                              //cache.set(group + '+' + channel, JSON.stringify(channel_users));
                              db.query("INSERT INTO channel_users (\"group\", channel, \"user\") VALUES ($1, $2, $3)", [
                                fields[0],
                                fields[1],
                                userid
                              ], (mod_err, mod_res) => {
                                if(mod_err){
                                  console.log(mod_err);
                                  cb("Database error");
                                }else{
                                  cb();
                                }
                              });
                            }
                          });
                        }
                      }
                    });
                  }else{
                    resolve();
                  }
                });
              }, (err) => {
                if(err){
                  reject(err)
                }else{
                  cache.get(fields[0] + '+' + fields[1], (get_err, channel_users) => {
                    channel_users = channel_users ? JSON.parse(channel_users) : [];
                    channel_users.push(...fields.slice(2, fields.length));
                    cache.set(fields[0] + '+' + fields[1], JSON.stringify(channel_users));
                    resolve();
                  });
                }
              });
            };
            if(exists){
              update_users();
            }else{
              db.query("INSERT INTO channels (\"group\", channel) VALUES ($1, $2)", [
                fields[0],
                fields[1]
              ], (ins_err, ins_body) => {
                if(ins_err){
                  console.log(ins_err);
                  reject("Database error");
                }else{
                  cache.set(fields[0] + '+' + fields[1], JSON.stringify([]));
                  update_users();
                }
              });
            }
          });
        }
      }else{
        resolve();
      }
    });
  };
  var line_num = 0;
  rs.on("data", (line) => {
    promises.push(handle_line(line, line_num));
    line_num++;
  });
  rs.on("end", () => {
    Promise.all(promises).then(() => {
      req.session.success += "Success"
      res.redirect("/channels");
    }, (err) => {
      req.session.error = err;
      res.redirect("/channels");
    });
  });
});

app.post("/channel/user", auth, function(req, res){
  if(!req.body.group){
    req.session.error = "Group not found";
    res.redirect("/channels");
  }else if(!req.body.channel){
    req.session.error = "Channel not found";
    res.redirect("/channels");
  }else if(!req.body.userid){
    req.session.error = "User not found";
    res.redirect("/channels");
  }else{
    cache.get(req.body.group + '+' + req.body.channel, (exists_err, channel_users) => {
      if(!channel_users){
        req.session.error = "Group-Channel not found";
        res.redirect("/channels");
      }else{
        channel_users = JSON.parse(channel_users);
        if(channel_users.includes(req.body.userid)){
          req.session.error = "User already in channel";
          res.redirect("/channels");
        }else{
          db.query("INSERT INTO permissions (\"user\", scope, action) VALUES ($1, $2, $3), ($4, $5, $6), ($7, $8, $9), ($10, $11, $12)", [
            req.body.userid,
            req.body.group + '+' + req.body.channel,
            'send_message',
            req.body.userid,
            req.body.group + '+' + req.body.channel,
            'view_channel',
            req.body.userid,
            req.body.group + '+' + req.body.channel,
            'send_file',
            req.body.userid,
            req.body.group + '+' + req.body.channel,
            'add_user'
          ], (ins_err, ins_body) => {
            if(ins_err){
              console.log(ins_err);
              req.session.error = "Database error";
              res.redirect("/channels");
            }else{
              user_cache.hexists(req.body.userid, req.body.group, (exists_err, group_exists) => {
                if(!group_exists){
                  db.query("INSERT INTO permissions (\"user\", scope, action) VALUES ($1, $2, $3)", [
                    req.body.userid,
                    req.body.group,
                    'add_channel'
                  ], (ins_channel_err, ins_channel_body) => {
                    user_cache.hset(req.body.user, req.body.group, 1);
                  });
                }
              });
              channel_users.push(req.body.userid);
              user_cache.hset(req.body.user, req.body.group + '+' + req.body.channel, 1);
              cache.set(req.body.group + '+' + req.body.channel, JSON.stringify(channel_users));
              db.query("INSERT INTO channel_users (\"group\", channel, \"user\") VALUES ($1, $2, $3)", [
                req.body.group,
                req.body.channel,
                req.body.userid
              ], (mod_err, mod_res) => {
                if(mod_err){
                  console.log(mod_err);
                  req.session.error = mod_err.reason;
                  res.redirect("/channels");
                }else{
                  req.session.success = "Success!";
                  res.redirect("/channels");
                }
              });
            }
          });
        }
      }
    });
  }
});

app.listen(process.env.ADMIN_PORT, function(err){
  err ? console.error(err) : console.log(("Admin API up at " + process.env.ADMIN_PORT).green);
});
