var express = require("express");
var bodyParser = require("body-parser");
var cors = require("cors");

var async = require("async");
var colour = require("colors");

var redis = require("redis");
var cache = redis.createClient({
  host : 'redis',
  port : 6379,
  db : 0
});

var nano = require("nano")("http://" + process.env.COUCHDB_USER + ":" + process.env.COUCHDB_PASSWORD + "@couchdb:5984");
var creator = require("couchdb-creator");

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
        emit(doc.user, doc.value);
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
app.use(bodyParser.urlencoded({ extended : true}));

app.use(cors({
  "preflightContinue": false
}));

app.get("/", function(req, res){
  res.status(200).json({
    message : "Received at Messages API"
  });
});

app.get("/messages/:group/:channel", function(req, res){
  if(!req.get('User')){ //Check for user from auth
    res.status(404).json({
      message : 'No user found'
    });
  }else{
    cache.exists(req.params.group + '+' + req.params.channel, (exists_err, gc_exists) => { //Check if gc exists
      if(!gc_exists){
        res.status(404).json({
          message : 'No channel found'
        });
      }else{
        permissions.view("permissions", "by_user_action_scope", { //Finally check if user has permission to view the channel
          key : [req.get('User'), 'view_channel', {group : req.params.group, channel : req.params.channel}]
        }, (view_err, channels) => {
          if(!channels.rows[0]){
            res.status(403).json({
              message : 'No permission'
            });
          }else{
            var options = {
              key : [req.params.group, req.params.channel],
              include_docs : true
            };
            //Add in count and offset if present
            if(req.query.count)
              options.limit = req.query.count;
            if(req.query.offset)
              options.offset = req.query.offset;
            messages.view("messages", "by_channel", options, (err, body) => {
              if(err){
                res.status(200).json({}); //Just return an empty body
              }else{
                var messages_data = [];
                body.rows.forEach((message) => {
                  messages_data.push({
                    user : message.doc.user,
                    datetime : message.doc.datetime,
                    message : message.doc.message,
                    type : message.doc.type
                  });
                });
                res.status(200).json(messages_data);
              }
            });
          }
        });
      }
    });
  }
});

app.get("/channels", function(req, res){
  if(req.get('User')){
    permissions.view("permissions", "by_user_action", {
      key : [req.get('User'), 'view_channel']
    }, (view_err, channel_rows) => {
      var return_channels = [];
      async.each(channel_rows.rows, (channel, cb) => {
        channels.view('channels', 'by_group_channel', {
          key : [channel.value.group, channel.value.channel],
          include_docs : true
        }, (view_err, ch_rows) => {
          async.each(ch_rows.rows, (row, cb2) => {
            return_channels.push({
              group : row.doc.group,
              channel : row.doc.channel,
              users : row.doc.users
            });
            cb2();
          }, cb);
        });
      }, () => {
        res.status(200).json(return_channels);
      });
    });
  }else{
    res.status(404).json({
      message : 'No user found'
    });
  }
});

app.get('/pms', function(req, res){
  if(req.get('User')){
    pms.viewWithList("pms", "by_user", "by_user", {
      key : req.get('User')
    }, (view_err, body) => {
      res.status(200).json({
        message : 'Success',
        pms : body
      });
    });
  }else{
    res.status(404).json({
      message : 'No user found'
    });
  }
});

app.get("/pms/:user", function(req, res){
  if(req.get('User')){
    //Key is userid1+userid2, where userid1 < userid2 (using the weird string metrics)
    var key = req.get('User') < req.params.user ? req.get('User') + '+' + req.params.user : req.params.user + '+' + req.get('User');
    var options = {
      key : key,
      include_docs : true
    };
    //Add in count and offset if present
    if(req.query.count)
      options.limit = req.query.count;
    if(req.query.offset)
      options.offset = req.query.offset;
    pms.view("pms", "by_users", options, (view_err, rows) => {
      if(view_err){
        if(view_err.statusCode == 404){
          res.status(200).json({
            message : "Success",
            messages : []
          });
        }
      }else{
        var return_pms = [];
        rows.rows.forEach((row) => {
          return_pms.push({
            user : row.doc.user,
            users : row.doc.users,
            datetime : row.doc.datetime,
            message : row.doc.message,
            type : row.doc.type
          });
        });
        res.status(200).json({
          message : "Success",
          messages : return_pms
        });
      }
    });
  }else{
    res.status(404).json({
      message : 'No user found'
    });
  }
});

app.listen(process.env.MESSAGES_PORT, function(err){
  err ? console.error(err) : console.log(("Messages API up at " + process.env.MESSAGES_PORT).green);
})
