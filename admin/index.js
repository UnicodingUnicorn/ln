var express = require("express");
var bodyParser = require("body-parser");
var cors = require("cors");
var expresshbs = require("express-handlebars");
var session = require("express-session");

var async = require("async");
var basicauth = require("basic-auth");
var bcrypt = require("bcrypt");
var crypto = require("crypto");
var salt_rounds = 10;
var uniqid = require("uniqid");

var ALPHANUMERIC = 'ABCEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890';

var colors = require("colors");

var redis = require("redis");
var cache = redis.createClient({
  host : 'redis',
  port : 6379
});
var user_cache = redis.createClient({
  host : 'redis',
  port : 6379,
  db : 1
});

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
var clients;
creator(nano, 'clients', function(db){
  clients = db;
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
    nano.auth(req.body.username, req.body.password, (auth_err, auth_body, auth_headers) => {
      if(auth_err){
        console.log(auth_err);
        res.data.message = auth_err.reason;
        res.render('login', res.data);
      }else{
        req.session.username = req.body.username;
        req.session.password = req.body.password;
        res.redirect('/');
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
  res.data.clients = [];
  clients.list({
    include_docs : true
  }, (list_err, body) => {
    async.each(body.rows, (row, cb) => {
      res.data.clients.push({
        id : row.doc._id,
        name : row.doc.name,
        secret : row.doc.secret,
        redirect_uris : row.doc.redirect_uris
      });
      cb();
    }, () => {
      res.render('clients', res.data);
    });
  });
});

app.post("/client", auth, function(req, res){
  if(req.body.id){
    var redirect_uris = [];
    async.each(Object.keys(req.body), (key, cb) => {
      if(key.split('-')[1] == 'uri')
        redirect_uris.push(req.body[key]);
      cb();
    }, () => {
      clients.get(req.body.id, (g_err, client) => {
        clients.insert({
          _rev : client._rev,
          name : req.body.name,
          secret : client.secret,
          redirect_uris : redirect_uris
        }, req.body.id, (err, body) => {
          if(err){
            req.session.error = err.reason;
            res.redirect('/clients');
          }else{
            req.session.success = "Success!";
            res.redirect('/clients');
          }
        });
      });
    });
  }else{
    clients.insert({
      name : req.body.name,
      secret : crypto.createHmac('sha256', uniqid()).update(uniqid()).digest('hex'),
      redirect_uris : req.body.redirect_uri
    }, uniqid(), (err, body) => {
      if(err){
        req.session.error = err.reason;
        res.redirect('/clients');
      }else{
        clients.get(body.id, (g_err, client) => {
          req.session.success = "Success!";
          req.session.client_id = client._id;
          req.session.client_secret = client.secret;
          res.redirect('/clients');
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
  users.get(req.query.id, (get_err, user) => {
    if(get_err){
      if(get_err.statusCode == 404){
        req.session.error = req.query.id + " not found";
      }else{
        req.session.error = get_err.reason;
      }
    }else{
      req.session.user = {
        id : user._id,
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
    users.get(req.body.id, (get_err, user) => {
      if(get_err){
        if(get_err.statusCode != 404){
          req.session.error = get_err.reason;
          res.redirect("/users");
        }else{
          user = {};
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
            user.password = bcrypt.hashSync(req.body.password, salt_rounds);
          }
        }
      }
      if(req.body.name)
        user.name = req.body.name;
      if(req.body.username)
        user.username = req.body.username;
      if(req.body.email)
        user.email = req.body.email;
      if(req.body.gender)
        user.gender = req.body.gender;
      if(req.body.dob)
        user.dob = new Date(req.body.dob);
      var userid = user._id || req.body.id;
      if(user._id)
        delete user._id;
      users.insert(user, userid, (ins_err, ins_body) => {
        if(ins_err){
          res.session.error = ins_err.reason;
          res.redirect("/users");
        }else{
          cache.hget('usernames', user.name.toUpperCase(), (cache_err, val) => {
            cache.hset('usernames', user.name.toUpperCase(), (val && !val.includes(userid)) ? val + userid + '+' : userid + '+');
          });
          user_cache.hset(userid, "_exists", 1);

          req.session.success = "Success!";
          if(req.body.autogenpass)
            req.session.success += " Autogenned password is " + req.body.password;
          res.redirect("/user?id=" + userid);
        }
      });
    });
  }
});

app.delete("/user/:id", getAuth, function(req, res){
  users.get(req.params.id, function(get_err, user){
    if(get_err){
      res.status(500).json({
        message : get_err.message
      });
    }else{
      nano.config.url = "http://" + req.auth.username + ":" + req.auth.pass + "@couchdb:5984"
      users.destroy(req.params.id, user._rev, function(des_err, body){
        nano.config.url = "http://" + process.env.COUCHDB_USER + ":" + process.env.COUCHDB_PASSWORD + "@couchdb:5984"
        if(des_err){
          res.status(500).json({
            message : des_err.message
          });
        }else{
          res.status(200).json({
            message : "Success!"
          });
        }
      });
    }
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
  channels.list({
    include_docs : true
  }, (list_err, body) => {
    async.each(body.rows, (row, cb) => {
      if(row.doc._id != '_design/channels')
        gcs_tmp[row.doc.group] ? gcs_tmp[row.doc.group].push(row.doc.channel) : gcs_tmp[row.doc.group] = [row.doc.channel];
      cb();
    }, () => {
      res.data.gcs = [];
      async.each(Object.keys(gcs_tmp), (group, cb2) => {
        res.data.gcs.push({
          group : group,
          channels : gcs_tmp[group]
        });
        cb2();
      }, () => {
        res.render('channels', res.data);
      });
    });
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
        channels.insert({
          group : req.body.group,
          channel : req.body.channel,
          users : []
        }, (ins_err, ins_body) => {
          if(ins_err){
            req.session.error = ins_err.reason;
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
    channels.view('channels', 'by_group_channel', {
      key : [req.body.group, req.body.channel],
      include_docs : true
    }, (chan_err, channel_docs) => {
      if(chan_err){
        req.session.error = chan_err.reason;
        res.redirect("/channels");
      }else{
        if(!channel_docs.rows[0]){
          req.session.error = "Group-Channel not found";
          res.redirect("/channels");
        }else{
          permissions.bulk({docs : [{
            user : req.body.userid,
            action : 'send_message',
            scope : {group : req.body.group, channel : req.body.channel},
            value : "1"
          },{
            user : req.body.userid,
            action : 'view_channel',
            scope : {group : req.body.group, channel : req.body.channel},
            value : {group : req.body.group, channel : req.body.channel}
          },{
            user : req.body.userid,
            action : 'send_file',
            scope : {group : req.body.group, channel : req.body.channel},
            value : "1"
          },{
            user : req.body.userid,
            action : 'add_user',
            scope : {group : req.body.group, channel : req.body.channel},
            value : "1"
          }]}, (ins_err, body) => {
            if(ins_err){
              req.session.error = ins_err.reason;
              res.redirect("/channels");
            }else{
              user_cache.hexists(req.body.user, req.body.group, (exists_err, group_exists) => {
                if(!group_exists){
                  permissions.insert({
                    user : req.body.userid,
                    action : 'add_channel',
                    scope : req.body.group,
                    value : "1"
                  }, (ins_channel_err, ins_channel_body) => {
                    user_cache.hset(req.body.user, req.body.group, 1);
                  });
                }
              });
              var channel = channel_docs.rows[0].doc;
              if(!channel.users.includes(req.body.userid))
                channel.users.push(req.body.userid);
              user_cache.hset(req.body.user, req.body.group + '+' + req.body.channel, 1);
              cache.set(req.body.group + '+' + req.body.channel, JSON.stringify(channel.users));
              channels.insert(channel, (mod_err, mod_bod) => {
                if(mod_err){
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
