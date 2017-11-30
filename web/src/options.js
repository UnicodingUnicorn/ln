var host = "192.168.99.100";

export default {
  CLIENT_ID : '406jko1jadsm11w',
  CLIENT_SECRET : '5b8ead95c34d7b717826533883705cc6efe9971f2345341b8e570d14ba2fdd38',
  HISTORY_COUNT : 50,
  //SELF_URL : host + ":8080",
  SELF_URL : 'http://localhost:8080',
  OPENID_URL : "http://" + host + ":10202",
  MESSAGES_URL : "http://" + host + ":10204",
  ACCOUNTS_URL : "http://" + host + ":10206",
  FILES_URL : "http://" + host + ":10207",
  SOCKETCLUSTER_HOST : host,
  SOCKETCLUSTER_PORT : '10203'
}
