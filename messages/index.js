var express = require("express");
var bodyParser = require("body-parser");
var bearer = require("express-bearer-token");
var cors = require("cors");

var async = require("async");
var colour = require("colors");
var jwt = require("jsonwebtoken");
var secret = process.env.SECRET;

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

app.options("/messages/:channel/:count", function(req, res){
  res.status(200);
});
app.get("/messages/:channel/:count", function(req, res){
  if(req.get('User')){
    var gc = JSON.parse(req.params.channel);
    permissions.view("permissions", "by_user_action_scope", {
      key : [req.get('User'), 'view_channel', gc]
    }, function(view_err, channels){
      if(channels.rows[0]){
        messages.view("messages", "by_channel", {
          key : [gc.group, gc.channel],
          include_docs : true,
          limit : req.params.count,
          descending : true
        }, function(err, body){
          if(err){
            res.status(200).json({});
          }else{
            var messages_data = [];
            body.rows.forEach(function(message){
              messages_data.push({
                user : message.doc.user,
                datetime : message.doc.datetime,
                message : message.doc.message,
                type : message.doc.type
              });
            });
            res.status(200).json(messages_data.reverse());
          }
        });
      }else{
        res.status(404).json({
          message : 'No channel found'
        });
      }
    });
  }else{
    res.status(404).json({
      message : 'No user found'
    });
  }
});

app.options("/messages/:channel/:offset/:count", function(req, res){
  res.status(200);
});
app.get("/messages/:channel/:offset/:count", function(req, res){
  if(req.get('User')){
    var gc = JSON.parse(req.params.channel);
    permissions.view("permissions", "by_user_action_scope", {
      key : [req.get('User'), 'view_channel', gc]
    }, function(view_err, channels){
      if(channels.rows[0]){
        messages.view("messages", "by_channel", {
          key : [gc.group, gc.channel],
          include_docs : true,
          limit : req.params.count,
          skip : req.params.offset,
          descending : true
        }, function(err, body){
          if(err){
            res.status(200).json({});
          }else{
            var messages_data = [];
            body.rows.forEach(function(message){
              messages_data.push({
                user : message.doc.user,
                datetime : message.doc.datetime,
                message : message.doc.message,
                type : message.doc.type
              });
            });
            res.status(200).json(messages_data.reverse());
          }
        });
      }else{
        res.status(404).json({
          message : 'No channel found'
        });
      }
    });
  }else{
    res.status(404).json({
      message : 'No user found'
    });
  }
});

app.get("/channels", function(req, res){
  if(req.get('User')){
    permissions.view("permissions", "by_user_action", {
      key : [req.get('User'), 'view_channel']
    }, function(view_err, channels){
      var return_channels = [];
      async.each(channels.rows, function(channel, cb){
        return_channels.push(channel.value);
        cb();
      }, function(err){
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
    }, function(view_err, body){
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

app.get("/pms/:user/:count", function(req, res){
  if(req.get('User')){
    var key = req.get('User') < req.params.user ? req.get('User') + '+' + req.params.user : req.params.user + '+' + req.get('User');
    pms.view("pms", "by_users", {
      key : key,
      limit : req.params.count,
      include_docs : true,
      descending : true
    }, function(view_err, rows){
      if(view_err){
        if(view_err.statusCode == 404){
          res.status(200).json({
            message : "Success",
            messages : []
          });
        }
      }else{
        var return_pms = [];
        rows.rows.forEach(function(row){
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
          messages : return_pms.reverse()
        });
      }
    });
  }else{
    res.status(404).json({
      message : 'No user found'
    });
  }
});

app.get("/pms/:user/:offset/:count", function(req, res){
  if(req.get('User')){
    var key = req.get('User') < req.params.user ? req.get('User') + '+' + req.params.user : req.params.user + '+' + req.get('User');
    pms.view("pms", "by_users", {
      key : key,
      limit : req.params.count,
      skip : req.params.offset,
      include_docs : true,
      descending : true
    }, function(view_err, rows){
      if(view_err){
        if(view_err.statusCode == 404){
          res.status(200).json({
            message : "Success",
            messages : []
          });
        }
      }else{
        var return_pms = [];
        rows.rows.forEach(function(row){
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
          messages : return_pms.reverse()
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
  err ? console.error(err) : console.log(("Messages API up at " + process.env.MESSAGES_PORT).rainbow);
})
