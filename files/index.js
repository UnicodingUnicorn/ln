var express = require("express");
var bodyParser = require("body-parser");
var cors = require("cors");

var multer = require('multer');
var storage = multer.memoryStorage();
var upload = multer({
  fileSize : process.env.MAX_SIZE,
  storage : storage
});

var minio = require("minio");
var mClient = new minio.Client({
  endPoint : 'minio',
  port : 9000,
  secure : false,
  accessKey : process.env.MINIO_ACCESS_KEY,
  secretKey : process.env.MINIO_SECRET_KEY
});

var redis = require("redis");
var filesCache = redis.createClient({
  host : 'redis',
  port : 6379,
  db : 3
});

var colours = require("colors");
var crypto = require("crypto");
var streamifier = require("streamifier");
var uniqid = require("uniqid");

var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended : true}));
app.use(cors());

app.get('/', function(req, res){
  res.status(200).json({
    message : "Received at Files API"
  });
});

app.options('/file', cors());
app.post('/file', upload.single('file'), function(req, res){
  var user = req.get('User');
  if(!user){
    res.status(403).json({
      message : 'No permission'
    });
  }else if(!req.file){
    res.status(400).json({
      message : "File not found"
    });
  }else{
    var putFile = (user, file, id) => { //Common function so the same code need not exist twice in this file
      //Give inserted file random key + extension
      mClient.putObject(user, id, file.buffer, (put_err, etag) => {
        if(put_err){
          console.log(put_err);
          res.status(500).json({
            message : "Error storing file"
          });
        }else{
          res.status(200).json({
            message : "Success",
            filename : id,
            originalname : file.originalname
          });
        }
      });
    };
    //Compute file's hash and checks for presence in cache.
    var rs = streamifier.createReadStream(req.file.buffer);
    var shasum = crypto.createHash('sha256');
    rs.on('data', (data) => {
      shasum.update(data);
    });
    rs.on('end', () => {
      var hash = shasum.digest('hex');
      filesCache.get(hash, (get_err, file_users) => { //Check cache for existence of hash
        if(file_users)
          file_users = JSON.parse(file_users);
        if(file_users && Object.keys(file_users).includes(user)){
          res.status(200).json({
            message : "Success",
            filename : file_users[user],
            originalname : req.file.originalname
          });
        }else{
          if(!file_users)
            file_users = {};
          var id = uniqid() + '.' + req.file.originalname.split('.')[req.file.originalname.split('.').length - 1];
          file_users[user] = id;
          filesCache.set(hash, JSON.stringify(file_users));
          mClient.bucketExists(user, (exists_err) => {
            if(exists_err){ //Create user bucket if it doesn't exist
              mClient.makeBucket(user, 'ap-southeast-1', (make_err) => {
                if(make_err){
                  res.status(500).json({
                    message : "Error storing file"
                  });
                }else{
                  putFile(user, req.file, id);
                }
              });
            }else{
              putFile(user, req.file, id);
            }
          });
        }
      });
    });
  }
});

//Files are stored in bucket <userid>
app.get('/file/:user/:id', function(req, res){
  mClient.getObject(req.params.user, req.params.id, (err, stream) => {
    if(err){
      if(err.code == 'NoSuchKey'){
        res.status(404).json({
          message : "No such file"
        });
      }else{
        res.status(500).json({
          message : "Error retrieving file"
        });
      }
    }else{
      stream.pipe(res);
    }
  });
});

app.listen(process.env.FILES_PORT, function(err){
  err ? console.error(err) : console.log(("Files API up at " + process.env.FILES_PORT).green);
})
