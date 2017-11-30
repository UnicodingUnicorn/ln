var express = require("express");
var bodyParser = require("body-parser");
var cors = require("cors");

var colors = require("colors");
var request = require("request");

var nano = require("nano")("http://" + process.env.COUCHDB_USER + ":" + process.env.COUCHDB_PASSWORD + "@couchdb:5984");
var creator = require("couchdb-creator");

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

app.get('/', function(req, res){
  res.status(200).send("Received at Permissions API");
});

app.get('/verify/:action', function(req, res){
  permissions.view('permissions', 'by_user_action', {
    key : [req.get('User'), req.params.action]
  }, function(get_err, perms){
    if(get_err || !perms.rows[0]){
      res.status(403).send("Forbidden");
    }else{
      res.status(200).send(perms.rows[0].value);
    }
  });
});

app.get('/verify/:action/:scope', function(req, res){
  permissions.view('permissions', 'by_user_action_scope', {
    key : [req.get('User'), req.params.action, req.params.scope]
  }, function(get_err, perms){
    if(get_err || !perms.rows[0]){
      res.status(403).send("Forbidden");
    }else{
      res.status(200).send(perms.rows[0].value);
    }
  });
});

app.all('/auth/:action/:target_url', function(req, res){
  permissions.view('permissions', 'by_user_action', {
    key : [req.get('User'), req.params.action]
  }, function(get_err, perms){
    if(get_err || !perms.rows[0]){
      res.status(403).send("Forbidden");
    }else{
      req.pipe(request(req.params.target_url).on('error', function(err){
        res.status(404).send("Not found");
      })).pipe(res);
    }
  });
});

app.all('/auth/:action/:scope/:target_url', function(req, res){
  permissions.view('permissions', 'by_user_action_scope', {
    key : [req.get('User'), req.params.action, req.params.scope]
  }, function(get_err, perms){
    if(get_err || !perms.rows[0]){
      res.status(403).send("Forbidden");
    }else{
      req.pipe(request(req.params.target_url).on('error', function(err){
        res.status(404).send("Not found");
      })).pipe(res);
    }
  });
});

app.listen(process.env.PERMISSIONS_PORT, function(err){
  err ? console.error(err) : console.log(("Permissions service up at " + process.env.PERMISSIONS_PORT).rainbow);
});
