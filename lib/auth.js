function getUser(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/nexus_user=([^;]+)/);
  return match ? match[1] : null;
}

module.exports = { getUser };
