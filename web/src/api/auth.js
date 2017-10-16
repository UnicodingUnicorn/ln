import options from '../options'

export default{
  withAuth(token, url){
    return options.OPENID_URL + '/verify/' + token + '/' + encodeURIComponent(url);
  }
}
