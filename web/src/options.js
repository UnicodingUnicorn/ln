var host = "192.168.99.100";

export default {
  CLIENT_ID : '406jko1jadsm11w',
  HISTORY_COUNT : 50,
  //SELF_URL : host + ":8080",
  SELF_URL : 'http://localhost:8080',
  OPENID_URL : "http://" + host + ":10202",
  MESSAGES_URL : "http://" + host + ":10204",
  ACCOUNTS_URL : "http://" + host + ":10206",
  FILES_URL : "http://" + host + ":10207",
  AVATAR_URL : "http://" + host + ":10207/default/avatar.png",
  SOCKETCLUSTER_HOST : host,
  SOCKETCLUSTER_PORT : '10203'
}
